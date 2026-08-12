export {};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLIFrameElement,
        options: { events?: { onReady?: (event: { target: YouTubePlayer }) => void; onError?: () => void } },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }

  interface YouTubePlayer {
    isMuted(): boolean;
    mute(): void;
    pauseVideo(): void;
  }
}
