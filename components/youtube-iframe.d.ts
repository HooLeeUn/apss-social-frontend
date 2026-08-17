export {};

declare global {
  interface Window {
    YT?: {
      PlayerState: {
        ENDED: number;
      };
      Player: new (
        element: HTMLIFrameElement,
        options: { events?: { onReady?: (event: { target: YouTubePlayer }) => void; onError?: () => void; onStateChange?: (event: { data: number; target: YouTubePlayer }) => void } },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }

  interface YouTubePlayer {
    isMuted(): boolean;
    mute(): void;
    unMute(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
  }
}
