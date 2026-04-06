import Link from "next/link";
import { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description: string;
  footerText: string;
  footerLinkText: string;
  footerHref: string;
  children: ReactNode;
}

export default function AuthShell({
  title,
  description,
  footerText,
  footerLinkText,
  footerHref,
  children,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(120,120,120,0.12),_transparent_45%)]" />

      <div className="relative w-full max-w-md rounded-3xl border border-zinc-700/80 bg-zinc-950/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur sm:p-8">
        <header className="mb-6 space-y-2 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">APSS Social</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{title}</h1>
          <p className="text-sm leading-relaxed text-zinc-300">{description}</p>
        </header>

        {children}

        <p className="mt-6 text-center text-sm text-zinc-400 sm:mt-7">
          {footerText}{" "}
          <Link
            href={footerHref}
            className="font-medium text-zinc-100 underline decoration-zinc-500 underline-offset-4 transition hover:text-white hover:decoration-zinc-300"
          >
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
