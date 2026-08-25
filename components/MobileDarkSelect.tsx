"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface MobileDarkSelectOption<T extends string> { value: T; label: string }

interface Props<T extends string> {
  value: T;
  options: readonly MobileDarkSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  selectedIcon?: ReactNode;
}

export default function MobileDarkSelect<T extends string>({ value, options, onChange, ariaLabel, disabled = false, className = "", selectedIcon }: Props<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const previous = { position: document.body.style.position, top: document.body.style.top, left: document.body.style.left, right: document.body.style.right, width: document.body.style.width, overflow: document.body.style.overflow };
    Object.assign(document.body.style, { position: "fixed", top: `-${scrollY}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      Object.assign(document.body.style, previous);
      window.scrollTo(0, scrollY);
    };
  }, [open, options, value]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const last = options.length - 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowDown" ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
    optionRefs.current[next]?.focus();
  };

  return <>
    <button ref={triggerRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listboxId : undefined} onClick={() => setOpen(true)} className={`relative xl:hidden ${className}`}>
      <span className="inline-flex items-center gap-2">{selectedIcon}<span>{selectedOption?.label}</span></span><span aria-hidden="true" className="ml-3 text-xs text-zinc-300">▾</span>
    </button>
    {open ? createPortal(
      <div className="fixed inset-0 z-[200] flex items-end justify-center xl:hidden" role="presentation">
        <button type="button" className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-[2px]" onClick={close} aria-label="Close" />
        <div className="relative z-[201] w-full max-w-lg rounded-t-3xl border border-b-0 border-zinc-700 bg-zinc-950 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.7)]">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-600" />
          <div id={listboxId} role="listbox" aria-label={ariaLabel} className="scrollbar-dark max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto overscroll-contain">
            {options.map((option, index) => { const selected = option.value === value; return (
              <button key={option.value} ref={(node) => { optionRefs.current[index] = node; }} type="button" role="option" aria-selected={selected} onKeyDown={(event) => handleKeyDown(event, index)} onClick={() => { onChange(option.value); close(); }} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${selected ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-transparent bg-zinc-900/70 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-800"}`}>
                <span>{option.label}</span><span aria-hidden="true" className={`ml-4 flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-violet-400 bg-violet-500 text-white" : "border-zinc-600"}`}>{selected ? "✓" : ""}</span>
              </button>
            ); })}
          </div>
        </div>
      </div>, document.body) : null}
  </>;
}
