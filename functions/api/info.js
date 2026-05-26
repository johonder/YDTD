import {
  parseVideoId,
  formatDuration,
  formatSize,
  classifyFormat,
  getGroupLabel,
  getFormatCategory,
  getFileExtension,
  extractDownloadUrl,
  getWatchPageData,
} from '../_extractor.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');
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
    if (playabilityStatus.status === 'UNPLAYABLE') {
      return new Response(JSON.stringify({ success: false, error: playabilityStatus.reason || 'Video not playable.' }), { status: 400, headers });
    }
    if (playabilityStatus.status === 'LOGIN_REQUIRED') {
      return new Response(JSON.stringify({ success: false, error: playabilityStatus.reason || 'Age-restricted content.' }), { status: 403, headers });
    }

    const details = playerData.videoDetails;
    const streamingData = playerData.streamingData;

    if (!details || !streamingData) {
      return new Response(JSON.stringify({ success: false, error: 'Could not extract video data.' }), { status: 400, headers });
    }

    const thumbnails = details.thumbnail?.thumbnails || [];
    const bestThumb = thumbnails.reduce((best, t) => (t.width * t.height > (best.width || 0) * (best.height || 0)) ? t : best, {});

    const allFormats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];

    const formats = allFormats
      .filter(f => f.url || f.signatureCipher || f.cipher)
      .map(f => ({
        itag: f.itag,
        mimeType: f.mimeType?.split(';')[0] || f.mimeType,
        quality: f.qualityLabel || f.quality || 'unknown',
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
        category: getFormatCategory(f),
        extension: getFileExtension(f),
        url: extractDownloadUrl(f),
        audioChannels: f.audioChannels || null,
        audioSampleRate: f.audioSampleRate || null,
        audioQuality: f.audioQuality || null,
        container: f.mimeType?.includes('mp4') ? 'mp4' :
                    f.mimeType?.includes('webm') ? 'webm' :
                    f.mimeType?.includes('3gp') ? '3gp' : 'unknown',
      }));

    const formatGroups = {};
    for (const f of formats) {
      const g = f.group;
      if (!formatGroups[g]) formatGroups[g] = [];
      formatGroups[g].push(f);
    }

    const categories = { 'mp4-video': [], 'mp4-audio': [], 'webm': [], '3gp': [], 'other': [] };
    for (const f of formats) {
      const cat = f.category;
      if (categories[cat]) categories[cat].push(f);
      else categories['other'].push(f);
    }

    for (const key of Object.keys(categories)) {
      categories[key].sort((a, b) => (b.height || 0) - (a.height || 0));
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
      categories: {
        mp4Video: categories['mp4-video'],
        mp4Audio: categories['mp4-audio'],
        webm: categories['webm'],
        other: categories['other'],
      },
      recommendedFormats: recommended.slice(0, 5),
    }, null, 2), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error: ' + err.message,
    }), { status: 500, headers });
  }
}
