# LinkedMD

Export a logged-in LinkedIn profile into one clean Markdown file in one click.

No backend. No accounts. No API keys. Just local browser execution.

## Why this exists

LinkedIn has great profile data but poor export ergonomics for writing workflows.

`LinkedMD` gives you a local exporter that:
- expands profile content (including About and details pages)
- strips obvious UI noise (ads/suggestions/navigation)
- stitches profile sections into a single `.md`
- works through either a bookmarklet or Tampermonkey userscript

## 60-second setup

```bash
npm run build
```

Then:
1. Open `docs/index.html` (or publish `docs/` to GitHub Pages).
2. Install one of the two pathways below.
3. Open any LinkedIn profile URL (`https://www.linkedin.com/in/...`).
4. Run export.

You get a downloaded `.md` file and clipboard best-effort copy.

## Two pathways, one engine

Both pathways are generated from the same source file: `src/li_export_md.js`.

- Bookmarklet
  - Generated URL: `docs/bookmarklet.txt`
  - Install via drag/drop from `docs/index.html`
- Userscript
  - Generated script: `userscript/linkedin-export-md.user.js`
  - Install in Tampermonkey

### Arc browser copy/paste path

If drag-and-drop feels awkward in Arc:
1. Open `docs/index.html`.
2. Click **Copy bookmarklet URL**.
3. Create any saved link/favorite in Arc.
4. Paste the copied `javascript:...` URL as the address.

## Guarantees (repo hygiene)

- Single source of truth: `src/li_export_md.js`
- Generated artifacts only:
  - `userscript/linkedin-export-md.user.js`
  - `docs/bookmarklet.txt`
- Equivalence check built in:
  - `npm run verify`
  - fails if generated artifacts drift from source

## Project layout

```text
.
├─ src/
│  └─ li_export_md.js            # exporter engine (source of truth)
├─ tools/
│  ├─ build_bookmarklet.py       # builds docs/bookmarklet.txt
│  ├─ build_userscript.py        # builds userscript file
│  └─ verify_artifacts.py        # enforces artifact equivalence
├─ userscript/
│  └─ linkedin-export-md.user.js # generated
└─ docs/
   ├─ index.html                 # GitHub Pages installer UI
   └─ bookmarklet.txt            # generated
```

## Commands

```bash
npm run build      # regenerate userscript + bookmarklet + verify
npm run verify     # assert generated files match source
npm run check      # syntax + py_compile + verify
npm run dev        # serve docs/ at http://localhost:8787
```

## Publish to GitHub Pages

1. Run `npm run build`.
2. Commit updated generated files.
3. In GitHub repo settings, enable Pages from `/docs`.
4. Share the Pages URL.

## Limitations

- LinkedIn DOM changes can require heuristic updates.
- Some browsers place limits on bookmarklet URL length.
- This is for personal, manual export from pages you can already access.

## License

MIT (`LICENSE`).
