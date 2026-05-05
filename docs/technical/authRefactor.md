In forgotPasswordAction you're using magiclink for password reset. That's fine, but consider using recovery type instead (more semantic).
Add rate limiting on login/forgot-password (especially since it's a school system).
In admitStudentAction, you're deleting the student if linking fails — good, but consider cleaning up the auth user too in a real failure (though it's rare).

Resend Invite
  In resendInviteAction you're fetching student_parents but only using the first child. That's fine for now, but if a parent has multiple kids, the email might be confusing.


Phone Confirmation
  You're doing email_confirm: true but not phone_confirm: true. If you ever use phone login or OTPs, this might bite you.

Use a transaction-like pattern or add a unique constraint + onConflict handling. Or wrap the whole parent creation in a more defensive upsert.