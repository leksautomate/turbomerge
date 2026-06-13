"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  title: string;
  media_type: string;
  provider: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  created_at: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project and all its files?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const pct = (p: Project) =>
    p.total_jobs > 0 ? Math.round((p.completed_jobs / p.total_jobs) * 100) : 0;

  const statusColor: Record<string, string> = {
    GENERATING: "text-blue-400",
    COMPLETED: "text-green-400",
    FAILED: "text-red-400",
    PAUSED: "text-yellow-400",
    CANCELLED: "text-zinc-500",
    DRAFT: "text-zinc-400",
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">TurboBatch</h1>
        <Link
          href="/projects/new"
          className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + New Project
        </Link>
      </div>

      {loading && <p className="text-zinc-500">Loading...</p>}

      {!loading && projects.length === 0 && (
        <div className="text-center py-24 text-zinc-500">
          <p className="text-lg mb-4">No projects yet.</p>
          <Link href="/projects/new" className="text-green-400 hover:underline">
            Create your first project →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex flex-col gap-3">
            <div>
              <h2 className="font-semibold text-base truncate">{p.title}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {p.total_jobs} {p.media_type.toLowerCase()}s · {p.provider}
              </p>
            </div>

            {p.total_jobs > 0 && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span className={statusColor[p.status] ?? "text-zinc-400"}>{p.status}</span>
                  <span>{pct(p)}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct(p)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-auto">
              <Link
                href={`/projects/${p.id}`}
                className="flex-1 text-center bg-zinc-800 hover:bg-zinc-700 text-sm py-1.5 rounded-lg transition-colors"
              >
                Open
              </Link>
              {p.completed_jobs > 0 && (
                <a
                  href={`/api/projects/${p.id}/download`}
                  className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  ZIP
                </a>
              )}
              <button
                onClick={() => handleDelete(p.id)}
                className="text-sm bg-zinc-800 hover:bg-red-900 px-3 py-1.5 rounded-lg transition-colors text-red-400"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
