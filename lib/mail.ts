import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Note: During testing, Resend only allows sending to the address you signed up with.
 * Once you verify your domain (e.g., kibali.sc.ke), set SENDER_EMAIL to your official address.
 */
const SENDER_EMAIL =
  process.env.NODE_ENV === "production"
    ? "admissions@yourdomain.com" // Update this after domain verification
    : "onboarding@resend.dev";

export async function sendWelcomeEmail({
  parentEmail,
  parentName,
  studentName,
  setupLink,
}: {
  parentEmail: string;
  parentName: string;
  studentName: string;
  setupLink: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to:
        process.env.NODE_ENV === "production"
          ? parentEmail
          : "flochi254@gmail.com",
      subject: `Admission Successful: Welcome ${studentName} to Kibali Academy`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; color: #1a202c;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f59e0b; margin: 0; font-size: 24px;">Admission Confirmed</h1>
            <p style="color: #718096; margin-top: 8px;">Kibali Academy CBC Portal</p>
          </div>

          <p>Dear <strong>${parentName}</strong>,</p>
          
          <p>We are excited to welcome <strong>${studentName}</strong> to the Kibali Academy family! Your registration has been processed successfully.</p>
          
          <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
            <p style="margin-top: 0; font-weight: 600; color: #92400e;">Secure Account Setup</p>
            <p style="font-size: 14px; color: #b45309; margin-bottom: 20px;">To access your parent dashboard and view school reports, please set your password using the secure link below:</p>
            
            <a href="${setupLink}" 
               style="display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
               Set Up My Account
            </a>
          </div>

          <p style="font-size: 14px; color: #4a5568;">
            <strong>Username:</strong> ${parentEmail}<br>
            <strong>Link Expiry:</strong> 24 hours
          </p>

          <p style="font-size: 13px; color: #a0aec0; line-height: 1.6; margin-top: 30px;">
            If you did not expect this email, please ignore it. For security, never share this link with anyone. 
          </p>

          <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;" />
          
          <footer style="text-align: center; font-size: 12px; color: #a0aec0;">
            <p>Kibali Academy Admissions Office<br>
            Nairobi, Kenya</p>
          </footer>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Mail Dispatcher Crash:", err);
    return { success: false, error: err };
  }
}
