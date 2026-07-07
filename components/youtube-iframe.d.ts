export {};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLIFrameElement,
        options: { events?: { onReady?: () => void; onError?: () => void } },
      ) => unknown;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
