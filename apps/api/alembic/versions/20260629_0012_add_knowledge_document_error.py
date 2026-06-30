"""add knowledge document error message

Revision ID: 20260629_0012
Revises: 20260629_0011
Create Date: 2026-06-29 11:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260629_0012"
down_revision: str | None = "20260629_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("knowledge_documents", sa.Column("error_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("knowledge_documents", "error_message")
