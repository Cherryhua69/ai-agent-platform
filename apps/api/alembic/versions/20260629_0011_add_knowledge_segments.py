"""add knowledge document content and segments

Revision ID: 20260629_0011
Revises: 20260625_0010
Create Date: 2026-06-29 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260629_0011"
down_revision: str | None = "20260625_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("knowledge_documents", sa.Column("content", sa.Text(), nullable=True))
    op.add_column(
        "knowledge_documents",
        sa.Column("character_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("knowledge_documents", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.execute("UPDATE knowledge_documents SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("knowledge_documents", "updated_at", nullable=False)

    op.create_table(
        "knowledge_segments",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("knowledge_base_id", sa.String(length=64), nullable=False),
        sa.Column("document_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("character_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("index_node_hash", sa.String(length=128), nullable=True),
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="available"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["knowledge_documents.id"]),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_knowledge_segments_document_id", "knowledge_segments", ["document_id"])
    op.create_index("ix_knowledge_segments_knowledge_base_id", "knowledge_segments", ["knowledge_base_id"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_segments_knowledge_base_id", table_name="knowledge_segments")
    op.drop_index("ix_knowledge_segments_document_id", table_name="knowledge_segments")
    op.drop_table("knowledge_segments")
    op.drop_column("knowledge_documents", "updated_at")
    op.drop_column("knowledge_documents", "hit_count")
    op.drop_column("knowledge_documents", "character_count")
    op.drop_column("knowledge_documents", "content")
