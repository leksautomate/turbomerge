# TurboBatch

Bulk AI image and video generator. Create a project, paste your prompts, and generate hundreds of images or videos in parallel using Runware (GPT Image 2), Google Vertex AI (Imagen 4, Gemini), or Veo video generation.

---

## Features

- **Bulk image generation** — Runware (GPT Image 2) or Vertex AI (Imagen 4 / Gemini)
- **Bulk video generation** — Google Veo 3.1 Lite / Veo 3.0 / Veo 2.0
- **Parallel workers** — configurable concurrency, job queue with retry
- **Project dashboard** — track progress per project, download all outputs as ZIP
- **Settings UI** — manage API keys and generation defaults from the browser

---

## One-Click VPS Install

Tested on Ubuntu 20.04 / 22.04 / 24.04.

```bash
curl -fsSL https://raw.githubusercontent.com/leksautomate/turbomerge/main/install.sh | sudo bash
```

**What it sets up automatically:**
- Node.js 20 LTS
- PostgreSQL (creates `turbobatch` database with a secure random password)
- PM2 (keeps the web server + worker alive, auto-starts on reboot)
- nginx (reverse proxy on port 80)
- SSL certificate via Let's Encrypt (if you provide a domain)
- UFW firewall (SSH + HTTP + HTTPS)

You'll be prompted for your API keys and optional domain during install. All keys can also be changed later from the Settings page inside the app.

---

## Manual Setup (local / custom)

### Requirements

- Node.js 20+
- PostgreSQL 14+

### Steps

```bash
# 1. Clone
git clone https://github.com/leksautomate/turbomerge
cd turbomerge

# 2. Install dependencies
npm install

# 3. Create .env
cp .env.example .env
# Edit .env with your DATABASE_URL and API keys

# 4. Run migrations
npx prisma migrate dev

# 5. Start the app + worker
npm run dev          # Next.js on :3000
npm run worker:dev   # Background job worker
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `RUNWARE_API_KEY` | For Runware | API key from runware.ai |
| `VERTEX_PROJECT_ID` | For Imagen/Veo | Google Cloud project ID |
| `VERTEX_LOCATION_ID` | For Imagen | Vertex AI region (default: `europe-west4`) |
| `IMAGE_MODEL` | — | Default Imagen model (default: `imagen-4.0-fast-generate-001`) |
| `IMAGE_ASPECT_RATIO` | — | Default ratio: `16:9` / `1:1` / `9:16` |
| `IMAGE_CONCURRENCY` | — | Parallel image jobs (default: `2`) |
| `VEO_MODEL_ID` | For Veo | Veo model (default: `veo-3.1-lite-generate-001`) |
| `VEO_LOCATION_ID` | For Veo | Always `us-central1` |

All of these can be set from **Settings** in the app UI, which writes directly to `.env`.

---

## Vertex AI Setup (Imagen + Veo)

Imagen and Veo use Application Default Credentials. Run once on the server:

```bash
gcloud auth login --no-browser
gcloud auth application-default login --no-browser
```

---

## Providers

| Provider | Media | Notes |
|---|---|---|
| Runware | Image | GPT Image 2 — fast, great quality, pay-per-image |
| Vertex AI Imagen 4 | Image | Google's best image model, needs GCP project |
| Vertex AI Gemini | Image | Gemini image generation via Vertex |
| Google Veo 3.1 Lite | Video | Fastest Veo model |
| Google Veo 3.0 Fast | Video | Includes audio generation |
| Google Veo 2.0 | Video | Most stable, widest availability |

---

## VPS Management

```bash
pm2 status          # App and worker status
pm2 logs            # Live logs
pm2 restart all     # Restart everything

# Update to latest version
cd /opt/turbobatch && git pull && npm ci && npm run build && pm2 restart all
```

---

## License

MIT
