# LinkedMD Chrome Web Store Submission Pack

Use this file as direct copy/paste for the Chrome Web Store form.

## Product details

### For all languages
- Title from package: `LinkedMD`
- Summary from package: `Export the current LinkedIn profile page to Markdown.`

### Description
LinkedMD exports the current LinkedIn profile page to a clean, structured Markdown file in one click.

If your workflow involves recruiting, research, investing, sales, or knowledge management, profile data is often locked inside UI. LinkedMD makes that data portable and reusable in docs, notes, and AI workflows.

What LinkedMD does:
- Exports the current profile page as a local `.md` file
- Captures profile sections such as About, Experience, Education, Skills, Publications, Languages, Interests, and related details pages when available
- Adds frontmatter metadata (`source`, `exported_at`, `title`) for traceability
- Filters common UI noise so output is profile-focused

Why users install it:
- Faster profile note-taking and diligence
- Better source material for AI summarization and internal docs
- Markdown-native output for Obsidian, Notion imports, wikis, and Git repos
- Local-first operation with no account requirement in this project

Important notes:
- Export quality depends on LinkedIn page structure, which can change
- Use LinkedMD only for data you are authorized to access and process
- LinkedMD is for manual profile export workflows, not bulk scraping automation

### Category
Developer Tools

### Language
English

## Graphic assets

### Store icon (128x128)
`/Users/jonathanraphael/git/linkedmd/store-assets/store-icon-128.png`

### Global promo video (YouTube URL)
Leave blank for initial launch. Add later when you have a short demo video.

### Screenshots (up to 5, 1280x800 PNG)
1. `/Users/jonathanraphael/git/linkedmd/store-assets/screenshots/01-one-click-export.png`
2. `/Users/jonathanraphael/git/linkedmd/store-assets/screenshots/02-profile-to-markdown.png`
3. `/Users/jonathanraphael/git/linkedmd/store-assets/screenshots/03-popup-experience.png`
4. `/Users/jonathanraphael/git/linkedmd/store-assets/screenshots/04-local-only-security.png`
5. `/Users/jonathanraphael/git/linkedmd/store-assets/screenshots/05-section-coverage.png`

### Small promo tile (440x280)
`/Users/jonathanraphael/git/linkedmd/store-assets/small-promo-440x280.png`

### Marquee promo tile (1400x560)
`/Users/jonathanraphael/git/linkedmd/store-assets/marquee-promo-1400x560.png`

## Additional fields

### Official URL
None (unless you have verified site ownership in Search Console)

### Homepage URL
`https://github.com/jonaraphael/linkedmd`

### Support URL
`https://github.com/jonaraphael/linkedmd/issues`

### Privacy policy URL
`https://jonaraphael.github.io/linkedmd/privacy.html` (after enabling GitHub Pages)

### Mature content
No

### Item support
On

### Visibility
Public (recommended when launch-ready)

## Privacy practices tab (paste-ready text)

### Single purpose description (paste into "Single purpose description")
LinkedMD has one purpose: export the currently open LinkedIn profile page into a local Markdown (.md) file. It reads profile content the user can already view, formats that content into structured Markdown, and downloads the file on the user’s device. It does not provide unrelated features.

### `activeTab` justification
`activeTab` is used so export runs only on the tab the user explicitly triggers from the LinkedMD popup or command. This limits execution to a user-initiated action on the current page.

### `scripting` justification
`scripting` is required to execute the packaged export logic in the active LinkedIn page context and produce the Markdown output when the user clicks Export.

### `tabs` justification
`tabs` is used to identify the active browser tab and target the export request to that tab. It is not used for background browsing history collection.

### `contextMenus` justification
`contextMenus` is used to provide an optional right-click menu action ("Export LinkedIn profile to Markdown") so users can trigger export from the current page.

### Host permission justification
Host access is restricted to `https://www.linkedin.com/*` because LinkedMD only works on LinkedIn profile pages. This permission is required to read on-page profile content and convert it into a Markdown file.

### Remote code selection
Select: `No, I am not using Remote code`

### Remote code justification
LinkedMD does not use remote code. All JavaScript executed by the extension is bundled in the extension package submitted to the Chrome Web Store. No external scripts, remote modules, `eval`, or remotely hosted Wasm are used.

### Data usage selection
If the extension does not send profile data to any server, leave all data categories unchecked.

### Data usage certifications (must all be checked)
- I do not sell or transfer user data to third parties, outside of approved use cases.
- I do not use or transfer user data for purposes unrelated to the item’s single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.
