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

const DEV_EMAIL = "omollondrw@gmail.com";

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
      to: process.env.NODE_ENV === "production" ? parentEmail : DEV_EMAIL,
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

/**
 * TEACHER WELCOME EMAIL
 * Sent when a new staff member is registered by the Admin.
 */
export async function sendTeacherWelcomeEmail({
  teacherEmail,
  teacherName,
  setupLink,
}: {
  teacherEmail: string;
  teacherName: string;
  setupLink: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Kibali Academy Staff <${SENDER_EMAIL}>`,
      to: process.env.NODE_ENV === "production" ? teacherEmail : DEV_EMAIL,
      subject: `Staff Onboarding: Welcome to Kibali Academy, ${teacherName}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; color: #1a202c;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; margin: 0; font-size: 24px;">Staff Account Created</h1>
            <p style="color: #718096; margin-top: 8px;">Teacher Management Portal</p>
          </div>

          <p>Dear <strong>${teacherName}</strong>,</p>
          
          <p>Welcome to the teaching staff at Kibali Academy. Your professional account has been set up in our school management system.</p>
          
          <div style="background: #ecfdf5; border: 1px solid #d1fae5; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
            <p style="margin-top: 0; font-weight: 600; color: #065f46;">Portal Activation</p>
            <p style="font-size: 14px; color: #047857; margin-bottom: 20px;">To begin recording CBC assessments and managing your timetable, please activate your account and set a password:</p>
            
            <a href="${setupLink}" 
               style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
               Set Up Staff Account
            </a>
          </div>

          <p style="font-size: 14px; color: #4a5568;">
            <strong>Official Email:</strong> ${teacherEmail}<br>
            <strong>Access Level:</strong> Teaching Staff<br>
            <strong>Link Expiry:</strong> 24 hours
          </p>

          <p style="font-size: 13px; color: #a0aec0; line-height: 1.6; margin-top: 30px;">
            If you have any issues accessing the portal, please contact the IT Administrator. 
          </p>

          <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;" />
          
          <footer style="text-align: center; font-size: 12px; color: #a0aec0;">
            <p>Kibali Academy Administration<br>
            Nairobi, Kenya</p>
          </footer>
        </div>
      `,
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Teacher Mail Error:", err);
    return { success: false, error: err };
  }
}

export async function sendAllocationEmail({
  teacherEmail,
  teacherName,
  subjectName,
  grade,
}: {
  teacherEmail: string;
  teacherName: string;
  subjectName: string;
  grade: string;
}) {
  return await resend.emails.send({
    from: `Kibali Academy <${SENDER_EMAIL}>`,
    to: process.env.NODE_ENV === "production" ? teacherEmail : DEV_EMAIL,
    subject: `New Subject Allocation: ${subjectName} (${grade})`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 12px;">
        <h2 style="color: #10b981;">Subject Allocated</h2>
        <p>Hello <strong>${teacherName}</strong>,</p>
        <p>You have been officially allocated the following subject for the 2026 academic year:</p>
        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
          <strong>Subject:</strong> ${subjectName}<br>
          <strong>Grade:</strong> ${grade}
        </div>
        <p style="margin-top: 20px;">You can now view your updated timetable and prepare your lesson strands in the staff portal.</p>
        <footer style="margin-top: 30px; font-size: 12px; color: #999;">
          Kibali Academy Administration
        </footer>
      </div>
    `,
  });
}
