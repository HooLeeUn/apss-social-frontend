"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLogo from "../../components/AppLogo";
import { useAppBranding } from "../../hooks/useAppBranding";
import { ApiError } from "../../lib/api";
import { getPoliciesContent, PoliciesContent } from "../../lib/policies";

const FALLBACK_PERSONAL_DATA = "Tratamos datos personales bajo la Ley 1581 de 2012 de Colombia y, cuando corresponda en Estados Unidos, bajo CCPA/CPRA. Esto incluye derechos de acceso, actualización, rectificación (artículo 8), autorización del titular (artículo 9), y deberes de seguridad, confidencialidad y tratamiento adecuado (artículos 17 y 18). También utilizamos datos agregados, anonimizados o seudonimizados para fines estadísticos, analíticos, académicos y para mejorar recomendaciones y experiencia, sin identificar usuarios individualmente. El uso de QNext está restringido para mayores de 13 años.";

const FALLBACK_INTELLECTUAL_PROPERTY = "QNext conserva todos los derechos sobre su marca, logo, identidad visual, diseño, experiencia de usuario, estructura, textos propios, rankings, sistemas de recomendación, compilaciones, código, arquitectura y funcionalidades propias. Está prohibida la copia, plagio, scraping, extracción masiva, ingeniería inversa, reproducción, distribución, uso comercial no autorizado o clonación visual/funcional. Los datos externos de IMDb/TMDB pertenecen a sus titulares. El contenido generado por usuarios es responsabilidad de quien lo publica, y QNext puede mostrarlo y procesarlo dentro de la plataforma, además de retirar contenido que infrinja derechos, privacidad, seguridad o convivencia.";

function toParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

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

  const isEmptyContent = useMemo(() => {
    if (!policies) return true;
    return !Object.values(policies).some((value) => value.trim().length > 0);
  }, [policies]);

  if (loading) return <main className="min-h-screen bg-black text-zinc-100"><div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6"><p className="text-lg text-zinc-300">Cargando políticas…</p></div></main>;

  if (error) return <main className="min-h-screen bg-black text-zinc-100"><div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-6 px-6 text-center"><p className="text-lg text-zinc-300">{error}</p><Link href="/feed" className="rounded-lg border border-violet-300/45 px-5 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-200 hover:text-violet-100">Volver al feed</Link></div></main>;

  if (isEmptyContent) return <main className="min-h-screen bg-black text-zinc-100"><div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-5 px-6 text-center"><p className="text-zinc-300">No hay contenido de políticas disponible.</p><Link href="/feed" className="text-sm font-medium text-blue-200 underline underline-offset-4">Volver al feed</Link></div></main>;

  return (
    <main className="scrollbar-dark min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-8 md:py-12">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-5">
          <h1 className="text-3xl font-semibold tracking-wide text-zinc-100 md:text-5xl">Políticas y Términos</h1>
          <Link href="/feed" className="inline-flex items-center rounded-lg border border-white/10 bg-zinc-950/80 px-2 py-1.5 transition hover:border-violet-300/50" aria-label="Volver al feed">
            <AppLogo branding={branding} slot="privacy_security_logo_url" alt="Volver al feed" className="block h-10 w-auto max-w-[190px] object-contain object-center" textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200" />
          </Link>
        </header>

        <div className="space-y-8 text-[15px] leading-8 text-zinc-300 md:text-base">
          <section className="space-y-3"><h2 className="text-xl font-semibold text-violet-300 md:text-2xl">Fecha de última actualización</h2><p>{policies?.lastUpdated || "No disponible"}</p></section>
          <section className="space-y-3"><h2 className="text-xl font-semibold text-violet-300 md:text-2xl">Información general</h2>{toParagraphs(policies?.generalInformation || "").map((paragraph, index) => <p key={`general-${index}`}>{paragraph}</p>)}</section>
          <section className="space-y-3"><h2 className="text-xl font-semibold text-violet-300 md:text-2xl">Créditos y fuentes</h2>{toParagraphs(policies?.creditsAndSources || "").map((paragraph, index) => <p key={`credits-${index}`}>{paragraph}</p>)}<p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><p>Los posters y sinopsis utilizados en QNext provienen de TMDB.</p><p>QNext es una plataforma independiente y no está afiliada oficialmente, respaldada, certificada ni patrocinada por IMDb o TMDB.</p></section>
          <section className="space-y-3"><h2 className="text-xl font-semibold text-violet-300 md:text-2xl">Sistema de calificaciones</h2>{toParagraphs(policies?.ratingSystem || "").map((paragraph, index) => <p key={`ratings-${index}`}>{paragraph}</p>)}</section>
          <section className="space-y-3"><h2 className="text-xl font-semibold text-violet-300 md:text-2xl">Perfil público inicial</h2>{toParagraphs(policies?.initialPublicProfile || "").map((paragraph, index) => <p key={`profile-${index}`}>{paragraph}</p>)}</section>
          <section className="space-y-3"><h2 className="text-xl font-semibold text-blue-300 md:text-2xl">Tratamiento de Datos Personales</h2>{toParagraphs(policies?.personalDataTreatment || FALLBACK_PERSONAL_DATA).map((paragraph, index) => <p key={`data-${index}`}>{paragraph}</p>)}</section>
          <section className="space-y-3"><h2 className="text-xl font-semibold text-blue-300 md:text-2xl">Propiedad Intelectual de QNext</h2>{toParagraphs(policies?.intellectualProperty || FALLBACK_INTELLECTUAL_PROPERTY).map((paragraph, index) => <p key={`ip-${index}`}>{paragraph}</p>)}</section>
        </div>

        <div className="mt-12"><Link href="/feed" className="inline-flex rounded-lg border border-violet-300/45 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:border-violet-200 hover:text-violet-100">Volver al feed</Link></div>
      </div>
    </main>
  );
}
