"use client";

import Link from "next/link";
import { useMemo, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../../lib/api";
import AuthShell from "../../components/auth/AuthShell";
import AuthCountrySelector, { useAuthLocale } from "../../components/auth/AuthCountrySelector";
import AuthDialog from "../../components/auth/AuthDialog";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton";
import { getAgeFromBirthDate, MINIMUM_AGE } from "../../lib/personal-data";
import { clearGuestMode } from "../../lib/auth";

type FieldName =
  | "first_name"
  | "last_name"
  | "username"
  | "email"
  | "birth_date"
  | "password"
  | "password_confirmation"
  | "non_field_errors";
type FieldErrors = Partial<Record<FieldName, string>>;
type UsernameAvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "error";

const inputBaseClassName =
  "w-full rounded-xl border border-zinc-700/85 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500/90 outline-none transition duration-200 hover:border-zinc-500/90 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35";
const errorClassName = "text-sm text-red-300/95";
const MIN_USERNAME_LENGTH = 8;
const USERNAME_DEBOUNCE_MS = 500;

function getUsernameAvailability(payload: Record<string, unknown>): boolean | null {
  const available = payload.available ?? payload.is_available ?? payload.username_available;

  if (typeof available === "boolean") {
    return available;
  }

  const exists = payload.exists ?? payload.taken ?? payload.username_exists;

  if (typeof exists === "boolean") {
    return !exists;
  }

  return null;
}

export default function SignupPage() {
  const { locale, text } = useAuthLocale();
  const [generalError, setGeneralError] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    birth_date: "",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showBirthDateModal, setShowBirthDateModal] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameAvailabilityStatus>("idle");
  const [usernameStatusMessage, setUsernameStatusMessage] = useState("");
  const lastCheckedUsernameRef = useRef("");

  const birthDateAge = useMemo(() => getAgeFromBirthDate(form.birth_date), [form.birth_date]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "", non_field_errors: "" }));

    if (field === "username") {
      lastCheckedUsernameRef.current = "";
      setUsernameStatus("idle");
      setUsernameStatusMessage("");
    }
  };

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (!form.first_name.trim()) {
      nextErrors.first_name = text.firstRequired;
    }

    if (!form.last_name.trim()) {
      nextErrors.last_name = text.lastRequired;
    }

    if (form.username.trim().length < MIN_USERNAME_LENGTH) {
      nextErrors.username = text.usernameMin;
    }

    if (!form.birth_date) {
      nextErrors.birth_date = text.birthRequired;
    } else if (birthDateAge === null) {
      nextErrors.birth_date = text.birthInvalid;
    } else if (birthDateAge < MINIMUM_AGE) {
      nextErrors.birth_date = text.minimumAge;
    }

    if (form.password !== form.password_confirmation) {
      nextErrors.password_confirmation = text.passwordsMismatch;
    }

    return nextErrors;
  };

  const mapBackendErrors = (payload: Record<string, unknown>): FieldErrors => {
    const backendErrors: FieldErrors = {};
    const fields: FieldName[] = [
      "first_name",
      "last_name",
      "username",
      "email",
      "birth_date",
      "password",
      "password_confirmation",
      "non_field_errors",
    ];

    fields.forEach((field) => {
      const value = payload[field];
      if (Array.isArray(value) && value.length > 0) {
        backendErrors[field] = field === "username"
          ? text.usernameTaken
          : field === "email"
            ? text.emailTaken
            : field === "password"
              ? text.passwordRequirements
              : field === "password_confirmation"
                ? text.passwordsMismatch
                : text.registrationError;
      }
    });

    return backendErrors;
  };

  useEffect(() => {
    const username = form.username.trim();

    lastCheckedUsernameRef.current = "";
    setUsernameStatusMessage("");

    if (!username || username.length < MIN_USERNAME_LENGTH) {
      setUsernameStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setUsernameStatus("checking");
      setUsernameStatusMessage(text.checkingUsername);

      try {
        const res = await fetch(`${API_BASE_URL}/register/check-username/?username=${encodeURIComponent(username)}`, {
          signal: controller.signal,
        });
        const contentType = res.headers.get("content-type") || "";
        const data: Record<string, unknown> = contentType.includes("application/json") ? await res.json() : {};

        if (!res.ok) {
          throw new Error("Username check failed");
        }

        const isAvailable = getUsernameAvailability(data);

        if (isAvailable === null) {
          throw new Error("Invalid username check response");
        }

        lastCheckedUsernameRef.current = username;
        setUsernameStatus(isAvailable ? "available" : "unavailable");
        setUsernameStatusMessage(isAvailable ? text.usernameAvailable : text.usernameTaken);
        setErrors((prev) => ({
          ...prev,
          username: isAvailable ? "" : text.usernameTaken,
        }));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        lastCheckedUsernameRef.current = username;
        setUsernameStatus("error");
        setUsernameStatusMessage(text.usernameCheckError);
      }
    }, USERNAME_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [form.username, text]);

  const submitRegistration = async () => {
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(`${API_BASE_URL}/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const contentType = res.headers.get("content-type") || "";
      const data: Record<string, unknown> = contentType.includes("application/json") ? await res.json() : {};

      if (!res.ok) {
        const parsedErrors = mapBackendErrors(data as Record<string, unknown>);
        setErrors(
          Object.keys(parsedErrors).length > 0
            ? parsedErrors
            : { non_field_errors: text.registrationError },
        );
        return;
      }

      clearGuestMode();
      setRegistrationPending(true);
    } catch (error) {
      console.error(error);
      setGeneralError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const frontendErrors = validateForm();
    const normalizedUsername = form.username.trim();

    if (
      !frontendErrors.username &&
      (usernameStatus !== "available" || lastCheckedUsernameRef.current !== normalizedUsername)
    ) {
      frontendErrors.username =
        usernameStatus === "checking"
          ? text.waitUsername
          : text.verifyUsername;
    }

    if (Object.keys(frontendErrors).length > 0) {
      setErrors(frontendErrors);
      return;
    }

    setShowBirthDateModal(true);
  };

  const handleConfirmBirthDate = async () => {
    setShowBirthDateModal(false);
    await submitRegistration();
  };

  const normalizedUsername = form.username.trim();
  const hasUsernameReadyForSubmit =
    usernameStatus === "available" && lastCheckedUsernameRef.current === normalizedUsername;
  const isSubmitDisabled = loading || usernameStatus === "checking" || (normalizedUsername.length >= MIN_USERNAME_LENGTH && !hasUsernameReadyForSubmit);
  const usernameStatusClassName =
    usernameStatus === "available"
      ? "text-sm text-emerald-300/95"
      : usernameStatus === "unavailable" || usernameStatus === "error"
        ? errorClassName
        : "text-sm text-zinc-300";

  if (registrationPending) {
    return (
      <AuthShell
        title={text.reviewEmail}
        description={text.pendingDescription}
        footerText={text.confirmedAccount}
        footerLinkText={text.signinLink}
        footerHref="/login"
        brandingSlot="signup_logo_url"
        headerAction={<AuthCountrySelector />}
        logoAlt="QNext"
      >
        <div className="space-y-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-50 shadow-[0_14px_36px_rgba(16,185,129,0.08)]">
          <p className="text-base font-semibold text-emerald-100">
            {text.confirmationSent}
          </p>
          <p className="text-emerald-50/85">
            {text.pendingAccount}
          </p>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition duration-200 hover:bg-white hover:shadow-[0_12px_34px_rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.995]"
          >
            {text.goLogin}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <>
      <AuthShell
        title={text.signupTitle}
        description={text.signupDescription}
        footerText={text.haveAccount}
        footerLinkText={text.signinLink}
        footerHref="/login"
        brandingSlot="signup_logo_url"
        headerAction={<AuthCountrySelector />}
        logoAlt="QNext"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="signup-first-name" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              {text.firstName}
            </label>
            <input
              id="signup-first-name"
              className={inputBaseClassName}
              placeholder={text.firstNamePlaceholder}
              value={form.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
            />
            {errors.first_name && <p className={errorClassName}>{errors.first_name}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-last-name" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              {text.lastName}
            </label>
            <input
              id="signup-last-name"
              className={inputBaseClassName}
              placeholder={text.lastNamePlaceholder}
              value={form.last_name}
              onChange={(e) => handleChange("last_name", e.target.value)}
            />
            {errors.last_name && <p className={errorClassName}>{errors.last_name}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-username" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              {text.username}
            </label>
            <input
              id="signup-username"
              className={inputBaseClassName}
              placeholder={text.usernameSignupPlaceholder}
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
            />
            {errors.username ? <p className={errorClassName}>{errors.username}</p> : null}
            {!errors.username && usernameStatusMessage ? <p className={usernameStatusClassName}>{usernameStatusMessage}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              {text.email}
            </label>
            <input
              id="signup-email"
              type="email"
              className={inputBaseClassName}
              placeholder={text.emailPlaceholder}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            {errors.email && <p className={errorClassName}>{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-birth-date" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              {text.birthDate}
            </label>
            <input
              id="signup-birth-date"
              type="date"
              className={inputBaseClassName}
              value={form.birth_date}
              onChange={(e) => handleChange("birth_date", e.target.value)}
            />
            {errors.birth_date ? <p className={errorClassName}>{errors.birth_date}</p> : null}
            {form.birth_date && !errors.birth_date ? <p className="text-xs text-amber-200">{text.birthHelper}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
              {text.password}
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                className={`${inputBaseClassName} !pr-12`}
                placeholder={text.createPassword}
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
              />
              <PasswordVisibilityButton visible={showPassword} showLabel={text.showPassword} hideLabel={text.hidePassword} onToggle={() => setShowPassword((visible) => !visible)} />
            </div>
            {errors.password && <p className={errorClassName}>{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signup-password-confirmation"
              className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200"
            >
              {text.confirmPassword}
            </label>
            <div className="relative">
              <input
                id="signup-password-confirmation"
                type={showConfirmPassword ? "text" : "password"}
                className={`${inputBaseClassName} !pr-12`}
                placeholder={text.repeatPassword}
                value={form.password_confirmation}
                onChange={(e) => handleChange("password_confirmation", e.target.value)}
              />
              <PasswordVisibilityButton visible={showConfirmPassword} showLabel={text.showPassword} hideLabel={text.hidePassword} onToggle={() => setShowConfirmPassword((visible) => !visible)} />
            </div>
            {errors.password_confirmation && <p className={errorClassName}>{errors.password_confirmation}</p>}
          </div>

          {errors.non_field_errors && <p className={errorClassName}>{errors.non_field_errors}</p>}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="mt-1 w-full rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition duration-200 hover:bg-white hover:shadow-[0_12px_34px_rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-65 disabled:shadow-none"
          >
            {loading ? text.signingUp : text.signupButton}
          </button>
        </form>
      </AuthShell>

      {showBirthDateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div role="dialog" aria-modal="true" aria-labelledby="birth-dialog-title" aria-describedby="birth-dialog-description" className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
            <h3 id="birth-dialog-title" className="text-lg font-semibold text-zinc-100">{text.confirmBirth}</h3>
            <p id="birth-dialog-description" className="mt-3 text-sm leading-6 text-zinc-300">
              {text.selectedDate} <span className="font-medium text-zinc-100">{new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${form.birth_date}T00:00:00`))}</span>
              <br />
              {text.calculatedAge} <span className="font-medium text-zinc-100">{birthDateAge ?? text.unavailable}</span>
            </p>
            <p className="mt-3 text-sm text-amber-200">{text.birthHelper}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBirthDateModal(false)}
                className="rounded-lg border border-white/25 px-3 py-2 text-sm text-zinc-200 hover:border-white"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => setShowBirthDateModal(false)}
                className="rounded-lg border border-white/25 px-3 py-2 text-sm text-zinc-200 hover:border-white"
              >
                {text.modify}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmBirthDate()}
                className="rounded-lg border border-zinc-100 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
              >
                {text.accept}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {generalError ? <AuthDialog title={text.connectionTitle} message={text.connectionMessage} closeLabel={text.close} onClose={() => setGeneralError(false)} /> : null}
    </>
  );
}
