/* ChatGPT DOM integration is intentionally isolated here: update selectors after site changes. */
(function (root) {
  'use strict';
  const SELECTORS = {
    composer: '#prompt-textarea, textarea[data-id="root"]',
    assistant: '[data-message-author-role="assistant"]',
    user: '[data-message-author-role="user"]',
    send: 'button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label="发送提示"], button[aria-label="发送消息"]',
    stop: 'button[data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="停止生成"]',
    finished: '[data-testid="copy-turn-action-button"], button[aria-label="Copy"], button[aria-label="复制"]'
  };
  const visible = el => !!el && el.getClientRects().length > 0;
  const find = selector => [...document.querySelectorAll(selector)].find(visible);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(fn, timeout, signal) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (signal.aborted) throw new Error('Cancelled.');
      const value = fn(); if (value) return value;
      await pause(300);
    }
    throw new Error('Chat controls were not found. Check the helper tab for sign-in, verification, or a changed page layout.');
  }
  function setText(composer, text) {
    composer.focus();
    if (composer.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(composer, text);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (composer.isContentEditable) {
      const selection = getSelection(); const range = document.createRange();
      range.selectNodeContents(composer); selection.removeAllRanges(); selection.addRange(range);
      // Editing command is used for compatibility with the page's ProseMirror/React editor.
      const inserted = document.execCommand('insertText', false, text);
      if (!inserted || composer.innerText.trim() !== text.trim()) {
        composer.textContent = text;
        composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
    } else throw new Error('The message editor could not be recognized. The extension may need an update.');
  }
  async function run(job, report, signal) {
    const remaining = () => Math.max(1, job.deadline - Date.now());
    const composer = await until(() => find(SELECTORS.composer), Math.min(45000, remaining()), signal);
    // Never type in an existing conversation, even if a website redirect or a user navigates there.
    if (!['/', ''].includes(location.pathname) || document.querySelector(SELECTORS.user) || document.querySelector(SELECTORS.assistant)) {
      throw new Error('The helper tab is not a blank new chat. Stopped to protect the existing conversation. Close the panel and retry.');
    }
    const existing = composer.tagName === 'TEXTAREA' ? composer.value : composer.innerText;
    if (existing.trim()) throw new Error('The helper editor already contains text. Stopped to avoid overwriting it.');
    setText(composer, job.prompt);
    const send = await until(() => {
      const el = find(SELECTORS.send); return el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' ? el : null;
    }, Math.min(15000, remaining()), signal);
    if (signal.aborted) throw new Error('Cancelled.');
    if (location.pathname !== '/' || document.querySelector(SELECTORS.user)) throw new Error('The helper page changed. Submission was stopped.');
    send.click(); // Submit exactly once. No Enter fallback that could duplicate a request.
    await report('STATUS', 'Submitted. Waiting for ChatGPT…');
    let last = '', stableSince = Date.now(), seenStop = false;
    let firstTextAt = 0;
    while (Date.now() < job.deadline) {
      if (signal.aborted) return;
      const messages = [...document.querySelectorAll(SELECTORS.assistant)];
      const message = messages.at(-1);
      const body = message?.querySelector('.markdown') || message;
      const text = body?.innerText?.trim() || '';
      const generating = !!find(SELECTORS.stop) || !!document.querySelector('[data-is-streaming="true"]');
      if (generating) seenStop = true;
      if (text !== last) {
        last = text; stableSince = Date.now(); if (!firstTextAt && text) firstTextAt = Date.now();
        if (text) await report('PARTIAL', text);
      }
      const turn = message?.closest('article, [data-testid^="conversation-turn-"]');
      const completeControl = !!turn?.querySelector(SELECTORS.finished);
      // Without a completion marker, do not guess that a pause in a long answer means completion.
      if (last && !generating && (seenStop || completeControl) && Date.now() - stableSince > 1800 && Date.now() - firstTextAt > 1800) {
        await report('DONE', last); return;
      }
      await pause(650);
    }
    throw new Error(last ? 'A partial answer is shown, but completion could not be confirmed. Check the helper tab.' : 'Timed out. Check the helper tab for sign-in, verification, or usage limits.');
  }
  root.QuickAskAdapter = { SELECTORS, setText, run };
})(globalThis);
