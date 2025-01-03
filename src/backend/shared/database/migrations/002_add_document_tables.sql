-- Migration: Add Document Tables
-- Description: Implements comprehensive document storage, processing, and audit capabilities
-- with advanced security features, partitioning, and performance optimizations

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create document_type enum
DO $$ BEGIN
    DROP TYPE IF EXISTS document_type CASCADE;
    CREATE TYPE document_type AS ENUM (
        'BANK_STATEMENT',
        'ISO_APPLICATION',
        'VOIDED_CHECK'
    );
    COMMENT ON TYPE document_type IS 'Valid document types for application processing';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create documents table with partitioning
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    type document_type NOT NULL,
    status application_status NOT NULL DEFAULT 'PENDING',
    storage_path VARCHAR(512) NOT NULL,
    ocr_confidence DECIMAL(5,2),
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT documents_ocr_confidence_range 
        CHECK (ocr_confidence BETWEEN 0 AND 100),
    CONSTRAINT documents_metadata_object 
        CHECK (jsonb_typeof(metadata) = 'object'),
    CONSTRAINT documents_storage_path_valid 
        CHECK (storage_path ~ '^[a-zA-Z0-9-_/\.]+$'),
    CONSTRAINT documents_processed_after_creation 
        CHECK (processed_at IS NULL OR processed_at >= created_at)
) PARTITION BY RANGE (created_at);

-- Create default partition
CREATE TABLE documents_default PARTITION OF documents DEFAULT;

-- Create initial monthly partitions for the next 12 months
DO $$ 
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    partition_date DATE;
    partition_name TEXT;
    sql TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        partition_date := start_date + (i || ' month')::INTERVAL;
        partition_name := 'documents_' || TO_CHAR(partition_date, 'YYYY_MM');
        sql := FORMAT(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF documents 
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            partition_date,
            partition_date + '1 month'::INTERVAL
        );
        EXECUTE sql;
    END LOOP;
END $$;

-- Create optimized indexes
CREATE INDEX idx_documents_application_id ON documents(application_id);
CREATE INDEX idx_documents_type_status ON documents(type, status);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_metadata ON documents USING GIN (metadata jsonb_path_ops);
CREATE INDEX idx_documents_storage_path ON documents(storage_path);

-- Create audit log table
CREATE TABLE document_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    changes JSONB NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    performed_by VARCHAR(255) NOT NULL,
    
    CONSTRAINT document_audit_valid_action 
        CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Create audit log indexes
CREATE INDEX idx_document_audit_document_id ON document_audit_log(document_id);
CREATE INDEX idx_document_audit_performed_at ON document_audit_log(performed_at);
CREATE INDEX idx_document_audit_action ON document_audit_log(action);
CREATE INDEX idx_document_audit_changes ON document_audit_log USING GIN (changes);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit.log_document_changes()
RETURNS TRIGGER AS $$
DECLARE
    changes_json JSONB;
    current_user_id VARCHAR(255);
BEGIN
    -- Get current user from session context
    current_user_id := COALESCE(current_setting('app.current_user', TRUE), 'system');
    
    IF TG_OP = 'INSERT' THEN
        changes_json := to_jsonb(NEW);
        INSERT INTO document_audit_log (document_id, action, changes, performed_by)
        VALUES (NEW.id, 'INSERT', changes_json, current_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        changes_json := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW),
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(to_jsonb(NEW))
                WHERE to_jsonb(NEW) -> key <> to_jsonb(OLD) -> key
            )
        );
        INSERT INTO document_audit_log (document_id, action, changes, performed_by)
        VALUES (NEW.id, 'UPDATE', changes_json, current_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        changes_json := to_jsonb(OLD);
        INSERT INTO document_audit_log (document_id, action, changes, performed_by)
        VALUES (OLD.id, 'DELETE', changes_json, current_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create document audit trigger
CREATE TRIGGER document_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW EXECUTE FUNCTION audit.log_document_changes();

-- Create updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_timestamp
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Add helpful comments
COMMENT ON TABLE documents IS 'Stores document metadata and processing status for application attachments';
COMMENT ON TABLE document_audit_log IS 'Audit trail for all document-related changes';
COMMENT ON COLUMN documents.storage_path IS 'Secure path to document storage location';
COMMENT ON COLUMN documents.ocr_confidence IS 'OCR processing confidence score (0-100)';
COMMENT ON COLUMN documents.metadata IS 'Additional document metadata and processing results';