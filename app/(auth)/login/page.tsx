import { LoginForm } from "@/app/_components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Kibali Academy",
  description: "Sign in to the Kibali Academy school management portal",
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginForm redirectTo={params.redirectTo} errorParam={params.error} />;
}
