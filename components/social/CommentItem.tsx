import { formatSocialDate, SocialComment } from "../../lib/social";
import ReactionButtons from "./ReactionButtons";

interface CommentItemProps {
  comment: SocialComment;
  onReact: (commentId: number | string, reaction: "like" | "dislike" | null) => Promise<void>;
  disabled?: boolean;
}

export default function CommentItem({ comment, onReact, disabled = false }: CommentItemProps) {
  const initial = comment.authorName.charAt(0).toUpperCase() || "U";

  return (
    <article className="rounded-xl border border-white/15 bg-zinc-950/65 p-4">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-zinc-900 text-xs font-semibold text-zinc-200">
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comment.authorAvatar} alt={comment.authorName} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">{comment.authorName}</p>
            <p className="text-xs text-zinc-400">{formatSocialDate(comment.createdAt)}</p>
          </div>
        </div>

        <span className="rounded-full border border-white/15 bg-black/25 px-2 py-1 text-[11px] font-medium text-zinc-300">
          {comment.type === "public" ? "Público" : "Dirigido"}
        </span>
      </header>

      {comment.recipientName && comment.type === "directed" ? (
        <p className="mb-1 text-xs text-zinc-400">Para @{comment.recipientName}</p>
      ) : null}

      <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{comment.text}</p>

      <ReactionButtons comment={comment} onReact={onReact} disabled={disabled} />
    </article>
  );
}
