"use client";

import type { Locale } from "../lib/i18n";

interface TrailerHoverOverlayProps {
  loading?: boolean;
  unavailable?: boolean;
  locale: Locale;
}

export default function TrailerHoverOverlay({ loading = false, unavailable = false, locale }: TrailerHoverOverlayProps) {
  if (!loading && !unavailable) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-center bg-black/38 px-2 text-center backdrop-blur-[1px] md:flex">
      {loading ? (
        <div className="flex items-center gap-2 rounded-full border border-[#86ADE0]/60 bg-black/62 px-3 py-2 text-[#d7e8ff] shadow-[0_0_22px_rgba(47,155,255,0.28)] ring-1 ring-white/10">
          <span className="text-sm leading-none drop-shadow-[0_0_8px_rgba(134,173,224,0.75)]">▶</span>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#86ADE0]/35 border-t-[#86ADE0]" aria-hidden="true" />
        </div>
      ) : (
        <div className="rounded-full border border-[#86ADE0]/35 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-100/85 shadow-[0_0_14px_rgba(47,155,255,0.16)]">
          {locale === "en" ? "No trailer" : "Sin trailer"}
        </div>
      )}
    </div>
  );
}
