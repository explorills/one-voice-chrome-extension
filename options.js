const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.sync.get({ maxDuration: 600, autoSend: true });
  $('maxDuration').value = cfg.maxDuration;
  $('autoSend').checked = cfg.autoSend !== false;
}

async function save() {
  const maxDuration = Math.max(10, Math.min(3600, parseInt($('maxDuration').value, 10) || 600));
  const autoSend = $('autoSend').checked;
  await chrome.storage.sync.set({ maxDuration, autoSend });
  $('maxDuration').value = maxDuration;
  $('status').textContent = 'Saved';
  setTimeout(() => { $('status').textContent = ''; }, 1500);
}

$('save').addEventListener('click', save);
$('shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

load();
