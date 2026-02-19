middleware.ts ← Session refresh + RBAC on every request

supabase/migrations/003_auth_profiles_rls.sql ← All DB-level security

lib/
types/auth.ts ← UserRole, Profile, Zod schemas
supabase/
server.ts ← SSR cookie-based server client + service client
browser.ts ← PKCE-compatible browser client
actions/auth.ts ← login, logout, forgotPassword, resetPassword, getSession

app/
auth/callback/route.ts ← PKCE code exchange handler
login/page.tsx
forgot-password/page.tsx
reset-password/page.tsx
parent/page.tsx ← Parent portal dashboard
teacher/page.tsx ← Teacher portal dashboard

components/
auth/
AuthLayout.tsx ← Shared card + logo for all auth pages
LoginForm.tsx ← Email/password + show/hide
ForgotPasswordForm.tsx ← Email + success state
ResetPasswordForm.tsx ← New password + live strength checklist
nav/
TopNav.tsx ← Sticky nav with role badge + logout
