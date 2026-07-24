"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthShell from "../../../components/auth/AuthShell";
import { ApiError } from "../../../lib/api";
import { confirmEmailChange, getPersonalData } from "../../../lib/personal-data";

type ConfirmationState = "loading" | "success" | "invalid" | "unavailable" | "session" | "error";

const confirmationCopy: Record<Exclude<ConfirmationState, "loading">, string> = {
  success: "Tu nuevo email fue confirmado correctamente.",
  invalid: "Este enlace de confirmación no es válido o ya venció. Tu email anterior continúa activo.",
  unavailable:
    "No fue posible completar el cambio porque ese email ya no está disponible. Tu email anterior continúa activo.",
  session: "Tu sesión venció. Inicia sesión y vuelve a abrir el enlace de confirmación.",
  error: "No pudimos completar el cambio de email. Tu email anterior continúa activo. Intenta nuevamente más tarde.",
};

export default function ConfirmEmailChangePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<ConfirmationState>("loading");

  useEffect(() => {
    let cancelled = false;

    const confirm = async () => {
      try {
        await confirmEmailChange(token);
        try {
          await getPersonalData();
        } catch {
          // The confirmation response is authoritative; a later profile reload will retry this refresh.
        }
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
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isLoading = state === "loading";
  const isSuccess = state === "success";

  return (
    <AuthShell
      title={isLoading ? "Confirmando tu email" : isSuccess ? "Email confirmado" : "No pudimos confirmar el email"}
      description={isLoading ? "Estamos validando tu enlace de forma segura." : confirmationCopy[state]}
      footerText="¿Quieres volver a QNext?"
      footerLinkText="Ir al inicio"
      footerHref="/feed"
      brandingSlot="signup_logo_url"
    >
      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border p-5 text-sm leading-6 ${
          isSuccess
            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
            : isLoading
              ? "border-white/10 bg-zinc-900/70 text-zinc-200"
              : "border-red-400/25 bg-red-500/10 text-red-100"
        }`}
      >
        <p>{isLoading ? "Confirmando el cambio…" : confirmationCopy[state]}</p>
        {!isLoading ? (
          <Link
            href={state === "session" ? "/login" : "/settings/personal-data"}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition duration-200 hover:bg-white"
          >
            {state === "session" ? "Iniciar sesión" : "Ir a Datos personales"}
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
