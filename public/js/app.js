const API_BASE = '/api';

const elements = {
  urlInput: document.getElementById('urlInput'),
  fetchBtn: document.getElementById('fetchBtn'),
  pasteBtn: document.getElementById('pasteBtn'),
  errorMessage: document.getElementById('errorMessage'),
  errorText: document.getElementById('errorText'),
  results: document.getElementById('results'),
  videoCard: document.getElementById('videoCard'),
  videoThumbnail: document.getElementById('videoThumbnail'),
  durationBadge: document.getElementById('durationBadge'),
  videoTitle: document.getElementById('videoTitle'),
  videoAuthor: document.getElementById('videoAuthor'),
  videoDuration: document.getElementById('videoDuration'),
  videoViews: document.getElementById('videoViews'),
  formatsGrid: document.getElementById('formatsGrid'),
  searchBox: document.getElementById('searchBox'),
};

function sanitizeUrl(url) {
  return url.trim().replace(/^@/, '');
}

function extractVideoId(url) {
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

function showError(msg) {
  elements.errorText.textContent = msg;
  elements.errorMessage.style.display = 'flex';
  setTimeout(() => { elements.errorMessage.style.display = 'none'; }, 6000);
}

function setLoading(loading) {
  elements.fetchBtn.classList.toggle('loading', loading);
  elements.fetchBtn.disabled = loading;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function renderFormats(formats) {
  if (!formats || formats.length === 0) {
    elements.formatsGrid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:24px">No downloadable formats found.</p>';
    return;
  }

  const sorted = [...formats].sort((a, b) => {
    const order = { 'video+audio': 0, 'video': 1, 'audio': 2, 'unknown': 3 };
    const aOrder = order[a.type] || 99;
    const bOrder = order[b.type] || 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.height || 0) - (a.height || 0);
  });

  const uniqueItags = new Set();
  const deduped = sorted.filter(f => {
    if (uniqueItags.has(f.itag)) return false;
    uniqueItags.add(f.itag);
    return true;
  });

  elements.formatsGrid.innerHTML = deduped.map(f => {
    let icon = '🎬';
    if (f.type === 'audio') icon = '🎵';
    else if (f.container === 'webm') icon = '🎞️';

    let qualityLabel = f.group;
    if (f.type === 'audio') {
      qualityLabel = f.audioQuality?.includes('HIGH') ? 'Audio HD' : 'Audio';
    }

    let badge = '';
    if (f.hasVideo && f.hasAudio && f.height >= 720) {
      badge = '<span class="format-badge">Recommended</span>';
    } else if (!f.hasVideo && f.hasAudio) {
      badge = '<span class="format-badge">Audio Only</span>';
    }

    const container = f.container || 'mp4';
    const ext = f.type === 'audio' ? (container === 'webm' ? 'opus' : 'm4a') : container;
    const size = f.size && f.size !== 'Unknown' ? f.size : '';

    return `<a href="${API_BASE}/download?url=${encodeURIComponent(elements.urlInput.value)}&itag=${f.itag}&redirect=true"
              class="format-btn" target="_blank" rel="noopener"
              onclick="handleDownload(event, '${f.itag}')">
      <span class="format-quality">${icon} ${qualityLabel}</span>
      <span class="format-type">${ext.toUpperCase()} ${f.hasVideo && f.fps ? f.fps + 'fps' : ''}</span>
      ${size ? `<span class="format-size">${size}</span>` : ''}
      ${badge}
    </a>`;
  }).join('');
}

window.handleDownload = function(e, itag) {
  e.preventDefault();
  const url = `${API_BASE}/download?url=${encodeURIComponent(elements.urlInput.value)}&itag=${itag}&redirect=true`;
  window.open(url, '_blank');
};

async function fetchVideo() {
  const rawUrl = elements.urlInput.value;
  const url = sanitizeUrl(rawUrl);

  if (!url) {
    showError('Please enter a YouTube URL.');
    return;
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    showError('Invalid YouTube URL. Please check and try again.');
    return;
  }

  setLoading(true);
  elements.errorMessage.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (!data.success) {
      showError(data.error || 'Failed to fetch video info.');
      setLoading(false);
      return;
    }

    displayResults(data);
  } catch (err) {
    showError('Network error. Please check your connection and try again.');
  } finally {
    setLoading(false);
  }
}

function displayResults(data) {
  elements.videoThumbnail.src = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
  elements.videoThumbnail.onerror = function() {
    this.src = `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`;
  };
  elements.durationBadge.textContent = data.durationFormatted || '0:00';
  elements.videoTitle.textContent = data.title || 'Unknown Title';

  const authorSpan = elements.videoAuthor.querySelector('span');
  authorSpan.textContent = data.author || 'Unknown';

  const durationSpan = elements.videoDuration.querySelector('span');
  durationSpan.textContent = data.durationFormatted || '0:00';

  const viewsSpan = elements.videoViews.querySelector('span');
  viewsSpan.textContent = data.viewCount ? `${formatNumber(data.viewCount)} views` : '';

  renderFormats(data.formats || []);
  elements.results.style.display = 'block';
  elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

elements.fetchBtn.addEventListener('click', fetchVideo);

elements.urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchVideo();
});

elements.pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    elements.urlInput.value = text;
    elements.urlInput.focus();
  } catch {
    showError('Unable to read clipboard. Paste manually.');
  }
});

elements.urlInput.addEventListener('input', () => {
  if (elements.results.style.display === 'block') {
    elements.results.style.display = 'none';
  }
});

const urlParams = new URLSearchParams(window.location.search);
const urlParam = urlParams.get('url');
if (urlParam) {
  elements.urlInput.value = urlParam;
  fetchVideo();
}
