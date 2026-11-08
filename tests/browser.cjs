/* Browser checks use an isolated, signed-out profile and a local fixture. No OpenAI requests. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = `<!doctype html><meta charset="utf-8"><title>Quick Ask · local test fixture</title>
<style>body{background:#f7f8f5;font:16px/1.9 system-ui;color:#243c30;max-width:760px;margin:80px auto;padding:24px}small{color:#879685}h1{font-size:28px}article{padding:20px;background:white;border-radius:12px}#prompt-textarea{display:block;margin-top:36px;border:1px solid #bbcabb;padding:16px;min-height:45px}button{padding:8px;margin-top:8px}</style>
<small>LOCAL FIXTURE · 模拟页面，不是真实 ChatGPT 回答</small><h1>阅读时，随手问一个小问题。</h1>
<article data-testid="conversation-turn-1"><div data-message-author-role="assistant"><div class="markdown" id="reading">valid-ready handshake 表示发送方发出 valid，接收方发出 ready；在同一时钟沿两者均为高电平时，完成一次数据传输。</div></div></article>
<div id="prompt-textarea" contenteditable="true" role="textbox"></div><button data-testid="send-button">Send</button>
<script>
window.calls=[];window.listeners=[];window.chrome={runtime:{sendMessage:async m=>{calls.push(m);return m.type==='ROLE'?{role:'source'}:{ok:true}},onMessage:{addListener:f=>listeners.push(f)}}};
if(new URLSearchParams(location.search).get('mode')==='helper')document.querySelector('article').remove();
document.querySelector('[data-testid="send-button"]').onclick=()=>{window.sends=(window.sends||0)+1;
let u=document.createElement('div');u.dataset.messageAuthorRole='user';u.textContent=document.querySelector('#prompt-textarea').innerText;document.body.append(u);
let article=document.createElement('article');article.innerHTML='<div data-message-author-role="assistant"><div class="markdown">等待回答</div></div><button data-testid="stop-button">Stop</button>';document.body.append(article);
setTimeout(()=>{article.querySelector('.markdown').textContent='这是独立页面的完整解释。';article.querySelector('button').remove();let b=document.createElement('button');b.dataset.testid='copy-turn-action-button';b.textContent='Copy';article.append(b)},750)};
</script><script src="/core.js"></script><script src="/adapter.js"></script>
<script>if(new URLSearchParams(location.search).get('mode')!=='helper'){let s=document.createElement('script');s.src='/content.js';document.head.append(s)}</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/test.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(__dirname, 'interactive.html'))); return; }
  if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); return; }
  if (['/core.js', '/adapter.js', '/content.js'].includes(url.pathname)) {
    res.setHeader('Content-Type', 'application/javascript'); res.end(fs.readFileSync(path.join(root, url.pathname))); return;
  }
  res.writeHead(404); res.end();
});
let chrome, socket, profile;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  if (process.argv.includes('--serve')) { console.log('Local browser tests: ' + base + '/test.html'); return; }
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-ask-test-'));
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; chrome.stderr.on('data', chunk => stderr += chunk); chrome.on('error', error => stderr += error.message);
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 60 && !fs.existsSync(portFile); i++) await sleep(150);
  if (!fs.existsSync(portFile)) throw new Error('Chrome did not start: ' + stderr.slice(-1600));
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0; const pending = new Map();
  socket.onmessage = event => { const value = JSON.parse(event.data); if (pending.has(value.id)) { const { resolve, reject } = pending.get(value.id); pending.delete(value.id); value.error ? reject(new Error(JSON.stringify(value.error))) : resolve(value.result); } };
  const cmd = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) {
    const result = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  }
  await cmd('Page.enable');
  await cmd('Page.navigate', { url: base });
  for (let i = 0; i < 40 && !await evaluate("!!document.getElementById('quick-ask-root')"); i++) await sleep(100);
  assert.ok(await evaluate("!!document.getElementById('quick-ask-root')"));
  await evaluate(`{let r=document.createRange();r.selectNodeContents(document.getElementById('reading'));getSelection().removeAllRanges();getSelection().addRange(r);document.getElementById('reading').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,composed:true}));}`);
  assert.equal(await evaluate("document.getElementById('quick-ask-root').shadowRoot.getElementById('launcher').hidden"), false);
  await evaluate("document.getElementById('quick-ask-root').shadowRoot.getElementById('quick').click()");
  await sleep(100);
  const start = await evaluate("calls.find(m=>m.type==='START')");
  assert.ok(start.input.text.includes('valid-ready'));
  assert.equal(await evaluate("document.getElementById('prompt-textarea').innerText"), '');
  assert.equal(await evaluate('window.sends || 0'), 0);
  await evaluate(`listeners.forEach(f=>f({channel:'quick-ask',type:'DONE',id:${JSON.stringify(start.id)},text:'valid-ready 握手：发送方声明数据有效，接收方声明可以接收。两者同时为高时，完成一次传输。\\n\\n例如：发送方准备好数据后保持 valid，直到接收方 ready，再开始下一次传输。'}))`);
  assert.ok(await evaluate("document.getElementById('quick-ask-root').shadowRoot.getElementById('answer').textContent.includes('发送方')"));
  // Render arbitrary model text as plain text: never execute page or model HTML.
  await evaluate(`listeners.forEach(f=>f({channel:'quick-ask',type:'DONE',id:${JSON.stringify(start.id)},text:'<img src=x onerror=alert(1)> literal'}))`);
  assert.equal(await evaluate("document.getElementById('quick-ask-root').shadowRoot.querySelectorAll('#answer img').length"), 0);
  await evaluate(`listeners.forEach(f=>f({channel:'quick-ask',type:'DONE',id:${JSON.stringify(start.id)},text:'valid-ready 握手：发送方声明数据有效，接收方声明可以接收。两者同时为高时，完成一次传输。\\n\\n例如：发送方保持 valid，直到接收方 ready，再开始下一次传输。'}))`);
  if (process.env.QUICKASK_SCREENSHOT) {
    const shot = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(process.env.QUICKASK_SCREENSHOT, Buffer.from(shot.data, 'base64'));
  }
  await evaluate("document.getElementById('quick-ask-root').shadowRoot.getElementById('minimize').click()");
  assert.equal(await evaluate("document.getElementById('quick-ask-root').shadowRoot.getElementById('pill').hidden"), false);
  await evaluate("document.getElementById('quick-ask-root').shadowRoot.getElementById('pill').click()");
  await evaluate("document.getElementById('quick-ask-root').shadowRoot.getElementById('close').click()");
  await sleep(50);
  assert.ok(await evaluate("calls.some(m=>m.type==='CANCEL')"));
  console.log('PASS selection, floating answer, no main-composer edits, safe text, minimize, cancel');
  await cmd('Page.navigate', { url: base + '/?mode=helper' });
  for (let i = 0; i < 40 && !await evaluate('typeof QuickAskAdapter !== "undefined"'); i++) await sleep(100);
  const events = await evaluate(`(async()=>{let events=[];await QuickAskAdapter.run({prompt:'请解释 handshake',deadline:Date.now()+10000},async(type,text)=>events.push({type,text}),new AbortController().signal);return {events,sends:window.sends,user:document.querySelector('[data-message-author-role="user"]').textContent}})()`);
  assert.equal(events.sends, 1); assert.equal(events.user, '请解释 handshake');
  assert.equal(events.events.at(-1).type, 'DONE');
  assert.ok(events.events.some(e => e.type === 'PARTIAL'));
  const refused = await evaluate(`QuickAskAdapter.run({prompt:'do not submit',deadline:Date.now()+1000},async()=>{},new AbortController().signal).then(()=>false,e=>e.message)`);
  assert.match(refused, /not a blank new chat/);
  assert.equal(await evaluate('window.sends'), 1);
  console.log('PASS editor insertion, exactly one submit, incremental reply, completion, existing-chat guard');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (process.argv.includes('--serve') && !process.exitCode) return;
  socket?.close(); chrome?.kill('SIGTERM'); server.close();
  if (chrome && chrome.exitCode === null) await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), sleep(2000)]);
  if (profile) { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }
});
