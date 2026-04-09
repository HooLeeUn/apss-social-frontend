"use client";

import { useState } from "react";
import { useInfiniteSocialActivity } from "../../hooks/useInfiniteSocialActivity";
import { SocialTab } from "../../lib/profile-feed/types";
import SocialActivityCard from "./SocialActivityCard";

const tabs: Array<{ value: SocialTab; label: string }> = [
  { value: "following", label: "Seguidos" },
  { value: "friends", label: "Amigos" },
];

export default function SocialActivityTabsBlock() {
  const [activeTab, setActiveTab] = useState<SocialTab>("following");
  const { items, loading, loadingMore, hasMore, sentinelRef } = useInfiniteSocialActivity(activeTab);

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
        {loading ? <p className="text-sm text-zinc-400">Cargando actividad...</p> : null}

        {!loading && items.length === 0 ? <p className="text-sm text-zinc-500">Aún no hay actividad para esta pestaña.</p> : null}

        {items.map((item) => (
          <SocialActivityCard key={item.id} item={item} />
        ))}

        {hasMore ? <div ref={sentinelRef} className="h-8" /> : null}
        {loadingMore ? <p className="text-sm text-zinc-400">Cargando más actividad...</p> : null}
      </div>
    </section>
  );
}
