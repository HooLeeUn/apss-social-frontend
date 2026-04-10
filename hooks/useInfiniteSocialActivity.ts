"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocialActivity } from "../lib/profile-feed/adapters";
import { SocialActivityItem, SocialTab } from "../lib/profile-feed/types";

interface SocialActivityTabState {
  items: SocialActivityItem[];
  next: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loaded: boolean;
}

interface UseInfiniteSocialActivityResult {
  items: SocialActivityItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
  reload: () => void;
}

const createDefaultTabState = (): SocialActivityTabState => ({
  items: [],
  next: null,
  loading: false,
  loadingMore: false,
  error: null,
  loaded: false,
});

export function useInfiniteSocialActivity(tab: SocialTab): UseInfiniteSocialActivityResult {
  const [tabStates, setTabStates] = useState<Record<SocialTab, SocialActivityTabState>>({
    following: createDefaultTabState(),
    friends: createDefaultTabState(),
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const requestIdRef = useRef<Record<SocialTab, number>>({
    following: 0,
    friends: 0,
  });
  const abortControllerRef = useRef<Record<SocialTab, AbortController | null>>({
    following: null,
    friends: null,
  });

  const updateTabState = useCallback((targetTab: SocialTab, updater: (current: SocialActivityTabState) => SocialActivityTabState) => {
    setTabStates((current) => ({
      ...current,
      [targetTab]: updater(current[targetTab]),
    }));
  }, []);

  const loadPage = useCallback(
    async (targetTab: SocialTab, mode: "reset" | "append") => {
      const currentTabState = tabStates[targetTab];
      if (mode === "append" && (!currentTabState.next || currentTabState.loading || currentTabState.loadingMore)) return;

      if (mode === "reset") {
        abortControllerRef.current[targetTab]?.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current[targetTab] = abortController;

      const requestId = requestIdRef.current[targetTab] + 1;
      requestIdRef.current[targetTab] = requestId;

      updateTabState(targetTab, (current) => ({
        ...current,
        loading: mode === "reset",
        loadingMore: mode === "append",
        error: null,
        ...(mode === "reset" ? { next: null } : {}),
      }));

      try {
        const response = await getSocialActivity(targetTab, mode === "append" ? currentTabState.next : null, abortController.signal);

        if (requestId !== requestIdRef.current[targetTab]) return;

        updateTabState(targetTab, (current) => ({
          ...current,
          items: mode === "reset" ? response.items : [...current.items, ...response.items],
          next: response.next,
          loading: false,
          loadingMore: false,
          loaded: true,
          error: null,
        }));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (requestId !== requestIdRef.current[targetTab]) return;

        updateTabState(targetTab, (current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          loaded: true,
          error: "No se pudo cargar la actividad social.",
        }));
      } finally {
        if (requestId === requestIdRef.current[targetTab]) {
          abortControllerRef.current[targetTab] = null;
        }
      }
    },
    [tabStates, updateTabState],
  );

  useEffect(() => {
    if (tabStates[tab].loaded || tabStates[tab].loading) return;
    void loadPage(tab, "reset");
  }, [loadPage, tab, tabStates]);

  const loadMore = useCallback(async () => {
    const currentTabState = tabStates[tab];
    if (!currentTabState.next || currentTabState.loading || currentTabState.loadingMore) return;
    await loadPage(tab, "append");
  }, [loadPage, tab, tabStates]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry?.isIntersecting) {
            void loadMore();
          }
        },
        { rootMargin: "220px" },
      );

      observerRef.current.observe(node);
    },
    [loadMore],
  );

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      abortControllerRef.current.following?.abort();
      abortControllerRef.current.friends?.abort();
    },
    [],
  );

  const reload = useCallback(() => {
    updateTabState(tab, () => createDefaultTabState());
    void loadPage(tab, "reset");
  }, [loadPage, tab, updateTabState]);

  const activeTabState = tabStates[tab];

  return {
    items: activeTabState.items,
    loading: activeTabState.loading,
    loadingMore: activeTabState.loadingMore,
    error: activeTabState.error,
    hasMore: Boolean(activeTabState.next),
    sentinelRef,
    reload,
  };
}
