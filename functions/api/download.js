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
  const itag = url.searchParams.get('itag');
  const redirect = url.searchParams.get('redirect') !== 'false';
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
      error: 'Missing "url" parameter.'
    }), { status: 400, headers });
  }

  if (!videoId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid YouTube URL.'
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
        error: 'Failed to reach YouTube API.'
      }), { status: 502, headers });
    }

    const data = await response.json();

    if (data.playabilityStatus?.status !== 'OK') {
      return new Response(JSON.stringify({
        success: false,
        error: data.playabilityStatus?.reason || 'Video not available.'
      }), { status: 400, headers });
    }

    const allFormats = [
      ...(data.streamingData?.formats || []),
      ...(data.streamingData?.adaptiveFormats || [])
    ];

    let targetFormat;
    if (itag) {
      targetFormat = allFormats.find(f => f.itag === parseInt(itag));
    } else {
      targetFormat = allFormats.find(f => f.url && f.qualityLabel && !f.audioChannels);
      if (!targetFormat) targetFormat = allFormats.find(f => f.url);
    }

    if (!targetFormat) {
      return new Response(JSON.stringify({
        success: false,
        error: itag
          ? `Format with itag ${itag} not found.`
          : 'No downloadable formats found.'
      }), { status: 404, headers });
    }

    let downloadUrl = targetFormat.url;

    if (!downloadUrl) {
      const cipher = targetFormat.signatureCipher || targetFormat.cipher;
      if (cipher) {
        const params = new URLSearchParams(cipher);
        downloadUrl = params.get('url');
        if (params.get('sp') && params.get('s')) {
          downloadUrl += `&${params.get('sp')}=${params.get('s')}`;
        }
      }
    }

    if (!downloadUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not extract download URL for this format.'
      }), { status: 500, headers });
    }

    const formatInfo = {
      itag: targetFormat.itag,
      quality: targetFormat.qualityLabel || targetFormat.quality || 'unknown',
      mimeType: targetFormat.mimeType?.split(';')[0] || targetFormat.mimeType,
      contentLength: targetFormat.contentLength || null,
      width: targetFormat.width || null,
      height: targetFormat.height || null,
      fps: targetFormat.fps || null
    };

    if (redirect) {
      const downloadHeaders = {
        ...headers,
        'Content-Type': 'application/json',
        'Location': downloadUrl
      };
      return new Response(JSON.stringify({
        success: true,
        message: 'Redirecting to download...',
        downloadUrl,
        format: formatInfo
      }), {
        status: 200,
        headers: downloadHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      downloadUrl,
      format: formatInfo,
      note: 'Use the downloadUrl to download the video. This URL may expire.'
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
