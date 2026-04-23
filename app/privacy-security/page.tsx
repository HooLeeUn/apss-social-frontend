"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api";
import AppLogo from "../../components/AppLogo";
import { useAppBranding } from "../../hooks/useAppBranding";
import {
  blockUser,
  BlockedUser,
  getBlockedUsers,
  getProfileVisibility,
  ProfileVisibility,
  searchUsersToRestrict,
  unblockUser,
  updateProfileVisibility,
} from "../../lib/privacy";

const privacyDisclaimer = [
  "Todos los perfiles se crean como públicos por defecto, pero puedes cambiar esta configuración cuando quieras.",
  "Los perfiles públicos pueden recibir seguidores, seguir perfiles públicos y también tener amistades.",
  "Los perfiles privados no pueden ser seguidos, pero sí pueden seguir perfiles públicos y mantener amistades.",
  "Si cambias tu perfil a privado, perderás tus seguidores actuales, pero conservarás los perfiles que ya sigues.",
  "Tus comentarios públicos seguirán siendo visibles aunque tu perfil sea privado.",
  "Si restringes a un usuario, esa persona no podrá acceder a tu perfil ni al contenido que el backend le oculte por restricción.",
];

export default function PrivacySecurityPage() {
  const router = useRouter();
  const branding = useAppBranding();

  const [visibility, setVisibility] = useState<ProfileVisibility>("public");
  const [loadingVisibility, setLoadingVisibility] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const [showConfirmPrivate, setShowConfirmPrivate] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedUsersLoading, setBlockedUsersLoading] = useState(true);
  const [blockedUsersMessage, setBlockedUsersMessage] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState<BlockedUser[]>([]);
  const [dismissedSearchResultIds, setDismissedSearchResultIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedVisibility, loadedBlockedUsers] = await Promise.all([getProfileVisibility(), getBlockedUsers()]);

        setVisibility(loadedVisibility);
        setBlockedUsers(loadedBlockedUsers);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }

        setVisibilityMessage("No se pudo cargar tu configuración de privacidad.");
        setBlockedUsersMessage("No se pudo cargar la lista de usuarios restringidos.");
      } finally {
        setLoadingVisibility(false);
        setBlockedUsersLoading(false);
      }
    };

    void loadData();
  }, [router]);

  const blockedIds = useMemo(() => new Set(blockedUsers.map((user) => String(user.id))), [blockedUsers]);
  const normalizeSearchQuery = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (!trimmed.startsWith("@")) return trimmed;

    const usernamePart = trimmed.slice(1).trim();
    return usernamePart ? `@${usernamePart}` : "";
  };
  const hasSearchQuery = normalizeSearchQuery(searchQuery).length > 0;
  const visibleSearchResults = useMemo(
    () =>
      searchResults.filter(
        (user) => !blockedIds.has(String(user.id)) && !dismissedSearchResultIds.has(String(user.id)),
      ),
    [blockedIds, dismissedSearchResultIds, searchResults],
  );

  const refreshBlockedUsers = async () => {
    const refreshed = await getBlockedUsers();
    setBlockedUsers(refreshed);
  };

  const executeVisibilityUpdate = async (nextVisibility: ProfileVisibility) => {
    setSavingVisibility(true);
    setVisibilityMessage("");

    try {
      const updatedVisibility = await updateProfileVisibility(nextVisibility);
      setVisibility(updatedVisibility);
      setVisibilityMessage("Configuración de privacidad actualizada correctamente.");
    } catch {
      setVisibilityMessage("No se pudo actualizar el tipo de perfil. Inténtalo de nuevo.");
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleVisibilityChange = async (nextVisibility: ProfileVisibility) => {
    if (savingVisibility || nextVisibility === visibility) return;

    if (visibility === "public" && nextVisibility === "private") {
      setShowConfirmPrivate(true);
      return;
    }

    await executeVisibilityUpdate(nextVisibility);
  };

  const handleSearchUsers = async () => {
    const normalizedQuery = normalizeSearchQuery(searchQuery);
    if (!normalizedQuery) {
      setHasSearched(false);
      setSearchResults([]);
      setDismissedSearchResultIds(new Set());
      setSearchMessage("");
      return;
    }

    setHasSearched(true);
    setSearchMessage("");
    setSearchingUsers(true);

    try {
      const results = await searchUsersToRestrict(normalizedQuery);
      const uniqueResults = results.filter((user, index, current) => {
        const userId = String(user.id);
        return current.findIndex((entry) => String(entry.id) === userId) === index;
      });

      setSearchResults(uniqueResults);
      setDismissedSearchResultIds(new Set());

      if (uniqueResults.length === 0) {
        setSearchMessage("Sin resultados");
      }
    } catch {
      setSearchResults([]);
      setSearchMessage("No se pudo completar la búsqueda de usuarios.");
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleBlockUser = async (user: BlockedUser) => {
    const alreadyBlocked = blockedIds.has(String(user.id));
    if (alreadyBlocked) {
      setBlockedUsersMessage("Ese usuario ya está restringido.");
      return;
    }

    try {
      await blockUser(user.id);
      await refreshBlockedUsers();
      setSearchResults((current) => current.filter((entry) => String(entry.id) !== String(user.id)));
      setDismissedSearchResultIds((current) => {
        const next = new Set(current);
        next.delete(String(user.id));
        return next;
      });
      setBlockedUsersMessage(`${user.username} fue restringido correctamente.`);
    } catch {
      setBlockedUsersMessage("No se pudo restringir ese usuario.");
    }
  };

  const handleCancelSearchResult = (userId: number | string) => {
    setDismissedSearchResultIds((current) => {
      const next = new Set(current);
      next.add(String(userId));
      return next;
    });
  };

  const handleUnblockUser = async (user: BlockedUser) => {
    try {
      await unblockUser(user.id);
      await refreshBlockedUsers();
      setBlockedUsersMessage(`Se quitó la restricción para ${user.username}.`);
    } catch {
      setBlockedUsersMessage("No se pudo quitar la restricción en este momento.");
    }
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-[980px] space-y-6 px-4 py-7 md:px-8 md:py-8">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
          <h1 className="text-xl font-semibold tracking-wide text-zinc-100 md:text-2xl">Privacidad y Seguridad</h1>
          <Link
            href="/feed"
            className="inline-flex items-center overflow-hidden rounded-lg bg-transparent px-1 py-1 transition"
            aria-label="Volver al feed"
          >
            <AppLogo
              branding={branding}
              slot="privacy_security_logo_url"
              alt="Volver al feed"
              className="block h-11 w-auto max-w-[220px] object-contain object-center"
              textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200"
            />
          </Link>
        </header>

        <section className="rounded-3xl border border-blue-300/20 bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-black p-5 shadow-[0_20px_45px_rgba(0,0,0,0.42)]">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.25em] text-blue-200/85">Condiciones de privacidad</p>
          </div>
          <ul className="space-y-2 text-sm leading-6 text-zinc-200 md:text-[0.95rem]">
            {privacyDisclaimer.map((item) => (
              <li key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">Tipo de perfil</h2>
            {loadingVisibility ? <span className="text-xs text-zinc-400">Cargando...</span> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={savingVisibility || loadingVisibility}
              onClick={() => void handleVisibilityChange("public")}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                visibility === "public"
                  ? "border-blue-200/80 bg-blue-500/20 text-blue-100"
                  : "border-white/20 bg-zinc-900/70 text-zinc-200 hover:border-white/40"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className="text-sm font-semibold">Público</p>
              <p className="mt-1 text-xs text-zinc-300">Puede recibir seguidores y mantener amistades.</p>
            </button>

            <button
              type="button"
              disabled={savingVisibility || loadingVisibility}
              onClick={() => void handleVisibilityChange("private")}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                visibility === "private"
                  ? "border-blue-200/80 bg-blue-500/20 text-blue-100"
                  : "border-white/20 bg-zinc-900/70 text-zinc-200 hover:border-white/40"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className="text-sm font-semibold">Privado</p>
              <p className="mt-1 text-xs text-zinc-300">No puede ser seguido, pero sí mantener amistades.</p>
            </button>
          </div>

          {savingVisibility ? <p className="mt-3 text-sm text-zinc-300">Guardando cambios...</p> : null}
          {visibilityMessage ? <p className="mt-3 text-sm text-zinc-300">{visibilityMessage}</p> : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]">
          <h2 className="text-lg font-semibold text-zinc-100">Restringir usuarios</h2>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSearchQuery(nextValue);

                if (!normalizeSearchQuery(nextValue)) {
                  setHasSearched(false);
                  setSearchResults([]);
                  setDismissedSearchResultIds(new Set());
                  setSearchMessage("");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearchUsers();
                }
              }}
              placeholder="Buscar usuario por nombre"
              className="w-full rounded-2xl border border-white/20 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-300/70"
            />
            <button
              type="button"
              onClick={() => void handleSearchUsers()}
              disabled={searchingUsers}
              className="rounded-2xl border border-white/40 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {searchingUsers ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {hasSearchQuery ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Resultados</p>
              {visibleSearchResults.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {searchingUsers ? "Buscando usuarios..." : hasSearched ? searchMessage || "Sin resultados" : ""}
                </p>
              ) : (
                <ul className="space-y-2">
                  {visibleSearchResults.map((user) => (
                    <li
                      key={String(user.id)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2"
                    >
                      <span className="text-sm text-zinc-200">@{user.username}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleBlockUser(user)}
                          className="rounded-full border border-red-300/50 px-3 py-1 text-xs font-medium text-red-200 transition hover:border-red-200"
                        >
                          Agregar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelSearchResult(user.id)}
                          className="rounded-full border border-white/30 px-3 py-1 text-xs font-medium text-zinc-100 transition hover:border-white"
                        >
                          Cancelar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Usuarios restringidos</p>
            {blockedUsersLoading ? (
              <p className="text-sm text-zinc-400">Cargando usuarios restringidos...</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-sm text-zinc-500">No tienes usuarios restringidos actualmente.</p>
            ) : (
              <ul className="space-y-2">
                {blockedUsers.map((user) => (
                  <li key={String(user.id)} className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2">
                    <span className="text-sm text-zinc-200">@{user.username}</span>
                    <button
                      type="button"
                      onClick={() => void handleUnblockUser(user)}
                      className="rounded-full border border-white/40 px-3 py-1 text-xs font-medium text-zinc-100 transition hover:border-white"
                    >
                      Quitar restricción
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {blockedUsersMessage ? <p className="mt-4 text-sm text-zinc-300">{blockedUsersMessage}</p> : null}
        </section>
      </div>

      {showConfirmPrivate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-zinc-950 p-5 shadow-[0_25px_55px_rgba(0,0,0,0.5)]">
            <h3 className="text-lg font-semibold text-zinc-100">Confirmar cambio a perfil privado</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Al cambiar tu perfil a privado, tus seguidores actuales serán eliminados. Seguirás conservando los
              perfiles que ya sigues y podrás seguir interactuando públicamente en películas. Tus amistades no se verán
              afectadas. ¿Deseas continuar?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmPrivate(false)}
                className="rounded-full border border-white/30 px-4 py-2 text-sm text-zinc-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmPrivate(false);
                  void executeVisibilityUpdate("private");
                }}
                className="rounded-full border border-blue-300/70 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-100"
              >
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
