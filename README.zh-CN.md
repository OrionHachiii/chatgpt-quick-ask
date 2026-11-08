# Quick Ask · ChatGPT 划词小问

选中 ChatGPT 回答中的词语或句子，在小浮窗里解释、翻译、举例或提出一个小问题。使用当前 Chrome 中已登录的 ChatGPT 网页账号，无需 API Key，也不调用模型 API 或 ChatGPT 私有接口。

**状态：0.1.2 实验原型。已通过本地逻辑测试和模拟网页交互测试；2026-11-08 已在登录的 Chrome 中验证英文解释、收起与恢复；其他语言和操作仍需验证。** 网页结构、自动化限制和后台标签页节流可能影响运行，需要首次安装后测试。

## 安装（无需编译）

1. 打开桌面的 `ChatGPT-Quick-Ask` 文件夹，确认里面可以直接找到 `manifest.json`。
2. Chrome 地址栏输入 `chrome://extensions`。
3. 打开右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择桌面上的 **整个 `ChatGPT-Quick-Ask` 文件夹**。
5. 在同一 Chrome 浏览器配置中登录 `https://chatgpt.com`。**刷新已经打开的聊天页面**，让脚本加载。
6. 在一条 ChatGPT 回答中选中词语或句子，点击「Explain this」。

不需要运行 Node、安装依赖或开启本地服务。`tests/` 中的文件仅用于开发测试。

## 使用

界面固定为英文，包括按钮、状态、错误提示、辅助页横幅和工具栏说明。回答支持任意语言，默认跟随所选文字所在 ChatGPT 回答的语言；用户在问题中明确指定语言时优先按指定语言回答。若语言参考不明确，依次参考当前小问题和选中文字的语言。不会固定使用中文或英文。翻译目标优先服从用户要求，无法推断时询问目标语言。实际生成语言仍由 ChatGPT 决定。

- 选中 **同一条助手回答** 中的文字，会出现「Explain this」和「Ask…」。选用户消息、输入框文字或跨多条回答不会触发。
- 「Explain this」立即发起解释；「Ask…」打开浮窗供你输入自定义问题。
- 「Explain」「Translate」「Example」是三个一键提问操作。
- 回答逐步显示，按纯文本呈现，便于保持界面紧凑。代码块、公式等不单独渲染。
- Enter 发送；Shift + Enter 换行；中文输入法选词时不会意外提交。
- 点击「−」收起为小按钮，后台问答继续进行。点击小按钮恢复。
- 拖动标题栏可以移动浮窗。
- 点击「×」或按 Esc 关闭浮窗，同时关闭该浮窗创建的辅助标签页。
- 「Open helper tab」切换到真实的独立 ChatGPT 标签页，可检查登录、验证、使用限额或回答原文。
- 每次点击快捷问题或提交自定义问题，都创建 **全新的独立聊天**。小窗追问发送当前选区、当前问题和有限的语言参考片段，不会携带上一条小窗回答。

## 如何工作

```text
原聊天里选中文字
  → 扩展创建一个非活动的 ChatGPT 新标签页
  → 在新标签页的网页输入框填写并提交小问题（一次）
  → 读取助手回答，逐步传回原页面的浮窗
```

扩展不会向原聊天输入框写入内容，也不会往原聊天追加消息。它发送你选中的文字、你输入的问题、简短的解释任务，以及所选回答开头最多 1,200 字符作为语言参考；不会读取整段主聊天来构造问题。

非活动标签页会出现在 Chrome 标签栏中；并非完全隐藏的浏览器进程。它使用当前配置中的登录账号和网页默认模型，不能保证与原聊天选中的模型或项目设置相同。辅助页会保留到你关闭浮窗、发起下一问或关闭原标签页，以便查看原回答。不要在辅助标签页处理其他工作：扩展会按上述规则关闭它。

## 账号、额度与记录

