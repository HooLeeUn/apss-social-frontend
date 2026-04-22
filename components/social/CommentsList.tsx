import { SocialComment } from "../../lib/social";
import CommentItem from "./CommentItem";

interface CommentsListProps {
  comments: SocialComment[];
  emptyMessage: string;
  error?: string;
  loading?: boolean;
  onReact: (commentId: number | string, reaction: "like" | "dislike" | null) => Promise<void>;
  onAuthorClick?: (username: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  singleContainer?: boolean;
  itemBadgeLabel?: (comment: SocialComment) => string;
}

export default function CommentsList({
  comments,
  emptyMessage,
  error,
  loading = false,
  onReact,
  onAuthorClick,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  singleContainer = false,
  itemBadgeLabel,
}: CommentsListProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/15 bg-zinc-950/45 p-4 text-sm text-zinc-300">Cargando comentarios...</div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>;
  }

  if (comments.length === 0) {
    return <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-4 text-sm text-zinc-400">{emptyMessage}</div>;
  }

  if (!singleContainer) {
    return (
      <div className="space-y-0">
        {comments.map((comment, index) => (
          <div key={comment.id} className={index === 0 ? "" : "border-t border-white/10"}>
            <CommentItem
              comment={comment}
              onReact={onReact}
              onAuthorClick={onAuthorClick}
              showCard={false}
              badgeLabel={itemBadgeLabel?.(comment)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="scrollbar-dark max-h-[28rem] overflow-y-auto rounded-xl border border-white/15 bg-zinc-950/65 p-4"
      onScroll={(event) => {
        if (!hasMore || loadingMore || !onLoadMore) return;
        const target = event.currentTarget;
        if (target.scrollTop + target.clientHeight >= target.scrollHeight - 48) {
          onLoadMore();
        }
      }}
    >
      <div className="space-y-0">
        {comments.map((comment, index) => (
          <div key={comment.id} className={index === 0 ? "" : "border-t border-white/10"}>
            <CommentItem
              comment={comment}
              onReact={onReact}
              onAuthorClick={onAuthorClick}
              showCard={false}
              badgeLabel={itemBadgeLabel?.(comment)}
            />
          </div>
        ))}
      </div>
      {loadingMore ? <p className="pt-2 text-xs text-zinc-400">Cargando más comentarios...</p> : null}
    </div>
  );
}
