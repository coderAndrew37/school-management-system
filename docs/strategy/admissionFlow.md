📋 System Architecture: Admission Workflow1. Environment ConfigurationAdd these variables to your .env.local file. During testing, the SENDER_EMAIL must remain the Resend default until your domain is verified.Code snippet# Resend Configuration
RESEND_API_KEY=re_your_api_key_here

# Site URL (for email links)

NEXT_PUBLIC_SITE_URL=http://localhost:3000

2.  Component BreakdownA.
    The Mailer Utility (lib/mail.ts)This utility handles the construction of the HTML template. It is designed to be adaptive: it uses the Resend testing sender while you are in development and switches to your school's domain in production.Logic: Uses a try/catch block to ensure that even if the email service is down, the student's database record is not rolled back (non-blocking).Template: Responsive HTML containing the student's name, parent's username, and temporary password.

B. The Logic Flow in admitStudentAction
The server action follows a specific transaction sequence to maintain data integrity:Validation:
Validates input against the admissionSchema (Zod).
Parent Check: Queries the parents table by email.If existing: Reuses the parent_id.If new: \* Generates a tempPassword (Parent + last 4 digits of phone).
Creates a Supabase Auth user via auth.admin.createUser.Trigger Execution: The database trigger handle_new_user() automatically creates the profile record.Inserts the record into the parents table.
Email Dispatch: Triggers sendWelcomeEmail.Student Creation: Inserts the student record linked to the parent_id.
Revalidation: Clears Next.js cache for the dashboard to show the new data immediately. 3. Testing Procedures (Resend Sandbox)Because you are using a Gmail-verified Resend account without a custom domain, you must follow these rules during testing:
FeatureConstraintRecipient (to)Must be the exact email you used to sign up for Resend.
Sender (from)Must be onboarding@resend.dev.
Daily Limit100 emails per day on the free tier.To test the full flow:Go to your Admission Form.Enter your Resend-registered email in the "Parent Email" field.Submit the form.Check your inbox for the "Admission Successful" notification.

4. Moving to Production (Domain Verification)When you are ready to send to actual parents (e.g., using @kibali.sc.ke), follow these steps:DNS Records: In the Resend Dashboard, add your domain and copy the SPF, DKIM, and DMARC records to your domain provider (e.g., Safaricom, Godaddy, or Kenya Website Experts).

Update lib/mail.ts: Update the SENDER_EMAIL constant to your verified address (e.g., admissions@kibali.sc.ke).

API Key: Ensure your Resend API Key is set in your production environment (Vercel/Netlify/Coolify).

5. Security NotesService Role Key: The supabaseAdmin client uses the SERVICE_ROLE_KEY. Never use this key in a client-side component (files starting with "use client").Temporary Passwords: The temporary password is set to Parent + last 4 digits. It is highly recommended to redirect parents to a /dashboard/profile/security page on their first login to update this.
