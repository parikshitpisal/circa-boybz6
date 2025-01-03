-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for AI-Driven Application Intake Platform
-- Version: 1.0.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- For encryption
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- For GIN indexing

-- Create enum types
DO $$
BEGIN
    -- Application status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
        CREATE TYPE application_status AS ENUM (
            'PENDING',
            'PROCESSING',
            'COMPLETED',
            'FAILED',
            'REJECTED',
            'ARCHIVED'
        );
    END IF;

    -- Document type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM (
            'BANK_STATEMENT',
            'ISO_APPLICATION',
            'VOIDED_CHECK',
            'BUSINESS_LICENSE',
            'TAX_RETURN'
        );
    END IF;
END$$;

-- Create partition management functions
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name text,
    partition_date timestamp with time zone
) RETURNS void AS $$
DECLARE
    partition_name text;
    start_date timestamp with time zone;
    end_date timestamp with time zone;
BEGIN
    partition_name := table_name || '_' || to_char(partition_date, 'YYYY_MM');
    start_date := date_trunc('month', partition_date);
    end_date := start_date + interval '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_quarterly_partition(
    table_name text,
    partition_date timestamp with time zone
) RETURNS void AS $$
DECLARE
    partition_name text;
    start_date timestamp with time zone;
    end_date timestamp with time zone;
BEGIN
    partition_name := table_name || '_' || to_char(partition_date, 'YYYY_Q');
    start_date := date_trunc('quarter', partition_date);
    end_date := start_date + interval '3 months';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    email_source VARCHAR(255) NOT NULL,
    status application_status NOT NULL,
    merchant_data JSONB NOT NULL,
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL
) PARTITION BY RANGE (created_at);

-- Encrypt sensitive columns
ALTER TABLE applications 
    ALTER COLUMN email_source SET DATA TYPE bytea 
    USING pgp_sym_encrypt(email_source::text, current_setting('app.encryption_key'))::bytea,
    ALTER COLUMN merchant_data SET DATA TYPE bytea 
    USING pgp_sym_encrypt(merchant_data::text, current_setting('app.encryption_key'))::bytea;

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    type document_type NOT NULL,
    status application_status NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    ocr_confidence DECIMAL(5,2),
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    checksum VARCHAR(64) NOT NULL
) PARTITION BY RANGE (created_at);

-- Encrypt sensitive columns
ALTER TABLE documents 
    ALTER COLUMN storage_path SET DATA TYPE bytea 
    USING pgp_sym_encrypt(storage_path::text, current_setting('app.encryption_key'))::bytea;

-- Add constraints
ALTER TABLE documents 
    ADD CONSTRAINT fk_documents_application 
    FOREIGN KEY (application_id) 
    REFERENCES applications(id) 
    ON DELETE CASCADE;

-- Add table constraints
ALTER TABLE applications
    ADD CONSTRAINT chk_applications_email_format 
        CHECK (pgp_sym_decrypt(email_source::bytea, current_setting('app.encryption_key'))::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    ADD CONSTRAINT chk_applications_merchant_data 
        CHECK (jsonb_typeof(pgp_sym_decrypt(merchant_data::bytea, current_setting('app.encryption_key'))::text::jsonb) = 'object'),
    ADD CONSTRAINT chk_applications_timestamps 
        CHECK (created_at <= updated_at),
    ADD CONSTRAINT chk_applications_processed 
        CHECK (processed_at IS NULL OR processed_at >= created_at);

ALTER TABLE documents
    ADD CONSTRAINT chk_documents_ocr_confidence 
        CHECK (ocr_confidence BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_documents_metadata 
        CHECK (jsonb_typeof(metadata) = 'object'),
    ADD CONSTRAINT chk_documents_timestamps 
        CHECK (created_at <= updated_at),
    ADD CONSTRAINT chk_documents_processed 
        CHECK (processed_at IS NULL OR processed_at >= created_at),
    ADD CONSTRAINT chk_documents_storage_path 
        CHECK (pgp_sym_decrypt(storage_path::bytea, current_setting('app.encryption_key'))::text ~ '^[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applications_status 
    ON applications(status) 
    WHERE status IN ('PENDING', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_applications_created_at 
    ON applications(created_at);

CREATE INDEX IF NOT EXISTS idx_applications_email 
    ON applications(email_source);

CREATE INDEX IF NOT EXISTS idx_applications_merchant_data 
    ON applications USING GIN (merchant_data jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_applications_metadata 
    ON applications USING GIN (metadata jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_applications_processed 
    ON applications(processed_at) 
    WHERE processed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_application_id 
    ON documents(application_id);

CREATE INDEX IF NOT EXISTS idx_documents_type_status 
    ON documents(type, status);

CREATE INDEX IF NOT EXISTS idx_documents_created_at 
    ON documents(created_at);

CREATE INDEX IF NOT EXISTS idx_documents_metadata 
    ON documents USING GIN (metadata jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_documents_confidence 
    ON documents(ocr_confidence) 
    WHERE status = 'COMPLETED';

CREATE INDEX IF NOT EXISTS idx_documents_checksum 
    ON documents(checksum);

-- Create update trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION trigger_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        COALESCE(NEW.updated_by, OLD.updated_by)
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER audit_applications_changes
    AFTER INSERT OR UPDATE OR DELETE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_audit_changes();

CREATE TRIGGER audit_documents_changes
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_audit_changes();

-- Create initial partitions
SELECT create_monthly_partition('applications', NOW());
SELECT create_monthly_partition('applications', NOW() + interval '1 month');
SELECT create_quarterly_partition('documents', NOW());
SELECT create_quarterly_partition('documents', NOW() + interval '3 months');