"""Auth flows: registration, sign-in, SMS, refresh rotation, role guards."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.enums import UserRole
from app.models.user import SMSVerification, User

REGISTER = "/v1/auth/register"
LOGIN = "/v1/auth/login"


async def test_register_returns_tokens_and_user(client):
    resp = await client.post(
        REGISTER,
        json={"email": "walker@example.com", "password": "correct-horse", "full_name": "Walker"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user"]["email"] == "walker@example.com"
    assert body["user"]["role"] == UserRole.USER
    assert body["tokens"]["access_token"] and body["tokens"]["refresh_token"]
    assert body["is_new_user"] is True


async def test_register_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "correct-horse"}
    assert (await client.post(REGISTER, json=payload)).status_code == 201

    resp = await client.post(REGISTER, json=payload)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_TAKEN"


async def test_short_password_is_400_in_the_contract_shape(client):
    # FastAPI would answer 422 with a "detail" body; the contract wants 400 with "error".
    resp = await client.post(REGISTER, json={"email": "a@example.com", "password": "short"})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_login_with_wrong_password_is_401(client):
    await client.post(REGISTER, json={"email": "user@example.com", "password": "correct-horse"})

    resp = await client.post(LOGIN, json={"email": "user@example.com", "password": "wrong-horse"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_for_unknown_email_is_401_not_404(client):
    resp = await client.post(LOGIN, json={"email": "ghost@example.com", "password": "correct-horse"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_me_requires_a_token(client):
    assert (await client.get("/v1/auth/me")).status_code == 401


async def test_me_returns_the_signed_in_user(client):
    reg = await client.post(REGISTER, json={"email": "me@example.com", "password": "correct-horse"})
    access = reg.json()["tokens"]["access_token"]

    resp = await client.get("/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@example.com"


async def test_sms_flow_creates_the_account_on_first_verification(client, db):
    phone = "+994501112233"
    assert (await client.post("/v1/auth/sms/request", json={"phone": phone})).status_code == 200

    verification = await db.scalar(select(SMSVerification).where(SMSVerification.phone == phone))

    resp = await client.post("/v1/auth/sms/verify", json={"phone": phone, "code": verification.code})
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_new_user"] is True
    assert resp.json()["user"]["phone"] == phone


async def test_sms_code_is_single_use(client, db):
    phone = "+994505556677"
    await client.post("/v1/auth/sms/request", json={"phone": phone})
    verification = await db.scalar(select(SMSVerification).where(SMSVerification.phone == phone))
    code = verification.code

    first = await client.post("/v1/auth/sms/verify", json={"phone": phone, "code": code})
    assert first.status_code == 200

    replay = await client.post("/v1/auth/sms/verify", json={"phone": phone, "code": code})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "INVALID_SMS_CODE"


async def test_wrong_sms_code_is_rejected(client):
    await client.post("/v1/auth/sms/request", json={"phone": "+994501234567"})

    resp = await client.post("/v1/auth/sms/verify", json={"phone": "+994501234567", "code": "000000"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_SMS_CODE"


async def test_refresh_rotates_and_kills_the_old_token(client):
    reg = await client.post(REGISTER, json={"email": "rot@example.com", "password": "correct-horse"})
    first_refresh = reg.json()["tokens"]["refresh_token"]

    ok = await client.post("/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert ok.status_code == 200
    assert ok.json()["refresh_token"] != first_refresh

    replay = await client.post("/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "REFRESH_INVALID"


async def test_logout_revokes_the_refresh_token(client):
    reg = await client.post(REGISTER, json={"email": "out@example.com", "password": "correct-horse"})
    refresh = reg.json()["tokens"]["refresh_token"]

    assert (await client.post("/v1/auth/logout", json={"refresh_token": refresh})).status_code == 200
    assert (await client.post("/v1/auth/refresh", json={"refresh_token": refresh})).status_code == 401


async def test_consumer_cannot_sign_into_the_admin_panel(client):
    await client.post(REGISTER, json={"email": "consumer@example.com", "password": "correct-horse"})

    resp = await client.post(
        "/v1/auth/staff/login", json={"email": "consumer@example.com", "password": "correct-horse"}
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_superadmin_can_sign_into_the_admin_panel(client, db):
    await client.post(REGISTER, json={"email": "boss@example.com", "password": "correct-horse"})
    user = await db.scalar(select(User).where(User.email == "boss@example.com"))
    user.role = UserRole.SUPERADMIN
    await db.commit()

    resp = await client.post(
        "/v1/auth/staff/login", json={"email": "boss@example.com", "password": "correct-horse"}
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == UserRole.SUPERADMIN


async def test_referral_code_links_the_new_account(client, db):
    inviter = await client.post(
        REGISTER, json={"email": "inviter@example.com", "password": "correct-horse"}
    )
    code = inviter.json()["user"]["referral_code"]

    await client.post(
        REGISTER,
        json={"email": "invitee@example.com", "password": "correct-horse", "referral_code": code},
    )
    invitee = await db.scalar(select(User).where(User.email == "invitee@example.com"))
    assert invitee.referred_by_id is not None


@pytest.mark.parametrize("token", ["not-a-jwt", "expired.token.here"])
async def test_garbage_tokens_are_401(client, token):
    resp = await client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
