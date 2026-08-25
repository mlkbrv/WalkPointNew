"""Small operational commands.

    python -m app.cli seed
    python -m app.cli create-superadmin admin@example.com "a-strong-password"

Run after ``alembic upgrade head``.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.economy import EconomySettings
from app.models.enums import UserRole
from app.models.support import FAQTemplate
from app.models.user import User

# Lifted from the hardcoded list in the mobile Help screen, so the app can render
# the FAQ from the API instead of shipping its own copy.
DEFAULT_FAQ = [
    (
        "How does step tracking work?",
        "The app reads your step count from Health Connect on Android or Motion & "
        "Fitness on iOS, and syncs the daily total to your account.",
        1,
    ),
    (
        "How do I earn coins?",
        "Reach the daily step threshold and you earn coins for that day, plus a bonus "
        "for every extra thousand steps. Below the threshold a day earns nothing.",
        2,
    ),
    (
        "How do I redeem a coupon?",
        "Buy it with coins and it lands in your wallet. Open it at the counter and let "
        "the staff scan the code.",
        3,
    ),
    (
        "Can I transfer coins to someone else?",
        "No. Coins are tied to your profile for fraud protection.",
        4,
    ),
]


async def seed() -> None:
    """Create the singleton economy settings row and the default FAQ, if missing.

    Safe to re-run: each part is skipped when it is already there.
    """
    async with SessionLocal() as db:
        settings_row = await db.scalar(select(EconomySettings).limit(1))
        if settings_row is None:
            db.add(EconomySettings())
            print("economy_settings created with defaults (5000 steps -> 50 coins, +10 per 1000)")
        else:
            print("economy_settings already present")

        existing_faq = await db.scalar(select(FAQTemplate).limit(1))
        if existing_faq is None:
            for question, answer, order in DEFAULT_FAQ:
                db.add(FAQTemplate(question=question, answer=answer, sort_order=order))
            print(f"{len(DEFAULT_FAQ)} FAQ entries created")
        else:
            print("FAQ already present")

        await db.commit()


async def create_superadmin(email: str, password: str) -> None:
    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == email.lower()))
        if existing is not None:
            print(f"{email} already exists (role={existing.role})")
            return
        db.add(
            User(
                email=email.lower(),
                password_hash=hash_password(password),
                role=UserRole.SUPERADMIN,
                full_name="Superadmin",
            )
        )
        await db.commit()
        print(f"superadmin created: {email}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("seed", help="Insert default economy settings")

    admin = sub.add_parser("create-superadmin", help="Create a superadmin account")
    admin.add_argument("email")
    admin.add_argument("password")

    args = parser.parse_args(argv)

    if args.command == "seed":
        asyncio.run(seed())
    elif args.command == "create-superadmin":
        asyncio.run(create_superadmin(args.email, args.password))
    return 0


if __name__ == "__main__":
    sys.exit(main())
