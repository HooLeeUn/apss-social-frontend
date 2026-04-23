import Link from "next/link";
import AppLogo from "../AppLogo";
import { AppBranding, BrandingLogoSlot } from "../../lib/branding";

interface ProfileIdentityCardProps {
  username: string;
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  ageVisible?: boolean | null;
  genderIdentity?: string | null;
  genderIdentityVisible?: boolean | null;
  appTitle?: string;
  appBranding?: AppBranding | null;
  logoSlot?: BrandingLogoSlot;
}

function formatGender(gender: string): string {
  switch (gender) {
    case "male":
      return "Hombre";
    case "female":
      return "Mujer";
    case "non_binary":
      return "No binario";
    case "prefer_not_to_say":
      return "Prefiero no decirlo";
    default:
      return gender;
  }
}

export default function ProfileIdentityCard({
  username,
  avatarUrl = null,
  firstName = null,
  lastName = null,
  age = null,
  ageVisible = null,
  genderIdentity = null,
  genderIdentityVisible = null,
  appTitle = "MiAppSocialMovies",
  appBranding = null,
  logoSlot = "profile_feed_logo_url",
}: ProfileIdentityCardProps) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const canShowGender = genderIdentityVisible !== false && Boolean(genderIdentity);
  const canShowAge = ageVisible !== false && typeof age === "number" && Number.isFinite(age);
  const initials = (username || "U").slice(0, 2).toUpperCase();

  return (
    <div className="relative flex min-h-[220px] w-full flex-col gap-5 overflow-hidden rounded-3xl border border-white/15 bg-zinc-900/75 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_55%)] opacity-75" />

      <div className="relative flex items-start justify-between gap-4">
        <Link
          href="/feed"
          className="inline-flex min-h-[62px] min-w-[164px] items-center justify-center rounded-2xl border border-white/20 bg-zinc-950/75 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-100 transition hover:border-blue-200/70 hover:text-blue-100"
          aria-label="Ir al feed principal"
        >
          <AppLogo
            branding={appBranding}
            slot={logoSlot}
            alt={appTitle}
            className="h-10 w-auto max-w-[160px] object-contain"
            textClassName="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-100"
          />
        </Link>

        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/20 bg-zinc-800/90">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`Avatar de @${username}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-200">{initials}</div>
          )}
        </div>
      </div>

      <div className="relative min-w-0 space-y-2">
        <p className="truncate text-sm uppercase tracking-[0.18em] text-zinc-500">usuario</p>
        <p className="truncate text-2xl font-semibold text-zinc-100">@{username}</p>
        {fullName ? <p className="truncate text-base font-medium text-zinc-300">{fullName}</p> : null}
      </div>

      <div className="relative mt-auto flex flex-wrap items-center gap-2">
        {canShowGender ? (
          <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300">
            {formatGender(genderIdentity as string)}
          </span>
        ) : null}
        {canShowAge ? (
          <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300">
            {age} Años
          </span>
        ) : null}
      </div>
    </div>
  );
}
