const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../core.js');
function setup() {
  let storage = {}, counter = 100, listener, onRemoved, alarm;
  const sent = [], created = [], removed = [], updated = [];
  const chrome = {
    storage: { session: { get: async () => structuredClone(storage), set: async value => { storage = structuredClone({ ...storage, ...value }); } } },
    tabs: {
      create: async options => { created.push(options); return { id: counter++ }; },
      remove: async id => { removed.push(id); },
      update: async (id, options) => updated.push({ id, options }),
      sendMessage: async (id, message) => sent.push({ tabId: id, ...message }),
      onRemoved: { addListener: fn => { onRemoved = fn; } }
    },
    runtime: { onMessage: { addListener: fn => { listener = fn; } } },
    alarms: { create() {}, onAlarm: { addListener: fn => { alarm = fn; } } }
  };
  function load() {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8'), { chrome, QuickAskCore: Core, importScripts() {}, URL, console });
  }
  load();
  const call = (type, source = 1, extra = {}, url = 'https://chatgpt.com/c/main') => new Promise(resolve => {
    listener({ channel: 'quick-ask', type, ...extra }, { tab: { id: source, windowId: 7 }, frameId: 0, url }, resolve);
  });
  const start = (id, source = 1) => call('START', source, { id, input: { text: 'valid-ready', mode: 'explain', question: '' } });
  return { call, start, sent, created, removed, updated, load, storage: () => storage, close: id => onRemoved(id), tick: () => alarm({ name: 'quick-ask-cleanup' }) };
}
test('new isolated tab per question; updates route only to source, not its composer', async () => {
  const t = setup();
  assert.equal((await t.start('one')).ok, true);
  assert.equal(t.created[0].url, 'https://chatgpt.com/');
  assert.equal(t.created[0].active, false);
  assert.equal((await t.call('ROLE', 100)).role, 'helper');
  assert.equal((await t.call('CLAIM', 100, { id: 'one' })).ok, true);
  assert.equal((await t.call('CLAIM', 100, { id: 'one' })).ok, false);
  await t.call('PARTIAL', 100, { id: 'one', text: '回答' });
  await t.call('DONE', 100, { id: 'one', text: '完整回答' });
  assert.equal(t.sent.at(-1).id, 'one');
  assert.equal(t.sent.at(-1).type, 'DONE');
  assert.equal(t.sent.at(-1).tabId, 1);
  assert.equal(t.sent.filter(m => m.type === 'DONE').length, 1);
  await t.start('two');
  assert.deepEqual(t.removed, [100]);
  assert.equal(t.created.length, 2);
  assert.equal((await t.call('ROLE', 101)).job.state, 'loading');
});
test('rejects forged answers, cross-tab cancellation, and non-ChatGPT messages', async () => {
  const t = setup(); await t.start('one');
  for (const type of ['PARTIAL', 'DONE', 'ERROR', 'CANCEL', 'OPEN']) {
    const reply = await t.call(type, 9, { id: 'one', text: 'forged' });
    assert.equal(reply.ok, false, type);
  }
  assert.equal((await t.call('ROLE', 1, {}, 'https://evil.test')).ok, false);
  assert.equal((await t.start('nested', 100)).ok, false);
});
test('worker restart preserves job role and duplicate-submit guard', async () => {
  const t = setup(); await t.start('one'); await t.call('CLAIM', 100, { id: 'one' });
  t.load();
  assert.equal((await t.call('ROLE', 100)).job.state, 'running');
  assert.equal((await t.call('CLAIM', 100, { id: 'one' })).ok, false);
  await t.call('CANCEL', 1, { id: 'one' });
  assert.deepEqual(t.removed, [100]);
  assert.deepEqual(t.storage().quickAskJobs, {});
});
test('two source tabs remain independent', async () => {
  const t = setup(); await t.start('one', 1); await t.start('two', 2);
  await t.call('CANCEL', 1, { id: 'one' });
  assert.equal((await t.call('ROLE', 101)).job.id, 'two');
  assert.deepEqual(t.removed, [100]);
});
test('closing source cleans only its helper; unexpected helper closure reports an error', async () => {
  const t = setup(); await t.start('one', 1); await t.start('two', 2);
  await t.close(1);
  assert.deepEqual(t.removed, [100]);
  await t.close(101);
  assert.ok(t.sent.some(m => m.tabId === 2 && m.type === 'ERROR'));
  assert.deepEqual(t.storage().quickAskJobs, {});
});
test('timeout preserves the helper for inspection and blocks late answer updates', async () => {
  const t = setup(); await t.start('one');
  t.storage().quickAskJobs.one.deadline = 0;
  t.tick(); await t.call('ROLE', 1); // Flush the serialized alarm handler.
  assert.equal(t.storage().quickAskJobs.one.state, 'error');
  assert.ok(t.sent.some(m => m.type === 'ERROR' && m.text.includes('3 minutes')));
  assert.equal((await t.call('DONE', 100, { id: 'one', text: 'late answer' })).ok, false);
  assert.deepEqual(t.removed, []);
});
test('duplicate IDs cannot overwrite another source job', async () => {
  const t = setup(); await t.start('one', 1);
  assert.equal((await t.start('one', 2)).ok, false);
  assert.equal(t.storage().quickAskJobs.one.source, 1);
  assert.equal(t.created.length, 1);
});
