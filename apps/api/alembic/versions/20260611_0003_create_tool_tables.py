"""create tool tables

Revision ID: 20260611_0003
Revises: 20260611_0002
Create Date: 2026-06-11 10:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260611_0003"
down_revision: str | None = "20260611_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_servers",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        sa.Column("owner", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "tools",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("credential", sa.String(length=200), nullable=False),
        sa.Column("permission", sa.String(length=200), nullable=False),
        sa.Column("health", sa.String(length=32), nullable=False),
        sa.Column("last_called_at", sa.String(length=64), nullable=False),
        sa.Column("tool_schema", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("tools")
    op.drop_table("mcp_servers")
