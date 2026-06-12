import type { Locale } from "./i18n";

const KNOWN_FOR_DEPARTMENT_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    Acting: "Acting",
    Directing: "Directing",
    Writing: "Writing",
    Production: "Production",
    Camera: "Camera",
    Editing: "Editing",
    Sound: "Sound",
    Art: "Art",
    "Costume & Make-Up": "Costume & Make-Up",
    "Visual Effects": "Visual Effects",
    Crew: "Crew",
  },
  es: {
    Acting: "Actuación",
    Directing: "Dirección",
    Writing: "Guion",
    Production: "Producción",
    Camera: "Cámara",
    Editing: "Edición",
    Sound: "Sonido",
    Art: "Arte",
    "Costume & Make-Up": "Vestuario y maquillaje",
    "Visual Effects": "Efectos visuales",
    Crew: "Equipo técnico",
  },
};

export function translateKnownForDepartment(value: string | null | undefined, locale: Locale): string | null | undefined {
  if (!value) return value;
  return KNOWN_FOR_DEPARTMENT_LABELS[locale][value] ?? value;
}
