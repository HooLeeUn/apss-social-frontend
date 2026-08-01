import type { ReactNode } from "react";

interface EmptyStatePanelProps {
  title?: string;
  description: string;
  icon: ReactNode;
  logoUrl?: string | null;
  layout?: "vertical" | "horizontal";
  className?: string;
}

export default function EmptyStatePanel({
  title,
  description,
  icon,
  logoUrl,
  layout = "vertical",
  className = "",
}: EmptyStatePanelProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <div
      className={`flex min-w-0 max-w-full items-center justify-center px-3 py-6 text-center ${
        isHorizontal ? "flex-col gap-4 sm:flex-row sm:gap-5" : "flex-col gap-3"
      } ${className}`}
    >
      {title ? <p className="max-w-xl text-sm font-semibold leading-relaxed text-zinc-200 sm:text-base">{title}</p> : null}
      <div className="shrink-0 text-3xl leading-none sm:text-4xl" aria-hidden="true">
        {icon}
      </div>
      <p className="max-w-xl break-words text-sm leading-relaxed text-zinc-400 sm:text-[15px]">{description}</p>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="QNext" className="mt-1 h-auto max-h-12 w-auto max-w-[8rem] object-contain sm:max-w-[10rem]" />
      ) : null}
    </div>
  );
}
