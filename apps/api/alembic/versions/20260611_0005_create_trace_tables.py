"""create trace tables

Revision ID: 20260611_0005
Revises: 20260611_0004
Create Date: 2026-06-11 10:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260611_0005"
down_revision: str | None = "20260611_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "runs",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("agent_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("cost_cny", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_runs_agent_id", "runs", ["agent_id"])
    op.create_table(
        "trace_steps",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("run_id", sa.String(length=64), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("input_summary", sa.String(length=1000), nullable=True),
        sa.Column("output_summary", sa.String(length=1000), nullable=True),
        sa.Column("error_message", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trace_steps_run_id", "trace_steps", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_trace_steps_run_id", table_name="trace_steps")
    op.drop_table("trace_steps")
    op.drop_index("ix_runs_agent_id", table_name="runs")
    op.drop_table("runs")
