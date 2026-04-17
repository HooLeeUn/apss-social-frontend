"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { setToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import AuthShell from "../../components/auth/AuthShell";
import { formatBirthDate, getAgeFromBirthDate, MINIMUM_AGE } from "../../lib/personal-data";

type FieldName =
  | "first_name"
  | "last_name"
  | "username"
  | "email"
  | "birth_date"
  | "password"
  | "password_confirmation"
  | "non_field_errors";
type FieldErrors = Partial<Record<FieldName, string>>;

interface RegisterResponse {
  token?: string;
}

const inputBaseClassName =
  "w-full rounded-xl border border-zinc-700/85 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500/90 outline-none transition duration-200 hover:border-zinc-500/90 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35";
const errorClassName = "text-sm text-red-300/95";
const birthDateHelperText = "Esta fecha no podrá modificarse después de crear la cuenta.";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    birth_date: "",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showBirthDateModal, setShowBirthDateModal] = useState(false);

  const birthDateAge = useMemo(() => getAgeFromBirthDate(form.birth_date), [form.birth_date]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "", non_field_errors: "" }));
  };

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (!form.first_name.trim()) {
      nextErrors.first_name = "El nombre es obligatorio.";
    }

    if (!form.last_name.trim()) {
      nextErrors.last_name = "El apellido es obligatorio.";
    }

    if (form.username.trim().length < 8) {
      nextErrors.username = "El username debe tener al menos 8 caracteres.";
    }

    if (!form.birth_date) {
      nextErrors.birth_date = "La fecha de nacimiento es obligatoria.";
    } else if (birthDateAge === null) {
      nextErrors.birth_date = "Ingresa una fecha de nacimiento válida.";
    } else if (birthDateAge < MINIMUM_AGE) {
      nextErrors.birth_date = `Debes tener al menos ${MINIMUM_AGE} años para registrarte.`;
    }

    if (form.password !== form.password_confirmation) {
      nextErrors.password_confirmation = "Las contraseñas no coinciden.";
    }

    return nextErrors;
  };

  const mapBackendErrors = (payload: Record<string, unknown>): FieldErrors => {
    const backendErrors: FieldErrors = {};
    const fields: FieldName[] = [
      "first_name",
      "last_name",
      "username",
      "email",
      "birth_date",
      "password",
      "password_confirmation",
      "non_field_errors",
    ];

    fields.forEach((field) => {
      const value = payload[field];
      if (Array.isArray(value) && value.length > 0) {
        backendErrors[field] = String(value[0]);
      }
    });

    return backendErrors;
  };

  const submitRegistration = async () => {
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(`${API_BASE_URL}/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const contentType = res.headers.get("content-type") || "";
      const data: RegisterResponse | Record<string, unknown> = contentType.includes("application/json") ? await res.json() : {};

      if (!res.ok) {
        const parsedErrors = mapBackendErrors(data as Record<string, unknown>);
        setErrors(
          Object.keys(parsedErrors).length > 0
            ? parsedErrors
            : { non_field_errors: "No se pudo completar el registro." },
        );
        return;
      }

      const registerData = data as RegisterResponse;

      if (registerData.token) {
        setToken(registerData.token);
        router.push("/");
        return;
      }

      router.push("/login");
    } catch (error) {
      console.error(error);
      setErrors({ non_field_errors: "No se pudo conectar con el backend." });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const frontendErrors = validateForm();
    if (Object.keys(frontendErrors).length > 0) {
      setErrors(frontendErrors);
      return;
    }

    setShowBirthDateModal(true);
  };

  const handleConfirmBirthDate = async () => {
    setShowBirthDateModal(false);
    await submitRegistration();
  };

  return (
    <>
      <AuthShell
        title="Crea tu cuenta"
        description="Regístrate para personalizar tu feed, puntuar películas y participar en conversaciones con otros cinéfilos."
        footerText="¿Ya tienes cuenta?"
        footerLinkText="Inicia sesión"
        footerHref="/login"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="signup-first-name" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              Nombre
            </label>
            <input
              id="signup-first-name"
              className={inputBaseClassName}
              placeholder="Tu nombre"
              value={form.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
            />
            {errors.first_name && <p className={errorClassName}>{errors.first_name}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-last-name" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              Apellido
            </label>
            <input
              id="signup-last-name"
              className={inputBaseClassName}
              placeholder="Tu apellido"
              value={form.last_name}
              onChange={(e) => handleChange("last_name", e.target.value)}
            />
            {errors.last_name && <p className={errorClassName}>{errors.last_name}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-username" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              Username
            </label>
            <input
              id="signup-username"
              className={inputBaseClassName}
              placeholder="Mínimo 8 caracteres"
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
            />
            {errors.username && <p className={errorClassName}>{errors.username}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              className={inputBaseClassName}
              placeholder="tu@email.com"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            {errors.email && <p className={errorClassName}>{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-birth-date" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              Fecha de nacimiento
            </label>
            <input
              id="signup-birth-date"
              type="date"
              className={inputBaseClassName}
              value={form.birth_date}
              onChange={(e) => handleChange("birth_date", e.target.value)}
            />
            {errors.birth_date ? <p className={errorClassName}>{errors.birth_date}</p> : null}
            {form.birth_date && !errors.birth_date ? <p className="text-xs text-amber-200">{birthDateHelperText}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              className={inputBaseClassName}
              placeholder="Crea una contraseña segura"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
            />
            {errors.password && <p className={errorClassName}>{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signup-password-confirmation"
              className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200"
            >
              Confirmar password
            </label>
            <input
              id="signup-password-confirmation"
              type="password"
              className={inputBaseClassName}
              placeholder="Repite tu contraseña"
              value={form.password_confirmation}
              onChange={(e) => handleChange("password_confirmation", e.target.value)}
            />
            {errors.password_confirmation && <p className={errorClassName}>{errors.password_confirmation}</p>}
          </div>

          {errors.non_field_errors && <p className={errorClassName}>{errors.non_field_errors}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition duration-200 hover:bg-white hover:shadow-[0_12px_34px_rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-65 disabled:shadow-none"
          >
            {loading ? "Creando cuenta..." : "Registrarme"}
          </button>
        </form>
      </AuthShell>

      {showBirthDateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
            <h3 className="text-lg font-semibold text-zinc-100">Confirmar fecha de nacimiento</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Fecha seleccionada: <span className="font-medium text-zinc-100">{formatBirthDate(form.birth_date)}</span>
              <br />
              Edad calculada: <span className="font-medium text-zinc-100">{birthDateAge ?? "No disponible"}</span>
            </p>
            <p className="mt-3 text-sm text-amber-200">{birthDateHelperText}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBirthDateModal(false)}
                className="rounded-lg border border-white/25 px-3 py-2 text-sm text-zinc-200 hover:border-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setShowBirthDateModal(false)}
                className="rounded-lg border border-white/25 px-3 py-2 text-sm text-zinc-200 hover:border-white"
              >
                Modificar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmBirthDate()}
                className="rounded-lg border border-zinc-100 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
