// ==UserScript==
// @name         LinkedIn -> Markdown Export (local-only)
// @namespace    local
// @version      1.0
// @description  Adds an "Export MD" button on LinkedIn profile pages; downloads dense markdown export.
// @match        https://www.linkedin.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const BTN_ID = "li-export-md-userscript-btn";

  function buildExporter() {
    "use strict";
  
    const CFG = {
      keepImages: false,
      keepLinks: false,
      clickPauseMs: 90,
      expandRoundsPerSection: 6,
      scrollPauseMs: 160,
      maxScrollSteps: 35,
      fetchTimeoutMs: 7000,
      detailsNavTimeoutMs: 7000,
      detailsOnlySections: true,
      deepExpandMain: false,
      preferLiveSectionScrape: false,
      useHelperFallback: true,
      parallelFastFetchFirst: true,
      helperNodeWaitMs: 2200,
      helperExpandRounds: 2,
    };
  
    const SECTIONS = [
      { title: "About", kind: "main" },
      { title: "Experience", kind: "details", paths: ["details/experience/"] },
      { title: "Education", kind: "details", paths: ["details/education/"] },
      {
        title: "Licenses & certifications",
        kind: "details",
        paths: ["details/certifications/"],
      },
      { title: "Skills", kind: "details", paths: ["details/skills/"] },
      { title: "Recommendations", kind: "details", paths: ["details/recommendations/"] },
      { title: "Courses", kind: "details", paths: ["details/courses/"] },
      { title: "Languages", kind: "details", paths: ["details/languages/"] },
      { title: "Publications", kind: "details", paths: ["details/publications/"] },
      { title: "Interests", kind: "details", paths: ["details/interests/"] },
    ];
  
    const MAIN_EXPAND_FIRST = [
      "About",
      "Experience",
      "Education",
      "Licenses & certifications",
      "Skills",
      "Recommendations",
      "Courses",
      "Languages",
      "Publications",
      "Interests",
    ];
  
    const DETAIL_ITEM_SELECTORS = [
      "li.pvs-list__paged-list-item",
      "li.pvs-list__item--line-separated",
      ".pvs-list > li",
      "ul.artdeco-list > li",
      "[data-view-name*='profile-component-entity']",
      ".pvs-entity",
    ];
  
    const SECTION_URL_TOKENS = {
      About: ["about"],
      Experience: ["experience"],
      Education: ["education"],
      "Licenses & certifications": ["certifications", "licenses", "license"],
      Skills: ["skills"],
      Recommendations: ["recommendations"],
      Courses: ["courses"],
      Languages: ["languages"],
      Publications: ["publications"],
      Interests: ["interests"],
    };
  
    const UNRELATED_PANEL_RE = [
      /more profiles for you/i,
      /people also viewed/i,
      /suggested for you/i,
      /you may also know/i,
      /similar profiles/i,
      /recommended for you/i,
      /profiles for you/i,
      /ad options/i,
      /why am i seeing this ad/i,
    ];
  
    function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }
  
    function norm(s) {
      return (s || "")
        .toLowerCase()
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  
    function cleanInline(s) {
      return (s || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  
    function sanitizeFilename(s) {
      const t = (s || "linkedin-profile")
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      return t || "linkedin-profile";
    }
  
    function downloadText(filename, text) {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 700);
    }
  
    function getProfileBasePath() {
      const m = location.pathname.match(/^\/in\/[^/]+\/?/);
      if (m && m[0]) return m[0].endsWith("/") ? m[0] : m[0] + "/";
  
      const canon = document.querySelector("link[rel='canonical']");
      if (canon && canon.href) {
        try {
          const u = new URL(canon.href);
          const mm = u.pathname.match(/^\/in\/[^/]+\/?/);
          if (mm && mm[0]) return mm[0].endsWith("/") ? mm[0] : mm[0] + "/";
        } catch (_) {}
      }
      return "/in/";
    }
  
    function isProfileRootPath(pathname) {
      return /^\/in\/[^/]+\/?$/.test(String(pathname || ""));
    }
  
    function normalizePath(pathname) {
      return String(pathname || "")
        .replace(/[?#].*$/, "")
        .replace(/\/+$/, "")
        .trim();
    }
  
    function isExactProfileBasePath(pathname, basePath) {
      return normalizePath(pathname) === normalizePath(basePath);
    }
  
    function isLikelyJunkMetaText(text) {
      const t = cleanInline(text || "");
      if (!t) return true;
      if (/function\s+[a-z0-9_]+\s*\(/i.test(t)) return true;
      if (/addEventListener\s*\(/i.test(t)) return true;
      if (/__como_rehydration__|proto\.sdui|window\.__|initialPath:/i.test(t)) return true;
      if (/skip to main content|linkedin corporation|ad options/i.test(t)) return true;
      if ((t.match(/[{}[\]]/g) || []).length >= 4) return true;
      if ((t.match(/[=:;]/g) || []).length >= 6) return true;
      return false;
    }
  
    function cleanMetaCandidate(text, maxLen) {
      const t = cleanInline(text || "");
      if (!t) return "";
      if (t.length > (maxLen || 160)) return "";
      if (isLikelyJunkMetaText(t)) return "";
      return t;
    }
  
    function fallbackNameFromPath(pathname) {
      const m = String(pathname || "").match(/^\/in\/([^/]+)/);
      if (!m || !m[1]) return "";
      const raw = decodeURIComponent(m[1]).replace(/[-_]+/g, " ").trim();
      return cleanMetaCandidate(raw, 100);
    }
  
    function looksLikeProfileHomeMain(main) {
      if (!main || !main.querySelector) return false;
      const h1 = main.querySelector("h1");
      const h1Text = cleanMetaCandidate((h1 && (h1.innerText || h1.textContent || "")) || "", 120);
      if (!h1Text) return false;
      if (main.querySelectorAll("section").length < 1) return false;
      return true;
    }
  
    function findSectionByHeading(main, headingText) {
      const wanted = norm(headingText);
      const headings = main.querySelectorAll("h2, h3");
      for (const h of headings) {
        const txt = norm(h.innerText || h.textContent || "");
        if (txt === wanted) return h.closest("section") || h.closest("div") || null;
      }
      return null;
    }
  
    function getSectionContainer(main, sectionTitle) {
      return findSectionByHeading(main, sectionTitle);
    }
  
    function extractAboutFromExpandableTextBox(main) {
      if (!main || !main.querySelectorAll) return "";
  
      const firstSpan = main.querySelector("span[data-testid='expandable-text-box']");
      if (!firstSpan) return "";
  
      const text = cleanInline(firstSpan.innerText || firstSpan.textContent || "");
      return text ? compactMarkdown(text) : "";
    }
  
    function findSectionByHeadingLoose(main, headingText) {
      const wanted = norm(headingText);
      const headings = main.querySelectorAll("h1, h2, h3");
      for (const h of headings) {
        const txt = norm(h.innerText || h.textContent || "");
        if (!txt) continue;
        if (txt === wanted || txt.includes(wanted) || wanted.includes(txt)) {
          return h.closest("section") || h.closest("div") || null;
        }
      }
      return null;
    }
  
    function buttonLooksLikeExpander(btn) {
      if (!btn || btn.disabled) return false;
  
      const txt = norm(btn.innerText || btn.textContent || "");
      const aria = norm(btn.getAttribute("aria-label") || "");
      const expanded = btn.getAttribute("aria-expanded");
  
      if (expanded === "false") return true;
  
      const good =
        /\b(see|show)\s+more\b/i.test(txt) ||
        txt.includes("\u2026see more") ||
        txt === "more" ||
        /\b(see|show)\s+more\b/i.test(aria);
  
      if (!good) return false;
  
      const bad =
        txt === "connect" ||
        txt === "message" ||
        txt === "follow" ||
        txt === "subscribe" ||
        txt === "show all" ||
        txt === "see all" ||
        aria.includes("connect") ||
        aria.includes("message") ||
        aria.includes("follow") ||
        aria.includes("show all") ||
        aria.includes("see all");
  
      return !bad;
    }
  
    function anchorLooksLikeExpander(a) {
      if (!a) return false;
      const txt = norm(a.innerText || a.textContent || "");
      const aria = norm(a.getAttribute("aria-label") || "");
      const role = norm(a.getAttribute("role") || "");
      const href = (a.getAttribute("href") || "").trim();
  
      const good =
        /\b(see|show)\s+more\b/i.test(txt) ||
        txt === "more" ||
        txt.includes("\u2026see more") ||
        /\b(see|show)\s+more\b/i.test(aria);
      if (!good) return false;
  
      const bad =
        txt === "connect" ||
        txt === "message" ||
        txt === "follow" ||
        txt === "subscribe" ||
        txt === "show all" ||
        txt === "see all" ||
        aria.includes("show all") ||
        aria.includes("see all");
      if (bad) return false;
  
      const safeHref = !href || href === "#" || href.startsWith("javascript:");
      return safeHref || role === "button";
    }
  
    function collectExpanders(root) {
      if (!root || !root.querySelectorAll) return [];
      const out = [];
      const seen = new Set();
      for (const b of Array.from(root.querySelectorAll("button"))) {
        if (!buttonLooksLikeExpander(b)) continue;
        if (seen.has(b)) continue;
        seen.add(b);
        out.push(b);
      }
      for (const a of Array.from(root.querySelectorAll("a, [role='button']"))) {
        if (!anchorLooksLikeExpander(a)) continue;
        if (seen.has(a)) continue;
        seen.add(a);
        out.push(a);
      }
      return out;
    }
  
    async function expandInSection(sectionEl) {
      if (!sectionEl) return;
  
      for (let round = 0; round < CFG.expandRoundsPerSection; round++) {
        let clicked = 0;
        const targets = collectExpanders(sectionEl);
  
        for (const el of targets) {
          const r = el.getBoundingClientRect();
          const visible = r.width > 0 && r.height > 0 && r.bottom >= 0 && r.top <= window.innerHeight;
          if (!visible) continue;
  
          try {
            el.click();
            clicked++;
          } catch (_) {}
          await sleep(CFG.clickPauseMs);
        }
  
        if (clicked === 0) break;
        await sleep(200);
      }
    }
  
    async function scrollToLoad() {
      const step = Math.max(350, Math.floor(window.innerHeight * 0.8));
      for (let i = 0; i < CFG.maxScrollSteps; i++) {
        window.scrollBy(0, step);
        await sleep(CFG.scrollPauseMs);
        const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
        if (atBottom) break;
      }
      window.scrollTo(0, 0);
      await sleep(180);
    }
  
    async function expandMainSectionsFirst(main) {
      await scrollToLoad();
  
      for (const title of MAIN_EXPAND_FIRST) {
        const sec = findSectionByHeading(main, title);
        if (!sec) continue;
  
        try {
          sec.scrollIntoView({ block: "center" });
        } catch (_) {}
        await sleep(220);
  
        await expandInSection(sec);
      }
  
      window.scrollTo(0, 0);
      await sleep(160);
    }
  
    async function prepareMainForExport(main) {
      if (CFG.deepExpandMain) {
        await expandMainSectionsFirst(main);
        return;
      }
  
      const aboutSpan =
        main && main.querySelector ? main.querySelector("span[data-testid='expandable-text-box']") : null;
      const aboutSec = (aboutSpan && aboutSpan.closest("section, article, div")) || null;
      if (aboutSec) {
        try {
          aboutSec.scrollIntoView({ block: "center" });
        } catch (_) {}
        await sleep(160);
        await expandInSection(aboutSec);
      }
  
      window.scrollTo(0, 0);
      await sleep(80);
    }
  
    function getProfileTopMeta(main) {
      const doc = (main && main.ownerDocument) || document;
      const docPath = (doc.location && doc.location.pathname) || location.pathname;
      const docTitle = (doc && doc.title) || document.title || "";
      const h1 = main && main.querySelector ? main.querySelector("h1") : null;
  
      const nameFromH1 = cleanMetaCandidate((h1 && (h1.innerText || h1.textContent || "")) || "", 120);
      const nameFromPath = fallbackNameFromPath(docPath);
      const nameFromTitle = cleanMetaCandidate((docTitle.split("|")[0] || "").trim(), 120);
      const name = nameFromH1 || nameFromPath || nameFromTitle || "LinkedIn Profile";
  
      const card = (h1 && (h1.closest("section") || h1.closest("div"))) || main || doc.body;
      if (!card) return { name, headline: "", location: "" };
  
      const topReject = /contact info|connections?|followers?|ad options|why am i seeing this ad|open to work|talks about|mutual/i;
      function firstUsefulText(root, selectors) {
        for (const sel of selectors) {
          const nodes = Array.from(root.querySelectorAll(sel));
          for (const node of nodes) {
            const txt = cleanMetaCandidate(node.innerText || node.textContent || "", 140);
            if (!txt) continue;
            if (topReject.test(txt)) continue;
            if (txt === name) continue;
            return txt;
          }
        }
        return "";
      }
  
      const directHeadline = firstUsefulText(card, [
        ".text-body-medium.break-words",
        ".text-body-medium",
        ".pv-text-details__left-panel .text-body-medium",
      ]);
      const directLocation = firstUsefulText(card, [
        ".text-body-small.inline.t-black--light.break-words",
        ".text-body-small.inline.t-black--light",
        ".pv-text-details__left-panel .text-body-small",
        "span.text-body-small",
      ]);
  
      let headline = directHeadline || "";
      let location = directLocation || "";
  
      const texts = [];
      const cardTextLines = String(card.innerText || "")
        .split("\n")
        .map((line) => cleanMetaCandidate(line, 220))
        .filter(Boolean);
      for (const line of cardTextLines) {
        texts.push(line);
      }
      for (const el of Array.from(card.querySelectorAll("div, span"))) {
        const t = cleanMetaCandidate(el.innerText || el.textContent || "", 220);
        if (!t) continue;
        texts.push(t);
      }
  
      const noise = [
        /^\u00b7?\s*(1st|2nd|3rd\+?|[0-9]+(?:st|nd|rd|th)\+?)\s*$/i,
        /connections$/i,
        /^contact info$/i,
        /^connect$/i,
        /^message$/i,
        /^follow$/i,
        /^open to work/i,
      ];
  
      const clean = [];
      const seen = new Set();
      for (const t of texts) {
        if (seen.has(t)) continue;
        seen.add(t);
        if (noise.some((re) => re.test(t))) continue;
        if (/contact info|connections?|followers?|ad options|why am i seeing this ad|my network|jobs|messaging|notifications/i.test(t)) continue;
        if (/(^|\s)(1st|2nd|3rd\+?)(\s|$)/i.test(t)) continue;
        if (isLikelyJunkMetaText(t)) continue;
        if (t === name) continue;
        clean.push(t);
      }
  
      for (const t of clean) {
        if (!headline) {
          headline = t;
          continue;
        }
        if (
          !location &&
          t.length < 90 &&
          (/,/.test(t) || /\b(greater|area|region|metro)\b/i.test(t) || /\b[A-Z]{2}(?:\s|$)/.test(t))
        ) {
          location = t;
          break;
        }
      }
  
      if (!location) {
        for (const t of clean) {
          if (t === headline) continue;
          if (t.length < 90 && !/\b(experience|education|skills|followers|connections)\b/i.test(t)) {
            location = t;
            break;
          }
        }
      }
  
      return { name, headline, location };
    }
  
    const DROP_LINE_RE = [
      /^connect$/i,
      /^message$/i,
      /^follow$/i,
      /^subscribe$/i,
      /^show all$/i,
      /^see all$/i,
      /^show more$/i,
      /^see more$/i,
      /^why am i seeing this ad/i,
      /^manage your ad preferences/i,
      /^hide or report this ad/i,
      /^report this ad/i,
      /^tell us why/i,
      /^your feedback/i,
      /^\s*\u00b7\s*$/i,
      /^\s*\u2022\s*$/i,
      /^\s*(1st|2nd|3rd\+?|[0-9]+(?:st|nd|rd|th)\+?)\s*$/i,
    ];
  
    const JUNK_LINE_RE = [
      /window\.__/i,
      /__como_rehydration__/i,
      /proto\.sdui/i,
      /initialPath:/i,
      /initialParams:/i,
      /screenId:/i,
      /skip to main content/i,
      /linkedin corporation/i,
      /accessibility/i,
      /privacy .* terms/i,
      /ad choices/i,
      /select language/i,
      /manage your account and privacy/i,
      /questions\? visit our help center/i,
      /global-nav/i,
      /scaffold-layout__/i,
      /msg-overlay/i,
      /function\s+[a-z0-9_]+/i,
      /addEventListener\(/i,
      /react\./i,
      /serverrequestcontextprovider/i,
      /trackingprovider/i,
      /applicationcontext/i,
      /modelstates:/i,
      /more profiles for you/i,
      /i don.t want to see this ad/i,
      /it.s annoying or not interesting/i,
      /i.ve seen the same ad too often/i,
      /professional community policies/i,
      /show less$/i,
      /people also viewed/i,
      /suggested for you/i,
      /you may also know/i,
      /similar profiles/i,
      /recommended for you/i,
      /profiles for you/i,
    ];
  
    function cleanLines(lines, sectionTitle) {
      const out = [];
      const seen = new Set();
      const sectionNorm = norm(sectionTitle || "");
      const maxLineLen = sectionTitle === "Publications" ? 500 : 220;
  
      for (let raw of lines) {
        let t = (raw || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        if (!t) continue;
        if (sectionNorm && norm(t) === sectionNorm) continue;
  
        if (DROP_LINE_RE.some((re) => re.test(t))) continue;
        if (JUNK_LINE_RE.some((re) => re.test(t))) continue;
        if (t.length > maxLineLen) continue;
        if ((t.match(/[{}[\]]/g) || []).length >= 6) continue;
        if ((t.match(/[:=]/g) || []).length >= 8) continue;
        if ((t.match(/;/g) || []).length >= 4) continue;
  
        if (/^\d[\d,]*\s+followers$/i.test(t)) continue;
        if (/^\d[\d,]*\s+reactions$/i.test(t)) continue;
        if (/^\d[\d,]*\s+comments?$/i.test(t)) continue;
        if (/^\d[\d,]*\s+reposts?$/i.test(t)) continue;
        if (/^home$|^my network$|^jobs$|^messaging$|^notifications$|^for business$/i.test(t)) continue;
        if (/^contact info$/i.test(t)) continue;
  
        if (sectionTitle === "Interests" && /followers$/i.test(t)) continue;
  
        if (sectionTitle === "Skills" && /endorsements?/i.test(t)) continue;
  
        if (/^#\w+/i.test(t)) continue;
        if (/linkedin\.com\/search\/results/i.test(t)) continue;
        if (/^\d+\s+notifications?$/i.test(t)) continue;
        if (/\u00b7\s*(1st|2nd|3rd)\b/i.test(t)) continue;
  
        if (seen.has(t)) continue;
        seen.add(t);
        out.push(t);
      }
  
      return out;
    }
  
    function simplifyDateLine(s) {
      let t = (s || "").trim();
      if (!t) return "";
  
      if (t.includes("\u00b7")) t = t.split("\u00b7")[0].trim();
  
      t = t.replace(/\s-\s/g, " \u2013 ");
  
      return t;
    }
  
    function isDateish(s) {
      const t = (s || "").trim();
      return /\b(19|20)\d{2}\b/.test(t) || /\bPresent\b/i.test(t) || /\bmo\b|\byr\b/i.test(t);
    }
  
    function stripDotSuffix(s) {
      const t = (s || "").trim();
      if (!t) return "";
      return t.includes("\u00b7") ? t.split("\u00b7")[0].trim() : t;
    }
  
    const BLOCK_TAGS = new Set([
      "DIV",
      "SECTION",
      "ARTICLE",
      "MAIN",
      "HEADER",
      "FOOTER",
      "ASIDE",
      "P",
      "UL",
      "OL",
      "LI",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "TABLE",
      "TR",
      "TD",
      "TH",
      "PRE",
      "BLOCKQUOTE",
    ]);
  
    function toLines(root) {
      const lines = [];
      let buf = "";
  
      function flush() {
        const t = buf.replace(/\s+/g, " ").trim();
        if (t) lines.push(t);
        buf = "";
      }
  
      function rec(node) {
        if (!node) return;
  
        if (node.nodeType === 3) {
          buf += node.nodeValue || "";
          return;
        }
        if (node.nodeType !== 1) return;
  
        const tag = node.tagName;
        const cls = node.className ? String(node.className) : "";
        const id = node.id ? String(node.id) : "";
        const aria = node.getAttribute ? String(node.getAttribute("aria-label") || "") : "";
  
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
        if (tag === "NAV" || tag === "HEADER" || tag === "FOOTER" || tag === "ASIDE") return;
  
        if (node.getAttribute && node.getAttribute("aria-hidden") === "true") return;
        if (node.hasAttribute && node.hasAttribute("hidden")) return;
  
        if (
          /global-nav|scaffold-layout__sidebar|scaffold-layout__aside|msg-overlay|artdeco-toast|ad-banner/i.test(
            `${cls} ${id}`
          )
        ) {
          return;
        }
        if (/primary navigation|message overlay|ad options/i.test(aria)) return;
  
        if (!CFG.keepImages && (tag === "IMG" || tag === "SVG")) return;
  
        if (tag === "BR") {
          flush();
          return;
        }
  
        const isBlock = BLOCK_TAGS.has(tag);
        if (isBlock) flush();
  
        for (const ch of Array.from(node.childNodes || [])) rec(ch);
  
        if (isBlock) flush();
      }
  
      rec(root);
      flush();
      return lines;
    }
  
    function compactMarkdown(md) {
      const lines = (md || "").split("\n").map((l) => (l || "").replace(/[ \t]+$/g, ""));
      const out = [];
      let blank = 0;
      for (const l of lines) {
        if (!l.trim()) {
          blank++;
          if (blank > 1) continue;
          out.push("");
        } else {
          blank = 0;
          out.push(l);
        }
      }
      return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    }
  
    function sectionTokens(sectionTitle) {
      return (SECTION_URL_TOKENS[sectionTitle] || []).map((t) => norm(t)).filter(Boolean);
    }
  
    function sectionLooksWrong(sectionTitle, text) {
      const lower = norm(text || "");
      if (!lower) return false;
      if (/more profiles for you|people also viewed|ad options|why am i seeing this ad/i.test(lower)) return true;
      if (/__como_rehydration__|proto\.sdui|window\.__|initialpath:/i.test(lower)) return true;
  
      if (sectionTitle === "Experience") return /\beducation\b/.test(lower) && !/\bexperience\b/.test(lower);
      if (sectionTitle === "Education") return /\bexperience\b/.test(lower) && !/\beducation\b/.test(lower);
      return false;
    }
  
    function looksLikeEntityForSection(sectionTitle, lines) {
      if (!lines || !lines.length) return false;
      const text = norm(lines.join(" "));
  
      if (!text) return false;
      if (sectionLooksWrong(sectionTitle, text)) return false;
  
      if (sectionTitle === "Experience") {
        return (
          /(present|\b(19|20)\d{2}\b|\bmo\b|\byr\b|intern|engineer|manager|director|assistant|consultant|analyst|research|founder|ceo)/i.test(
            text
          ) || lines.length >= 3
        );
      }
  
      if (sectionTitle === "Education") {
        return /(university|college|school|institute|academy|bachelor|master|ph\.?d|degree|mba|bs|ba|ms|ma)/i.test(text);
      }
  
      if (sectionTitle === "Licenses & certifications") {
        return /(cert|license|credential|issued|issuer)/i.test(text) || lines.length <= 5;
      }
  
      if (sectionTitle === "Publications") {
        return (
          /(publication|published|journal|conference|doi|arxiv|isbn|proceedings|vol\.|issue)/i.test(text) ||
          (lines.length >= 1 && text.length >= 18)
        );
      }
  
      if (sectionTitle === "Skills") return lines[0].length <= 90;
      if (sectionTitle === "Languages") return lines[0].length <= 80;
      if (sectionTitle === "Interests") return lines[0].length <= 120;
      if (sectionTitle === "Courses") return lines[0].length <= 150;
  
      return true;
    }
  
    function stripCommonChrome(root) {
      for (const n of Array.from(root.querySelectorAll("script, style, noscript, nav, header, footer, aside, button, svg, path"))) {
        n.remove();
      }
      for (const n of Array.from(root.querySelectorAll("[role='navigation'], [aria-label*='Primary Navigation'], [aria-label*='Ad'], [aria-label*='ad']"))) {
        n.remove();
      }
  
      const candidateSelectors = ["section", "article", "aside", "div", "li"];
      for (const sel of candidateSelectors) {
        for (const node of Array.from(root.querySelectorAll(sel))) {
          const heading = cleanInline(
            (node.querySelector("h1, h2, h3, h4, h5") && node.querySelector("h1, h2, h3, h4, h5").innerText) || ""
          );
          const aria = cleanInline((node.getAttribute && node.getAttribute("aria-label")) || "");
          const preview = cleanInline(String(node.innerText || "").slice(0, 260));
          const signal = `${heading} ${aria} ${preview}`;
          if (!UNRELATED_PANEL_RE.some((re) => re.test(signal))) continue;
          if (node === root) continue;
          node.remove();
        }
      }
    }
  
    function findBestDetailsContainer(main, sectionTitle) {
      const wanted = norm(sectionTitle);
      const tokens = sectionTokens(sectionTitle);
      const sectionNodes = Array.from(main.querySelectorAll("section"));
      if (!sectionNodes.length) return null;
  
      let best = null;
      let bestScore = -Infinity;
  
      for (const sectionNode of sectionNodes) {
        const itemCount = sectionNode.querySelectorAll(DETAIL_ITEM_SELECTORS.join(", ")).length;
        if (!itemCount) continue;
  
        const headingText = cleanInline(
          (sectionNode.querySelector("h1, h2, h3") &&
            sectionNode.querySelector("h1, h2, h3").innerText) ||
            ""
        );
        const preview = cleanInline(String(sectionNode.innerText || "").slice(0, 700));
        const panelSignal = `${headingText} ${preview}`;
        if (UNRELATED_PANEL_RE.some((re) => re.test(panelSignal))) continue;
        let score = itemCount * 8;
  
        const headingNorm = norm(headingText);
        if (headingNorm) {
          if (headingNorm === wanted || headingNorm.includes(wanted) || wanted.includes(headingNorm)) score += 30;
          for (const token of tokens) {
            if (headingNorm.includes(token)) score += 15;
          }
        }
  
        if (sectionLooksWrong(sectionTitle, preview)) score -= 80;
        if (/more profiles for you|people also viewed|ad options/i.test(preview)) score -= 50;
  
        if (sectionTitle === "Publications") {
          if (/(publication|published|journal|conference|doi|arxiv|isbn|proceedings)/i.test(preview)) score += 40;
        }
  
        if (score > bestScore) {
          bestScore = score;
          best = sectionNode;
        }
      }
  
      return best;
    }
  
    function looksLikeSectionMarkdown(sectionTitle, md) {
      const text = String(md || "").trim();
      if (!text) return false;
  
      const lower = text.toLowerCase();
      if (
        lower.includes("__como_rehydration__") ||
        lower.includes("proto.sdui") ||
        lower.includes("window.__") ||
        lower.includes("initialpath:") ||
        lower.includes("skip to main content") ||
        lower.includes("more profiles for you") ||
        lower.includes("i don’t want to see this ad") ||
        lower.includes("i don't want to see this ad")
      ) {
        return false;
      }
  
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const bulletCount = lines.filter((l) => l.startsWith("- ")).length;
      const firstLines = lines.slice(0, 6).map((l) => norm(l.replace(/^- /, "")));
  
      const sectionNames = [
        "about",
        "experience",
        "education",
        "licenses & certifications",
        "skills",
        "recommendations",
        "courses",
        "languages",
        "publications",
        "interests",
      ];
      const wanted = norm(sectionTitle);
      const otherHeadings = sectionNames.filter((s) => s !== wanted);
      if (firstLines.some((l) => otherHeadings.includes(l))) return false;
  
      if (sectionTitle === "About") return text.length >= 40;
      if (sectionTitle === "Recommendations") {
        return bulletCount >= 1 || lines.some((l) => l.startsWith("> "));
      }
  
      if (bulletCount < 1) return false;
      if (sectionLooksWrong(sectionTitle, lower)) return false;
  
      if (sectionTitle === "Education") {
        if (/(^|\n)-\s*experience(\n|$)/i.test(text) && !/(university|college|school|degree|education)/i.test(text)) {
          return false;
        }
        return true;
      }
  
      if (sectionTitle === "Experience") {
        if (/(^|\n)-\s*education(\n|$)/i.test(text) && !/(present|\b(19|20)\d{2}\b|\bmo\b|\byr\b)/i.test(text)) {
          return false;
        }
        return true;
      }
  
      return true;
    }
  
    function hasLikelySectionNodes(doc, sectionTitle) {
      if (!doc || !doc.querySelector) return false;
      const main = doc.querySelector("main") || doc.body;
      if (!main) return false;
  
      if (main.querySelector(DETAIL_ITEM_SELECTORS.join(", "))) {
        return true;
      }
  
      const scoped = findSectionByHeadingLoose(main, sectionTitle);
      if (scoped) {
        const lines = cleanLines(toLines(scoped), sectionTitle);
        if (lines.length >= 1) return true;
      }
  
      const txt = cleanInline(main.innerText || "");
      if (!txt) return false;
      if (txt.length < 250) return false;
      if (/__como_rehydration__|proto\.sdui|window\.__/i.test(txt)) return false;
      return true;
    }
  
    function formatEntity(sectionTitle, rawLines) {
      const lines = cleanLines(rawLines, sectionTitle);
      if (!lines.length) return null;
      if (!looksLikeEntityForSection(sectionTitle, lines)) return null;
  
      if (sectionTitle === "Skills") {
        const skill = lines[0];
        return skill ? `- ${skill}` : null;
      }
  
      if (sectionTitle === "Languages") {
        const lang = lines[0] || "";
        const prof = lines[1] || "";
        return prof ? `- **${lang}** -- ${prof}` : `- ${lang}`;
      }
  
      if (sectionTitle === "Courses") {
        return `- ${lines[0]}`;
      }
  
      if (sectionTitle === "Publications") {
        const title = lines[0] || "";
        const venue = lines[1] || "";
        let date = "";
        for (const l of lines) {
          if (isDateish(l)) {
            date = simplifyDateLine(l);
            break;
          }
        }
        let s = `- **${title}**`;
        if (venue && venue !== title) s += ` -- ${venue}`;
        if (date) s += ` (${date})`;
        return s;
      }
  
      if (sectionTitle === "Education") {
        const school = lines[0] || "";
        let degree = lines[1] || "";
        let date = "";
  
        for (const l of lines) {
          if (isDateish(l)) {
            date = simplifyDateLine(l);
            break;
          }
        }
  
        if (degree && isDateish(degree)) degree = "";
  
        let s = `- **${school}**`;
        if (degree) s += ` -- ${degree}`;
        if (date) s += ` (${date})`;
        return s;
      }
  
      if (sectionTitle === "Licenses & certifications") {
        const cert = lines[0] || "";
        const issuer = stripDotSuffix(lines[1] || "");
        let date = "";
        for (const l of lines) {
          if (isDateish(l)) {
            date = simplifyDateLine(l);
            break;
          }
        }
        let s = `- **${cert}**`;
        if (issuer) s += ` -- ${issuer}`;
        if (date) s += ` (${date})`;
        return s;
      }
  
      if (sectionTitle === "Experience") {
        const title = lines[0] || "";
        const org = stripDotSuffix(lines[1] || "");
  
        let date = "";
        let loc = "";
        const desc = [];
  
        for (let i = 2; i < lines.length; i++) {
          const l = lines[i];
          if (!date && isDateish(l)) {
            date = simplifyDateLine(l);
            continue;
          }
          if (date && !loc && l.length < 90 && !isDateish(l)) {
            loc = l;
            continue;
          }
          desc.push(l);
        }
  
        let s = `- **${title}**`;
        if (org) s += ` -- ${org}`;
        const meta = [date, loc].filter(Boolean);
        if (meta.length) s += ` (${meta.join("; ")})`;
        if (desc.length) s += `\n  ${desc.join(" ")}`;
        return s;
      }
  
      if (sectionTitle === "Recommendations") {
        const who = lines[0] || "";
        let meta = "";
        let startIdx = 1;
  
        const metaLines = [];
        for (let i = 1; i < Math.min(lines.length, 3); i++) {
          if (lines[i].length < 110) metaLines.push(lines[i]);
          startIdx = i + 1;
        }
        if (metaLines.length) meta = metaLines.join(" \u00b7 ");
  
        const body = lines.slice(startIdx).join(" ").trim();
        let s = `- **${who}**`;
        if (meta) s += ` -- ${meta}`;
        if (body) {
          s += `\n  > ${body}`;
        }
        return s;
      }
  
      if (sectionTitle === "Interests") {
        return `- ${lines[0]}`;
      }
  
      return `- ${lines.join(" \u00b7 ")}`;
    }
  
    function sectionFromMain(main, sectionTitle) {
      if (sectionTitle === "About") {
        return extractAboutFromExpandableTextBox(main);
      }
  
      const sec = getSectionContainer(main, sectionTitle);
      if (!sec) return "";
  
      const clone = sec.cloneNode(true);
      for (const h of Array.from(clone.querySelectorAll("h2, h3"))) h.remove();
      for (const b of Array.from(clone.querySelectorAll("button, svg, path, script, style, noscript"))) b.remove();
      if (!CFG.keepImages) {
        for (const img of Array.from(clone.querySelectorAll("img, figure, video"))) img.remove();
      }
  
      const lines = cleanLines(toLines(clone), sectionTitle);
      if (!lines.length) return "";
  
      if (sectionTitle === "About") return compactMarkdown(lines.join("\n\n"));
  
      const bullets = lines.map((l) => `- ${l}`).join("\n");
      return compactMarkdown(bullets);
    }
  
    function isDetailsUrlForSection(rawUrl, section) {
      try {
        const u = new URL(rawUrl, location.origin);
        if (u.origin !== location.origin) return false;
  
        const path = u.pathname.toLowerCase();
        if (!path.includes("/details/")) return false;
  
        const tokens = (section.paths || [])
          .map((p) => p.toLowerCase().replace(/^details\//, "").replace(/\/+$/, ""))
          .filter(Boolean);
  
        if (!tokens.length) return true;
        return tokens.some((token) => path.includes(`/details/${token}`));
      } catch (_) {
        return false;
      }
    }
  
    function collectSectionDetailsLinks(main, section) {
      const sec = findSectionByHeading(main, section.title);
      if (!sec) return [];
  
      const prioritized = [];
      const secondary = [];
      const seen = new Set();
      const anchors = Array.from(sec.querySelectorAll("a[href]"));
  
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        if (!href) continue;
  
        let absolute;
        try {
          absolute = new URL(href, location.origin).toString();
        } catch (_) {
          continue;
        }
  
        if (!isDetailsUrlForSection(absolute, section)) continue;
  
        const label = norm(`${a.innerText || a.textContent || ""} ${a.getAttribute("aria-label") || ""}`);
        const isShowAllLink =
          label.includes("show all") || label.includes("see all") || label.includes("view all");
  
        if (seen.has(absolute)) continue;
  
        seen.add(absolute);
        if (isShowAllLink) prioritized.push(absolute);
        else secondary.push(absolute);
      }
  
      return [...prioritized, ...secondary];
    }
  
    function buildSectionCandidateUrls(basePath, section, discoveredLinks) {
      const base = location.origin + basePath;
      const candidates = [];
      const seen = new Set();
  
      for (const p of section.paths || []) {
        const url = base + p;
        if (seen.has(url)) continue;
        seen.add(url);
        candidates.push(url);
      }
  
      for (const link of discoveredLinks || []) {
        if (!isDetailsUrlForSection(link, section)) continue;
        if (seen.has(link)) continue;
        seen.add(link);
        candidates.push(link);
      }
  
      return candidates;
    }
  
    async function waitFor(predicate, timeoutMs, intervalMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try {
          if (predicate()) return true;
        } catch (_) {}
        await sleep(intervalMs);
      }
      return false;
    }
  
    async function withTimeout(promise, timeoutMs, fallbackValue) {
      let timer;
      try {
        return await Promise.race([
          promise,
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
  
    async function expandInDocument(doc, win, maxRounds) {
      const rounds = Number.isFinite(maxRounds) ? maxRounds : CFG.helperExpandRounds;
      for (let round = 0; round < rounds; round++) {
        const btns = collectExpanders(doc);
        let clicked = 0;
        for (const b of btns) {
          try {
            b.click();
            clicked++;
          } catch (_) {}
          await sleep(CFG.clickPauseMs);
        }
        try {
          if (win && win.scrollBy) {
            win.scrollBy(0, Math.max(500, Math.floor((win.innerHeight || 900) * 0.9)));
          }
        } catch (_) {}
        await sleep(180);
        if (!clicked) break;
      }
  
      try {
        if (win && win.scrollTo) win.scrollTo(0, 0);
      } catch (_) {}
      await sleep(120);
    }
  
    async function scrapeDetailsViaHelperWindow(helperWin, url, sectionTitle) {
      if (!helperWin || helperWin.closed) return "";
      let requestedToken = "";
      try {
        const parsed = new URL(url, location.origin);
        const m = parsed.pathname.toLowerCase().match(/\/details\/([^/]+)/);
        requestedToken = m && m[1] ? m[1] : "";
      } catch (_) {}
  
      try {
        if (helperWin.focus) helperWin.focus();
      } catch (_) {}
      try {
        helperWin.location.href = url;
      } catch (_) {
        return "";
      }
  
      const navigated = await waitFor(() => {
        if (!helperWin || helperWin.closed) return false;
        try {
          const href = String(helperWin.location.href || "").toLowerCase();
          if (!href.includes("/details/")) return false;
          if (!requestedToken) return true;
          return href.includes(`/details/${requestedToken}`);
        } catch (_) {
          return false;
        }
      }, CFG.detailsNavTimeoutMs, 160);
      if (!navigated) return "";
  
      const ready = await waitFor(() => {
        if (!helperWin || helperWin.closed) return false;
        try {
          return !!helperWin.document && helperWin.document.readyState !== "loading";
        } catch (_) {
          return false;
        }
      }, CFG.detailsNavTimeoutMs, 120);
      if (!ready) return "";
  
      let doc;
      try {
        doc = helperWin.document;
      } catch (_) {
        return "";
      }
      if (!doc) return "";
  
      await withTimeout(
        waitFor(() => hasLikelySectionNodes(doc, sectionTitle), CFG.helperNodeWaitMs, 90),
        CFG.helperNodeWaitMs + 200,
        false
      );
  
      await sleep(40);
  
      const initialMd = extractDetailsSection(doc, sectionTitle, helperWin.location.href);
      if (looksLikeSectionMarkdown(sectionTitle, initialMd)) return initialMd;
  
      await withTimeout(expandInDocument(doc, helperWin, CFG.helperExpandRounds), 2600, null);
      await sleep(80);
  
      const expandedMd = extractDetailsSection(doc, sectionTitle, helperWin.location.href);
      if (looksLikeSectionMarkdown(sectionTitle, expandedMd)) return expandedMd;
  
      const best = expandedMd.length >= initialMd.length ? expandedMd : initialMd;
  
      return looksLikeSectionMarkdown(sectionTitle, best) ? best : "";
    }
  
    async function loadRootMainViaFetch(basePath) {
      const rootUrl = location.origin + basePath;
      const html = await withTimeout(fetchWithTimeout(rootUrl), CFG.fetchTimeoutMs + 1000, null);
      if (!html) return null;
      const doc = parseHTML(html);
      if (!doc) return null;
      const main = doc.querySelector("main") || doc.body || null;
      if (!looksLikeProfileHomeMain(main)) return null;
      return main;
    }
  
    async function loadRootMainViaHelper(helperWin, basePath) {
      if (!helperWin || helperWin.closed) return null;
      try {
        if (helperWin.focus) helperWin.focus();
      } catch (_) {}
      const rootUrl = location.origin + basePath;
      try {
        helperWin.location.href = rootUrl;
      } catch (_) {
        return null;
      }
  
      const ready = await waitFor(() => {
        if (!helperWin || helperWin.closed) return false;
        try {
          const href = String(helperWin.location.href || "");
          const u = new URL(href);
          const okPath = isExactProfileBasePath(u.pathname, basePath);
          return okPath && !!helperWin.document && helperWin.document.readyState !== "loading";
        } catch (_) {
          return false;
        }
      }, CFG.detailsNavTimeoutMs, 120);
      if (!ready) return null;
  
      let doc;
      try {
        doc = helperWin.document;
      } catch (_) {
        return null;
      }
      if (!doc) return null;
  
      await sleep(500);
      await expandInDocument(doc, helperWin);
      const main = doc.querySelector("main") || doc.body || null;
      if (!looksLikeProfileHomeMain(main)) return null;
      return main;
    }
  
    async function fetchWithTimeout(url) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), CFG.fetchTimeoutMs);
      try {
        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          signal: ctrl.signal,
          headers: { Accept: "text/html,application/xhtml+xml" },
        });
        if (!res.ok) return null;
        const text = await res.text();
        if (/\/login\b/i.test(res.url) || (/sign in/i.test(text) && /linkedin/i.test(text))) return null;
        return text;
      } catch (_) {
        return null;
      } finally {
        clearTimeout(t);
      }
    }
  
    function parseHTML(html) {
      try {
        return new DOMParser().parseFromString(html, "text/html");
      } catch (_) {
        return null;
      }
    }
  
    async function fastFetchDetailsForSection(basePath, section, discoveredLinks) {
      const candidates = buildSectionCandidateUrls(basePath, section, discoveredLinks);
      if (!candidates.length) return "";
  
      const attempts = candidates.map(async (url) => {
        const html = await withTimeout(fetchWithTimeout(url), CFG.fetchTimeoutMs + 1000, null);
        if (!html) throw new Error("no-html");
        const hasStructured = /pvs-list__paged-list-item|pvs-list__item--line-separated|profile-component-entity|pvs-entity/i.test(
          html
        );
        const looksLikeShell = /__como_rehydration__|proto\.sdui|initialpath:/i.test(html);
        if (!hasStructured && looksLikeShell) throw new Error("shell-html");
        const doc = parseHTML(html);
        if (!doc) throw new Error("bad-doc");
        const md = extractDetailsSection(doc, section.title, url);
        if (!looksLikeSectionMarkdown(section.title, md)) throw new Error("no-md");
        return md;
      });
  
      try {
        return await Promise.any(attempts);
      } catch (_) {
        return "";
      }
    }
  
    function formatSectionItems(root, sectionTitle) {
      const itemSet = new Set();
      const items = [];
      for (const sel of DETAIL_ITEM_SELECTORS) {
        for (const node of Array.from(root.querySelectorAll(sel))) {
          if (itemSet.has(node)) continue;
          itemSet.add(node);
          items.push(node);
        }
      }
      if (!items.length) return "";
  
      const formatted = [];
      for (const it of items) {
        const entry = formatEntity(sectionTitle, toLines(it));
        if (entry) formatted.push(entry);
      }
      if (!formatted.length) return "";
  
      const uniq = [];
      const seen = new Set();
      for (const f of formatted) {
        if (seen.has(f)) continue;
        seen.add(f);
        uniq.push(f);
      }
      return compactMarkdown(uniq.join("\n"));
    }
  
    function linesToMarkdownForSection(sectionTitle, lines) {
      if (!lines || !lines.length) return "";
      if (sectionTitle === "About") return compactMarkdown(lines.join("\n\n"));
  
      if (sectionTitle === "Skills" || sectionTitle === "Interests" || sectionTitle === "Courses") {
        return compactMarkdown(lines.slice(0, 80).map((l) => `- ${l}`).join("\n"));
      }
  
      if (sectionTitle === "Languages") {
        const out = [];
        for (let i = 0; i < lines.length; i += 2) {
          const a = lines[i] || "";
          const b = lines[i + 1] || "";
          if (!a) continue;
          out.push(b ? `- **${a}** -- ${b}` : `- ${a}`);
        }
        return compactMarkdown(out.join("\n"));
      }
  
      return compactMarkdown(lines.map((l) => `- ${l}`).join("\n"));
    }
  
    function extractDetailsSection(doc, sectionTitle, sourceUrl) {
      const main = doc.querySelector("main") || doc.body;
      if (!main) return "";
  
      let scoped = findSectionByHeadingLoose(main, sectionTitle);
      if (!scoped) scoped = findBestDetailsContainer(main, sectionTitle);
  
      const candidates = [];
      if (scoped) candidates.push(scoped);
      if (main && (!scoped || scoped !== main)) candidates.push(main);
  
      let best = "";
      for (const candidate of candidates) {
        const clone = candidate.cloneNode(true);
        stripCommonChrome(clone);
        if (!CFG.keepImages) {
          for (const img of Array.from(clone.querySelectorAll("img, figure, video"))) img.remove();
        }
  
        let md = formatSectionItems(clone, sectionTitle);
        if (!md) {
          const lines = cleanLines(toLines(clone), sectionTitle);
          md = linesToMarkdownForSection(sectionTitle, lines);
        }
  
        if (looksLikeSectionMarkdown(sectionTitle, md)) return md;
        if (md && md.length > best.length) best = md;
      }
  
      if (!looksLikeSectionMarkdown(sectionTitle, best) && sourceUrl) {
        try {
          const maybeToken = new URL(sourceUrl, location.origin).pathname.toLowerCase();
          if (!maybeToken.includes("/details/")) return "";
        } catch (_) {
          return "";
        }
      }
      return looksLikeSectionMarkdown(sectionTitle, best) ? best : "";
    }
  
    async function fetchDetailsForSection(basePath, section, discoveredLinks, helperWin) {
      if (!helperWin || helperWin.closed) return "";
      const candidates = buildSectionCandidateUrls(basePath, section, discoveredLinks);
      let best = "";
      for (const url of candidates) {
        const liveMd = await scrapeDetailsViaHelperWindow(helperWin, url, section.title);
        if (looksLikeSectionMarkdown(section.title, liveMd)) return liveMd;
        if (liveMd && liveMd.length > best.length) best = liveMd;
      }
      return looksLikeSectionMarkdown(section.title, best) ? best : "";
    }
  
    async function fastFetchSectionWithCurrentHint(basePath, section, discoveredLinks) {
      let md = "";
      if (isDetailsUrlForSection(location.href, section)) {
        const currentMd = extractDetailsSection(document, section.title, location.href);
        if (looksLikeSectionMarkdown(section.title, currentMd)) md = currentMd;
      }
      if (!md.trim()) {
        md = await fastFetchDetailsForSection(basePath, section, discoveredLinks);
      }
      return md;
    }
  
    async function prefetchDetailsSectionsParallel(basePath, discoveredLinksByTitle) {
      const detailSections = SECTIONS.filter((s) => s.kind === "details");
      const jobs = detailSections.map(async (section) => {
        const discovered = discoveredLinksByTitle.get(section.title) || [];
        const md = await fastFetchSectionWithCurrentHint(basePath, section, discovered);
        return [section.title, md];
      });
  
      const entries = await Promise.all(jobs);
      const byTitle = new Map();
      for (const [title, md] of entries) byTitle.set(title, md || "");
      return byTitle;
    }
  
    async function exportProfileMarkdown() {
      let helperWin = null;
      function ensureHelperWindow() {
        if (helperWin && !helperWin.closed) return helperWin;
        try {
          helperWin = window.open("about:blank", "linkedmd-details");
        } catch (_) {
          helperWin = null;
        }
        return helperWin && !helperWin.closed ? helperWin : null;
      }
  
      try {
        const main = document.querySelector("main") || document.body;
  
        await prepareMainForExport(main);
  
        const basePath = getProfileBasePath();
  
        let { name, headline, location: loc } = getProfileTopMeta(main);
  
        let about = sectionFromMain(main, "About");
        const needsHomeContext = !isProfileRootPath(location.pathname) || !headline || !loc || !about.trim();
        if (needsHomeContext) {
          let rootMain = null;
          const hw = ensureHelperWindow();
          if (hw) rootMain = await withTimeout(loadRootMainViaHelper(hw, basePath), 10000, null);
          if (!rootMain) rootMain = await loadRootMainViaFetch(basePath);
          if (rootMain) {
            const rootMeta = getProfileTopMeta(rootMain);
            if (rootMeta.headline) headline = rootMeta.headline;
            if (rootMeta.location) loc = rootMeta.location;
            if ((!name || isLikelyJunkMetaText(name) || /\|\s*linkedin/i.test(name)) && rootMeta.name) {
              name = rootMeta.name;
            }
  
            const rootAbout = sectionFromMain(rootMain, "About");
            if (rootAbout.trim()) about = rootAbout;
          }
        }
  
        if (!name || isLikelyJunkMetaText(name) || /\|\s*linkedin/i.test(name)) {
          const pathName = fallbackNameFromPath(location.pathname);
          if (pathName) name = pathName;
        }
  
        const fm =
          "---\n" +
          `source: ${JSON.stringify(location.href)}\n` +
          `exported_at: ${JSON.stringify(new Date().toISOString())}\n` +
          `title: ${JSON.stringify(document.title || "")}\n` +
          "---\n\n";
  
        let out = fm;
        out += `# ${name}\n\n`;
        const metaLine = [headline, loc].filter(Boolean).join(" \u00b7 ");
        if (metaLine) out += `${metaLine}\n\n`;
        const discoveredLinksByTitle = new Map();
  
        for (const section of SECTIONS) {
          if (section.kind !== "details") continue;
          discoveredLinksByTitle.set(section.title, collectSectionDetailsLinks(main, section));
        }
  
        let prefetchedByTitle = new Map();
        if (CFG.parallelFastFetchFirst) {
          try {
            prefetchedByTitle = await prefetchDetailsSectionsParallel(basePath, discoveredLinksByTitle);
          } catch (_) {
            prefetchedByTitle = new Map();
          }
        }
  
        if (about.trim()) out += `## About\n\n${about.trim()}\n\n`;
  
        for (const section of SECTIONS) {
          if (section.kind !== "details") continue;
  
          const discovered = discoveredLinksByTitle.get(section.title) || [];
          let md = CFG.parallelFastFetchFirst ? prefetchedByTitle.get(section.title) || "" : "";
          let triedHelper = false;
  
          if (!CFG.parallelFastFetchFirst) {
            if (isDetailsUrlForSection(location.href, section)) {
              const currentMd = extractDetailsSection(document, section.title, location.href);
              if (looksLikeSectionMarkdown(section.title, currentMd)) md = currentMd;
            }
  
            if (!md.trim() && CFG.preferLiveSectionScrape && CFG.useHelperFallback) {
              const hw = ensureHelperWindow();
              if (hw) {
                triedHelper = true;
                try {
                  md = await fetchDetailsForSection(basePath, section, discovered, hw);
                } catch (_) {
                  md = "";
                }
              }
            }
  
            if (!md.trim()) {
              md = await fastFetchSectionWithCurrentHint(basePath, section, discovered);
            }
          }
  
          if (!md.trim() && CFG.useHelperFallback && !triedHelper) {
            const hw = ensureHelperWindow();
            if (hw) {
              try {
                md = await fetchDetailsForSection(basePath, section, discovered, hw);
              } catch (_) {
                md = "";
              }
            }
          }
  
          if (!md.trim() && !CFG.detailsOnlySections) {
            md = sectionFromMain(main, section.title);
          }
  
          if (md.trim()) out += `## ${section.title}\n\n${md.trim()}\n\n`;
        }
  
        out = compactMarkdown(out);
  
        const filename = sanitizeFilename(name || document.title) + ".md";
        downloadText(filename, out);
  
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(out);
          }
        } catch (_) {}
      } finally {
        try {
          if (helperWin && !helperWin.closed) helperWin.close();
        } catch (_) {}
      }
    }

    return exportProfileMarkdown;
  }

  if (typeof window.__li_export_md__ !== "function") {
    window.__li_export_md__ = buildExporter();
  }

  function mount() {
    if (!document.body || document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "Export MD";
    btn.style.cssText = [
      "position:fixed",
      "top:12px",
      "right:12px",
      "z-index:2147483647",
      "padding:8px 10px",
      "border-radius:10px",
      "border:1px solid rgba(0,0,0,0.25)",
      "background:white",
      "color:black",
      "font:600 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "box-shadow:0 6px 18px rgba(0,0,0,0.15)",
      "cursor:pointer",
    ].join(";");

    btn.addEventListener("click", async () => {
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Exporting...";
      try {
        await window.__li_export_md__();
      } catch (e) {
        console.error(e);
        alert("Export failed. Open DevTools console for details.");
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });

    document.body.appendChild(btn);
  }

  mount();
  setInterval(mount, 1200);
})();
