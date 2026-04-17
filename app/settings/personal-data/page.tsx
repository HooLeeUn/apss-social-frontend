"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import {
  formatBirthDate,
  GenderIdentity,
  getAgeFromBirthDate,
  getPersonalData,
  MINIMUM_AGE,
  PersonalData,
  PersonalDataPayload,
  updatePersonalAvatar,
  updatePersonalData,
} from "../../../lib/personal-data";

type VisibilityOption = "yes" | "no";

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  age: string;
  gender_identity: GenderIdentity | "";
  birth_date_visible: VisibilityOption;
  gender_identity_visible: VisibilityOption;
}

interface FormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  birth_date?: string;
  general?: string;
}

const genderOptions: Array<{ value: GenderIdentity; label: string }> = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
  { value: "non_binary", label: "No binario" },
  { value: "prefer_not_to_say", label: "Prefiero no decirlo" },
];

const inputClassName =
  "w-full rounded-xl border border-zinc-700/85 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 outline-none transition duration-200 hover:border-zinc-500/90 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35";
const labelClassName = "text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-zinc-200";
const lockedBirthDateCopy = "La fecha de nacimiento ya fue confirmada y no puede modificarse.";
const minorBirthDateError = `Debes tener al menos ${MINIMUM_AGE} años para registrarte.`;
const birthDateConfirmationCopy = "Esta fecha no podrá modificarse después de crear la cuenta.";

function toFormState(data: PersonalData): FormState {
  const derivedAge = data.birth_date ? getAgeFromBirthDate(data.birth_date) : data.age;

  return {
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    birth_date: data.birth_date ?? "",
    age: derivedAge !== null ? String(derivedAge) : "",
    gender_identity: data.gender_identity ?? "",
    birth_date_visible: data.birth_date_visible ? "yes" : "no",
    gender_identity_visible: data.gender_identity_visible ? "yes" : "no",
  };
}

