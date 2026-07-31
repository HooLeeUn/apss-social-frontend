interface RatingIconProps {
  className?: string;
}

export function RatingSmileIcon({ className = "h-4 w-4" }: RatingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}

export function RatingUserSmileIcon({ className = "h-4 w-4" }: RatingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0M10.5 8.5a2.2 2.2 0 0 0 3 0" />
    </svg>
  );
}
