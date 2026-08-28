"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { useI18n } from "../hooks/useI18n";
import GuestContentGate from "./GuestContentGate";
import { GuestGateVariant, useGuestGate } from "./GuestGateProvider";

export default function GuestSignupRec({ gateId = "guest-signup-rec", gateVariant = "signup" }: { gateId?: string; gateVariant?: Extract<GuestGateVariant, "signup" | "profile" | "availability"> }) {
  const { t } = useI18n();
  const { showGuestGate } = useGuestGate();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const instanceGateId = `${gateId}:${useId()}`;
  return <span ref={anchorRef} className="relative inline-flex" onMouseEnter={() => showGuestGate(instanceGateId, gateVariant)}>
    <Link href="/signup" aria-label={t("guestSignUp")} onClick={(event) => { if (window.matchMedia("(max-width: 767px)").matches) { event.preventDefault(); showGuestGate(instanceGateId, gateVariant); } }} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]">
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8 overflow-visible drop-shadow-[0_0_7px_rgba(134,173,224,.45)]">
        <path d="M16 3A13 13 0 0 0 16 29" fill="none" stroke="#86ADE0" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M16 3A13 13 0 0 1 16 29" fill="none" stroke="#86ADE0" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="5 3.168"/>
        <circle cx="16" cy="16" r="6.2" fill="#31577f" stroke="#a9c9ee" strokeWidth="1"/>
        <circle cx="14.4" cy="14.2" r="2.8" fill="#dcecff" opacity=".9"/>
      </svg>
    </Link>
    <GuestContentGate gateId={instanceGateId} portal anchorRef={anchorRef} />
  </span>;
}
