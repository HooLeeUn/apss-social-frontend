"use client";

import { useEffect } from "react";

function preventCancelableGesture(event: Event) {
  if (event.cancelable) {
    event.preventDefault();
  }
}

function preventCancelableMultiTouch(event: TouchEvent) {
  if (event.touches.length > 1 && event.cancelable) {
    event.preventDefault();
  }
}

export default function IOSPinchZoomGuard() {
  useEffect(() => {
    const listenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: false,
    };

    document.addEventListener("gesturestart", preventCancelableGesture, listenerOptions);
    document.addEventListener("gesturechange", preventCancelableGesture, listenerOptions);
    document.addEventListener("touchmove", preventCancelableMultiTouch, listenerOptions);

    return () => {
      document.removeEventListener("gesturestart", preventCancelableGesture, listenerOptions);
      document.removeEventListener("gesturechange", preventCancelableGesture, listenerOptions);
      document.removeEventListener("touchmove", preventCancelableMultiTouch, listenerOptions);
    };
  }, []);

  return null;
}
