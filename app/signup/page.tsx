"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

type FieldName = "username" | "email" | "password" | "password_confirmation" | "non_field_errors";
type FieldErrors = Partial<Record<FieldName, string>>;

interface RegisterResponse {
  token?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "", non_field_errors: "" }));
  };

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (form.username.trim().length < 8) {
      nextErrors.username = "El username debe tener al menos 8 caracteres.";
    }

    if (form.password !== form.password_confirmation) {
      nextErrors.password_confirmation = "Las contraseñas no coinciden.";
    }

    return nextErrors;
  };

  const mapBackendErrors = (payload: Record<string, unknown>): FieldErrors => {
    const backendErrors: FieldErrors = {};
    const fields: FieldName[] = [
      "username",
      "email",
      "password",
      "password_confirmation",
      "non_field_errors",
    ];

    fields.forEach((field) => {
      const value = payload[field];
      if (Array.isArray(value) && value.length > 0) {
        backendErrors[field] = String(value[0]);
      }
    });

    return backendErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const frontendErrors = validateForm();
    if (Object.keys(frontendErrors).length > 0) {
      setErrors(frontendErrors);
      return;
    }

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
      const data: RegisterResponse | Record<string, unknown> = contentType.includes("application/json")
        ? await res.json()
        : {};

      if (!res.ok) {
        const parsedErrors = mapBackendErrors(data as Record<string, unknown>);
        setErrors(
          Object.keys(parsedErrors).length > 0
            ? parsedErrors
            : { non_field_errors: "No se pudo completar el registro." },
        );
        return;
      }

      const registerData = data as RegisterResponse;

      if (registerData.token) {
        setToken(registerData.token);
        router.push("/");
        return;
      }

      router.push("/login");
    } catch (error) {
      console.error(error);
      setErrors({ non_field_errors: "No se pudo conectar con el backend." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-80">
        <h1 className="text-xl font-bold mb-4">Registro</h1>

        <form onSubmit={handleSubmit} noValidate>
          <input
            className="w-full mb-1 p-2 border rounded"
            placeholder="Username"
            value={form.username}
            onChange={(e) => handleChange("username", e.target.value)}
          />
          {errors.username && <p className="text-red-600 text-sm mb-2">{errors.username}</p>}

          <input
            type="email"
            className="w-full mb-1 p-2 border rounded"
            placeholder="Email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
          {errors.email && <p className="text-red-600 text-sm mb-2">{errors.email}</p>}

          <input
            type="password"
            className="w-full mb-1 p-2 border rounded"
            placeholder="Password"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
          />
          {errors.password && <p className="text-red-600 text-sm mb-2">{errors.password}</p>}

          <input
            type="password"
            className="w-full mb-1 p-2 border rounded"
            placeholder="Confirm Password"
            value={form.password_confirmation}
            onChange={(e) => handleChange("password_confirmation", e.target.value)}
          />
          {errors.password_confirmation && (
            <p className="text-red-600 text-sm mb-2">{errors.password_confirmation}</p>
          )}

          {errors.non_field_errors && (
            <p className="text-red-600 text-sm mb-3">{errors.non_field_errors}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Creando cuenta..." : "Registrarme"}
          </button>
        </form>

        <p className="text-sm mt-4 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
