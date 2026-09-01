"""Editing your own profile: name, city, and the avatar image.

The app had been keeping these in memory only — the edit screen appeared to
work and the change vanished on the next launch. These tests pin down the
half that was missing.
"""

from __future__ import annotations

import pytest

from app.services import media as media_service

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"0" * 64

ME = "/v1/auth/me"
AVATAR = "/v1/auth/me/avatar"


@pytest.fixture(autouse=True)
def media_root(tmp_path, monkeypatch):
    """Write uploads into a temp directory instead of the repo's media folder."""
    from app.storage import factory, local

    storage = local.LocalStorage(root=str(tmp_path), url_prefix="/media")
    monkeypatch.setattr(factory, "get_storage", lambda: storage)
    monkeypatch.setattr(media_service, "get_storage", lambda: storage)
    return tmp_path


async def user_headers(client, email="walker@example.com"):
    resp = await client.post(
        "/v1/auth/register",
        json={"email": email, "password": "correct-horse", "full_name": "Walker"},
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


def upload_files(data: bytes, name: str, content_type: str):
    return {"file": (name, data, content_type)}


async def test_patch_updates_name_and_city(client):
    headers = await user_headers(client)

    resp = await client.patch(ME, json={"full_name": "Ada", "city": "Baku"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["full_name"] == "Ada"
    assert resp.json()["city"] == "Baku"

    # The point of the whole exercise: it is still there on the next read.
    again = await client.get(ME, headers=headers)
    assert again.json()["full_name"] == "Ada"
    assert again.json()["city"] == "Baku"


async def test_patch_leaves_omitted_fields_alone(client):
    headers = await user_headers(client)
    await client.patch(ME, json={"full_name": "Ada", "city": "Baku"}, headers=headers)

    resp = await client.patch(ME, json={"city": "Ganja"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["city"] == "Ganja"
    assert resp.json()["full_name"] == "Ada"


async def test_patch_requires_authentication(client):
    assert (await client.patch(ME, json={"full_name": "Nobody"})).status_code == 401


async def test_avatar_upload_sets_path_and_persists(client):
    headers = await user_headers(client)

    resp = await client.put(AVATAR, files=upload_files(PNG, "me.png", "image/png"), headers=headers)
    assert resp.status_code == 200, resp.text
    path = resp.json()["avatar_path"]
    assert path and path.startswith("avatar/") and path.endswith(".png")

    again = await client.get(ME, headers=headers)
    assert again.json()["avatar_path"] == path


async def test_avatar_replaces_the_previous_one(client):
    headers = await user_headers(client)
    first = await client.put(AVATAR, files=upload_files(PNG, "a.png", "image/png"), headers=headers)
    second = await client.put(AVATAR, files=upload_files(PNG, "b.png", "image/png"), headers=headers)

    assert first.json()["avatar_path"] != second.json()["avatar_path"]
    assert (await client.get(ME, headers=headers)).json()["avatar_path"] == (
        second.json()["avatar_path"]
    )


async def test_avatar_rejects_video(client):
    headers = await user_headers(client)
    resp = await client.put(AVATAR, files=upload_files(MP4, "clip.mp4", "video/mp4"), headers=headers)
    assert resp.status_code == 422, resp.text


async def test_avatar_rejects_a_disguised_file(client):
    """Declared image/png, actually HTML — the magic-number check must catch it."""
    headers = await user_headers(client)
    resp = await client.put(
        AVATAR,
        files=upload_files(b"<html><script>alert(1)</script></html>", "x.png", "image/png"),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


async def test_avatar_requires_authentication(client):
    resp = await client.put(AVATAR, files=upload_files(PNG, "me.png", "image/png"))
    assert resp.status_code == 401
