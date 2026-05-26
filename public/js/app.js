const API_BASE = '/api';
const API_KEY = 'YDTD-DEMO-2024';

const $ = (id) => document.getElementById(id);

const el = {
  urlInput: $('urlInput'),
  fetchBtn: $('fetchBtn'),
  pasteBtn: $('pasteBtn'),
  errorMessage: $('errorMessage'),
  errorText: $('errorText'),
  results: $('results'),
  videoThumbnail: $('videoThumbnail'),
  durationBadge: $('durationBadge'),
  videoTitle: $('videoTitle'),
  videoAuthor: $('videoAuthor'),
  videoDuration: $('videoDuration'),
  videoViews: $('videoViews'),
  mp4Grid: $('mp4Grid'),
  mp3Grid: $('mp3Grid'),
  otherGrid: $('otherGrid'),
  mp4Count: $('mp4Count'),
  mp3Count: $('mp3Count'),
  otherCount: $('otherCount'),
  mp4Section: $('mp4Section'),
  mp3Section: $('mp3Section'),
  otherSection: $('otherSection'),
  progressContainer: $('progressContainer'),
  progressFill: $('progressFill'),
  progressText: $('progressText'),
  progressPercent: $('progressPercent'),
};

let allFormats = [];

function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/) || url.match(/^([a-zA-Z0-9_-]{11})$/);
  return m ? m[1] : null;
}

function showError(msg) {
  el.errorText.textContent = msg;
  el.errorMessage.style.display = 'flex';
  clearTimeout(el._errTimer);
  el._errTimer = setTimeout(() => { el.errorMessage.style.display = 'none'; }, 8000);
}

function setLoading(loading) {
  el.fetchBtn.classList.toggle('loading', loading);
  el.fetchBtn.disabled = loading;
  el.urlInput.disabled = loading;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

function setProgress(pct, text) {
  el.progressContainer.style.display = 'flex';
  el.progressFill.style.width = Math.min(pct, 100) + '%';
  el.progressText.textContent = text;
  el.progressPercent.textContent = Math.min(pct, 100) + '%';
}

function hideProgress() {
  el.progressContainer.style.display = 'none';
  el.progressFill.style.width = '0%';
}

async function downloadViaProxy(format) {
  const url = `${API_BASE}/download?url=${encodeURIComponent(el.urlInput.value)}&itag=${format.itag}&proxy=true&redirect=false`;

  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': API_KEY },
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showError(d.error || 'Download failed. Try again.');
      return;
    }

    const cd = res.headers.get('Content-Disposition') || '';
    let fn = format.filename || `video.${format.extension || 'mp4'}`;
    const fnMatch = cd.match(/filename="?(.+?)"?$/);
    if (fnMatch) fn = fnMatch[1];

    const len = parseInt(res.headers.get('Content-Length') || format.contentLength || '0');
    const reader = res.body.getReader();
    let received = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (len > 0) {
        setProgress(Math.min(Math.round((received / len) * 100), 99), `Downloading ${format.group || format.quality}...`);
      }
    }

    setProgress(100, 'Download complete!');
    setTimeout(hideProgress, 1200);

    const blob = new Blob(chunks, { type: res.headers.get('Content-Type') || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

  } catch (e) {
    showError('Download error: ' + e.message);
    hideProgress();
  }
}

function renderFormatCard(fmt, section) {
  let icon = fmt.hasVideo ? '🎬' : '🎵';
  let label = fmt.group;
  let sub = '';

  if (!fmt.hasVideo && fmt.hasAudio) {
    icon = '🎵';
    label = fmt.audioQuality?.includes('HIGH') ? 'HD Audio' : 'Audio';
    sub = `${fmt.audioSampleRate || ''}Hz ${fmt.audioChannels ? fmt.audioChannels + 'ch' : ''}`.trim();
  } else if (fmt.hasVideo) {
    const parts = [];
    parts.push((fmt.extension || 'MP4').toUpperCase());
    if (fmt.fps) parts.push(fmt.fps + 'fps');
    if (fmt.hasAudio && fmt.hasVideo) parts.push('with audio');
    else if (fmt.hasVideo && !fmt.hasAudio) parts.push('video only');
    sub = parts.join(' • ');
  }

  return `<button class="format-btn" onclick="window.dl(${fmt.itag})">
    <span class="format-quality">${icon} ${label}</span>
    <span class="format-quality-label">${fmt.quality || fmt.group || 'Unknown'}</span>
    ${sub ? `<span class="format-type">${sub}</span>` : ''}
    ${fmt.size && fmt.size !== 'Unknown' ? `<span class="format-size">${fmt.size}</span>` : ''}
    <span class="format-dl-btn">Download</span>
  </button>`;
}

