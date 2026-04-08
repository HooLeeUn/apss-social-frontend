"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocialActivity } from "../lib/profile-feed/adapters";
import { SocialActivityItem, SocialTab } from "../lib/profile-feed/types";

interface UseInfiniteSocialActivityResult {
  items: SocialActivityItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
  reload: () => void;
}

export function useInfiniteSocialActivity(tab: SocialTab): UseInfiniteSocialActivityResult {
  const [items, setItems] = useState<SocialActivityItem[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const isFetchingRef = useRef(false);

  const loadPage = useCallback(
    async (page: number, mode: "reset" | "append") => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (mode === "reset") {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await getSocialActivity(tab, page);
        setItems((current) => (mode === "reset" ? response.items : [...current, ...response.items]));
        setNextPage(response.nextPage);
      } finally {
        if (mode === "reset") {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }

        isFetchingRef.current = false;
      }
    },
    [tab],
  );

  useEffect(() => {
    setItems([]);
    setNextPage(1);
    void loadPage(1, "reset");
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore || loading) return;
    await loadPage(nextPage, "append");
  }, [loadPage, loading, loadingMore, nextPage]);

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
    },
    [],
  );

  return {
    items,
    loading,
    loadingMore,
    hasMore: Boolean(nextPage),
    sentinelRef,
    reload: () => {
      setItems([]);
      setNextPage(1);
      void loadPage(1, "reset");
    },
  };
}
