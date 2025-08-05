-- Fix the get_current_rotation_week function to use a more compatible approach
CREATE OR REPLACE FUNCTION get_current_rotation_week()
RETURNS INTEGER AS $$
BEGIN
    -- Calculate week number since a reference date (e.g., 2024-01-01)
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$$ LANGUAGE plpgsql; 