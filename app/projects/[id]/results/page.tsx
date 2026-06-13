"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Job {
  id: string;
  status: string;
  prompt: string;
  output_path: string | null;
  error_message: string | null;
}

interface StatusResponse {
  id: string;
  status: string;
  completed_jobs: number;
  total_jobs: number;
  jobs: Job[];
}

export default function ResultsPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<StatusResponse | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}/status`).then((r) => r.ok ? r.json() : null).then((d) => d && setData(d));
    const interval = setInterval(() => {
      fetch(`/api/projects/${id}/status`).then((r) => r.ok ? r.json() : null).then((d) => d && setData(d));
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (!data) return <div className="p-10 text-zinc-500">Loading...</div>;

  const completed = data.jobs.filter((j) => j.status === "COMPLETED");
  const failed = data.jobs.filter((j) => j.status === "FAILED");

  const getImageSrc = (outputPath: string) => {
    const filename = outputPath.replace(/\\/g, "/").split("/").pop();
    return `/api/projects/${id}/file/${filename}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${id}`} className="text-zinc-500 hover:text-zinc-300 text-sm">
          ← Project
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-sm font-medium">Results</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">
          Results — {completed.length}/{data.total_jobs} completed
        </h1>
        {completed.length > 0 && (
          <a
            href={`/api/projects/${id}/download`}
            className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Download ZIP
          </a>
        )}
      </div>

      {completed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
          {completed.map((job) => (
            <div key={job.id} className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 group">
              <div className="aspect-square bg-zinc-800 flex items-center justify-center">
                {job.output_path?.match(/\.(mp4|webm)$/) ? (
                  <div className="text-zinc-500 text-xs text-center p-2">
                    <span className="text-2xl block mb-1">🎬</span>
                    video
                  </div>
                ) : (
                  <img
                    src={getImageSrc(job.output_path!)}
                    alt={job.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs text-zinc-400 truncate">{job.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-red-400 mb-3">Failed ({failed.length})</h2>
          <div className="flex flex-col gap-2">
            {failed.map((job) => (
              <div key={job.id} className="bg-zinc-900 rounded-lg border border-zinc-800 px-4 py-3 flex items-start gap-3">
                <span className="text-red-400 text-sm">✗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{job.prompt}</p>
                  {job.error_message && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{job.error_message}</p>
                  )}
                </div>
                <Link
                  href={`/projects/${id}`}
                  className="text-xs text-yellow-400 hover:text-yellow-300 shrink-0"
                >
                  Retry →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length === 0 && failed.length === 0 && (
        <div className="text-center py-24 text-zinc-500">
          No results yet. <Link href={`/projects/${id}`} className="text-green-400 hover:underline">Go generate some →</Link>
        </div>
      )}
    </div>
  );
}
