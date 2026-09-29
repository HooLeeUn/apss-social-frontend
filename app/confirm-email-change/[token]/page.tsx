"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthShell from "../../../components/auth/AuthShell";
import PublicLanguageSelector, { PublicLocale } from "../../../components/PublicLanguageSelector";
import { useI18n } from "../../../hooks/useI18n";
import { ApiError } from "../../../lib/api";
import { confirmEmailChange, getPersonalData } from "../../../lib/personal-data";

type ConfirmationState = "loading" | "success" | "invalid" | "unavailable" | "session" | "error";
const copy = {
  es: { loadingTitle: "Confirmando tu email", successTitle: "Email confirmado", errorTitle: "No pudimos confirmar el email", loadingDescription: "Estamos validando tu enlace de forma segura.", loading: "Confirmando el cambio…", success: "Tu nuevo email fue confirmado correctamente.", invalid: "Este enlace de confirmación no es válido, ya venció o ya fue utilizado. Tu email anterior continúa activo.", unavailable: "No fue posible completar el cambio porque ese email ya no está disponible. Tu email anterior continúa activo.", session: "Tu sesión venció. Inicia sesión y vuelve a abrir el enlace de confirmación.", error: "No pudimos completar el cambio de email. Tu email anterior continúa activo. Intenta nuevamente más tarde.", login: "Iniciar sesión", settings: "Ir a Datos personales", footer: "¿Quieres volver a RecCool?", home: "Ir al inicio" },
  en: { loadingTitle: "Confirming your email", successTitle: "Email confirmed", errorTitle: "We could not confirm your email", loadingDescription: "We are securely validating your link.", loading: "Confirming the change…", success: "Your new email was confirmed successfully.", invalid: "This confirmation link is invalid, expired, or has already been used. Your previous email remains active.", unavailable: "The change could not be completed because that email is no longer available. Your previous email remains active.", session: "Your session expired. Sign in and open the confirmation link again.", error: "We could not complete the email change. Your previous email remains active. Please try again later.", login: "Sign in", settings: "Go to Personal data", footer: "Would you like to return to RecCool?", home: "Go home" },
} as const;

function ConfirmEmailChangeContent() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale: appLocale } = useI18n();
  const requested = searchParams.get("lang");
  const locale: PublicLocale = requested === "es" || requested === "en" ? requested : appLocale;
  const text = copy[locale];
  const [state, setState] = useState<ConfirmationState>("loading");

  useEffect(() => {
    let cancelled = false;
    const confirm = async () => {
      try {
        await confirmEmailChange(token);
        try { await getPersonalData(); } catch { /* The confirmation response remains authoritative. */ }
        if (!cancelled) setState("success");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 400) setState("invalid");
        else if (error instanceof ApiError && error.status === 409) setState("unavailable");
        else if (error instanceof ApiError && error.status === 401) setState("session");
        else setState("error");
      }
    };
    void confirm();
    return () => { cancelled = true; };
  }, [token]);

  const loading = state === "loading";
  const success = state === "success";
  const message = loading ? text.loading : text[state];
  const selectLocale = (next: PublicLocale) => router.push(`/confirm-email-change/${encodeURIComponent(token)}?lang=${next}`);
  return <AuthShell title={loading ? text.loadingTitle : success ? text.successTitle : text.errorTitle} description={loading ? text.loadingDescription : message} footerText={text.footer} footerLinkText={text.home} footerHref="/feed" brandingSlot="signup_logo_url" headerAction={<PublicLanguageSelector locale={locale} onChange={selectLocale}/> }>
    <div role="status" aria-live="polite" className={`rounded-2xl border p-5 text-sm leading-6 ${success ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-50" : loading ? "border-white/10 bg-zinc-900/70 text-zinc-200" : "border-red-400/25 bg-red-500/10 text-red-100"}`}><p>{message}</p>{!loading ? <Link href={state === "session" ? `/login?lang=${locale}` : "/settings/personal-data"} className="mt-5 inline-flex w-full justify-center rounded-xl bg-zinc-100 px-4 py-3 font-semibold text-zinc-900">{state === "session" ? text.login : text.settings}</Link> : null}</div>
  </AuthShell>;
}

export default function ConfirmEmailChangePage() { return <Suspense fallback={<main className="min-h-screen bg-black" aria-busy="true"/>}><ConfirmEmailChangeContent/></Suspense>; }
