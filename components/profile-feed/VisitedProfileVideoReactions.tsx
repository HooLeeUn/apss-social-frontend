"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { apiFetch } from "../../lib/api";
import { formatProfileFeedRelativeDate, resolveMovieTitles } from "../../lib/i18n";
import type { ProfileFeedActivityMovie, VideoReactionActivityPayload } from "../../lib/profile-feed/types";

interface VideoReactionActivity {
  id: string | number;
  activity_type: string;
  actor?: { username?: string | null } | null;
  movie: ProfileFeedActivityMovie;
  timestamp?: string | null;
  created_at?: string | null;
  activity_at?: string | null;
  payload: VideoReactionActivityPayload;
}

interface ActivityPage {
  next: string | null;
  results: VideoReactionActivity[];
}

type VideoReaction = "like" | "dislike";

interface VideoReactionResponse {
  video_comment_id: string | number;
  my_reaction: VideoReaction | null;
  likes_count: number;
  dislikes_count: number;
}

const VISIBILITY_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];
const MIN_AUTOPLAY_VISIBILITY = 0.25;

function normalizeNextEndpoint(next: string): string {
  if (next.startsWith("http://") || next.startsWith("https://")) {
    const { pathname, search } = new URL(next);
    return `${pathname.replace(/^\/api(?=\/)/, "")}${search}`;
  }
  return next.replace(/^\/api(?=\/)/, "");
}

function getTimestamp(activity: VideoReactionActivity): string {
  return activity.timestamp || activity.activity_at || activity.created_at || "";
}

