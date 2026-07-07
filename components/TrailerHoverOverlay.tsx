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
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/38 px-2 text-center backdrop-blur-[1px]">
      {loading ? (
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[#86ADE0]/40 bg-black/68 text-[#d7e8ff] shadow-[0_0_24px_rgba(47,155,255,0.32)] ring-1 ring-white/10">
          <span className="absolute inset-0 rounded-full border-2 border-[#86ADE0]/25 border-t-[#86ADE0] [animation:spin_500ms_linear_1]" aria-hidden="true" />
          <span className="relative pl-0.5 text-lg leading-none drop-shadow-[0_0_10px_rgba(134,173,224,0.85)]">▶</span>
        </div>
      ) : (
        <div className="rounded-full border border-[#86ADE0]/35 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-100/85 shadow-[0_0_14px_rgba(47,155,255,0.16)]">
          {locale === "en" ? "No trailer" : "Sin trailer"}
        </div>
      )}
    </div>
  );
}
