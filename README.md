# ONE voice (ChatGPT)

Global-hotkey voice-to-text via the ChatGPT browser dictation. Press **Pause/Break**, speak, press again — transcription lands in your clipboard (and optionally auto-sends to your current ChatGPT conversation so a custom grammar-check GPT can process it).

Companion to [`explorills/one-voice`](https://github.com/explorills/one-voice) (the VS Code / Whisper-API edition). Same ergonomics, different engine — this one drives the real ChatGPT dictation in your logged-in browser session, which is why it nails 99%+ accuracy with zero API keys to manage.

## How it works

1. You keep **chatgpt.com** open in a tab (preferably as a PWA window — see below).
2. From anywhere on your machine, press **Pause/Break**.
3. The extension silently clicks ChatGPT's mic button — recording starts. A ChromeOS notification shows `Recording 0:03 / 10:00`.
4. Press **Pause/Break** again to stop. Notification flips to `Converting…`.
5. When the Whisper transcription appears in the composer, the extension:
   - copies it to your clipboard,
   - (optionally) clicks ChatGPT's Send button so the message is submitted to whatever conversation / custom GPT you have open,
   - shows `Copied ✓` and fades the notification.

No DOM scraping beyond the mic button and composer. No API keys. No background CPU — the service worker sleeps until you press the key.

## Install (unpacked)

1. Clone this repo anywhere:
   ```bash
   git clone https://github.com/explorills/one-voice-chrome-extension.git
   ```
2. Open `chrome://extensions/`, enable **Developer mode** (top right).
3. Click **Load unpacked**, select the cloned folder.
4. Open `chrome://extensions/shortcuts`, find **ONE voice (ChatGPT) → toggle ChatGPT recording**.
5. Click the pencil, press **Pause/Break**, set the scope dropdown to **Global**.

## First-run checklist

- Open `https://chatgpt.com` once, click the mic button by hand, allow microphone access when Chrome prompts. This is a one-time permission grant per origin — the extension never asks for mic access itself.
- Recommended: install ChatGPT as a standalone app window:
  - On `chatgpt.com`, click the ⋮ menu → **Install ChatGPT…** (or **Create shortcut… → Open as window**).
  - Size/position the window however you like (ChromeOS remembers it). Minimize when done.
- The extension finds the ChatGPT tab/window whether it's focused, backgrounded, or minimized.

## Settings

Click the extension icon or open `chrome://extensions/` → **Details → Extension options**:

- **Max recording duration** (default 600s / 10 min) — recording auto-stops at this limit.
- **Auto-send to ChatGPT after copy** (default on) — submits the transcribed message to the current ChatGPT conversation so your custom grammar-check GPT can process it. Turn off for clipboard-only behaviour.

## ChromeOS notes

- The hotkey is registered as **Global** — it fires from any window, including Crostini Linux windows (VS Code, terminal, etc.), because Pause/Break isn't consumed by those apps.
- If a particular Linux window ever swallows the key, bind a different key at `chrome://extensions/shortcuts`, or install `sxhkd` in Crostini as a bridge (not required for the default Pause/Break setup).
- Feedback uses `chrome.notifications` (ChromeOS native notification center), which is visible regardless of which window has focus.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Mic button not found` | You aren't on a ChatGPT conversation page, or the UI changed | Navigate to an active chat; if persistent, file an issue — selectors may need updating |
| `No transcription received` | Whisper took >20s or network is slow | Try again; increase deadline in `content.js` if chronic |
| `Clipboard write blocked` | Chrome requires tab focus for clipboard writes on some versions | Click the ChatGPT tab once, then retry |
| Hotkey does nothing | Scope not set to Global, or key already bound elsewhere | Re-bind at `chrome://extensions/shortcuts` with Global scope |

## Sibling project

[`explorills/one-voice`](https://github.com/explorills/one-voice) — original VS Code extension using the OpenAI Whisper API directly with optional GPT grammar cleanup. Same Pause/Break ergonomics; different engine and output targets.

---

Part of the [ONE Ecosystem](https://expl.one).
