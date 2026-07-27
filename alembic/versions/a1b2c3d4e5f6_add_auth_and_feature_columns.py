"""add auth tables and feature columns

Revision ID: a1b2c3d4e5f6
Revises: d5de638dc22d
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd5de638dc22d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- New table: users ---
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_name', sa.String(200), nullable=False),
        sa.Column('email', sa.String(200), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(200), nullable=False),
        sa.Column('pinch_api_key_encrypted', sa.Text(), nullable=True),
        sa.Column('onboarding_complete', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # --- New table: sessions ---
    op.create_table(
        'sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(100), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])
    op.create_index('ix_sessions_token', 'sessions', ['token'], unique=True)

    # --- New table: user_settings ---
    op.create_table(
        'user_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('auto_retry', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('retry_days', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('max_retries', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('retry_cooldown_days', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('business_name', sa.String(200), nullable=True),
        sa.Column('sender_email', sa.String(200), nullable=True),
        sa.Column('notify_channel', sa.String(20), nullable=False, server_default='email'),
    )

    # --- New columns on payers: risk scoring (Prompt 7) ---
    op.add_column('payers', sa.Column('risk_score', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('payers', sa.Column('risk_level', sa.String(20), nullable=False, server_default='low'))
    op.add_column('payers', sa.Column('risk_factors', sa.JSON(), nullable=True))
    op.add_column('payers', sa.Column('risk_scored_at', sa.DateTime(), nullable=True))

    # --- New columns on dishonours ---
    # Prompt 3 — Smart retry timing
    op.add_column('dishonours', sa.Column('retry_scheduled_date', sa.Date(), nullable=True))
    op.add_column('dishonours', sa.Column('retry_timing_reason', sa.String(500), nullable=True))

    # Prompt 4 — Payment plans
    op.add_column('dishonours', sa.Column('plan_options', sa.JSON(), nullable=True))
    op.add_column('dishonours', sa.Column('plan_id', sa.String(100), nullable=True))
    op.add_column('dishonours', sa.Column('plan_accepted_at', sa.DateTime(), nullable=True))

    # Prompt 5 — Payment links
    op.add_column('dishonours', sa.Column('payment_link_url', sa.String(500), nullable=True))
    op.add_column('dishonours', sa.Column('payment_link_expires_at', sa.DateTime(), nullable=True))
    op.add_column('dishonours', sa.Column('payment_link_status', sa.String(20), nullable=False, server_default='sent'))

    # Prompt 8 — Retry governance + idempotency
    op.add_column('dishonours', sa.Column('retry_attempt_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('dishonours', sa.Column('last_retry_at', sa.DateTime(), nullable=True))
    op.add_column('dishonours', sa.Column('max_retries_reached', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('dishonours', sa.Column('nonce', sa.String(200), nullable=True))


def downgrade() -> None:
    # Remove dishonour columns
    for col in ['nonce', 'max_retries_reached', 'last_retry_at', 'retry_attempt_count',
                'payment_link_status', 'payment_link_expires_at', 'payment_link_url',
                'plan_accepted_at', 'plan_id', 'plan_options',
                'retry_timing_reason', 'retry_scheduled_date']:
        op.drop_column('dishonours', col)

    # Remove payer columns
    for col in ['risk_scored_at', 'risk_factors', 'risk_level', 'risk_score']:
        op.drop_column('payers', col)

    # Drop new tables
    op.drop_table('user_settings')
    op.drop_index('ix_sessions_token', table_name='sessions')
    op.drop_index('ix_sessions_user_id', table_name='sessions')
    op.drop_table('sessions')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
