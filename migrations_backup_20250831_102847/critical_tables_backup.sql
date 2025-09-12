-- Critical Tables Backup
-- Created: $(date)
-- Purpose: Backup of essential tables before migration

-- Backup library_tracks (your 59 existing entries)
CREATE TABLE IF NOT EXISTS library_tracks_backup_critical AS 
SELECT * FROM public.library_tracks;

-- Backup users table
CREATE TABLE IF NOT EXISTS users_backup_critical AS 
SELECT * FROM public.users;

-- Backup uploads table
CREATE TABLE IF NOT EXISTS uploads_backup_critical AS 
SELECT * FROM public.uploads;

-- Backup track_rotations table
CREATE TABLE IF NOT EXISTS track_rotations_backup_critical AS 
SELECT * FROM public.track_rotations;

-- Verify backup counts
SELECT 
    'library_tracks' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM library_tracks_backup_critical) as backup_count
FROM public.library_tracks
UNION ALL
SELECT 
    'users' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM users_backup_critical) as backup_count
FROM public.users
UNION ALL
SELECT 
    'uploads' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM uploads_backup_critical) as backup_count
FROM public.uploads
UNION ALL
SELECT 
    'track_rotations' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM track_rotations_backup_critical) as backup_count
FROM public.track_rotations;
