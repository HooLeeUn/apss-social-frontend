interface RatingIconProps {
  className?: string;
}

export function RatingPersonRaisingHandIcon({ className = "h-4 w-4" }: RatingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 21c.35-4.7 2.15-7 5.5-7 2.15 0 3.65.95 4.55 2.85M12 14l3-3V4M15 4l2-2M15 4l-2-2M15 4h3" />
    </svg>
  );
}
