"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";
import AuthShell from "../components/auth/AuthShell";

const inputBaseClassName =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-500/35";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Login failed:", res.status, text);
        alert(`Error login: ${res.status}. Revisa el endpoint del token.`);
        return;
      }

      const data = await res.json();
      setToken(data.token);

      console.log("Token recibido:", data.token);
      console.log("Token en localStorage:", localStorage.getItem("token"));

      router.push("/feed");
    } catch (error) {
      console.error(error);
      alert("No se pudo conectar con el backend");
    }
  };

  return (
    <AuthShell
      title="Bienvenido de nuevo"
      description="Inicia sesión para seguir descubriendo y compartiendo recomendaciones de películas con tu comunidad."
      footerText="¿No tienes cuenta?"
      footerLinkText="Regístrate"
      footerHref="/signup"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="login-username" className="text-sm font-medium text-zinc-200">
            Username
          </label>
          <input
            id="login-username"
            className={inputBaseClassName}
            placeholder="Ingresa tu username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm font-medium text-zinc-200">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            className={inputBaseClassName}
            placeholder="Ingresa tu password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={handleLogin}
          className="mt-2 w-full rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Entrar
        </button>
      </div>
    </AuthShell>
  );
}
