"""create knowledge processing jobs

Revision ID: 20260629_0013
Revises: 20260629_0012
Create Date: 2026-06-29 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260629_0013"
down_revision: str | None = "20260629_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_processing_jobs",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("knowledge_base_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("chunks_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_knowledge_processing_jobs_knowledge_base_id",
        "knowledge_processing_jobs",
        ["knowledge_base_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_processing_jobs_knowledge_base_id", table_name="knowledge_processing_jobs")
    op.drop_table("knowledge_processing_jobs")
