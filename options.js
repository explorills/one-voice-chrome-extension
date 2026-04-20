const $ = (id) => document.getElementById(id);
const MEDIA_ORIGINS = ['*://*.youtube.com/*', '*://*.spotify.com/*'];

async function refreshPauseMediaStatus() {
  const hasPerm = await chrome.permissions.contains({ origins: MEDIA_ORIGINS });
  const el = $('pauseMediaStatus');
  if ($('pauseMedia').checked && !hasPerm) {
    el.textContent = 'Permission not granted — feature inactive. Re-check the box to request it.';
    el.style.color = '#cf222e';
  } else if ($('pauseMedia').checked && hasPerm) {
    el.textContent = 'Active: extension can pause YouTube + Spotify tabs during recording.';
    el.style.color = '#1f883d';
  } else {
    el.textContent = '';
  }
}

async function load() {
  const cfg = await chrome.storage.sync.get({
    maxDuration: 600,
    autoSend: true,
    pauseMedia: false
  });
  $('maxDuration').value = cfg.maxDuration;
  $('autoSend').checked = cfg.autoSend !== false;
  $('pauseMedia').checked = !!cfg.pauseMedia;
  refreshPauseMediaStatus();
}

async function save() {
  const maxDuration = Math.max(10, Math.min(3600, parseInt($('maxDuration').value, 10) || 600));
  const autoSend = $('autoSend').checked;
  let pauseMedia = $('pauseMedia').checked;

  if (pauseMedia) {
    const hasPerm = await chrome.permissions.contains({ origins: MEDIA_ORIGINS });
    if (!hasPerm) {
      const granted = await chrome.permissions.request({ origins: MEDIA_ORIGINS });
      if (!granted) {
        pauseMedia = false;
        $('pauseMedia').checked = false;
      }
    }
  } else {
    try { await chrome.permissions.remove({ origins: MEDIA_ORIGINS }); } catch (e) {}
  }

  await chrome.storage.sync.set({ maxDuration, autoSend, pauseMedia });
  $('maxDuration').value = maxDuration;
  $('status').textContent = 'Saved';
  setTimeout(() => { $('status').textContent = ''; }, 1500);
  refreshPauseMediaStatus();
}

$('save').addEventListener('click', save);
$('pauseMedia').addEventListener('change', refreshPauseMediaStatus);
$('shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

load();
