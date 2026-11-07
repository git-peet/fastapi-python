"""Add conversation table

Revision ID: 828e4a07b99e
Revises: a1b2c3d4e5f6
Create Date: 2026-11-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "828e4a07b99e"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "conversation",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("transcript", sa.String(length=10000), nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("conversation")