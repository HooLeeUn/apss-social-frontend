"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { useRouter } from "next/navigation";

interface Author {
  id: number;
  username: string;
  bio?: string;
  avatar?: string;
}

interface Post {
  id: number;
  content: string;
  author: string | Author;
  created_at?: string;
  [key: string]: unknown;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "results" in value &&
    Array.isArray((value as PaginatedResponse<T>).results)
  );
}

function getAuthorName(author: Post["author"]): string {
  if (typeof author === "string") return author;
  if (author && typeof author === "object" && "username" in author) {
    return String(author.username);
  }
  return "Autor desconocido";
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();

    if (process.env.NODE_ENV === "development") {
      console.debug("[feed] token presente:", Boolean(token));
    }
    
    if (!token) {
      router.push("/");
      return;
    }

    apiFetch("/feed/")
      .then((data: unknown) => {
        const normalizedPosts = isPaginatedResponse<Post>(data)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];

        if (process.env.NODE_ENV === "development") {
          console.debug("[feed] posts cargados:", normalizedPosts);
        }

        setPosts(normalizedPosts);
      })
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
            <div className="font-semibold">{getAuthorName(post.author)}</div>
            <div>{post.content}</div>
          </div>
        ))
      )}
    </div>
  );
}
