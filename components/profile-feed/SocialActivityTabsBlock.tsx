"use client";

import Link from "next/link";
import { type CSSProperties, type UIEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteSocialActivity } from "../../hooks/useInfiniteSocialActivity";
import { getMyProfile, getTopFollowing, getTopFriends, getUserMovieRecommendationsByUsername } from "../../lib/profile-feed/adapters";
import { SocialTab, SocialUser, UserMovieRecommendation } from "../../lib/profile-feed/types";
import SocialActivityCard from "./SocialActivityCard";

type InteractionsTab = SocialTab | "recommendations";

const tabs: Array<{ value: SocialTab; label: string; emptyCopy: string }> = [
  { value: "following", label: "Seguidos", emptyCopy: "Aún no hay actividad de usuarios seguidos." },
  { value: "friends", label: "Amigos", emptyCopy: "Aún no hay actividad de amigos." },
];

const tabButtonBaseClass =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition duration-300 ease-out will-change-transform";
const activeTabClass =
  "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28),inset_0_1px_0_rgba(191,219,254,0.25)]";
const inactiveTabClass = "border-white/20 bg-zinc-900/90 text-zinc-300 shadow-[0_10px_24px_rgba(0,0,0,0.22)] hover:border-white/40 hover:text-zinc-100";
const activityTabsLayoutStyle = {
  "--activity-slot-width": "clamp(5.5rem, 13vw, 7.75rem)",
  "--activity-tab-gap": "clamp(1rem, 5vw, 3.5rem)",
} as CSSProperties;


type FollowedRecommendation = UserMovieRecommendation & {
  recommenderUsername: string;
};

const FOLLOWED_RECOMMENDATIONS_BATCH_SIZE = 15;
const INITIAL_FOLLOWED_RECOMMENDATIONS_LIMIT = 25;

function getRecommendationRating(recommendation: UserMovieRecommendation): number {
  return typeof recommendation.displayRating === "number" && Number.isFinite(recommendation.displayRating) ? recommendation.displayRating : -Infinity;
}

