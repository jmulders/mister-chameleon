-- migration 186 — database functions are for the server only
--
-- Postgres gives EXECUTE on every new function to PUBLIC, and Supabase adds a
-- default grant to anon and authenticated in schema public. None of the functions
-- here checks who is calling, and the wallet functions are SECURITY DEFINER. So
-- anyone holding the anon key (it ships in the browser bundle for direct asset
-- uploads) could call /rest/v1/rpc/credit_wallet, debit_wallet,
-- set_tenant_active_override, get_wallet_ledger and the rest directly, past every
-- check in the application.
--
-- The application calls these functions with the service-role key only, so the
-- other roles lose EXECUTE. Trigger functions keep working: the privilege is
-- checked when a trigger is created, not when it fires.
--
-- Idempotent. Prod-SQL apart aan Jasper.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- New functions: without this, the next migration that adds a function would
-- reopen the hole. The first statement removes Supabase's per-schema default for
-- anon and authenticated. The second removes the built-in grant to PUBLIC, which
-- can only be changed globally for the role that creates the functions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
