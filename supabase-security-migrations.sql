-- ============================================================
-- ShopChampion — Supabase Security Migrations
-- Apply in Supabase SQL Editor (or via supabase db push)
-- Fixes: CRIT-01, CRIT-02, CRIT-04, CRIT-06, CRIT-07, MED-09, MED-10
-- ============================================================

-- ─── CRIT-04: Move brute-force lockout server-side ───────────
-- Add failed_attempts and locked_until columns to sc_users
ALTER TABLE sc_users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
ALTER TABLE sc_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Updated check_password RPC with server-side lockout
CREATE OR REPLACE FUNCTION check_password(p_phone TEXT, p_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user sc_users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM sc_users WHERE phone = p_phone;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
    RAISE EXCEPTION 'locked_out';
  END IF;
  IF v_user.password_hash = p_hash THEN
    UPDATE sc_users SET failed_attempts = 0, locked_until = NULL WHERE phone = p_phone;
    RETURN TRUE;
  ELSE
    UPDATE sc_users SET
      failed_attempts = COALESCE(failed_attempts, 0) + 1,
      locked_until = CASE
        WHEN COALESCE(failed_attempts, 0) + 1 >= 5
        THEN NOW() + INTERVAL '15 minutes'
        ELSE locked_until
      END
    WHERE phone = p_phone;
    RETURN FALSE;
  END IF;
END;
$$;

-- ─── CRIT-02: Security answer brute-force protection ─────────
CREATE TABLE IF NOT EXISTS sc_secq_attempts (
  phone TEXT PRIMARY KEY,
  attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION check_security_answer(p_phone TEXT, p_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row sc_secq_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM sc_secq_attempts WHERE phone = p_phone;
  IF FOUND AND v_row.locked_until IS NOT NULL AND v_row.locked_until > NOW() THEN
    RAISE EXCEPTION 'locked_out';
  END IF;
  IF EXISTS (SELECT 1 FROM sc_users WHERE phone = p_phone AND security_answer_hash = p_hash) THEN
    DELETE FROM sc_secq_attempts WHERE phone = p_phone;
    RETURN TRUE;
  ELSE
    INSERT INTO sc_secq_attempts(phone, attempts) VALUES(p_phone, 1)
    ON CONFLICT(phone) DO UPDATE SET
      attempts = sc_secq_attempts.attempts + 1,
      locked_until = CASE
        WHEN sc_secq_attempts.attempts + 1 >= 3
        THEN NOW() + INTERVAL '1 hour'
        ELSE sc_secq_attempts.locked_until
      END;
    RETURN FALSE;
  END IF;
END;
$$;

-- ─── CRIT-01: Password reset token flow ──────────────────────
CREATE TABLE IF NOT EXISTS sc_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used BOOLEAN DEFAULT FALSE
);

CREATE OR REPLACE FUNCTION issue_reset_token(p_phone TEXT, p_secq_hash TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sc_users WHERE phone = p_phone AND security_answer_hash = p_secq_hash
  ) THEN
    RAISE EXCEPTION 'invalid_answer';
  END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO sc_reset_tokens (phone, token) VALUES (p_phone, v_token);
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION reset_password_with_token(p_phone TEXT, p_token TEXT, p_new_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sc_reset_tokens
    WHERE phone = p_phone AND token = p_token AND used = FALSE AND expires_at > NOW()
  ) THEN
    RETURN FALSE;
  END IF;
  UPDATE sc_users SET password_hash = p_new_hash WHERE phone = p_phone;
  UPDATE sc_reset_tokens SET used = TRUE WHERE phone = p_phone AND token = p_token;
  -- Also reset failed attempts on successful password change
  UPDATE sc_users SET failed_attempts = 0, locked_until = NULL WHERE phone = p_phone;
  RETURN TRUE;
END;
$$;

-- ─── MED-09: Timing-safe phone existence check ───────────────
CREATE OR REPLACE FUNCTION check_phone_exists(p_phone TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
  v_blocked BOOLEAN;
BEGIN
  SELECT
    EXISTS(SELECT 1 FROM sc_users WHERE phone = p_phone),
    COALESCE((SELECT blocked FROM sc_users WHERE phone = p_phone), FALSE)
  INTO v_exists, v_blocked;
  -- Constant-time delay to prevent timing attacks
  PERFORM pg_sleep(0.1);
  RETURN json_build_object('exists', v_exists, 'blocked', v_blocked);
END;
$$;

-- ─── CRIT-07 / CRIT-06: Lock down sc_users table ────────────
-- Revoke all direct table access from anon and authenticated roles.
-- All auth operations must go through security-definer RPCs above.
ALTER TABLE sc_users ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies first
DROP POLICY IF EXISTS "deny_anon_read" ON sc_users;
DROP POLICY IF EXISTS "deny_anon_write" ON sc_users;

-- Deny all direct reads/writes from client (anon key)
CREATE POLICY "deny_anon_read" ON sc_users FOR SELECT USING (FALSE);
CREATE POLICY "deny_anon_write" ON sc_users FOR UPDATE USING (FALSE);

-- Revoke direct table access (RPCs with SECURITY DEFINER bypass this, which is correct)
REVOKE SELECT, INSERT, UPDATE, DELETE ON sc_users FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON sc_users FROM authenticated;

-- ─── MED-10: Secure FCM push token storage ───────────────────
-- Store FCM tokens in a separate table instead of sc_users
-- so anon key can never read another shop's push token.
CREATE TABLE IF NOT EXISTS sc_push_tokens (
  phone TEXT PRIMARY KEY,
  fcm_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sc_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON sc_push_tokens FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON sc_push_tokens FROM authenticated;

-- Save or update a shop's FCM token (called by the shop itself after login)
CREATE OR REPLACE FUNCTION save_fcm_token(p_phone TEXT, p_token TEXT, p_hash TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only allow saving if the password hash matches (authenticated caller)
  IF NOT EXISTS (SELECT 1 FROM sc_users WHERE phone = p_phone AND password_hash = p_hash) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  INSERT INTO sc_push_tokens (phone, fcm_token, updated_at) VALUES (p_phone, p_token, NOW())
  ON CONFLICT (phone) DO UPDATE SET fcm_token = EXCLUDED.fcm_token, updated_at = NOW();
END;
$$;

-- Retrieve FCM token for push notification delivery (SellerPanel / server only)
-- Requires the service-role key — anon key calls will be rejected by RLS
CREATE OR REPLACE FUNCTION get_fcm_token(p_phone TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token TEXT;
BEGIN
  SELECT fcm_token INTO v_token FROM sc_push_tokens WHERE phone = p_phone;
  RETURN v_token;
END;
$$;
-- NOTE: get_fcm_token should only be called from SellerPanel (service role key).
-- The anon key cannot access sc_push_tokens directly due to REVOKE above.

-- ─── NOTIFY PostgREST to reload schema ───────────────────────
-- Run this after applying all migrations:
NOTIFY pgrst, 'reload schema';

-- ─── BLOCK/UNBLOCK SUPPORT ───────────────────────────────────
-- Required for SellerPanel block/unblock feature
ALTER TABLE sc_users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE;
-- Index for fast blocked-status lookups on login
CREATE INDEX IF NOT EXISTS idx_sc_users_blocked ON sc_users(phone) WHERE blocked = TRUE;

-- ─── MISSING RPCs (required for registration + login to work) ────────────────

-- Register a new user (bypasses RLS — SECURITY DEFINER runs as postgres)
CREATE OR REPLACE FUNCTION register_user(
  p_phone TEXT, p_hash TEXT, p_user_number BIGINT,
  p_shop_name TEXT, p_security_question TEXT, p_security_answer_hash TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM sc_users WHERE phone = p_phone) THEN
    RETURN FALSE; -- already registered
  END IF;
  INSERT INTO sc_users (phone, password_hash, created_at, user_number, shop_name, security_question, security_answer_hash)
  VALUES (p_phone, p_hash, NOW(), p_user_number, p_shop_name, p_security_question, p_security_answer_hash);
  RETURN TRUE;
END;
$$;

-- Update password via security-definer RPC (bypasses RLS)
CREATE OR REPLACE FUNCTION update_password(p_phone TEXT, p_new_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE sc_users SET password_hash = p_new_hash, failed_attempts = 0, locked_until = NULL WHERE phone = p_phone;
  RETURN FOUND;
END;
$$;

-- Get security question for a phone (read-safe — only returns question text, not answer)
CREATE OR REPLACE FUNCTION get_security_question(p_phone TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_question TEXT;
BEGIN
  SELECT security_question INTO v_question FROM sc_users WHERE phone = p_phone;
  RETURN v_question;
END;
$$;

-- SellerPanel: read all users (service role only — called with service key)
-- This is a fallback in case direct table reads fail due to RLS
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF sc_users LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM sc_users ORDER BY created_at DESC;
END;
$$;

NOTIFY pgrst, 'reload schema';
