# YTD - YouTube Video Downloader

[![Deploy to Cloudflare](https://github.com/johonder/YDTD/actions/workflows/deploy.yml/badge.svg)](https://github.com/johonder/YDTD/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A fast, free YouTube video downloader with a clean web interface and REST API. Built with Cloudflare Pages + Workers for global performance.

**Live Demo:** `https://ytd.pages.dev`

---

## Features

- **Direct YouTube Downloads** — Download any public YouTube video
- **Multiple Formats** — Video (MP4/WebM) and Audio (M4A/Opus) in all qualities up to 4K
- **REST API** — Simple API for integration into your own apps
- **100% Free** — No registration, no rate limits
- **Cloudflare Powered** — Global CDN, fast anywhere
- **RapidAPI Ready** — Easy to share via RapidAPI Hub

---

## Quick Start (Website)

1. Go to `https://ytd.pages.dev`
2. Paste a YouTube URL (e.g., `https://youtube.com/watch?v=dQw4w9WgXcQ`)
3. Click **Get Video**
4. Choose your preferred format and quality
5. Download starts automatically

---

## API Documentation

### Base URL

```
https://ytd.pages.dev/api
```

### Authentication

No authentication required for basic usage. For RapidAPI, pass your key in the `X-RapidAPI-Key` header.

### Endpoints

#### `GET /api/info`

Get video metadata and all available download formats.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Full YouTube URL or video ID |

**Example:**

```bash
curl "https://ytd.pages.dev/api/info?url=https://youtube.com/watch?v=dQw4w9WgXcQ"
```

**Response:**

```json
{
  "success": true,
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "author": "Rick Astley",
  "duration": 212,
  "durationFormatted": "3:32",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "viewCount": 1500000000,
  "formats": [
    {
      "itag": 18,
      "mimeType": "video/mp4",
      "quality": "360p",
      "width": 640,
      "height": 360,
      "contentLength": "12345678",
      "size": "11.8 MB",
      "hasAudio": true,
      "hasVideo": true,
      "type": "video+audio",
      "group": "360p",
      "container": "mp4"
    }
  ]
}
```

#### `GET /api/download`

Get a direct download URL for a specific format.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Full YouTube URL or video ID |
| `itag` | int | No | Format itag (from /api/info). Default: best video+audio |
| `redirect` | bool | No | Set to `false` to get JSON instead of redirect |

**Example (redirect):**

```bash
curl -L "https://ytd.pages.dev/api/download?url=https://youtube.com/watch?v=dQw4w9WgXcQ&itag=18"
```

**Example (JSON):**

```bash
curl "https://ytd.pages.dev/api/download?url=https://youtube.com/watch?v=dQw4w9WgXcQ&itag=18&redirect=false"
```

**Response:**

```json
{
  "success": true,
  "downloadUrl": "https://rr4---sn-...googlevideo.com/videoplayback...",
  "format": {
    "itag": 18,
    "quality": "360p",
    "mimeType": "video/mp4",
    "contentLength": "12345678"
  }
}
```

### Rate Limiting

Currently no rate limits. Please be respectful.

### Error Codes

| Code | Description |
|------|-------------|
| 400 | Missing or invalid URL |
| 403 | Age-restricted content |
| 404 | Format not found |
| 500 | Internal error |

---

## RapidAPI Deployment

1. Go to [RapidAPI](https://rapidapi.com) and sign in
2. Click **Add New API**
3. Set the API name and description
4. For the **Base URL**, enter `https://ytd.pages.dev/api`
5. Add the endpoints:
   - `GET /info` — params: `url` (string, required)
   - `GET /download` — params: `url` (string, required), `itag` (int, optional)
6. Publish your API

---

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/johonder/YDTD.git
cd ytd
npm install
```

### Run Dev Server

```bash
npx wrangler pages dev public
```

This starts a local server at `http://localhost:8788` with live reload.

### Deploy to Cloudflare

```bash
npm run deploy
```

Or set up the GitHub Actions workflow (see `.github/workflows/deploy.yml`).

---

## Deployment

### Option 1: GitHub Actions (Recommended)

1. Fork this repo
2. Get your Cloudflare API token:
   - Cloudflare Dashboard → My Profile → API Tokens → Create Token
   - Use the "Edit Cloudflare Workers" template
3. Add `CF_API_TOKEN` to your repo's GitHub Secrets
4. Push to `main` — the workflow auto-deploys

### Option 2: Wrangler CLI

```bash
npm install -g wrangler
wrangler login
npm run deploy
```

---

## Project Structure

```
ytd/
├── public/                  # Static frontend (Cloudflare Pages)
│   ├── index.html           # Main page
│   ├── css/style.css        # Dark theme styles
│   └── js/app.js            # Frontend logic
├── functions/               # Cloudflare Pages Functions (Workers API)
│   ├── api/
│   │   ├── info.js          # GET /api/info — Video metadata & formats
│   │   └── download.js      # GET /api/download — Direct download URL
│   └── _middleware.js        # CORS headers
├── package.json
├── wrangler.toml
├── .github/workflows/deploy.yml
├── README.md
└── LICENSE
```

---

## How It Works

1. The frontend sends a YouTube URL to the Cloudflare Worker API
2. The Worker calls YouTube's internal Innertube API (Android client)
3. YouTube returns streaming URLs for all available formats
4. The Worker parses and returns the formatted data
5. The frontend displays format options; clicking downloads directly from YouTube's CDN

---

## Limitations

- **Age-restricted videos** require authentication (not supported)
- **Private videos** cannot be downloaded
- **Download URLs expire** after a few hours (YouTube's limitation)
- **Live streams** are not supported

---

## Legal

This project is for educational purposes. Downloading videos from YouTube may violate YouTube's Terms of Service. Use at your own risk. Only download content you have the right to access.

---

## License

MIT
