"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ActionsFloatingPanel from "./ActionsFloatingPanel";

export default function ActionsTruncatedText({ text, href, className, popoverLabel, as: Text = "p", revealOnHover = false }: { text: string; href?: string; className: string; popoverLabel?: string; as?: "p" | "span"; revealOnHover?: boolean }) {
  const anchorRef = useRef<HTMLElement>(null);
  const setAnchor = useCallback((element: HTMLElement | null) => { anchorRef.current = element; }, []);
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInside = useRef(false);
  const keyboardFocused = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const close = useCallback(() => {
    cancelClose();
    pointerInside.current = false;
    keyboardFocused.current = false;
    setOpen(false);
  }, [cancelClose]);
  const scheduleClose = () => {
    cancelClose();
    // Allow crossing the existing six-pixel gap between the text and its panel.
    closeTimer.current = setTimeout(() => {
      if (!pointerInside.current && !keyboardFocused.current) close();
    }, 180);
  };
  const isTruncated = () => {
    const element = anchorRef.current;
    return Boolean(element && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1));
  };

  useEffect(() => {
    const element = anchorRef.current;
    if (!element) return;
    const measure = () => setTruncated(isTruncated());
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    document.fonts.addEventListener("loadingdone", measure);
    return () => { observer.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
  }, [text]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  const hoverProps = revealOnHover ? {
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      pointerInside.current = true;
      cancelClose();
      if (isTruncated()) setOpen(true);
    },
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerInside.current = false;
      scheduleClose();
    },
  } : {};

  const props = {
    ref: setAnchor,
    className,
    ...hoverProps,
    onPointerDown: revealOnHover ? (event: React.PointerEvent) => {
      pointerStart.current = { x: event.clientX, y: event.clientY };
      dragged.current = false;
    } : undefined,
    onPointerMove: revealOnHover ? (event: React.PointerEvent) => {
      const start = pointerStart.current;
      if (event.pointerType !== "mouse" && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) dragged.current = true;
    } : undefined,
    onPointerCancel: revealOnHover ? () => { dragged.current = true; } : undefined,
    onFocus: revealOnHover ? (event: React.FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.matches(":focus-visible")) return;
      keyboardFocused.current = true;
      cancelClose();
      if (isTruncated()) setOpen(true);
    } : undefined,
    onBlur: revealOnHover ? () => { keyboardFocused.current = false; scheduleClose(); } : undefined,
    "aria-expanded": truncated ? open : undefined,
    "aria-label": truncated ? text : undefined,
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      if (revealOnHover && dragged.current) { event.preventDefault(); return; }
      if (isTruncated()) { event.preventDefault(); cancelClose(); setOpen((value) => !value); }
    },
  };

  return <>
    {href ? <Link href={href} {...props}>{text}</Link> : <Text {...props} role={truncated ? "button" : undefined} tabIndex={truncated ? 0 : undefined} onKeyDown={(event) => {
      if (truncated && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setOpen((value) => !value); }
    }}>{text}</Text>}
    {open ? <ActionsFloatingPanel anchorRef={anchorRef} onClose={close} {...hoverProps} onMouseDown={revealOnHover ? (event) => event.stopPropagation() : undefined} label={popoverLabel ?? (text.startsWith("@") ? "Username" : "Comentario")}><p className="max-w-[26rem] whitespace-pre-wrap">{text}</p></ActionsFloatingPanel> : null}
  </>;
}
