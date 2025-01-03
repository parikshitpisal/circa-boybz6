-- Test Data Generation SQL Seed File
-- Version: 1.0
-- Purpose: Generate comprehensive test data for development and testing environments

-- Constants for data generation
DO $$
BEGIN
    -- Batch processing size
    PERFORM set_config('app.settings.batch_size', '10', false);
    -- Revenue range
    PERFORM set_config('app.settings.min_revenue', '100000', false);
    PERFORM set_config('app.settings.max_revenue', '5000000', false);
    -- OCR confidence range
    PERFORM set_config('app.settings.min_ocr_confidence', '75.0', false);
    PERFORM set_config('app.settings.max_ocr_confidence', '99.99', false);
    -- Retry settings
    PERFORM set_config('app.settings.max_retry_attempts', '3', false);
END $$;

-- Function to generate masked merchant data
CREATE OR REPLACE FUNCTION generate_merchant_data(index integer)
RETURNS jsonb AS $$
DECLARE
    revenue numeric;
BEGIN
    revenue := floor(random() * (current_setting('app.settings.max_revenue')::numeric - 
                                current_setting('app.settings.min_revenue')::numeric + 1) + 
                                current_setting('app.settings.min_revenue')::numeric);
    
    RETURN jsonb_build_object(
        'business_name', 'Test Business ' || index,
        'ein', '12-345' || lpad(index::text, 4, '0'),
        'address', jsonb_build_object(
            'street', '123 Test St',
            'city', 'City ' || index,
            'state', 'ST',
            'zip', lpad((10000 + index)::text, 5, '0')
        ),
        'owner_name', 'Test Owner ' || index,
        'owner_ssn', '***-**-' || lpad(mod(index, 9999)::text, 4, '0'),
        'annual_revenue', revenue,
        'created_at', now() - (random() * interval '90 days'),
        'metadata', jsonb_build_object(
            'industry', 'Test Industry ' || mod(index, 10),
            'years_in_business', mod(index, 20) + 1
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to insert test applications
CREATE OR REPLACE FUNCTION insert_test_applications()
RETURNS void AS $$
DECLARE
    batch_size integer := current_setting('app.settings.batch_size')::integer;
    total_records integer := 50;
    status_types text[] := ARRAY['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'];
    status_weights numeric[] := ARRAY[0.30, 0.25, 0.25, 0.10, 0.10];
    i integer;
    current_status text;
BEGIN
    FOR i IN 1..total_records LOOP
        -- Determine status based on distribution
        SELECT status INTO current_status
        FROM (
            SELECT unnest(status_types) as status, unnest(status_weights) as weight
        ) s
        WHERE random() <= weight
        ORDER BY weight DESC
        LIMIT 1;

        INSERT INTO applications (
            id,
            email_source,
            current_status,
            merchant_data,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            'test' || i || '@example.com',
            current_status,
            generate_merchant_data(i),
            now() - (random() * interval '90 days'),
            now() - (random() * interval '90 days')
        );

        IF mod(i, batch_size) = 0 THEN
            RAISE NOTICE 'Inserted % of % applications', i, total_records;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to insert test documents
CREATE OR REPLACE FUNCTION insert_test_documents()
RETURNS void AS $$
DECLARE
    batch_size integer := current_setting('app.settings.batch_size')::integer;
    total_records integer := 150;
    doc_types text[] := ARRAY['BANK_STATEMENT', 'ISO_APPLICATION', 'VOIDED_CHECK'];
    type_weights numeric[] := ARRAY[0.40, 0.40, 0.20];
    status_types text[] := ARRAY['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    status_weights numeric[] := ARRAY[0.20, 0.30, 0.40, 0.10];
    i integer;
    app_id uuid;
    current_type text;
    current_status text;
    confidence numeric;
BEGIN
    FOR i IN 1..total_records LOOP
        -- Get random application
        SELECT id INTO app_id
        FROM applications
        ORDER BY random()
        LIMIT 1;

        -- Determine document type based on distribution
        SELECT doc_type INTO current_type
        FROM (
            SELECT unnest(doc_types) as doc_type, unnest(type_weights) as weight
        ) d
        WHERE random() <= weight
        ORDER BY weight DESC
        LIMIT 1;

        -- Determine status based on distribution
        SELECT status INTO current_status
        FROM (
            SELECT unnest(status_types) as status, unnest(status_weights) as weight
        ) s
        WHERE random() <= weight
        ORDER BY weight DESC
        LIMIT 1;

        -- Generate realistic OCR confidence
        confidence := current_setting('app.settings.min_ocr_confidence')::numeric +
                     (random() * (current_setting('app.settings.max_ocr_confidence')::numeric -
                      current_setting('app.settings.min_ocr_confidence')::numeric));

        INSERT INTO documents (
            id,
            application_id,
            doc_type,
            storage_path,
            ocr_confidence,
            processing_status,
            processed_at,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            app_id,
            current_type,
            '/test-documents/' || current_type || '/' || i || '.pdf',
            round(confidence::numeric, 2),
            current_status,
            CASE WHEN current_status IN ('COMPLETED', 'FAILED') 
                 THEN now() - (random() * interval '1 day')
                 ELSE NULL 
            END,
            now() - (random() * interval '90 days'),
            now() - (random() * interval '90 days')
        );

        IF mod(i, batch_size) = 0 THEN
            RAISE NOTICE 'Inserted % of % documents', i, total_records;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to insert test webhooks
CREATE OR REPLACE FUNCTION insert_test_webhooks()
RETURNS void AS $$
DECLARE
    total_configs integer := 5;
    total_deliveries integer := 100;
    status_types text[] := ARRAY['ACTIVE', 'INACTIVE', 'FAILED'];
    status_weights numeric[] := ARRAY[0.80, 0.10, 0.10];
    delivery_status text[] := ARRAY['SUCCESS', 'FAILED', 'RETRYING'];
    delivery_weights numeric[] := ARRAY[0.70, 0.20, 0.10];
    webhook_id uuid;
    current_status text;
    i integer;
BEGIN
    -- Insert webhook configurations
    FOR i IN 1..total_configs LOOP
        -- Determine status based on distribution
        SELECT status INTO current_status
        FROM (
            SELECT unnest(status_types) as status, unnest(status_weights) as weight
        ) s
        WHERE random() <= weight
        ORDER BY weight DESC
        LIMIT 1;

        INSERT INTO webhook_configs (
            id,
            url,
            events,
            headers,
            status,
            max_attempts,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            'https://test-crm-' || i || '.example.com/webhooks',
            jsonb_build_array(
                'APPLICATION_CREATED',
                'APPLICATION_UPDATED',
                'APPLICATION_COMPLETED',
                'DOCUMENT_PROCESSED',
                'DOCUMENT_FAILED'
            ),
            jsonb_build_object(
                'X-Webhook-Secret', encode(gen_random_bytes(32), 'hex'),
                'X-Api-Key', encode(gen_random_bytes(16), 'hex')
            ),
            current_status,
            current_setting('app.settings.max_retry_attempts')::integer,
            now() - (random() * interval '90 days'),
            now() - (random() * interval '90 days')
        )
        RETURNING id INTO webhook_id;

        -- Insert webhook deliveries for this config
        FOR j IN 1..20 LOOP
            SELECT status INTO current_status
            FROM (
                SELECT unnest(delivery_status) as status, unnest(delivery_weights) as weight
            ) d
            WHERE random() <= weight
            ORDER BY weight DESC
            LIMIT 1;

            INSERT INTO webhook_deliveries (
                id,
                webhook_id,
                event_type,
                payload,
                status,
                attempt_count,
                last_attempt,
                created_at,
                updated_at
            )
            VALUES (
                gen_random_uuid(),
                webhook_id,
                (ARRAY['APPLICATION_CREATED', 'APPLICATION_UPDATED', 'DOCUMENT_PROCESSED'])[floor(random() * 3 + 1)],
                jsonb_build_object(
                    'event_id', encode(gen_random_bytes(16), 'hex'),
                    'timestamp', now() - (random() * interval '90 days'),
                    'data', jsonb_build_object(
                        'id', gen_random_uuid(),
                        'type', 'test_event',
                        'attributes', jsonb_build_object(
                            'test_field', 'test_value_' || j
                        )
                    )
                ),
                current_status,
                CASE 
                    WHEN current_status = 'SUCCESS' THEN 1
                    WHEN current_status = 'FAILED' THEN current_setting('app.settings.max_retry_attempts')::integer
                    ELSE floor(random() * current_setting('app.settings.max_retry_attempts')::integer) + 1
                END,
                now() - (random() * interval '1 day'),
                now() - (random() * interval '90 days'),
                now() - (random() * interval '90 days')
            );
        END LOOP;

        RAISE NOTICE 'Inserted webhook config % with 20 deliveries', i;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Main execution block
DO $$
BEGIN
    -- Clean existing test data
    RAISE NOTICE 'Cleaning existing test data...';
    DELETE FROM webhook_deliveries;
    DELETE FROM webhook_configs;
    DELETE FROM documents;
    DELETE FROM applications;
    
    -- Generate new test data
    RAISE NOTICE 'Generating test applications...';
    PERFORM insert_test_applications();
    
    RAISE NOTICE 'Generating test documents...';
    PERFORM insert_test_documents();
    
    RAISE NOTICE 'Generating test webhooks...';
    PERFORM insert_test_webhooks();
    
    RAISE NOTICE 'Test data generation completed successfully';
END $$;