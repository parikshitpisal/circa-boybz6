-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create webhook event enum type
DO $$ BEGIN
    CREATE TYPE webhook_event AS ENUM (
        'APPLICATION_CREATED',
        'APPLICATION_UPDATED', 
        'APPLICATION_COMPLETED',
        'DOCUMENT_PROCESSED',
        'DOCUMENT_FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create webhook status enum type
DO $$ BEGIN
    CREATE TYPE webhook_status AS ENUM (
        'ACTIVE',
        'INACTIVE',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create webhook_configs table
CREATE TABLE IF NOT EXISTS webhook_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    url VARCHAR(512) NOT NULL,
    events webhook_event[] NOT NULL,
    secret VARCHAR(255) NOT NULL,
    status webhook_status NOT NULL DEFAULT 'ACTIVE',
    retry_config JSONB NOT NULL,
    security_config JSONB NOT NULL,
    metadata JSONB,
    
    -- Constraints
    CONSTRAINT webhook_configs_url_format CHECK (url ~ '^https?://[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&''()*+,;=]+$'),
    CONSTRAINT webhook_configs_retry_config_format CHECK (jsonb_typeof(retry_config) = 'object'),
    CONSTRAINT webhook_configs_security_config_format CHECK (jsonb_typeof(security_config) = 'object'),
    CONSTRAINT webhook_configs_metadata_format CHECK (jsonb_typeof(metadata) = 'object')
) PARTITION BY RANGE (created_at);

-- Create webhook_deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhook_configs(id),
    event webhook_event NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT webhook_deliveries_payload_format CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT webhook_deliveries_status_values CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING')),
    CONSTRAINT webhook_deliveries_response_status_range CHECK (response_status BETWEEN 100 AND 599)
) PARTITION BY RANGE (created_at);

-- Create indexes for webhook_configs
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_configs_url ON webhook_configs(url);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_status ON webhook_configs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_events ON webhook_configs USING GIN (events);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_created_at ON webhook_configs(created_at);

-- Create indexes for webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

-- Create initial partitions for webhook_configs
CREATE TABLE webhook_configs_y2024m01 PARTITION OF webhook_configs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE webhook_configs_y2024m02 PARTITION OF webhook_configs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE webhook_configs_y2024m03 PARTITION OF webhook_configs
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Create initial partitions for webhook_deliveries
CREATE TABLE webhook_deliveries_y2024m01 PARTITION OF webhook_deliveries
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE webhook_deliveries_y2024m02 PARTITION OF webhook_deliveries
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE webhook_deliveries_y2024m03 PARTITION OF webhook_deliveries
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Create updated_at triggers
CREATE TRIGGER update_webhook_configs_updated_at
    BEFORE UPDATE ON webhook_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_deliveries_updated_at
    BEFORE UPDATE ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE webhook_configs IS 'Stores webhook endpoint configurations and their settings';
COMMENT ON TABLE webhook_deliveries IS 'Tracks webhook delivery attempts and their status';
COMMENT ON COLUMN webhook_configs.retry_config IS 'JSON configuration for retry attempts (max_attempts, backoff_strategy, etc)';
COMMENT ON COLUMN webhook_configs.security_config IS 'JSON configuration for security settings (signature_algorithm, headers, etc)';
COMMENT ON COLUMN webhook_deliveries.next_retry_at IS 'Timestamp for the next retry attempt if status is RETRYING';