"use client";

import Link from "next/link";
import { useI18n } from "../hooks/useI18n";

export default function GuestSignupRec() {
  const { t } = useI18n();
  return <Link href="/signup" aria-label={t("guestSignUp")} title={t("guestSignUp")} className="group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]">
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 overflow-visible drop-shadow-[0_0_7px_rgba(134,173,224,.45)]">
      <defs><radialGradient id="guest-rec-metal" cx="35%" cy="30%"><stop offset="0" stopColor="#e3efff"/><stop offset=".42" stopColor="#86ADE0"/><stop offset="1" stopColor="#31577f"/></radialGradient></defs>
      <path d="M7 19a10 10 0 0 1 18 0" fill="none" stroke="#86ADE0" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="16" cy="17" r="4.3" fill="url(#guest-rec-metal)"/>
    </svg>
    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-100 opacity-0 shadow-xl transition group-hover:opacity-100">{t("guestSignUp")}</span>
  </Link>;
}
