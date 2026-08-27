"use client";

import Link from "next/link";
import { useI18n } from "../hooks/useI18n";

export default function GuestSignupRec({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return <Link href="/signup" aria-label={t("guestSignUp")} title={t("guestSignUp")} className={`group inline-flex items-center justify-center gap-2 rounded-full border border-red-500/70 bg-zinc-950/90 font-semibold text-white shadow-lg transition hover:border-red-400 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${compact ? "h-10 w-10" : "h-11 px-3"}`}>
    <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,.9)]" aria-hidden="true" />
    <span className={compact ? "sr-only" : "text-xs tracking-wide"}>REC</span>
    <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs opacity-0 transition-all group-hover:max-w-24 group-hover:opacity-100">{t("guestSignUp")}</span>
  </Link>;
}
