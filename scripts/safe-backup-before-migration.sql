-- SAFE BACKUP SCRIPT - Run this BEFORE any migrations
-- This script creates backup tables with all existing data
-- Date: 2025-01-XX

-- 1. Backup library_tracks (your 59 existing entries)
CREATE TABLE library_tracks_backup_safe AS 
SELECT * FROM public.library_tracks;

-- 2. Backup users table
CREATE TABLE users_backup_safe AS 
SELECT * FROM public.users;

-- 3. Backup uploads table
CREATE TABLE uploads_backup_safe AS 
SELECT * FROM public.uploads;

-- 4. Backup track_rotations table
CREATE TABLE track_rotations_backup_safe AS 
SELECT * FROM public.track_rotations;

-- 5. Verify backup counts match original
SELECT 
    'library_tracks' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM library_tracks_backup_safe) as backup_count
FROM public.library_tracks
UNION ALL
SELECT 
    'users' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM users_backup_safe) as backup_count
FROM public.users
UNION ALL
SELECT 
    'uploads' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM uploads_backup_safe) as backup_count
FROM public.uploads
UNION ALL
SELECT 
    'track_rotations' as table_name,
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM track_rotations_backup_safe) as backup_count
FROM public.track_rotations;

-- 6. Show sample data from library_tracks to verify content
SELECT 
    id, 
    track_id, 
    name, 
    artist, 
    genre, 
    type,
    created_at
FROM public.library_tracks 
LIMIT 5;
