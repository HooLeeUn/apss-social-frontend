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
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    const loadEveryPage = async () => {
      setState("loading");
      setItems([]);
      const collected: VideoReactionActivity[] = [];
      const visitedEndpoints = new Set<string>();
      let nextEndpoint: string | null = `/users/${encodeURIComponent(username)}/activity/`;

      try {
        while (nextEndpoint) {
          const endpoint: string = normalizeNextEndpoint(nextEndpoint);
          if (visitedEndpoints.has(endpoint)) throw new Error("Activity pagination returned a repeated URL.");
          visitedEndpoints.add(endpoint);

          const page = await apiFetch(endpoint, { cache: "no-store", signal: abortController.signal }) as ActivityPage;
          if (!Array.isArray(page?.results)) throw new Error("Invalid activity response.");

          collected.push(...page.results.filter((item) =>
            item.activity_type === "video_reaction_created" &&
            item.actor?.username?.trim().toLocaleLowerCase() === username.trim().toLocaleLowerCase(),
          ));
          nextEndpoint = typeof page.next === "string" && page.next ? page.next : null;
        }

        if (!active) return;
        collected.sort((left, right) => new Date(getTimestamp(right)).getTime() - new Date(getTimestamp(left)).getTime());
        setItems(collected);
        setState("ready");
      } catch (error) {
        if (!active || (error as Error).name === "AbortError") return;
        console.error("No se pudieron cargar todas las video reacciones del perfil visitado.", error);
        setItems([]);
        setState("error");
      }
    };

    void loadEveryPage();
    return () => {
      active = false;
      abortController.abort();
    };
  }, [username]);

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
      <button type="button" onClick={() => scrollCarousel(-1)} disabled={!canScrollLeft} aria-label={t("visitedProfilePreviousVideoReaction")} className="absolute left-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/70 bg-zinc-950/90 text-xl text-blue-200 shadow-lg disabled:border-zinc-700 disabled:text-zinc-700 md:flex">←</button>
      <div ref={carouselRef} onScroll={updateNavigation} className="space-y-8 overflow-x-visible px-1 pb-4 md:flex md:snap-x md:snap-mandatory md:gap-4 md:space-y-0 md:overflow-x-auto md:scroll-smooth md:px-14 md:pb-4 md:[scrollbar-color:rgba(134,173,224,0.55)_rgba(39,39,42,0.75)] md:[scrollbar-width:thin] md:[&::-webkit-scrollbar]:h-2 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-blue-300/50 md:[&::-webkit-scrollbar-track]:rounded-full md:[&::-webkit-scrollbar-track]:bg-zinc-800/75">
        {cards.map(({ item, title, timestamp }) => (
          <article key={item.id} className="mx-auto w-full max-w-[22rem] space-y-3 md:mx-0 md:w-auto md:max-w-none md:shrink-0 md:snap-start">
            <div className="flex min-h-14 items-center gap-3">
              <Link href={`/movies/${encodeURIComponent(String(item.movie.id))}`} className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.movie.image || "/brand/qnext-poster-placeholder.png"} alt={title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
              </Link>
              <div className="min-w-0">
                <Link href={`/movies/${encodeURIComponent(String(item.movie.id))}`} className="line-clamp-2 text-sm font-semibold text-zinc-100 hover:text-blue-200">{title}</Link>
                <time dateTime={timestamp} className="mt-0.5 block text-xs text-zinc-500">{formatProfileFeedRelativeDate(locale, timestamp)}</time>
              </div>
            </div>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black shadow-[0_16px_35px_rgba(0,0,0,0.45)] md:h-[clamp(260px,calc(100dvh-16rem),520px)] md:w-auto">
              <video src={item.payload.video_url} preload="metadata" playsInline controls controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="h-full w-full object-contain" />
            </div>
          </article>
        ))}
      </div>
      <button type="button" onClick={() => scrollCarousel(1)} disabled={!canScrollRight} aria-label={t("visitedProfileNextVideoReaction")} className="absolute right-1 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/70 bg-zinc-950/90 text-xl text-blue-200 shadow-lg disabled:border-zinc-700 disabled:text-zinc-700 md:flex">→</button>
    </div>
  );
}
