-- Migration 24: Comprehensive Analytics Platform
-- Builds a Google Analytics-level feature set with partitioned events, sessions, user state, consent, funnels, goals, recordings, and heatmaps.

--------------------------------------------------------------------------------
-- 0. Safety and prerequisite notes
--------------------------------------------------------------------------------
-- Ensure pgcrypto extension exists (migration 00) for UUID generation.
-- All CREATE statements are idempotent (IF NOT EXISTS) to allow safe re-runs.

--------------------------------------------------------------------------------
-- 1. Analytics Events (partitioned) - core event firehose
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_name VARCHAR(255) NOT NULL,
    event_properties JSONB NOT NULL DEFAULT '{}'::JSONB,
    page_url VARCHAR(2048),
    page_path VARCHAR(2048),
    page_title VARCHAR(500),
    referrer VARCHAR(2048),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Initial monthly partitions for current + next 3 months (2025-11 through 2026-02)
CREATE TABLE IF NOT EXISTS analytics_events_202511 PARTITION OF analytics_events
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS analytics_events_202512 PARTITION OF analytics_events
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS analytics_events_202601 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS analytics_events_202602 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Partition maintenance guidance
COMMENT ON COLUMN analytics_events.event_properties IS 'Flexible event metadata (GIN indexed).';

--------------------------------------------------------------------------------
-- 2. Analytics Sessions - visitor/device/geo metadata
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    anonymous_id VARCHAR(255),
    session_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP,
    duration_seconds INTEGER,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    browser_version VARCHAR(50),
    os VARCHAR(100),
    os_version VARCHAR(50),
    country VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    referrer_source VARCHAR(255),
    referrer_medium VARCHAR(255),
    referrer_campaign VARCHAR(255),
    landing_page VARCHAR(2048),
    exit_page VARCHAR(2048),
    page_views_count INTEGER NOT NULL DEFAULT 0,
    events_count INTEGER NOT NULL DEFAULT 0,
    is_bounce BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE analytics_sessions IS 'Captures per-session device, geo, and attribution metadata.';
COMMENT ON COLUMN analytics_sessions.anonymous_id IS 'Browser fingerprint / cookie identifier for non-authenticated tracking.';

-- Add FK now that analytics_sessions exist (idempotent via DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'analytics_events_session_fk'
          AND table_name = 'analytics_events'
    ) THEN
        ALTER TABLE analytics_events
            ADD CONSTRAINT analytics_events_session_fk
                FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

--------------------------------------------------------------------------------
-- 3. Analytics User Properties - custom attributes
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_user_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    anonymous_id VARCHAR(255),
    property_key VARCHAR(255) NOT NULL,
    property_value TEXT NOT NULL,
    property_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_analytics_user_properties_has_id CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);

COMMENT ON TABLE analytics_user_properties IS 'Key/value store of custom analytics traits per user or anonymous visitor.';

--------------------------------------------------------------------------------
-- 4. Analytics Consent - GDPR compliance tracking
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    anonymous_id VARCHAR(255),
    consent_type VARCHAR(50) NOT NULL,
    consent_given BOOLEAN NOT NULL,
    consent_version VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_consent_type CHECK (consent_type IN ('analytics', 'marketing', 'functional', 'necessary')),
    CONSTRAINT chk_analytics_consent_has_id CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);

COMMENT ON TABLE analytics_consent IS 'Stores user consent choices for analytics/marketing per GDPR/CCPA requirements.';

--------------------------------------------------------------------------------
-- 5. Analytics Funnels - conversion flow definitions
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE analytics_funnels IS 'Configurable funnel definitions consisting of ordered event steps.';

--------------------------------------------------------------------------------
-- 6. Analytics Goals - conversion tracking
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50) NOT NULL,
    goal_conditions JSONB NOT NULL,
    goal_value DECIMAL(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_goal_type CHECK (goal_type IN ('event', 'destination', 'duration', 'pages_per_session'))
);

COMMENT ON TABLE analytics_goals IS 'Goal definitions that map event/behavior conditions to conversions.';

--------------------------------------------------------------------------------
-- 7. Analytics Session Recordings - replay metadata
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_session_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
    recording_data JSONB NOT NULL,
    recording_duration_ms INTEGER NOT NULL,
    recording_size_bytes BIGINT NOT NULL,
    has_errors BOOLEAN NOT NULL DEFAULT false,
    error_count INTEGER NOT NULL DEFAULT 0,
    privacy_mode VARCHAR(50) NOT NULL DEFAULT 'strict',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_privacy_mode CHECK (privacy_mode IN ('strict', 'moderate', 'minimal')),
    CONSTRAINT unique_session_recording UNIQUE (session_id)
);

COMMENT ON TABLE analytics_session_recordings IS 'Metadata + payload references for session replay recordings.';
COMMENT ON COLUMN analytics_session_recordings.privacy_mode IS 'Controls masking of sensitive data during replay export.';

