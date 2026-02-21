import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// During testing, Resend only allows sending to the address you signed up with.
// Once you verify your domain (e.g., kibali.sc.ke), you can send to anyone.
const SENDER_EMAIL =
  process.env.NODE_ENV === "production"
    ? "admissions@yourdomain.com"
    : "onboarding@resend.dev";

export async function sendWelcomeEmail({
  parentEmail,
  parentName,
  studentName,
  tempPassword,
}: {
  parentEmail: string;
  parentName: string;
  studentName: string;
  tempPassword: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to:
        process.env.NODE_ENV === "production"
          ? parentEmail
          : "andrewtestemail254@gmail.com", // NOTE: In Resend Test Mode, this MUST be your own email
      subject: `Admission Successful: Welcome ${studentName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #f59e0b;">Kibali Academy Admission</h2>
          <p>Dear ${parentName},</p>
          <p>We are delighted to confirm that <strong>${studentName}</strong> has been successfully admitted to Kibali Academy.</p>
          
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; font-size: 16px;">Your Parent Portal Credentials</h3>
            <p style="margin: 5px 0;"><strong>Username:</strong> ${parentEmail}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 4px; border-radius: 4px;">${tempPassword}</code></p>
          </div>

          <p>Please log in to change your password and complete the student profile.</p>
          
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login" 
             style="display: inline-block; background: #f59e0b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">
             Login to Portal
          </a>

          <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
            This is an automated message from the Kibali Academy Admissions Office.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Mail Dispatch Error:", err);
    return { success: false, error: err };
  }
}
