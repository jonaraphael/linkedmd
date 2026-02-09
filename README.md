# LinkedIn -> Markdown (Bookmarklet + Userscript)

Local-only exporter for logged-in LinkedIn profile pages (`/in/...`).

- Bookmarklet: one-click export from bookmarks bar.
- Userscript fallback: persistent `Export MD` button in LinkedIn pages.
- No backend and no external JS libraries in the exporter payload.
- Dense profile output: expands sections, fetches `/details/*` pages (experience, education, skills, etc.), and stitches one `.md`.

## Repo layout

```text
.
├─ src/
│  └─ li_export_md.js
├─ tools/
│  ├─ build_bookmarklet.py
│  └─ build_userscript.py
├─ userscript/
│  └─ linkedin-export-md.user.js
└─ docs/
   └─ index.html
```

## Build everything

```bash
npm run build
```

This keeps both delivery paths in sync:
- regenerates `/Users/jonathanraphael/git/linkedmd/userscript/linkedin-export-md.user.js` from `/Users/jonathanraphael/git/linkedmd/src/li_export_md.js`
- regenerates bookmarklet assets in `/Users/jonathanraphael/git/linkedmd/docs/`

## Build the bookmarklet URL

```bash
npm run build:bookmarklet
```

This command:
- reads `/Users/jonathanraphael/git/linkedmd/src/li_export_md.js`
- writes `/Users/jonathanraphael/git/linkedmd/docs/bookmarklet.txt`
- injects the generated `javascript:...` URL into `/Users/jonathanraphael/git/linkedmd/docs/index.html`

## Local preview for GitHub Pages content

```bash
npm run dev
```

Then open [http://localhost:8787](http://localhost:8787).

## Publish on GitHub Pages

1. Run `npm run build:bookmarklet`.
2. Commit `docs/index.html` and `docs/bookmarklet.txt`.
3. In GitHub Settings -> Pages, deploy from branch and set folder to `/docs`.

## Userscript fallback

Install `/Users/jonathanraphael/git/linkedmd/userscript/linkedin-export-md.user.js` in Tampermonkey.

When `/Users/jonathanraphael/git/linkedmd/src/li_export_md.js` changes, run:

```bash
npm run build:userscript
```

The userscript is generated from `/Users/jonathanraphael/git/linkedmd/src/li_export_md.js` and adds an `Export MD` button on LinkedIn pages.

For Arc specifically, userscript is the recommended path because bookmarklet UX is less consistent than Chrome's traditional bookmarks bar.

## Notes

- Export only content you are authorized to access.
- LinkedIn DOM changes can require heuristic updates.
- Bookmarklet length limits can vary by browser; userscript is the robust fallback.
- Performance defaults: details sections are fetch-parsed in parallel first for speed, then helper-tab scraping runs only for sections still missing after validation (`parallelFastFetchFirst: true`, `useHelperFallback: true` in `/Users/jonathanraphael/git/linkedmd/src/li_export_md.js`).
