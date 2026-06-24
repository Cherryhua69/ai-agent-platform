"""add model provider purpose

Revision ID: 20260624_0009
Revises: 20260623_0008
Create Date: 2026-06-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260624_0009"
down_revision: str | None = "20260623_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "model_providers",
        sa.Column("model_purpose", sa.String(length=32), nullable=False, server_default="llm"),
    )
    op.alter_column("model_providers", "model_purpose", server_default=None)


def downgrade() -> None:
    op.drop_column("model_providers", "model_purpose")
