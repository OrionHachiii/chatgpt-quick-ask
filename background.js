/* All tab ownership and job state survive service-worker suspension in storage.session. */
importScripts('core.js');
const STORE = 'quickAskJobs';
const LIMIT_MS = 180000;
let queue = Promise.resolve();
function serial(fn) { const next = queue.then(fn, fn); queue = next.catch(() => {}); return next; }
async function jobs() { return (await chrome.storage.session.get(STORE))[STORE] || {}; }
async function save(all) { await chrome.storage.session.set({ [STORE]: all }); }
async function emit(job, type, text = '') {
  try { await chrome.tabs.sendMessage(job.source, { channel: 'quick-ask', type, id: job.id, text }); } catch { /* Source may have navigated. */ }
}
async function removeTab(id) { if (Number.isInteger(id)) { try { await chrome.tabs.remove(id); } catch {} } }
async function discard(all, job) {
  delete all[job.id];
  await save(all); // Remove ownership before tabs.onRemoved fires.
  await removeTab(job.helper);
}
async function handle(message, sender) {
  if (!sender.tab || sender.frameId !== 0 || !QuickAskCore.isChatURL(sender.url)) throw new Error('Quick Ask only works on ChatGPT pages.');
  const all = await jobs();
  const tabId = sender.tab.id;
  if (message.type === 'ROLE') {
    const job = Object.values(all).find(j => j.helper === tabId);
    return job ? { role: 'helper', job: { id: job.id, prompt: job.prompt, state: job.state, deadline: job.deadline } } : { role: 'source' };
  }
  if (message.type === 'START') {
    if (Object.values(all).some(j => j.helper === tabId)) throw new Error('Helper tabs cannot start another question.');
    const input = QuickAskCore.validate(message.input);
    if (typeof message.id !== 'string' || !/^[\w-]{1,80}$/.test(message.id)) throw new Error('Invalid request ID.');
    if (all[message.id]) throw new Error('Duplicate request ID. Please try again.');
    for (const job of Object.values(all)) if (job.source === tabId) await discard(all, job);
    const job = { id: message.id, source: tabId, helper: null, state: 'loading', prompt: QuickAskCore.prompt(input), deadline: Date.now() + LIMIT_MS };
    all[job.id] = job;
    await save(all);
    try {
      const tab = await chrome.tabs.create({ url: 'https://chatgpt.com/', active: false, windowId: sender.tab.windowId });
      job.helper = tab.id;
      await save(all);
      await emit(job, 'STATUS', 'Opening a separate chat…');
      return { ok: true };
    } catch (error) {
      delete all[job.id]; await save(all); throw error;
    }
  }
  const job = all[message.id];
  if (!job) return { ok: false, error: 'This request has ended. Please ask again.' };
  if (message.type === 'CANCEL') {
    if (job.source !== tabId) throw new Error('You cannot cancel this request.');
    await discard(all, job); return { ok: true };
  }
  if (message.type === 'OPEN') {
    if (job.source !== tabId) throw new Error('You cannot open this request.');
    await chrome.tabs.update(job.helper, { active: true });
    return { ok: true };
  }
  if (job.helper !== tabId) throw new Error('Response source does not match this request.');
  if (message.type === 'CLAIM') {
    if (job.state !== 'loading') return { ok: false, error: 'This request has already started and cannot be submitted twice.' };
    job.state = 'running'; await save(all); return { ok: true };
  }
  if (!['STATUS', 'PARTIAL', 'DONE', 'ERROR'].includes(message.type)) throw new Error('Unsupported message.');
  if (['done', 'error'].includes(job.state)) return { ok: false };
  const text = typeof message.text === 'string' ? message.text.slice(0, 100000) : '';
  if (message.type === 'DONE' || message.type === 'ERROR') {
    job.state = message.type === 'DONE' ? 'done' : 'error';
    delete job.prompt;
    await save(all);
  }
  await emit(job, message.type, text);
  return { ok: true };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.channel !== 'quick-ask') return;
  serial(() => handle(message, sender)).then(respond, error => respond({ ok: false, error: error.message || 'The extension could not complete this action.' }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => serial(async () => {
  const all = await jobs();
  for (const job of Object.values(all)) {
    if (job.source === tabId) await discard(all, job);
    else if (job.helper === tabId) {
      if (!['done', 'error'].includes(job.state)) await emit(job, 'ERROR', 'The helper tab was closed. Please ask again.');
      delete all[job.id]; await save(all);
    }
  }
}));
chrome.alarms.create('quick-ask-cleanup', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== 'quick-ask-cleanup') return;
  serial(async () => {
    const all = await jobs();
    for (const job of Object.values(all)) {
      if (!['done', 'error'].includes(job.state) && Date.now() > job.deadline) {
        job.state = 'error'; delete job.prompt; await save(all);
        await emit(job, 'ERROR', 'No confirmed response after 3 minutes. Check the helper tab, or close and retry.');
      }
    }
  });
});
