const CHATGPT_URL_PATTERNS = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];

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

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-recording') return;
  const tab = await findChatGPTTab();
  if (!tab) {
    console.warn('[ONE voice] no ChatGPT tab open');
    return;
  }
  await focusChatGPT(tab);
  await ensureContentScript(tab.id);
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
  } catch (e) {
    console.warn('[ONE voice] content script not responding:', e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'done' && sender.tab) {
    minimizeWindow(sender.tab.windowId);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get({
    maxDuration: 600,
    autoSend: true
  });
  await chrome.storage.sync.set(existing);
});
