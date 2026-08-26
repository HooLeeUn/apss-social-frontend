"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMyMessagesPaginated } from "../lib/profile-feed/adapters";
import { MyMessageItem } from "../lib/profile-feed/types";

interface UseInfiniteMyMessagesResult {
  items: MyMessageItem[];
  loading: boolean;
  loadingMore: boolean;
  hasLoaded: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => void;
}

export function useInfiniteMyMessages(enabled: boolean = true): UseInfiniteMyMessagesResult {
  const [items, setItems] = useState<MyMessageItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nextRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const errorRef = useRef<string | null>(null);

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

  const loadPage = useCallback(async (mode: "reset" | "append") => {
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
      const response = await getMyMessagesPaginated(mode === "append" ? currentNext : null, abortController.signal);
      if (requestId !== requestIdRef.current) return;

      setItems((current) => {
        if (mode === "reset") return response.items;

        const existingIds = new Set(current.map((item) => item.id));
        const uniqueNewItems = response.items.filter((item) => !existingIds.has(item.id));
        return [...current, ...uniqueNewItems];
      });
      setNext(response.next);
      nextRef.current = response.next;
      if (mode === "reset") setHasLoaded(true);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      // A failed cursor page must not hide or erase pages already rendered.
      if (mode === "reset") {
        const nextError = "No se pudieron cargar tus mensajes.";
        setError(nextError);
        errorRef.current = nextError;
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
        loadingMoreRef.current = false;
        abortControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      requestIdRef.current += 1;
      setItems([]);
      setHasLoaded(false);
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

    setItems([]);
    setHasLoaded(false);
    setNext(null);
    nextRef.current = null;
    setError(null);
    errorRef.current = null;
    void loadPage("reset");
  }, [enabled, loadPage]);

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
    setHasLoaded(false);
    setNext(null);
    nextRef.current = null;
    setError(null);
    errorRef.current = null;
    void loadPage("reset");
  }, [enabled, loadPage]);

  return {
    items,
    loading,
    loadingMore,
    hasLoaded,
    error,
    hasMore: Boolean(next),
    loadMore,
    reload,
  };
}
