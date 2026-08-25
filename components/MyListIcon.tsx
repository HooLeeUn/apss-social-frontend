type MyListIconProps = {
  className?: string;
};

export default function MyListIcon({ className = "h-7 w-7" }: MyListIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13 13 20l-9-9V4h7l9 9Z" />
      <circle cx="8" cy="8" r="1" />
    </svg>
  );
}
