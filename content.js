(() => {
  if (window.__oneVoiceChatGPTLoaded) return;
  window.__oneVoiceChatGPTLoaded = true;

  const STATE = {
    recording: false,
    startTime: 0,
    maxTimeoutId: null,
    maxDurationSec: 600,
    autoSend: true,
    preText: ''
  };

  const MIC_POSITIVE = [
    'dictate', 'dictation', 'transcrib',
    'start voice message', 'stop voice message',
    'start recording', 'stop recording'
  ];
  const MIC_NEGATIVE = [
    'voice mode', 'voice chat', 'voice conversation',
    'end voice', 'advanced voice', 'live voice',
    'speech mode', 'headphones'
  ];

  const CONFIRM_POSITIVE = [
    'send voice', 'submit voice',
    'confirm voice', 'confirm recording',
    'finish recording', 'done recording', 'send recording',
    'submit', 'confirm', 'done', 'finish'
  ];
  const CONFIRM_NEGATIVE = [
    'cancel', 'discard', 'delete', 'close',
    'stop recording', 'abort', 'trash', 'remove'
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

  function first(selectors) {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function findComposer() { return first(COMPOSER_SELECTORS); }
  function findSend() { return first(SEND_SELECTORS); }

  function buttonIdentifiers(btn) {
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    const testid = (btn.getAttribute('data-testid') || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();
    const text = (btn.innerText || btn.textContent || '').toLowerCase();
    return `${label} | ${testid} | ${title} | ${text}`;
  }

  function composerScope() {
    const composer = findComposer();
    if (!composer) return document;
    return composer.closest('form') || composer.parentElement?.closest('div') || document;
  }

  function rankButton(positives, negatives) {
    const buttons = Array.from(composerScope().querySelectorAll('button'));
    const ranked = [];
    for (const btn of buttons) {
      const ident = buttonIdentifiers(btn);
      if (!ident.trim()) continue;
      if (negatives.some(n => ident.includes(n))) continue;
      let score = 0;
      for (const p of positives) if (ident.includes(p)) score += 10;
      ranked.push({ btn, score, ident });
    }
    return { ranked, buttons };
  }

  function findMic() {
    const { ranked, buttons } = rankButton(MIC_POSITIVE, MIC_NEGATIVE);
    for (const r of ranked) {
      if (/\bmic\b|microphone|\brecord\b/.test(r.ident)) r.score += 5;
    }
    const withScore = ranked.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    if (withScore.length) {
      console.log('[ONE voice] mic →', withScore[0].ident);
      return withScore[0].btn;
    }
    console.warn('[ONE voice] mic not matched. Buttons:',
      buttons.map(b => buttonIdentifiers(b)).filter(x => x.trim()));
    return null;
  }

  function findConfirm() {
    const { ranked, buttons } = rankButton(CONFIRM_POSITIVE, CONFIRM_NEGATIVE);
    for (const r of ranked) {
      if (/check|tick/.test(r.ident)) r.score += 5;
      const svgs = r.btn.querySelectorAll('svg');
      for (const svg of svgs) {
        const n = (svg.getAttribute('aria-label') || svg.getAttribute('data-icon') || '').toLowerCase();
        if (n.includes('check') || n.includes('tick')) r.score += 3;
      }
    }
    const withScore = ranked.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    if (withScore.length) {
      console.log('[ONE voice] confirm →', withScore[0].ident);
      return withScore[0].btn;
    }
    console.warn('[ONE voice] confirm not matched. Buttons:',
      buttons.map(b => buttonIdentifiers(b)).filter(x => x.trim()));
    return null;
  }

  function composerText() {
    const el = findComposer();
    if (!el) return '';
    if ('value' in el && typeof el.value === 'string') return el.value;
    return el.innerText || el.textContent || '';
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function send(type, payload = {}) {
    try { chrome.runtime.sendMessage({ type, ...payload }); } catch (e) {}
  }

  async function realisticClick(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) {}
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const base = {
      bubbles: true, cancelable: true, composed: true,
      view: window, clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true
    };
    try { el.focus({ preventScroll: true }); } catch (e) {}
    el.dispatchEvent(new PointerEvent('pointerover', { ...base, buttons: 0 }));
    el.dispatchEvent(new PointerEvent('pointerenter', { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('mouseover', { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('mousemove', { ...base, buttons: 0 }));
    await sleep(20 + Math.random() * 30);
    el.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
    el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    await sleep(30 + Math.random() * 40);
    el.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0, detail: 1 }));
  }

  async function loadConfig() {
    try {
      const cfg = await chrome.storage.sync.get({ maxDuration: 600, autoSend: true });
      STATE.maxDurationSec = Math.max(10, Math.min(3600, Number(cfg.maxDuration) || 600));
      STATE.autoSend = cfg.autoSend !== false;
    } catch (e) {}
  }

  async function startRecording() {
    await loadConfig();
    const mic = findMic();
    if (!mic) {
      console.warn('[ONE voice] start aborted: no mic button');
      send('done');
      return;
    }
    STATE.preText = composerText();
    await realisticClick(mic);
    STATE.recording = true;
    STATE.startTime = Date.now();

    STATE.maxTimeoutId = setTimeout(() => {
      console.log('[ONE voice] max duration reached, auto-stopping');
      stopRecording();
    }, STATE.maxDurationSec * 1000);
  }

  async function stopRecording() {
    if (!STATE.recording) return;
    STATE.recording = false;
    if (STATE.maxTimeoutId) {
      clearTimeout(STATE.maxTimeoutId);
      STATE.maxTimeoutId = null;
    }

    const confirm = findConfirm();
    if (!confirm) {
      console.warn('[ONE voice] recording was cancelled by ChatGPT (no confirm button). Aborting cleanly — no phantom click.');
      send('done');
      return;
    }
    await realisticClick(confirm);

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
          if (stableCycles >= 2) { captured = candidate; break; }
        } else {
          stableCycles = 0;
          lastLen = candidate.length;
          captured = candidate;
        }
      }
    }

    if (!captured) {
      console.warn('[ONE voice] no transcription captured in 20s');
      send('done');
      return;
    }

    try {
      await navigator.clipboard.writeText(captured);
      console.log('[ONE voice] copied to clipboard:', captured.length, 'chars');
    } catch (e) {
      console.warn('[ONE voice] clipboard write failed:', e);
    }

    if (STATE.autoSend) {
      await sleep(250);
      const sendBtn = findSend();
      if (sendBtn && !sendBtn.disabled) {
        await realisticClick(sendBtn);
        console.log('[ONE voice] sent to ChatGPT');
        await sleep(350);
      } else {
        console.warn('[ONE voice] send button not ready; skipping auto-send');
      }
    }

    send('done');
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
