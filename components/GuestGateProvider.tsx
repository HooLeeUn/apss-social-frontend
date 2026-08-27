"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type GuestGateVariant = "more" | "rate" | "list" | "recommend";
type ActiveGate = { id: string; variant: GuestGateVariant } | null;
type GuestGateContextValue = {
  activeGate: ActiveGate;
  showGuestGate: (id: string, variant: GuestGateVariant) => void;
  closeGuestGate: () => void;
  gateRef: React.RefObject<HTMLDivElement | null>;
};

const GuestGateContext = createContext<GuestGateContextValue | null>(null);

export default function GuestGateProvider({ children }: { children: React.ReactNode }) {
  const [activeGate, setActiveGate] = useState<ActiveGate>(null);
  const gateRef = useRef<HTMLDivElement | null>(null);
  const showGuestGate = useCallback((id: string, variant: GuestGateVariant) => setActiveGate((current) => current?.id === id && current.variant === variant ? current : { id, variant }), []);
  const closeGuestGate = useCallback(() => setActiveGate(null), []);

  useEffect(() => {
    if (!activeGate) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && gateRef.current?.contains(event.target)) return;
      closeGuestGate();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [activeGate, closeGuestGate]);

  const value = useMemo(() => ({ activeGate, showGuestGate, closeGuestGate, gateRef }), [activeGate, closeGuestGate, showGuestGate]);
  return <GuestGateContext.Provider value={value}>{children}</GuestGateContext.Provider>;
}

export function useGuestGate() {
  const context = useContext(GuestGateContext);
  if (!context) throw new Error("useGuestGate must be used within GuestGateProvider");
  return context;
}
