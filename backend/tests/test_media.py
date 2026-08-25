"""Media uploads: who may upload, what is accepted, and where it lands."""

from __future__ import annotations

import io

import pytest
from sqlalchemy import select

from app.models.enums import UserRole
from app.models.media import Media
from app.models.user import User
from app.services import media as media_service

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
JPEG = b"\xff\xd8\xff" + b"0" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"0" * 64


@pytest.fixture(autouse=True)
def media_root(tmp_path, monkeypatch):
    """Write uploads into a temp directory instead of the repo's media folder."""
    from app.storage import factory, local

    monkeypatch.setattr(
        factory, "get_storage", lambda: local.LocalStorage(root=str(tmp_path), url_prefix="/media")
    )
    monkeypatch.setattr(
        media_service, "get_storage", lambda: local.LocalStorage(root=str(tmp_path), url_prefix="/media")
    )
    return tmp_path


async def partner_headers(client, email="cafe@example.com"):
    resp = await client.post(
        "/v1/partners/register",
        json={"email": email, "password": "correct-horse", "company_name": "Bean There"},
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def consumer_headers(client, email="walker@example.com"):
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


def upload_files(data: bytes, name: str, content_type: str):
    return {"file": (name, io.BytesIO(data), content_type)}


async def test_partner_uploads_an_image(client, db, media_root):
    headers = await partner_headers(client)

    resp = await client.post(
        "/v1/media/uploads",
        files=upload_files(PNG, "logo.png", "image/png"),
        data={"purpose": "logo"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["purpose"] == "logo"
    assert body["key"].startswith("logo/")
    assert body["key"].endswith(".png")
    assert body["url"] == f"/media/{body['key']}"
    assert (media_root / body["key"]).exists()


async def test_the_stored_name_is_never_the_uploaded_name(client, media_root):
    """An attacker-supplied filename must not decide where bytes land."""
    headers = await partner_headers(client)

    resp = await client.post(
        "/v1/media/uploads",
        files=upload_files(PNG, "../../../etc/passwd.png", "image/png"),
        data={"purpose": "coupon"},
        headers=headers,
    )
    assert resp.status_code == 201
    key = resp.json()["key"]

    assert ".." not in key
    assert key.startswith("coupon/")
    assert (media_root / key).exists()


async def test_a_consumer_cannot_upload(client):
    headers = await consumer_headers(client)
    resp = await client.post(
        "/v1/media/uploads", files=upload_files(PNG, "x.png", "image/png"), headers=headers
    )
    assert resp.status_code == 403


async def test_upload_requires_authentication(client):
    resp = await client.post("/v1/media/uploads", files=upload_files(PNG, "x.png", "image/png"))
    assert resp.status_code == 401


async def test_an_unsupported_type_is_refused(client):
    headers = await partner_headers(client)
    resp = await client.post(
        "/v1/media/uploads",
        files=upload_files(b"%PDF-1.7", "doc.pdf", "application/pdf"),
        headers=headers,
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


async def test_content_that_lies_about_its_type_is_refused(client):
    """A declared content type is attacker controlled; the bytes are checked."""
    headers = await partner_headers(client)

    resp = await client.post(
        "/v1/media/uploads",
        files=upload_files(b"<html><script>alert(1)</script></html>", "x.png", "image/png"),
        headers=headers,
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "CONTENT_TYPE_MISMATCH"


async def test_an_oversized_image_is_refused(client):
    headers = await partner_headers(client)
    oversized = b"\x89PNG\r\n\x1a\n" + b"0" * (media_service.MAX_IMAGE_BYTES + 1)

    resp = await client.post(
        "/v1/media/uploads",
        files=upload_files(oversized, "big.png", "image/png"),
        headers=headers,
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "FILE_TOO_LARGE"


async def test_an_empty_file_is_refused(client):
    headers = await partner_headers(client)
    resp = await client.post(
        "/v1/media/uploads", files=upload_files(b"", "empty.png", "image/png"), headers=headers
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "EMPTY_FILE"


async def test_mp4_is_accepted_for_stories(client, media_root):
    headers = await partner_headers(client)
    resp = await client.post(
        "/v1/media/uploads",
        files=upload_files(MP4, "clip.mp4", "video/mp4"),
        data={"purpose": "story"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["key"].endswith(".mp4")


async def test_an_unknown_purpose_is_refused(client):
    headers = await partner_headers(client)
    resp = await client.post(
        "/v1/media/uploads",
        files=upload_files(JPEG, "x.jpg", "image/jpeg"),
        data={"purpose": "malware"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "BAD_PURPOSE"


async def test_listing_returns_only_your_own_files(client, db):
    first = await partner_headers(client, "one@example.com")
    await client.post(
        "/v1/media/uploads", files=upload_files(PNG, "a.png", "image/png"), headers=first
    )

    second = await partner_headers(client, "two@example.com")
    assert (await client.get("/v1/media", headers=second)).json() == []
    assert len((await client.get("/v1/media", headers=first)).json()) == 1


async def test_you_cannot_delete_someone_elses_file(client, db):
    owner = await partner_headers(client, "owner@example.com")
    created = await client.post(
        "/v1/media/uploads", files=upload_files(PNG, "a.png", "image/png"), headers=owner
    )
    media_id = created.json()["id"]

    stranger = await partner_headers(client, "stranger@example.com")
    assert (await client.delete(f"/v1/media/{media_id}", headers=stranger)).status_code == 404


async def test_deleting_removes_the_row_and_the_bytes(client, db, media_root):
    headers = await partner_headers(client)
    created = await client.post(
        "/v1/media/uploads", files=upload_files(PNG, "a.png", "image/png"), headers=headers
    )
    body = created.json()

    assert (await client.delete(f"/v1/media/{body['id']}", headers=headers)).status_code == 200

    assert not (media_root / body["key"]).exists()
    assert await db.scalar(select(Media).where(Media.key == body["key"])) is None


async def test_an_uploaded_key_can_be_attached_to_a_coupon(client, db):
    """The whole point: the key the upload returns is what content fields take."""
    partner = await partner_headers(client)
    staff = await admin_headers(client, db)

    uploaded = await client.post(
        "/v1/media/uploads",
        files=upload_files(JPEG, "coffee.jpg", "image/jpeg"),
        data={"purpose": "coupon"},
        headers=partner,
    )
    key = uploaded.json()["key"]

    from datetime import timedelta

    from app.core.time import utcnow

    coupon = await client.post(
        "/v1/business/coupons",
        json={
            "title": "Free coffee",
            "image_path": key,
            "cost_coins": 100,
            "quantity_total": 5,
            "starts_at": (utcnow() - timedelta(hours=1)).isoformat(),
            "ends_at": (utcnow() + timedelta(days=7)).isoformat(),
        },
        headers=partner,
    )
    assert coupon.status_code == 201
    assert coupon.json()["image_path"] == key
    _ = staff
