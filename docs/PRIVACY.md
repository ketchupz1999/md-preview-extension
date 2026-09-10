# MD Preview privacy policy

Last updated: 2026-09-10

MD Preview is a local document preview extension for desktop Chrome and Edge. This policy describes the extension itself. GitHub, the Chrome Web Store, and your browser provide their own services under their respective policies.

## Information processed on your device

To show a document, MD Preview reads the local file you open, its surrounding directory listing, and supported local images or styles referenced by the document. When you choose a folder, the browser grants read access to that folder. File URL mode uses the browser's separately controlled **Allow access to file URLs** permission.

File contents and directory information are processed in the browser for preview, navigation, filename search, and detecting changes. They are not uploaded to the developer, an analytics service, or any other external server. MD Preview has no backend, account system, advertising, analytics, or telemetry.

## Information stored locally

The extension stores the most recent file URL or file/folder handle, the document path, and reading position in the browser's local IndexedDB. It stores reading preferences, such as theme and text size, in localStorage. It does not persist document bodies in extension storage. These settings do not use browser sync or cloud storage.

Rendered content and temporary image URLs exist in memory while a document is open. The extension reads files only; it does not edit or delete the source documents.

## Network and clipboard behavior

The extension does not request HTTP/HTTPS host permissions. Its content security policy permits local file reads while blocking HTTP/HTTPS connections, WebSockets, remote scripts, remote fonts, and remote images. All rendering libraries are included in the extension package.

External links in Markdown are not opened by the reader. If you click one, the extension can copy that URL to your clipboard in response to your action. It does not read your clipboard. HTML preview navigation is disabled.

## Your controls

- Use **Reading settings → Close and forget location** (「阅读设置 → 关闭并忘记位置」) to remove the saved file location.
- Revoke file URL access in the browser's extension details to stop automatic local-file previews.
- Revoke folder permissions through browser settings, or remove the extension to remove its browser-managed local data and permissions.

## Support and changes

If you choose to submit a GitHub issue, the information you provide is handled by GitHub and is separate from extension operation. Avoid including private documents in public issues.

Policy updates will be reflected in this document with a new revision date. Project contact: [MD Preview issue tracker](https://github.com/ketchupz1999/md-preview-extension/issues).

---

## 中文说明

MD Preview 仅在浏览器中读取、解析和展示你打开的本地文件、目录以及支持的本地图片和样式。文档不会上传给开发者或任何外部服务，扩展没有后端、账号、广告、分析统计或遥测。

浏览器本地保存最近的文件/目录引用、阅读位置和阅读偏好，不持久缓存文档正文，也不使用浏览器同步。源文件始终只读。

阅读器禁用 HTTP/HTTPS 连接及远程脚本、字体和图片。点击 Markdown 外部链接时，只会根据你的操作复制地址，不会读取剪贴板内容或自动打开网站。

你可以在阅读设置中关闭并忘记位置，在扩展详情中撤销文件网址权限，或移除扩展。主动提交 GitHub issue 属于你与 GitHub 的交互，与扩展运行时的数据处理无关。
