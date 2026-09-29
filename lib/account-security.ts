import { apiFetch } from "./api";

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiFetch("/me/change-password/", { method: "POST", body: JSON.stringify(payload) });
}

export function deleteAuthenticatedAccount(password: string) {
  return apiFetch("/me/delete-account/", { method: "POST", body: JSON.stringify({ password }) });
}

export function requestAccountDeletion(email: string) {
  return apiFetch("/account-deletion/request/", {
    method: "POST",
    body: JSON.stringify({ email }),
    omitAuth: true,
  });
}

export function confirmAccountDeletion(token: string) {
  return apiFetch(`/account-deletion/confirm/${encodeURIComponent(token)}/`, {
    method: "POST",
    omitAuth: true,
  });
}
