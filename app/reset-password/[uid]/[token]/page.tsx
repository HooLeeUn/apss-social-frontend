import type { Metadata } from "next";
import PasswordResetForm from "../../../../components/auth/PasswordResetForm";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ uid: string; token: string }> }) {
  const { uid, token } = await params;
  return <PasswordResetForm key={`${uid}/${token}`} credentials={{ uid, token }} />;
}
