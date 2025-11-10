-- Migration 13: AI Services Infrastructure
-- This migration creates tables for AI service configuration, prompt library, and categories

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to validate that enabled services have an API key configured
CREATE OR REPLACE FUNCTION validate_api_key_configured(
    p_enabled BOOLEAN,
    p_api_key_vault_path TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- If service is disabled, no API key required
    IF p_enabled = false THEN
        RETURN true;
    END IF;

    -- If enabled, API key path must be non-null and non-empty after trimming
    RETURN p_api_key_vault_path IS NOT NULL AND trim(p_api_key_vault_path) <> '';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_api_key_configured IS
    'Validates that enabled AI services have a configured API key vault path';

-- ============================================================================
-- Table 1: AI Service Configurations
-- ============================================================================
-- Stores configuration for various AI services (Claude, ChatGPT, Gemini, DeepSeek)
-- API keys are stored securely in Vault with paths referenced here
CREATE TABLE IF NOT EXISTS ai_service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL UNIQUE,
    api_key_vault_path TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT valid_service_name CHECK (service_name IN ('claude', 'chatgpt', 'gemini', 'deepseek')),
    -- Security: Ensure enabled services always have an API key configured in Vault
    CONSTRAINT api_key_required_when_enabled CHECK (
        validate_api_key_configured(enabled, api_key_vault_path)
    )
);

-- Index for quick filtering by enabled status
CREATE INDEX IF NOT EXISTS idx_ai_service_configs_enabled ON ai_service_configs(enabled);

-- Add comments for documentation
COMMENT ON TABLE ai_service_configs IS 'Configuration for AI services including API keys stored in Vault';
COMMENT ON COLUMN ai_service_configs.service_name IS 'Name of AI service (claude, chatgpt, gemini, deepseek)';
COMMENT ON COLUMN ai_service_configs.api_key_vault_path IS 'Path to API key in Vault (e.g., secret/ai/claude)';
COMMENT ON COLUMN ai_service_configs.enabled IS 'Whether this AI service is enabled for use';
COMMENT ON COLUMN ai_service_configs.settings IS 'Service-specific settings like model, temperature, max_tokens';

-- ============================================================================
-- Table 2: AI Prompt Categories
-- ============================================================================
-- Hierarchical categories for organizing prompts
CREATE TABLE IF NOT EXISTS ai_prompt_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Data Safety: ON DELETE RESTRICT prevents accidental cascade deletion of entire category trees
    -- Parent categories must be explicitly emptied before deletion to preserve data integrity
    parent_id UUID REFERENCES ai_prompt_categories(id) ON DELETE RESTRICT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for category queries
CREATE INDEX IF NOT EXISTS idx_ai_prompt_categories_parent_id ON ai_prompt_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_categories_sort_order ON ai_prompt_categories(sort_order);

-- Unique index for category names that handles NULL parent_id correctly
-- This prevents TOCTOU race conditions in category creation by enforcing uniqueness at the database level
-- Uses a sentinel UUID for NULL parent_id to ensure uniqueness even when parent_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompt_categories_unique_name_parent
    ON ai_prompt_categories (name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Add comments for documentation
COMMENT ON TABLE ai_prompt_categories IS 'Hierarchical categories for organizing AI prompts';
COMMENT ON COLUMN ai_prompt_categories.parent_id IS 'Parent category ID for hierarchical structure';
COMMENT ON COLUMN ai_prompt_categories.sort_order IS 'Custom ordering within same level';

-- ============================================================================
-- Table 3: AI Prompts
-- ============================================================================
-- Library of reusable prompt templates with variables and metadata
CREATE TABLE IF NOT EXISTS ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category_id UUID REFERENCES ai_prompt_categories(id) ON DELETE SET NULL,
    variables JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for prompt queries and search
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category_id ON ai_prompts(category_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_created_by ON ai_prompts(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_is_favorite ON ai_prompts(is_favorite);

-- Full-text search index on title and content
CREATE INDEX IF NOT EXISTS idx_ai_prompts_search ON ai_prompts USING GIN (
    to_tsvector('english', title || ' ' || content)
);

-- Add comments for documentation
COMMENT ON TABLE ai_prompts IS 'Library of reusable AI prompt templates';
COMMENT ON COLUMN ai_prompts.content IS 'The prompt template text';
COMMENT ON COLUMN ai_prompts.variables IS 'Array of variable names used in template (e.g., ["topic", "tone"])';
COMMENT ON COLUMN ai_prompts.metadata IS 'Additional metadata like tags, description, usage count';
COMMENT ON COLUMN ai_prompts.is_favorite IS 'Whether this prompt is marked as favorite by user';

-- ============================================================================
-- Initial Data Seeding
-- ============================================================================
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@kevinalthaus.com' LIMIT 1;

    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'Admin user not found, using first user as fallback';
        SELECT id INTO admin_user_id FROM users ORDER BY created_at LIMIT 1;
    END IF;

    IF admin_user_id IS NOT NULL THEN
        -- Insert default AI service configurations (all disabled by default)
        INSERT INTO ai_service_configs (service_name, enabled, settings, created_by)
        VALUES
            ('claude', false, '{"model": "claude-sonnet-4-5-20250929", "temperature": 0.7, "max_tokens": 4096}', admin_user_id),
            ('chatgpt', false, '{"model": "gpt-4", "temperature": 0.7, "max_tokens": 4096}', admin_user_id),
            ('gemini', false, '{"model": "gemini-pro", "temperature": 0.7, "max_tokens": 4096}', admin_user_id),
            ('deepseek', false, '{"model": "deepseek-chat", "temperature": 0.7, "max_tokens": 4096}', admin_user_id)
        ON CONFLICT (service_name) DO NOTHING;

        RAISE NOTICE 'Inserted default AI service configurations';

        -- Insert default prompt categories
        INSERT INTO ai_prompt_categories (name, description, sort_order, created_by)
        VALUES
            ('Text Generation', 'Prompts for generating various types of text content', 10, admin_user_id),
            ('Image Analysis', 'Prompts for analyzing and describing images', 20, admin_user_id),
            ('Code Generation', 'Prompts for generating and reviewing code', 30, admin_user_id),
            ('Content Editing', 'Prompts for editing and improving existing content', 40, admin_user_id)
        ON CONFLICT (name, parent_id) DO NOTHING;

        RAISE NOTICE 'Inserted default prompt categories';
    ELSE
        RAISE NOTICE 'No users found, skipping initial data seeding';
    END IF;
END $$;

-- ============================================================================
-- Migration Completion Log
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration 13: AI Services Infrastructure';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - ai_service_configs (AI service configuration with Vault integration)';
    RAISE NOTICE '  - ai_prompt_categories (Hierarchical prompt categories)';
    RAISE NOTICE '  - ai_prompts (Prompt library with full-text search)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created indexes:';
    RAISE NOTICE '  - Enabled status filtering';
    RAISE NOTICE '  - Category hierarchy queries';
    RAISE NOTICE '  - Full-text search on prompts';
    RAISE NOTICE '  - User-specific prompt filtering';
    RAISE NOTICE '';
    RAISE NOTICE 'Initial data:';
    RAISE NOTICE '  - 4 AI service configurations (Claude, ChatGPT, Gemini, DeepSeek)';
    RAISE NOTICE '  - 4 default prompt categories';
    RAISE NOTICE '';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '===========================================';
END $$;
