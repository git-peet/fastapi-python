"""Add latest conversation triage result

Revision ID: d34f8c91a2b7
Revises: 828e4a07b99e
Create Date: 2026-11-07 00:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "d34f8c91a2b7"
down_revision = "828e4a07b99e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "conversation",
        sa.Column("triage_summary", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "conversation",
        sa.Column("triage_intent", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )
    op.add_column(
        "conversation",
        sa.Column("triage_sentiment", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )
    op.add_column(
        "conversation",
        sa.Column("triage_next_action", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )
    op.add_column(
        "conversation",
        sa.Column(
            "triaged_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True
        ),
    )
    op.create_check_constraint(
        "ck_conversation_triage_all_or_none",
        "conversation",
        "(triage_summary IS NULL AND triage_intent IS NULL "
        "AND triage_sentiment IS NULL AND triage_next_action IS NULL "
        "AND triaged_at IS NULL) OR "
        "(triage_summary IS NOT NULL AND triage_intent IS NOT NULL "
        "AND triage_sentiment IS NOT NULL AND triage_next_action IS NOT NULL "
        "AND triaged_at IS NOT NULL)",
    )


def downgrade():
    op.drop_constraint(
        "ck_conversation_triage_all_or_none", "conversation", type_="check"
    )
    op.drop_column("conversation", "triaged_at")
    op.drop_column("conversation", "triage_next_action")
    op.drop_column("conversation", "triage_sentiment")
    op.drop_column("conversation", "triage_intent")
    op.drop_column("conversation", "triage_summary")
