"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLogo from "../../components/AppLogo";
import { useAppBranding } from "../../hooks/useAppBranding";
import { ApiError } from "../../lib/api";
import { getLegalPolicies, LegalSection } from "../../lib/legal";

export default function PoliciesPage() {
  const branding = useAppBranding();
  const router = useRouter();
  const [title, setTitle] = useState("Políticas y Términos");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sections, setSections] = useState<LegalSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const payload = await getLegalPolicies();
        setTitle(payload.title);
        setLastUpdated(payload.lastUpdated);
        setSections(payload.sections);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 401) {
          setError("Tu sesión expiró. Inicia sesión nuevamente para consultar esta información.");
        } else {
          setError("No se pudieron cargar las políticas en este momento.");
        }
      } finally {
        setLoading(false);
      }
    };

    void loadPolicies();
  }, []);

  const hasLegalContent = useMemo(() => sections.length > 0, [sections]);

  const normalizePolicyParagraph = (paragraph: string) =>
    paragraph
      .replace(
        "Al crear cuenta, el usuario reconoce que su perfil se crea inicialmente como público.",
        "Al crear una cuenta, el usuario reconoce que su perfil se crea inicialmente como público.",
      )
      .replace(
        "La visibilidad de calificaciones, comentarios, recomendaciones, seguidores, amigos y datos personales depende de la configuración del perfil y permisos definidos por el usuario.",
        "La visibilidad de calificaciones, comentarios, recomendaciones y datos personales depende de la configuración del perfil y permisos definidos por el usuario.",
      );

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-zinc-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-7">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => router.push("/feed")}
            className="group rounded-2xl p-1 transition duration-200 hover:-translate-y-0.5 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
            aria-label="Ir al feed"
          >
            <AppLogo
              branding={branding}
              slot="feed_logo_url"
              alt="Logo de QNext"
              className="text-xl font-semibold tracking-[0.24em] text-zinc-200 transition duration-200 group-hover:text-white"
              imageClassName="h-12 w-auto object-contain opacity-95 drop-shadow-[0_8px_22px_rgba(124,58,237,0.28)] transition duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_10px_26px_rgba(167,139,250,0.35)]"
            />
          </button>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          {lastUpdated ? <p className="text-sm text-zinc-400">Última actualización: {lastUpdated}</p> : null}
        </header>

        {loading ? <p className="text-zinc-300">Cargando políticas…</p> : null}

        {!loading && error ? (
          <section className="space-y-4">
            <p className="text-zinc-300">{error}</p>
            <Link
              href="/feed"
              className="inline-flex rounded-full border border-zinc-500 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-300 hover:bg-zinc-900"
            >
              Volver al feed
            </Link>
          </section>
        ) : null}

        {!loading && !error && !hasLegalContent ? <p className="text-zinc-300">No hay contenido legal disponible.</p> : null}

        {!loading && !error && hasLegalContent ? (
          <div className="space-y-10 pb-8">
            {sections.map((section, index) => (
              <section key={`${section.subtitle}-${index}`} className="space-y-4">
                <h2 className="text-xl font-semibold text-violet-300">{section.subtitle}</h2>
                <div className="space-y-3 text-[15px] leading-8 text-zinc-200">
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={`${section.subtitle}-${paragraphIndex}`}>{normalizePolicyParagraph(paragraph)}</p>
                  ))}
                  {section.showTmdbAttribution ? (
                    <div className="space-y-3 pt-2">
                      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
                      <p>Los posters y sinopsis utilizados en QNext provienen de TMDB.</p>
                      <p>
                        Parte de la información de películas y series utilizada en QNext, incluyendo títulos, años,
                        tipo, directores, casting, géneros, número de votos y calificaciones promedio de referencia,
                        proviene de IMDb.
                      </p>
                      <img src="/brand/tmdb.svg" alt="TMDB" className="h-7 w-auto opacity-80" loading="lazy" />
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
