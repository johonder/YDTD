export function parseVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatSize(bytes) {
  if (!bytes || bytes === 0) return 'Unknown';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export function classifyFormat(f) {
  const hasAudio = f.audioChannels > 0 || f.audioSampleRate;
  const hasVideo = f.width && f.height;
  if (hasVideo && hasAudio) return 'video+audio';
  if (hasVideo) return 'video';
  if (hasAudio) return 'audio';
  return 'unknown';
}

export function getGroupLabel(f) {
  const q = f.qualityLabel || '';
  if (q.includes('2160')) return '4K';
  if (q.includes('1440')) return '2K';
  if (q.includes('1080')) return '1080p';
  if (q.includes('720')) return '720p';
  if (q.includes('480')) return '480p';
  if (q.includes('360')) return '360p';
  if (q.includes('240')) return '240p';
  if (q.includes('144')) return '144p';
  if (f.mimeType?.includes('audio')) return 'Audio';
  return q || 'Unknown';
}

export function getFormatCategory(f) {
  const mime = f.mimeType || '';
  if (mime.includes('mp4')) {
    if (f.width && f.height) return 'mp4-video';
    if (f.audioChannels || f.audioSampleRate) return 'mp4-audio';
    return 'mp4';
  }
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('3gp')) return '3gp';
  return 'other';
}

export function getFileExtension(f) {
  const mime = f.mimeType || '';
  if (mime.includes('mp4')) {
    if (f.width && f.height) return 'mp4';
    if (f.audioSampleRate) return 'm4a';
    return 'mp4';
  }
  if (mime.includes('webm')) {
    if (f.width && f.height) return 'webm';
    return 'opus';
  }
  if (mime.includes('3gp')) return '3gp';
  return 'unknown';
}

function extractJsonFromHtml(html, key) {
  const regex = new RegExp(`${key}\\s*=\\s*(\\{.*?\\});`, 's');
  const match = html.match(regex);
  if (!match) return null;
  const raw = match[1];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (raw[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try { return JSON.parse(raw.substring(start, i + 1)); } catch {}
      }
    }
  }
  return null;
}

export function extractDownloadUrl(format) {
  if (format.url) return format.url;
  const cipher = format.signatureCipher || format.cipher;
  if (!cipher) return null;
  try {
    const params = new URLSearchParams(cipher);
    const baseUrl = params.get('url');
    const s = params.get('s');
    const sp = params.get('sp') || 'sig';
    if (!baseUrl) return null;
    if (!s) return baseUrl;
    return `${baseUrl}&${sp}=${encodeURIComponent(s)}`;
  } catch { return null; }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchPage(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': 'CONSENT=YES+cb.20241201-17-p0.en+FX+; YSC=abc123; VISITOR_INFO1_LIVE=abc123',
        },
      });
      if (res.ok) return res;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    } catch {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

const IT_CLIENTS = [
  { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 31, hl: 'en', gl: 'US', osName: 'Android', osVersion: '14', platform: 'MOBILE' },
  { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en', gl: 'US' },
  { clientName: 'IOS', clientVersion: '19.09.37', hl: 'en', gl: 'US', deviceModel: 'iPhone16,2', osName: 'iOS', osVersion: '18.0_64', platform: 'MOBILE' },
];

async function callInnerTube(videoId) {
  for (const client of IT_CLIENTS) {
    try {
      const body = { context: { client }, videoId };
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': UA,
          'Origin': 'https://www.youtube.com',
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.videoDetails && data.streamingData && (data.streamingData.formats?.length || data.streamingData.adaptiveFormats?.length)) {
          return data;
        }
      }
    } catch {}
  }
  return null;
}

export async function getWatchPageData(videoId) {
  const errors = [];

  const pageRes = await fetchPage(`https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`);
  if (pageRes) {
    const html = await pageRes.text();
    if (html && html.length > 100) {
      const data = extractJsonFromHtml(html, 'ytInitialPlayerResponse');
      if (data && data.videoDetails) {
        const sd = data.streamingData || {};
        const formats = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
        if (formats.length > 0) return data;
        errors.push(`Watch page: ${formats.length} formats`);
      } else {
        errors.push('Watch page: no player response');
      }
    } else {
      errors.push('Watch page: short HTML');
    }
  } else {
    errors.push('Watch page: fetch failed');
  }

  const itData = await callInnerTube(videoId);
  if (itData) return itData;
  errors.push('InnerTube: failed');

  throw new Error(errors.join(' | '));
}
