"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api";
import AppLogo from "../../components/AppLogo";
import { useAppBranding } from "../../hooks/useAppBranding";
import { useI18n } from "../../hooks/useI18n";
import {
  countryToLocale,
  getStoredCountry,
  t as translate,
} from "../../lib/i18n";
import {
  blockUser,
  BlockedUser,
  getBlockedUsers,
  getProfilePrivacySettings,
  ProfileVisibility,
  searchUsersToRestrict,
  unblockUser,
  updateFriendRequestsRestriction,
  updateProfileVisibility,
} from "../../lib/privacy";

const privacyDisclaimerKeys = [
  "privacySecurityConditionDefaultPublic",
  "privacySecurityConditionPublicProfiles",
  "privacySecurityConditionPrivateProfiles",
  "privacySecurityConditionPrivateChange",
  "privacySecurityConditionPublicComments",
  "privacySecurityConditionRestrictedUser",
  "privacySecurityConditionFriendRequests",
] as const;

export default function PrivacySecurityPage() {
  const router = useRouter();
  const branding = useAppBranding();
  const { t } = useI18n();

  const formatMessage = (
    key: Parameters<typeof t>[0],
    values?: Record<string, string>,
  ) => {
    const template = t(key);
    if (!values) return template;

    return Object.entries(values).reduce(
      (message, [placeholder, value]) =>
        message.replace(`{${placeholder}}`, value),
      template,
    );
  };

  const [visibility, setVisibility] = useState<ProfileVisibility>("public");
  const [loadingVisibility, setLoadingVisibility] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const [showConfirmPrivate, setShowConfirmPrivate] = useState(false);

  const [friendRequestsRestricted, setFriendRequestsRestricted] =
    useState(false);
  const [savingFriendRequestsRestriction, setSavingFriendRequestsRestriction] =
    useState(false);
  const [
    friendRequestsRestrictionMessage,
    setFriendRequestsRestrictionMessage,
  ] = useState("");
  const [
    showConfirmFriendRequestsRestriction,
    setShowConfirmFriendRequestsRestriction,
  ] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedUsersLoading, setBlockedUsersLoading] = useState(true);
  const [blockedUsersMessage, setBlockedUsersMessage] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState<BlockedUser[]>([]);
  const [dismissedSearchResultIds, setDismissedSearchResultIds] = useState<
    Set<string>
  >(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedPrivacySettings, loadedBlockedUsers] = await Promise.all([
          getProfilePrivacySettings(),
          getBlockedUsers(),
        ]);

        setVisibility(loadedPrivacySettings.visibility);
        setFriendRequestsRestricted(
          loadedPrivacySettings.friendRequestsRestricted,
        );
        setBlockedUsers(loadedBlockedUsers);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }

        const storedLocale = countryToLocale(getStoredCountry());
        setVisibilityMessage(
          translate(storedLocale, "privacySecurityPrivacySettingsLoadError"),
        );
        setBlockedUsersMessage(
          translate(storedLocale, "privacySecurityRestrictedUsersLoadError"),
        );
      } finally {
        setLoadingVisibility(false);
        setBlockedUsersLoading(false);
      }
    };

    void loadData();
  }, [router]);

  const blockedIds = useMemo(
    () => new Set(blockedUsers.map((user) => String(user.id))),
    [blockedUsers],
  );
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
        (user) =>
          !blockedIds.has(String(user.id)) &&
          !dismissedSearchResultIds.has(String(user.id)),
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
      setVisibilityMessage(t("privacySecurityPrivacyUpdated"));
    } catch {
      setVisibilityMessage(t("privacySecurityProfileTypeUpdateError"));
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleFriendRequestsRestrictionUpdate = async (nextValue: boolean) => {
    setSavingFriendRequestsRestriction(true);
    setFriendRequestsRestrictionMessage("");

    try {
      const updatedValue = await updateFriendRequestsRestriction(nextValue);
      setFriendRequestsRestricted(updatedValue);
    } catch {
      setFriendRequestsRestrictionMessage(
        t("privacySecurityFriendRequestsUpdateError"),
      );
    } finally {
      setSavingFriendRequestsRestriction(false);
    }
  };

  const handleFriendRequestsRestrictionChange = (nextValue: boolean) => {
    if (
      savingFriendRequestsRestriction ||
      nextValue === friendRequestsRestricted
    )
      return;

    setFriendRequestsRestrictionMessage("");

    if (nextValue) {
      setShowConfirmFriendRequestsRestriction(true);
      return;
    }

    void handleFriendRequestsRestrictionUpdate(false);
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
        return (
          current.findIndex((entry) => String(entry.id) === userId) === index
        );
      });

      setSearchResults(uniqueResults);
      setDismissedSearchResultIds(new Set());

      if (uniqueResults.length === 0) {
        setSearchMessage(t("privacySecurityNoResults"));
      }
    } catch {
      setSearchResults([]);
      setSearchMessage(t("privacySecuritySearchError"));
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleBlockUser = async (user: BlockedUser) => {
    const alreadyBlocked = blockedIds.has(String(user.id));
    if (alreadyBlocked) {
      setBlockedUsersMessage(t("privacySecurityAlreadyRestricted"));
      return;
    }

    try {
      await blockUser(user.id);
      await refreshBlockedUsers();
      setSearchResults((current) =>
        current.filter((entry) => String(entry.id) !== String(user.id)),
      );
      setDismissedSearchResultIds((current) => {
        const next = new Set(current);
        next.delete(String(user.id));
        return next;
      });
      setBlockedUsersMessage(
        formatMessage("privacySecurityUserRestricted", {
          username: user.username,
        }),
      );
    } catch {
      setBlockedUsersMessage(t("privacySecurityRestrictUserError"));
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
      setBlockedUsersMessage(
        formatMessage("privacySecurityRestrictionRemoved", {
          username: user.username,
        }),
      );
    } catch {
      setBlockedUsersMessage(t("privacySecurityRemoveRestrictionError"));
    }
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-[980px] space-y-6 px-4 py-7 md:px-8 md:py-8">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
          <h1 className="text-xl font-semibold tracking-wide text-zinc-100 md:text-2xl">
            {t("privacySecurity")}
          </h1>
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

        <section className="p-5">
          <div className="mb-4">
            <h2 className="text-xl font-semibold uppercase tracking-[0.18em] text-blue-200/85 md:text-2xl">
              {t("privacySecurityConditionsTitle")}
            </h2>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-200 md:text-[0.95rem]">
            {privacyDisclaimerKeys.map((key) => (
              <li key={key} className="pl-1">
                {t(key)}
              </li>
            ))}
          </ul>
        </section>

        <section className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-blue-200/85 md:text-2xl">
              {t("privacySecurityProfileType")}
            </h2>
            {loadingVisibility ? (
              <span className="text-xs text-zinc-400">
                {t("privacySecurityLoading")}
              </span>
            ) : null}
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
              <p className="text-sm font-semibold">
                {t("privacySecurityPublic")}
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                {t("privacySecurityPublicDescription")}
              </p>
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
              <p className="text-sm font-semibold">
                {t("privacySecurityPrivate")}
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                {t("privacySecurityPrivateDescription")}
              </p>
            </button>
          </div>

          {savingVisibility ? (
            <p className="mt-3 text-sm text-zinc-300">
              {t("privacySecuritySavingChanges")}
            </p>
          ) : null}
          {visibilityMessage ? (
            <p className="mt-3 text-sm text-zinc-300">{visibilityMessage}</p>
          ) : null}
        </section>

        {!loadingVisibility && visibility === "public" ? (
          <>
            <section className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-blue-200/85">
                    {t("privacySecurityRestrictFriendRequests")}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-300">
                    {t("privacySecurityRestrictFriendRequestsDescription")}
                  </p>
                </div>
                <select
                  value={friendRequestsRestricted ? "yes" : "no"}
                  disabled={savingFriendRequestsRestriction}
                  onChange={(event) =>
                    handleFriendRequestsRestrictionChange(
                      event.target.value === "yes",
                    )
                  }
                  className="min-w-28 rounded-2xl border border-white/20 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-300/70 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t("privacySecurityRestrictFriendRequests")}
                >
                  <option value="no">{t("privacySecurityNo")}</option>
                  <option value="yes">{t("privacySecurityYes")}</option>
                </select>
              </div>

              {savingFriendRequestsRestriction ? (
                <p className="mt-3 text-sm text-zinc-300">
                  {t("privacySecuritySavingChanges")}
                </p>
              ) : null}
              {friendRequestsRestrictionMessage ? (
                <p className="mt-3 text-sm text-zinc-300">
                  {friendRequestsRestrictionMessage}
                </p>
              ) : null}
            </section>

            <section className="p-5">
              <h2 className="text-lg font-semibold text-blue-200/85">
                {t("privacySecurityRestrictUsers")}
              </h2>

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
                  placeholder={t("privacySecuritySearchUserPlaceholder")}
                  className="w-full rounded-2xl border border-white/20 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-300/70"
                />
                <button
                  type="button"
                  onClick={() => void handleSearchUsers()}
                  disabled={searchingUsers}
                  className="rounded-2xl border border-white/40 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {searchingUsers
                    ? t("privacySecuritySearching")
                    : t("privacySecuritySearch")}
                </button>
              </div>

              {hasSearchQuery ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    {t("privacySecurityResults")}
                  </p>
                  {visibleSearchResults.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {searchingUsers
                        ? t("privacySecuritySearchingUsers")
                        : hasSearched
                          ? searchMessage || t("privacySecurityNoResults")
                          : ""}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {visibleSearchResults.map((user) => (
                        <li
                          key={String(user.id)}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2"
                        >
                          <span className="text-sm text-zinc-200">
                            @{user.username}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleBlockUser(user)}
                              className="rounded-full border border-red-300/50 px-3 py-1 text-xs font-medium text-red-200 transition hover:border-red-200"
                            >
                              {t("privacySecurityAdd")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelSearchResult(user.id)}
                              className="rounded-full border border-white/30 px-3 py-1 text-xs font-medium text-zinc-100 transition hover:border-white"
                            >
                              {t("privacySecurityCancel")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              <div className="mt-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {t("privacySecurityRestrictedUsers")}
                </p>
                {blockedUsersLoading ? (
                  <p className="text-sm text-zinc-400">
                    {t("privacySecurityLoadingRestrictedUsers")}
                  </p>
                ) : blockedUsers.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {t("privacySecurityNoRestrictedUsers")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {blockedUsers.map((user) => (
                      <li
                        key={String(user.id)}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2"
                      >
                        <span className="text-sm text-zinc-200">
                          @{user.username}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleUnblockUser(user)}
                          className="rounded-full border border-white/40 px-3 py-1 text-xs font-medium text-zinc-100 transition hover:border-white"
                        >
                          {t("privacySecurityRemoveRestriction")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {blockedUsersMessage ? (
                <p className="mt-4 text-sm text-zinc-300">
                  {blockedUsersMessage}
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>

      {showConfirmFriendRequestsRestriction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-zinc-950 p-5 shadow-[0_25px_55px_rgba(0,0,0,0.5)]">
            <h3 className="text-lg font-semibold text-zinc-100">
              {t("privacySecurityRestrictFriendRequests")}
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {t("privacySecurityConfirmFriendRequestsRestrictionDescription")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmFriendRequestsRestriction(false)}
                className="rounded-full border border-white/30 px-4 py-2 text-sm text-zinc-100"
              >
                {t("privacySecurityCancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmFriendRequestsRestriction(false);
                  void handleFriendRequestsRestrictionUpdate(true);
                }}
                className="rounded-full border border-blue-300/70 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-100"
              >
                {t("privacySecurityAccept")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showConfirmPrivate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-zinc-950 p-5 shadow-[0_25px_55px_rgba(0,0,0,0.5)]">
            <h3 className="text-lg font-semibold text-zinc-100">
              {t("privacySecurityConfirmPrivateTitle")}
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {t("privacySecurityConfirmPrivateDescription")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmPrivate(false)}
                className="rounded-full border border-white/30 px-4 py-2 text-sm text-zinc-100"
              >
                {t("privacySecurityCancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmPrivate(false);
                  void executeVisibilityUpdate("private");
                }}
                className="rounded-full border border-blue-300/70 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-100"
              >
                {t("privacySecurityConfirmChange")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
