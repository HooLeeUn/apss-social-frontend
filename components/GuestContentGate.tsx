"use client";

import GuestSignupRec from "./GuestSignupRec";
import { useI18n } from "../hooks/useI18n";

export default function GuestContentGate({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const { t } = useI18n();
  if (!open) return null;
  return <div role="dialog" aria-modal="false" className="absolute inset-x-3 bottom-3 z-50 flex items-center justify-center gap-3 rounded-2xl border border-red-500/35 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
    <GuestSignupRec compact />
    <span className="text-sm font-semibold text-zinc-100">{t("guestSeeMore")}</span>
    {onClose ? <button type="button" aria-label={t("trailerClose")} onClick={onClose} className="ml-1 text-zinc-400 hover:text-white">×</button> : null}
  </div>;
}
