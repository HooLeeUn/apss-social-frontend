"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeCountrySearchText, STREAMING_COUNTRY_OPTIONS, type StreamingCountry } from "../lib/streaming-countries";

interface StreamingCountrySelectorProps {
  country: StreamingCountry;
  onCountryChange: (country: StreamingCountry) => void | Promise<void>;
  disabled?: boolean;
  error?: string;
  className?: string;
  buttonId?: string;
  compact?: boolean;
}

export default function StreamingCountrySelector({
  country,
  onCountryChange,
  disabled = false,
  error = "",
  className = "",
  buttonId = "streaming-country-button",
  compact = false,
}: StreamingCountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (event.target instanceof Node && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeCountrySearchText(search);
    if (!normalizedQuery) return STREAMING_COUNTRY_OPTIONS;

    return STREAMING_COUNTRY_OPTIONS.filter((option) => {
      const normalizedName = normalizeCountrySearchText(option.name);
      const normalizedValue = normalizeCountrySearchText(option.value);
      return normalizedName.includes(normalizedQuery) || normalizedValue.includes(normalizedQuery);
    });
  }, [search]);

  const selectedOption = useMemo(
    () => STREAMING_COUNTRY_OPTIONS.find((option) => option.value === country) ?? STREAMING_COUNTRY_OPTIONS[0],
    [country],
  );

  return (
    <div ref={containerRef} className={`relative flex max-w-[88px] flex-col items-start gap-1 ${className}`}>
      <label htmlFor={buttonId} className="sr-only">
        País de streaming
      </label>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => {
          if (current) setSearch("");
          return !current;
        })}
        title={selectedOption.name}
        className={`${compact ? "h-8 rounded-lg" : "h-9 rounded-xl"} flex w-full items-center justify-between gap-1 border border-white/20 bg-zinc-900/95 px-2 py-1 text-xs font-semibold text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:border-white/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300/35 disabled:cursor-not-allowed disabled:opacity-70`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5" title={selectedOption.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedOption.flagSrc} alt="" aria-hidden="true" className="h-3.5 w-5 rounded-[2px] object-cover" />
          <span>{selectedOption.value}</span>
        </span>
        <span className="text-[10px] text-zinc-400">▾</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-10 z-40 w-64 overflow-hidden rounded-xl border border-white/20 bg-zinc-900/98 p-1 shadow-[0_14px_26px_rgba(0,0,0,0.5)]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar país"
            className="mb-1 h-8 w-full rounded-lg border border-white/10 bg-zinc-950/80 px-2 text-xs font-medium text-zinc-100 placeholder:text-zinc-500 focus:border-slate-300/45 focus:outline-none"
            aria-label="Buscar país de streaming"
          />
          <ul role="listbox" aria-label="País de streaming" className="streaming-country-scrollbar max-h-64 overflow-y-auto pr-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <li key={option.value} role="option" aria-selected={country === option.value}>
                  <button
                    type="button"
                    title={option.name}
                    onClick={() => {
                      setIsOpen(false);
                      setSearch("");
                      void onCountryChange(option.value);
                    }}
                    className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300/35 ${
                      country === option.value ? "bg-slate-500/25 text-slate-100" : "text-zinc-100 hover:bg-slate-600/25"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={option.flagSrc} alt="" aria-hidden="true" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
                      <span className="shrink-0">{option.value}</span>
                      <span className="truncate text-[11px] font-medium text-zinc-300">{option.name}</span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2 py-2 text-xs text-zinc-400">Sin resultados</li>
            )}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-[10px] text-red-300">{error}</p> : null}
    </div>
  );
}
