"""Leaderboard ranking and the workout bonus."""

from __future__ import annotations

from datetime import timedelta

from app.core.time import utcnow

SYNC = "/v1/steps/sync"


async def walker(client, email, steps=None, name=""):
    resp = await client.post(
        "/v1/auth/register",
        json={"email": email, "password": "correct-horse", "full_name": name},
    )
    headers = {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}
    if steps:
        await client.post(
            SYNC,
            json={"date": utcnow().date().isoformat(), "steps": steps},
            headers=headers,
        )
    return headers


# --- leaderboard ------------------------------------------------------------


async def test_the_board_ranks_by_steps(client):
    await walker(client, "slow@example.com", 6_000, "Slow Sam")
    await walker(client, "fast@example.com", 18_000, "Fast Fay")
    me = await walker(client, "mid@example.com", 12_000, "Mid Max")

    board = (await client.get("/v1/leaderboard", headers=me)).json()

    assert [row["name"] for row in board["items"]] == ["Fast Fay", "Mid Max", "Slow Sam"]
    assert [row["rank"] for row in board["items"]] == [1, 2, 3]
    assert board["self"] == {"rank": 2, "steps": 12_000}


async def test_the_viewer_is_marked_on_the_board(client):
    await walker(client, "other@example.com", 9_000, "Other")
    me = await walker(client, "me@example.com", 5_000, "Me")

    board = (await client.get("/v1/leaderboard", headers=me)).json()
    mine = [row for row in board["items"] if row["is_self"]]

    assert len(mine) == 1
    assert mine[0]["name"] == "Me"


async def test_flagged_days_do_not_buy_a_rank(client):
    """A day withheld from the ledger must not rank either."""
    honest = await walker(client, "honest@example.com", 10_000, "Honest")
    cheat = await walker(client, "cheat@example.com", name="Cheat")

    # Over the plausibility limit: flagged, no coins, and no place on the board.
    await client.post(
        SYNC,
        json={"date": utcnow().date().isoformat(), "steps": 45_000},
        headers=cheat,
    )

    board = (await client.get("/v1/leaderboard", headers=honest)).json()
    names = [row["name"] for row in board["items"]]

    assert names == ["Honest"]
    assert "Cheat" not in names


async def test_a_user_with_no_steps_still_gets_their_own_row(client):
    await walker(client, "active@example.com", 8_000, "Active")
    idle = await walker(client, "idle@example.com", name="Idle")

    board = (await client.get("/v1/leaderboard", headers=idle)).json()
    assert board["self"]["steps"] == 0


async def test_the_board_never_shows_a_full_email(client):
    """It is visible to every signed-in user, so identifiers must not leak."""
    me = await walker(client, "someone@example.com", 7_000)  # no full_name

    board = (await client.get("/v1/leaderboard", headers=me)).json()
    shown = board["items"][0]["name"]

    assert "@" not in shown
    assert shown == "Someone"


async def test_weekly_covers_more_than_today(client):
    me = await walker(client, "week@example.com", name="Week")
    yesterday = (utcnow().date() - timedelta(days=1)).isoformat()

    await client.post(SYNC, json={"date": yesterday, "steps": 7_000}, headers=me)
    await client.post(
        SYNC, json={"date": utcnow().date().isoformat(), "steps": 3_000}, headers=me
    )

    daily = (await client.get("/v1/leaderboard?period=daily", headers=me)).json()
    weekly = (await client.get("/v1/leaderboard?period=weekly", headers=me)).json()

    assert daily["self"]["steps"] == 3_000
    # Weekly starts on Monday, so it holds at least today; yesterday counts too
    # unless today happens to be a Monday.
    assert weekly["self"]["steps"] >= daily["self"]["steps"]


async def test_the_board_requires_authentication(client):
    assert (await client.get("/v1/leaderboard")).status_code == 401


# --- workouts ---------------------------------------------------------------


async def test_a_workout_pays_nothing(client):
    """Sessions record activity; they do not mint coins."""
    me = await walker(client, "runner@example.com")

    started = await client.post("/v1/workouts", json={"kind": "run"}, headers=me)
    assert started.status_code == 201
    workout_id = started.json()["id"]

    finished = await client.post(
        f"/v1/workouts/{workout_id}/finish",
        json={"duration_seconds": 1800, "distance_km": 5.0, "steps": 6000},
        headers=me,
    )
    assert finished.status_code == 200
    body = finished.json()

    assert body["coins_awarded"] == 0
    assert body["balance"] == 0
    assert body["workout"]["bonus_paid"] == 0
    # The session itself is still recorded — only the payout is gone.
    assert body["workout"]["is_finished"] is True
    assert body["workout"]["distance_km"] == 5.0


