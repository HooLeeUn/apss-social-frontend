"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "../lib/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/token/", {
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

      // verificación temporal (Paso 1)
      console.log("Token recibido:", data.token);
      console.log("Token en localStorage:", localStorage.getItem("token"));

      router.push("/feed");

    } catch (error) {
      console.error(error);
      alert("No se pudo conectar con el backend");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-80">

        <h1 className="text-xl font-bold mb-4">Login</h1>

        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          className="w-full mb-3 p-2 border rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 text-white p-2 rounded"
        >
          Entrar
        </button>

      </div>
    </div>
  );
}