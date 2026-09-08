"use client";

import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";
const SERVICE_WORKER_SCOPE = "/";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const existingRegistration =
          await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);

        if (!existingRegistration) {
          await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
            scope: SERVICE_WORKER_SCOPE,
          });
        }
      } catch (error) {
        console.error("ReCCool service worker registration failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}