export default function PersonalDataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [birthDateLocked, setBirthDateLocked] = useState(false);
  const [initialBirthDate, setInitialBirthDate] = useState<string>("");
  const [showBirthDateModal, setShowBirthDateModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    first_name: "",
    last_name: "",
    email: "",
    birth_date: "",
    age: "",
    gender_identity: "",
    birth_date_visible: "yes",
    gender_identity_visible: "yes",
  });

  const pendingBirthDateAge = useMemo(() => getAgeFromBirthDate(form.birth_date), [form.birth_date]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const localUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(localUrl);

    return () => {
      URL.revokeObjectURL(localUrl);
    };
  }, [avatarFile]);

  const displayedAvatar = avatarPreviewUrl || avatarUrl;

  const applyLoadedData = (data: PersonalData) => {
    setForm(toFormState(data));
    setBirthDateLocked(data.birth_date_locked);
    setInitialBirthDate(data.birth_date ?? "");
    setAvatarUrl(data.avatar);
    setAvatarFile(null);
  };

  useEffect(() => {
    const loadPersonalData = async () => {
      try {
        const data = await getPersonalData();
        applyLoadedData(data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }

        setFeedback({ type: "error", message: "No se pudieron cargar tus datos personales." });
      } finally {
        setLoading(false);
      }
    };

    void loadPersonalData();
  }, [router]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "birth_date") {
        const recalculatedAge = getAgeFromBirthDate(String(value));
        next.age = recalculatedAge !== null ? String(recalculatedAge) : "";
      }
      return next;
    });

    setErrors((current) => ({ ...current, [field]: undefined, general: undefined }));
    setFeedback(null);
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!form.first_name.trim()) {
      nextErrors.first_name = "El nombre es obligatorio.";
    }

    if (!form.last_name.trim()) {
      nextErrors.last_name = "El apellido es obligatorio.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "El email es obligatorio.";
    }

    if (form.birth_date) {
      const birthDateAge = getAgeFromBirthDate(form.birth_date);
      if (birthDateAge === null) {
        nextErrors.birth_date = "Ingresa una fecha de nacimiento válida.";
      } else if (birthDateAge < MINIMUM_AGE) {
        nextErrors.birth_date = minorBirthDateError;
      }
    }

    return nextErrors;
  };

  const persistChanges = async () => {
    const payload: PersonalDataPayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      birth_date: form.birth_date ? form.birth_date : null,
      birth_date_visible: form.birth_date_visible === "yes",
      gender_identity: form.gender_identity || null,
      gender_identity_visible: form.gender_identity_visible === "yes",
    };

    await updatePersonalData(payload);

    if (avatarFile) {
      await updatePersonalAvatar(avatarFile);
    }

    const freshData = await getPersonalData();
    applyLoadedData(freshData);
    setFeedback({ type: "success", message: "Datos personales actualizados correctamente." });
  };

  const handleSave = async () => {
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFeedback({ type: "error", message: "Revisa los datos marcados antes de guardar." });
      return;
    }

    if (!birthDateLocked && !initialBirthDate && form.birth_date) {
      setShowBirthDateModal(true);
      return;
    }

    setSaving(true);
    setErrors({});
    setFeedback(null);

    try {
      await persistChanges();
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "No se pudieron guardar los cambios." });
      setErrors((current) => ({ ...current, general: "Revisa los datos e intenta nuevamente." }));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmBirthDate = async () => {
    setShowBirthDateModal(false);
    setSaving(true);
    setErrors({});
    setFeedback(null);

    try {
      await persistChanges();
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "No se pudieron guardar los cambios." });
      setErrors((current) => ({ ...current, general: "Revisa los datos e intenta nuevamente." }));
    } finally {
      setSaving(false);
    }
  };

  const handleModifyBirthDate = () => {
    setShowBirthDateModal(false);
  };

  const handleCancelBirthDate = () => {
    setShowBirthDateModal(false);
    updateField("birth_date", initialBirthDate);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto flex min-h-screen w-full max-w-[980px] items-center justify-center px-4 py-8">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/70 px-6 py-5 text-sm text-zinc-300 shadow-[0_18px_45px_rgba(0,0,0,0.38)]">
            Cargando datos personales...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-[980px] space-y-6 px-4 py-7 md:px-8 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
          <div>
            <h1 className="text-xl font-semibold tracking-wide text-zinc-100 md:text-2xl">Datos Personales</h1>
            <p className="mt-1 text-sm text-zinc-400">Gestiona aquí tu información principal de perfil.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/feed")}
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-white"
          >
            Volver al feed
          </button>
        </header>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Información básica</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="first-name" className={labelClassName}>
                Nombre
              </label>
              <input
                id="first-name"
                value={form.first_name}
                onChange={(event) => updateField("first_name", event.target.value)}
                className={inputClassName}
              />
              {errors.first_name ? <p className="text-sm text-red-300">{errors.first_name}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="last-name" className={labelClassName}>
                Apellido
              </label>
              <input
                id="last-name"
                value={form.last_name}
                onChange={(event) => updateField("last_name", event.target.value)}
                className={inputClassName}
              />
              {errors.last_name ? <p className="text-sm text-red-300">{errors.last_name}</p> : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="email" className={labelClassName}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={inputClassName}
              />
              {errors.email ? <p className="text-sm text-red-300">{errors.email}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Información personal</h2>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-12">
              <div className="space-y-2 md:col-span-5">
                <label htmlFor="birth-date" className={labelClassName}>
                  Fecha de nacimiento
                </label>
                <input
                  id="birth-date"
                  type="date"
                  value={form.birth_date}
                  disabled={birthDateLocked}
                  onChange={(event) => updateField("birth_date", event.target.value)}
                  className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-65`}
                />
                {birthDateLocked ? <p className="text-xs text-zinc-400">{lockedBirthDateCopy}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-3">
                <label htmlFor="age" className={labelClassName}>
                  Edad
                </label>
                <input id="age" value={form.age} readOnly className={`${inputClassName} cursor-default opacity-75`} />
              </div>

              <div className="space-y-2 md:col-span-4">
                <label htmlFor="birth-date-visible" className={labelClassName}>
                  Visible
                </label>
                <select
                  id="birth-date-visible"
                  value={form.birth_date_visible}
                  onChange={(event) => updateField("birth_date_visible", event.target.value as VisibilityOption)}
                  className={inputClassName}
                >
                  <option value="yes">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            {errors.birth_date ? (
              <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">{errors.birth_date}</div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-12">
              <div className="space-y-2 md:col-span-8">
                <label htmlFor="gender-identity" className={labelClassName}>
                  Identidad de género
                </label>
                <select
                  id="gender-identity"
                  value={form.gender_identity}
                  onChange={(event) => updateField("gender_identity", event.target.value as FormState["gender_identity"])}
                  className={inputClassName}
                >
                  <option value="">Selecciona una opción</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-4">
                <label htmlFor="gender-visible" className={labelClassName}>
                  Visible
                </label>
                <select
                  id="gender-visible"
                  value={form.gender_identity_visible}
                  onChange={(event) => updateField("gender_identity_visible", event.target.value as VisibilityOption)}
                  className={inputClassName}
                >
                  <option value="yes">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Foto/Avatar</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-white/20 bg-zinc-900/80">
              {displayedAvatar ? (
                <Image src={displayedAvatar} alt="Avatar actual" width={80} height={80} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs tracking-[0.18em] text-zinc-400">AVATAR</div>
              )}
            </div>

            <div className="w-full space-y-2">
              <label htmlFor="avatar-file" className={labelClassName}>
                Subir o cambiar foto
              </label>
              <input
                id="avatar-file"
                type="file"
                accept="image/*"
                onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-200 file:mr-3 file:rounded-lg file:border file:border-zinc-500/70 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:text-zinc-100 hover:file:border-zinc-300"
              />
              {avatarFile ? (
                <p className="max-w-full truncate text-xs text-zinc-400">Archivo seleccionado: {avatarFile.name}</p>
              ) : (
                <p className="text-xs text-zinc-400">Sin archivo seleccionado</p>
              )}
            </div>
          </div>
        </section>

        {feedback ? (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-sm ${
              feedback.type === "success"
                ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                : "border-red-400/35 bg-red-500/10 text-red-200"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
        {errors.general ? <p className="text-sm text-red-300">{errors.general}</p> : null}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-xl border border-zinc-100 bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition duration-200 hover:bg-white hover:shadow-[0_12px_34px_rgba(255,255,255,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {showBirthDateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
            <h3 className="text-lg font-semibold text-zinc-100">Confirmar fecha de nacimiento</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Fecha seleccionada: <span className="font-medium text-zinc-100">{formatBirthDate(form.birth_date)}</span>
              <br />
              Edad calculada: <span className="font-medium text-zinc-100">{pendingBirthDateAge ?? "No disponible"}</span>
            </p>
            <p className="mt-3 text-sm text-amber-200">{birthDateConfirmationCopy}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelBirthDate}
                className="rounded-lg border border-white/25 px-3 py-2 text-sm text-zinc-200 hover:border-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleModifyBirthDate}
                className="rounded-lg border border-white/25 px-3 py-2 text-sm text-zinc-200 hover:border-white"
              >
                Modificar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmBirthDate()}
                className="rounded-lg border border-zinc-100 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
