-- Early pro access support (manual + invite code)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pro_access_source TEXT,
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.users
  ADD CONSTRAINT users_pro_access_source_check
  CHECK (
    pro_access_source IS NULL
    OR pro_access_source = ANY (ARRAY['founder_manual'::text, 'invite_code'::text])
  );

CREATE INDEX IF NOT EXISTS idx_users_pro_access_source ON public.users(pro_access_source);
CREATE INDEX IF NOT EXISTS idx_users_pro_expires_at ON public.users(pro_expires_at);

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  access_tier TEXT NOT NULL DEFAULT 'pro'::text,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT invite_codes_access_tier_check CHECK (access_tier = 'pro'::text),
  CONSTRAINT invite_codes_uppercase_check CHECK (code = UPPER(code)),
  CONSTRAINT invite_codes_max_redemptions_check CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  CONSTRAINT invite_codes_redemption_count_check CHECK (redemption_count >= 0),
  CONSTRAINT invite_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.invite_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT invite_code_redemptions_unique UNIQUE (invite_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_active ON public.invite_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON public.invite_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_code_redemptions_user_id ON public.invite_code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_code_redemptions_invite_code_id ON public.invite_code_redemptions(invite_code_id);

CREATE OR REPLACE FUNCTION public.increment_invite_code_redemption_count(p_invite_code_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.invite_codes
  SET redemption_count = redemption_count + 1,
      updated_at = NOW()
  WHERE id = p_invite_code_id;
END;
$$;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage invite codes" ON public.invite_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage invite code redemptions" ON public.invite_code_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own invite redemptions" ON public.invite_code_redemptions
  FOR SELECT TO public USING (auth.uid() = user_id);

COMMENT ON COLUMN public.users.pro_access_source IS 'How pro access was granted: founder_manual or invite_code.';
COMMENT ON COLUMN public.users.pro_expires_at IS 'Optional soft-expiration timestamp for manually/invite granted pro access.';
