"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import type { VideoReactionComment, VideoReactionKind } from "../lib/video-reactions";
import VideoReactionMovieMetadata from "./VideoReactionMovieMetadata";

export default function MobileVideoReactionViewer({ video, movieTitle, moviePoster, reaction, onClose, onMovieOpen }: { video: VideoReactionComment; movieTitle: string; moviePoster: string | null; reaction: VideoReactionKind; onClose: () => void; onMovieOpen: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationStartedRef = useRef(false);
  const [muted, setMuted] = useState(true);
  const [counts, setCounts] = useState({ likes: video.likes_count, dislikes: video.dislikes_count, mine: video.my_reaction });
  const [showReaction, setShowReaction] = useState(false);
  const reactingRef = useRef(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!animationStartedRef.current) {
      animationStartedRef.current = true;
      const frame = requestAnimationFrame(() => setShowReaction(true));
      const timer = window.setTimeout(() => setShowReaction(false), 2200);
      return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); document.body.style.overflow = previousOverflow; };
    }
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const react = useCallback(async (nextReaction: VideoReactionKind) => {
    if (reactingRef.current) return;
    reactingRef.current = true;
    try {
      const response = await apiFetch(`/video-comments/${encodeURIComponent(String(video.id))}/reaction/`, { method: "PUT", body: JSON.stringify({ reaction: nextReaction }) }) as { likes_count?: number; dislikes_count?: number; my_reaction?: VideoReactionKind | null };
      setCounts({ likes: Number(response.likes_count ?? counts.likes), dislikes: Number(response.dislikes_count ?? counts.dislikes), mine: response.my_reaction ?? null });
    } finally { reactingRef.current = false; }
  }, [counts.dislikes, counts.likes, video.id]);

  return <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black p-2 lg:hidden" role="dialog" aria-modal="true" aria-label="Video reaction">
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="relative inline-flex max-h-[calc(100dvh-1rem)] max-w-full overflow-hidden">
        <video ref={videoRef} src={video.video_url} autoPlay muted={muted} playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="block max-h-[calc(100dvh-1rem)] max-w-full object-contain" onClick={(event) => { if (event.currentTarget.paused) void event.currentTarget.play(); else event.currentTarget.pause(); }} />
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1 bg-transparent text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
          {(["like", "dislike"] as const).map((kind) => <button key={kind} type="button" aria-label={kind} aria-pressed={counts.mine === kind} className={`rounded-full px-2 py-2 text-sm font-semibold ${counts.mine === kind ? kind === "like" ? "bg-emerald-500/25" : "bg-rose-500/25" : "bg-transparent"}`} onClick={() => void react(kind)}>{kind === "like" ? "👍" : "👎"} {kind === "like" ? counts.likes : counts.dislikes}</button>)}
        </div>
        <VideoReactionMovieMetadata poster={moviePoster} title={movieTitle} onTitleClick={onMovieOpen} />
        <button type="button" className="absolute right-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl text-white" aria-label="Close video" onClick={onClose}>×</button>
        <div className="absolute bottom-4 left-3 z-20 flex min-w-0 items-center gap-2 rounded-full bg-black/25 pr-2 text-sm font-semibold text-white"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[10px]">{video.user.avatar ? <img src={video.user.avatar} alt="" className="h-full w-full object-cover" /> : video.user.username.slice(0, 2).toUpperCase()}</span><span className="max-w-36 truncate">{video.user.username}</span></div>
        <button type="button" className="absolute bottom-4 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-xl text-white" aria-label={muted ? "Sound on" : "Mute"} onClick={() => { const next = !muted; setMuted(next); if (videoRef.current) videoRef.current.muted = next; }}>{muted ? "🔇" : "🔊"}</button>
        {showReaction ? <div className={`notification-video-reaction-overlay notification-video-reaction-overlay--${reaction}`} aria-hidden="true"><span>{reaction === "like" ? "👍" : "👎"}</span>{reaction === "like" ? <i className="notification-reaction-confetti">✦ · ✧ · ✦</i> : null}</div> : null}
      </div>
    </div>
  </div>;
}
