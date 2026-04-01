"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CommentComposer from "../../../components/social/CommentComposer";
import CommentsList from "../../../components/social/CommentsList";
import MovieCard from "../../../components/MovieCard";
import { apiFetch, ApiError } from "../../../lib/api";
import { getToken } from "../../../lib/auth";
import { Movie, normalizeMovie } from "../../../lib/movies";
import {
  buildReactionEndpoint,
  COMMENT_CREATE_ENDPOINT,
  DIRECTED_COMMENTS_ENDPOINT,
  Friend,
  FRIENDS_ENDPOINT,
  parseComments,
  parseFriends,
  PUBLIC_COMMENTS_ENDPOINT,
  ReactionType,
  SocialComment,
} from "../../../lib/social";

type DirectedTab = "received" | "sent";

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function buildMovieIdQuery(movieId: string): string {
  return `?${new URLSearchParams({ movie_id: movieId }).toString()}`;
}

function buildDirectedQuery(movieId: string, box: DirectedTab): string {
  return `?${new URLSearchParams({ movie_id: movieId, box }).toString()}`;
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
        const moviePayload = await apiFetch(`/movies/${encodeURIComponent(movieId)}/`);
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

      const [friendsResult, publicResult, directedReceivedResult, directedSentResult] = await Promise.all([
        apiFetch(FRIENDS_ENDPOINT).then(
          (payload) => ({ ok: true as const, payload }),
          (error) => ({ ok: false as const, error }),
        ),
        apiFetch(`${PUBLIC_COMMENTS_ENDPOINT}${buildMovieIdQuery(movieId)}`).then(
          (payload) => ({ ok: true as const, payload }),
          (error) => ({ ok: false as const, error }),
        ),
        apiFetch(`${DIRECTED_COMMENTS_ENDPOINT}${buildDirectedQuery(movieId, "received")}`).then(
          (payload) => ({ ok: true as const, payload }),
          (error) => ({ ok: false as const, error }),
        ),
        apiFetch(`${DIRECTED_COMMENTS_ENDPOINT}${buildDirectedQuery(movieId, "sent")}`).then(
          (payload) => ({ ok: true as const, payload }),
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

      if (!directedReceivedResult.ok && directedReceivedResult.error instanceof ApiError && directedReceivedResult.error.status === 401) {
        router.replace("/login");
        return;
      }

      if (!directedSentResult.ok && directedSentResult.error instanceof ApiError && directedSentResult.error.status === 401) {
        router.replace("/login");
        return;
      }

      if (friendsResult.ok) {
        console.log("[mentions-debug] Friends endpoint response:", friendsResult.payload);
        const normalizedFriends = parseFriends(friendsResult.payload);
        console.log("[mentions-debug] Normalized friends list:", normalizedFriends);
        setFriends(normalizedFriends);
      }

      if (publicResult.ok) {
        setPublicComments(parseComments(publicResult.payload, "public"));
      } else {
        setPublicError("No pudimos cargar los comentarios públicos.");
      }

      if (directedReceivedResult.ok && directedSentResult.ok) {
        setDirectedReceived(parseComments(directedReceivedResult.payload, "directed"));
        setDirectedSent(parseComments(directedSentResult.payload, "directed"));
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

  const handleSubmitComment = async ({ text, mentionUsername }: { text: string; mentionUsername: string | null }) => {
    if (!movieId) return;

    setIsSubmitting(true);
    setComposerError("");

    try {
      const payload = {
        movie_id: movieId,
        text,
        ...(mentionUsername ? { mentioned_username: mentionUsername } : {}),
      };

      const response = await apiFetch(COMMENT_CREATE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const parsedComment = parseComments([response], mentionUsername ? "directed" : "public")[0];

      if (parsedComment) {
        if (mentionUsername) {
          setDirectedSent((current) => [parsedComment, ...current]);
          setDirectedTab("sent");
        } else {
          setPublicComments((current) => [parsedComment, ...current]);
        }
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
