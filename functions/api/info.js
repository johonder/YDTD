const YT_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const YT_API_URL = 'https://www.youtube.com/youtubei/v1/player';

function parseVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return 'Unknown';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function classifyFormat(f) {
  const hasAudio = f.audioChannels > 0 || f.audioSampleRate;
  const hasVideo = f.width && f.height;
  const quality = f.qualityLabel || f.quality || '';

  if (hasVideo && hasAudio) return 'video+audio';
  if (hasVideo) return 'video';
  if (hasAudio) return 'audio';
  return 'unknown';
}

function getGroupLabel(f) {
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

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429 && i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');
  const videoId = parseVideoId(videoUrl);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (!videoUrl) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing "url" parameter. Provide a YouTube video URL.'
    }), { status: 400, headers });
  }

  if (!videoId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid YouTube URL. Could not extract video ID.'
    }), { status: 400, headers });
  }

  try {
    const body = {
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.09.37',
          androidSdkVersion: 31,
          hl: 'en',
          gl: 'US',
          osName: 'Android',
          osVersion: '14',
          platform: 'MOBILE'
        }
      },
      videoId,
      playbackContext: {
        contentPlaybackContext: {
          vis: 0,
          splay: false,
          referer: 'https://www.youtube.com',
          currentUrl: `/watch?v=${videoId}`,
          autonavState: 'STATE_NONE'
        }
      }
    };

    const response = await fetchWithRetry(`${YT_API_URL}?key=${YT_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to reach YouTube API after retries.'
      }), { status: 502, headers });
    }

    const data = await response.json();

    if (data.playabilityStatus?.status === 'UNPLAYABLE') {
      return new Response(JSON.stringify({
        success: false,
        error: data.playabilityStatus.reason || 'This video is not playable.'
      }), { status: 400, headers });
    }

    if (data.playabilityStatus?.status === 'LOGIN_REQUIRED') {
      return new Response(JSON.stringify({
        success: false,
        error: data.playabilityStatus.reason || 'Age-restricted content. Login required.'
      }), { status: 403, headers });
    }

    if (!data.videoDetails || !data.streamingData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not extract video data. The video may be private or unavailable.'
      }), { status: 400, headers });
    }

    const details = data.videoDetails;
    const streamingData = data.streamingData;
    const thumbnails = details.thumbnail?.thumbnails || [];
    const bestThumb = thumbnails.reduce((best, t) =>
      (t.width * t.height > (best.width || 0) * (best.height || 0)) ? t : best, {}
    );

    const allFormats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];

    const formats = allFormats
      .filter(f => f.url || f.signatureCipher || f.cipher)
      .map(f => ({
        itag: f.itag,
        mimeType: f.mimeType?.split(';')[0] || f.mimeType,
        quality: f.qualityLabel || f.quality || 'unknown',
        qualityNumber: f.quality,
        width: f.width || null,
        height: f.height || null,
        fps: f.fps || null,
        bitrate: f.bitrate || null,
        contentLength: f.contentLength || null,
        size: formatSize(parseInt(f.contentLength) || 0),
        hasAudio: (f.audioChannels > 0) || false,
        hasVideo: (f.width > 0) || false,
        type: classifyFormat(f),
        group: getGroupLabel(f),
        url: f.url || null,
        audioChannels: f.audioChannels || null,
        audioSampleRate: f.audioSampleRate || null,
        audioQuality: f.audioQuality || null,
        container: f.mimeType?.includes('mp4') ? 'mp4' :
                    f.mimeType?.includes('webm') ? 'webm' :
                    f.mimeType?.includes('3gp') ? '3gp' : 'unknown'
      }));

    const formatGroups = {};
    for (const f of formats) {
      const g = f.group;
      if (!formatGroups[g]) formatGroups[g] = [];
      formatGroups[g].push(f);
    }

    const recommended = formats.filter(f => f.type === 'video+audio').slice(0, 3);
    if (recommended.length === 0) {
      const vids = formats.filter(f => f.hasVideo).sort((a, b) => (b.height || 0) - (a.height || 0));
      const auds = formats.filter(f => f.hasAudio && !f.hasVideo);
      if (vids.length > 0) {
        recommended.push(vids[0]);
        if (auds.length > 0) recommended.push(auds[0]);
      }
    } else if (recommended.length < 3) {
      const auds = formats.filter(f => f.type === 'audio');
      if (auds.length > 0) recommended.push(auds[0]);
    }

    return new Response(JSON.stringify({
      success: true,
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: details.title,
      author: details.author,
      channelId: details.channelId,
      duration: parseInt(details.lengthSeconds) || 0,
      durationFormatted: formatDuration(parseInt(details.lengthSeconds) || 0),
      thumbnail: bestThumb.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      thumbnailWidth: bestThumb.width || null,
      thumbnailHeight: bestThumb.height || null,
      viewCount: parseInt(details.viewCount) || 0,
      likeCount: parseInt(details.likeCount) || null,
      description: (details.shortDescription || '').substring(0, 500),
      isPrivate: details.isPrivate || false,
      isLive: details.isLiveContent || false,
      formats,
      formatGroups: Object.keys(formatGroups),
      recommendedFormats: recommended.slice(0, 5)
    }, null, 2), {
      status: 200,
      headers
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error: ' + err.message
    }), { status: 500, headers });
  }
}
