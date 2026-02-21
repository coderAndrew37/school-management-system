This documentation covers the Secure Parent Onboarding & Password Recovery Flow we have built. This system replaces the insecure "plaintext temporary password" method with a professional, industry-standard PKCE (Proof Key for Code Exchange) Invite Flow.

🛠 System Architecture: The "Invite-to-Portal" Flow
The system consists of four interconnected layers: the Admissions Action, the Email Service, the Auth Callback Handler, and the Interactive Reset UI.

1. High-Level SequenceAdmin Admission:
   You admit a student via the dashboard.Auth Creation:

The server creates a Supabase Auth account for the parent (without a password).

Link Generation: A secure, one-time-use Recovery Link is generated.

Email Dispatch: Resend sends a branded email to the parent containing this link.

Exchange & Session: Parent clicks the link $\rightarrow$ /auth/callback exchanges the code for a live session.

Password Setup: Parent lands on a dedicated UI to set their private password.

2. Technical Component Breakdown

Inside the admission server action, we use supabase.auth.admin.generateLink.

Type: recovery (This is used for both forgotten passwords and initial invites).

Redirect: Points to /auth/callback?type=recovery.

Security: The link contains a hashed code that is valid for 24 hours and can only be used once.

3. The Gateway (app/auth/callback/route.ts)
   This is a Server-Side Route Handler. It acts as the "bouncer."

The Code Exchange: It takes the ?code=... from the URL and calls exchangeCodeForSession(code).

Session Creation: This creates the encrypted session cookies in the parent's browser.

Smart Routing: It detects the type=recovery flag and sends the parent specifically to the password setup page instead of the general dashboard.

4. The Interactive UI (app/auth/reset-password/page.tsx)
   This is a Client Component designed for high engagement and security.

Zod Validation: Prevents form submission if passwords don't match or are too short.

Password Strength Meter: Uses a custom useEffect to watch the input and provide a visual score (Red $\rightarrow$ Yellow $\rightarrow$ Green).

Supabase Integration: Calls the resetPasswordAction which executes supabase.auth.updateUser({ password }) on the server.

Gemini said
This documentation covers the Secure Parent Onboarding & Password Recovery Flow we have built. This system replaces the insecure "plaintext temporary password" method with a professional, industry-standard PKCE (Proof Key for Code Exchange) Invite Flow.

🛠 System Architecture: The "Invite-to-Portal" Flow
The system consists of four interconnected layers: the Admissions Action, the Email Service, the Auth Callback Handler, and the Interactive Reset UI.

1. High-Level Sequence
   Admin Admission: You admit a student via the dashboard.

Auth Creation: The server creates a Supabase Auth account for the parent (without a password).

Link Generation: A secure, one-time-use Recovery Link is generated.

Email Dispatch: Resend sends a branded email to the parent containing this link.

Exchange & Session: Parent clicks the link → /auth/callback exchanges the code for a live session.

Password Setup: Parent lands on a dedicated UI to set their private password.

2. Technical Component Breakdown
   A. The Link Generator (admitStudentAction)
   Inside the admission server action, we use supabase.auth.admin.generateLink.

Type: recovery (This is used for both forgotten passwords and initial invites).

Redirect: Points to /auth/callback?type=recovery.

Security: The link contains a hashed code that is valid for 24 hours and can only be used once.

B. The Gateway (app/auth/callback/route.ts)
This is a Server-Side Route Handler. It acts as the "bouncer."

The Code Exchange: It takes the ?code=... from the URL and calls exchangeCodeForSession(code).

Session Creation: This creates the encrypted session cookies in the parent's browser.

Smart Routing: It detects the type=recovery flag and sends the parent specifically to the password setup page instead of the general dashboard.

C. The Interactive UI (app/auth/reset-password/page.tsx)
This is a Client Component designed for high engagement and security.

Zod Validation: Prevents form submission if passwords don't match or are too short.

Password Strength Meter: Uses a custom useEffect to watch the input and provide a visual score (Red → Yellow → Green).

Supabase Integration: Calls the resetPasswordAction which executes supabase.auth.updateUser({ password }) on the server.

3. Security Features
   Feature, Technical Implementation, Benefit
   Zero-Knowledge, updateUser via session ,Admin never sees or handles the parent's password.
   PKCE Flow,exchangeCodeForSession,"Prevents ""Code Injection"" attacks during the redirect."
   Rate Limiting,Resend & Supabase Auth,Prevents bots from spamming the school with admission invites.
   UI Feedback,Sonner & Strength Meter,"Reduces user error and ""Weak Password"" vulnerabilities."

4. Environment Requirements

To ensure the links work in both local development and production, your .env and Supabase Dashboard must be synced:

Supabase Dashboard: Go to Authentication > URL Configuration.

Redirect URLs: Add http://localhost:3000/auth/callback and your live domain.

.env File:

NEXT_PUBLIC_SITE_URL: Set to http://localhost:3000 locally.

SUPABASE_SERVICE_ROLE_KEY: Required to generate the admin links.

5. Testing the Flow

Trigger: Use the Admission form with your own email as the parent email.

Receive: Check your inbox for the "Admission Successful" email from Resend.

Click: Click "Set Up My Account".

Callback: You should see the browser hit /auth/callback briefly before landing on /auth/reset-password.

Validate: Try entering a weak password; the meter should stay red and the button should stay disabled.

Complete: Enter a strong password and save. You should see a success Toast and be redirected to /login
