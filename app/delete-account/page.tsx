"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "../../components/auth/AuthShell";
import PublicLanguageSelector, { PublicLocale } from "../../components/PublicLanguageSelector";
import { useI18n } from "../../hooks/useI18n";
import { requestAccountDeletion } from "../../lib/account-security";

const copy = {
  es: {
    title: "Eliminar tu cuenta de RecCool",
    description: "Puedes solicitar la eliminación aunque no puedas iniciar sesión. Si existe una cuenta asociada, recibirás instrucciones por correo. Por seguridad, RecCool no confirmará públicamente si el correo está registrado.",
    deletedDataTitle: "Datos que se eliminan",
    deletedData: "Al confirmar la eliminación de tu cuenta, RecCool elimina la cuenta y los datos asociados a ella, incluidos los datos de perfil, avatar, calificaciones, comentarios públicos y dirigidos, video reacciones, reacciones a contenido, relaciones de seguimiento y amistad, preferencias y demás actividad asociada a la cuenta.",
    retainedDataTitle: "Datos que pueden conservarse",
    retainedData: "RecCool no aplica un período de retención adicional a los datos asociados a una cuenta una vez confirmada su eliminación. Determinada información técnica o registros podrán conservarse únicamente cuando sea necesario para cumplir obligaciones legales, requisitos de seguridad, prevención del fraude o resolución de incidencias, y solo durante el tiempo necesario para dicha finalidad.",
    email: "Correo electrónico",
    send: "Enviar instrucciones",
    sending: "Enviando…",
    success: "Si existe una cuenta asociada a este correo, recibirás instrucciones para eliminarla.",
    error: "No pudimos enviar la solicitud en este momento. Intenta nuevamente.",
    back: "Volver a iniciar sesión",
    footer: "¿Ya puedes acceder a tu cuenta?",
  },
  en: {
    title: "Delete your RecCool account",
    description: "You can request deletion even if you cannot sign in. If an associated account exists, you will receive instructions by email. For security, RecCool will not publicly confirm whether an email is registered.",
    deletedDataTitle: "Data that is deleted",
    deletedData: "When you confirm the deletion of your account, RecCool deletes the account and its associated data, including profile information, avatar, ratings, public and directed comments, video reactions, content reactions, follow and friendship relationships, preferences, and other activity associated with the account.",
    retainedDataTitle: "Data that may be retained",
    retainedData: "RecCool does not apply an additional retention period to data associated with an account once its deletion has been confirmed. Certain technical information or records may be retained only when necessary to comply with legal obligations, security requirements, fraud prevention, or incident resolution, and only for as long as necessary for that purpose.",
    email: "Email",
    send: "Send instructions",
    sending: "Sending…",
    success: "If an account exists for this email, you will receive instructions to delete it.",
    error: "We could not send the request right now. Please try again.",
    back: "Back to sign in",
    footer: "Can you access your account now?",
  },
} as const;

function DeleteAccountRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale: appLocale } = useI18n();
  const requested = searchParams.get("lang");
  const locale: PublicLocale = requested === "es" || requested === "en" ? requested : appLocale;
  const text = copy[locale];
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const selectLocale = (next: PublicLocale) => router.push(`/delete-account?lang=${next}`);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || !email.trim()) return;
    setLoading(true); setError("");
    try { await requestAccountDeletion(email.trim()); setSuccess(true); setEmail(""); }
    catch { setError(text.error); }
    finally { setLoading(false); }
  };
  return <AuthShell title={text.title} description={text.description} footerText={text.footer} footerLinkText={text.back} footerHref={`/login?lang=${locale}`} brandingSlot="login_logo_url" logoAlt="RecCool" emphasizeLogo headerAction={<PublicLanguageSelector locale={locale} onChange={selectLocale}/> }>
    <div className="mb-6 space-y-3" aria-label={locale === "es" ? "Información sobre la eliminación" : "Deletion information"}>
      {[
        [text.deletedDataTitle, text.deletedData],
        [text.retainedDataTitle, text.retainedData],
      ].map(([title, body]) => (
        <section key={title} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <p className="mt-1.5 text-sm leading-6 text-zinc-400">{body}</p>
        </section>
      ))}
    </div>
    {success ? <div role="status" className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">{text.success}<Link href={`/login?lang=${locale}`} className="mt-4 block font-semibold underline">{text.back}</Link></div> : <form onSubmit={submit} noValidate className="space-y-4"><div className="space-y-2"><label htmlFor="deletion-email" className="text-sm font-medium text-zinc-200">{text.email}</label><input id="deletion-email" type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35"/></div>{error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}<button type="submit" disabled={loading || !email.trim()} className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 disabled:opacity-60">{loading ? text.sending : text.send}</button></form>}
  </AuthShell>;
}

export default function DeleteAccountRequestPage() { return <Suspense fallback={<main className="min-h-screen bg-black" aria-busy="true"/>}><DeleteAccountRequestContent/></Suspense>; }
