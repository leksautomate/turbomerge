"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type MediaType = "IMAGE" | "VIDEO";
type Provider = "RUNWARE" | "VERTEX";
type AspectRatio = "1:1" | "16:9" | "9:16";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("IMAGE");
  const [provider, setProvider] = useState<Provider>("RUNWARE");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [format, setFormat] = useState("PNG");
  const [quality, setQuality] = useState("high");
  const [vertexModel, setVertexModel] = useState("gemini-3.1-flash-image-preview");
  const [duration, setDuration] = useState(8);
  const [resolution, setResolution] = useState("720p");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const buildSettings = () => {
    if (mediaType === "VIDEO") {
      return { provider: "VERTEX", model: "veo-3.1-lite-generate-001", aspectRatio, durationSeconds: duration, resolution };
    }
    if (provider === "RUNWARE") {
      return { provider: "RUNWARE", model: "openai:gpt-image@2", aspectRatio, format, quality };
    }
    return { provider: "VERTEX", model: vertexModel, aspectRatio, format };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Project title is required"); return; }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        media_type: mediaType,
        provider: mediaType === "VIDEO" ? "VERTEX" : provider,
        settings: buildSettings(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create project");
      setSubmitting(false);
      return;
    }

    const project = await res.json();
    router.push(`/projects/${project.id}`);
  };

  const Radio = ({ name, value, current, onChange, label }: {
    name: string; value: string; current: string;
    onChange: (v: string) => void; label: string;
  }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio" name={name} value={value}
        checked={current === value} onChange={() => onChange(value)}
        className="accent-green-500"
      />
      <span className="text-sm">{label}</span>
    </label>
  );

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-xl font-bold mb-6">New Project</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Project Title *</label>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Japan History Shorts"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Description</label>
          <input
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Media Type</label>
          <div className="flex gap-4">
            <Radio name="mediaType" value="IMAGE" current={mediaType} onChange={(v) => setMediaType(v as MediaType)} label="Image" />
            <Radio name="mediaType" value="VIDEO" current={mediaType} onChange={(v) => setMediaType(v as MediaType)} label="Video" />
          </div>
        </div>

        {mediaType === "IMAGE" && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Provider</label>
            <div className="flex gap-4">
              <Radio name="provider" value="RUNWARE" current={provider} onChange={(v) => setProvider(v as Provider)} label="Runware (GPT Image 2)" />
              <Radio name="provider" value="VERTEX" current={provider} onChange={(v) => setProvider(v as Provider)} label="Vertex (Gemini)" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Aspect Ratio</label>
          <div className="flex gap-4">
            {(["1:1", "16:9", "9:16"] as AspectRatio[]).map((r) => (
              <Radio key={r} name="aspectRatio" value={r} current={aspectRatio} onChange={(v) => setAspectRatio(v as AspectRatio)} label={r} />
            ))}
          </div>
        </div>

        {mediaType === "IMAGE" && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Format</label>
              <div className="flex gap-4">
                {["PNG", "JPG"].map((f) => (
                  <Radio key={f} name="format" value={f} current={format} onChange={setFormat} label={f} />
                ))}
              </div>
            </div>

            {provider === "RUNWARE" && (
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Quality</label>
                <div className="flex gap-4">
                  {["low", "medium", "high"].map((q) => (
                    <Radio key={q} name="quality" value={q} current={quality} onChange={setQuality} label={q.charAt(0).toUpperCase() + q.slice(1)} />
                  ))}
                </div>
              </div>
            )}

            {provider === "VERTEX" && (
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Model</label>
                <div className="flex flex-col gap-2">
                  <Radio name="vertexModel" value="gemini-3.1-flash-image-preview" current={vertexModel} onChange={setVertexModel} label="Flash (faster)" />
                  <Radio name="vertexModel" value="gemini-3-pro-image-preview" current={vertexModel} onChange={setVertexModel} label="Pro (higher quality)" />
                </div>
              </div>
            )}
          </>
        )}

        {mediaType === "VIDEO" && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Duration (seconds)</label>
              <input
                type="number" min={1} max={60} value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Resolution</label>
              <div className="flex gap-4">
                <Radio name="resolution" value="720p" current={resolution} onChange={setResolution} label="720p" />
                <Radio name="resolution" value="1080p" current={resolution} onChange={setResolution} label="1080p" />
              </div>
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit" disabled={submitting}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          {submitting ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
