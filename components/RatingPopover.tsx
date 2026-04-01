"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";

interface RatingPopoverProps {
  movieId: number | string;
  currentRating: number | null;
  onRated: (score: number) => void;
  className?: string;
}

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export default function RatingPopover({ movieId, currentRating, onRated, className = "" }: RatingPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [selectedFlash, setSelectedFlash] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const previewScore = hoveredScore ?? currentRating;

  const displayScore = useMemo(() => {
    if (previewScore === null || Number.isNaN(previewScore)) return "-";
    return Number(previewScore).toFixed(1);
  }, [previewScore]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
      setHoveredScore(null);
      setError("");
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const submitRating = async (score: number) => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      setError("");
      await apiFetch(`/movies/${encodeURIComponent(String(movieId))}/rating/`, {
        method: "PUT",
        body: JSON.stringify({ score }),
      });
      onRated(score);
      setSelectedFlash(score);
      setIsOpen(false);
      setHoveredScore(null);
      window.setTimeout(() => setSelectedFlash(null), 220);
    } catch (submitError) {
      console.error("Rating submit error:", submitError);
      if (submitError instanceof ApiError) {
        setError("No se pudo guardar tu puntaje.");
      } else {
        setError("Error inesperado al guardar.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          if (isSaving) return;
          setIsOpen((value) => !value);
          setError("");
        }}
        disabled={isSaving}
        className={`inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900/80 px-2 py-1 text-sm font-semibold text-zinc-100 transition-all hover:border-white/35 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 ${
          selectedFlash !== null ? "scale-[1.02] ring-1 ring-emerald-400/70" : ""
        }`}
        aria-label="Mi puntaje"
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">🙋</span>
        <span>{currentRating !== null ? currentRating.toFixed(1) : "Mi puntaje"}</span>
        {isSaving ? <span className="text-[11px] text-zinc-400">Guardando...</span> : null}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[260px] rounded-xl border border-white/15 bg-zinc-950/95 p-3 shadow-[0_18px_30px_rgba(0,0,0,0.55)] backdrop-blur"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
        >
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-zinc-400">Calificar película</p>
          <p className="mb-2 text-sm text-zinc-200">Tu calificación: {displayScore}</p>

          <div className="grid grid-cols-5 gap-1.5">
            {RATING_OPTIONS.map((score) => {
              const isActive = previewScore !== null && score <= previewScore;

              return (
                <button
                  key={score}
                  type="button"
                  disabled={isSaving}
                  onMouseEnter={() => setHoveredScore(score)}
                  onMouseLeave={() => setHoveredScore(null)}
                  onFocus={() => setHoveredScore(score)}
                  onBlur={() => setHoveredScore(null)}
                  onClick={() => void submitRating(score)}
                  className={`rounded-md border px-0 py-1.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "border-yellow-400/80 bg-yellow-400/20 text-yellow-200"
                      : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-white/30 hover:bg-zinc-800"
                  } ${isSaving ? "cursor-not-allowed opacity-70" : "hover:scale-[1.03]"}`}
                >
                  {score}
                </button>
              );
            })}
          </div>

          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
