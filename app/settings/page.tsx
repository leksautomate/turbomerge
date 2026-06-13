"use client";
import { useState, useEffect } from "react";

const inputCls = "w-full bg-[hsl(220_15%_13%)] border border-[hsl(220_15%_18%)] rounded-lg px-3 py-2 text-sm text-[hsl(40_15%_90%)] placeholder-[hsl(220_10%_40%)] focus:outline-none focus:border-[hsl(38_55%_55%)]";
const selectCls = "w-full bg-[hsl(220_15%_13%)] border border-[hsl(220_15%_18%)] rounded-lg px-3 py-2 text-sm text-[hsl(40_15%_90%)] focus:outline-none focus:border-[hsl(38_55%_55%)]";
const labelCls = "block text-sm font-medium text-[hsl(40_15%_85%)] mb-1";
const hintCls = "text-xs text-[hsl(220_10%_50%)] mt-1";

const IMAGE_MODELS = [
  { id: "imagen-4.0-fast-generate-001", label: "Imagen 4 Fast" },
  { id: "imagen-4.0-generate-001", label: "Imagen 4" },
  { id: "imagen-4.0-ultra-generate-001", label: "Imagen 4 Ultra" },
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
  { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image" },
];

const VEO_MODELS = [
  { id: "veo-3.1-lite-generate-001", label: "Veo 3.1 Lite" },
  { id: "veo-3.0-fast-preview", label: "Veo 3.0 Fast" },
  { id: "veo-2.0-generate-001", label: "Veo 2.0" },
];

interface Settings {
  RUNWARE_API_KEY: string;
  DATABASE_URL: string;
  VERTEX_PROJECT_ID: string;
  VERTEX_LOCATION_ID: string;
  IMAGE_MODEL: string;
  IMAGE_ASPECT_RATIO: string;
  IMAGE_CONCURRENCY: string;
  VEO_MODEL_ID: string;
  VEO_LOCATION_ID: string;
}

const DEFAULTS: Settings = {
  RUNWARE_API_KEY: "",
  DATABASE_URL: "",
  VERTEX_PROJECT_ID: "",
  VERTEX_LOCATION_ID: "europe-west4",
  IMAGE_MODEL: "imagen-4.0-fast-generate-001",
  IMAGE_ASPECT_RATIO: "16:9",
  IMAGE_CONCURRENCY: "2",
  VEO_MODEL_ID: "veo-3.1-lite-generate-001",
  VEO_LOCATION_ID: "us-central1",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[hsl(220_18%_10%)] border border-[hsl(220_15%_18%)] rounded-xl p-5">
      <h3 className="text-base font-semibold text-[hsl(40_15%_90%)] mb-4" style={{ fontFamily: "'Cinzel', serif" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls + " pr-16"}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[hsl(220_10%_50%)] hover:text-[hsl(40_15%_80%)] px-2 py-1"
      >
        {show ? "hide" : "show"}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : {})
      .then((d) => setSettings(s => ({ ...s, ...d })));
  }, []);

  const set = (key: keyof Settings) => (val: string) =>
    setSettings(s => ({ ...s, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cinzel', serif" }}>Settings</h1>
          <p className="text-sm text-[hsl(220_10%_50%)] mt-1">
            Saved to <code className="bg-[hsl(220_15%_15%)] text-[hsl(38_55%_55%)] px-1.5 py-0.5 rounded text-xs">.env</code>. Restart the server after saving.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[hsl(38_55%_55%)] hover:bg-[hsl(38_55%_62%)] disabled:opacity-50 text-[hsl(220_20%_7%)] font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* API Keys */}
        <Card title="API Keys">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>Runware API Key</label>
              <PasswordInput value={settings.RUNWARE_API_KEY} onChange={set("RUNWARE_API_KEY")} placeholder="rw-..." />
              <p className={hintCls}>For Runware image generation (GPT Image 2). Get keys at runware.ai</p>
            </div>
            <div className="border-t border-[hsl(220_15%_18%)]" />
            <div>
              <label className={labelCls}>Google Cloud Project ID</label>
              <input value={settings.VERTEX_PROJECT_ID} onChange={(e) => set("VERTEX_PROJECT_ID")(e.target.value)} placeholder="my-project-id" className={inputCls} />
              <p className={hintCls}>Required for Vertex AI (Imagen + Veo)</p>
            </div>
            <div>
              <label className={labelCls}>Vertex AI Location</label>
              <select value={settings.VERTEX_LOCATION_ID} onChange={(e) => set("VERTEX_LOCATION_ID")(e.target.value)} className={selectCls}>
                <option value="europe-west4">europe-west4 (recommended for Imagen)</option>
                <option value="us-central1">us-central1</option>
                <option value="us-east4">us-east4</option>
              </select>
              <p className={hintCls}>Veo always uses us-central1 regardless of this setting</p>
            </div>
            <div className="border-t border-[hsl(220_15%_18%)]" />
            <div>
              <label className={labelCls}>Database URL</label>
              <input
                type="text"
                value={settings.DATABASE_URL}
                onChange={(e) => set("DATABASE_URL")(e.target.value)}
                placeholder="postgresql://user:password@localhost:5432/turbobatch"
                className={inputCls}
              />
            </div>
          </div>
        </Card>

        {/* Image Generation */}
        <Card title="Image Generation">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>Vertex AI Image Model</label>
              <select value={settings.IMAGE_MODEL} onChange={(e) => set("IMAGE_MODEL")(e.target.value)} className={selectCls}>
                {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <p className={hintCls}>Default model for new Vertex AI image projects</p>
            </div>
            <div>
              <label className={labelCls}>Default Aspect Ratio</label>
              <select value={settings.IMAGE_ASPECT_RATIO} onChange={(e) => set("IMAGE_ASPECT_RATIO")(e.target.value)} className={selectCls}>
                <option value="16:9">16:9 Landscape</option>
                <option value="1:1">1:1 Square</option>
                <option value="9:16">9:16 Portrait</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Concurrency: {settings.IMAGE_CONCURRENCY} parallel jobs</label>
              <input
                type="range" min={1} max={8} step={1}
                value={settings.IMAGE_CONCURRENCY}
                onChange={(e) => set("IMAGE_CONCURRENCY")(e.target.value)}
                className="w-full accent-[hsl(38_55%_55%)]"
              />
              <p className={hintCls}>How many images generate in parallel (Imagen quota is ~2)</p>
            </div>
          </div>
        </Card>

        {/* Video Generation */}
        <Card title="Video Generation (Veo)">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>Veo Model</label>
              <select value={settings.VEO_MODEL_ID} onChange={(e) => set("VEO_MODEL_ID")(e.target.value)} className={selectCls}>
                {VEO_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <p className={hintCls}>Veo 3.1 Lite is fastest; Veo 3.0 Fast includes audio generation; Veo 2.0 is most stable</p>
            </div>
            <div className="bg-[hsl(38_40%_12%/0.6)] border border-[hsl(38_40%_22%/0.5)] rounded-lg p-4">
              <p className="text-sm font-medium text-[hsl(38_55%_65%)] mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
                Vertex AI Auth Required
              </p>
              <p className="text-xs text-[hsl(38_30%_55%)] mb-2">
                Imagen and Veo require gcloud CLI authentication. Run once:
              </p>
              <code className="block bg-[hsl(220_15%_8%)] text-[hsl(38_55%_65%)] text-xs rounded px-3 py-2 font-mono mb-1">
                gcloud auth login --no-browser
              </code>
              <code className="block bg-[hsl(220_15%_8%)] text-[hsl(38_55%_65%)] text-xs rounded px-3 py-2 font-mono">
                gcloud auth application-default login --no-browser
              </code>
            </div>
          </div>
        </Card>
      </div>

      {saved && (
        <p className="text-xs text-[hsl(220_10%_50%)] text-center mt-4">
          Restart the dev server to apply changes.
        </p>
      )}
    </div>
  );
}
