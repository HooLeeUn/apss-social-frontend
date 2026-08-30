"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppLogo from "../../components/AppLogo";
import { useAppBranding } from "../../hooks/useAppBranding";
import { useI18n } from "../../hooks/useI18n";
import { ContactCategory, sendContactMessage } from "../../lib/contact";

const SUBJECT_MAX_LENGTH = 50;
const MESSAGE_MAX_LENGTH = 1500;

type SubmitStatus = "idle" | "loading" | "success" | "error";
type FormErrors = Partial<Record<"category" | "subject" | "message", string>>;

const fieldClassName =
  "w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25";
const labelClassName = "text-sm font-semibold text-zinc-200";

export default function ContactPage() {
  const router = useRouter();
  const branding = useAppBranding();
  const { t } = useI18n();
  const [category, setCategory] = useState<ContactCategory | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const submittingRef = useRef(false);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!category) nextErrors.category = t("contactCategoryRequired");
    if (!subject.trim()) nextErrors.subject = t("contactSubjectRequired");
    if (!message.trim()) nextErrors.message = t("contactMessageRequired");
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    setStatus("idle");
    if (Object.keys(nextErrors).length > 0 || !category) return;

    submittingRef.current = true;
    setStatus("loading");
    try {
      await sendContactMessage({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setCategory("");
      setSubject("");
      setMessage("");
      setErrors({});
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("contactTitle")}</h1>
          </div>
          <button type="button" onClick={() => router.push("/feed")} aria-label="Volver al feed" className="shrink-0 rounded-lg p-1">
            <AppLogo
              branding={branding}
              slot="default_logo_url"
              alt="RecCool"
              className="h-10 w-auto max-w-36 object-contain sm:h-12 sm:max-w-52"
              textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200"
              fallbackText="RecCool"
            />
          </button>
        </header>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/75 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] sm:p-8">
          <p className="mb-7 text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">{t("contactDescription")}</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="contact-category" className={labelClassName}>{t("contactCategory")}</label>
              <select
                id="contact-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as ContactCategory | "");
                  setErrors((current) => ({ ...current, category: undefined }));
                }}
                disabled={status === "loading"}
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "contact-category-error" : undefined}
                className={fieldClassName}
              >
                <option value="">{t("contactCategoryPlaceholder")}</option>
                <option value="technical">{t("contactTechnical")}</option>
                <option value="commercial">{t("contactCommercial")}</option>
                <option value="requests_suggestions">{t("contactRequestsSuggestions")}</option>
              </select>
              {errors.category ? <p id="contact-category-error" className="text-sm text-red-300">{errors.category}</p> : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="contact-subject" className={labelClassName}>{t("contactSubject")}</label>
                <span className="text-xs tabular-nums text-zinc-400">{subject.length} / {SUBJECT_MAX_LENGTH}</span>
              </div>
              <input
                id="contact-subject"
                value={subject}
                maxLength={SUBJECT_MAX_LENGTH}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setErrors((current) => ({ ...current, subject: undefined }));
                }}
                disabled={status === "loading"}
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={errors.subject ? "contact-subject-error" : undefined}
                className={fieldClassName}
              />
              {errors.subject ? <p id="contact-subject-error" className="text-sm text-red-300">{errors.subject}</p> : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="contact-message" className={labelClassName}>{t("contactMessage")}</label>
                <span className="text-xs tabular-nums text-zinc-400">{message.length} / {MESSAGE_MAX_LENGTH}</span>
              </div>
              <textarea
                id="contact-message"
                value={message}
                maxLength={MESSAGE_MAX_LENGTH}
                rows={9}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setErrors((current) => ({ ...current, message: undefined }));
                }}
                disabled={status === "loading"}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "contact-message-error" : undefined}
                className={`${fieldClassName} min-h-44 resize-y`}
              />
              {errors.message ? <p id="contact-message-error" className="text-sm text-red-300">{errors.message}</p> : null}
            </div>

            <div aria-live="polite">
              {status === "success" ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{t("contactSuccess")}</p> : null}
              {status === "error" ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{t("contactError")}</p> : null}
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-36"
            >
              {status === "loading" ? t("contactSending") : t("contactSend")}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
