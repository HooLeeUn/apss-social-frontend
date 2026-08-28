"use client";

import Link from "next/link";
import { useI18n } from "../hooks/useI18n";

export default function GuestSignupRec() {
  const { t } = useI18n();
  return <Link href="/signup" aria-label={t("guestSignUp")} title={t("guestSignUp")} className="group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]">
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8 overflow-visible drop-shadow-[0_0_7px_rgba(134,173,224,.45)]">
      <path d="M16 3A13 13 0 0 0 16 29" fill="none" stroke="#86ADE0" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M16 3A13 13 0 0 1 16 29" fill="none" stroke="#86ADE0" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="5 3.168"/>
      <circle cx="16" cy="16" r="6.2" fill="#31577f" stroke="#a9c9ee" strokeWidth="1"/>
      <circle cx="14.4" cy="14.2" r="2.8" fill="#dcecff" opacity=".9"/>
    </svg>
    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-100 opacity-0 shadow-xl transition group-hover:opacity-100">{t("guestSignUp")}</span>
  </Link>;
}
