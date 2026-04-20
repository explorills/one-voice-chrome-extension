(() => {
  if (window.__oneVoiceChatGPTLoaded) return;
  window.__oneVoiceChatGPTLoaded = true;

  const STATE = {
    recording: false,
    startTime: 0,
    timerInterval: null,
    maxDurationSec: 600,
    autoSend: true,
    preText: ''
  };

  const MIC_SELECTORS = [
    'button[data-testid="composer-speech-button"]',
    'button[aria-label*="ictate" i]',
    'button[aria-label*="oice mode" i]',
    'button[aria-label*="tart voice" i]',
    'button[aria-label*="top voice" i]',
    'button[aria-label*="oice" i]'
  ];

  const COMPOSER_SELECTORS = [
    '#prompt-textarea',
    'div[contenteditable="true"][data-id="root"]',
    'form textarea',
    'div[contenteditable="true"]'
  ];

  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[aria-label*="end message" i]',
    'button[aria-label*="end prompt" i]',
    'form button[type="submit"]'
  ];

  function first(selectors, root = document) {
    for (const s of selectors) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function findMic() { return first(MIC_SELECTORS); }
  function findComposer() { return first(COMPOSER_SELECTORS); }
  function findSend() { return first(SEND_SELECTORS); }

  function composerText() {
    const el = findComposer();
    if (!el) return '';
    if ('value' in el && typeof el.value === 'string') return el.value;
    return el.innerText || el.textContent || '';
  }

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }

  function send(type, payload = {}) {
    try { chrome.runtime.sendMessage({ type, ...payload }); } catch (e) {}
  }

  async function loadConfig() {
    try {
      const cfg = await chrome.storage.sync.get({ maxDuration: 600, autoSend: true });
      STATE.maxDurationSec = Math.max(10, Math.min(3600, Number(cfg.maxDuration) || 600));
      STATE.autoSend = cfg.autoSend !== false;
    } catch (e) {}
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function startRecording() {
    await loadConfig();
    const mic = findMic();
    if (!mic) {
      send('error', { message: 'Mic button not found on ChatGPT page.' });
      return;
    }
    STATE.preText = composerText();
    mic.click();
    STATE.recording = true;
    STATE.startTime = Date.now();

    send('status', {
      title: 'ONE voice — recording',
      message: `0:00 / ${fmt(STATE.maxDurationSec)}`
    });

    STATE.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - STATE.startTime) / 1000);
      if (elapsed >= STATE.maxDurationSec) {
        stopRecording();
        return;
      }
      send('status', {
        title: 'ONE voice — recording',
        message: `${fmt(elapsed)} / ${fmt(STATE.maxDurationSec)}`
      });
    }, 1000);
  }

  async function stopRecording() {
    if (!STATE.recording) return;
    STATE.recording = false;
    if (STATE.timerInterval) {
      clearInterval(STATE.timerInterval);
      STATE.timerInterval = null;
    }
    const mic = findMic();
    if (!mic) {
      send('error', { message: 'Mic button disappeared before stop.' });
      return;
    }
    mic.click();

    send('status', { title: 'ONE voice', message: 'Converting…' });

    const deadline = Date.now() + 20000;
    let captured = '';
    let lastLen = -1;
    let stableCycles = 0;

    while (Date.now() < deadline) {
      await sleep(300);
      const now = composerText();
      if (now && now !== STATE.preText && now.length > STATE.preText.length) {
        const candidate = now.startsWith(STATE.preText)
          ? now.slice(STATE.preText.length).trim()
          : now.trim();
        if (candidate.length === lastLen) {
          stableCycles++;
          if (stableCycles >= 2) {
            captured = candidate;
            break;
          }
        } else {
          stableCycles = 0;
          lastLen = candidate.length;
          captured = candidate;
        }
      }
    }

    if (!captured) {
      send('error', { message: 'No transcription received in 20s.' });
      return;
    }

    try {
      await navigator.clipboard.writeText(captured);
    } catch (e) {
      send('error', { message: 'Clipboard write blocked. Focus ChatGPT tab once, then retry.' });
      return;
    }

    if (STATE.autoSend) {
      await sleep(250);
      const sendBtn = findSend();
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
        send('done', { title: 'ONE voice', message: 'Copied + sent to ChatGPT ✓' });
      } else {
        send('done', { title: 'ONE voice', message: 'Copied ✓ (send button not ready)' });
      }
    } else {
      send('done', { title: 'ONE voice', message: 'Copied to clipboard ✓' });
    }
  }

  async function toggle() {
    if (STATE.recording) await stopRecording();
    else await startRecording();
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'toggle') {
      toggle();
      sendResponse({ ok: true });
    }
    return true;
  });

  loadConfig();
})();
