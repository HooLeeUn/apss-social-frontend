export {};

declare global {
  interface YouTubePlayerEvent {
    target: YouTubePlayer;
  }

  interface YouTubePlayerErrorEvent extends YouTubePlayerEvent {
    data: number;
  }

  interface YouTubePlayerStateChangeEvent extends YouTubePlayerEvent {
    data: number;
  }

  interface YouTubePlayer {
    destroy: () => void;
    mute: () => void;
    playVideo: () => void;
    stopVideo: () => void;
  }

  interface Window {
    YT?: {
      Player: new (
        element: HTMLIFrameElement,
        options: {
          events?: {
            onReady?: (event: YouTubePlayerEvent) => void;
            onStateChange?: (event: YouTubePlayerStateChangeEvent) => void;
            onError?: (event: YouTubePlayerErrorEvent) => void;
          };
        },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
