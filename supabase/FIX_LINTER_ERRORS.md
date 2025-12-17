# Fix Supabase Linter Errors

This document explains how to resolve all the Supabase linter errors.

## Function Search Path Issues (Can be fixed via SQL)

All function search path mutable warnings can be fixed by running the migration file:
`web/supabase/migrations/20250101000020_fix_function_search_path.sql`

**To apply the fix:**
1. Open the Supabase SQL Editor
2. Copy and paste the entire contents of `20250101000020_fix_function_search_path.sql`
3. Run the SQL script

This will add `SET search_path = ''` to all functions to prevent search path injection attacks.

### Functions Fixed:
- `handle_new_user`
- `check_user_upload_quota`
- `check_daily_upload_size` (created if missing)
- `check_daily_upload_count` (created if missing)
- `get_user_tracks`
- `extract_track_id_from_file_key`
- `get_current_rotation_week`
- `update_updated_at_column`
- `validate_schema_changes`
- `get_free_user_tracks`
- `get_pro_user_tracks`
- `get_user_library_track_count`
- `get_user_analytics_summary`
- `get_funnel_conversion_rates`
- `add_library_track_to_user`
- `remove_library_track_from_user`
- `get_user_library_tracks`
- `rotate_free_user_tracks`
- `get_rotation_info`
- `format_track_name`

## Leaked Password Protection (Requires Dashboard Configuration)

**Error:** `auth_leaked_password_protection` - Leaked Password Protection Disabled

**Fix:** This cannot be fixed via SQL. You need to enable it in the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Policies** or **Authentication** → **Settings**
3. Look for "Password Security" or "Leaked Password Protection" settings
4. Enable the "Check passwords against HaveIBeenPwned" option
5. Save the changes

**Reference:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Postgres Version Upgrade (Requires Dashboard Action)

**Error:** `vulnerable_postgres_version` - Current Postgres version has security patches available

**Fix:** This requires upgrading your Postgres database version through the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database** or **Infrastructure**
3. Look for "Database Version" or "Upgrade Database" option
4. Follow the prompts to upgrade to the latest Postgres version
5. Note: This may require a maintenance window and could cause brief downtime

**Reference:** https://supabase.com/docs/guides/platform/upgrading

**Note:** Before upgrading, ensure you have:
- Recent database backups
- Tested your application with the new Postgres version in a staging environment
- Reviewed any breaking changes in the Postgres release notes

## Summary

1. **Function Search Path Issues:** ✅ Fixed via SQL migration (run `20250101000020_fix_function_search_path.sql`)
2. **Leaked Password Protection:** ⚠️ Requires dashboard configuration
3. **Postgres Version:** ⚠️ Requires dashboard upgrade action

After running the SQL migration, 20 out of 22 errors will be resolved. The remaining 2 require dashboard actions.

