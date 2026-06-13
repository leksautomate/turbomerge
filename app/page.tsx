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
      .then((r) => (r.ok ? r.json() : []))
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
    COMPLETED: "text-[hsl(145_50%_50%)]",
    FAILED: "text-red-400",
    PAUSED: "text-[hsl(38_80%_55%)]",
    CANCELLED: "text-[hsl(220_10%_50%)]",
    DRAFT: "text-[hsl(220_10%_50%)]",
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cinzel', serif" }}>
          Projects
        </h1>
        <Link
          href="/projects/new"
          className="bg-[hsl(38_55%_55%)] hover:bg-[hsl(38_55%_62%)] text-[hsl(220_20%_7%)] font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + New Project
        </Link>
      </div>

      {loading && <p className="text-[hsl(220_10%_50%)]">Loading...</p>}

      {!loading && projects.length === 0 && (
        <div className="text-center py-24 text-[hsl(220_10%_50%)]">
          <p className="text-lg mb-4">No projects yet.</p>
          <Link href="/projects/new" className="text-[hsl(38_55%_55%)] hover:underline">
            Create your first project →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div
            key={p.id}
            className="bg-[hsl(220_18%_10%)] rounded-xl p-5 border border-[hsl(220_15%_18%)] flex flex-col gap-3 hover:border-[hsl(38_55%_55%/0.3)] transition-colors"
          >
            <div>
              <h2 className="font-semibold text-base truncate" style={{ fontFamily: "'Cinzel', serif" }}>
                {p.title}
              </h2>
              <p className="text-xs text-[hsl(220_10%_50%)] mt-0.5">
                {p.total_jobs} {p.media_type.toLowerCase()}s · {p.provider}
              </p>
            </div>

            {p.total_jobs > 0 && (
              <div>
                <div className="flex justify-between text-xs text-[hsl(220_10%_60%)] mb-1">
                  <span className={statusColor[p.status] ?? "text-[hsl(220_10%_50%)]"}>{p.status}</span>
                  <span>{pct(p)}%</span>
                </div>
                <div className="w-full bg-[hsl(220_15%_15%)] rounded-full h-1.5">
                  <div
                    className={`${p.status === "GENERATING" ? "bg-blue-500" : "bg-[hsl(38_55%_55%)]"} h-1.5 rounded-full transition-all`}
                    style={{ width: `${pct(p)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-auto">
              <Link
                href={`/projects/${p.id}`}
                className="flex-1 text-center bg-[hsl(220_15%_15%)] hover:bg-[hsl(220_15%_18%)] text-sm py-1.5 rounded-lg transition-colors border border-[hsl(220_15%_20%)]"
              >
                Open
              </Link>
              {p.completed_jobs > 0 && (
                <a
                  href={`/api/projects/${p.id}/download`}
                  className="text-sm bg-[hsl(220_15%_15%)] hover:bg-[hsl(220_15%_18%)] px-3 py-1.5 rounded-lg transition-colors border border-[hsl(220_15%_20%)]"
                >
                  ZIP
                </a>
              )}
              <button
                onClick={() => handleDelete(p.id)}
                className="text-sm bg-[hsl(220_15%_15%)] hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors text-red-400 border border-[hsl(220_15%_20%)]"
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