window.dl = function(itag) {
  const fmt = allFormats.find(f => f.itag === itag);
  if (!fmt) { showError('Format not found.'); return; }
  setProgress(2, 'Starting download...');
  downloadViaProxy(fmt);
};

function renderFormats(data) {
  allFormats = data.formats || [];
  const cats = data.categories || {};

  const mp4Vid = (cats.mp4Video || []).filter(f => f.hasVideo);
  const mp4Aud = (cats.mp4Audio || []).filter(f => f.hasAudio && !f.hasVideo);
  const webm = (cats.webm || []).filter(f => f.hasVideo);
  const otherVid = (cats.other || []).filter(f => f.hasVideo);

  const allVideo = [...mp4Vid, ...webm, ...otherVid]
    .filter((f, i, a) => a.findIndex(x => x.itag === f.itag) === i)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const allAudio = [...mp4Aud]
    .filter((f, i, a) => a.findIndex(x => x.itag === f.itag) === i);

  const remaining = allFormats.filter(f =>
    !allVideo.find(x => x.itag === f.itag) &&
    !allAudio.find(x => x.itag === f.itag)
  );

  if (allVideo.length > 0) {
    el.mp4Section.style.display = 'block';
    el.mp4Grid.innerHTML = allVideo.map(f => renderFormatCard(f, 'mp4-video')).join('');
    el.mp4Count.textContent = allVideo.length;
  } else { el.mp4Section.style.display = 'none'; }

  if (allAudio.length > 0) {
    el.mp3Section.style.display = 'block';
    el.mp3Grid.innerHTML = allAudio.map(f => renderFormatCard(f, 'mp4-audio')).join('');
    el.mp3Count.textContent = allAudio.length;
  } else { el.mp3Section.style.display = 'none'; }

  if (remaining.length > 0) {
    el.otherSection.style.display = 'block';
    el.otherGrid.innerHTML = remaining.map(f => renderFormatCard(f, 'other')).join('');
    el.otherCount.textContent = remaining.length;
  } else { el.otherSection.style.display = 'none'; }
}

function displayResults(data) {
  el.videoThumbnail.src = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
  el.videoThumbnail.onerror = function() { this.src = `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`; };
  el.durationBadge.textContent = data.durationFormatted || '0:00';
  el.videoTitle.textContent = data.title || 'Unknown Title';
  el.videoAuthor.querySelector('span').textContent = data.author || 'Unknown';
  el.videoDuration.querySelector('span').textContent = data.durationFormatted || '0:00';
  el.videoViews.querySelector('span').textContent = data.viewCount ? `${formatNumber(data.viewCount)} views` : '';

  renderFormats(data);
  el.results.style.display = 'block';
  setTimeout(() => el.results.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

async function fetchVideo() {
  const raw = el.urlInput.value.trim().replace(/^@/, '');
  if (!raw) { showError('Please enter a YouTube URL.'); return; }
  if (!extractVideoId(raw)) { showError('Invalid YouTube URL.'); return; }

  setLoading(true);
  hideProgress();
  el.errorMessage.style.display = 'none';
  el.results.style.display = 'none';

  const steps = [
    [8, 'Connecting to YouTube...'],
    [20, 'Fetching video data...'],
    [40, 'Extracting formats...'],
    [60, 'Analyzing quality...'],
    [80, 'Preparing options...'],
    [95, 'Almost ready...'],
  ];
  let si = 0;
  const pi = setInterval(() => {
    if (si < steps.length) setProgress(steps[si][0], steps[si][1]);
    si++;
  }, 700);

  try {
    const res = await fetch(`${API_BASE}/info?url=${encodeURIComponent(raw)}`, {
      headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' },
    });
    const data = await res.json();
    clearInterval(pi);

    if (!data.success) {
      setProgress(100, 'Failed');
      setTimeout(() => { hideProgress(); showError(data.error || 'Failed.'); }, 500);
      setLoading(false);
      return;
    }

    setProgress(100, 'Ready!');
    setTimeout(() => { hideProgress(); displayResults(data); }, 300);
  } catch (err) {
    clearInterval(pi);
    hideProgress();
    showError('Network error. Check your connection and try again.');
  }
  setLoading(false);
}

el.fetchBtn.addEventListener('click', fetchVideo);
el.urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchVideo(); });

el.pasteBtn.addEventListener('click', async () => {
  try {
    el.urlInput.value = await navigator.clipboard.readText();
    el.urlInput.focus();
  } catch { showError('Cannot read clipboard. Paste manually.'); }
});

el.urlInput.addEventListener('input', () => {
  if (el.results.style.display === 'block') el.results.style.display = 'none';
});

const qp = new URLSearchParams(window.location.search);
const urlParam = qp.get('url');
if (urlParam) {
  el.urlInput.value = urlParam;
  setTimeout(fetchVideo, 300);
}
