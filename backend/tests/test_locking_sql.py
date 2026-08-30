"""Row locks must survive contact with PostgreSQL.

The suite runs on SQLite, which parses `FOR UPDATE` and then ignores it — so a
lock that PostgreSQL rejects outright passes every test and fails in production.
That is exactly what happened to voucher redemption: `UserCoupon.coupon` is
declared `lazy="joined"`, every select emitted a LEFT OUTER JOIN, and
PostgreSQL refuses `FOR UPDATE` over the nullable side of one. Every redemption
returned a 500.

These assert against the compiled PostgreSQL statement rather than executing it,
which is the only way to catch the class of bug from here.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.models.coupon import Coupon, UserCoupon
from app.models.user import User


def compiled(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect()))


def test_locking_a_voucher_names_its_table():
    """`FOR UPDATE` alone is invalid here; `FOR UPDATE OF user_coupons` is not."""
    sql = compiled(
        select(UserCoupon)
        .where(UserCoupon.qr_token == uuid.uuid4())
        .with_for_update(of=UserCoupon)
    )
    assert "LEFT OUTER JOIN" in sql, "the joined coupon load is what makes this necessary"
    assert "FOR UPDATE OF user_coupons" in sql


def test_an_unqualified_voucher_lock_would_be_rejected_by_postgres():
    """Pins the reason the `of=` above cannot be dropped."""
    sql = compiled(
        select(UserCoupon).where(UserCoupon.qr_token == uuid.uuid4()).with_for_update()
    )
    assert "LEFT OUTER JOIN" in sql
    assert sql.rstrip().endswith("FOR UPDATE")


def test_locks_without_a_joined_relation_need_no_qualifier():
    """User and Coupon have no eager joins, so a plain lock is fine for them."""
    for stmt in (
        select(User).where(User.id == uuid.uuid4()).with_for_update(),
        select(Coupon).where(Coupon.id == uuid.uuid4()).with_for_update(),
    ):
        sql = compiled(stmt)
        assert "LEFT OUTER JOIN" not in sql
        assert sql.rstrip().endswith("FOR UPDATE")
