import { AppBranding, BrandingLogoSlot, resolveBrandingLogoUrl } from "../lib/branding";

interface AppLogoProps {
  branding: AppBranding | null;
  slot: BrandingLogoSlot;
  alt: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}

export default function AppLogo({ branding, slot, alt, className, imageClassName, textClassName }: AppLogoProps) {
  const logoUrl = resolveBrandingLogoUrl(branding, slot);
  const appName = branding?.app_name || "MiAppSocialMovies";

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={alt} className={imageClassName || className} loading="lazy" decoding="async" />
    );
  }

  return <span className={textClassName || className}>{appName}</span>;
}
