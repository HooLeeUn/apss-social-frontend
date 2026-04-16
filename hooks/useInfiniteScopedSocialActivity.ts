"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocialActivity } from "../lib/profile-feed/adapters";
import { SocialActivityItem, SocialActivityScope } from "../lib/profile-feed/types";

interface UseInfiniteScopedSocialActivityResult {
  items: SocialActivityItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => void;
}

export function useInfiniteScopedSocialActivity(scope: SocialActivityScope): UseInfiniteScopedSocialActivityResult {
  const [items, setItems] = useState<SocialActivityItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadPage = useCallback(
    async (mode: "reset" | "append") => {
      if (mode === "append" && (!next || loading || loadingMore)) return;

      if (mode === "reset") {
        abortControllerRef.current?.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setError(null);
      if (mode === "reset") {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await getSocialActivity(scope, mode === "append" ? next : null, abortController.signal);
        if (requestId !== requestIdRef.current) return;

        setItems((current) => {
          if (mode === "reset") return response.items;

          const existingIds = new Set(current.map((item) => item.id));
          const uniqueNewItems = response.items.filter((item) => !existingIds.has(item.id));
          return [...current, ...uniqueNewItems];
        });
        setNext(response.next);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (requestId !== requestIdRef.current) return;
        setError("No se pudo cargar tu actividad.");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          abortControllerRef.current = null;
        }
      }
    },
    [loading, loadingMore, next, scope],
  );

  useEffect(() => {
    void loadPage("reset");
  }, [loadPage, scope]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const loadMore = useCallback(async () => {
    await loadPage("append");
  }, [loadPage]);

  const reload = useCallback(() => {
    setItems([]);
    setNext(null);
    void loadPage("reset");
  }, [loadPage]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(next),
    loadMore,
    reload,
  };
}
