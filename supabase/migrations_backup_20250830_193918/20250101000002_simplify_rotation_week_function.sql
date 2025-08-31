-- Simplify the get_current_rotation_week function to avoid complex date functions
CREATE OR REPLACE FUNCTION get_current_rotation_week()
RETURNS INTEGER AS $$
DECLARE
    days_since_start INTEGER;
BEGIN
    -- Calculate days since 2024-01-01
    days_since_start := (CURRENT_DATE - DATE '2024-01-01');
    -- Return week number (simple division)
    RETURN (days_since_start / 7) + 1;
END;
$$ LANGUAGE plpgsql; 