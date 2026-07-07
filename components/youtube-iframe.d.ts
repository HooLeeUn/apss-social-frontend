export {};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLIFrameElement,
        options: { events?: { onError?: () => void } },
      ) => unknown;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
