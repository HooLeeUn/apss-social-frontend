"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";
import AuthShell from "../components/auth/AuthShell";
import AuthCountrySelector, { useAuthLocale } from "../components/auth/AuthCountrySelector";
import AuthDialog from "../components/auth/AuthDialog";
import PasswordVisibilityButton from "../components/auth/PasswordVisibilityButton";

const inputBaseClassName = "w-full rounded-xl border border-zinc-700/85 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500/90 outline-none transition duration-200 hover:border-zinc-500/90 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35";
type LoginError = "credentials" | "connection" | null;

function LoginPageContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState<LoginError>(null);
  const [loading, setLoading] = useState(false);
  const { text } = useAuthLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedParam = searchParams.get("verified");
  const verificationMessage = verifiedParam === "1" ? text.verified : verifiedParam === "expired" ? text.expired : "";
  const verificationMessageClassName = verifiedParam === "1" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100";
  const closeDialog = useCallback(() => setLoginError(null), []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const nextErrors = { username: username.trim() ? "" : text.requiredUsername, password: password ? "" : text.requiredPassword };
    setFieldErrors(nextErrors);
    if (nextErrors.username || nextErrors.password) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/token/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      if (!res.ok) { setLoginError(res.status === 400 || res.status === 401 ? "credentials" : "connection"); return; }
      const data = await res.json();
      setToken(data.token);
      router.push("/feed");
    } catch { setLoginError("connection"); }
    finally { setLoading(false); }
  };

  return <>
    <AuthShell title={text.loginTitle} description={text.loginDescription} footerText={text.noAccount} footerLinkText={text.signupLink} footerHref="/signup" brandingSlot="login_logo_url" fitMobileViewport headerAction={<AuthCountrySelector />} logoAlt="QNext">
      <form onSubmit={handleLogin} noValidate className="space-y-4 sm:space-y-5">
        {verificationMessage ? <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${verificationMessageClassName}`}>{verificationMessage}</div> : null}
        <div className="space-y-2"><label htmlFor="login-username" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">{text.username}</label><input id="login-username" autoComplete="username" className={inputBaseClassName} placeholder={text.usernamePlaceholder} value={username} onChange={(e) => { setUsername(e.target.value); setFieldErrors((old) => ({ ...old, username: "" })); }} aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? "login-username-error" : undefined}/>{fieldErrors.username ? <p id="login-username-error" className="text-sm text-red-300">{fieldErrors.username}</p> : null}</div>
        <div className="space-y-2"><label htmlFor="login-password" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">{text.password}</label><div className="relative"><input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" className={`${inputBaseClassName} !pr-12`} placeholder={text.passwordPlaceholder} value={password} onChange={(e) => { setPassword(e.target.value); setFieldErrors((old) => ({ ...old, password: "" })); }} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined}/><PasswordVisibilityButton visible={showPassword} showLabel={text.showPassword} hideLabel={text.hidePassword} onToggle={() => setShowPassword((visible) => !visible)} /></div>{fieldErrors.password ? <p id="login-password-error" className="text-sm text-red-300">{fieldErrors.password}</p> : null}</div>
        <button type="submit" disabled={loading} className="mt-1 w-full rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-65">{loading ? text.loggingIn : text.loginButton}</button>
      </form>
    </AuthShell>
    {loginError ? <AuthDialog title={loginError === "credentials" ? text.credentialTitle : text.connectionTitle} message={loginError === "credentials" ? text.credentialMessage : text.connectionMessage} closeLabel={text.close} onClose={closeDialog} /> : null}
  </>;
}

export default function LoginPage() { return <Suspense><LoginPageContent /></Suspense>; }
