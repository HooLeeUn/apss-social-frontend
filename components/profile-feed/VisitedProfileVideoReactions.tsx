"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useI18n } from "../../hooks/useI18n";
import { apiFetch } from "../../lib/api";
import { formatProfileFeedRelativeDate, resolveMovieTitles } from "../../lib/i18n";
import type { ProfileFeedActivityMovie, VideoReactionActivityPayload } from "../../lib/profile-feed/types";
import { useDesktopGuest } from "../../hooks/useDesktopGuest";
import { useGuestGate } from "../GuestGateProvider";

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

function VisitedProfileVideoPlayer({ src, muted, autoPlay = false, interactive = true, showMuteControl = true, className, onRegister, onPlay, onEnded, onMutedChange, onManualToggle, onLoadedData }: { src?: string; muted: boolean; autoPlay?: boolean; interactive?: boolean; showMuteControl?: boolean; className: string; onRegister: (video: HTMLVideoElement | null) => void; onPlay?: () => void; onEnded?: () => void; onMutedChange: (muted: boolean) => void; onManualToggle?: (paused: boolean) => void; onLoadedData?: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<"play" | "pause" | null>(null);
  const registerVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    onRegister(video);
  }, [onRegister]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    const willPlay = video.paused;
    if (willPlay) void video.play().catch(() => {});
    else video.pause();
    onManualToggle?.(!willPlay);
    setFeedback(willPlay ? "play" : "pause");
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 450);
  };

  return <>
    <video ref={registerVideo} src={src} autoPlay={autoPlay} preload="auto" muted={muted} playsInline controls={false} disablePictureInPicture disableRemotePlayback className={`${className} ${interactive ? "cursor-pointer" : "pointer-events-none"}`} onClick={interactive ? togglePlayback : undefined} onLoadedData={onLoadedData} onPlay={onPlay} onEnded={onEnded} onVolumeChange={(event) => onMutedChange(event.currentTarget.muted)} />
    {feedback ? <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-xl text-white transition-opacity">{feedback === "play" ? "▶" : "❚❚"}</span> : null}
    {showMuteControl ? <button type="button" data-video-mute-control className="absolute bottom-2 left-2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-md hover:bg-black/70" aria-label={muted ? "Unmute" : "Mute"} onClick={(event) => { event.stopPropagation(); onMutedChange(!muted); }}>{muted ? "🔇" : "🔊"}</button> : null}
  </>;
}

