import { SocialComment } from "../../lib/social";
import CommentItem from "./CommentItem";

interface CommentsListProps {
  comments: SocialComment[];
  emptyMessage: string;
  error?: string;
  loading?: boolean;
  onReact: (commentId: number | string, reaction: "like" | "dislike" | null) => Promise<void>;
}

export default function CommentsList({ comments, emptyMessage, error, loading = false, onReact }: CommentsListProps) {
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

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} onReact={onReact} />
      ))}
    </div>
  );
}