export default function VisitedProfileVideoReactions({ username }: { username: string }) {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<VideoReactionActivity[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const visibilityRatios = useRef(new Map<string, number>());
  const activeVideoId = useRef<string | null>(null);
  const reactingIds = useRef(new Set<string>());
  const [reacting, setReacting] = useState<Record<string, boolean>>({});

  const pauseAllExcept = useCallback((id: string | null) => {
    videoRefs.current.forEach((video, videoId) => {
      if (videoId !== id && !video.paused) video.pause();
    });
  }, []);

  const playMostVisibleVideo = useCallback(() => {
    let nextId: string | null = null;
    let nextRatio = MIN_AUTOPLAY_VISIBILITY;
    visibilityRatios.current.forEach((ratio, id) => {
      if (ratio >= nextRatio) {
        nextRatio = ratio;
        nextId = id;
      }
    });

    pauseAllExcept(nextId);
    activeVideoId.current = nextId;
    if (!nextId) return;
    const video = videoRefs.current.get(nextId);
    if (!video) return;
    // All observer-driven playback starts muted, which is required by WebKit/iOS.
    video.muted = true;
    const playPromise = video.play();
    if (playPromise) void playPromise.catch(() => {
      // Autoplay can still be denied by browser/user policy; native controls remain available.
    });
  }, [pauseAllExcept]);

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    const loadVideoReactions = async () => {
      setState("loading");
      setItems([]);
      const visitedEndpoints = new Set<string>();
      const initialEndpoint = `/users/${encodeURIComponent(username)}/video-reactions/`;

      try {
        visitedEndpoints.add(initialEndpoint);
        const firstPage = await apiFetch(initialEndpoint, { cache: "no-store", signal: abortController.signal }) as ActivityPage;
        if (!Array.isArray(firstPage?.results)) throw new Error("Invalid video reactions response.");

        if (!active) return;
        setItems(firstPage.results);
        setState("ready");

        let nextEndpoint = typeof firstPage.next === "string" && firstPage.next ? firstPage.next : null;
        if (!nextEndpoint) return;

        // Give React an opportunity to paint the first page before fetching more results.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        while (nextEndpoint) {
          const endpoint: string = normalizeNextEndpoint(nextEndpoint);
          if (visitedEndpoints.has(endpoint)) throw new Error("Video reactions pagination returned a repeated URL.");
          visitedEndpoints.add(endpoint);

          const page = await apiFetch(endpoint, { cache: "no-store", signal: abortController.signal }) as ActivityPage;
          if (!Array.isArray(page?.results)) throw new Error("Invalid video reactions response.");

          if (!active) return;
          setItems((currentItems) => [...currentItems, ...page.results]);
          nextEndpoint = typeof page.next === "string" && page.next ? page.next : null;
        }
      } catch (error) {
        if (!active || (error as Error).name === "AbortError") return;
        console.error("No se pudieron cargar las video reacciones del perfil visitado.", error);
        setState((currentState) => currentState === "loading" ? "error" : currentState);
      }
    };

    void loadVideoReactions();
    return () => {
      active = false;
      abortController.abort();
    };
  }, [username]);

  useEffect(() => {
    if (state !== "ready" || videoRefs.current.size === 0) return;
    const videos = videoRefs.current;
    const ratios = visibilityRatios.current;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = (entry.target as HTMLVideoElement).dataset.visitedProfileVideoId;
        if (id) visibilityRatios.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      playMostVisibleVideo();
    }, { threshold: VISIBILITY_THRESHOLDS });

    videos.forEach((video) => observer.observe(video));
    return () => {
      observer.disconnect();
      ratios.clear();
      activeVideoId.current = null;
      videos.forEach((video) => video.pause());
    };
  }, [items, playMostVisibleVideo, state]);

  const setVideoRef = useCallback((id: string, video: HTMLVideoElement | null) => {
    if (video) videoRefs.current.set(id, video);
    else videoRefs.current.delete(id);
  }, []);

  const reactToVideo = useCallback(async (itemId: string | number, commentId: string | number, reaction: VideoReaction) => {
    const key = String(commentId);
    if (reactingIds.current.has(key)) return;
    reactingIds.current.add(key);
    setReacting((current) => ({ ...current, [key]: true }));

    const previous = itemsRef.current.find((item) => String(item.id) === String(itemId));
    setItems((current) => current.map((item) => {
      if (String(item.id) !== String(itemId)) return item;
      const mine = item.payload.my_reaction ?? null;
      const next = mine === reaction ? null : reaction;
      const likes = Number(item.payload.likes_count ?? 0) + (mine === "like" ? -1 : 0) + (next === "like" ? 1 : 0);
      const dislikes = Number(item.payload.dislikes_count ?? 0) + (mine === "dislike" ? -1 : 0) + (next === "dislike" ? 1 : 0);
      return { ...item, payload: { ...item.payload, my_reaction: next, likes_count: Math.max(0, likes), dislikes_count: Math.max(0, dislikes) } };
    }));

    try {
      const result = await apiFetch(`/video-comments/${encodeURIComponent(key)}/reaction/`, {
        method: "PUT",
        body: JSON.stringify({ reaction }),
      }) as VideoReactionResponse;
      setItems((current) => current.map((item) => String(item.id) === String(itemId) ? {
        ...item,
        payload: { ...item.payload, my_reaction: result.my_reaction, likes_count: result.likes_count, dislikes_count: result.dislikes_count },
      } : item));
    } catch (error) {
      if (previous) setItems((current) => current.map((item) => String(item.id) === String(itemId) ? previous : item));
      console.error("No se pudo actualizar la reacción del video.", error);
    } finally {
      reactingIds.current.delete(key);
      setReacting((current) => ({ ...current, [key]: false }));
    }
  }, []);

  const updateNavigation = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    setCanScrollLeft(carousel.scrollLeft > 1);
    setCanScrollRight(carousel.scrollLeft + carousel.clientWidth < carousel.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateNavigation();
    window.addEventListener("resize", updateNavigation);
    return () => window.removeEventListener("resize", updateNavigation);
  }, [items, updateNavigation]);

  const scrollCarousel = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({ left: direction * Math.max(carousel.clientWidth * 0.85, 280), behavior: "smooth" });
  };

  const cards = useMemo(() => items.map((item) => {
    const title = resolveMovieTitles(locale, item.movie.title_spanish, item.movie.title_english).primary;
    const timestamp = getTimestamp(item);
    return { item, title, timestamp };
  }), [items, locale]);

  if (state === "loading") return <p className="text-sm text-zinc-400">{t("profileFeedLoading")}</p>;
  if (state === "error") return <p className="text-sm text-red-200">{t("visitedProfileVideoReactionsError")}</p>;
  if (cards.length === 0) return <p className="text-sm text-zinc-500">{t("visitedProfileNoVideoReactions")}</p>;

  return (
    <div className="relative">
      <button type="button" onClick={() => scrollCarousel(-1)} disabled={!canScrollLeft} aria-label={t("visitedProfilePreviousVideoReaction")} className="absolute left-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/70 bg-zinc-950/90 text-xl text-blue-200 shadow-lg disabled:border-zinc-700 disabled:text-zinc-700 xl:flex">←</button>
      <div ref={carouselRef} onScroll={updateNavigation} className="space-y-8 overflow-x-visible px-1 pb-4 xl:flex xl:snap-x xl:snap-mandatory xl:gap-4 xl:space-y-0 xl:overflow-x-auto xl:scroll-smooth xl:px-14 xl:pb-4 xl:[scrollbar-color:rgba(134,173,224,0.55)_rgba(39,39,42,0.75)] xl:[scrollbar-width:thin] xl:[&::-webkit-scrollbar]:h-2 xl:[&::-webkit-scrollbar-thumb]:rounded-full xl:[&::-webkit-scrollbar-thumb]:bg-blue-300/50 xl:[&::-webkit-scrollbar-track]:rounded-full xl:[&::-webkit-scrollbar-track]:bg-zinc-800/75">
        {cards.map(({ item, title, timestamp }) => {
          const commentId = item.payload.video_comment_id;
          const videoId = String(commentId ?? item.id);
          const reactionButtons = commentId !== undefined ? (
            <div className="flex shrink-0 items-center gap-1" data-visited-profile-video-reactions>
              {(["like", "dislike"] as const).map((reaction) => {
                const selected = item.payload.my_reaction === reaction;
                return <button key={reaction} type="button" disabled={!!reacting[videoId]} aria-label={t(reaction === "like" ? "movieDetailLike" : "movieDetailDislike")} aria-pressed={selected} className={`min-h-9 rounded-full px-2 py-1.5 text-sm font-semibold leading-none transition disabled:opacity-50 ${selected ? reaction === "like" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200" : "bg-black/35 text-white hover:bg-black/55"}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void reactToVideo(item.id, commentId, reaction); }}>
                  <span aria-hidden="true">{reaction === "like" ? "👍" : "👎"}</span> {reaction === "like" ? Number(item.payload.likes_count ?? 0) : Number(item.payload.dislikes_count ?? 0)}
                </button>;
              })}
            </div>
          ) : null;
          return (
          <article key={item.id} className="mx-auto w-full max-w-[22rem] space-y-3 xl:mx-0 xl:w-auto xl:max-w-none xl:shrink-0 xl:snap-start">
            <div className="flex min-h-14 items-center gap-3">
              <Link href={`/movies/${encodeURIComponent(String(item.movie.id))}`} className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.movie.image || "/brand/qnext-poster-placeholder.png"} alt={title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/movies/${encodeURIComponent(String(item.movie.id))}`} className="line-clamp-2 text-sm font-semibold text-zinc-100 hover:text-blue-200">{title}</Link>
                <time dateTime={timestamp} className="mt-0.5 block text-xs text-zinc-500">{formatProfileFeedRelativeDate(locale, timestamp)}</time>
              </div>
              <div className="xl:hidden">{reactionButtons}</div>
            </div>
            <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black shadow-[0_16px_35px_rgba(0,0,0,0.45)] xl:h-[clamp(260px,calc(100dvh-16rem),520px)] xl:w-auto">
              <video ref={(video) => setVideoRef(videoId, video)} data-visited-profile-video-id={videoId} src={item.payload.video_url} preload="auto" muted playsInline controls controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="h-full w-full object-contain" onPlay={() => { activeVideoId.current = videoId; pauseAllExcept(videoId); }} />
              <div className="pointer-events-none absolute left-2 top-2 z-10 hidden opacity-0 transition-opacity xl:flex xl:group-hover:pointer-events-auto xl:group-hover:opacity-100">{reactionButtons}</div>
            </div>
          </article>
          );
        })}
      </div>
      <button type="button" onClick={() => scrollCarousel(1)} disabled={!canScrollRight} aria-label={t("visitedProfileNextVideoReaction")} className="absolute right-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/70 bg-zinc-950/90 text-xl text-blue-200 shadow-lg disabled:border-zinc-700 disabled:text-zinc-700 xl:flex">→</button>
    </div>
  );
}
