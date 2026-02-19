import type { Metadata } from "next";
import { ForgotPasswordForm } from "../_components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password | Kibali Academy",
  description: "Request a password reset link for your Kibali Academy account",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
