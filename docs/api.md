# YTD API Documentation

> Share this API on RapidAPI Hub for easy integration.

## Base URL

```
https://ytd.pages.dev/api
```

## Authentication

| Method | Header | Description |
|--------|--------|-------------|
| None | — | Public access |
| RapidAPI | `X-RapidAPI-Key` | RapidAPI integration |

---

## Endpoints

### 1. Get Video Info

Returns video metadata and all available download formats.

```
GET /api/info?url={youtube_url}
```

**Parameters:**

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|---------|
| `url` | string | Yes | YouTube video URL or ID | `https://youtube.com/watch?v=dQw4w9WgXcQ` |

**Response (200):**

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
      "itag": 137,
      "quality": "1080p",
      "mimeType": "video/mp4",
      "size": "52.3 MB",
      "type": "video",
      "container": "mp4",
      "width": 1920,
      "height": 1080,
      "fps": 30
    },
    {
      "itag": 18,
      "quality": "360p",
      "mimeType": "video/mp4",
      "size": "11.8 MB",
      "type": "video+audio",
      "container": "mp4",
      "width": 640,
      "height": 360
    },
    {
      "itag": 140,
      "quality": "audio",
      "mimeType": "audio/mp4",
      "size": "3.2 MB",
      "type": "audio",
      "container": "m4a"
    }
  ]
}
```

### 2. Get Download URL

Returns a direct download URL for a specific format.

```
GET /api/download?url={youtube_url}&itag={format_itag}
```

**Parameters:**

| Name | Type | Required | Description | Default |
|------|------|----------|-------------|---------|
| `url` | string | Yes | YouTube video URL or ID | — |
| `itag` | int | No | Format itag (from /api/info) | Best video+audio |
| `redirect` | bool | No | Set false for JSON response | true |

**Response (200, redirect=true):**

Redirects to the video download URL.

**Response (200, redirect=false):**

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

---

## cURL Examples

```bash
# Get video info
curl "https://ytd.pages.dev/api/info?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# Download (redirect)
curl -L -o video.mp4 "https://ytd.pages.dev/api/download?url=https://youtube.com/watch?v=dQw4w9WgXcQ&itag=18"

# Get download URL as JSON
curl "https://ytd.pages.dev/api/download?url=https://youtube.com/watch?v=dQw4w9WgXcQ&itag=18&redirect=false"
```

## Python

```python
import requests

url = "https://ytd.pages.dev/api/info"
params = {"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
response = requests.get(url, params=params)
data = response.json()

print(f"Title: {data['title']}")
for fmt in data['formats']:
    print(f"  {fmt['quality']} - {fmt['size']}")
```

## JavaScript

```javascript
const response = await fetch(
  'https://ytd.pages.dev/api/info?url=' + 
  encodeURIComponent('https://youtube.com/watch?v=dQw4w9WgXcQ')
);
const data = await response.json();
console.log(data.title);
```

## Node.js

```javascript
const https = require('https');

const url = new URL('https://ytd.pages.dev/api/info');
url.searchParams.set('url', 'https://youtube.com/watch?v=dQw4w9WgXcQ');

https.get(url.toString(), (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(JSON.parse(data).title);
  });
});
```

---

## Error Handling

All endpoints return:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid URL) |
| 403 | Forbidden (age-restricted) |
| 404 | Format not found |
| 500 | Server error |
| 502 | Upstream API error |

---

## RapidAPI Integration

### Step-by-step

1. **Create an API on RapidAPI**
   - Go to [RapidAPI Provider Dashboard](https://rapidapi.com/developer)
   - Click "Add New API"
   - Name: `YTD - YouTube Video Downloader`

2. **Configure Endpoints**

   | Endpoint | Method | Parameters |
   |----------|--------|------------|
   | `/api/info` | GET | `url` (string, required) |
   | `/api/download` | GET | `url` (string, required), `itag` (int, optional) |

3. **Set Base URL**
   ```
   https://ytd.pages.dev/api
   ```

4. **Publish**

### RapidAPI Pricing Suggestions

| Plan | Requests/month | Price |
|------|---------------|-------|
| Free | 1000 | $0 |
| Basic | 10000 | $5 |
| Pro | 100000 | $20 |

---

## Rate Limits

None currently enforced. Please be reasonable with request volumes.

---

## Support

- GitHub Issues: [https://github.com/yourusername/ytd/issues](https://github.com/yourusername/ytd/issues)
