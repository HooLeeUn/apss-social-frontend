import { Ref, useEffect, useRef } from "react";
import { useI18n } from "../../hooks/useI18n";
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
  canManageComment?: (comment: SocialComment) => boolean;
  editingCommentId?: string | null;
  editingValue?: string;
  onStartEdit?: (comment: SocialComment) => void;
  onEditValueChange?: (nextValue: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (comment: SocialComment) => void;
  savingEditCommentId?: string | null;
  onDeleteComment?: (comment: SocialComment) => Promise<void>;
  deletingCommentIds?: Record<string, boolean>;
  actionErrorByCommentId?: Record<string, string>;
  getDisplayText?: (comment: SocialComment) => string;
  borderlessContainer?: boolean;
  exposeDirectedCommentIds?: boolean;
  unboundedOnMobile?: boolean;
  desktopDarkScrollbar?: boolean;
  containerRef?: Ref<HTMLDivElement>;
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
  canManageComment,
  editingCommentId = null,
  editingValue = "",
  onStartEdit,
  onEditValueChange,
  onCancelEdit,
  onSaveEdit,
  savingEditCommentId = null,
  onDeleteComment,
  deletingCommentIds = {},
  actionErrorByCommentId = {},
  getDisplayText,
  borderlessContainer = false,
  exposeDirectedCommentIds = false,
  unboundedOnMobile = false,
  desktopDarkScrollbar = false,
  containerRef,
}: CommentsListProps) {
  const { t } = useI18n();
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "160px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (loading) {
    return (
      <div className={borderlessContainer ? "p-4 text-sm text-zinc-300" : "rounded-xl border border-white/15 bg-zinc-950/45 p-4 text-sm text-zinc-300"}>{t("movieDetailLoadingComments")}</div>
    );
  }

  if (error) {
    return <div className={borderlessContainer ? "p-4 text-sm text-red-200" : "rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"}>{error}</div>;
  }

  if (comments.length === 0) {
    return <div className={borderlessContainer ? "p-4 text-sm text-zinc-400" : "rounded-xl border border-white/10 bg-zinc-950/45 p-4 text-sm text-zinc-400"}>{emptyMessage}</div>;
  }

  if (!singleContainer) {
    return (
      <div className="space-y-0">
        {comments.map((comment, index) => (
          <div
            key={comment.id}
            className={index === 0 ? "" : "border-t border-white/10"}
            data-directed-comment-id={exposeDirectedCommentIds ? String(comment.id) : undefined}
            data-directed-comment-direction={exposeDirectedCommentIds ? comment.direction : undefined}
          >
            <CommentItem
              comment={comment}
              onReact={onReact}
              onAuthorClick={onAuthorClick}
              showCard={false}
              badgeLabel={itemBadgeLabel?.(comment)}
              canManage={canManageComment?.(comment) ?? false}
              isEditing={editingCommentId !== null && String(comment.id) === editingCommentId}
              editValue={editingValue}
              onStartEdit={onStartEdit}
              onEditValueChange={onEditValueChange}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              savingEdit={savingEditCommentId !== null && String(comment.id) === savingEditCommentId}
              onDelete={onDeleteComment}
              deleting={Boolean(deletingCommentIds[String(comment.id)])}
              actionError={actionErrorByCommentId[String(comment.id)]}
              displayText={getDisplayText?.(comment)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${desktopDarkScrollbar ? "desktop-dark-scrollbar " : ""}${
        unboundedOnMobile
          ? borderlessContainer
            ? "px-1 py-2 lg:scrollbar-dark lg:max-h-[28rem] lg:overflow-y-auto"
            : "rounded-xl border border-white/15 bg-zinc-950/65 p-4 lg:scrollbar-dark lg:max-h-[28rem] lg:overflow-y-auto"
          : borderlessContainer
            ? "scrollbar-dark max-h-[28rem] overflow-y-auto px-1 py-2"
            : "scrollbar-dark max-h-[28rem] overflow-y-auto rounded-xl border border-white/15 bg-zinc-950/65 p-4"
      }`}
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
          <div
            key={comment.id}
            className={index === 0 ? "" : "border-t border-white/10"}
            data-directed-comment-id={exposeDirectedCommentIds ? String(comment.id) : undefined}
            data-directed-comment-direction={exposeDirectedCommentIds ? comment.direction : undefined}
          >
            <CommentItem
              comment={comment}
              onReact={onReact}
              onAuthorClick={onAuthorClick}
              showCard={false}
              badgeLabel={itemBadgeLabel?.(comment)}
              canManage={canManageComment?.(comment) ?? false}
              isEditing={editingCommentId !== null && String(comment.id) === editingCommentId}
              editValue={editingValue}
              onStartEdit={onStartEdit}
              onEditValueChange={onEditValueChange}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              savingEdit={savingEditCommentId !== null && String(comment.id) === savingEditCommentId}
              onDelete={onDeleteComment}
              deleting={Boolean(deletingCommentIds[String(comment.id)])}
              actionError={actionErrorByCommentId[String(comment.id)]}
              displayText={getDisplayText?.(comment)}
            />
          </div>
        ))}
      </div>
      {loadingMore ? <p className="pt-2 text-xs text-zinc-400">{t("movieDetailLoadingMoreComments")}</p> : null}
      {hasMore ? <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-1" /> : null}
    </div>
  );
}
