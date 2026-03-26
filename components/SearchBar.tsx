"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  initialQuery?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

export default function SearchBar({
  initialQuery = "",
  className,
  inputClassName,
  buttonClassName,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

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
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar películas, género o año"
        className={`flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ${inputClassName ?? ""}`.trim()}
      />
      <button
        type="submit"
        className={`rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 ${buttonClassName ?? ""}`.trim()}
      >
        Buscar
      </button>
    </form>
  );
}
