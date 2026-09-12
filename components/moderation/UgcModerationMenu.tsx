"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { blockUser, ensureBlockedUsers, isBlockedUser, subscribeToBlockedUsers, unblockUser } from "../../lib/privacy";
import { REPORT_REASONS, ReportReason, ReportTarget, reportErrorStatus, submitReport } from "../../lib/moderation";

type ContentKind = "comment" | "video_comment";
type RestrictionAction = "block" | "unblock";

const copy = {
  es: { more: "Más opciones", reportContent: "Denunciar contenido", reportUser: "Denunciar usuario", restrict: "Restringir usuario", restrictedUser: "Usuario restringido", titleContent: "Denunciar contenido", titleUser: "Denunciar usuario", reason: "Motivo", details: "Detalles (opcional)", detailsPlaceholder: "Añade información que ayude a revisar la denuncia", cancel: "Cancelar", send: "Enviar denuncia", sending: "Enviando…", success: "Denuncia enviada correctamente.", duplicate: "Ya existe una denuncia activa sobre este contenido.", own: "No puedes denunciar tu propio contenido.", missing: "El contenido ya no está disponible.", auth: "Tu sesión no es válida. Inicia sesión de nuevo.", failed: "No pudimos enviar la denuncia. Inténtalo de nuevo.", restrictTitle: "Restringir usuario", confirmRestrict: (u: string) => `¿Está seguro que desea restringir a @${u}?`, restrictButton: "Restringir", restricted: "Usuario restringido correctamente.", removeTitle: "Quitar restricción", confirmRemove: (u: string) => `¿Desea quitar la restricción a @${u}?`, removeButton: "Quitar restricción", removed: "Restricción eliminada correctamente.", restrictFailed: "No pudimos actualizar la restricción del usuario.", reasons: ["Contenido inapropiado", "Acoso o amenazas", "Contenido sexual", "Spam o engaño", "Odio o discriminación", "Otro"] },
  en: { more: "More options", reportContent: "Report content", reportUser: "Report user", restrict: "Restrict user", restrictedUser: "Restricted user", titleContent: "Report content", titleUser: "Report user", reason: "Reason", details: "Details (optional)", detailsPlaceholder: "Add information that may help us review this report", cancel: "Cancel", send: "Submit report", sending: "Submitting…", success: "Report submitted successfully.", duplicate: "There is already an active report for this content.", own: "You cannot report your own content.", missing: "This content is no longer available.", auth: "Your session is invalid. Please sign in again.", failed: "We couldn't submit the report. Please try again.", restrictTitle: "Restrict user", confirmRestrict: (u: string) => `Are you sure you want to restrict @${u}?`, restrictButton: "Restrict", restricted: "User restricted successfully.", removeTitle: "Remove restriction", confirmRemove: (u: string) => `Do you want to remove the restriction from @${u}?`, removeButton: "Remove restriction", removed: "Restriction removed successfully.", restrictFailed: "We couldn't update this user's restriction.", reasons: ["Inappropriate content", "Harassment or threats", "Sexual content", "Spam or scam", "Hate or discrimination", "Other"] },
} as const;

