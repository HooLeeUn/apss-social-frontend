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

type VisitedActivityType = "rating" | "public_comment" | "public_comment_reaction";

interface ActivityCacheEntry {
  items: SocialActivityItem[];
  next: string | null;
  error: string | null;
}

export function useInfiniteScopedSocialActivity(
  scope: SocialActivityScope,
  enabled: boolean = true,
  activityType?: VisitedActivityType,
): UseInfiniteScopedSocialActivityResult {
  const [items, setItems] = useState<SocialActivityItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nextRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const itemsRef = useRef<SocialActivityItem[]>([]);
  const cacheRef = useRef<Map<string, ActivityCacheEntry>>(new Map());
  const cacheKey = `${scope}:${activityType ?? "all"}`;
  const stateCacheKeyRef = useRef(cacheKey);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const loadPage = useCallback(
    async (mode: "reset" | "append") => {
      const currentNext = nextRef.current;
      if (mode === "append" && (!currentNext || loadingRef.current || loadingMoreRef.current || errorRef.current)) return;

      if (mode === "reset") {
        abortControllerRef.current?.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setError(null);
      errorRef.current = null;
      if (mode === "reset") {
        setLoading(true);
        loadingRef.current = true;
      } else {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      }

      try {
        const response = await getSocialActivity(scope, mode === "append" ? currentNext : null, abortController.signal, activityType);
        if (requestId !== requestIdRef.current) return;
        stateCacheKeyRef.current = cacheKey;

        setItems((current) => {
          const nextItems = (() => {
            if (mode === "reset") return response.items;

            const existingIds = new Set(current.map((item) => item.id));
            const uniqueNewItems = response.items.filter((item) => !existingIds.has(item.id));
            return [...current, ...uniqueNewItems];
          })();
          cacheRef.current.set(cacheKey, { items: nextItems, next: response.next, error: null });
          return nextItems;
        });
        setNext(response.next);
        nextRef.current = response.next;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (requestId !== requestIdRef.current) return;
        const nextError = "No se pudo cargar tu actividad.";
        setError(nextError);
        errorRef.current = nextError;
        cacheRef.current.set(cacheKey, { items: mode === "append" ? itemsRef.current : [], next: currentNext, error: nextError });
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          loadingRef.current = false;
          loadingMoreRef.current = false;
          abortControllerRef.current = null;
        }
      }
    },
    [activityType, cacheKey, scope],
  );

  useEffect(() => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();

    if (!enabled) {
      stateCacheKeyRef.current = cacheKey;
      setItems([]);
      itemsRef.current = [];
      setNext(null);
      nextRef.current = null;
      setError(null);
      errorRef.current = null;
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
      loadingMoreRef.current = false;
      return;
    }

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      stateCacheKeyRef.current = cacheKey;
      setItems(cached.items);
      itemsRef.current = cached.items;
      setNext(cached.next);
      nextRef.current = cached.next;
      setError(cached.error);
      errorRef.current = cached.error;
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
      loadingMoreRef.current = false;
      return;
    }

    setItems([]);
    stateCacheKeyRef.current = cacheKey;
    itemsRef.current = [];
    setNext(null);
    nextRef.current = null;
    setError(null);
    errorRef.current = null;
    void loadPage("reset");
  }, [cacheKey, enabled, loadPage]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (!enabled) return;
    await loadPage("append");
  }, [enabled, loadPage]);

  const reload = useCallback(() => {
    if (!enabled) return;
    setItems([]);
    setNext(null);
    nextRef.current = null;
    setError(null);
    errorRef.current = null;
    void loadPage("reset");
  }, [enabled, loadPage]);

  return {
    items: stateCacheKeyRef.current === cacheKey ? items : [],
    loading: enabled && stateCacheKeyRef.current !== cacheKey ? true : loading,
    loadingMore,
    error,
    hasMore: Boolean(next),
    loadMore,
    reload,
  };
}
