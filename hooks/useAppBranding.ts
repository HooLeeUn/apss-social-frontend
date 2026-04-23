"use client";

import { useEffect, useState } from "react";
import { AppBranding, fetchAppBranding } from "../lib/branding";

export function useAppBranding() {
  const [branding, setBranding] = useState<AppBranding | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadBranding = async () => {
      const payload = await fetchAppBranding(controller.signal);
      setBranding(payload);
    };

    void loadBranding();

    return () => controller.abort();
  }, []);

  return branding;
}
