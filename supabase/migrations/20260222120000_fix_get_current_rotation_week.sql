-- Fix get_current_rotation_week: EXTRACT(EPOCH FROM integer) does not exist
-- In PostgreSQL, date - date returns INTEGER (days), not interval.
-- Data uses rotation_week 1-4 (4-week cycle); function must return 1-4 to match.
--
CREATE OR REPLACE FUNCTION public.get_current_rotation_week()
RETURNS INTEGER
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Cycle 1-4: (weeks_since_epoch % 4) + 1
    RETURN ((CURRENT_DATE - DATE '2024-01-01') / 7 % 4) + 1;
END;
$function$;
