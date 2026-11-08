(async function () {
  'use strict';
  const rpc = data => chrome.runtime.sendMessage({ channel: 'quick-ask', ...data });
  let role;
  try { role = await rpc({ type: 'ROLE' }); } catch { return; }
  if (role?.role === 'helper') {
    const { job } = role;
    if (job.state !== 'loading') {
      if (job.state === 'running') await rpc({ type: 'ERROR', id: job.id, text: 'The helper tab was refreshed. Automatic submission has stopped. Please ask again.' });
      return;
    }
    const claimed = await rpc({ type: 'CLAIM', id: job.id });
    if (!claimed?.ok) return;
    const banner = document.createElement('div');
    banner.textContent = 'Quick Ask helper · This is a separate chat. Its answer appears in the panel on your original page.';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#e6f3ee;color:#164e3d;padding:8px 16px;text-align:center;font:12px system-ui;pointer-events:none;';
    document.documentElement.append(banner);
    const controller = new AbortController();
    addEventListener('pagehide', () => controller.abort(), { once: true });
    try {
      await QuickAskAdapter.run(job, (type, text) => rpc({ type, text, id: job.id }), controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) await rpc({ type: 'ERROR', id: job.id, text: error.message });
    }
    return;
  }
  if (role?.role !== 'source' || document.getElementById('quick-ask-root')) return;
  const host = document.createElement('div');
  host.id = 'quick-ask-root';
  host.lang = 'en';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host{all:initial;color-scheme:light;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#24362f}
      *{box-sizing:border-box} [hidden]{display:none!important} button,textarea{font:inherit}
      button{cursor:pointer;border:0} button:focus-visible,textarea:focus-visible{outline:3px solid #80bca6;outline-offset:2px}
      #launcher{position:fixed;display:flex;gap:2px;background:#193f32;color:white;border:1px solid #ffffff30;border-radius:12px;padding:4px;box-shadow:0 5px 22px #0002;pointer-events:auto}
      #launcher button{padding:5px 11px;background:transparent;color:inherit;border-radius:8px;font-size:12px} #launcher button:hover{background:#ffffff25}
      #panel{position:fixed;right:24px;bottom:24px;width:380px;max-width:calc(100vw - 24px);max-height:min(520px,calc(100dvh - 24px));display:flex;flex-direction:column;background:#fbfcfa;border:1px solid #d8e3dc;border-radius:18px;box-shadow:0 16px 65px #0c2b2430;overflow:hidden;pointer-events:auto}
      header{display:flex;align-items:center;gap:8px;padding:13px 15px;border-bottom:1px solid #e4eae5;cursor:move;touch-action:none;user-select:none}
      .mark{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#e2eee7;color:#216047;font-weight:700;font-size:15px} .title{font-size:13px;font-weight:650;flex:1} .tag{font-size:10px;color:#74847b;font-weight:400;margin-left:5px}
      .icon{background:transparent;border-radius:6px;color:#667a70;padding:0;width:26px;height:26px;font-size:18px} .icon:hover{background:#edf1ed}
      .content{padding:14px 17px;overflow:auto;overscroll-behavior:contain;min-height:0}
      blockquote{margin:0 0 12px;padding:7px 10px;border-left:3px solid #a0c5b2;background:#f0f4ef;border-radius:0 6px 6px 0;color:#5c6f63;font-size:12px;max-height:66px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
      .actions{display:flex;gap:6px;margin-bottom:13px}.chip{background:#edf2ec;color:#416250;border:1px solid #dce7dc;border-radius:20px;padding:3px 12px;font-size:12px}.chip:hover{background:#e0ecdf}.chip:disabled{opacity:.45;cursor:default}
      #status{font-size:11px;color:#7c8a80;margin-bottom:7px}#status.error{color:#b14c38}
      #answer{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.85;min-height:36px;user-select:text}
      #answer:empty::before{content:'Choose a shortcut or type a question below.';color:#8c978f}
      form{display:flex;align-items:flex-end;gap:7px;padding:10px 13px;border-top:1px solid #e4eae5;background:white}
      textarea{resize:none;min-height:37px;max-height:90px;flex:1;min-width:0;border:1px solid #dfe6df;border-radius:10px;background:#f9fbf8;padding:8px 10px;color:#253b2e;font-size:12px;line-height:1.5}
      #submit{border-radius:10px;background:#215b44;color:white;padding:8px 13px;font-size:12px;min-height:37px}#submit:disabled{opacity:.5;cursor:wait}
      footer{display:flex;align-items:center;gap:9px;padding:0 15px 11px;background:white;font-size:10px;color:#89968d}footer span{flex:1}.link{background:none;color:#587c66;padding:2px;font-size:11px}.link:hover{text-decoration:underline}
      #pill{position:fixed;right:20px;bottom:20px;pointer-events:auto;border:1px solid #c6dace;border-radius:24px;background:#214c3b;color:#fff;box-shadow:0 6px 24px #143c3020;padding:8px 15px;font-size:12px}
      @media(prefers-color-scheme:dark){:host{color-scheme:dark;color:#dfebe2}#panel{background:#202b25;border-color:#405247}header,form{border-color:#3b4c40}form,footer{background:#202b25}blockquote{background:#2a382e;color:#b2c5b7}.chip{background:#2b3f30;color:#bfdac4;border-color:#435f49}.chip:hover{background:#3b5240}textarea{background:#27382d;border-color:#435a48;color:#e2eee4}.icon{color:#b3c9ba}.icon:hover{background:#34453a}#submit{background:#8ec6a3;color:#193e29}.link{color:#9ac5a7}#status.error{color:#ffab91}}
    </style>
    <div id="launcher" hidden><button id="quick">Explain this</button><button id="custom">Ask…</button></div>
    <section id="panel" role="dialog" aria-label="Quick Ask reading assistant" hidden>
      <header><span class="mark">q</span><span class="title">Quick Ask <span class="tag">Reading assistant</span></span><button class="icon" id="minimize" aria-label="Minimize panel" title="Minimize">−</button><button class="icon" id="close" aria-label="Close panel" title="Close and cancel">×</button></header>
      <div class="content"><blockquote id="quote"></blockquote><div class="actions"><button class="chip" data-mode="explain">Explain</button><button class="chip" data-mode="translate">Translate</button><button class="chip" data-mode="example">Example</button></div><div id="status" role="status" aria-live="polite">Separate question · Original chat unchanged</div><div id="answer" aria-label="Answer"></div></div>
      <form><textarea id="question" rows="1" maxlength="600" placeholder="What would you like to know?" aria-label="Question"></textarea><button id="submit" type="submit">Ask ↗</button></form>
      <footer><span>Your account · Normal limits apply</span><button class="link" id="original" hidden>Open helper tab</button><button class="link" id="copy" hidden>Copy</button></footer>
    </section>
    <button id="pill" hidden aria-label="Expand Quick Ask">q · Reading assistant</button>`;
  const $ = id => shadow.getElementById(id);
  let selected = '', activeText = '', selectedContext = '', activeContext = '', id = null, busy = false, anchor = null, revision = 0;
  let pageURL = location.href;
  const clamp = (n, low, high) => Math.max(low, Math.min(n, Math.max(low, high)));
  function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function setBusy(value) {
    busy = value; $('submit').disabled = value;
    shadow.querySelectorAll('[data-mode]').forEach(button => button.disabled = value);
    $('pill').textContent = value ? 'q · Answering…' : 'q · Reading assistant';
  }
  async function cancel() {
    revision++;
    const old = id; id = null; setBusy(false);
    if (old) try { await rpc({ type: 'CANCEL', id: old }); } catch {}
  }
  function close() { cancel(); $('panel').hidden = true; $('pill').hidden = true; $('launcher').hidden = true; }
  function positionPanel() {
    if (!anchor) {
      const rect = $('panel').getBoundingClientRect();
      if ($('panel').style.left) {
        $('panel').style.left = clamp(rect.left, 12, innerWidth - rect.width - 12) + 'px';
        $('panel').style.top = clamp(rect.top, 12, innerHeight - rect.height - 12) + 'px';
      }
      return;
    }
    $('panel').style.right = 'auto'; $('panel').style.bottom = 'auto';
    const rect = $('panel').getBoundingClientRect();
    $('panel').style.left = clamp(anchor.right + 14, 12, innerWidth - rect.width - 12) + 'px';
    $('panel').style.top = clamp(anchor.bottom + 12, 12, innerHeight - rect.height - 12) + 'px';
  }
  function open() {
    if (!selected) return;
    if (activeText !== selected || activeContext !== selectedContext) {
      cancel(); activeText = selected; activeContext = selectedContext; $('answer').textContent = ''; $('question').value = '';
      $('original').hidden = true; $('copy').hidden = true; status('Separate question · Original chat unchanged');
    }
    $('quote').textContent = activeText; $('launcher').hidden = true; $('pill').hidden = true; $('panel').hidden = false;
    positionPanel();
  }
  async function ask(mode) {
    if (busy || !activeText) return;
    const input = { text: activeText, mode, question: $('question').value, languageContext: activeContext };
    try { QuickAskCore.validate(input); } catch (error) { status(error.message, true); return; }
    const cancelPromise = cancel(); const intent = revision;
    await cancelPromise;
    if (revision !== intent || ($('panel').hidden && $('pill').hidden)) return;
    id = crypto.randomUUID(); const requestId = id;
    $('answer').textContent = ''; $('copy').hidden = true; $('original').hidden = true;
    setBusy(true); status('Preparing a separate chat…');
    try {
      const result = await rpc({ type: 'START', id: requestId, input });
      if (id !== requestId) return;
      if (!result?.ok) throw new Error(result?.error || 'Could not start the question.');
      $('original').hidden = false;
    } catch (error) { if (id === requestId) { setBusy(false); status(error.message || 'The extension may have been updated. Refresh this page and retry.', true); } }
  }
  function capture(event) {
    if (event.composedPath().includes(host)) return;
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) { $('launcher').hidden = true; return; }
    const range = selection.getRangeAt(0);
    const element = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const start = element(range.startContainer)?.closest(QuickAskAdapter.SELECTORS.assistant);
    const end = element(range.endContainer)?.closest(QuickAskAdapter.SELECTORS.assistant);
    const text = selection.toString().trim();
    if (!start || start !== end || !text || text.length > 6000) { $('launcher').hidden = true; return; }
    selected = text; selectedContext = start.innerText.slice(0, 1200); anchor = range.getBoundingClientRect();
    $('launcher').hidden = false;
    const rect = $('launcher').getBoundingClientRect();
    $('launcher').style.left = clamp(anchor.left, 8, innerWidth - rect.width - 8) + 'px';
    $('launcher').style.top = clamp(anchor.bottom + 7, 8, innerHeight - rect.height - 8) + 'px';
  }
  document.addEventListener('mouseup', capture);
  document.addEventListener('keyup', event => { if (event.key === 'Shift') capture(event); });
  $('launcher').addEventListener('pointerdown', event => event.preventDefault());
  $('quick').onclick = () => { open(); ask('explain'); };
  $('custom').onclick = () => { open(); $('question').focus(); };
  $('close').onclick = close;
  $('minimize').onclick = () => { $('panel').hidden = true; $('pill').hidden = false; };
  $('pill').onclick = () => { $('panel').hidden = false; $('pill').hidden = true; positionPanel(); };
  shadow.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => ask(button.dataset.mode));
  shadow.querySelector('form').onsubmit = event => { event.preventDefault(); ask('ask'); };
  $('question').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); ask('ask'); } };
  $('original').onclick = async () => { const result = await rpc({ type: 'OPEN', id }); if (!result?.ok) status(result?.error || 'The helper tab has been closed.', true); };
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText($('answer').textContent); status('Answer copied.'); } catch { status('Could not copy. Select the answer and copy it manually.', true); } };
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  addEventListener('scroll', () => { $('launcher').hidden = true; }, true);
  addEventListener('resize', positionPanel);
  // A drag only moves our overlay; it never changes page scroll or the chat layout.
  shadow.querySelector('header').onpointerdown = event => {
    if (event.target.closest('button')) return;
    const header = event.currentTarget, rect = $('panel').getBoundingClientRect();
    const dx = event.clientX - rect.left, dy = event.clientY - rect.top;
    header.setPointerCapture(event.pointerId);
    header.onpointermove = move => {
      anchor = null; $('panel').style.right = 'auto'; $('panel').style.bottom = 'auto';
      $('panel').style.left = clamp(move.clientX - dx, 12, innerWidth - rect.width - 12) + 'px';
      $('panel').style.top = clamp(move.clientY - dy, 12, innerHeight - rect.height - 12) + 'px';
    };
    header.onpointerup = () => { header.onpointermove = null; header.onpointerup = null; };
  };
  chrome.runtime.onMessage.addListener(message => {
    if (message?.channel !== 'quick-ask' || message.id !== id) return;
    if (message.type === 'STATUS') status(message.text);
    if (message.type === 'PARTIAL' || message.type === 'DONE') {
      $('answer').textContent = message.text; $('copy').hidden = false;
      if (message.type === 'DONE') { setBusy(false); status('Done · Original chat unchanged'); }
      else status('ChatGPT is answering…');
    }
    if (message.type === 'ERROR') { setBusy(false); status(message.text, true); }
  });
  setInterval(() => {
    if (location.href !== pageURL) { pageURL = location.href; selected = ''; activeText = ''; selectedContext = ''; activeContext = ''; close(); }
  }, 1000);
})();
