"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import AuthShell from "./AuthShell";
import PasswordVisibilityButton from "./PasswordVisibilityButton";
import { confirmPasswordReset, passwordResetError, requestPasswordReset, validateResetPasswords } from "../../lib/password-reset";

const inputClass = "w-full rounded-xl border border-zinc-700/85 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35";
const buttonClass = "block w-full rounded-xl bg-zinc-100 px-4 py-3 text-center text-sm font-semibold text-zinc-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60";

export default function PasswordResetForm({ credentials }: { credentials?: { uid: string; token: string } }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [invalidLink, setInvalidLink] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    if (credentials) {
      const validation = validateResetPasswords(password, confirmation);
      if (validation) { setError(validation); return; }
    } else {
      const input = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
      if (!email.trim() || input.validity.typeMismatch) { setError("Ingresa un correo electrónico válido."); return; }
    }
    pending.current = true;
    setLoading(true);
    try {
      if (credentials) {
        await confirmPasswordReset(credentials.uid, credentials.token, password, confirmation);
        setPassword(""); setConfirmation("");
        setSuccess("Tu contraseña fue restablecida correctamente.");
      } else {
        setSuccess(await requestPasswordReset(email));
      }
    } catch (cause) {
      const failure = passwordResetError(cause, Boolean(credentials));
      setError(failure.message);
      setInvalidLink(failure.invalidLink);
    } finally { pending.current = false; setLoading(false); }
  }

  return <AuthShell title={credentials ? "Restablecer contraseña" : "Recuperar contraseña"} description={credentials ? "Elige una nueva contraseña para tu cuenta de ReCCool." : "Ingresa tu correo para solicitar un enlace de recuperación."} footerText="¿Ya puedes acceder?" footerLinkText="Ir a iniciar sesión" footerHref="/login" brandingSlot="login_logo_url" logoAlt="ReCCool" emphasizeLogo>
    {success ? <div role="status" className="space-y-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-100"><p>{success}</p>{credentials ? <Link href="/login" className={buttonClass}>Ir a iniciar sesión</Link> : null}</div> : <>
      {error ? <div id="reset-error" role="alert" className="mb-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">{error}</div> : null}
      {invalidLink ? <Link href="/forgot-password" className={buttonClass}>Solicitar un nuevo enlace</Link> : <form onSubmit={submit} noValidate aria-busy={loading} aria-describedby={error ? "reset-error" : undefined} className="space-y-5">
        <fieldset disabled={loading} className="space-y-5">
          {credentials ? <>
            <div className="space-y-2"><label htmlFor="reset-password" className="text-sm font-medium text-zinc-200">Nueva contraseña</label><div className="relative"><input id="reset-password" type={showPassword ? "text" : "password"} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} !pr-12`} /><PasswordVisibilityButton visible={showPassword} showLabel="Mostrar contraseña" hideLabel="Ocultar contraseña" onToggle={() => setShowPassword((value) => !value)} /></div></div>
            <div className="space-y-2"><label htmlFor="reset-confirmation" className="text-sm font-medium text-zinc-200">Confirmar nueva contraseña</label><div className="relative"><input id="reset-confirmation" type={showConfirmation ? "text" : "password"} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={`${inputClass} !pr-12`} /><PasswordVisibilityButton visible={showConfirmation} showLabel="Mostrar contraseña" hideLabel="Ocultar contraseña" onToggle={() => setShowConfirmation((value) => !value)} /></div></div>
          </> : <div className="space-y-2"><label htmlFor="reset-email" className="text-sm font-medium text-zinc-200">Correo electrónico</label><input id="reset-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="usuario@example.com" /></div>}
          <button type="submit" disabled={loading} className={buttonClass}>{loading ? "Enviando…" : credentials ? "Restablecer contraseña" : "Enviar enlace de recuperación"}</button>
        </fieldset>
      </form>}
    </>}
  </AuthShell>;
}