function getRecommendationTimestamp(recommendation: UserMovieRecommendation): number {
  const candidate = recommendation.createdAt || recommendation.updatedAt || recommendation.recommendedAt;
  if (!candidate) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(candidate).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function getRecommendationIdScore(recommendation: UserMovieRecommendation): number {
  const idAsNumber = Number(recommendation.id);
  return Number.isFinite(idAsNumber) ? idAsNumber : 0;
}

function sortFollowedRecommendations(recommendations: FollowedRecommendation[]): FollowedRecommendation[] {
  return [...recommendations].sort((left, right) => {
    const ratingDifference = getRecommendationRating(right) - getRecommendationRating(left);
    if (ratingDifference !== 0) return ratingDifference;

    const recencyDifference = getRecommendationTimestamp(right) - getRecommendationTimestamp(left);
    if (recencyDifference !== 0) return recencyDifference;

    return getRecommendationIdScore(right) - getRecommendationIdScore(left);
  });
}

function FollowedRecommendationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`followed-recommendation-skeleton-${index}`} className="animate-pulse rounded-2xl border border-white/10 bg-zinc-950/70 p-3">
          <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
            <div className="h-24 rounded-lg bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-zinc-800" />
              <div className="h-4 w-3/4 rounded bg-zinc-800" />
              <div className="h-3 w-2/3 rounded bg-zinc-900" />
              <div className="h-3 w-full rounded bg-zinc-900" />
              <div className="h-3 w-4/5 rounded bg-zinc-900" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowedRecommendationCard({ recommendation }: { recommendation: FollowedRecommendation }) {
  const movieHref = `/movies/${encodeURIComponent(recommendation.id)}`;

  return (
    <article className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.22)] sm:grid-cols-[72px_minmax(0,1fr)]" role="option" aria-selected="false">
      <Link href={movieHref} className="h-24 w-16 overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80 transition hover:border-blue-300/60 sm:h-[108px] sm:w-[72px]">
        {recommendation.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recommendation.image} alt={`Poster de ${recommendation.titleSpanish}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-zinc-500">Sin poster</span>
        )}
      </Link>
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">@{recommendation.recommenderUsername}</p>
        <Link href={movieHref} className="block truncate text-base font-semibold text-zinc-100 hover:text-blue-200">
          {recommendation.titleEnglish}
        </Link>
        <Link href={movieHref} className="block truncate text-sm text-zinc-400 hover:text-blue-200">
          {recommendation.titleSpanish}
        </Link>
        <p className="text-xs text-zinc-300">{recommendation.releaseYear} · {recommendation.type} · {recommendation.genre}</p>
        <p className="truncate text-xs text-zinc-400">Director: {recommendation.director}</p>
        <p className="line-clamp-2 text-xs text-zinc-500">Casting: {recommendation.castMembers}</p>
      </div>
    </article>
  );
}

function SocialActivitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`skeleton-${index}`} className="animate-pulse rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 rounded bg-zinc-800" />
              <div className="h-3 w-full rounded bg-zinc-900" />
              <div className="h-3 w-2/3 rounded bg-zinc-900" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SocialActivityTabsBlock() {
  const [activeTab, setActiveTab] = useState<InteractionsTab>("recommendations");
  const [activityTab, setActivityTab] = useState<SocialTab>("following");
  const [authenticatedUsername, setAuthenticatedUsername] = useState<string | null>(null);
  const [authenticatedId, setAuthenticatedId] = useState<string | null>(null);
  const [authenticatedUserLoaded, setAuthenticatedUserLoaded] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<SocialUser[]>([]);
  const [followingUsersLoaded, setFollowingUsersLoaded] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingUsernames, setFollowingUsernames] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [friendUsernames, setFriendUsernames] = useState<Set<string>>(new Set());
  const [followedRecommendationQuery, setFollowedRecommendationQuery] = useState("");
  const [followedRecommendations, setFollowedRecommendations] = useState<FollowedRecommendation[]>([]);
  const [followedRecommendationsLoading, setFollowedRecommendationsLoading] = useState(false);
  const [followedRecommendationsError, setFollowedRecommendationsError] = useState<string | null>(null);
  const [followedRecommendationsLoaded, setFollowedRecommendationsLoaded] = useState(false);
  const [visibleRecommendationsLimit, setVisibleRecommendationsLimit] = useState(INITIAL_FOLLOWED_RECOMMENDATIONS_LIMIT);
  const { items, loading, loadingMore, error, hasMore, sentinelRef, reload } = useInfiniteSocialActivity(activityTab);
  const activeTabMeta = tabs.find((tab) => tab.value === activityTab) || tabs[0];
  const isRecommendationsActive = activeTab === "recommendations";

  useEffect(() => {
    const loadAuthenticatedUser = async () => {
      const profile = await getMyProfile().catch(() => null);
      setAuthenticatedUsername(profile?.username?.trim().toLocaleLowerCase() || null);
      setAuthenticatedId(profile?.id ? String(profile.id).trim() : null);
      setAuthenticatedUserLoaded(true);
    };

    void loadAuthenticatedUser();
  }, []);

  useEffect(() => {
    const loadRelationshipSets = async () => {
      const [following, friends] = await Promise.all([getTopFollowing().catch(() => []), getTopFriends().catch(() => [])]);

      setFollowingUsers(following);
      setFollowingIds(new Set(following.map((user) => String(user?.id ?? "").trim()).filter(Boolean)));
      setFollowingUsernames(new Set(following.map((user) => user?.username?.trim().toLocaleLowerCase() || "").filter(Boolean)));
      setFriendIds(new Set(friends.map((user) => String(user?.id ?? "").trim()).filter(Boolean)));
      setFriendUsernames(new Set(friends.map((user) => user?.username?.trim().toLocaleLowerCase() || "").filter(Boolean)));
      setFollowingUsersLoaded(true);
    };

    void loadRelationshipSets();
  }, []);

  const eligibleFollowingUsers = useMemo(() => {
    const normalizedAuthenticatedUsername = authenticatedUsername?.trim().toLocaleLowerCase();
    const normalizedAuthenticatedId = authenticatedId?.trim();

    return followingUsers.filter((user) => {
      const username = user.username?.trim();
      if (!username) return false;
      const normalizedUsername = username.toLocaleLowerCase();
      const id = String(user.id ?? "").trim();
      if (normalizedAuthenticatedUsername && normalizedUsername === normalizedAuthenticatedUsername) return false;
      if (normalizedAuthenticatedId && id === normalizedAuthenticatedId) return false;
      return true;
    });
  }, [authenticatedId, authenticatedUsername, followingUsers]);

  useEffect(() => {
    if (!isRecommendationsActive) return;
    if (!authenticatedUserLoaded || !followingUsersLoaded) return;
    if (followedRecommendationsLoaded || followedRecommendationsLoading) return;

    let cancelled = false;

    const loadFollowedRecommendations = async () => {
      setFollowedRecommendationsLoading(true);
      setFollowedRecommendationsError(null);

      const settledRecommendations = await Promise.all(
        eligibleFollowingUsers.map(async (user) => {
          try {
            const recommendations = await getUserMovieRecommendationsByUsername(user.username);
            return { status: "fulfilled" as const, username: user.username, recommendations };
          } catch {
            return { status: "rejected" as const, username: user.username, recommendations: [] as UserMovieRecommendation[] };
          }
        }),
      );

      if (cancelled) return;

      const mergedRecommendations = settledRecommendations.flatMap((result) =>
        result.recommendations.map((recommendation) => ({
          ...recommendation,
          recommenderUsername: result.username,
        })),
      );
      const failedRequests = settledRecommendations.filter((result) => result.status === "rejected").length;

      setFollowedRecommendations(sortFollowedRecommendations(mergedRecommendations));
      setFollowedRecommendationsLoaded(true);
      setFollowedRecommendationsError(failedRequests > 0 ? "No pudimos cargar algunas recomendaciones de tus seguidos." : null);
      setFollowedRecommendationsLoading(false);
    };

    void loadFollowedRecommendations();

    return () => {
      cancelled = true;
    };
  }, [authenticatedUserLoaded, eligibleFollowingUsers, followedRecommendationsLoaded, followedRecommendationsLoading, followingUsersLoaded, isRecommendationsActive]);

  const filteredFollowedRecommendations = useMemo(() => {
    const normalizedQuery = followedRecommendationQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return followedRecommendations;

    return followedRecommendations.filter((recommendation) =>
      recommendation.recommenderUsername.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [followedRecommendationQuery, followedRecommendations]);

  const visibleFollowedRecommendations = useMemo(
    () => filteredFollowedRecommendations.slice(0, visibleRecommendationsLimit),
    [filteredFollowedRecommendations, visibleRecommendationsLimit],
  );

  const hasMoreFollowedRecommendations = visibleRecommendationsLimit < filteredFollowedRecommendations.length;

  const handleFollowedRecommendationsScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const remainingDistance = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remainingDistance > 96) return;

    setVisibleRecommendationsLimit((currentLimit) => currentLimit + FOLLOWED_RECOMMENDATIONS_BATCH_SIZE);
  }, []);

  const visibleItems = useMemo(
    () =>
      items.filter((activity) => {
        const record = activity as unknown as Record<string, unknown>;
        const userRecord =
          typeof record.user === "object" && record.user !== null ? (record.user as Record<string, unknown>) : ({} as Record<string, unknown>);
        const actorRecord =
          typeof record.actor === "object" && record.actor !== null ? (record.actor as Record<string, unknown>) : ({} as Record<string, unknown>);
        const authorRecord =
          typeof record.author === "object" && record.author !== null ? (record.author as Record<string, unknown>) : ({} as Record<string, unknown>);

        const usernames = [
          userRecord.username,
          actorRecord.username,
          authorRecord.username,
          record.author_username,
          record.username,
        ]
          .map((value) => (typeof value === "string" ? value.trim().toLocaleLowerCase() : ""))
          .filter(Boolean);

        const ids = [
          userRecord.id,
          record.user_id,
          record.actor_id,
          record.author_id,
          record.actorId,
        ]
          .map((value) => (value !== null && value !== undefined ? String(value).trim() : ""))
          .filter(Boolean);

        const normalizedAuthenticatedUsername = authenticatedUsername?.trim().toLocaleLowerCase();
        const normalizedAuthenticatedId = authenticatedId?.trim();

        const isOwnByUsername = normalizedAuthenticatedUsername ? usernames.includes(normalizedAuthenticatedUsername) : false;
        const isOwnById = normalizedAuthenticatedId ? ids.includes(normalizedAuthenticatedId) : false;
        if (isOwnByUsername || isOwnById) return false;

        const belongsToFollowing =
          usernames.some((username) => followingUsernames.has(username)) || ids.some((id) => followingIds.has(id));
        const belongsToFriends = usernames.some((username) => friendUsernames.has(username)) || ids.some((id) => friendIds.has(id));

        if (activityTab === "following") return belongsToFollowing;
        if (activityTab === "friends") return belongsToFriends;

        return false;
      }),
    [activityTab, authenticatedId, authenticatedUsername, followingIds, followingUsernames, friendIds, friendUsernames, items],
  );

  const handleActivityTabClick = (nextTab: SocialTab) => {
    setActivityTab(nextTab);
    setActiveTab(nextTab);
  };

  const getTabClassName = (isActive: boolean, extraClassName = "") =>
    `${tabButtonBaseClass} ${isActive ? activeTabClass : inactiveTabClass} ${extraClassName}`;

  return (
    <section className="ml-auto mt-8 w-full max-w-[1100px] bg-zinc-950/35 pb-5 md:mt-12">
      <header className="sticky top-4 z-30 bg-black/75 px-4 py-3 backdrop-blur-md" style={activityTabsLayoutStyle}>
        <div className="grid grid-cols-[max-content_var(--activity-slot-width)_var(--activity-slot-width)] items-end gap-x-[var(--activity-tab-gap)]">
          <div aria-hidden="true" className="invisible h-0 min-w-[9.25rem] whitespace-nowrap px-4 text-sm font-medium">
            Recomendadas
          </div>
          <p className="col-start-2 mb-3 w-max justify-self-center whitespace-nowrap bg-gradient-to-b from-blue-200 via-sky-300 to-blue-500 bg-clip-text text-center text-lg font-semibold tracking-wide text-transparent drop-shadow-[0_0_10px_rgba(56,189,248,0.35)] md:text-xl">
            Actividades
          </p>
        </div>
        <div className="grid grid-cols-[max-content_var(--activity-slot-width)_var(--activity-slot-width)] items-center gap-x-[var(--activity-tab-gap)] gap-y-2">
          <button
            type="button"
            onClick={() => setActiveTab("recommendations")}
            className={getTabClassName(isRecommendationsActive, "h-12 min-h-12 min-w-[9.25rem] flex-col gap-0.5 justify-self-start py-2 leading-tight")}
          >
            <span>Recomendadas</span>
            <span>de Seguidos</span>
          </button>

          <div className="relative col-start-2 col-span-2 h-10 w-[calc(var(--activity-slot-width)+var(--activity-tab-gap)+var(--activity-slot-width))] overflow-visible">
            {tabs.map((tab) => {
              const isActive = tab.value === activeTab;
              const positionClass = tab.value === "following" ? "left-0" : "left-[calc(var(--activity-slot-width)+var(--activity-tab-gap))]";
              const translateClass =
                tab.value === "following"
                  ? activityTab === "friends"
                    ? "translate-x-[calc(var(--activity-slot-width)+var(--activity-tab-gap))]"
                    : "translate-x-0"
                  : activityTab === "friends"
                    ? "-translate-x-[calc(var(--activity-slot-width)+var(--activity-tab-gap))]"
                    : "translate-x-0";

              return (
                <div
                  key={tab.value}
                  className={`absolute top-0 w-[var(--activity-slot-width)] transition duration-300 ease-out will-change-transform ${positionClass} ${translateClass}`}
                >
                  <button
                    type="button"
                    onClick={() => handleActivityTabClick(tab.value)}
                    className={getTabClassName(isActive, "mx-auto")}
                  >
                    {tab.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="px-4 pt-5">
        {isRecommendationsActive ? (
          <div className="space-y-3">
            <div className="flex items-center justify-start">
              <input
                type="search"
                value={followedRecommendationQuery}
                onChange={(event) => {
                  setFollowedRecommendationQuery(event.target.value);
                  setVisibleRecommendationsLimit(INITIAL_FOLLOWED_RECOMMENDATIONS_LIMIT);
                }}
                placeholder="Buscar usuario"
                aria-label="Buscar recomendaciones por usuario seguido"
                className="h-9 w-44 rounded-full border border-white/15 bg-zinc-900/75 px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-blue-300/60 focus:bg-zinc-900"
              />
            </div>

            <div
              className="activity-scrollbar max-h-[39rem] overflow-y-auto pr-2"
              role="listbox"
              aria-label="Recomendadas de Seguidos"
              onScroll={handleFollowedRecommendationsScroll}
            >
              <div className="space-y-3">
                {followedRecommendationsLoading ? <FollowedRecommendationsSkeleton /> : null}

                {!followedRecommendationsLoading && followedRecommendationsError ? (
                  <p className="rounded-2xl border border-amber-300/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                    {followedRecommendationsError}
                  </p>
                ) : null}

                {!followedRecommendationsLoading && visibleFollowedRecommendations.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-8 text-center shadow-[0_18px_44px_rgba(0,0,0,0.24)]">
                    <p className="text-sm font-medium text-zinc-300">Aún no hay recomendaciones de tus seguidos.</p>
                  </div>
                ) : null}

                {visibleFollowedRecommendations.map((recommendation) => (
                  <FollowedRecommendationCard
                    key={`${recommendation.recommenderUsername}-${recommendation.id}`}
                    recommendation={recommendation}
                  />
                ))}

                {hasMoreFollowedRecommendations ? <p className="py-2 text-center text-xs text-zinc-500">Desplázate para ver más recomendaciones.</p> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="activity-scrollbar max-h-[49rem] overflow-y-auto pr-2" role="listbox" aria-label={`Actividad de ${activeTabMeta.label}`}>
            <div className="space-y-3">
              {loading ? <SocialActivitySkeleton /> : null}

              {!loading && error ? (
                <div className="rounded-2xl border border-red-300/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={reload}
                    className="mt-2 rounded-full border border-red-200/40 bg-red-900/40 px-3 py-1 text-xs font-medium transition hover:bg-red-900/60"
                  >
                    Reintentar
                  </button>
                </div>
              ) : null}

              {!loading && !error && visibleItems.length === 0 ? <p className="text-sm text-zinc-500">{activeTabMeta.emptyCopy}</p> : null}

              {visibleItems.map((item) => (
                <SocialActivityCard key={item.id} item={item} />
              ))}

              {hasMore ? <div ref={sentinelRef} className="h-8" /> : null}
              {loadingMore ? <p className="text-sm text-zinc-400">Cargando más actividad...</p> : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
