# Development and implementation notes

## 本地读取与网络限制

运行时无需服务器。解析器、图表和样式都打包在扩展内。

- 扩展只声明 `file:///*` 权限，不声明 HTTP/HTTPS 网站权限。
- 自动入口仅在本地 Markdown 的顶层页面生效。后台使用浏览器提供的页面地址生成阅读器 URL，不接受消息传入的任意 URL；入口替换原页面的历史项，保留正常的浏览器后退行为。
- 仅向本地页面开放阅读器 HTML 的导航入口，阅读器禁止被 iframe 嵌入；不向网站开放脚本或文件读取 API。
- 文件正文直接从本机读取。目录树解析 Chromium 生成的目录索引数据，**不执行目录页面中的脚本**。
- CSP `connect-src file:` 只允许本地文件读取，HTTP/HTTPS、WebSocket 和其他网络连接被阻止。代码同时拒绝带远程主机的 file URL。
- 图片仅允许打包资源和本地 Blob；远程图片、脚本、字体及文档内的嵌入网页不加载。外链仅复制地址，不导航到外部网站。
- Markdown 中的原始 HTML 不执行。HTML 文件经 DOMPurify 清理后放入静态 iframe，保留原页面样式并隔离阅读器布局。iframe 不授予脚本、弹窗、表单和下载权限，并使用 `script-src / connect-src 'none'` 的独立 CSP。仅保留同源能力供阅读器定位标题和保存滚动位置。
- HTML 链接不导航，表单控件停用；本地 CSS 和位图先由父阅读器读取，再以内嵌样式 / Blob 提供给预览页。Mermaid 使用 strict 模式，忽略文档内全局配置，并清理 SVG 的链接、嵌入内容和交互。
- 为展示 Mermaid 内嵌样式，`style-src` 允许 inline 样式；`script-src` 始终仅允许打包脚本，禁止 inline script 和 eval。

文件网址模式允许读取本机文件，并按文件路径解析相对文档和图片。手动选择目录时，仍使用浏览器的只读 File System Access 授权，引用限制在该目录内。扩展没有修改或删除文件的操作。

IndexedDB 只保存最近的文件 URL 或文件句柄、路径与滚动位置；localStorage 保存阅读偏好，不缓存文档正文。「阅读设置 → 关闭并忘记位置」清除最近位置；文件网址权限可在 Chrome 扩展详情中关闭。

## 当前边界

- 面向桌面 Chrome / Edge；未提供 Safari / Firefox 安装包。
- 文本上限 8 MB，位图上限 20 MB。独立 SVG 和数学公式暂不渲染。HTML 仅提供静态展示，不运行交互脚本；CSS `@import`、外部字体和数据 URI 图片暂不加载。HTML 附属资源最多 40 项、合计 32 MB，单份样式表最多 2 MB。
- 搜索文件名和路径，不建立全文索引。跳过 `.git`、`node_modules`、虚拟环境，单次上限 20,000 项或 150 条结果。
- 每份文档最多绘制 40 张 Mermaid 图，每张上限 60,000 字符与 500 条边。自定义全局配置、可点击图表链接和外部图标被禁用；语法错误时保留源码。
- 标签页可见时每两秒检测当前文件。文件网址模式读取正文摘要检测变化；刷新按钮同时更新目录。
- 自动目录浏览依赖 Chromium 内建目录索引格式；索引不可读时仍显示正文，并提示手动选择目录。手动目录选择器可能限制系统符号链接和受保护目录。


## 开发与验证

需要 Node.js 22.12+。安装依赖需要网络，扩展运行不需要网络。

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run test:files
npm run test:html
npm run package
```

安装包输出为 `release/md-preview-<version>.zip`，打包需要 `zip` 命令。已有 Chromium 时可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。

`test:browser` 用隔离的真实 FileSystemHandle 测试手动选目录、Markdown 和 Mermaid。`test:files` 创建临时磁盘目录，以真实 `file://` 导航测试自动接管、父目录树、文件链接、自动刷新及 Chrome 文件权限开关。`test:html` 验证 HTML/CSS 预览、布局隔离、脚本与外部资源拦截。测试不读取用户文档；结果保存在 `.test-output/`。

源码主要位于 `src/app.jsx`（阅读界面）、`src/files.js`（目录选择器）、`src/file-url.js`（本地 URL 读取）、`src/content.js` / `src/background.js`（自动入口）、`src/markdown.js` / `src/diagrams.js` / `src/html-preview.js`（渲染）。

MIT 许可。第三方依赖的许可随安装包保留在 `THIRD_PARTY_LICENSES.txt`。

## 维护者发布

CI 只生成 Actions artifact；正式下载入口由 GitHub Release 提供。仓库为 private 时，Release 也仅向有权限的用户开放，发布 Release 不会自动公开仓库。

完成检查并推送代码后，创建版本标签、上传发行包：

```sh
npm run check
node scripts/package.mjs
git tag -a v0.4.1 -m "MD Preview 0.4.1"
git push origin v0.4.1
gh release create v0.4.1 release/md-preview-0.4.1.zip --verify-tag --title "MD Preview 0.4.1" --notes-file docs/CHANGELOG.md
```

版本升级时同步 package.json、package-lock.json、manifest 和更新记录。Chrome 商店的材料与人工提交步骤见 [发布材料](chrome-store/README.md)。
