"use client";

export type PublicLocale = "es" | "en";

export default function PublicLanguageSelector({ locale, onChange }: { locale: PublicLocale; onChange: (locale: PublicLocale) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-full border border-violet-400/40 bg-zinc-950 p-1" role="group" aria-label={locale === "en" ? "Language" : "Idioma"}>
      {(["es", "en"] as const).map((language) => {
        const active = language === locale;
        return <button key={language} type="button" onClick={() => onChange(language)} aria-pressed={active} className={`min-w-11 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${active ? "bg-violet-500 text-white" : "text-zinc-400 hover:text-white"}`}>{language.toUpperCase()}</button>;
      })}
    </div>
  );
}
