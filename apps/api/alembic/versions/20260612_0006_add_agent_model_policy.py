"""add agent model policy

Revision ID: 20260612_0006
Revises: 20260611_0005
Create Date: 2026-06-12 00:06:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260612_0006"
down_revision: str | None = "20260611_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column(
            "model_policy",
            sa.String(length=120),
            nullable=False,
            server_default="gpt-4.1 + fallback",
        ),
    )


def downgrade() -> None:
    op.drop_column("agents", "model_policy")
