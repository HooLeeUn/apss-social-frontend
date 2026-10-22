"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ActionsFloatingPanel from "./ActionsFloatingPanel";

export default function ActionsTruncatedText({ text, href, className, popoverLabel, as: Text = "p" }: { text: string; href?: string; className: string; popoverLabel?: string; as?: "p" | "span" }) {
  const anchorRef = useRef<HTMLElement>(null);
  const setAnchor = useCallback((element: HTMLElement | null) => { anchorRef.current = element; }, []);
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const close = useCallback(() => setOpen(false), []);
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

  const props = {
    ref: setAnchor,
    className,
    "aria-expanded": truncated ? open : undefined,
    "aria-label": truncated ? text : undefined,
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      if (isTruncated()) { event.preventDefault(); setOpen((value) => !value); }
    },
  };

  return <>
    {href ? <Link href={href} {...props}>{text}</Link> : <Text {...props} role={truncated ? "button" : undefined} tabIndex={truncated ? 0 : undefined} onKeyDown={(event) => {
      if (truncated && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setOpen((value) => !value); }
    }}>{text}</Text>}
    {open ? <ActionsFloatingPanel anchorRef={anchorRef} onClose={close} label={popoverLabel ?? (text.startsWith("@") ? "Username" : "Comentario")}><p className="max-w-[26rem] whitespace-pre-wrap">{text}</p></ActionsFloatingPanel> : null}
  </>;
}