- 问题通过你现有的 ChatGPT 网页账号发出，受账号额度、模型可用性及正常使用限制约束。
- 不收取本项目的服务费，也不建立单独的 API 账单；不是无限使用。
- 主聊天不变长，但小问题 **可能生成独立的 ChatGPT 历史记录**。关闭标签页不会删除服务器上的历史。
- 本项目不保证与账号 Memory、个性化设置或其他账号级数据完全隔离；它只隔离主聊天的消息和上下文。
- ChatGPT 原有的数据处理设置仍然适用。

## 隐私与权限

仅申请 `https://chatgpt.com/*` 的网页访问权限，以及 `storage` 和 `alarms`。

- 不申请 Cookie、浏览历史、调试器或所有网站权限。
- 不提取登录令牌，不读取账户 Cookie。问题通过网页提交至 ChatGPT，不向开发者自建服务器或分析服务传送问题或回答。
- 不访问模型 API、ChatGPT 后端私有接口或登录绕过接口。
- 用 `chrome.storage.session` 暂存任务、标签页编号及待发送问题（包含上述语言参考片段），以支持扩展后台休眠恢复。任务完成或报错时移除待发送问题；关闭浮窗时移除任务。
- 小窗回答只保留在页面内存中，不建立本地聊天数据库。
- 网页文本、选区和模型回答均作为文本处理，回答不会作为 HTML 执行。

## 首次真实测试与排错

1. 在普通 ChatGPT 聊天中选中一个短术语，例如 `handshake`，点击「Explain this」。
2. 检查标签栏是否出现新的 `chatgpt.com` 页面。点击浮窗的「Open helper tab」。
3. 如有登录、验证、欢迎页或额度提示，手动处理。扩展不自动通过验证码。
4. 回到原页面，关闭浮窗，然后重新选词提问。
5. 确认原聊天没有新增消息，回答只出现在浮窗中；再测试收起和关闭。

若不能自动提交，可能是网页输入框或按钮结构更新。相关选择器集中在 `adapter.js` 中。若后台标签页一直不加载，可以先切换到辅助页，让网页完成加载，再观察。等待超过约 3 分钟会提示超时；关闭后重试。不会自动重新发送，避免重复占用额度。

安装或更新后必须刷新原 ChatGPT 页面。扩展只匹配 `chatgpt.com`，不匹配旧域名、其他 AI 网站、移动浏览器或桌面 App 内部聊天。Chrome 隐身模式默认不启用本扩展。

## 开发与验证

需要 Node.js 20+；测试不需要安装第三方依赖。

```sh
npm test
```

运行本地浏览器交互测试（不会调用 OpenAI）：

```sh
node tests/browser.cjs --serve
```

打开终端输出的本机地址，点击「运行测试」。测试使用带明确标识的模拟聊天页面，覆盖选区触发、浮窗状态、取消、回答回传、辅助页提交和已有聊天保护。

也可在允许启动独立 Chrome 的环境运行 `npm run test:browser`。默认 Chrome 路径为 macOS 安装路径；其他系统可设置 `CHROME_PATH`。测试使用新建的临时配置，不读取你的真实 Chrome 配置。当前受限执行环境未能启动独立 Chrome，因此本次使用浏览器打开本地模拟测试页完成交互测试。

查看 `VERIFICATION.md` 获取本次验证范围。

## 文件

| 文件 | 作用 |
|---|---|
| `manifest.json` | 扩展声明及权限 |
| `content.js` | 划词入口、浮窗、请求和辅助页启动 |
| `adapter.js` | 网页输入框、按钮、回答识别 |
| `background.js` | 标签页所有权、任务隔离、消息校验和超时 |
| `core.js` | 提问构造、输入限制 |
| `popup.html` / `popup.css` | 工具栏中的使用说明 |
| `tests/` | 本地测试，无登录数据 |

## Open source

MIT licensed. An independent, unofficial Chrome extension prototype. Not affiliated with or endorsed by OpenAI. It automates the visible ChatGPT web UI in a separate tab; it does not use an API key, model APIs, private endpoints, or extracted session tokens. Compatibility with the live ChatGPT website remains to be verified. Distribution to the Chrome Web Store requires separate policy and compatibility review; this folder is prepared for local unpacked installation.

Technical references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [session storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs).
