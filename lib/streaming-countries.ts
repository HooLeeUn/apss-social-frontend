import type { Country } from "./i18n";

export type StreamingCountry = Country;
export type StreamingCountryOption = { value: StreamingCountry; name: string; flagSrc: string };

export const STREAMING_COUNTRY_OPTIONS: StreamingCountryOption[] = [
  { value: "AR", name: "Argentina", flagSrc: "/flags/ar.svg" },
  { value: "BO", name: "Bolivia", flagSrc: "/flags/bo.svg" },
  { value: "BZ", name: "Belize", flagSrc: "/flags/bz.svg" },
  { value: "CA", name: "Canadá", flagSrc: "/flags/ca.svg" },
  { value: "CL", name: "Chile", flagSrc: "/flags/cl.svg" },
  { value: "CO", name: "Colombia", flagSrc: "/flags/co.svg" },
  { value: "CR", name: "Costa Rica", flagSrc: "/flags/cr.svg" },
  { value: "DO", name: "República Dominicana", flagSrc: "/flags/do.svg" },
  { value: "EC", name: "Ecuador", flagSrc: "/flags/ec.svg" },
  { value: "ES", name: "España", flagSrc: "/flags/es.svg" },
  { value: "GT", name: "Guatemala", flagSrc: "/flags/gt.svg" },
  { value: "HN", name: "Honduras", flagSrc: "/flags/hn.svg" },
  { value: "MX", name: "México", flagSrc: "/flags/mx.svg" },
  { value: "NI", name: "Nicaragua", flagSrc: "/flags/ni.svg" },
  { value: "PA", name: "Panamá", flagSrc: "/flags/pa.svg" },
  { value: "PE", name: "Perú", flagSrc: "/flags/pe.svg" },
  { value: "PR", name: "Puerto Rico", flagSrc: "/flags/pr.svg" },
  { value: "PY", name: "Paraguay", flagSrc: "/flags/py.svg" },
  { value: "SV", name: "El Salvador", flagSrc: "/flags/sv.svg" },
  { value: "UK", name: "Reino Unido", flagSrc: "/flags/uk.svg" },
  { value: "US", name: "Estados Unidos", flagSrc: "/flags/us.svg" },
  { value: "UY", name: "Uruguay", flagSrc: "/flags/uy.svg" },
  { value: "VE", name: "Venezuela", flagSrc: "/flags/ve.svg" },
];

export function normalizeCountrySearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
