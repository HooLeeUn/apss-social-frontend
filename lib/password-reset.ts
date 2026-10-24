import { ApiError, apiFetch } from "./api";

export const INVALID_RESET_LINK = "Este enlace de recuperación ya no es válido. Solicita uno nuevo.";
export const RESET_REQUEST_MESSAGE = "Si el correo está asociado a una cuenta activa de ReCCool, recibirás un enlace para restablecer tu contraseña. El enlace será válido durante 1 hora.";

export function validateResetPasswords(password: string, confirmation: string): string | null {
  if (!password || !confirmation) return "Completa ambos campos de contraseña.";
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return null;
}

export async function requestPasswordReset(email: string): Promise<string> {
  const result = await apiFetch("/auth/password-reset/request/", {
    method: "POST", omitAuth: true, body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const detail = (result as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" ? detail : RESET_REQUEST_MESSAGE;
}

export async function confirmPasswordReset(uid: string, token: string, password: string, confirmation: string) {
  const error = validateResetPasswords(password, confirmation);
  if (error) throw new Error(error);
  return apiFetch("/auth/password-reset/confirm/", {
    method: "POST", omitAuth: true,
    body: JSON.stringify({ uid, token, new_password: password, confirm_password: confirmation }),
  });
}

export function passwordResetError(error: unknown, confirming: boolean): { message: string; invalidLink: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 429) return { message: "Demasiados intentos. Espera un momento antes de volver a intentarlo.", invalidLink: false };
    if (error.status === 400) {
      // apiFetch preserves field-validation errors as JSON in its message.
      try {
        const fields = JSON.parse(error.message) as Record<string, unknown>;
        if (confirming && (fields.uid || fields.token)) return { message: INVALID_RESET_LINK, invalidLink: true };
        const messages = [fields.email, fields.new_password, fields.confirm_password, fields.non_field_errors]
          .flatMap((value) => typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
        if (messages.length) return { message: messages.join(" "), invalidLink: false };
      } catch { /* A detail error is already a plain string. */ }
      if (confirming) return { message: INVALID_RESET_LINK, invalidLink: true };
      return { message: "Ingresa un correo electrónico válido.", invalidLink: false };
    }
  }
  return { message: "No pudimos conectar con el servicio. Inténtalo de nuevo.", invalidLink: false };
}