export default function VisitedProfileVideoReactions({ username, isActive, guestGateId: providedGuestGateId }: { username: string; isActive: boolean; guestGateId?: string }) {
  const { isDesktopGuest } = useDesktopGuest();
  const { locale, t } = useI18n();
  const [items, setItems] = useState<VideoReactionActivity[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { showGuestGate } = useGuestGate();
  const guestGateId = providedGuestGateId ?? `profile-video-reactions:${username}`;
  const [guestVisibleCount, setGuestVisibleCount] = useState<number | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const visibilityRatios = useRef(new Map<string, number>());
  const activeVideoId = useRef<string | null>(null);
  const manuallyPausedVideoId = useRef<string | null>(null);
  const isVideoTabActive = useRef(isActive);
  isVideoTabActive.current = isActive;
  const resumeAfterInterruption = useRef<{ videoId: string | null; expanded: boolean; wasPlaying: boolean } | null>(null);
  const activeVideoIndex = useRef(0);
  const desktopSequenceStarted = useRef(false);
  const desktopAdvancePending = useRef<number | null>(null);
  const reactingIds = useRef(new Set<string>());
  const [reacting, setReacting] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const expandedIndexRef = useRef<number | null>(expandedIndex);
  expandedIndexRef.current = expandedIndex;
  const expandedVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenViewerRef = useRef<HTMLDivElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeTimer = useRef<number | null>(null);
  const adjacentVideoRefs = useRef(new Map<number, HTMLVideoElement>());
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeAnimating, setSwipeAnimating] = useState(false);

  const pauseAllExcept = useCallback((id: string | null) => {
    videoRefs.current.forEach((video, videoId) => {
      if (videoId !== id && !video.paused) video.pause();
    });
  }, []);

  const playMostVisibleVideo = useCallback(() => {
    if (!isVideoTabActive.current || document.hidden) {
      pauseAllExcept(null);
      return;
    }
    if (expandedIndexRef.current !== null) {
      pauseAllExcept(null);
      return;
    }
    const desktop = window.matchMedia("(min-width: 1280px)").matches;
    let nextId: string | null = null;
    let nextIndex = -1;
    if (desktop) {
      const currentItem = itemsRef.current[activeVideoIndex.current];
      const currentId = currentItem ? String(currentItem.payload.video_comment_id ?? currentItem.id) : null;
      if (desktopAdvancePending.current === activeVideoIndex.current && currentId) {
        nextId = currentId;
        nextIndex = activeVideoIndex.current;
        if ((visibilityRatios.current.get(currentId) ?? 0) >= MIN_AUTOPLAY_VISIBILITY) desktopAdvancePending.current = null;
      } else if (!desktopSequenceStarted.current) {
        const firstItem = itemsRef.current[0];
        const firstId = firstItem ? String(firstItem.payload.video_comment_id ?? firstItem.id) : null;
        if (firstId && (visibilityRatios.current.get(firstId) ?? 0) >= MIN_AUTOPLAY_VISIBILITY) {
          nextId = firstId;
          nextIndex = 0;
          desktopSequenceStarted.current = true;
        }
      } else if (currentId && (visibilityRatios.current.get(currentId) ?? 0) >= MIN_AUTOPLAY_VISIBILITY) {
        nextId = currentId;
        nextIndex = activeVideoIndex.current;
      } else {
        nextIndex = itemsRef.current.findIndex((item) => (visibilityRatios.current.get(String(item.payload.video_comment_id ?? item.id)) ?? 0) >= MIN_AUTOPLAY_VISIBILITY);
        if (nextIndex >= 0) nextId = String(itemsRef.current[nextIndex].payload.video_comment_id ?? itemsRef.current[nextIndex].id);
      }
    } else {
      let nextRatio = MIN_AUTOPLAY_VISIBILITY;
      visibilityRatios.current.forEach((ratio, id) => {
        if (ratio > nextRatio || (ratio === nextRatio && nextId === null)) {
          nextRatio = ratio;
          nextId = id;
        }
      });
    }

    pauseAllExcept(nextId);
    if (desktop && nextIndex >= 0) activeVideoIndex.current = nextIndex;
    activeVideoId.current = nextId;
    if (!nextId) return;
    if (manuallyPausedVideoId.current === nextId) return;
    manuallyPausedVideoId.current = null;
    const video = videoRefs.current.get(nextId);
    if (!video) return;
    video.muted = isMutedRef.current;
    const playPromise = video.play();
    if (playPromise) void playPromise.catch(() => {
      // Autoplay can still be denied by browser/user policy; native controls remain available.
    });
  }, [pauseAllExcept]);

  const pauseForInterruption = useCallback(() => {
    const expanded = expandedVideoRef.current;
    const activeId = activeVideoId.current;
    const active = activeId ? videoRefs.current.get(activeId) : null;
    if (expanded && !expanded.paused) resumeAfterInterruption.current = { videoId: null, expanded: true, wasPlaying: true };
    else if (active && !active.paused && activeId) resumeAfterInterruption.current = { videoId: activeId, expanded: false, wasPlaying: true };
    expanded?.pause();
    pauseAllExcept(null);
  }, [pauseAllExcept]);

  const resumeAfterVisibility = useCallback(() => {
    if (!isVideoTabActive.current || document.hidden) return;
    const resume = resumeAfterInterruption.current;
    if (!resume?.wasPlaying) return;
    if (resume.expanded) {
      const expanded = expandedVideoRef.current;
      if (!expanded) return;
      resumeAfterInterruption.current = null;
      expanded.muted = isMutedRef.current;
      void expanded.play().catch(() => {});
      return;
    }
    if (!resume.videoId || manuallyPausedVideoId.current === resume.videoId) return;
    const video = videoRefs.current.get(resume.videoId);
    if (!video) return;
    pauseAllExcept(resume.videoId);
    video.muted = isMutedRef.current;
    activeVideoId.current = resume.videoId;
    resumeAfterInterruption.current = null;
    void video.play().catch(() => {});
  }, [pauseAllExcept]);

  useLayoutEffect(() => {
    if (!isActive) pauseForInterruption();
    else resumeAfterVisibility();
  }, [isActive, pauseForInterruption, resumeAfterVisibility]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) pauseForInterruption();
      else resumeAfterVisibility();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pauseForInterruption, resumeAfterVisibility]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.muted = isMuted;
    });
    if (expandedVideoRef.current) expandedVideoRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    const loadVideoReactions = async () => {
      setState("loading");
      setItems([]);
      activeVideoIndex.current = 0;
      desktopSequenceStarted.current = false;
      desktopAdvancePending.current = null;
      activeVideoId.current = null;
      manuallyPausedVideoId.current = null;
      resumeAfterInterruption.current = null;
      setIsMuted(true);
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

  const playNextDesktopVideo = useCallback((index: number) => {
    if (!window.matchMedia("(min-width: 1280px)").matches || expandedIndexRef.current !== null) return;
    const nextIndex = itemsRef.current.length > 0 ? (index + 1) % itemsRef.current.length : -1;
    if (isDesktopGuest && guestVisibleCount !== null && nextIndex >= guestVisibleCount) return;
    const nextItem = itemsRef.current[nextIndex];
    if (!nextItem) return;
    const nextId = String(nextItem.payload.video_comment_id ?? nextItem.id);
    const nextVideo = videoRefs.current.get(nextId);
    if (!nextVideo) return;
    activeVideoIndex.current = nextIndex;
    desktopAdvancePending.current = nextIndex;
    pauseAllExcept(nextId);
    if (!isDesktopGuest) nextVideo.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    nextVideo.muted = isMutedRef.current;
    if (nextVideo.ended) nextVideo.currentTime = 0;
    const playPromise = nextVideo.play();
    if (playPromise) void playPromise.catch(() => {});
  }, [guestVisibleCount, isDesktopGuest, pauseAllExcept]);

  const reactToVideo = useCallback(async (itemId: string | number, commentId: string | number, reaction: VideoReaction) => {
    if (isDesktopGuest) return;
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
  }, [isDesktopGuest]);

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
    if (isDesktopGuest && direction === 1) { showGuestGate(guestGateId, "more"); return; }
    carousel.scrollBy({ left: direction * Math.max(carousel.clientWidth * 0.85, 280), behavior: "smooth" });
  };

  const cards = useMemo(() => items.map((item) => {
    const title = resolveMovieTitles(locale, item.movie.title_spanish, item.movie.title_english).primary;
    const timestamp = getTimestamp(item);
    return { item, title, timestamp };
  }), [items, locale]);

  useLayoutEffect(() => {
    if (!isDesktopGuest || !carouselRef.current) { setGuestVisibleCount(null); return; }
    const carousel = carouselRef.current;
    const measure = () => {
      const boundary = carousel.getBoundingClientRect().right + 1;
      setGuestVisibleCount([...carousel.children].filter((child) => child.getBoundingClientRect().left < boundary).length);
      carousel.scrollLeft = 0;
    };
    measure(); window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cards.length, isDesktopGuest]);

  const openExpandedViewer = useCallback((index: number) => {
    if (isDesktopGuest) { showGuestGate(guestGateId, "more"); return; }
    pauseAllExcept(null);
    expandedIndexRef.current = index;
    if (window.matchMedia("(min-width: 1280px)").matches) {
      flushSync(() => setExpandedIndex(index));
      const viewer = fullscreenViewerRef.current;
      if (viewer) void viewer.requestFullscreen().catch(() => {});
    } else {
      setExpandedIndex(index);
    }
  }, [guestGateId, isDesktopGuest, pauseAllExcept, showGuestGate]);

  const closeExpandedViewer = useCallback(() => {
    expandedVideoRef.current?.pause();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    expandedVideoRef.current = null;
    expandedIndexRef.current = null;
    setExpandedIndex(null);
    requestAnimationFrame(() => playMostVisibleVideo());
  }, [playMostVisibleVideo]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (expandedIndexRef.current !== null && window.matchMedia("(min-width: 1280px)").matches && document.fullscreenElement !== fullscreenViewerRef.current) closeExpandedViewer();
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [closeExpandedViewer]);

  const navigateExpandedViewer = useCallback((direction: -1 | 1) => {
    setExpandedIndex((current) => {
      if (current === null) return null;
      const next = current + direction;
      if (next < 0 || next >= itemsRef.current.length) return current;
      expandedVideoRef.current?.pause();
      expandedIndexRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (expandedIndex === null) return;
    pauseAllExcept(null);
    const video = expandedVideoRef.current;
    if (video) {
      video.muted = isMutedRef.current;
      const playPromise = video.play();
      if (playPromise) void playPromise.catch(() => {});
    }
  }, [expandedIndex, pauseAllExcept]);

  useEffect(() => {
    if (expandedIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeExpandedViewer();
      else if (event.key === "ArrowLeft") navigateExpandedViewer(-1);
      else if (event.key === "ArrowRight") navigateExpandedViewer(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (swipeTimer.current !== null) window.clearTimeout(swipeTimer.current);
    };
  }, [closeExpandedViewer, expandedIndex, navigateExpandedViewer]);

  if (state === "loading") return <p className="text-sm text-zinc-400">{t("profileFeedLoading")}</p>;
  if (state === "error") return <p className="text-sm text-red-200">{t("visitedProfileVideoReactionsError")}</p>;
  if (cards.length === 0) return <p className="text-sm text-zinc-500">{t("visitedProfileNoVideoReactions")}</p>;

  return (
    <div className="relative">
      <button type="button" onClick={() => scrollCarousel(-1)} disabled={!canScrollLeft} aria-label={t("visitedProfilePreviousVideoReaction")} className="absolute left-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/70 bg-zinc-950/90 text-xl text-blue-200 shadow-lg disabled:border-zinc-700 disabled:text-zinc-700 xl:flex">←</button>
      <div ref={carouselRef} tabIndex={isDesktopGuest ? 0 : undefined} onWheel={(event) => { if (isDesktopGuest && (event.deltaX > 0 || (event.shiftKey && event.deltaY > 0))) { event.preventDefault(); showGuestGate(guestGateId, "more"); } }} onKeyDown={(event) => { if (isDesktopGuest && ["ArrowRight", "End", "PageDown"].includes(event.key)) { event.preventDefault(); showGuestGate(guestGateId, "more"); } }} onScroll={() => { if (isDesktopGuest && carouselRef.current && carouselRef.current.scrollLeft > 1) { carouselRef.current.scrollLeft = 0; showGuestGate(guestGateId, "more"); } updateNavigation(); }} className="space-y-8 overflow-x-visible px-1 pb-4 xl:flex xl:snap-x xl:snap-mandatory xl:gap-4 xl:space-y-0 xl:overflow-x-auto xl:scroll-smooth xl:px-14 xl:pb-4 xl:[scrollbar-color:rgba(134,173,224,0.55)_rgba(39,39,42,0.75)] xl:[scrollbar-width:thin] xl:[&::-webkit-scrollbar]:h-2 xl:[&::-webkit-scrollbar-thumb]:rounded-full xl:[&::-webkit-scrollbar-thumb]:bg-blue-300/50 xl:[&::-webkit-scrollbar-track]:rounded-full xl:[&::-webkit-scrollbar-track]:bg-zinc-800/75">
        {cards.map(({ item, title, timestamp }, index) => {
          const commentId = item.payload.video_comment_id;
          const videoId = String(commentId ?? item.id);
          const reactionButtons = commentId !== undefined ? (
            <div className="flex shrink-0 items-center gap-1" data-visited-profile-video-reactions>
              {(["like", "dislike"] as const).map((reaction) => {
                const selected = item.payload.my_reaction === reaction;
                return <button key={reaction} type="button" disabled={isDesktopGuest || !!reacting[videoId]} aria-label={t(reaction === "like" ? "movieDetailLike" : "movieDetailDislike")} aria-pressed={selected} className={`min-h-9 rounded-full px-2 py-1.5 text-sm font-semibold leading-none transition disabled:opacity-50 ${selected ? reaction === "like" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200" : "bg-black/35 text-white hover:bg-black/55"}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void reactToVideo(item.id, commentId, reaction); }}>
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
              <div data-visited-profile-video-id={videoId} className="relative h-full w-full">
                <VisitedProfileVideoPlayer src={item.payload.video_url} muted={isMuted} className="h-full w-full object-contain" onRegister={(video) => { if (video) video.dataset.visitedProfileVideoId = videoId; setVideoRef(videoId, video); }} onPlay={() => { activeVideoId.current = videoId; activeVideoIndex.current = index; pauseAllExcept(videoId); }} onEnded={() => playNextDesktopVideo(index)} onMutedChange={setIsMuted} onManualToggle={(paused) => { manuallyPausedVideoId.current = paused ? videoId : null; }} />
              </div>
              <div className="pointer-events-none absolute left-2 top-2 z-10 hidden opacity-0 transition-opacity xl:flex xl:group-hover:pointer-events-auto xl:group-hover:opacity-100">{reactionButtons}</div>
              <button type="button" aria-label={t("movieDetailVideoExpand")} className="absolute bottom-2 right-2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-lg text-white hover:bg-black/80" onClick={(event) => { event.stopPropagation(); openExpandedViewer(index); }}>⛶</button>
            </div>
          </article>
          );
        })}
      </div>
      <button type="button" onClick={() => scrollCarousel(1)} disabled={!canScrollRight} aria-label={t("visitedProfileNextVideoReaction")} className="absolute right-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/70 bg-zinc-950/90 text-xl text-blue-200 shadow-lg disabled:border-zinc-700 disabled:text-zinc-700 xl:flex">→</button>
      {expandedIndex !== null && cards[expandedIndex] ? (() => {
        const { item, title } = cards[expandedIndex];
        const commentId = item.payload.video_comment_id;
        const videoId = String(commentId ?? item.id);
        const expandedReactions = commentId !== undefined ? (["like", "dislike"] as const).map((reaction) => {
          const selected = item.payload.my_reaction === reaction;
          return <button key={reaction} type="button" disabled={!!reacting[videoId]} aria-label={t(reaction === "like" ? "movieDetailLike" : "movieDetailDislike")} aria-pressed={selected} className={`min-h-10 rounded-full px-2.5 py-2 text-sm font-semibold leading-none disabled:opacity-50 xl:min-h-9 xl:px-2 xl:py-1 xl:text-xs xl:shadow-md ${selected ? reaction === "like" ? "bg-emerald-500/25 text-emerald-100" : "bg-rose-500/25 text-rose-100" : "bg-black/30 text-white hover:bg-black/45"}`} onClick={() => void reactToVideo(item.id, commentId, reaction)}><span aria-hidden="true">{reaction === "like" ? "👍" : "👎"}</span> {reaction === "like" ? Number(item.payload.likes_count ?? 0) : Number(item.payload.dislikes_count ?? 0)}</button>;
        }) : null;
        const previousItem = expandedIndex > 0 ? cards[expandedIndex - 1]?.item : null;
        const nextItem = expandedIndex < cards.length - 1 ? cards[expandedIndex + 1]?.item : null;
        const expandedSlideIndices = [expandedIndex - 1, expandedIndex, expandedIndex + 1].filter((index) => index >= 0 && index < cards.length);
        return <div ref={fullscreenViewerRef} role="dialog" aria-modal="true" aria-label={title} data-visited-profile-expanded-viewer className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-black p-3 text-white touch-none xl:p-0" onTouchStart={(event) => {
          const target = event.target as HTMLElement;
          const touch = event.changedTouches[0];
          if (!touch || target.closest("button, a") || (target instanceof HTMLVideoElement && touch.clientY >= target.getBoundingClientRect().bottom - 72)) {
            swipeStart.current = null;
            return;
          }
          swipeStart.current = { x: touch.clientX, y: touch.clientY };
          setSwipeAnimating(false);
        }} onTouchMove={(event) => {
          const start = swipeStart.current;
          const touch = event.changedTouches[0];
          if (!start || !touch) return;
          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          if (Math.abs(deltaY) <= Math.abs(deltaX)) return;
          event.preventDefault();
          const canMove = deltaY < 0 ? Boolean(nextItem) : Boolean(previousItem);
          setSwipeOffset(canMove ? Math.max(-window.innerHeight, Math.min(window.innerHeight, deltaY)) : deltaY * 0.18);
        }} onTouchEnd={(event) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          const touch = event.changedTouches[0];
          if (!start || !touch) { setSwipeAnimating(true); setSwipeOffset(0); return; }
          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          const direction = deltaY < 0 ? 1 : -1;
          const canNavigate = direction === 1 ? Boolean(nextItem) : Boolean(previousItem);
          setSwipeAnimating(true);
          if (Math.abs(deltaY) < 60 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.25 || !canNavigate) {
            setSwipeOffset(0);
            return;
          }
          const targetIndex = expandedIndex + direction;
          const targetVideo = adjacentVideoRefs.current.get(targetIndex);
          let snapStarted = false;
          const startSnap = () => {
            if (snapStarted) return;
            snapStarted = true;
            setSwipeOffset(direction === 1 ? -window.innerHeight : window.innerHeight);
            swipeTimer.current = window.setTimeout(() => {
              navigateExpandedViewer(direction);
              setSwipeAnimating(false);
              setSwipeOffset(0);
            }, 260);
          };
          if (targetVideo && targetVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) startSnap();
          else {
            targetVideo?.addEventListener("loadeddata", startSnap, { once: true });
            window.setTimeout(startSnap, 600);
          }
        }}>
          <div className="relative flex min-h-0 flex-1 items-center justify-center py-3 xl:p-0">
            <button type="button" disabled={expandedIndex === 0} aria-label={t("visitedProfilePreviousVideoReaction")} className="absolute left-2 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-zinc-900/85 text-2xl disabled:invisible xl:flex" onClick={() => navigateExpandedViewer(-1)}>←</button>
            <div className="relative flex h-full w-full max-h-full max-w-full flex-col items-center justify-center xl:h-[100dvh] xl:w-[min(56.25dvh,100dvw)] xl:max-h-full" style={{ transform: `translateY(${swipeOffset}px)`, transition: swipeAnimating ? "transform 260ms ease-out" : "none" }}>
              <header className="relative z-10 flex min-h-14 w-full items-center gap-2 rounded-xl bg-zinc-950/90 p-2 xl:absolute xl:inset-x-0 xl:top-0 xl:min-h-0 xl:rounded-none xl:bg-transparent xl:p-3 xl:[text-shadow:0_1px_4px_rgb(0_0_0/0.95)]">
                <div className="flex shrink-0 gap-1 xl:flex-col">{expandedReactions}</div>
                <Link href={`/movies/${encodeURIComponent(String(item.movie.id))}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 xl:max-w-md xl:gap-2" onClick={() => { expandedVideoRef.current?.pause(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.movie.image || "/brand/qnext-poster-placeholder.png"} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover xl:h-11 xl:w-8" />
                  <span className="line-clamp-2 min-w-0 text-xs font-semibold sm:text-sm xl:text-base">{title}</span>
                </Link>
                <button type="button" aria-label={t("movieDetailVideoCloseExpanded")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl hover:bg-white/20" onClick={closeExpandedViewer}>×</button>
              </header>
              <div className="relative min-h-0 w-full max-w-full flex-1 overflow-hidden xl:h-[100dvh]">
                {expandedSlideIndices.map((slideIndex) => {
                  const slide = cards[slideIndex];
                  const slideActive = slideIndex === expandedIndex;
                  const slideId = String(slide.item.payload.video_comment_id ?? slide.item.id);
                  return <div key={slideId} data-expanded-video-slide={slideActive ? "current" : slideIndex < expandedIndex ? "previous" : "next"} className="absolute inset-0 [transform:translateY(var(--expanded-slide-offset))] xl:transition-transform xl:duration-200 xl:[transform:translateX(var(--expanded-slide-offset))]" style={{ "--expanded-slide-offset": `${(slideIndex - expandedIndex) * 100}%` } as CSSProperties}>
                    <VisitedProfileVideoPlayer src={slide.item.payload.video_url} autoPlay={slideActive} interactive={slideActive} showMuteControl={slideActive} muted={isMuted} className="h-full max-h-full w-full object-contain xl:h-[100dvh]" onRegister={(video) => {
                      if (slideActive) expandedVideoRef.current = video;
                      if (video) adjacentVideoRefs.current.set(slideIndex, video);
                      else adjacentVideoRefs.current.delete(slideIndex);
                    }} onMutedChange={setIsMuted} />
                  </div>;
                })}
              </div>
            </div>
            <button type="button" disabled={expandedIndex === cards.length - 1} aria-label={t("visitedProfileNextVideoReaction")} className="absolute right-2 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-zinc-900/85 text-2xl disabled:invisible xl:flex" onClick={() => navigateExpandedViewer(1)}>→</button>
          </div>
        </div>;
      })() : null}
    </div>
  );
}
