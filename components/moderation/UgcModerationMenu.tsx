"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { blockUser, getBlockedUsers } from "../../lib/privacy";
import { REPORT_REASONS, ReportReason, ReportTarget, reportErrorStatus, submitReport } from "../../lib/moderation";

type ContentKind = "comment" | "video_comment";
const copy = {
  es: { more: "Más opciones", reportContent: "Denunciar contenido", reportUser: "Denunciar usuario", restrict: "Restringir usuario", titleContent: "Denunciar contenido", titleUser: "Denunciar usuario", reason: "Motivo", details: "Detalles (opcional)", detailsPlaceholder: "Añade información que ayude a revisar la denuncia", cancel: "Cancelar", send: "Enviar denuncia", sending: "Enviando…", success: "Denuncia enviada correctamente.", duplicate: "Ya existe una denuncia activa sobre este contenido.", own: "No puedes denunciar tu propio contenido.", missing: "El contenido ya no está disponible.", auth: "Tu sesión no es válida. Inicia sesión de nuevo.", failed: "No pudimos enviar la denuncia. Inténtalo de nuevo.", confirmRestrict: (u: string) => `¿Restringir a @${u}?`, restricted: "Usuario restringido correctamente.", already: "Ese usuario ya está restringido.", restrictFailed: "No pudimos restringir al usuario.", reasons: ["Contenido inapropiado", "Acoso o amenazas", "Contenido sexual", "Spam o engaño", "Odio o discriminación", "Otro"] },
  en: { more: "More options", reportContent: "Report content", reportUser: "Report user", restrict: "Restrict user", titleContent: "Report content", titleUser: "Report user", reason: "Reason", details: "Details (optional)", detailsPlaceholder: "Add information that may help us review this report", cancel: "Cancel", send: "Submit report", sending: "Submitting…", success: "Report submitted successfully.", duplicate: "There is already an active report for this content.", own: "You cannot report your own content.", missing: "This content is no longer available.", auth: "Your session is invalid. Please sign in again.", failed: "We couldn't submit the report. Please try again.", confirmRestrict: (u: string) => `Restrict @${u}?`, restricted: "User restricted successfully.", already: "That user is already restricted.", restrictFailed: "We couldn't restrict this user.", reasons: ["Inappropriate content", "Harassment or threats", "Sexual content", "Spam or scam", "Hate or discrimination", "Other"] },
} as const;

export default function UgcModerationMenu({ contentKind, objectId, userId, username, placement = "header" }: { contentKind: ContentKind; objectId: string | number; userId: string | number; username: string; placement?: "header" | "mobile-reactions" }) {
  const { locale } = useI18n(); const c = copy[locale];
  const [open, setOpen] = useState(false); const [reportKind, setReportKind] = useState<ContentKind | "user" | null>(null);
  const [reason, setReason] = useState<ReportReason | "">(""); const [details, setDetails] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  useEffect(() => { if (!reportKind) return; const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setReportKind(null); }; window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape); }, [busy, reportKind]);
  const target: ReportTarget | null = reportKind === "user" ? { kind: "user", userId, username } : reportKind ? { kind: reportKind, objectId, userId, username } : null;
  async function send() { if (!target || !reason || busy) return; setBusy(true); setMessage(""); try { await submitReport(target, reason, details); setMessage(c.success); window.setTimeout(() => { setReportKind(null); setMessage(""); }, 900); } catch (error) { const status = reportErrorStatus(error); setMessage(status === 400 ? c.duplicate : status === 403 ? c.own : status === 404 ? c.missing : status === 401 ? c.auth : c.failed); } finally { setBusy(false); } }
  async function restrict() { setOpen(false); if (!window.confirm(c.confirmRestrict(username))) return; setMessage(""); try { const existing = await getBlockedUsers(); if (existing.some((user) => String(user.id) === String(userId))) { window.alert(c.already); return; } await blockUser(userId); window.alert(c.restricted); } catch { window.alert(c.restrictFailed); } }
  return <>
    <div ref={rootRef} className={`relative shrink-0 ${placement === "mobile-reactions" ? "xl:hidden" : ""}`} data-ugc-menu>
      <button type="button" aria-label={c.more} aria-haspopup="menu" aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }} className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-300 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]">⋮</button>
      {open ? <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-52 rounded-xl border border-white/15 bg-zinc-950 p-1 shadow-xl shadow-black/50">
        <button role="menuitem" type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none" onClick={() => { setOpen(false); setReportKind(contentKind); }}>{c.reportContent}</button>
        <button role="menuitem" type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none" onClick={() => { setOpen(false); setReportKind("user"); }}>{c.reportUser}</button>
        <button role="menuitem" type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none" onClick={() => void restrict()}>{c.restrict}</button>
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
  </>;
}
