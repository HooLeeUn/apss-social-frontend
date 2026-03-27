import { ReactionType, SocialComment } from "../../lib/social";

interface ReactionButtonsProps {
  comment: SocialComment;
  onReact: (commentId: number | string, reaction: ReactionType) => Promise<void>;
  disabled?: boolean;
}

export default function ReactionButtons({ comment, onReact, disabled = false }: ReactionButtonsProps) {
  const handleClick = (reaction: Exclude<ReactionType, null>) => {
    const nextReaction = comment.myReaction === reaction ? null : reaction;
    void onReact(comment.id, nextReaction);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleClick("like")}
        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
          comment.myReaction === "like"
            ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
            : "border-white/20 bg-black/20 text-zinc-300 hover:border-white/40"
        }`}
      >
        👍 {comment.likesCount}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => handleClick("dislike")}
        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
          comment.myReaction === "dislike"
            ? "border-rose-400/70 bg-rose-500/20 text-rose-200"
            : "border-white/20 bg-black/20 text-zinc-300 hover:border-white/40"
        }`}
      >
        👎 {comment.dislikesCount}
      </button>
    </div>
  );
}
