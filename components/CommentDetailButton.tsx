"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface CommentDetailButtonProps {
  title: string;
  synopsis?: string | null;
  synopsisEs?: string | null;
  className?: string;
  popoverClassName?: string;
}

const SYNOPSIS_FALLBACK = "Sinopsis próximamente.";

function resolveSynopsis(synopsisEs?: string | null, synopsis?: string | null): string {
  return synopsisEs?.trim() || synopsis?.trim() || SYNOPSIS_FALLBACK;
}

export default function CommentDetailButton({ title, synopsis, synopsisEs, className = "", popoverClassName = "" }: CommentDetailButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const synopsisText = resolveSynopsis(synopsisEs, synopsis);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const width = Math.min(320, Math.max(240, window.innerWidth - 32));
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 16), window.innerWidth - width - 16);
      const hasRoomBelow = rect.bottom + 220 <= window.innerHeight;
      const top = hasRoomBelow ? rect.bottom + 10 : Math.max(16, rect.top - 230);

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Ver sinopsis de ${title}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        className={`inline-flex h-9 w-9 items-center justify-center p-1.5 text-zinc-200/90 transition-all duration-200 hover:scale-[1.04] hover:text-zinc-50 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.2)] focus-visible:outline-none focus-visible:text-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`.trim()}
      >
        <CommentBubbleIcon />
      </button>
      {isOpen
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="dialog"
              aria-label={`Sinopsis de ${title}`}
              className={`fixed z-[1000] max-h-56 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto synopsis-popover-scrollbar rounded-xl border border-white/15 bg-zinc-950/95 p-4 text-sm leading-relaxed text-zinc-100 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-md ${popoverClassName}`.trim()}
              style={{ top: position.top, left: position.left }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/80">Sinopsis</p>
              <p className="whitespace-pre-line text-zinc-200">{synopsisText}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function CommentBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17.4c-2 0-3.6-1.5-3.6-3.5V7.8C3.4 5.8 5 4.2 7 4.2h10c2 0 3.6 1.6 3.6 3.6V14c0 2-1.6 3.5-3.6 3.5h-5.2L8 20.8v-3.4H7Z" />
    </svg>
  );
}
