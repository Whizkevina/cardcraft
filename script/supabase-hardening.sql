-- CardCraft — Supabase security hardening
--
-- Run once in Supabase Dashboard → SQL Editor.
-- Safe for CardCraft: the Express app connects via DATABASE_URL (postgres role),
-- which bypasses RLS. This blocks PostgREST / anon / authenticated API access.
--
-- After running, verify the app: login, templates, save project, admin panel.

-- ─── 1. Enable Row Level Security ───────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → PostgREST denies all rows.

-- ─── 2. Revoke direct API role access ───────────────────────────────────────

REVOKE ALL ON TABLE public.users FROM anon, authenticated;
REVOKE ALL ON TABLE public.templates FROM anon, authenticated;
REVOKE ALL ON TABLE public.projects FROM anon, authenticated;
REVOKE ALL ON TABLE public.payments FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_audit_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.analytics_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.analytics_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.system_meta FROM anon, authenticated;
REVOKE ALL ON TABLE public.session FROM anon, authenticated;

-- ─── 3. Performance (optional) ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_template_id ON public.projects (template_id);
