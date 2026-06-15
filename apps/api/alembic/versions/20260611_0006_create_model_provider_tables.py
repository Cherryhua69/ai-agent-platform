"""create model provider tables

Revision ID: 20260611_0006
Revises: 20260611_0005
Create Date: 2026-06-11 11:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260611_0006"
down_revision: str | None = "20260611_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("final_output", sa.String(length=2000), nullable=True))
    op.create_table(
        "model_providers",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("provider_type", sa.String(length=80), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        sa.Column("model_name", sa.String(length=200), nullable=False),
        sa.Column("api_key", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("model_providers")
    op.drop_column("runs", "final_output")
