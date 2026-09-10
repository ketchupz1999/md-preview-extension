<p align="center"><img src="docs/brand/banner.png" alt="MD Preview — 纯本地 Markdown 预览" width="100%"></p>

<p align="center"><a href="README.md">English</a> · <a href="https://github.com/ketchupz1999/md-preview-extension/releases/latest">下载</a> · <a href="docs/PRIVACY.md">隐私说明</a></p>

# MD Preview

在 Chrome 和 Edge 中预览本地 Markdown，支持大纲、文件树、代码高亮和 Mermaid 图表。所有内容都在本机处理。

界面使用简体中文，文档可以包含任意语言。

![Markdown 阅读界面](docs/chrome-store/assets/01-reading-1280x800.png)

## 功能

- **自动预览**：开启文件网址权限后，用浏览器打开本地 Markdown 即可阅读。
- **文档导航**：大纲定位、独立文件树与文件名搜索。
- **清晰排版**：表格、任务列表、代码高亮，以及 Mermaid 时序图、流程图、状态图和 ER 图。
- **灵活布局**：正文随浏览器缩放铺满阅读区，宽表格在自身区域内滚动，图表可以放大查看。
- **阅读工具**：深浅主题、源码视图、文字大小、自动刷新和阅读位置恢复。
- **相关文件**：HTML 静态预览可加载支持的本地样式和图片，CSS 文件支持高亮与色值预览。

<details><summary>文件树、图表、深色主题与 HTML 预览</summary>

![文件树](docs/chrome-store/assets/02-files-1280x800.png)
![Mermaid 图表](docs/chrome-store/assets/03-mermaid-1280x800.png)
![深色主题](docs/chrome-store/assets/04-dark-1280x800.png)
![HTML 静态预览](docs/chrome-store/assets/05-html-1280x800.png)

</details>

## 安装

1. 从 [Releases](https://github.com/ketchupz1999/md-preview-extension/releases/latest) 下载 ZIP，解压到固定目录。
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择包含 `manifest.json` 的目录。
4. 进入扩展「详情」，开启 **允许访问文件网址**。
5. 用浏览器打开本地 `.md` 文件，或点击扩展图标选择文件或文件夹。

更新手动安装的版本时，替换同一目录中的文件，再到扩展页点击「重新加载」。[`examples/`](examples) 提供可以直接打开的示例文档。

| 快捷键 | 操作 |
| --- | --- |
| `⌘ / Ctrl + K` | 搜索文件 |
| `⌘ / Ctrl + B` | 切换侧栏 |
| `Esc` | 关闭放大的图表 |

## 隐私

文件始终只读。扩展没有后端、账号、广告、分析统计或遥测；渲染库随安装包提供，阅读器阻止远程连接、脚本、图片和字体。

浏览器在本地保存最近的文件或目录引用、阅读位置和偏好，不持久缓存或上传文档正文。详情见[隐私说明](docs/PRIVACY.md)。

## 支持范围

面向桌面 Chrome 和 Edge 121 及以上版本。支持 `.md`、`.markdown`、`.mdown`、`.mkd`、`.mdx`。MDX 组件与 Markdown 中的原始 HTML 不执行。HTML 仅支持静态展示；在线文档、交互脚本、独立 SVG 和数学公式不在支持范围内。

## 开发

需要 Node.js 22.12+。安装依赖需要网络，扩展运行不需要。

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run test:files
npm run test:html
npm run package
```

开发时加载 `dist/`，安装包输出到 `release/`。详情见[开发文档](docs/DEVELOPMENT.md)和[商店材料](docs/chrome-store/README.md)。

欢迎通过 [Issues](https://github.com/ketchupz1999/md-preview-extension/issues) 反馈问题或提出改进。

## 许可

[MIT](LICENSE)。安装包包含第三方依赖的许可说明。
