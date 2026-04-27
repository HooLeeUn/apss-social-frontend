"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteSocialActivity } from "../../hooks/useInfiniteSocialActivity";
import { getMyProfile } from "../../lib/profile-feed/adapters";
import { SocialTab } from "../../lib/profile-feed/types";
import SocialActivityCard from "./SocialActivityCard";

const tabs: Array<{ value: SocialTab; label: string; emptyCopy: string }> = [
  { value: "following", label: "Seguidos", emptyCopy: "Aún no hay actividad de usuarios seguidos." },
  { value: "friends", label: "Amigos", emptyCopy: "Aún no hay actividad de amigos." },
];

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
  const [activeTab, setActiveTab] = useState<SocialTab>("following");
  const [authenticatedUsername, setAuthenticatedUsername] = useState<string | null>(null);
  const [authenticatedId, setAuthenticatedId] = useState<string | null>(null);
  const { items, loading, loadingMore, error, hasMore, sentinelRef, reload } = useInfiniteSocialActivity(activeTab);
  const activeTabMeta = tabs.find((tab) => tab.value === activeTab) || tabs[0];

  useEffect(() => {
    const loadAuthenticatedUser = async () => {
      const profile = await getMyProfile().catch(() => null);
      setAuthenticatedUsername(profile?.username?.trim().toLocaleLowerCase() || null);
      setAuthenticatedId(profile?.id ? String(profile.id).trim() : null);
    };

    void loadAuthenticatedUser();
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
        return !isOwnByUsername && !isOwnById;
      }),
    [authenticatedId, authenticatedUsername, items],
  );

  return (
    <section className="ml-auto w-full max-w-[1100px] rounded-3xl border border-white/15 bg-zinc-950/50 pb-5">
      <header className="sticky top-4 z-30 rounded-t-3xl border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-blue-300/80 bg-gradient-to-b from-blue-300/30 to-blue-600/50 text-blue-50 shadow-[0_8px_18px_rgba(56,189,248,0.28)]"
                    : "border-white/20 bg-zinc-900 text-zinc-300 hover:border-white/40"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
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
    </section>
  );
}
