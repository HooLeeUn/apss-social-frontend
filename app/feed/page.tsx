"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { useRouter } from "next/navigation";

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    console.log("TOKEN:", token);
    console.log("Llamando a:", "http://localhost:8000/api/feed/");
    
    if (!token) {
      router.push("/");
      return;
    }

    apiFetch("/feed/")
      .then((data) => setPosts(data?.results ?? data ?? []))
      .catch((err) => {
        console.error(err);
        alert("Error cargando feed");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Feed</h1>

      {posts.length === 0 ? (
        <p>No hay posts aún.</p>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="border p-4 mb-3 rounded">
            <div className="font-semibold">{post.author}</div>
            <div>{post.content}</div>
          </div>
        ))
      )}
    </div>
  );
}