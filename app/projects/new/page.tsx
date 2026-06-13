"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type MediaType = "IMAGE" | "VIDEO";
type Provider = "RUNWARE" | "VERTEX";
type AspectRatio = "1:1" | "16:9" | "9:16";

const inputCls = "w-full bg-[hsl(220_15%_13%)] border border-[hsl(220_15%_18%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[hsl(38_55%_55%)] text-[hsl(40_15%_90%)] placeholder-[hsl(220_10%_40%)]";
const labelCls = "block text-sm text-[hsl(220_10%_55%)] mb-1";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("IMAGE");
  const [provider, setProvider] = useState<Provider>("RUNWARE");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [format, setFormat] = useState("PNG");
  const [quality, setQuality] = useState("high");
  const [vertexModel, setVertexModel] = useState("imagen-4.0-fast-generate-001");
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
      const text = await res.text();
      let msg = "Failed to create project";
      try { msg = JSON.parse(text).error ?? msg; } catch { /* empty body */ }
      setError(msg);
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
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="radio" name={name} value={value}
        checked={current === value} onChange={() => onChange(value)}
        className="accent-[hsl(38_55%_55%)]"
      />
      <span className="text-sm text-[hsl(40_15%_80%)] group-hover:text-[hsl(40_15%_95%)] transition-colors">{label}</span>
    </label>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-[hsl(220_18%_10%)] border border-[hsl(220_15%_18%)] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-[hsl(38_55%_55%)] mb-4" style={{ fontFamily: "'Cinzel', serif" }}>
        {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Cinzel', serif" }}>New Project</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Section title="Project Details">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>Project Title *</label>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Japan History Shorts"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className={inputCls}
              />
            </div>
          </div>
        </Section>

        <Section title="Media Type">
          <div className="flex gap-4">
            <Radio name="mediaType" value="IMAGE" current={mediaType} onChange={(v) => setMediaType(v as MediaType)} label="Image" />
            <Radio name="mediaType" value="VIDEO" current={mediaType} onChange={(v) => setMediaType(v as MediaType)} label="Video (Veo)" />
          </div>
        </Section>

        {mediaType === "IMAGE" && (
          <Section title="Image Provider">
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls + " mb-2"}>Provider</label>
                <div className="flex gap-4">
                  <Radio name="provider" value="RUNWARE" current={provider} onChange={(v) => setProvider(v as Provider)} label="Runware (GPT Image 2)" />
                  <Radio name="provider" value="VERTEX" current={provider} onChange={(v) => setProvider(v as Provider)} label="Vertex AI (Imagen)" />
                </div>
              </div>

              {provider === "VERTEX" && (
                <div>
                  <label className={labelCls + " mb-2"}>Model</label>
                  <div className="flex flex-col gap-2">
                    {[
                      { id: "imagen-4.0-fast-generate-001", label: "Imagen 4 Fast" },
                      { id: "imagen-4.0-generate-001", label: "Imagen 4" },
                      { id: "imagen-4.0-ultra-generate-001", label: "Imagen 4 Ultra" },
                      { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash" },
                      { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image" },
                    ].map(m => (
                      <Radio key={m.id} name="vertexModel" value={m.id} current={vertexModel} onChange={setVertexModel} label={m.label} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls + " mb-2"}>Format</label>
                <div className="flex gap-4">
                  {["PNG", "JPG"].map((f) => (
                    <Radio key={f} name="format" value={f} current={format} onChange={setFormat} label={f} />
                  ))}
                </div>
              </div>

              {provider === "RUNWARE" && (
                <div>
                  <label className={labelCls + " mb-2"}>Quality</label>
                  <div className="flex gap-4">
                    {["low", "medium", "high"].map((q) => (
                      <Radio key={q} name="quality" value={q} current={quality} onChange={setQuality} label={q.charAt(0).toUpperCase() + q.slice(1)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {mediaType === "VIDEO" && (
          <Section title="Video Settings">
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Duration (seconds)</label>
                <input
                  type="number" min={1} max={60} value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-24 bg-[hsl(220_15%_13%)] border border-[hsl(220_15%_18%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[hsl(38_55%_55%)]"
                />
              </div>
              <div>
                <label className={labelCls + " mb-2"}>Resolution</label>
                <div className="flex gap-4">
                  <Radio name="resolution" value="720p" current={resolution} onChange={setResolution} label="720p" />
                  <Radio name="resolution" value="1080p" current={resolution} onChange={setResolution} label="1080p" />
                </div>
              </div>
            </div>
          </Section>
        )}

        <Section title="Aspect Ratio">
          <div className="flex gap-4">
            {(["16:9", "1:1", "9:16"] as AspectRatio[]).map((r) => (
              <Radio key={r} name="aspectRatio" value={r} current={aspectRatio} onChange={(v) => setAspectRatio(v as AspectRatio)} label={r} />
            ))}
          </div>
        </Section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit" disabled={submitting}
          className="bg-[hsl(38_55%_55%)] hover:bg-[hsl(38_55%_62%)] disabled:opacity-50 text-[hsl(220_20%_7%)] font-semibold py-2.5 rounded-lg text-sm transition-colors"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {submitting ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
