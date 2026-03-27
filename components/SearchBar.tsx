"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  initialQuery?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  showSearchIcon?: boolean;
}

export default function SearchBar({
  initialQuery = "",
  className,
  inputClassName,
  buttonClassName,
  showSearchIcon = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      router.push("/search");
      return;
    }

    const params = new URLSearchParams({ q: trimmed });
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className={`flex w-full gap-2 ${className ?? ""}`.trim()}>
      <div className="relative flex-1">
        {showSearchIcon ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        ) : null}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar películas, género o año"
          className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ${
            showSearchIcon ? "pl-10" : ""
          } ${inputClassName ?? ""}`.trim()}
        />
      </div>
      <button
        type="submit"
        className={`rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 ${buttonClassName ?? ""}`.trim()}
      >
        Buscar
      </button>
    </form>
  );
}
