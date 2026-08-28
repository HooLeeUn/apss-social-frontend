"use client";

import Link from "next/link";
import { RefObject, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../hooks/useI18n";
import { GuestGateVariant, useGuestGate } from "./GuestGateProvider";

type Placement = "floating" | "below" | "below-end" | "inline-end";

export default function GuestContentGate({ gateId, placement = "floating", className = "", portal = false, anchorRef }: { gateId: string; placement?: Placement; className?: string; portal?: boolean; anchorRef?: RefObject<HTMLElement | null> }) {
  const { t } = useI18n();
  const { activeGate, closeGuestGate, gateRef } = useGuestGate();
  const [portalPosition, setPortalPosition] = useState<{ left: number; top: number } | null>(null);
  const open = activeGate?.id === gateId;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(closeGuestGate, 2800);
    return () => window.clearTimeout(timer);
  }, [closeGuestGate, open]);

  useLayoutEffect(() => {
    if (!open || !portal || !anchorRef?.current) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPortalPosition({ left: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150), top: rect.bottom + 8 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, open, portal]);

  if (!open) return null;
  const copyKey: Record<GuestGateVariant, "guestSeeMorePrefix" | "guestRatePrefix" | "guestListPrefix" | "guestRecommendPrefix" | "guestSignupPrefix" | "guestProfilePrefix" | "guestAvailabilityPrefix"> = { more: "guestSeeMorePrefix", rate: "guestRatePrefix", list: "guestListPrefix", recommend: "guestRecommendPrefix", signup: "guestSignupPrefix", profile: "guestProfilePrefix", availability: "guestAvailabilityPrefix" };
  const position = placement === "below" ? "left-1/2 top-full mt-2 -translate-x-1/2" : placement === "below-end" ? "right-0 top-full mt-2" : placement === "inline-end" ? "right-0 top-1/2 -translate-y-1/2" : "bottom-3 left-1/2 -translate-x-1/2";
  const content = <div ref={gateRef} role="status" style={portal && portalPosition ? { left: portalPosition.left, top: portalPosition.top } : undefined} className={`${portal ? "fixed -translate-x-1/2" : `absolute ${position}`} z-[300] flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#86ADE0]/30 bg-zinc-950/95 px-3 py-2 text-sm shadow-[0_12px_35px_rgba(0,0,0,.65)] backdrop-blur ${className}`}>
    {t(copyKey[activeGate.variant]) ? <span className="text-zinc-300">{t(copyKey[activeGate.variant])}</span> : null}
    <Link href="/signup" className="font-semibold text-[#a9c9ee] underline-offset-2 hover:underline">{t("guestSignUp")}</Link>
    <button type="button" aria-label={t("trailerClose")} onClick={closeGuestGate} className="ml-1 text-zinc-400 hover:text-white">×</button>
  </div>;
  if (portal) return portalPosition ? createPortal(content, document.body) : null;
  return content;
}
