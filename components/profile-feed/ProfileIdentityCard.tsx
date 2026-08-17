import Link from "next/link";
import AppLogo from "../AppLogo";
import { AppBranding, BrandingLogoSlot } from "../../lib/branding";

interface ProfileIdentityCardProps {
  username: string;
  isLoading?: boolean;
  stabilizeMobileHeight?: boolean;
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
  autoHeight?: boolean;
  userLabel?: string;
  formatAge?: (age: number) => string;
  followersCount?: number | null;
  formatFollowers?: (count: number) => string;
  avatarHref?: string;
  avatarLinkLabel?: string;
  constrainDesktopAvatar?: boolean;
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
  isLoading = false,
  stabilizeMobileHeight = false,
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
  autoHeight = false,
  userLabel = "usuario",
  formatAge = (value) => `${value} Años`,
  followersCount = null,
  formatFollowers = (count) => count === 1 ? "Tiene 1 seguidor" : `Tiene ${count} seguidores`,
  avatarHref,
  avatarLinkLabel,
  constrainDesktopAvatar = false,
}: ProfileIdentityCardProps) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const canShowGender = genderIdentityVisible !== false && Boolean(genderIdentity);
  const canShowAge = ageVisible !== false && typeof age === "number" && Number.isFinite(age);
  const initials = (username || "U").slice(0, 2).toUpperCase();
  const canShowFollowers = typeof followersCount === "number" && Number.isFinite(followersCount);
  const followersCopy = canShowFollowers ? formatFollowers(followersCount) : null;
  const hasVisiblePersonalData = canShowGender || canShowAge || canShowFollowers;
  const shouldRenderPersonalData = autoHeight ? hasVisiblePersonalData : true;
  const cardHeightClass = autoHeight ? "h-fit min-h-0 self-start" : "min-h-[220px]";
  const personalDataSpacingClass = autoHeight ? "mt-0" : "mt-auto";
  const stableMobileHeightClass = stabilizeMobileHeight ? "min-h-[264px] md:min-h-[220px]" : "";
  const avatarClassName = `relative top-24 block h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/20 bg-zinc-800/90 ${constrainDesktopAvatar ? "lg:mr-1 lg:top-20 lg:h-[72px] lg:w-[72px]" : ""}`;
  const cardClassName = `relative mx-auto flex w-full min-w-0 max-w-full box-border flex-col gap-5 overflow-hidden rounded-3xl border border-white/15 bg-zinc-900/75 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)] ${cardHeightClass} ${stableMobileHeightClass}`;

  if (isLoading) {
    return (
      <div className={cardClassName} aria-busy="true" aria-label="Cargando perfil">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_55%)] opacity-75" />
        <div className="relative flex min-w-0 items-start justify-between gap-4" aria-hidden="true">
          <div className="h-[68px] min-w-0 flex-1 animate-pulse rounded-xl bg-white/5" />
          <div className="relative top-24 h-20 w-20 shrink-0 animate-pulse rounded-full border border-white/10 bg-zinc-800/90" />
        </div>
        <div className="relative min-w-0 space-y-2 pr-24" aria-hidden="true">
          <div className="h-4 w-20 max-w-full animate-pulse rounded bg-white/5" />
          <div className="h-7 w-40 max-w-full animate-pulse rounded bg-white/10" />
          <div className="h-5 w-32 max-w-full animate-pulse rounded bg-white/5" />
        </div>
        <div className="relative mt-auto h-6 w-24 max-w-full animate-pulse rounded-full bg-white/5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={cardClassName}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_55%)] opacity-75" />

      <div className="relative flex min-w-0 items-start justify-between gap-4">
        <Link
          href="/feed"
          className="inline-flex min-h-[68px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-transparent px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-100 transition hover:text-blue-100 md:min-w-[188px] md:flex-initial"
          aria-label="Ir al feed principal"
        >
          <AppLogo
            branding={appBranding}
            slot={logoSlot}
            alt={appTitle}
            className="block h-12 min-w-0 w-auto max-w-full object-contain object-center md:max-w-[184px]"
            textClassName="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-100"
          />
        </Link>

        {avatarHref ? <Link href={avatarHref} aria-label={avatarLinkLabel} className={`${avatarClassName} cursor-pointer`}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`Avatar de @${username}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-200">{initials}</div>
          )}
        </Link> : <div className={avatarClassName}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`Avatar de @${username}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-200">{initials}</div>
          )}
        </div>}
      </div>

      <div className="relative min-w-0 space-y-2 pr-24">
        <p className="truncate text-sm uppercase tracking-[0.18em] text-zinc-500">{userLabel}</p>
        <p
          className="truncate overflow-hidden text-ellipsis whitespace-nowrap text-2xl font-semibold text-zinc-100"
          title={`@${username}`}
        >
          @{username}
        </p>
        {fullName ? (
          <p
            className="truncate overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium text-zinc-300"
            title={fullName}
          >
            {fullName}
          </p>
        ) : null}
      </div>

      {shouldRenderPersonalData ? (
        <div className={`relative flex flex-wrap items-center gap-2 ${personalDataSpacingClass}`}>
          {canShowGender ? (
            <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300">
              {formatGender(genderIdentity as string)}
            </span>
          ) : null}
          {canShowAge ? (
            <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300">
              {formatAge(age)}
            </span>
          ) : null}
          {canShowFollowers && !canShowAge ? (
            <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300">
              {followersCopy}
            </span>
          ) : null}
        </div>
      ) : null}

      {canShowFollowers && canShowAge ? (
        <div className="absolute bottom-5 right-5 max-w-[55%] rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-right text-xs text-zinc-300">
          {followersCopy}
        </div>
      ) : null}
    </div>
  );
}
