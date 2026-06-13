"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Job {
  id: string;
  status: string;
  prompt: string;
  progress: number;
  output_path: string | null;
  error_message: string | null;
  retry_count: number;
}

interface ProjectStatus {
  id: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  jobs: Job[];
}

export default function ProjectPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [prompts, setPrompts] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    const res = await fetch(`/api/projects/${id}/status`);
    if (res.ok) setStatus(await res.json());
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  const isActive = status?.status === "GENERATING";
  const pct = status && status.total_jobs > 0
    ? Math.round((status.completed_jobs / status.total_jobs) * 100)
    : 0;

  const handleGenerate = async () => {
    const lines = prompts.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setGenerating(true);
    await fetch(`/api/projects/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompts: lines }),
    });
    setPrompts("");
    setGenerating(false);
  };

  const control = async (action: string) => {
    await fetch(`/api/projects/${id}/${action}`, { method: "POST" });
    fetchStatus();
  };

  const retryJob = async (jobId: string) => {
    await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    fetchStatus();
  };

  const saveEditedPrompt = async (jobId: string) => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: editPrompt }),
    });
    setEditingJob(null);
    fetchStatus();
  };

  const jobStatusIcon: Record<string, string> = {
    PENDING: "⏳", GENERATING: "⚙️", COMPLETED: "✓", FAILED: "✗", CANCELLED: "—",
  };

  const jobStatusColor: Record<string, string> = {
    PENDING: "text-zinc-400", GENERATING: "text-blue-400",
    COMPLETED: "text-green-400", FAILED: "text-red-400", CANCELLED: "text-zinc-600",
  };

  if (!status) return <div className="p-10 text-zinc-500">Loading...</div>;

  const failedJobs = status.jobs.filter((j) => j.status === "FAILED");

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm">← Dashboard</Link>
        <span className="text-zinc-700">/</span>
        <span className="text-sm font-medium">Project</span>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold">Project {id.slice(0, 8)}</h1>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">{status.status.toLowerCase()}</p>
          </div>
          <Link
            href={`/projects/${id}/results`}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            View Results
          </Link>
        </div>

        {status.total_jobs > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Generating {status.completed_jobs}/{status.total_jobs}</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            {status.failed_jobs > 0 && (
              <p className="text-xs text-red-400 mt-1">{status.failed_jobs} failed</p>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {isActive && (
            <button onClick={() => control("pause")} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
              Pause
            </button>
          )}
          {status.status === "PAUSED" && (
            <button onClick={() => control("resume")} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors text-green-400">
              Resume
            </button>
          )}
          {(isActive || status.status === "PAUSED") && (
            <button onClick={() => control("cancel")} className="text-xs bg-zinc-800 hover:bg-red-900 px-3 py-1.5 rounded-lg transition-colors text-red-400">
              Cancel
            </button>
          )}
          {failedJobs.length > 0 && (
            <button onClick={() => control("retry")} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors text-yellow-400">
              Retry All Failed ({failedJobs.length})
            </button>
          )}
          {status.completed_jobs > 0 && (
            <a href={`/api/projects/${id}/download`} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors text-blue-400">
              Download ZIP
            </a>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
        <label className="block text-sm text-zinc-400 mb-2">Add Prompts (one per line)</label>
        <textarea
          value={prompts} onChange={(e) => setPrompts(e.target.value)}
          rows={6} placeholder={"A futuristic city\nA samurai at sunset\nA dragon flying over NYC"}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none font-mono"
        />
        <button
          onClick={handleGenerate} disabled={generating || !prompts.trim()}
          className="mt-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
        >
          {generating ? "Queuing..." : "Generate"}
        </button>
      </div>

      {status.jobs.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="px-5 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium">Jobs ({status.jobs.length})</h2>
          </div>
          <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
            {status.jobs.map((job) => (
              <div key={job.id} className="px-5 py-3">
                {editingJob === job.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-600 rounded px-2 py-1 text-xs"
                    />
                    <button onClick={() => saveEditedPrompt(job.id)} className="text-xs bg-green-600 px-2 py-1 rounded text-black">Save</button>
                    <button onClick={() => setEditingJob(null)} className="text-xs bg-zinc-700 px-2 py-1 rounded">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className={`text-xs mt-0.5 ${jobStatusColor[job.status] ?? "text-zinc-400"}`}>
                      {jobStatusIcon[job.status] ?? "?"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{job.prompt}</p>
                      {job.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 truncate">{job.error_message}</p>
                      )}
                    </div>
                    {job.status === "FAILED" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingJob(job.id); setEditPrompt(job.prompt); }}
                          className="text-xs text-zinc-400 hover:text-white px-1.5 py-0.5 bg-zinc-800 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => retryJob(job.id)}
                          className="text-xs text-yellow-400 hover:text-yellow-300 px-1.5 py-0.5 bg-zinc-800 rounded"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