async def test_a_minute_long_session_mints_nothing(client):
    """The exploit this closes.

    The client fabricated 0.002 km per second — 7.2 km/h, comfortably under the
    25 km/h plausibility check — and the payout had a flat 180-coin floor that
    ignored distance. So sixty seconds of standing still paid 180 real coins.
    """
    me = await walker(client, "exploit@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]

    body = (
        await client.post(
            f"/v1/workouts/{workout_id}/finish",
            json={"duration_seconds": 60, "distance_km": 0.12},
            headers=me,
        )
    ).json()

    assert body["coins_awarded"] == 0
    assert (await client.get("/v1/wallet", headers=me)).json()["balance"] == 0


async def test_finishing_twice_is_still_harmless(client):
    me = await walker(client, "twice@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]

    payload = {"duration_seconds": 1800, "distance_km": 4.0}
    first = await client.post(f"/v1/workouts/{workout_id}/finish", json=payload, headers=me)
    second = await client.post(f"/v1/workouts/{workout_id}/finish", json=payload, headers=me)

    assert first.json()["coins_awarded"] == 0
    assert second.json()["coins_awarded"] == 0
    assert second.json()["balance"] == 0


async def test_starting_twice_returns_the_same_session(client):
    me = await walker(client, "double@example.com")

    first = await client.post("/v1/workouts", json={}, headers=me)
    second = await client.post("/v1/workouts", json={}, headers=me)

    assert first.json()["id"] == second.json()["id"]


async def test_an_implausibly_fast_session_is_flagged_and_pays_nothing(client):
    me = await walker(client, "driver@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]

    # 30 km in half an hour is 60 km/h — a car, not a walk.
    body = (
        await client.post(
            f"/v1/workouts/{workout_id}/finish",
            json={"duration_seconds": 1800, "distance_km": 30.0},
            headers=me,
        )
    ).json()

    # Flagging still happens — the moderation queue reads it — even though no
    # session pays, so a zero payout here is no longer what proves the point.
    assert body["workout"]["is_suspicious"] is True
    assert body["coins_awarded"] == 0


async def test_a_flagged_user_is_not_blocked(client):
    me = await walker(client, "flagged@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]
    await client.post(
        f"/v1/workouts/{workout_id}/finish",
        json={"duration_seconds": 600, "distance_km": 40.0},
        headers=me,
    )

    assert (await client.get("/v1/auth/me", headers=me)).status_code == 200


async def test_a_session_too_short_to_be_real_is_refused(client):
    me = await walker(client, "tapper@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]

    resp = await client.post(
        f"/v1/workouts/{workout_id}/finish",
        json={"duration_seconds": 5, "distance_km": 0.1},
        headers=me,
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WORKOUT_TOO_SHORT"


async def test_progress_only_moves_forward(client):
    """A late packet reporting less must not rewind the session."""
    me = await walker(client, "progress@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]

    await client.patch(
        f"/v1/workouts/{workout_id}",
        json={"distance_km": 3.0, "duration_seconds": 900},
        headers=me,
    )
    back = await client.patch(
        f"/v1/workouts/{workout_id}",
        json={"distance_km": 1.0, "duration_seconds": 300},
        headers=me,
    )

    assert back.json()["distance_km"] == 3.0
    assert back.json()["duration_seconds"] == 900


async def test_a_finished_session_cannot_be_edited(client):
    me = await walker(client, "closed@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]
    await client.post(
        f"/v1/workouts/{workout_id}/finish",
        json={"duration_seconds": 1200, "distance_km": 2.0},
        headers=me,
    )

    resp = await client.patch(
        f"/v1/workouts/{workout_id}", json={"distance_km": 99.0}, headers=me
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_FINISHED"


async def test_you_cannot_touch_someone_elses_workout(client):
    owner = await walker(client, "owner@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=owner)).json()["id"]

    stranger = await walker(client, "stranger@example.com")
    resp = await client.patch(
        f"/v1/workouts/{workout_id}", json={"distance_km": 5.0}, headers=stranger
    )
    assert resp.status_code == 404


async def test_history_active_and_summary(client):
    me = await walker(client, "history@example.com")

    assert (await client.get("/v1/workouts/active", headers=me)).json() is None
    assert (await client.get("/v1/workouts/last", headers=me)).json() is None

    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]
    assert (await client.get("/v1/workouts/active", headers=me)).json()["id"] == workout_id

    await client.post(
        f"/v1/workouts/{workout_id}/finish",
        json={"duration_seconds": 1800, "distance_km": 4.0, "calories_kcal": 260},
        headers=me,
    )

    assert (await client.get("/v1/workouts/active", headers=me)).json() is None
    assert (await client.get("/v1/workouts/last", headers=me)).json()["id"] == workout_id
    assert len((await client.get("/v1/workouts", headers=me)).json()) == 1

    summary = (await client.get("/v1/workouts/summary", headers=me)).json()
    assert summary["sessions"] == 1
    assert summary["distance_km"] == 4.0
    assert summary["coins"] == 0


async def test_a_workout_touches_neither_the_wallet_nor_the_inbox(client):
    me = await walker(client, "wallet@example.com")
    workout_id = (await client.post("/v1/workouts", json={}, headers=me)).json()["id"]
    await client.post(
        f"/v1/workouts/{workout_id}/finish",
        json={"duration_seconds": 1800, "distance_km": 6.0},
        headers=me,
    )

    wallet = (await client.get("/v1/wallet", headers=me)).json()
    assert wallet["balance"] == 0
    assert wallet["earned_total"] == 0

    # No ledger entry means nothing to announce.
    assert (await client.get("/v1/notifications", headers=me)).json()["items"] == []
