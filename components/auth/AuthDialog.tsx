"use client";

import { useEffect, useRef } from "react";

export default function AuthDialog({ title, message, closeLabel, onClose }: { title: string; message: string; closeLabel: string; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); previousFocusRef.current?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-6" aria-hidden="false">
    <div role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" aria-describedby="auth-dialog-description" className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
      <h2 id="auth-dialog-title" className="text-xl font-semibold text-zinc-50">{title}</h2>
      <p id="auth-dialog-description" className="mt-3 text-sm leading-6 text-zinc-300">{message}</p>
      <button ref={buttonRef} type="button" onClick={onClose} className="mt-6 w-full rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">{closeLabel}</button>
    </div>
  </div>;
}
