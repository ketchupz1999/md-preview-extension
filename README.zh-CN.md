<p align="center"><img src="docs/brand/banner.png" alt="MD Preview — 纯本地 Markdown 预览" width="100%"></p>

<p align="center"><a href="README.md">English</a> · <a href="https://github.com/ketchupz1999/md-preview-extension/releases/latest">下载安装包</a> · <a href="docs/PRIVACY.md">隐私说明</a></p>

# MD Preview

在 Chrome / Edge 中直接预览本地 Markdown。打开 `.md` 文件，正文、大纲、文件目录和 Mermaid 图表就绪，所有内容都在本机处理。

Chrome 商店版本正在准备，目前可以通过 Release 安装包加载使用。

## 主要功能

- **打开即读**：开启文件网址权限后，自动接管本地 Markdown。
- **专注内容**：窄侧栏默认显示大纲，文件树和搜索放在独立 Tab。
- **看清结构**：支持表格、任务列表、代码高亮、Mermaid 时序图与流程图，图表可放大查看。
- **纯本地运行**：只读文件，依赖随扩展打包，无账号、无统计上报，阅读器不发起 HTTP/HTTPS 请求。
- **接上日常工作**：深浅主题、源码视图、字号调整、自动刷新与阅读位置恢复；相关 HTML 笔记支持静态预览，CSS 文件支持色值预览。

![Markdown 阅读界面](docs/screenshots/reader.png)

<details><summary>查看图表、文件树、深色主题与 HTML 预览</summary>

![Mermaid 图表](docs/chrome-store/assets/03-mermaid-1280x800.png)
![文件树](docs/chrome-store/assets/02-files-1280x800.png)
![深色主题](docs/chrome-store/assets/04-dark-1280x800.png)
![HTML 静态预览](docs/screenshots/html-preview.png)

</details>

## 安装

1. 从 [Releases](https://github.com/ketchupz1999/md-preview-extension/releases/latest) 下载 `md-preview-*.zip` 并解压。
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`），开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择包含 `manifest.json` 的解压目录。
4. 进入扩展「详情」，开启 **允许访问文件网址**。
5. 用浏览器打开本地 Markdown，或刷新已经打开的 `.md` 页面。

也可以点击扩展图标，使用左上角的小图标打开文件或文件夹。更新时替换原扩展目录中的文件，再点击「重新加载」，可保持原有的扩展位置。

[`examples/`](examples) 提供可直接打开的示例文档。`⌘ / Ctrl + K` 搜索文件，`⌘ / Ctrl + B` 收起侧栏，`Esc` 关闭图表预览。

## 本地读取与隐私

扩展只申请 `file:///*`，不申请网站访问权限。网络连接与远程资源由浏览器内容安全策略阻止。Markdown 中的原始 HTML 作为文字呈现；HTML 文件先清理再放入沙盒，脚本、导航、表单和远程资源被停用。

浏览器仅在本地保存最近的文件或目录引用、阅读位置和偏好，不缓存文档正文，也不会将文档发送给开发者。详情见[隐私说明](docs/PRIVACY.md)和[实现边界](docs/DEVELOPMENT.md)。

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

加载 `dist/` 进行开发，发行包输出到 `release/`。[开发文档](docs/DEVELOPMENT.md)包含结构、限制和验证方式；[商店上架材料](docs/chrome-store/README.md)包含介绍、审核说明和图片。

欢迎通过 [Issues](https://github.com/ketchupz1999/md-preview-extension/issues) 反馈问题或提交小范围改进。

## 许可

[MIT](LICENSE)。扩展包包含第三方依赖的完整许可说明。
