# Chrome Web Store release materials

Product: **MD Preview** · Package version: **0.4.0**

The GitHub repository is intentionally private for owner review. This directory prepares the listing; it does not mean that a store item has been submitted or published.

## Upload files

| Purpose | File | Format |
| --- | --- | --- |
| Extension package | `release/md-preview-0.4.0.zip` at the repository root | ZIP; manifest at archive root |
| Extension / store icon | `assets/icon-128.png` | 128×128 PNG, 96×96 artwork with transparent padding |
| Required promotional tile | `assets/promo-small-440x280.png` | 440×280 RGB PNG |
| Optional marquee | `assets/promo-marquee-1400x560.png` | 1400×560 RGB PNG |
| Reading screenshot | `assets/01-reading-1280x800.png` | 1280×800 RGB PNG |
| File explorer screenshot | `assets/02-files-1280x800.png` | 1280×800 RGB PNG |
| Mermaid screenshot | `assets/03-mermaid-1280x800.png` | 1280×800 RGB PNG |
| Dark theme screenshot | `assets/04-dark-1280x800.png` | 1280×800 RGB PNG |
| HTML preview screenshot | `assets/05-html-1280x800.png` | 1280×800 RGB PNG |

All screenshots come from the actual extension using the repository's demonstration documents. They contain no personal or business documents. Brand SVG sources are included alongside the exported assets.

## Listing information

- Name: **MD Preview**
- Primary listing language: **简体中文** (the current application interface language)
- Category: **Tools / 工具**, choosing the corresponding current dashboard category
- Short description: **纯本地 Markdown 自动预览，支持大纲、文件树、Mermaid 图表和 HTML 静态预览。**
- Detailed descriptions: [简体中文](listing.zh-CN.md) · [English](listing.en.md)
- Single-purpose, permission, and reviewer notes: [Review notes](review-notes.md)
- Privacy policy: [`docs/PRIVACY.md`](../PRIVACY.md)

After the owner makes the repository public, these URLs can be used:

- Website: https://github.com/ketchupz1999/md-preview-extension
- Support: https://github.com/ketchupz1999/md-preview-extension/issues
- Privacy: https://github.com/ketchupz1999/md-preview-extension/blob/main/docs/PRIVACY.md

The private repository's URLs are not publicly accessible and must not be treated as live public support/privacy pages before that visibility change.

## Account and submission steps

The publisher must have a registered Chrome Web Store developer account. Registration requires Google's developer agreement and a one-time registration fee. Publisher identity, contact information, legal attestations, and any payment must use the owner's actual information.

Upload the ZIP, fill in Store listing, Privacy, Distribution, and Test instructions, then submit for review when the owner is ready to publish. A successful upload creates a draft; approval and publication are separate states. No account information, payment method, or publisher declarations are invented in this repository.

## Recreate assets

```sh
npm run build
npm run assets:brand
npx playwright install chromium
npm run assets:screenshots
npm run package
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium executable. These commands generate images locally. The screenshot script checks for 1280×800 RGB output and rejects external requests.

## Official references

- [Image requirements](https://developer.chrome.com/docs/webstore/images)
- [Developer registration](https://developer.chrome.com/docs/webstore/register)
- [First publication workflow](https://developer.chrome.com/docs/webstore/publish)
- [File URL permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
