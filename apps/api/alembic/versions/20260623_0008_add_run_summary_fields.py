"""add run summary fields

Revision ID: 20260623_0008
Revises: 20260616_0007
Create Date: 2026-06-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260623_0008"
down_revision: str | None = "20260616_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("final_output", sa.Text(), nullable=True))
    op.add_column("runs", sa.Column("run_category", sa.String(length=32), nullable=False, server_default="test"))
    op.add_column("runs", sa.Column("failure_reason", sa.String(length=1000), nullable=True))
    op.alter_column("runs", "run_category", server_default=None)


def downgrade() -> None:
    op.drop_column("runs", "failure_reason")
    op.drop_column("runs", "run_category")
    op.drop_column("runs", "final_output")
