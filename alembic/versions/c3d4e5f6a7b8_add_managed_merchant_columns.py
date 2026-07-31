"""add managed merchant columns to users

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-07-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('pinch_merchant_id', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('pinch_merchant_status', sa.String(20), nullable=False, server_default='pending'))
    op.add_column('users', sa.Column('onboarding_type', sa.String(20), nullable=False, server_default='managed'))


def downgrade() -> None:
    op.drop_column('users', 'onboarding_type')
    op.drop_column('users', 'pinch_merchant_status')
    op.drop_column('users', 'pinch_merchant_id')
