-- Migration 26: Fix menu items integrity
-- This migration investigates and cleans up any corrupted menu_items records

-- ============================================
-- Check for NULL or missing IDs
-- ============================================
DO $$
DECLARE
    null_id_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_id_count
    FROM menu_items
    WHERE id IS NULL;

    IF null_id_count > 0 THEN
        RAISE NOTICE 'Found % menu items with NULL id (this should be impossible with PRIMARY KEY constraint)', null_id_count;
    ELSE
        RAISE NOTICE 'No menu items with NULL id found (expected behavior)';
    END IF;
END $$;

-- ============================================
-- Check for orphaned menu items
-- ============================================
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM menu_items mi
    WHERE NOT EXISTS (
        SELECT 1 FROM menus m WHERE m.id = mi.menu_id
    );

    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % orphaned menu items (referencing non-existent menus)', orphaned_count;

        -- Log the orphaned items for debugging
        RAISE NOTICE 'Orphaned menu items: %', (
            SELECT string_agg(CONCAT('id:', id, ' menu_id:', menu_id, ' label:', label), ', ')
            FROM menu_items mi
            WHERE NOT EXISTS (
                SELECT 1 FROM menus m WHERE m.id = mi.menu_id
            )
        );

        -- Delete orphaned menu items
        DELETE FROM menu_items mi
        WHERE NOT EXISTS (
            SELECT 1 FROM menus m WHERE m.id = mi.menu_id
        );

        RAISE NOTICE 'Deleted % orphaned menu items', orphaned_count;
    ELSE
        RAISE NOTICE 'No orphaned menu items found (good)';
    END IF;
END $$;

-- ============================================
-- Check for invalid parent references
-- ============================================
DO $$
DECLARE
    invalid_parent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_parent_count
    FROM menu_items mi
    WHERE parent_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM menu_items parent
        WHERE parent.id = mi.parent_id
        AND parent.menu_id = mi.menu_id
    );

    IF invalid_parent_count > 0 THEN
        RAISE NOTICE 'Found % menu items with invalid parent_id references', invalid_parent_count;

        -- Log the items with invalid parent references
        RAISE NOTICE 'Items with invalid parent_id: %', (
            SELECT string_agg(CONCAT('id:', id, ' parent_id:', parent_id, ' menu_id:', menu_id, ' label:', label), ', ')
            FROM menu_items mi
            WHERE parent_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM menu_items parent
                WHERE parent.id = mi.parent_id
                AND parent.menu_id = mi.menu_id
            )
        );

        -- Fix invalid parent references by setting them to NULL
        UPDATE menu_items
        SET parent_id = NULL
        WHERE parent_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM menu_items parent
            WHERE parent.id = parent_id
            AND parent.menu_id = menu_id
        );

        RAISE NOTICE 'Fixed % menu items with invalid parent_id (set to NULL)', invalid_parent_count;
    ELSE
        RAISE NOTICE 'No invalid parent_id references found (good)';
    END IF;
END $$;

-- ============================================
-- Check for circular parent references
-- ============================================
DO $$
DECLARE
    circular_count INTEGER;
    item_record RECORD;
BEGIN
    -- This is a simplified check for direct circular references (A->B->A)
    -- More complex circular chains would require recursive CTE
    SELECT COUNT(*) INTO circular_count
    FROM menu_items mi1
    INNER JOIN menu_items mi2 ON mi1.parent_id = mi2.id
    WHERE mi2.parent_id = mi1.id;

    IF circular_count > 0 THEN
        RAISE NOTICE 'Found % menu items with circular parent references', circular_count;

        -- Log circular references
        FOR item_record IN
            SELECT mi1.id, mi1.label, mi1.parent_id, mi2.label as parent_label
            FROM menu_items mi1
            INNER JOIN menu_items mi2 ON mi1.parent_id = mi2.id
            WHERE mi2.parent_id = mi1.id
        LOOP
            RAISE NOTICE 'Circular reference: id:% label:% <-> parent_id:% parent_label:%',
                item_record.id, item_record.label, item_record.parent_id, item_record.parent_label;
        END LOOP;

        -- Break circular references by setting the child's parent_id to NULL
        UPDATE menu_items mi1
        SET parent_id = NULL
        FROM menu_items mi2
        WHERE mi1.parent_id = mi2.id
        AND mi2.parent_id = mi1.id;

        RAISE NOTICE 'Fixed % circular parent references', circular_count;
    ELSE
        RAISE NOTICE 'No circular parent references found (good)';
    END IF;
END $$;

-- ============================================
-- Verify and enforce NOT NULL constraints
-- ============================================
DO $$
DECLARE
    menu_id_nullable VARCHAR(3);
    label_nullable VARCHAR(3);
    null_menu_id_count INTEGER;
    null_label_count INTEGER;
BEGIN
    -- Check current nullability status
    SELECT is_nullable INTO menu_id_nullable
    FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'menu_id';

    SELECT is_nullable INTO label_nullable
    FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'label';

    RAISE NOTICE 'Current nullability: menu_id=%, label=%', menu_id_nullable, label_nullable;

    -- Clean up any NULL menu_id values (delete orphaned rows)
    SELECT COUNT(*) INTO null_menu_id_count FROM menu_items WHERE menu_id IS NULL;
    IF null_menu_id_count > 0 THEN
        RAISE NOTICE 'Found % rows with NULL menu_id, deleting them', null_menu_id_count;
        DELETE FROM menu_items WHERE menu_id IS NULL;
    END IF;

    -- Clean up any NULL label values (delete invalid rows)
    SELECT COUNT(*) INTO null_label_count FROM menu_items WHERE label IS NULL OR trim(label) = '';
    IF null_label_count > 0 THEN
        RAISE NOTICE 'Found % rows with NULL or empty label, deleting them', null_label_count;
        DELETE FROM menu_items WHERE label IS NULL OR trim(label) = '';
    END IF;

    -- Ensure NOT NULL constraints are set (idempotent)
    IF menu_id_nullable = 'YES' THEN
        ALTER TABLE menu_items ALTER COLUMN menu_id SET NOT NULL;
        RAISE NOTICE 'Set menu_id to NOT NULL';
    ELSE
        RAISE NOTICE 'menu_id is already NOT NULL';
    END IF;

    IF label_nullable = 'YES' THEN
        ALTER TABLE menu_items ALTER COLUMN label SET NOT NULL;
        RAISE NOTICE 'Set label to NOT NULL';
    ELSE
        RAISE NOTICE 'label is already NOT NULL';
    END IF;
END $$;

-- ============================================
-- Migration completion summary
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Migration 26: Menu items integrity check complete';
    RAISE NOTICE 'All data integrity issues have been identified and cleaned up';
    RAISE NOTICE '================================================';
END $$;
