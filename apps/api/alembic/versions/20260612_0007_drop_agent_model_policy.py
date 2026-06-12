"""drop agent model policy

Revision ID: 20260612_0007
Revises: 20260612_0006
Create Date: 2026-06-12 17:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260612_0007"
down_revision: str | None = "20260612_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("agents", "model_policy")


def downgrade() -> None:
    op.add_column(
        "agents",
        sa.Column(
            "model_policy",
            sa.String(length=120),
            nullable=False,
            server_default="gpt-4.1 + fallback",
        ),
    )
