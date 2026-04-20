const CHATGPT_URL_PATTERNS = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];
const MEDIA_URL_PATTERNS = ['*://*.youtube.com/*', '*://*.spotify.com/*'];
const PAUSED_IDS_KEY = 'pausedTabIds';
const SAFETY_RESUME_MS = 15 * 60 * 1000;

async function findChatGPTTab() {
  const tabs = await chrome.tabs.query({ url: CHATGPT_URL_PATTERNS });
  if (!tabs.length) return null;
  tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return tabs[0];
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (e) {}
}

async function focusChatGPT(tab) {
  try {
    await chrome.windows.update(tab.windowId, { focused: true, state: 'normal' });
    await chrome.tabs.update(tab.id, { active: true });
  } catch (e) {}
}

async function minimizeWindow(windowId) {
  try {
    await chrome.windows.update(windowId, { state: 'minimized' });
  } catch (e) {}
}

function pauseMediaInPage() {
  const was = [];
  for (const el of document.querySelectorAll('video, audio')) {
    if (!el.paused) {
      was.push(el);
      try { el.pause(); } catch (e) {}
    }
  }
  window.__oneVoicePausedMedia = was;
  return was.length;
}

function resumeMediaInPage() {
  const list = window.__oneVoicePausedMedia || [];
  let count = 0;
  for (const el of list) {
    try { el.play(); count++; } catch (e) {}
  }
  window.__oneVoicePausedMedia = [];
  return count;
}

async function getPausedIds() {
  const data = await chrome.storage.session.get({ [PAUSED_IDS_KEY]: [] });
  return data[PAUSED_IDS_KEY] || [];
}

async function setPausedIds(ids) {
  await chrome.storage.session.set({ [PAUSED_IDS_KEY]: ids });
}

async function pauseMediaTabs() {
  const { pauseMedia } = await chrome.storage.sync.get({ pauseMedia: false });
  if (!pauseMedia) return;
  const hasPerm = await chrome.permissions.contains({ origins: MEDIA_URL_PATTERNS });
  if (!hasPerm) {
    console.warn('[ONE voice] pauseMedia enabled but host permission missing — skipping');
    return;
  }
  const tabs = await chrome.tabs.query({ url: MEDIA_URL_PATTERNS, audible: true });
  const paused = [];
  for (const t of tabs) {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId: t.id },
        func: pauseMediaInPage
      });
      if (res && res[0] && res[0].result > 0) {
        paused.push(t.id);
      }
    } catch (e) {}
  }
  await setPausedIds(paused);
  if (paused.length) {
    console.log('[ONE voice] paused media in', paused.length, 'tab(s)');
    chrome.alarms.create('one-voice-safety-resume', { when: Date.now() + SAFETY_RESUME_MS });
  }
}

async function resumeMediaTabs() {
  const ids = await getPausedIds();
  if (!ids.length) return;
  await setPausedIds([]);
  chrome.alarms.clear('one-voice-safety-resume');
  let resumed = 0;
  for (const tabId of ids) {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: resumeMediaInPage
      });
      if (res && res[0]) resumed += res[0].result || 0;
    } catch (e) {}
  }
  if (resumed) console.log('[ONE voice] resumed media in', ids.length, 'tab(s)');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'one-voice-safety-resume') {
    console.warn('[ONE voice] safety resume fired — done event never arrived');
    resumeMediaTabs();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-recording') return;
  const tab = await findChatGPTTab();
  if (!tab) {
    console.warn('[ONE voice] no ChatGPT tab open');
    return;
  }
  await focusChatGPT(tab);
  await ensureContentScript(tab.id);

  const currentlyPaused = await getPausedIds();
  if (currentlyPaused.length === 0) {
    await pauseMediaTabs();
  } else {
    await resumeMediaTabs();
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
  } catch (e) {
    console.warn('[ONE voice] content script not responding:', e);
    await resumeMediaTabs();
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'done' && sender.tab) {
    resumeMediaTabs();
    minimizeWindow(sender.tab.windowId);
  }
});

chrome.permissions.onRemoved.addListener(async (perms) => {
  const lostMedia = (perms.origins || []).some(o => MEDIA_URL_PATTERNS.includes(o));
  if (lostMedia) {
    await chrome.storage.sync.set({ pauseMedia: false });
    console.log('[ONE voice] media host permission revoked — pauseMedia disabled');
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get({
    maxDuration: 600,
    autoSend: true,
    pauseMedia: false
  });
  await chrome.storage.sync.set(existing);
});
