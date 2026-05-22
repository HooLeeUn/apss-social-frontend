"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLogo from "../../components/AppLogo";
import { useAppBranding } from "../../hooks/useAppBranding";
import { ApiError } from "../../lib/api";
import { getPoliciesContent, PoliciesContent } from "../../lib/policies";

const IMDB_COPY = [
  "Parte de la información de películas y series utilizada en QNext, incluyendo títulos, años, tipo, directores, casting, géneros, número de votos y calificaciones promedio de referencia, proviene de IMDb.",
  "QNext es una plataforma independiente y no está afiliada oficialmente, respaldada, certificada ni patrocinada por IMDb.",
];

export default function PoliciesPage() {
  const router = useRouter();
  const branding = useAppBranding();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [policies, setPolicies] = useState<PoliciesContent | null>(null);

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const data = await getPoliciesContent();
        setPolicies(data);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 401) {
          router.replace("/login");
          return;
        }
        setError("No se pudieron cargar las políticas en este momento.");
      } finally {
        setLoading(false);
      }
    };

    void loadPolicies();
  }, [router]);

  const isEmptyContent = useMemo(() => !policies || policies.sections.length === 0, [policies]);

  if (loading) return <main className="min-h-screen bg-black text-zinc-100"><div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6"><p className="text-lg text-zinc-300">Cargando políticas…</p></div></main>;

  if (error) return <main className="min-h-screen bg-black text-zinc-100"><div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-6 px-6 text-center"><p className="text-lg text-zinc-300">{error}</p><Link href="/feed" className="rounded-lg border border-violet-300/45 px-5 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-200 hover:text-violet-100">Volver al feed</Link></div></main>;

  if (isEmptyContent) return <main className="min-h-screen bg-black text-zinc-100"><div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-5 px-6 text-center"><p className="text-zinc-300">No hay contenido legal disponible.</p><Link href="/feed" className="text-sm font-medium text-blue-200 underline underline-offset-4">Volver al feed</Link></div></main>;

  return (
    <main className="scrollbar-dark min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-8 md:py-12">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-5">
          <h1 className="text-3xl font-semibold tracking-wide text-white md:text-5xl">Políticas y Términos</h1>
          <Link href="/feed" className="inline-flex items-center rounded-lg border border-white/10 bg-zinc-950/80 px-2 py-1.5 transition hover:border-violet-300/50" aria-label="Volver al feed">
            <AppLogo branding={branding} slot="privacy_security_logo_url" alt="Volver al feed" className="block h-10 w-auto max-w-[190px] object-contain object-center" textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200" />
          </Link>
        </header>

        <div className="space-y-9 text-base leading-8 text-zinc-200 md:text-[17px]">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-violet-300 md:text-2xl">Fecha de última actualización</h2>
            <p>{policies?.lastUpdated || "No disponible"}</p>
          </section>

          {policies?.sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold text-violet-300 md:text-2xl">{section.title}</h2>
              {section.blocks.map((block, index) => (
                block.type === "bullet" ? <ul key={`${section.title}-bullet-${index}`} className="list-disc space-y-1 pl-6"><li>{block.text}</li></ul> : <p key={`${section.title}-${index}`}>{block.text}</p>
              ))}

              {section.title.toLowerCase().includes("créditos") && (
                <>
                  <p>{IMDB_COPY[0]}</p>
                  <p>{IMDB_COPY[1]}</p>
                  <div className="mt-4 flex items-center gap-4">
                    <Image src="/brand/tmdb.svg" alt="TMDB" width={110} height={56} className="h-auto w-[110px] opacity-85" />
                    <div className="space-y-1 text-sm leading-6 text-zinc-300">
                      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
                      <p>Los posters y sinopsis utilizados en QNext provienen de TMDB.</p>
                    </div>
                  </div>
                </>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12"><Link href="/feed" className="inline-flex rounded-lg border border-violet-300/45 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:border-violet-200 hover:text-violet-100">Volver al feed</Link></div>
      </div>
    </main>
  );
}