export default function UgcModerationMenu({ contentKind, objectId, userId, username, placement = "header" }: { contentKind: ContentKind; objectId: string | number; userId: string | number; username: string; placement?: "header" | "mobile-reactions" }) {
  const { locale } = useI18n();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [reportKind, setReportKind] = useState<ContentKind | "user" | null>(null);
  const [restrictionAction, setRestrictionAction] = useState<RestrictionAction | null>(null);
  const [blocked, setBlocked] = useState(() => isBlockedUser(userId) ?? false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const cancelRestrictionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => setBlocked(isBlockedUser(userId) ?? false);
    const unsubscribe = subscribeToBlockedUsers(update);
    void ensureBlockedUsers().then(update).catch(() => undefined);
    return unsubscribe;
  }, [userId]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnMobileMovement = () => { if (window.matchMedia("(max-width: 1279px)").matches) setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("touchmove", closeOnMobileMovement, { passive: true, capture: true });
    window.addEventListener("scroll", closeOnMobileMovement, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("touchmove", closeOnMobileMovement, true);
      window.removeEventListener("scroll", closeOnMobileMovement, true);
    };
  }, []);

  useEffect(() => {
    if (!open && !reportKind && !restrictionAction) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      setOpen(false);
      setReportKind(null);
      setRestrictionAction(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [busy, open, reportKind, restrictionAction]);

  useEffect(() => {
    if (restrictionAction) cancelRestrictionRef.current?.focus();
  }, [restrictionAction]);

  const target: ReportTarget | null = reportKind === "user" ? { kind: "user", userId, username } : reportKind ? { kind: reportKind, objectId, userId, username } : null;
  async function send() { if (!target || !reason || busy) return; setBusy(true); setMessage(""); try { await submitReport(target, reason, details); setMessage(c.success); window.setTimeout(() => { setReportKind(null); setMessage(""); }, 900); } catch (error) { const status = reportErrorStatus(error); setMessage(status === 400 ? c.duplicate : status === 403 ? c.own : status === 404 ? c.missing : status === 401 ? c.auth : c.failed); } finally { setBusy(false); } }
  async function updateRestriction() {
    if (!restrictionAction || busy) return;
    setBusy(true);
    try {
      if (restrictionAction === "block") await blockUser(userId);
      else await unblockUser(userId);
      setBlocked(restrictionAction === "block");
      setToast(restrictionAction === "block" ? c.restricted : c.removed);
      setRestrictionAction(null);
      window.setTimeout(() => setToast(""), 2500);
    } catch { setMessage(c.restrictFailed); }
    finally { setBusy(false); }
  }

  return <>
    <div ref={rootRef} className={`relative shrink-0 ${placement === "mobile-reactions" ? "xl:hidden" : ""}`} data-ugc-menu>
      <button type="button" aria-label={c.more} aria-haspopup="menu" aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }} className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-300 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]">⋮</button>
      {open ? <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-52 rounded-xl border border-white/15 bg-zinc-950 p-1 shadow-xl shadow-black/50">
        <button role="menuitem" type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none" onClick={() => { setOpen(false); setReportKind(contentKind); }}>{c.reportContent}</button>
        <button role="menuitem" type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none" onClick={() => { setOpen(false); setReportKind("user"); }}>{c.reportUser}</button>
        <button role="menuitem" type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none" onClick={() => { setOpen(false); setMessage(""); setRestrictionAction(blocked ? "unblock" : "block"); }}>{blocked ? c.restrictedUser : c.restrict}</button>
      </div> : null}
    </div>
    {reportKind ? <div className="fixed inset-0 z-[1400] flex items-end bg-black/70 sm:items-center sm:justify-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setReportKind(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ugc-report-title" className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl border border-white/15 bg-zinc-950 p-5 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <h2 id="ugc-report-title" className="text-lg font-bold text-white">{reportKind === "user" ? c.titleUser : c.titleContent}</h2>
        <label htmlFor="ugc-report-reason" className="mt-5 block text-sm font-medium text-zinc-200">{c.reason}</label>
        <select id="ugc-report-reason" required value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="mt-2 w-full rounded-xl border border-white/20 bg-zinc-900 px-3 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#86ADE0]"><option value="" disabled>—</option>{REPORT_REASONS.map((value, i) => <option key={value} value={value}>{c.reasons[i]}</option>)}</select>
        <label htmlFor="ugc-report-details" className="mt-4 block text-sm font-medium text-zinc-200">{c.details}</label>
        <textarea id="ugc-report-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder={c.detailsPlaceholder} rows={4} className="mt-2 w-full resize-y rounded-xl border border-white/20 bg-zinc-900 px-3 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#86ADE0]" />
        {message ? <p role="status" className={`mt-3 text-sm ${message === c.success ? "text-emerald-300" : "text-rose-300"}`}>{message}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setReportKind(null)} className="min-h-11 rounded-xl border border-white/20 px-4 text-zinc-200 disabled:opacity-60">{c.cancel}</button><button type="button" disabled={!reason || busy} onClick={() => void send()} className="min-h-11 rounded-xl bg-[#86ADE0] px-4 font-semibold text-black disabled:opacity-50">{busy ? c.sending : c.send}</button></div>
      </div>
    </div> : null}
    {restrictionAction ? <div className="fixed inset-0 z-[1400] flex items-end bg-black/75 sm:items-center sm:justify-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setRestrictionAction(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ugc-restriction-title" aria-describedby="ugc-restriction-description" className="w-full rounded-t-2xl border border-white/15 bg-zinc-950 p-5 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <h2 id="ugc-restriction-title" className="text-lg font-bold text-white">{restrictionAction === "block" ? c.restrictTitle : c.removeTitle}</h2>
        <p id="ugc-restriction-description" className="mt-3 text-sm leading-6 text-zinc-300">{restrictionAction === "block" ? c.confirmRestrict(username) : c.confirmRemove(username)}</p>
        {message ? <p role="alert" className="mt-3 text-sm text-rose-300">{message}</p> : null}
        <div className="mt-6 flex justify-end gap-2"><button ref={cancelRestrictionRef} type="button" disabled={busy} onClick={() => setRestrictionAction(null)} className="min-h-11 rounded-xl border border-white/20 px-4 text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0] disabled:opacity-60">{c.cancel}</button><button type="button" disabled={busy} onClick={() => void updateRestriction()} className="min-h-11 rounded-xl bg-[#86ADE0] px-4 font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">{restrictionAction === "block" ? c.restrictButton : c.removeButton}</button></div>
      </div>
    </div> : null}
    {toast ? <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[1500] -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-zinc-950 px-4 py-3 text-sm text-emerald-300 shadow-2xl">{toast}</div> : null}
  </>;
}
