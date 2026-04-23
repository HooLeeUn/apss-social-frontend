"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";
import AuthShell from "../components/auth/AuthShell";

const inputBaseClassName =
  "w-full rounded-xl border border-zinc-700/85 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500/90 outline-none transition duration-200 hover:border-zinc-500/90 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/35";

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
      brandingSlot="login_logo_url"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="login-username" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
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
          <label htmlFor="login-password" className="text-[0.82rem] font-medium uppercase tracking-[0.08em] text-zinc-200">
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
          className="mt-1 w-full rounded-xl border border-zinc-100 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition duration-200 hover:bg-white hover:shadow-[0_12px_34px_rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.995]"
        >
          Entrar
        </button>
      </div>
    </AuthShell>
  );
}
