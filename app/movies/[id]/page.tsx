"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  COMMENT_CREATE_ENDPOINT,
  Friend,
  FRIENDS_ENDPOINT,
  FRIENDS_FALLBACK_ENDPOINTS,
  parseComments,
  parseFriends,
  ReactionType,
  SocialComment,
} from "../../../lib/social";

type DirectedTab = "received" | "sent";

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function buildMoviePublicCommentsEndpoint(movieId: string): string {
  return `/movies/${encodeURIComponent(movieId)}/comments/`;
}

function buildMovieDirectedCommentsEndpoint(movieId: string): string {
  return `/movies/${encodeURIComponent(movieId)}/comments/directed/`;
}

function joinApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
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

export default function MovieDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const movieId = params?.id ? String(params.id) : "";

  const [movie, setMovie] = useState<Movie | null>(null);
  const [movieLoading, setMovieLoading] = useState(true);
  const [movieError, setMovieError] = useState("");

  const [friends, setFriends] = useState<Friend[]>([]);

  const [publicComments, setPublicComments] = useState<SocialComment[]>([]);
  const [directedReceived, setDirectedReceived] = useState<SocialComment[]>([]);
  const [directedSent, setDirectedSent] = useState<SocialComment[]>([]);

  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingDirected, setLoadingDirected] = useState(true);

  const [publicError, setPublicError] = useState("");
  const [directedError, setDirectedError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [reactionError, setReactionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [directedTab, setDirectedTab] = useState<DirectedTab>("received");

  const fetchPublicComments = async (id: string) => {
    const endpoint = buildMoviePublicCommentsEndpoint(id);
    console.log("[movie-comments-debug] public GET url", joinApiUrl(endpoint));
    const response = await debugApiRequest(endpoint);
    console.log("[movie-comments-debug] public GET status", response.status);
    console.log("[movie-comments-debug] public GET response", response.body);
    return parseComments(response.body, "public");
  };

  const fetchDirectedComments = async (id: string) => {
    const endpoint = buildMovieDirectedCommentsEndpoint(id);
    console.log("[movie-comments-debug] directed GET url", joinApiUrl(endpoint));
    const response = await debugApiRequest(endpoint);
    console.log("[movie-comments-debug] directed GET status", response.status);
    console.log("[movie-comments-debug] directed GET response", response.body);
    const root = toRecord(response.body);
    if (root && Array.isArray(root.received) && Array.isArray(root.sent)) {
      return {
        received: parseComments(root.received, "directed"),
        sent: parseComments(root.sent, "directed"),
      };
    }

    const parsed = parseComments(response.body, "directed");
    return {
      received: parsed,
      sent: parsed,
    };
  };

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
        const movieEndpoints = [
          buildMovieDetailEndpoint(movieId, MOVIE_DETAIL_ENDPOINT_TEMPLATE),
          ...MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES.map((template) => buildMovieDetailEndpoint(movieId, template)),
        ];

        let moviePayload: unknown = null;
        let movieLoaded = false;

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
            moviePayload = response.body;
            movieLoaded = true;
            break;
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

        if (!movieLoaded) {
          throw new Error("No se pudo cargar detalle con endpoints disponibles");
        }

        const rawMovie = toRecord(moviePayload);

        if (!rawMovie) {
          setMovieError("No se pudo interpretar la película seleccionada.");
        } else {
          setMovie(normalizeMovie(rawMovie, 0));
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

      const [friendsResult, publicResult, directedResult] = await Promise.all([
        fetchWithFallbacks<unknown>([FRIENDS_ENDPOINT, ...FRIENDS_FALLBACK_ENDPOINTS], "[mentions-debug]").then(
          ({ payload, endpoint, usedFallback }) => ({ ok: true as const, payload, endpoint, usedFallback }),
          (error) => ({ ok: false as const, error }),
        ),
        fetchPublicComments(movieId).then(
          (comments) => ({ ok: true as const, comments }),
          (error) => ({ ok: false as const, error }),
        ),
        fetchDirectedComments(movieId).then(
          (directed) => ({ ok: true as const, directed }),
          (error) => ({ ok: false as const, error }),
        ),
      ]);

      if (!friendsResult.ok && friendsResult.error instanceof ApiError && friendsResult.error.status === 401) {
        router.replace("/login");
        return;
      }

      if (!publicResult.ok && publicResult.error instanceof ApiError && publicResult.error.status === 401) {
        router.replace("/login");
        return;
      }

      if (!directedResult.ok && directedResult.error instanceof ApiError && directedResult.error.status === 401) {
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

      if (publicResult.ok) {
        setPublicComments(publicResult.comments);
        setPublicError("");
      } else {
        setPublicError("No pudimos cargar los comentarios públicos.");
      }

      if (directedResult.ok) {
        setDirectedReceived(directedResult.directed.received);
        setDirectedSent(directedResult.directed.sent);
        setDirectedError("");
      } else {
        setDirectedError("No pudimos cargar las recomendaciones dirigidas.");
      }

      setLoadingPublic(false);
      setLoadingDirected(false);
    };

    void loadData();
  }, [movieId, router]);

  const displayedDirectedComments = useMemo(
    () => (directedTab === "received" ? directedReceived : directedSent),
    [directedReceived, directedSent, directedTab],
  );

  useEffect(() => {
    console.log("[movie-comments-debug] render public count", publicComments.length);
  }, [publicComments]);

  useEffect(() => {
    console.log("[movie-comments-debug] render directed count", displayedDirectedComments.length);
  }, [displayedDirectedComments]);

  const handleSubmitComment = async ({ text, mentionUsername }: { text: string; mentionUsername: string | null }) => {
    if (!movieId) return;

    setIsSubmitting(true);
    setComposerError("");

    try {
      const payloadCandidates = [
        {
          movie: movieId,
          text,
          ...(mentionUsername ? { mentioned_username: mentionUsername } : {}),
        },
        {
          movie_id: movieId,
          text,
          ...(mentionUsername ? { mentioned_username: mentionUsername } : {}),
        },
        {
          movie: movieId,
          text,
          ...(mentionUsername ? { recipient_username: mentionUsername } : {}),
        },
      ];

      let submitSuccess = false;
      let lastError: unknown = null;

      for (const payload of payloadCandidates) {
        console.log("[movie-detail-debug] submit request", {
          url: joinApiUrl(COMMENT_CREATE_ENDPOINT),
          endpoint: COMMENT_CREATE_ENDPOINT,
          method: "POST",
          payload,
        });

        try {
          const submitResponse = await debugApiRequest(COMMENT_CREATE_ENDPOINT, {
            method: "POST",
            body: JSON.stringify(payload),
          });

          console.log("[movie-detail-debug] submit response", {
            url: submitResponse.url,
            endpoint: COMMENT_CREATE_ENDPOINT,
            method: submitResponse.method,
            status: submitResponse.status,
          });

          submitSuccess = true;
          break;
        } catch (error) {
          lastError = error;
          console.log("[movie-detail-debug] submit response", {
            url: joinApiUrl(COMMENT_CREATE_ENDPOINT),
            endpoint: COMMENT_CREATE_ENDPOINT,
            method: "POST",
            status: error instanceof ApiError ? error.status : null,
            body: error instanceof Error ? error.message : String(error),
          });

          if (!(error instanceof ApiError) || ![400, 404, 405].includes(error.status)) {
            throw error;
          }
        }
      }

      if (!submitSuccess) {
        throw lastError ?? new Error("No se pudo enviar comentario con payloads disponibles");
      }

      if (mentionUsername) {
        const directed = await fetchDirectedComments(movieId);
        setDirectedReceived(directed.received);
        setDirectedSent(directed.sent);
        setDirectedError("");
        setDirectedTab("sent");
      } else {
        const comments = await fetchPublicComments(movieId);
        setPublicComments(comments);
        setPublicError("");
      }
    } catch (error) {
      console.error("Comment submit error", error);
      setComposerError("No pudimos enviar tu comentario. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReact = async (commentId: number | string, reaction: ReactionType) => {
    setReactionError("");

    const previousPublic = publicComments;
    const previousReceived = directedReceived;
    const previousSent = directedSent;

    setPublicComments((current) => applyReactionToCollection(current, commentId, reaction));
    setDirectedReceived((current) => applyReactionToCollection(current, commentId, reaction));
    setDirectedSent((current) => applyReactionToCollection(current, commentId, reaction));

    try {
      await apiFetch(buildReactionEndpoint(commentId), {
        method: "POST",
        body: JSON.stringify({ reaction }),
      });
    } catch (error) {
      console.error("Reaction error", error);
      setPublicComments(previousPublic);
      setDirectedReceived(previousReceived);
      setDirectedSent(previousSent);
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
        {!movieLoading && !movieError && movie ? <MovieCard movie={movie} variant="feed" linkToDetail={false} /> : null}

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
          />
        </section>

        <section className="space-y-3">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Recomendaciones dirigidas</h2>
            <div className="flex rounded-full border border-white/20 p-1">
              <button
                type="button"
                onClick={() => setDirectedTab("received")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  directedTab === "received" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300"
                }`}
              >
                Recibidas
              </button>
              <button
                type="button"
                onClick={() => setDirectedTab("sent")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  directedTab === "sent" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300"
                }`}
              >
                Enviadas
              </button>
            </div>
          </header>

          <CommentsList
            comments={displayedDirectedComments}
            loading={loadingDirected}
            error={directedError}
            emptyMessage={
              directedTab === "received"
                ? "No tienes recomendaciones privadas recibidas para esta película."
                : "Aún no enviaste recomendaciones privadas para esta película."
            }
            onReact={handleReact}
          />
        </section>
      </div>
    </main>
  );
}
