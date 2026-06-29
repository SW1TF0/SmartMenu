/* ============================================================
   SmartMenuKJ — runtime configuration
   ------------------------------------------------------------
   Fill these in to enable the live cloud database (Supabase),
   which powers centralized registration, contact inquiries,
   view analytics and the admin panel — and still works on
   GitHub Pages.

   How to get the values (one-time, ~3 minutes):
     1. Create a free project at https://supabase.com
     2. Open the SQL Editor, paste & run the contents of
        SUPABASE_SETUP.sql (creates tables + security rules)
     3. Project Settings → API → copy "Project URL" and the
        "anon public" key into the two fields below
     4. Authentication → Providers → Email → turn OFF
        "Confirm email" (so sign-up logs you in instantly)

   Leave SUPABASE_URL empty to keep using the self-hosted
   PowerShell backend (server.ps1) or the local demo fallback.
   The anon key is PUBLIC by design — safe to commit.
   ============================================================ */
window.SMKJ_CONFIG = {
  SUPABASE_URL: '',        // e.g. 'https://abcdefghijkl.supabase.co'
  SUPABASE_ANON_KEY: '',   // your project's public "anon" key

  // Accounts allowed into the admin panel (/admin.html)
  ADMIN_EMAILS: ['krasimiruzun@smartmenukj.com'],
};
