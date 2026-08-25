"""Support chat: the user's thread, staff replies, read state, and the FAQ."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.integrations import push
from app.models.enums import MessageSender, NotificationType, TicketStatus, UserRole
from app.models.support import SupportTicket
from app.models.user import User


@pytest.fixture
def sent(monkeypatch):
    calls: list[dict] = []

    async def _capture(tokens, *, title, body, data=None):
        calls.append({"tokens": list(tokens), "title": title, "body": body, "data": data or {}})
        return push.PushResult(sent=len(tokens))

    monkeypatch.setattr(push, "safe_send", _capture)
    return calls


async def consumer(client, email="walker@example.com"):
    resp = await client.post(
        "/v1/auth/register", json={"email": email, "password": "correct-horse"}
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def admin_headers(client, db, email="boss@example.com"):
    await client.post("/v1/auth/register", json={"email": email, "password": "correct-horse"})
    user = await db.scalar(select(User).where(User.email == email))
    user.role = UserRole.SUPERADMIN
    await db.commit()
    resp = await client.post(
        "/v1/auth/staff/login", json={"email": email, "password": "correct-horse"}
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def say(client, headers, text):
    return await client.post("/v1/support/messages", json={"body": text}, headers=headers)


# --- the user's thread ------------------------------------------------------


async def test_a_new_user_has_no_thread(client):
    headers = await consumer(client)
    assert (await client.get("/v1/support/thread", headers=headers)).json() is None

    badge = (await client.get("/v1/support/badge", headers=headers)).json()
    assert badge == {"unread": 0, "has_open_thread": False}


async def test_the_first_message_opens_a_thread(client, db):
    headers = await consumer(client)

    resp = await say(client, headers, "My steps are not syncing.")
    assert resp.status_code == 201, resp.text
    assert resp.json()["sender"] == MessageSender.USER

    thread = (await client.get("/v1/support/thread", headers=headers)).json()
    assert thread["status"] == TicketStatus.OPEN
    assert len(thread["messages"]) == 1
    assert thread["subject"] == "My steps are not syncing."


async def test_further_messages_join_the_same_thread(client, db):
    headers = await consumer(client)
    await say(client, headers, "First")
    await say(client, headers, "Second")

    thread = (await client.get("/v1/support/thread", headers=headers)).json()
    assert [m["body"] for m in thread["messages"]] == ["First", "Second"]

    tickets = list((await db.scalars(select(SupportTicket))).all())
    assert len(tickets) == 1


async def test_an_empty_message_is_refused(client):
    headers = await consumer(client)
    resp = await client.post("/v1/support/messages", json={"body": "   "}, headers=headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "EMPTY_MESSAGE"


async def test_a_blank_body_fails_validation(client):
    headers = await consumer(client)
    resp = await client.post("/v1/support/messages", json={"body": ""}, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_support_chat_requires_auth(client):
    assert (await client.post("/v1/support/messages", json={"body": "hi"})).status_code == 401
    assert (await client.get("/v1/support/thread")).status_code == 401


async def test_a_user_cannot_read_another_users_thread(client, db):
    owner = await consumer(client, "owner@example.com")
    await say(client, owner, "Private matter")
    ticket_id = (await client.get("/v1/support/thread", headers=owner)).json()["ticket_id"]

    stranger = await consumer(client, "stranger@example.com")
    resp = await client.get(f"/v1/support/thread?ticket_id={ticket_id}", headers=stranger)
    assert resp.status_code == 404


# --- staff replies ----------------------------------------------------------


async def test_staff_sees_the_ticket_and_can_reply(client, db):
    walker = await consumer(client)
    await say(client, walker, "Where are my coins?")
    staff = await admin_headers(client, db)

    queue = (await client.get("/v1/admin/support/tickets", headers=staff)).json()
    assert len(queue["items"]) == 1
    row = queue["items"][0]
    assert row["awaiting_reply"] is True
    assert row["message_count"] == 1
    assert row["user_label"] == "walker@example.com"

    reply = await client.post(
        f"/v1/admin/support/tickets/{row['id']}/reply",
        json={"body": "They arrive at the end of the day."},
        headers=staff,
    )
    assert reply.status_code == 201
    assert reply.json()["sender"] == MessageSender.ADMIN

    thread = (await client.get("/v1/support/thread", headers=walker)).json()
    assert len(thread["messages"]) == 2


async def test_a_reply_notifies_and_pushes_to_the_user(client, db, sent):
    walker = await consumer(client)
    await client.post(
        "/v1/notifications/push-token",
        json={"device_id": "d1", "push_token": "walker-token"},
        headers=walker,
    )
    await say(client, walker, "Help")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]

    sent.clear()
    await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/reply",
        json={"body": "Sure, here is what to do."},
        headers=staff,
    )

    assert sent[0]["tokens"] == ["walker-token"]
    assert sent[0]["title"] == "Support replied"

    inbox = (await client.get("/v1/notifications", headers=walker)).json()
    assert inbox["items"][0]["notification_type"] == NotificationType.SUPPORT_REPLY


async def test_a_long_reply_is_truncated_in_the_push_preview(client, db, sent):
    """A lock-screen banner is the wrong place for a full support answer."""
    walker = await consumer(client)
    await say(client, walker, "Help")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]

    long_answer = "x" * 400
    await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/reply",
        json={"body": long_answer},
        headers=staff,
    )

    thread = (await client.get("/v1/support/thread", headers=walker)).json()
    # The full text is in the thread; only the notification body is shortened.
    assert thread["messages"][-1]["body"] == long_answer

    inbox = (await client.get("/v1/notifications", headers=walker)).json()
    assert len(inbox["items"][0]["body"]) < 130


async def test_a_consumer_cannot_reach_the_staff_console(client):
    headers = await consumer(client)
    assert (await client.get("/v1/admin/support/tickets", headers=headers)).status_code == 403


# --- read state -------------------------------------------------------------


async def test_the_badge_counts_unread_staff_replies(client, db):
    walker = await consumer(client)
    await say(client, walker, "Question")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]

    await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/reply", json={"body": "A"}, headers=staff
    )
    await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/reply", json={"body": "B"}, headers=staff
    )

    assert (await client.get("/v1/support/badge", headers=walker)).json()["unread"] == 2

    # Opening the thread is what "reading" means.
    await client.get("/v1/support/thread", headers=walker)
    assert (await client.get("/v1/support/badge", headers=walker)).json()["unread"] == 0


async def test_the_users_own_messages_never_count_as_unread(client, db):
    walker = await consumer(client)
    await say(client, walker, "One")
    await say(client, walker, "Two")

    assert (await client.get("/v1/support/badge", headers=walker)).json()["unread"] == 0


async def test_staff_opening_a_ticket_clears_awaiting_reply_on_read(client, db):
    walker = await consumer(client)
    await say(client, walker, "Question")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]

    thread = (await client.get(f"/v1/admin/support/tickets/{ticket_id}", headers=staff)).json()
    assert thread["messages"][0]["read_at"] is not None
    # Reading is not answering: it still shows as awaiting a reply.
    queue = (await client.get("/v1/admin/support/tickets", headers=staff)).json()
    assert queue["items"][0]["awaiting_reply"] is True


# --- closing ----------------------------------------------------------------


async def test_closing_a_ticket(client, db):
    walker = await consumer(client)
    await say(client, walker, "Question")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]

    closed = await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/close", headers=staff
    )
    assert closed.json()["status"] == TicketStatus.CLOSED
    assert closed.json()["closed_at"] is not None

    assert (await client.get("/v1/support/thread", headers=walker)).json() is None


async def test_a_closed_ticket_cannot_be_replied_to(client, db):
    walker = await consumer(client)
    await say(client, walker, "Question")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]
    await client.post(f"/v1/admin/support/tickets/{ticket_id}/close", headers=staff)

    resp = await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/reply", json={"body": "Late"}, headers=staff
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "TICKET_CLOSED"


async def test_writing_after_a_close_starts_a_fresh_ticket(client, db):
    """A closed thread must stay an accurate record of what was resolved."""
    walker = await consumer(client)
    await say(client, walker, "First problem")
    staff = await admin_headers(client, db)
    first_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]
    await client.post(f"/v1/admin/support/tickets/{first_id}/close", headers=staff)

    await say(client, walker, "Second problem")

    tickets = (await client.get("/v1/support/tickets", headers=walker)).json()
    assert len(tickets) == 2
    assert {t["status"] for t in tickets} == {TicketStatus.OPEN, TicketStatus.CLOSED}

    thread = (await client.get("/v1/support/thread", headers=walker)).json()
    assert [m["body"] for m in thread["messages"]] == ["Second problem"]


async def test_reopening_a_ticket(client, db):
    walker = await consumer(client)
    await say(client, walker, "Question")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]
    await client.post(f"/v1/admin/support/tickets/{ticket_id}/close", headers=staff)

    reopened = await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/reopen", headers=staff
    )
    assert reopened.json()["status"] == TicketStatus.OPEN
    assert reopened.json()["closed_at"] is None

    assert (
        await client.post(
            f"/v1/admin/support/tickets/{ticket_id}/reply", json={"body": "Ok"}, headers=staff
        )
    ).status_code == 201


async def test_closing_twice_is_refused(client, db):
    walker = await consumer(client)
    await say(client, walker, "Question")
    staff = await admin_headers(client, db)
    ticket_id = (await client.get("/v1/admin/support/tickets", headers=staff)).json()["items"][
        0
    ]["id"]
    await client.post(f"/v1/admin/support/tickets/{ticket_id}/close", headers=staff)

    resp = await client.post(f"/v1/admin/support/tickets/{ticket_id}/close", headers=staff)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "NO_STATUS_CHANGE"


# --- queue counts -----------------------------------------------------------


async def test_the_queue_counts_only_tickets_awaiting_a_reply(client, db):
    first = await consumer(client, "one@example.com")
    second = await consumer(client, "two@example.com")
    await say(client, first, "Waiting")
    await say(client, second, "Also waiting")
    staff = await admin_headers(client, db)

    counts = (await client.get("/v1/admin/support/queue", headers=staff)).json()
    assert counts == {"open_tickets": 2, "awaiting_reply": 2}

    ticket_id = (
        await client.get("/v1/admin/support/tickets", headers=staff)
    ).json()["items"][0]["id"]
    await client.post(
        f"/v1/admin/support/tickets/{ticket_id}/reply", json={"body": "Answered"}, headers=staff
    )

    counts = (await client.get("/v1/admin/support/queue", headers=staff)).json()
    assert counts == {"open_tickets": 2, "awaiting_reply": 1}


async def test_support_shows_up_in_the_moderation_dashboard(client, db):
    walker = await consumer(client)
    await say(client, walker, "Help")
    staff = await admin_headers(client, db)

    queue = (await client.get("/v1/admin/queue", headers=staff)).json()
    assert queue["support_tickets"] == 1


async def test_the_staff_queue_filters_by_status(client, db):
    first = await consumer(client, "one@example.com")
    second = await consumer(client, "two@example.com")
    await say(client, first, "A")
    await say(client, second, "B")
    staff = await admin_headers(client, db)

    all_tickets = (await client.get("/v1/admin/support/tickets", headers=staff)).json()
    await client.post(
        f"/v1/admin/support/tickets/{all_tickets['items'][0]['id']}/close", headers=staff
    )

    closed = (
        await client.get("/v1/admin/support/tickets?ticket_status=closed", headers=staff)
    ).json()
    assert len(closed["items"]) == 1

    still_open = (
        await client.get("/v1/admin/support/tickets?ticket_status=open", headers=staff)
    ).json()
    assert len(still_open["items"]) == 1


# --- FAQ --------------------------------------------------------------------


async def test_the_faq_is_public_and_ordered(client, db):
    staff = await admin_headers(client, db)
    await client.post(
        "/v1/admin/support/faq",
        json={"question": "Second?", "answer": "B", "sort_order": 2},
        headers=staff,
    )
    await client.post(
        "/v1/admin/support/faq",
        json={"question": "First?", "answer": "A", "sort_order": 1},
        headers=staff,
    )

    faq = (await client.get("/v1/support/faq")).json()
    assert [entry["question"] for entry in faq] == ["First?", "Second?"]


async def test_staff_can_edit_and_delete_a_faq_entry(client, db):
    staff = await admin_headers(client, db)
    entry = (
        await client.post(
            "/v1/admin/support/faq",
            json={"question": "How?", "answer": "Like this."},
            headers=staff,
        )
    ).json()

    updated = await client.patch(
        f"/v1/admin/support/faq/{entry['id']}",
        json={"answer": "Actually, like that."},
        headers=staff,
    )
    assert updated.json()["answer"] == "Actually, like that."

    assert (
        await client.delete(f"/v1/admin/support/faq/{entry['id']}", headers=staff)
    ).status_code == 200
    assert (await client.get("/v1/support/faq")).json() == []


async def test_a_consumer_cannot_edit_the_faq(client):
    headers = await consumer(client)
    resp = await client.post(
        "/v1/admin/support/faq",
        json={"question": "Mine?", "answer": "No."},
        headers=headers,
    )
    assert resp.status_code == 403
