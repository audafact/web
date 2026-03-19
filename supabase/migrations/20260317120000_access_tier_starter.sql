-- Document valid access_tier values: free | starter | pro | enterprise
-- Column remains text; application enforces values. No CHECK change required.

COMMENT ON COLUMN public.users.access_tier IS 'Subscription tier: free, starter, pro, enterprise (enterprise treated as pro in app).';