-- Encourage TOAST compression for recording payloads
ALTER TABLE analytics_session_recordings
    ALTER COLUMN recording_data SET STORAGE EXTENDED;

--------------------------------------------------------------------------------
-- 8. Analytics Heatmaps - interaction aggregations
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_heatmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_path VARCHAR(2048) NOT NULL,
    viewport_width INTEGER NOT NULL,
    viewport_height INTEGER NOT NULL,
    interaction_type VARCHAR(50) NOT NULL,
    aggregation_period DATE NOT NULL,
    heatmap_data JSONB NOT NULL,
    sample_size INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_interaction_type CHECK (interaction_type IN ('click', 'scroll', 'move')),
    CONSTRAINT unique_heatmap_aggregation UNIQUE (page_path, viewport_width, viewport_height, interaction_type, aggregation_period)
);

COMMENT ON TABLE analytics_heatmaps IS 'Aggregated interaction intensity maps for various viewport sizes and interaction types.';

--------------------------------------------------------------------------------
-- Indexes
--------------------------------------------------------------------------------
-- analytics_events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created ON analytics_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING GIN (event_properties jsonb_path_ops);

-- analytics_sessions indexes
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_id ON analytics_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_anonymous_id ON analytics_sessions(anonymous_id) WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_session_start ON analytics_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_device_type ON analytics_sessions(device_type);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_start ON analytics_sessions(user_id, session_start DESC);

-- analytics_user_properties indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user_properties_user_id ON analytics_user_properties(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_user_properties_anonymous_id ON analytics_user_properties(anonymous_id) WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_user_properties_key ON analytics_user_properties(property_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_user_properties_unique_key ON analytics_user_properties(COALESCE(user_id::text, anonymous_id), property_key);

-- analytics_consent indexes
CREATE INDEX IF NOT EXISTS idx_analytics_consent_user_id ON analytics_consent(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_consent_anonymous_id ON analytics_consent(anonymous_id) WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_consent_created_at ON analytics_consent(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_consent_user_type ON analytics_consent(COALESCE(user_id::text, anonymous_id), consent_type, created_at DESC);

-- analytics_funnels indexes
CREATE INDEX IF NOT EXISTS idx_analytics_funnels_is_active ON analytics_funnels(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_analytics_funnels_steps ON analytics_funnels USING GIN (steps jsonb_path_ops);

-- analytics_goals indexes
CREATE INDEX IF NOT EXISTS idx_analytics_goals_is_active ON analytics_goals(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_analytics_goals_goal_type ON analytics_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_analytics_goals_conditions ON analytics_goals USING GIN (goal_conditions jsonb_path_ops);

-- analytics_session_recordings indexes
CREATE INDEX IF NOT EXISTS idx_analytics_session_recordings_session_id ON analytics_session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session_recordings_has_errors ON analytics_session_recordings(has_errors) WHERE has_errors = true;
CREATE INDEX IF NOT EXISTS idx_analytics_session_recordings_created_at ON analytics_session_recordings(created_at DESC);

-- analytics_heatmaps indexes
CREATE INDEX IF NOT EXISTS idx_analytics_heatmaps_page_path ON analytics_heatmaps(page_path);
CREATE INDEX IF NOT EXISTS idx_analytics_heatmaps_aggregation_period ON analytics_heatmaps(aggregation_period DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_heatmaps_page_period ON analytics_heatmaps(page_path, aggregation_period DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_heatmaps_data ON analytics_heatmaps USING GIN (heatmap_data jsonb_path_ops);

--------------------------------------------------------------------------------
-- Partition retention guidance (comments + example SQL)
--------------------------------------------------------------------------------
COMMENT ON COLUMN analytics_events.created_at IS 'Partition key; create partitions monthly. Retain ~12 months, archive older data.';

COMMENT ON TABLE analytics_events_202511 IS 'Partition covering November 2025 events.';
COMMENT ON TABLE analytics_events_202512 IS 'Partition covering December 2025 events.';
COMMENT ON TABLE analytics_events_202601 IS 'Partition covering January 2026 events.';
COMMENT ON TABLE analytics_events_202602 IS 'Partition covering February 2026 events.';

-- Example SQL snippet documented in table comment
COMMENT ON TABLE analytics_events IS
    'High-volume analytics events partitioned monthly. Maintain partitions via scheduled job (create next month, drop >12 months). Example: CREATE TABLE analytics_events_202512 PARTITION OF analytics_events FOR VALUES FROM (''2025-12-01'') TO (''2026-01-01'');';

--------------------------------------------------------------------------------
-- Migration summary notice
--------------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration 24: Analytics Tables';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Tables: analytics_events (partitioned), analytics_sessions, analytics_user_properties, analytics_consent, analytics_funnels, analytics_goals, analytics_session_recordings, analytics_heatmaps';
    RAISE NOTICE 'Indexes and constraints created for performant querying + GDPR compliance';
    RAISE NOTICE 'Remember to schedule monthly partition creation and archival for analytics_events';
END $$;
