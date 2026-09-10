# Chrome Web Store release materials

Product: **MD Preview** · Package version: **0.4.1**

The GitHub repository is public. The Chrome Web Store item is still a draft; the materials here do not imply review approval or store publication.

## Upload files

| Purpose | File | Format |
| --- | --- | --- |
| Extension package | `release/md-preview-0.4.1.zip` at the repository root | ZIP; manifest at archive root |
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
- Description and review copy: **English**. The listing states that the extension interface is currently in Simplified Chinese.
- Dashboard Language: **Chinese (China)**, reflecting the current interface. Writing English descriptions does not add an English interface.
- Category: **Tools / 工具**, choosing the corresponding current dashboard category
- Short description (from package): **Preview local Markdown with an outline, file explorer, Mermaid diagrams and static HTML previews. All processing stays on-device.**
- Detailed description: copy [English](listing.en.md) into **Store listing → Description**. A [Chinese translation](listing.zh-CN.md) is also available.
- Single-purpose, permission, and reviewer notes: [Review notes](review-notes.md)
- Privacy policy: [`docs/PRIVACY.md`](../PRIVACY.md)

Public URLs for the dashboard:

- Website: https://github.com/ketchupz1999/md-preview-extension
- Support: https://github.com/ketchupz1999/md-preview-extension/issues
- Privacy: https://github.com/ketchupz1999/md-preview-extension/blob/main/docs/PRIVACY.md

Keep **Official URL** set to None unless site ownership has been verified. The homepage, support, and privacy fields can use the URLs above.

## Apply the English metadata update

1. In the existing item, open **Package → Upload new package** and upload `md-preview-0.4.1.zip`. Its English manifest description replaces the Chinese **Summary from package**. Keep the same store item and extension ID.
2. Replace **Store listing → Description** with the English listing text. Category remains **Tools**; the interface language remains **Chinese (China)**.
3. Replace **Privacy → Single purpose description** with the Single purpose paragraph in [review notes](review-notes.md). Keep remote code set to **No**; its disabled justification field stays empty.
4. Complete data disclosures and certifications according to the Data handling section of the review notes, and set the public privacy policy URL.
5. Use the **Test instructions** section of the review notes if the dashboard asks for reviewer instructions. No credentials are needed.
6. Save the draft. Resolve any remaining account requirements before submitting for review.

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
