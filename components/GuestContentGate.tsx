"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "../hooks/useI18n";

export default function GuestContentGate({ open, onClose, variant = "more" }: { open: boolean; onClose?: () => void; variant?: "more" | "rate" }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open || !onClose) return;
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [onClose, open]);
  if (!open) return null;
  const prefix = variant === "rate" ? (t("guestRate").replace(t("guestSignUp"), "").trim()) : (t("guestSeeMore").replace(t("guestSignUp"), "").trim());
  return <div role="status" className="absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#86ADE0]/30 bg-zinc-950/95 px-3 py-2 text-sm shadow-[0_12px_35px_rgba(0,0,0,.65)] backdrop-blur">
    <span className="text-zinc-300">{prefix}</span>
    <Link href="/signup" className="font-semibold text-[#a9c9ee] underline-offset-2 hover:underline">{t("guestSignUp")}</Link>
    {onClose ? <button type="button" aria-label={t("trailerClose")} onClick={onClose} className="ml-1 text-zinc-400 hover:text-white">×</button> : null}
  </div>;
}
