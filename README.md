# ONE voice (ChatGPT)

Global-hotkey voice-to-text via the ChatGPT browser dictation. Press your hotkey, speak, press again — transcription lands in your clipboard, and (optionally) auto-submits to the ChatGPT conversation you have open so a custom GPT can post-process it.

Companion to [`explorills/one-voice`](https://github.com/explorills/one-voice) (the VS Code / Whisper-API edition). Same ergonomics, different engine — this one drives the real ChatGPT dictation in your logged-in browser session, which is why it nails 99%+ accuracy with zero API keys to manage and no OpenAI bill.

## How it works

1. You keep **chatgpt.com** open in a tab (preferably as a PWA window — see below). Minimize it.
2. From anywhere on your machine, press your hotkey (set at `chrome://extensions/shortcuts`).
3. The ChatGPT window un-minimizes and focuses. The extension clicks the mic button — recording starts. You see the waveform UI.
4. Press the hotkey again to stop. The extension clicks the confirm (✓) button, waits for Whisper to transcribe, then:
   - copies the transcription to your clipboard,
   - (optionally) clicks Send so the message is submitted to whatever conversation / custom GPT you have open,
   - minimizes the ChatGPT window.
5. Paste anywhere with Ctrl+V.

Feedback is purely native — the window popping forward and receding is the UX. No toasts, no popovers, no background CPU. The service worker sleeps until the next hotkey press.

## Recommended pairing: a custom GPT for grammar + fluent alternative

The intended workflow is to leave ChatGPT open on a conversation with a custom GPT that post-processes each dictation. A public one the author uses and recommends:

**[Grammar Check + Fluent Alternative](https://chatgpt.com/g/g-aizdZTwve-grammar-check-fluent-alternative)**

What you get when **auto-send is on**:

- Raw Whisper transcription → your clipboard (paste anywhere as-is)
- Same transcription → submitted to the custom GPT, which returns a grammar-checked + fluent alternative version you can copy from the chat
- A running history of every dictation you've made, kept in the ChatGPT conversation itself — useful for review, re-reading, or re-copying older transcripts

If you don't want the running history or the auto-submitted message, **uncheck "Auto-send to ChatGPT after copy"** in the extension options. With auto-send off, the extension only copies the raw transcription to clipboard — nothing is submitted, nothing is logged in any conversation.

Either mode, the clipboard always gets the raw transcription the instant it lands in the composer.

## Install (unpacked)

1. Clone this repo anywhere:
   ```bash
   git clone https://github.com/explorills/one-voice-chrome-extension.git
   ```
2. Open `chrome://extensions/`, enable **Developer mode** (top right).
3. Click **Load unpacked**, select the cloned folder.
4. Open `chrome://extensions/shortcuts`, find **ONE voice (ChatGPT) → toggle ChatGPT recording**.
5. Click the pencil icon, press the key combo you want, set the scope dropdown to **Global**.

### Hotkey options

Chrome's shortcut UI accepts most modifier combinations but **rejects a few specific keys** (notably `Pause/Break` on ChromeOS). Combos that reliably work:

- `Ctrl+K` *(simple; may conflict with ChatGPT's own search shortcut if you're focused on that tab)*
- `Ctrl+Shift+Space`
- `Alt+Shift+V`
- `Ctrl+Shift+;`
- Any `Ctrl+F1..F12` / `Alt+F1..F12`

Set the scope dropdown to **Global** so it fires regardless of which window has focus.

## First-run checklist

- Open `https://chatgpt.com` once, click the mic button by hand, allow microphone access when Chrome prompts. This is a one-time permission grant per origin — the extension never asks for mic access itself.
- Open your preferred conversation (e.g. the [Grammar Check + Fluent Alternative](https://chatgpt.com/g/g-aizdZTwve-grammar-check-fluent-alternative) GPT linked above) so the hotkey always dictates into that context.
- Recommended: install ChatGPT as a standalone app window:
  - On `chatgpt.com`, click the ⋮ (three-dot) menu in the address bar → **Install ChatGPT…** (or **Create shortcut… → Open as window**).
  - Size/position the window however you like (Chrome remembers it per-PWA). Minimize when done.
- The extension finds the ChatGPT tab/window whether it's focused, backgrounded, or minimized.

### Choosing which microphone is used

The extension has no say in microphone selection — it just clicks ChatGPT's mic button, which uses whatever Chrome considers the default audio input. To verify or change:

- **ChromeOS:** Settings → Device → Audio → Input → pick the mic you want
- **Chrome (all platforms):** `chrome://settings/content/microphone` → top dropdown
- If ChatGPT ever asks mid-session, it'll reuse your last granted choice

## Settings

Open the extension's options page (extension icon → Options, or `chrome://extensions/` → **Details → Extension options**):

- **Max recording duration** *(default 600s / 10 min, range 10–3600)* — recording auto-stops at this limit.
- **Auto-send to ChatGPT after copy** *(default on)* — submits the transcribed message to the current ChatGPT conversation so your custom GPT can process it and your dictation history accumulates in the chat. Turn off for clipboard-only behaviour.

## ChromeOS + Crostini notes

- The hotkey is registered as **Global** — it fires from any window including Crostini Linux windows (VS Code, terminal, etc.), as long as the chosen key isn't consumed by the focused app.
- If a particular Linux window ever swallows the key, bind a different combo at `chrome://extensions/shortcuts`.
- All feedback is native window behaviour (focus + minimize) — no OS-level notifications, no popovers. The window popping into view is your "recording started" cue; it disappearing means the transcription is in your clipboard.

## Troubleshooting

Open DevTools on the ChatGPT tab (F12 → Console). Our log lines all start with `[ONE voice]`. Any other red/yellow lines (`SES_UNCAUGHT_EXCEPTION: null`, `ScriptProcessorNode deprecated`, `SES Removing unpermitted intrinsics`) are from ChatGPT's own bundle, present on every visit, and are not caused by this extension.

| Symptom | Likely cause | Fix |
|---|---|---|
| Hotkey does nothing | Scope not set to Global, or key already bound elsewhere | Re-bind at `chrome://extensions/shortcuts`, scope = Global |
| Mic button not found | You aren't on a ChatGPT conversation page, or ChatGPT changed their UI | Navigate to an active chat; if persistent, open an issue with the `[ONE voice] mic not matched. Buttons: ...` log line |
| Recording was cancelled by ChatGPT | ChatGPT's own backend returned 403 on `/estuary/content` (session/gizmo auth hiccup) | Sign out of chatgpt.com and back in; if persistent, your custom GPT may be rate-limited |
| Confirm button missing | ChatGPT cancelled mid-recording (see above) | Extension now aborts cleanly — just press the hotkey fresh to retry |
| Clipboard write blocked | Some Chrome versions require tab focus for clipboard writes | Click the ChatGPT tab once, retry |
| Wrong mic used | ChromeOS/Chrome default input not what you want | See "Choosing which microphone is used" above |

## Security

- **Local-only.** The extension makes zero network requests of its own. Your voice audio goes to OpenAI via ChatGPT's normal dictation flow, identical to clicking the mic by hand. Read the source — no `fetch`, no websocket, no telemetry.
- **Minimal scope.** `host_permissions` is limited to `chatgpt.com` and `chat.openai.com`; the extension cannot touch any other tab or domain.
- **Minimal permissions.** `storage` (two settings), `scripting` (inject content script into ChatGPT only), `tabs` (find/focus/minimize the ChatGPT window). No `notifications`, no broad host access, no debugger, no native messaging.
- **Verify yourself:** `chrome://extensions/` → Details → Permissions. The list should be exactly `Read and change your data on chatgpt.com and chat.openai.com`. If that list ever grows after an update, review the diff before accepting.

## Sibling project

[`explorills/one-voice`](https://github.com/explorills/one-voice) — original VS Code extension using the OpenAI Whisper API directly (with optional GPT grammar cleanup via API). Same Pause/Break ergonomics; different engine; requires an OpenAI API key. Use that one if you want editor-cursor insertion or terminal typing output; use this one if you want the reliability of ChatGPT's in-browser dictation and the free-with-ChatGPT-Plus cost profile.

## Roadmap

- Per-install default GPT URL (auto-open the configured conversation if no ChatGPT tab is found)
- Chrome Web Store listing
- Proper icon / branding pass
- Optional popover near the cursor (current feedback is window-focus only)

## License

MIT — see [LICENSE](LICENSE).

---

Part of the [ONE Ecosystem](https://expl.one).
