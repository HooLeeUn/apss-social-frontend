import Link from "next/link";

interface CommentDetailButtonProps {
  href?: string | null;
  title: string;
  className?: string;
}

export default function CommentDetailButton({ href, title, className = "" }: CommentDetailButtonProps) {
  if (!href) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-zinc-900/55 text-zinc-600 ${className}`.trim()}
      >
        <CommentBubbleIcon />
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`Ver comentarios de ${title}`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-zinc-900/80 text-zinc-100 shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition hover:border-zinc-200/80 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`.trim()}
    >
      <CommentBubbleIcon />
    </Link>
  );
}

function CommentBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17.4c-2 0-3.6-1.5-3.6-3.5V7.8C3.4 5.8 5 4.2 7 4.2h10c2 0 3.6 1.6 3.6 3.6V14c0 2-1.6 3.5-3.6 3.5h-5.2L8 20.8v-3.4H7Z" />
    </svg>
  );
}
