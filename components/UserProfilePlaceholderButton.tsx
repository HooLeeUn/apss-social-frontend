interface UserProfilePlaceholderButtonProps {
  label?: string;
  onClick?: () => void;
}

export default function UserProfilePlaceholderButton({
  label = "Perfil de usuario",
  onClick,
}: UserProfilePlaceholderButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-zinc-900/90 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-white/60 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 md:h-14 md:w-14"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 transition-colors duration-200 group-hover:text-zinc-100 md:h-6 md:w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
      </svg>
    </button>
  );
}
