import {
  parseVideoId,
  formatSize,
  extractDownloadUrl,
  getWatchPageData,
} from '../_extractor.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');
  const itag = url.searchParams.get('itag');
  const doRedirect = url.searchParams.get('redirect') !== 'false';
  const doProxy = url.searchParams.get('proxy') === 'true';

  const videoId = parseVideoId(videoUrl);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (!videoUrl) {
    return new Response(JSON.stringify({ success: false, error: 'Missing "url" parameter.' }), { status: 400, headers });
  }

  if (!videoId) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid YouTube URL.' }), { status: 400, headers });
  }

  try {
    const playerData = await getWatchPageData(videoId);

    const playabilityStatus = playerData.playabilityStatus || {};
    if (playabilityStatus.status !== 'OK') {
      return new Response(JSON.stringify({ success: false, error: playabilityStatus?.reason || 'Video not available.' }), { status: 400, headers });
    }

    const streamingData = playerData.streamingData;
    if (!streamingData) {
      return new Response(JSON.stringify({ success: false, error: 'Could not extract streaming data.' }), { status: 400, headers });
    }

    const allFormats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];
    const details = playerData.videoDetails || {};
    const title = details.title || 'video';

    let targetFormat;
    if (itag) {
      targetFormat = allFormats.find(f => f.itag === parseInt(itag));
    } else {
      targetFormat = allFormats.find(f => (f.url || f.signatureCipher || f.cipher) && f.qualityLabel && !f.audioChannels);
      if (!targetFormat) targetFormat = allFormats.find(f => f.url || f.signatureCipher || f.cipher);
    }

    if (!targetFormat) {
      return new Response(JSON.stringify({
        success: false, error: itag ? `Format with itag ${itag} not found.` : 'No downloadable formats found.',
      }), { status: 404, headers });
    }

    const downloadUrl = extractDownloadUrl(targetFormat);
    if (!downloadUrl) {
      return new Response(JSON.stringify({ success: false, error: 'Could not extract download URL for this format.' }), { status: 500, headers });
    }

    const container = targetFormat.mimeType?.includes('mp4') ? 'mp4' :
                      targetFormat.mimeType?.includes('webm') ? 'webm' :
                      targetFormat.mimeType?.includes('3gp') ? '3gp' : 'mp4';

    const ext = targetFormat.audioChannels && !targetFormat.width ? 'm4a' : container;
    const safeTitle = title.replace(/[^\w\s-]/g, '').trim().substring(0, 100);
    const filename = `${safeTitle}.${ext}`;

    const formatInfo = {
      itag: targetFormat.itag,
      quality: targetFormat.qualityLabel || targetFormat.quality || 'unknown',
      mimeType: targetFormat.mimeType?.split(';')[0] || targetFormat.mimeType,
      contentLength: targetFormat.contentLength || null,
      size: formatSize(parseInt(targetFormat.contentLength) || 0),
      width: targetFormat.width || null,
      height: targetFormat.height || null,
      fps: targetFormat.fps || null,
      container,
      filename,
    };

    if (doProxy) {
      try {
        const proxyHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com',
        };

        const rangeHeader = request.headers.get('Range');
        if (rangeHeader) proxyHeaders['Range'] = rangeHeader;

        const proxyRes = await fetch(downloadUrl, { headers: proxyHeaders });

        if (proxyRes.ok || proxyRes.status === 206) {
          const responseHeaders = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': targetFormat.mimeType?.split(';')[0] || 'application/octet-stream',
            'Accept-Ranges': 'bytes',
            'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, Accept-Ranges',
          });

          if (targetFormat.contentLength) {
            responseHeaders.set('Content-Length', targetFormat.contentLength);
          }

          const cr = proxyRes.headers.get('Content-Range');
          if (cr) responseHeaders.set('Content-Range', cr);

          return new Response(proxyRes.body, {
            status: proxyRes.status,
            headers: responseHeaders,
          });
        }

        return new Response(JSON.stringify({
          success: false,
          error: 'Proxy download failed. Try again or use direct link.',
          downloadUrl,
          format: formatInfo,
          proxyStatus: proxyRes.status,
        }), { status: 502, headers });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Proxy failed: ' + e.message,
          downloadUrl,
          format: formatInfo,
        }), { status: 502, headers });
      }
    }

    if (doRedirect) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': downloadUrl,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      downloadUrl,
      format: formatInfo,
      note: 'Use downloadUrl to download. URLs expire after a few hours.',
    }, null, 2), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error: ' + err.message,
    }), { status: 500, headers });
  }
}
