import { apiFetch } from "./api";

export type VideoReactionKind = "like" | "dislike";

export interface VideoReactionComment {
  id: string | number;
  user: { id: string | number; username: string; avatar: string | null };
  video_url: string;
  likes_count: number;
  dislikes_count: number;
  my_reaction: VideoReactionKind | null;
  can_delete?: boolean;
}

interface VideoReactionPage {
  next?: string | null;
  results?: VideoReactionComment[];
}

function normalizeNextEndpoint(next: string | null | undefined): string | null {
  if (!next) return null;
  try {
    const url = new URL(next, window.location.origin);
    const apiIndex = url.pathname.indexOf("/api/");
    return `${apiIndex >= 0 ? url.pathname.slice(apiIndex + 4) : url.pathname}${url.search}`;
  } catch {
    return next.startsWith("/api/") ? next.slice(4) : next;
  }
}

/** Resolves the canonical reaction exactly as Mi actividad does, including paginated results. */
export async function resolveVideoReactionComment(movieId: string, videoCommentId: string): Promise<VideoReactionComment | null> {
  let endpoint: string | null = `/movies/${encodeURIComponent(movieId)}/video-comments/`;
  while (endpoint) {
    const page = await apiFetch(endpoint) as VideoReactionPage;
    const match = page.results?.find((video) => String(video.id) === videoCommentId);
    if (match) return match;
    endpoint = normalizeNextEndpoint(page.next);
  }
  return null;
}
