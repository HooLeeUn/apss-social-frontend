"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordVisibilityButton from "../auth/PasswordVisibilityButton";
import { useI18n } from "../../hooks/useI18n";
import { ApiError } from "../../lib/api";
import { clearGuestMode, clearToken } from "../../lib/auth";
import { changePassword, deleteAuthenticatedAccount } from "../../lib/account-security";

const inputClassName = "w-full rounded-xl border border-zinc-700/85 bg-zinc-900/90 px-4 py-3 pr-12 text-sm text-zinc-100 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35";
const copy = {
  es: { change: "Cambiar contraseña", current: "Contraseña actual", next: "Nueva contraseña", confirm: "Confirmar nueva contraseña", submit: "Actualizar contraseña", required: "Completa todos los campos.", mismatch: "Las contraseñas no coinciden.", requirements: "Usa al menos 8 caracteres.", changed: "Tu contraseña fue actualizada correctamente. Por seguridad, debes iniciar sesión nuevamente.", changeError: "No pudimos cambiar la contraseña. Verifica tu contraseña actual y los requisitos de la nueva.", show: "Mostrar contraseña", hide: "Ocultar contraseña", danger: "Zona de riesgo", delete: "Eliminar cuenta", warning: "Esta acción eliminará permanentemente tu cuenta y los datos asociados que RecCool no deba conservar. Esta acción no se puede deshacer.", open: "Eliminar mi cuenta", modal: "Confirma la eliminación permanente de tu cuenta introduciendo tu contraseña actual.", password: "Contraseña actual", cancel: "Cancelar", confirmDelete: "Eliminar cuenta", deleted: "Tu cuenta fue eliminada correctamente.", deleteError: "No pudimos eliminar la cuenta. Verifica tu contraseña e intenta nuevamente.", working: "Procesando…" },
  en: { change: "Change password", current: "Current password", next: "New password", confirm: "Confirm new password", submit: "Update password", required: "Complete all fields.", mismatch: "The passwords do not match.", requirements: "Use at least 8 characters.", changed: "Your password was updated successfully. For security, please sign in again.", changeError: "We could not change your password. Check your current password and the new password requirements.", show: "Show password", hide: "Hide password", danger: "Danger zone", delete: "Delete account", warning: "This will permanently delete your account and associated data that RecCool is not required to retain. This action cannot be undone.", open: "Delete my account", modal: "Confirm the permanent deletion of your account by entering your current password.", password: "Current password", cancel: "Cancel", confirmDelete: "Delete account", deleted: "Your account was deleted successfully.", deleteError: "We could not delete the account. Check your password and try again.", working: "Processing…" },
} as const;

function friendlyError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 400) return fallback;
  return fallback;
}

export default function AccountSecuritySettings() {
  const router = useRouter();
  const { locale } = useI18n();
  const text = copy[locale];
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false, deletion: false });
  const [changeError, setChangeError] = useState("");
  const [changing, setChanging] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!deleteOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !deleting) setDeleteOpen(false); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", escape); };
  }, [deleteOpen, deleting]);

  const logout = (message: string) => {
    clearToken();
    clearGuestMode();
    sessionStorage.setItem("reccool:auth-message", message);
    router.replace("/login");
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (changing) return;
    if (!passwords.current || !passwords.next || !passwords.confirm) { setChangeError(text.required); return; }
    if (passwords.next !== passwords.confirm) { setChangeError(text.mismatch); return; }
    if (passwords.next.length < 8) { setChangeError(text.requirements); return; }
    setChanging(true); setChangeError("");
    try {
      await changePassword({ current_password: passwords.current, new_password: passwords.next, new_password_confirmation: passwords.confirm });
      setPasswords({ current: "", next: "", confirm: "" });
      logout(text.changed);
    } catch (error) { setChangeError(friendlyError(error, text.changeError)); }
    finally { setChanging(false); }
  };

  const closeDelete = () => { if (!deleting) { setDeleteOpen(false); setDeletePassword(""); setDeleteError(""); } };
  const submitDeletion = async (event: FormEvent) => {
    event.preventDefault();
    if (deleting) return;
    if (!deletePassword) { setDeleteError(text.required); return; }
    setDeleting(true); setDeleteError("");
    try {
      await deleteAuthenticatedAccount(deletePassword);
      setDeletePassword("");
      logout(text.deleted);
    } catch (error) { setDeleteError(friendlyError(error, text.deleteError)); }
    finally { setDeleting(false); }
  };

  const passwordField = (key: "current" | "next" | "confirm", label: string, autoComplete: string) => <div className="space-y-2"><label htmlFor={`security-${key}`} className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-zinc-200">{label}</label><div className="relative"><input id={`security-${key}`} type={visible[key] ? "text" : "password"} autoComplete={autoComplete} minLength={key === "current" ? undefined : 8} required value={passwords[key]} onChange={(e) => { setPasswords((old) => ({ ...old, [key]: e.target.value })); setChangeError(""); }} className={inputClassName}/><PasswordVisibilityButton visible={visible[key]} showLabel={text.show} hideLabel={text.hide} onToggle={() => setVisible((old) => ({ ...old, [key]: !old[key] }))}/></div></div>;

  return <>
    <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]"><h2 className="text-lg font-semibold">{text.change}</h2><form onSubmit={submitPassword} noValidate className="mt-4 grid gap-4 md:grid-cols-3">{passwordField("current", text.current, "current-password")}{passwordField("next", text.next, "new-password")}{passwordField("confirm", text.confirm, "new-password")}<p className="text-xs text-zinc-400 md:col-span-3">{text.requirements}</p>{changeError ? <p role="alert" className="text-sm text-red-300 md:col-span-3">{changeError}</p> : null}<div className="md:col-span-3 md:text-right"><button disabled={changing} className="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 disabled:opacity-60">{changing ? text.working : text.submit}</button></div></form></section>
    <section className="rounded-3xl border border-red-500/35 bg-red-950/15 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">{text.danger}</p><h2 className="mt-2 text-lg font-semibold">{text.delete}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">{text.warning}</p><button type="button" onClick={() => setDeleteOpen(true)} className="mt-4 rounded-xl border border-red-400/60 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-100 hover:bg-red-500/20">{text.open}</button></section>
    {deleteOpen ? <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-6"><form onSubmit={submitDeletion} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-md rounded-2xl border border-red-400/30 bg-zinc-950 p-6 shadow-2xl"><h2 id="delete-account-title" className="text-xl font-semibold text-red-100">{text.delete}</h2><p className="mt-3 text-sm leading-6 text-zinc-300">{text.modal}</p><div className="mt-4 space-y-2"><label htmlFor="delete-password" className="text-sm font-medium">{text.password}</label><div className="relative"><input id="delete-password" autoFocus type={visible.deletion ? "text" : "password"} autoComplete="current-password" value={deletePassword} onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(""); }} className={inputClassName}/><PasswordVisibilityButton visible={visible.deletion} showLabel={text.show} hideLabel={text.hide} onToggle={() => setVisible((old) => ({ ...old, deletion: !old.deletion }))}/></div></div>{deleteError ? <p role="alert" className="mt-3 text-sm text-red-300">{deleteError}</p> : null}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button ref={cancelRef} type="button" disabled={deleting} onClick={closeDelete} className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm">{text.cancel}</button><button type="submit" disabled={deleting || !deletePassword} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{deleting ? text.working : text.confirmDelete}</button></div></form></div> : null}
  </>;
}
