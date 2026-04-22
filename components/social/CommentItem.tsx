import { formatSocialDate, SocialComment } from "../../lib/social";
import ReactionButtons from "./ReactionButtons";

interface CommentItemProps {
  comment: SocialComment;
  onReact: (commentId: number | string, reaction: "like" | "dislike" | null) => Promise<void>;
  disabled?: boolean;
  showCard?: boolean;
  badgeLabel?: string;
  onAuthorClick?: (username: string) => void;
}

export default function CommentItem({
  comment,
  onReact,
  disabled = false,
  showCard = true,
  badgeLabel,
  onAuthorClick,
}: CommentItemProps) {
  const initial = comment.authorName.charAt(0).toUpperCase() || "U";

  return (
    <article className={showCard ? "rounded-xl border border-white/15 bg-zinc-950/65 p-4" : "py-3"}>
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onAuthorClick?.(comment.authorUsername)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-zinc-900 text-xs font-semibold text-zinc-200"
          >
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comment.authorAvatar} alt={comment.authorName} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              initial
            )}
          </button>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onAuthorClick?.(comment.authorUsername)}
              className="truncate text-sm font-semibold text-zinc-100 hover:text-white hover:underline"
            >
              {comment.authorName}
            </button>
            <p className="text-xs text-zinc-400">{formatSocialDate(comment.createdAt)}</p>
          </div>
        </div>

        <span className="rounded-full border border-white/15 bg-black/25 px-2 py-1 text-[11px] font-medium text-zinc-300">
          {badgeLabel ?? (comment.type === "public" ? "Público" : "Dirigido")}
        </span>
      </header>


      <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{comment.text}</p>

      <ReactionButtons comment={comment} onReact={onReact} disabled={disabled} />
    </article>
  );
}
