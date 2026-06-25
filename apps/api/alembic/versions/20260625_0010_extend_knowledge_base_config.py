"""extend knowledge base config

Revision ID: 20260625_0010
Revises: 20260624_0009
Create Date: 2026-06-25 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260625_0010"
down_revision: str | None = "20260624_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("knowledge_bases", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("knowledge_bases", sa.Column("embedding_model_provider_id", sa.String(length=64), nullable=True))
    op.add_column(
        "knowledge_bases",
        sa.Column("chunk_strategy", sa.String(length=32), nullable=False, server_default="fixed"),
    )
    op.add_column("knowledge_bases", sa.Column("chunk_size", sa.Integer(), nullable=False, server_default="500"))
    op.add_column("knowledge_bases", sa.Column("chunk_overlap", sa.Integer(), nullable=False, server_default="50"))
    op.add_column(
        "knowledge_bases",
        sa.Column("retrieval_mode", sa.String(length=32), nullable=False, server_default="vector"),
    )
    op.add_column("knowledge_bases", sa.Column("top_k", sa.Integer(), nullable=False, server_default="5"))
    op.add_column(
        "knowledge_bases",
        sa.Column("similarity_threshold", sa.Float(), nullable=False, server_default="0.7"),
    )
    op.add_column(
        "knowledge_bases",
        sa.Column("return_citations", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("knowledge_bases", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.execute("UPDATE knowledge_bases SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("knowledge_bases", "updated_at", nullable=False)
    op.create_foreign_key(
        "fk_knowledge_bases_embedding_model_provider_id",
        "knowledge_bases",
        "model_providers",
        ["embedding_model_provider_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_knowledge_bases_embedding_model_provider_id", "knowledge_bases", type_="foreignkey")
    op.drop_column("knowledge_bases", "updated_at")
    op.drop_column("knowledge_bases", "return_citations")
    op.drop_column("knowledge_bases", "similarity_threshold")
    op.drop_column("knowledge_bases", "top_k")
    op.drop_column("knowledge_bases", "retrieval_mode")
    op.drop_column("knowledge_bases", "chunk_overlap")
    op.drop_column("knowledge_bases", "chunk_size")
    op.drop_column("knowledge_bases", "chunk_strategy")
    op.drop_column("knowledge_bases", "embedding_model_provider_id")
    op.drop_column("knowledge_bases", "description")
