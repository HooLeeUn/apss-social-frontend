"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthShell from "../../../../components/auth/AuthShell";
import PublicLanguageSelector, { PublicLocale } from "../../../../components/PublicLanguageSelector";
import { useI18n } from "../../../../hooks/useI18n";
import { confirmAccountDeletion } from "../../../../lib/account-security";

const copy = {
  es: { title: "Confirmar eliminación de cuenta", description: "Esta acción eliminará permanentemente tu cuenta y no se puede deshacer.", cancel: "Cancelar", confirm: "Eliminar cuenta definitivamente", loading: "Eliminando…", success: "Tu cuenta fue eliminada correctamente.", invalid: "Este enlace de eliminación ya no es válido. Puede haber expirado, haber sido utilizado o haber sido reemplazado por una solicitud más reciente.", login: "Volver a iniciar sesión", retry: "Solicitar un enlace nuevo", footer: "¿No quieres eliminar tu cuenta?" },
  en: { title: "Confirm account deletion", description: "This action will permanently delete your account and cannot be undone.", cancel: "Cancel", confirm: "Permanently delete account", loading: "Deleting…", success: "Your account was deleted successfully.", invalid: "This deletion link is no longer valid. It may have expired, already been used, or been replaced by a newer request.", login: "Back to sign in", retry: "Request a new link", footer: "Do you want to keep your account?" },
} as const;
type State = "ready" | "loading" | "success" | "invalid";

function ConfirmDeletionContent() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale: appLocale } = useI18n();
  const requested = searchParams.get("lang");
  const locale: PublicLocale = requested === "es" || requested === "en" ? requested : appLocale;
  const text = copy[locale];
  const [state, setState] = useState<State>("ready");
  const selectLocale = (next: PublicLocale) => router.push(`/delete-account/confirm/${encodeURIComponent(token)}?lang=${next}`);
  const confirm = async () => {
    if (state !== "ready") return;
    setState("loading");
    try { await confirmAccountDeletion(token); setState("success"); }
    catch { setState("invalid"); }
  };
  return <AuthShell title={text.title} description={text.description} footerText={text.footer} footerLinkText={text.login} footerHref={`/login?lang=${locale}`} brandingSlot="login_logo_url" logoAlt="RecCool" emphasizeLogo headerAction={<PublicLanguageSelector locale={locale} onChange={selectLocale}/> }>
    {state === "success" ? <div role="status" className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-sm text-emerald-50">{text.success}<Link className="mt-4 block font-semibold underline" href={`/login?lang=${locale}`}>{text.login}</Link></div> : state === "invalid" ? <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm leading-6 text-red-100">{text.invalid}<Link className="mt-4 block font-semibold underline" href={`/delete-account?lang=${locale}`}>{text.retry}</Link></div> : <div className="flex flex-col-reverse gap-3 sm:flex-row"><Link href={`/login?lang=${locale}`} className="flex-1 rounded-xl border border-zinc-600 px-4 py-3 text-center text-sm font-semibold">{text.cancel}</Link><button type="button" disabled={state === "loading"} onClick={() => void confirm()} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{state === "loading" ? text.loading : text.confirm}</button></div>}
  </AuthShell>;
}

export default function ConfirmDeletionPage() { return <Suspense fallback={<main className="min-h-screen bg-black" aria-busy="true"/>}><ConfirmDeletionContent/></Suspense>; }
