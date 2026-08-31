"use client";

import Link from "next/link";
import { ReactNode } from "react";
import AppLogo from "../AppLogo";
import { BrandingLogoSlot } from "../../lib/branding";
import { useAppBranding } from "../../hooks/useAppBranding";

interface AuthShellProps {
  title: string;
  description: string;
  footerText: string;
  footerLinkText: string;
  footerHref: string;
  brandingSlot: BrandingLogoSlot;
  children: ReactNode;
  fitMobileViewport?: boolean;
  headerAction?: ReactNode;
  logoAlt?: string;
}

export default function AuthShell({
  title,
  description,
  footerText,
  footerLinkText,
  footerHref,
  brandingSlot,
  children,
  fitMobileViewport = false,
  headerAction,
  logoAlt = "Logo de la app",
}: AuthShellProps) {
  const branding = useAppBranding();
  const shellClassName = fitMobileViewport
    ? "fixed inset-0 flex h-[100dvh] items-center justify-center overflow-hidden bg-black px-4 py-3 sm:relative sm:inset-auto sm:h-auto sm:min-h-screen sm:px-6 sm:py-12 lg:px-8"
    : "relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-8 sm:px-6 sm:py-12 lg:px-8";
  const cardClassName = fitMobileViewport
    ? "relative w-full max-w-[29.5rem] rounded-[1.75rem] border border-zinc-700/70 bg-zinc-950/90 px-5 py-5 shadow-[0_26px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl sm:px-8 sm:py-9"
    : "relative w-full max-w-[29.5rem] rounded-[1.75rem] border border-zinc-700/70 bg-zinc-950/90 px-6 py-7 shadow-[0_26px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl sm:px-8 sm:py-9";
  const headerClassName = fitMobileViewport ? "mb-4 space-y-2 sm:mb-9 sm:space-y-2.5" : "mb-7 space-y-2.5 sm:mb-9";
  const logoClassName = fitMobileViewport
    ? "block h-16 w-auto max-w-[320px] object-contain object-center sm:h-[4.5rem]"
    : "block h-16 w-auto max-w-[320px] object-contain object-center sm:h-[4.5rem]";
  const titleClassName = fitMobileViewport
    ? "text-[1.75rem] font-semibold tracking-tight text-zinc-50 sm:text-[2.1rem]"
    : "text-[2rem] font-semibold tracking-tight text-zinc-50 sm:text-[2.1rem]";
  const footerClassName = fitMobileViewport ? "mt-4 text-center text-sm text-zinc-400 sm:mt-8" : "mt-7 text-center text-sm text-zinc-400 sm:mt-8";

  return (
    <div className={shellClassName}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_52%),radial-gradient(circle_at_bottom,_rgba(120,120,120,0.14),_transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%,rgba(255,255,255,0.03)_100%)]" />

      <div className={cardClassName}>
        <header className={headerClassName}>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <AppLogo
              branding={branding}
              slot={brandingSlot}
              alt={logoAlt}
              className={`${logoClassName} min-w-0 max-w-[min(18rem,calc(100%-6rem))]`}
              textClassName="text-[0.69rem] font-semibold uppercase tracking-[0.25em] text-zinc-400/90"
            />
            {headerAction ? <div className="relative z-20 shrink-0">{headerAction}</div> : null}
          </div>
          <h1 className={titleClassName}>{title}</h1>
          <p className="max-w-prose text-[0.94rem] leading-relaxed text-zinc-300">{description}</p>
        </header>

        {children}

        <p className={footerClassName}>
          {footerText}{" "}
          <Link
            href={footerHref}
            className="font-medium text-zinc-100 underline decoration-zinc-500/90 underline-offset-4 transition hover:text-white hover:decoration-zinc-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
