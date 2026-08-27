"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "../hooks/useI18n";
import { GuestGateVariant, useGuestGate } from "./GuestGateProvider";

export default function GuestContentGate({ gateId, placement = "floating", className = "" }: { gateId: string; placement?: "floating" | "below"; className?: string }) {
  const { t } = useI18n();
  const { activeGate, closeGuestGate, gateRef } = useGuestGate();
  const open = activeGate?.id === gateId;
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(closeGuestGate, 4200);
    return () => window.clearTimeout(timer);
  }, [closeGuestGate, open]);
  if (!open) return null;
  const copyKey: Record<GuestGateVariant, "guestSeeMorePrefix" | "guestRatePrefix" | "guestListPrefix" | "guestRecommendPrefix"> = { more: "guestSeeMorePrefix", rate: "guestRatePrefix", list: "guestListPrefix", recommend: "guestRecommendPrefix" };
  const position = placement === "below" ? "left-1/2 top-full mt-2 -translate-x-1/2" : "bottom-3 left-1/2 -translate-x-1/2";
  return <div ref={gateRef} role="status" className={`absolute ${position} z-50 flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#86ADE0]/30 bg-zinc-950/95 px-3 py-2 text-sm shadow-[0_12px_35px_rgba(0,0,0,.65)] backdrop-blur ${className}`}>
    <span className="text-zinc-300">{t(copyKey[activeGate.variant])}</span>
    <Link href="/signup" className="font-semibold text-[#a9c9ee] underline-offset-2 hover:underline">{t("guestSignUp")}</Link>
    <button type="button" aria-label={t("trailerClose")} onClick={closeGuestGate} className="ml-1 text-zinc-400 hover:text-white">×</button>
  </div>;
}
