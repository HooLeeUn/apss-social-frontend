"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CommentComposer from "../../../components/social/CommentComposer";
import CommentsList from "../../../components/social/CommentsList";
import MovieCard from "../../../components/MovieCard";
import { apiFetch, ApiError, API_BASE_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth";
import {
  buildMovieDetailEndpoint,
  MOVIE_DETAIL_ENDPOINT_TEMPLATE,
  MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES,
  Movie,
  normalizeMovie,
} from "../../../lib/movies";
import {
  buildReactionEndpoint,
  Friend,
  FRIENDS_ENDPOINT,
  FRIENDS_FALLBACK_ENDPOINTS,
  parseComments,
  parseCommentsPage,
  parseFriends,
  ReactionType,
  SocialComment,
} from "../../../lib/social";

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function joinApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

function buildMoviePublicSubmitEndpoint(movieId: string): string {
  return `/movies/${encodeURIComponent(movieId)}/comments/`;
}

function buildMovieDirectedSubmitEndpoint(movieId: string): string {
  return `/movies/${encodeURIComponent(movieId)}/comments/directed/`;
}

function buildMovieDirectedFetchEndpoints(movieId: string): string[] {
  const encodedMovieId = encodeURIComponent(movieId);
  return [
    `/comments/directed/?movie_id=${encodedMovieId}`,
    `/comments/directed/received/?movie_id=${encodedMovieId}`,
    `/movies/${encodedMovieId}/comments/directed/received/`,
    `/movies/${encodedMovieId}/comments/directed/`,
  ];
}

interface DirectedConversation {
  key: string;
  counterpartKey: string;
  otherUsername: string;
  otherDisplayName: string;
  otherAvatar: string | null;
  messages: SocialComment[];
  next: string | null;
  lastMessageAt: string | null;
}

function getCurrentUsernameFromPayload(payload: unknown): string | null {
  const root = toRecord(payload);
  const user = toRecord(root?.user);
  return typeof (user?.username ?? root?.username) === "string" ? String(user?.username ?? root?.username) : null;
}


function normalizeEndpointPath(nextValue: string | null): string | null {
  if (!nextValue) return null;
  if (nextValue.startsWith("http")) {
    try {
      const url = new URL(nextValue);
      return `${url.pathname}${url.search}`.replace(/^\/api/, "") || null;
    } catch {
      return null;
    }
  }
  return nextValue;
}

function normalizeId(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}


function buildCounterpartData(message: SocialComment, authenticatedUsername: string): {
  counterpartKey: string;
  username: string;
  displayName: string;
  avatar: string | null;
  direction: "sent" | "received";
} {
  const isSentByMe = message.authorUsername === authenticatedUsername;
  const normalizedAuthorId = normalizeId(message.authorId);
  const normalizedTargetUserId = normalizeId(message.targetUserId);
  const counterpartId = isSentByMe ? normalizedTargetUserId : normalizedAuthorId;
  const fallbackUsername = counterpartId ? `usuario-${counterpartId}` : "usuario";
  const username = (isSentByMe ? message.recipientName : message.authorUsername) ?? fallbackUsername;

  return {
    counterpartKey: counterpartId ? `id:${counterpartId}` : `username:${username.toLowerCase()}`,
    username,
    displayName: isSentByMe ? message.recipientName ?? username : message.authorName || username,
    avatar: isSentByMe ? null : message.authorAvatar,
    direction: isSentByMe ? "sent" : "received",
  };
}

function groupDirectedConversations(payload: unknown, authenticatedUsername: string, currentMovieId: string): DirectedConversation[] {
  const root = toRecord(payload);
  const explicitConversations =
    (Array.isArray(root?.conversations) ? root?.conversations : null) ||
    (Array.isArray(root?.results) ? root?.results : null) ||
    (Array.isArray(root?.items) ? root?.items : null);

  const parsedMessagesFromConversations = Array.isArray(explicitConversations)
    ? explicitConversations.flatMap((entry) => {
        const record = toRecord(entry);
        if (!record) return [];
        return parseCommentsPage(record.messages ?? record, "directed").comments;
      })
    : [];

  const flatComments = parsedMessagesFromConversations.length > 0 ? parsedMessagesFromConversations : parseComments(payload, "directed");
  const byConversation = new Map<string, DirectedConversation>();
  const normalizedMovieId = normalizeId(currentMovieId);

  const commentsForMovie = normalizedMovieId
    ? flatComments.filter((message) => {
        const messageMovieId = normalizeId(message.movieId);
        return !messageMovieId || messageMovieId === normalizedMovieId;
      })
    : flatComments;

  commentsForMovie.forEach((message) => {
    const counterpart = buildCounterpartData(message, authenticatedUsername);
    const existing = byConversation.get(counterpart.counterpartKey);
    const directionMessage: SocialComment = {
      ...message,
      direction: counterpart.direction,
    };
    const nextMessageList = existing ? [...existing.messages, directionMessage] : [directionMessage];
    const sortedMessages = [...nextMessageList].sort((a, b) => (a.createdAt && b.createdAt ? b.createdAt.localeCompare(a.createdAt) : 0));
    byConversation.set(counterpart.counterpartKey, {
      key: `conversation-${counterpart.counterpartKey}`,
      counterpartKey: counterpart.counterpartKey,
      otherUsername: existing?.otherUsername ?? counterpart.username,
      otherDisplayName: existing?.otherDisplayName ?? counterpart.displayName,
      otherAvatar: existing?.otherAvatar ?? counterpart.avatar,
      messages: sortedMessages,
      next: existing?.next ?? null,
      lastMessageAt: sortedMessages[0]?.createdAt ?? null,
    });
  });

  return [...byConversation.values()].sort((a, b) =>
    a.lastMessageAt && b.lastMessageAt ? b.lastMessageAt.localeCompare(a.lastMessageAt) : 0,
  );
}

async function debugApiRequest(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Token ${token}`);
  }

  const url = joinApiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    method,
    headers,
  });

  const rawText = await response.text();
  let parsedBody: unknown = rawText;

  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = rawText;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, rawText || `HTTP ${response.status}`);
  }

  return {
    endpoint,
    url,
    method,
    status: response.status,
    body: parsedBody,
  };
}

async function fetchWithFallbacks<T>(
  endpoints: string[],
  logTag: "[mentions-debug]" | "[movie-detail-debug]",
): Promise<{ payload: T; endpoint: string; usedFallback: boolean }> {
  let lastError: unknown = null;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const payload = (await apiFetch(endpoint)) as T;
      console.log(logTag, "Endpoint success:", { endpoint, isOfficial: index === 0 });
      return { payload, endpoint, usedFallback: index > 0 };
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && [404, 405].includes(error.status) && index < endpoints.length - 1) {
        console.log(logTag, "Endpoint fallback:", {
          attemptedEndpoint: endpoint,
          status: error.status,
          nextEndpoint: endpoints[index + 1],
        });
        continue;
      }

      console.log(logTag, "Endpoint error:", { endpoint, error });
      throw error;
    }
  }

  throw lastError ?? new Error("No endpoint available.");
}

function applyReactionToCollection(
  collection: SocialComment[],
  commentId: number | string,
  nextReaction: ReactionType,
): SocialComment[] {
  return collection.map((comment) => {
    if (String(comment.id) !== String(commentId)) return comment;

    let likesCount = comment.likesCount;
    let dislikesCount = comment.dislikesCount;

    if (comment.myReaction === "like") likesCount = Math.max(0, likesCount - 1);
    if (comment.myReaction === "dislike") dislikesCount = Math.max(0, dislikesCount - 1);

    if (nextReaction === "like") likesCount += 1;
    if (nextReaction === "dislike") dislikesCount += 1;

    return {
      ...comment,
      myReaction: nextReaction,
      likesCount,
      dislikesCount,
    };
  });
}

function applyReactionResultToCollection(
  collection: SocialComment[],
  commentId: number | string,
  payload: unknown,
): SocialComment[] {
  const record = toRecord(payload);
  if (!record) return collection;

  const payloadCommentId = record.comment_id;
  if (payloadCommentId === undefined || String(payloadCommentId) !== String(commentId)) {
    return collection;
  }

  const myReactionRaw = typeof record.my_reaction === "string" ? record.my_reaction.toLowerCase() : null;
  const myReaction: ReactionType = myReactionRaw === "like" || myReactionRaw === "dislike" ? myReactionRaw : null;
  const likesCount = typeof record.likes_count === "number" && Number.isFinite(record.likes_count) ? record.likes_count : null;
  const dislikesCount =
    typeof record.dislikes_count === "number" && Number.isFinite(record.dislikes_count) ? record.dislikes_count : null;

  if (likesCount === null || dislikesCount === null) return collection;

  return collection.map((comment) =>
    String(comment.id) === String(commentId)
      ? {
          ...comment,
          myReaction,
          likesCount,
          dislikesCount,
        }
      : comment,
  );
}

export default function MovieDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const movieId = params?.id ? String(params.id) : "";

  const [movie, setMovie] = useState<Movie | null>(null);
  const [movieLoading, setMovieLoading] = useState(true);
  const [movieError, setMovieError] = useState("");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [authenticatedUsername, setAuthenticatedUsername] = useState("");

  const [publicComments, setPublicComments] = useState<SocialComment[]>([]);
  const [publicNext, setPublicNext] = useState<string | null>(null);
  const [loadingPublicMore, setLoadingPublicMore] = useState(false);
  const [directedConversations, setDirectedConversations] = useState<DirectedConversation[]>([]);
  const [expandedConversationKey, setExpandedConversationKey] = useState<string | null>(null);
  const [loadingDirectedMoreByKey, setLoadingDirectedMoreByKey] = useState<Record<string, boolean>>({});

  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingDirected, setLoadingDirected] = useState(true);

  const [publicError, setPublicError] = useState("");
  const [directedError, setDirectedError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [reactionError, setReactionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMovieDetail = useCallback(async () => {
    if (!movieId) return null;

    const movieEndpoints = [
      buildMovieDetailEndpoint(movieId, MOVIE_DETAIL_ENDPOINT_TEMPLATE),
      ...MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES.map((template) => buildMovieDetailEndpoint(movieId, template)),
    ];

    for (let index = 0; index < movieEndpoints.length; index += 1) {
      const endpoint = movieEndpoints[index];

      console.log("[movie-detail-debug] detail request", {
        url: joinApiUrl(endpoint),
        method: "GET",
        endpoint,
        isOfficial: index === 0,
      });

      try {
        const response = await debugApiRequest(endpoint);
        console.log("[movie-detail-debug] detail response", {
          url: response.url,
          method: response.method,
          status: response.status,
          endpoint,
        });

        const rawMovie = toRecord(response.body);
        if (!rawMovie) return null;

        return normalizeMovie(rawMovie, 0);
      } catch (error) {
        const status = error instanceof ApiError ? error.status : null;
        console.log("[movie-detail-debug] detail response", {
          url: joinApiUrl(endpoint),
          method: "GET",
          status,
          endpoint,
          body: error instanceof Error ? error.message : String(error),
        });

        if (!(error instanceof ApiError) || ![404, 405].includes(error.status) || index >= movieEndpoints.length - 1) {
          throw error;
        }
      }
    }

    throw new Error("No se pudo cargar detalle con endpoints disponibles");
  }, [movieId]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!movieId) return;

    const loadData = async () => {
      setMovieLoading(true);
      setLoadingPublic(true);
      setLoadingDirected(true);
      setMovieError("");
      setPublicError("");
      setDirectedError("");

      try {
        const normalizedMovie = await fetchMovieDetail();

        if (!normalizedMovie) {
          setMovieError("No se pudo interpretar la película seleccionada.");
        } else {
          setMovie(normalizedMovie);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }

        setMovieError("No pudimos cargar los datos de la película.");
      } finally {
        setMovieLoading(false);
      }

      const publicEndpoint = buildMoviePublicSubmitEndpoint(movieId);
      const directedEndpoints = buildMovieDirectedFetchEndpoints(movieId);
      const directedEndpoint = directedEndpoints[0];

      const [friendsResult, meResult, publicResult, directedReceivedResult] = await Promise.all([
        fetchWithFallbacks<unknown>([FRIENDS_ENDPOINT, ...FRIENDS_FALLBACK_ENDPOINTS], "[mentions-debug]").then(
          ({ payload, endpoint, usedFallback }) => ({ ok: true as const, payload, endpoint, usedFallback }),
          (error) => ({ ok: false as const, error }),
        ),
        apiFetch("/me/").then(
          (payload) => ({ ok: true as const, payload }),
          (error) => ({ ok: false as const, error }),
        ),
        (async () => {
          console.log("[movie-comments-debug] public GET url", joinApiUrl(publicEndpoint));
          try {
            const response = await debugApiRequest(publicEndpoint);
            console.log("[movie-comments-debug] public GET status", response.status);
            console.log("[movie-comments-debug] public GET response", response.body);
            return { ok: true as const, payload: response.body };
          } catch (error) {
            console.log("[movie-comments-debug] public GET status", error instanceof ApiError ? error.status : null);
            console.log("[movie-comments-debug] public GET response", error instanceof Error ? error.message : String(error));
            return { ok: false as const, error };
          }
        })(),
        (async () => {
          console.log("[movie-comments-debug] directed GET url", joinApiUrl(directedEndpoint));
          const response = await fetchWithFallbacks<unknown>(directedEndpoints, "[movie-detail-debug]").then(
            ({ payload, endpoint, usedFallback }) => ({ ok: true as const, payload, endpoint, usedFallback }),
            (error) => ({ ok: false as const, error }),
          );

          if (response.ok) {
            console.log("[movie-comments-debug] directed GET endpoint", {
              endpoint: response.endpoint,
              usedFallback: response.usedFallback,
            });
            console.log("[movie-comments-debug] directed GET response", response.payload);
          } else {
            console.log("[movie-comments-debug] directed GET status", response.error instanceof ApiError ? response.error.status : null);
            console.log("[movie-comments-debug] directed GET response", response.error instanceof Error ? response.error.message : String(response.error));
          }

          return response.ok ? { ok: true as const, payload: response.payload } : { ok: false as const, error: response.error };
        })(),
      ]);

      if (!friendsResult.ok && friendsResult.error instanceof ApiError && friendsResult.error.status === 401) {
        router.replace("/login");
        return;
      }
      if (!meResult.ok && meResult.error instanceof ApiError && meResult.error.status === 401) {
        router.replace("/login");
        return;
      }

      if (!publicResult.ok && publicResult.error instanceof ApiError && publicResult.error.status === 401) {
        router.replace("/login");
        return;
      }

      if (!directedReceivedResult.ok && directedReceivedResult.error instanceof ApiError && directedReceivedResult.error.status === 401) {
        router.replace("/login");
        return;
      }

      if (friendsResult.ok) {
        console.log("[mentions-debug] Friends payload:", {
          endpoint: friendsResult.endpoint,
          usedFallback: friendsResult.usedFallback,
          payload: friendsResult.payload,
        });
        const normalizedFriends = parseFriends(friendsResult.payload);
        console.log("[mentions-debug] Normalized friends list:", normalizedFriends);
        setFriends(normalizedFriends);
      }
      if (meResult.ok) {
        const meUsername = getCurrentUsernameFromPayload(meResult.payload);
        if (meUsername) setAuthenticatedUsername(meUsername);
      }

      if (publicResult.ok) {
        const parsed = parseCommentsPage(publicResult.payload, "public");
        setPublicComments(parsed.comments);
        setPublicNext(normalizeEndpointPath(parsed.next));
        setPublicError("");
      } else {
        setPublicError("No pudimos cargar los comentarios públicos.");
      }

      if (directedReceivedResult.ok) {
        const meUsername = meResult.ok ? getCurrentUsernameFromPayload(meResult.payload) ?? "" : "";
        setDirectedConversations(groupDirectedConversations(directedReceivedResult.payload, meUsername, movieId));
        setDirectedError("");
      } else {
        setDirectedError("No pudimos cargar los comentarios dirigidos.");
      }

      setLoadingPublic(false);
      setLoadingDirected(false);
    };

    void loadData();
  }, [fetchMovieDetail, movieId, router]);

  const handleMovieRated = useCallback(
    async (_movieId: Movie["id"], score: number, _payload?: unknown) => {
      void _payload;
      try {
        const refreshedMovie = await fetchMovieDetail();
        if (refreshedMovie) {
          setMovie(refreshedMovie);
          setMovieError("");
          return;
        }
      } catch (error) {
        console.error("Movie refresh after rating failed:", error);
      }

      setMovie((current) => (current ? { ...current, myRating: score } : current));
    },
    [fetchMovieDetail],
  );

  useEffect(() => {
    console.log("[movie-comments-debug] render public count", publicComments.length);
  }, [publicComments.length]);

  useEffect(() => {
    console.log("[movie-comments-debug] render directed conversations count", directedConversations.length);
  }, [directedConversations.length]);

  const handleAuthorNavigation = useCallback(
    (username: string) => {
      if (!username) return;
      if (authenticatedUsername && username === authenticatedUsername) {
        router.push("/profile-feed");
        return;
      }
      router.push(`/users/${encodeURIComponent(username)}`);
    },
    [authenticatedUsername, router],
  );

  const appendPublicComments = useCallback(async () => {
    if (!publicNext || loadingPublicMore) return;
    setLoadingPublicMore(true);
    try {
      const payload = await apiFetch(publicNext);
      const parsed = parseCommentsPage(payload, "public");
      setPublicComments((current) => {
        const existing = new Set(current.map((comment) => String(comment.id)));
        const incoming = parsed.comments.filter((comment) => !existing.has(String(comment.id)));
        return [...current, ...incoming];
      });
      setPublicNext(normalizeEndpointPath(parsed.next));
    } catch {
      // keep current UI stable if infinite scroll fails
    } finally {
      setLoadingPublicMore(false);
    }
  }, [loadingPublicMore, publicNext]);

  const loadMoreConversationMessages = useCallback(
    async (conversationKey: string) => {
      const target = directedConversations.find((conversation) => conversation.key === conversationKey);
      if (!target?.next || loadingDirectedMoreByKey[conversationKey]) return;

      setLoadingDirectedMoreByKey((current) => ({ ...current, [conversationKey]: true }));
      try {
        const payload = await apiFetch(target.next);
        const parsed = parseCommentsPage(payload, "directed");
        setDirectedConversations((current) =>
          current.map((conversation) => {
            if (conversation.key !== conversationKey) return conversation;
            const existing = new Set(conversation.messages.map((message) => String(message.id)));
            const merged = [...conversation.messages, ...parsed.comments.filter((message) => !existing.has(String(message.id)))];
            return {
              ...conversation,
              messages: merged.sort((a, b) => (a.createdAt && b.createdAt ? b.createdAt.localeCompare(a.createdAt) : 0)),
              next: normalizeEndpointPath(parsed.next),
            };
          }),
        );
      } catch {
        // keep current UI stable if infinite scroll fails
      } finally {
        setLoadingDirectedMoreByKey((current) => ({ ...current, [conversationKey]: false }));
      }
    },
    [directedConversations, loadingDirectedMoreByKey],
  );

  const handleSubmitComment = async ({ text, mentionUsername }: { text: string; mentionUsername: string | null }) => {
    if (!movieId) return;

    setIsSubmitting(true);
    setComposerError("");

    try {
      const mode = mentionUsername ? "directed" : "public";
      const endpoint = mentionUsername ? buildMovieDirectedSubmitEndpoint(movieId) : buildMoviePublicSubmitEndpoint(movieId);
      const payload = mentionUsername ? { body: text, mentioned_username: mentionUsername } : { body: text };

      console.log("[movie-comments-debug] submit mode:", mode);
      console.log("[movie-comments-debug] submit url:", joinApiUrl(endpoint));
      console.log("[movie-comments-debug] submit payload:", payload);

      const submitResponse = await debugApiRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[movie-comments-debug] submit response status:", submitResponse.status);
      const parsedSubmittedComment = parseComments([submitResponse.body], mode)[0];

      if (mode === "directed") {
        try {
          const refreshed = await debugApiRequest(buildMovieDirectedSubmitEndpoint(movieId));
          setDirectedConversations(groupDirectedConversations(refreshed.body, authenticatedUsername, movieId));
          setDirectedError("");
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.status === 401) {
            router.replace("/login");
            return;
          }
          if (parsedSubmittedComment) {
            const counterpart = buildCounterpartData(parsedSubmittedComment, authenticatedUsername);
            const conversationKey = `conversation-${counterpart.counterpartKey}`;
            setDirectedConversations((current) => {
              const target = current.find((conversation) => conversation.key === conversationKey);
              const nextMessage: SocialComment = { ...parsedSubmittedComment, direction: counterpart.direction };
              if (!target) {
                return [
                  {
                    key: conversationKey,
                    counterpartKey: counterpart.counterpartKey,
                    otherUsername: counterpart.username,
                    otherDisplayName: counterpart.displayName,
                    otherAvatar: counterpart.avatar,
                    messages: [nextMessage],
                    next: null,
                    lastMessageAt: parsedSubmittedComment.createdAt,
                  },
                  ...current,
                ];
              }
              return current.map((conversation) =>
                conversation.key === conversationKey
                  ? {
                      ...conversation,
                      messages: [nextMessage, ...conversation.messages],
                      lastMessageAt: parsedSubmittedComment.createdAt,
                    }
                  : conversation,
              );
            });
            setExpandedConversationKey(conversationKey);
          }
        }
      } else {
        try {
          const refreshed = await debugApiRequest(buildMoviePublicSubmitEndpoint(movieId));
          const parsed = parseCommentsPage(refreshed.body, "public");
          setPublicComments(parsed.comments);
          setPublicNext(normalizeEndpointPath(parsed.next));
          setPublicError("");
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.status === 401) {
            router.replace("/login");
            return;
          }
          if (parsedSubmittedComment) {
            setPublicComments((current) => [parsedSubmittedComment, ...current]);
          }
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        console.log("[movie-comments-debug] submit response status:", error.status);
        console.log("[movie-comments-debug] submit response body on error:", error.message);
      }
      console.error("Comment submit error", error);
      setComposerError("No pudimos enviar tu comentario. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReact = async (commentId: number | string, reaction: ReactionType) => {
    setReactionError("");

    const previousPublic = publicComments;
    const previousConversations = directedConversations;

    setPublicComments((current) => applyReactionToCollection(current, commentId, reaction));
    setDirectedConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        messages: applyReactionToCollection(conversation.messages, commentId, reaction),
      })),
    );

    try {
      const endpoint = buildReactionEndpoint(commentId);
      const method = reaction === null ? "DELETE" : "PUT";
      const response = await apiFetch(
        endpoint,
        reaction === null
          ? {
              method,
            }
          : {
              method,
              body: JSON.stringify({ reaction }),
            },
      );

      setPublicComments((current) => applyReactionResultToCollection(current, commentId, response));
      setDirectedConversations((current) =>
        current.map((conversation) => ({
          ...conversation,
          messages: applyReactionResultToCollection(conversation.messages, commentId, response),
        })),
      );
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Reaction request failed", {
          commentId,
          endpoint: buildReactionEndpoint(commentId),
          method: reaction === null ? "DELETE" : "PUT",
          payload: reaction === null ? null : { reaction },
          status: error.status,
          responseBody: error.message,
        });
      } else {
        console.error("Reaction request failed", {
          commentId,
          endpoint: buildReactionEndpoint(commentId),
          method: reaction === null ? "DELETE" : "PUT",
          payload: reaction === null ? null : { reaction },
          error,
        });
      }
      setPublicComments(previousPublic);
      setDirectedConversations(previousConversations);
      setReactionError("No pudimos registrar tu reacción en este momento.");
    }
  };

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[1000px] space-y-6 px-4 py-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-zinc-100">Detalle de película</h1>
          <Link href="/feed" className="rounded-full border border-white/40 px-4 py-2 text-sm text-zinc-200 hover:border-white">
            Volver al feed
          </Link>
        </div>

        {movieLoading ? <div className="rounded-xl border border-white/15 bg-zinc-950/45 p-4 text-zinc-300">Cargando película...</div> : null}
        {!movieLoading && movieError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{movieError}</div>
        ) : null}
        {!movieLoading && !movieError && movie ? (
          <MovieCard movie={movie} variant="feed" linkToDetail={false} onRated={handleMovieRated} />
        ) : null}

        <CommentComposer friends={friends} onSubmit={handleSubmitComment} loading={isSubmitting} error={composerError} />

        {reactionError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{reactionError}</div> : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Comentarios públicos</h2>
          <CommentsList
            comments={publicComments}
            loading={loadingPublic}
            error={publicError}
            emptyMessage="Todavía no hay comentarios públicos para esta película."
            onReact={handleReact}
            onAuthorClick={handleAuthorNavigation}
            singleContainer
            onLoadMore={() => void appendPublicComments()}
            hasMore={Boolean(publicNext)}
            loadingMore={loadingPublicMore}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Comentarios Dirigidos</h2>
          {loadingDirected ? <div className="rounded-xl border border-white/15 bg-zinc-950/45 p-4 text-sm text-zinc-300">Cargando comentarios...</div> : null}
          {!loadingDirected && directedError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{directedError}</div>
          ) : null}
          {!loadingDirected && !directedError && directedConversations.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-4 text-sm text-zinc-400">
              No hay comentarios dirigidos para esta película.
            </div>
          ) : null}
          {!loadingDirected && !directedError ? (
            <div className="space-y-3">
              {directedConversations.map((conversation) => {
                const isExpanded = expandedConversationKey === conversation.key;
                return (
                  <article key={conversation.key} className="rounded-xl border border-white/15 bg-zinc-950/65 p-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() => setExpandedConversationKey((current) => (current === conversation.key ? null : conversation.key))}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-zinc-900 text-xs font-semibold text-zinc-200">
                          {conversation.otherAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={conversation.otherAvatar} alt={conversation.otherDisplayName} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            conversation.otherDisplayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{conversation.otherDisplayName}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-400">@{conversation.otherUsername}</p>
                            <span className="rounded-full border border-white/15 bg-black/25 px-2 py-0.5 text-[11px] text-zinc-300">
                              {conversation.messages.length}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">{isExpanded ? "Ocultar" : "Ver conversación"}</span>
                    </button>

                    {isExpanded ? (
                      <div
                        className="mt-3 max-h-[24rem] overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3"
                        onScroll={(event) => {
                          const target = event.currentTarget;
                          if (
                            conversation.next &&
                            !loadingDirectedMoreByKey[conversation.key] &&
                            target.scrollTop + target.clientHeight >= target.scrollHeight - 48
                          ) {
                            void loadMoreConversationMessages(conversation.key);
                          }
                        }}
                      >
                        <CommentsList
                          comments={conversation.messages}
                          emptyMessage="No hay mensajes en esta conversación."
                          onReact={handleReact}
                          onAuthorClick={handleAuthorNavigation}
                          singleContainer={false}
                          itemBadgeLabel={(message) =>
                            message.authorUsername === authenticatedUsername ? "Enviado" : "Recibido"
                          }
                        />
                        {loadingDirectedMoreByKey[conversation.key] ? (
                          <p className="pt-2 text-xs text-zinc-400">Cargando mensajes anteriores...</p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
