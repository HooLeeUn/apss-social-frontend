"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useInfiniteSocialActivity } from "../../hooks/useInfiniteSocialActivity";
import { getMyProfile, getTopFollowing, getTopFriends } from "../../lib/profile-feed/adapters";
import { SocialTab } from "../../lib/profile-feed/types";
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
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingUsernames, setFollowingUsernames] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [friendUsernames, setFriendUsernames] = useState<Set<string>>(new Set());
  const { items, loading, loadingMore, error, hasMore, sentinelRef, reload } = useInfiniteSocialActivity(activityTab);
  const activeTabMeta = tabs.find((tab) => tab.value === activityTab) || tabs[0];
  const isRecommendationsActive = activeTab === "recommendations";

  useEffect(() => {
    const loadAuthenticatedUser = async () => {
      const profile = await getMyProfile().catch(() => null);
      setAuthenticatedUsername(profile?.username?.trim().toLocaleLowerCase() || null);
      setAuthenticatedId(profile?.id ? String(profile.id).trim() : null);
    };

    void loadAuthenticatedUser();
  }, []);

  useEffect(() => {
    const loadRelationshipSets = async () => {
      const [following, friends] = await Promise.all([getTopFollowing().catch(() => []), getTopFriends().catch(() => [])]);

      setFollowingIds(new Set(following.map((user) => String(user?.id ?? "").trim()).filter(Boolean)));
      setFollowingUsernames(new Set(following.map((user) => user?.username?.trim().toLocaleLowerCase() || "").filter(Boolean)));
      setFriendIds(new Set(friends.map((user) => String(user?.id ?? "").trim()).filter(Boolean)));
      setFriendUsernames(new Set(friends.map((user) => user?.username?.trim().toLocaleLowerCase() || "").filter(Boolean)));
    };

    void loadRelationshipSets();
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
          <div aria-hidden="true" className="invisible h-0 whitespace-nowrap px-4 text-sm font-medium">
            Recomendaciones
          </div>
          <p className="col-start-2 mb-3 w-max justify-self-center whitespace-nowrap text-center text-base font-semibold tracking-wide text-zinc-100 md:text-lg">
            Interacciones de
          </p>
        </div>
        <div className="grid grid-cols-[max-content_var(--activity-slot-width)_var(--activity-slot-width)] items-center gap-x-[var(--activity-tab-gap)] gap-y-2">
          <button
            type="button"
            onClick={() => setActiveTab("recommendations")}
            className={getTabClassName(isRecommendationsActive, "justify-self-start")}
          >
            Recomendaciones
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
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-8 text-center shadow-[0_18px_44px_rgba(0,0,0,0.24)]">
            <p className="text-sm font-medium text-zinc-300">Próximamente verás recomendaciones aquí.</p>
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
