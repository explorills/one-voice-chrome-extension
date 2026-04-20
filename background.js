const NOTIF_ID = 'one-voice-chatgpt-status';
const CHATGPT_URL_PATTERNS = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];

async function findChatGPTTab() {
  const tabs = await chrome.tabs.query({ url: CHATGPT_URL_PATTERNS });
  if (!tabs.length) return null;
  tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return tabs[0];
}

async function notify(title, message, isError = false) {
  try {
    await chrome.notifications.create(NOTIF_ID, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title,
      message,
      priority: isError ? 2 : 0,
      silent: true,
      requireInteraction: false
    });
  } catch (e) {}
}

async function updateNotif(title, message, isError = false) {
  try {
    const updated = await chrome.notifications.update(NOTIF_ID, {
      title,
      message,
      priority: isError ? 2 : 0
    });
    if (!updated) await notify(title, message, isError);
  } catch (e) {
    await notify(title, message, isError);
  }
}

async function clearNotif() {
  try { await chrome.notifications.clear(NOTIF_ID); } catch (e) {}
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (e) {}
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-recording') return;
  const tab = await findChatGPTTab();
  if (!tab) {
    await notify('ONE voice', 'Open chatgpt.com in a tab first.', true);
    return;
  }
  await ensureContentScript(tab.id);
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
  } catch (e) {
    await notify('ONE voice', 'ChatGPT tab not responding. Reload it.', true);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return;
  switch (msg.type) {
    case 'status':
      updateNotif(msg.title || 'ONE voice', msg.message || '', !!msg.error);
      break;
    case 'done':
      updateNotif(msg.title || 'ONE voice', msg.message || 'Copied to clipboard');
      setTimeout(clearNotif, 1800);
      break;
    case 'error':
      updateNotif('ONE voice — error', msg.message || 'Unknown error', true);
      setTimeout(clearNotif, 4000);
      break;
    case 'clear':
      clearNotif();
      break;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get({
    maxDuration: 600,
    autoSend: true
  });
  await chrome.storage.sync.set(existing);
});
