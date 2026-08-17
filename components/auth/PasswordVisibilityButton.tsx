interface PasswordVisibilityButtonProps {
  visible: boolean;
  showLabel: string;
  hideLabel: string;
  onToggle: () => void;
}

export default function PasswordVisibilityButton({ visible, showLabel, hideLabel, onToggle }: PasswordVisibilityButtonProps) {
  return (
    <button
      type="button"
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onToggle}
      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.75" />
        {visible ? <path d="m4 4 16 16" /> : null}
      </svg>
    </button>
  );
}
