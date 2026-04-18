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
        className={`inline-flex h-9 w-9 items-center justify-center p-1.5 text-zinc-600 ${className}`.trim()}
      >
        <CommentBubbleIcon />
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`Ver comentarios de ${title}`}
      className={`inline-flex h-9 w-9 items-center justify-center p-1.5 text-zinc-200/90 transition-all duration-200 hover:scale-[1.04] hover:text-zinc-50 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.2)] focus-visible:outline-none focus-visible:text-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`.trim()}
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
