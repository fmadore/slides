#!/usr/bin/env node
/* Probe reveal 6.0.1 scroll view (?view=scroll) against this repo's decks. */
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { startStaticServer, launchChromium } from 'file:///C:/Users/frede/GitHub/slides/tools/lib/runtime.mjs';

const REPO = 'C:/Users/frede/GitHub/slides';
const OUT = process.argv[2] || resolve(process.cwd(), 'shots');
mkdirSync(OUT, { recursive: true });
const TAG = process.argv[3] || 'base';

const { chromium } = await import('playwright');
const site = await startStaticServer(REPO, { noStore: true });
const BASE = site.base;
const browser = await launchChromium(chromium, {});

const targets = [
  { name: 'showcase', url: `${BASE}/talks/_showcase/` },
  { name: 'erlangen', url: `${BASE}/talks/2026-06-29-erlangen-islam-peripheries/` },
];
const sizes = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'narrow', width: 500, height: 900 },
];

for (const t of targets) {
  for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.goto(`${t.url}?view=scroll`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);

    const info = await page.evaluate(() => {
      const vp = document.querySelector('.reveal-viewport');
      const rv = document.querySelector('.reveal');
      const pages = document.querySelectorAll('.scroll-page');
      const footer = document.querySelector('.deck-footer');
      const runhead = document.querySelector('.deck-runhead');
      const toc = document.querySelector('.toc-overlay');
      const prog = document.querySelector('.progress');
      const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), position: cs.position, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex }; };
      const secs = [...document.querySelectorAll('.slides section')];
      return {
        vpClasses: vp ? vp.className : null,
        vpScrollHeight: vp ? vp.scrollHeight : null,
        vpClientHeight: vp ? vp.clientHeight : null,
        scrollPages: pages.length,
        sectionCount: secs.length,
        fitted: secs.filter(s => s.hasAttribute('data-fit')).map(s => [s.className.split(' ')[0], s.getAttribute('data-fit')]),
        fitFail: secs.filter(s => s.hasAttribute('data-fit-fail')).length,
        footer: box(footer), runhead: box(runhead), toc: box(toc), progress: box(prog),
        revealBox: box(rv),
        slideScale: vp ? getComputedStyle(vp).getPropertyValue('--slide-scale') : null,
        pageHeight: vp ? getComputedStyle(vp).getPropertyValue('--page-height') : null,
        firstPageBox: pages[0] ? box(pages[0]) : null,
        firstSectionBox: secs[0] ? box(secs[0]) : null,
        parentChain: secs[0] ? (() => { const c = []; let e = secs[0]; while (e && c.length < 6) { c.push(e.className || e.tagName); e = e.parentElement; } return c; })() : null,
        fragments: document.querySelectorAll('.fragment').length,
        fragVisible: document.querySelectorAll('.fragment.visible').length,
        drawRun: (() => { const s = document.querySelector('.slides section'); return s ? getComputedStyle(s).getPropertyValue('--draw-run') : null; })(),
        iframes: [...document.querySelectorAll('iframe')].map(f => ({ src: (f.getAttribute('src') || f.getAttribute('data-src') || '').slice(0, 60), loaded: !!f.getAttribute('src') })),
        errs: [],
      };
    });
    info.errs = errs;
    console.log(`\n===== ${t.name} @ ${s.name} (${s.width}x${s.height}) =====`);
    console.log(JSON.stringify(info, null, 1));

    await page.screenshot({ path: join(OUT, `${TAG}-${t.name}-${s.name}-top.png`) });
    // scroll through
    const vpH = s.height;
    for (const frac of [0.12, 0.3, 0.5, 0.75, 0.97]) {
      await page.evaluate(f => { const vp = document.querySelector('.reveal-viewport'); vp.scrollTop = (vp.scrollHeight - vp.clientHeight) * f; }, frac);
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(OUT, `${TAG}-${t.name}-${s.name}-p${Math.round(frac * 100)}.png`) });
    }
    const after = await page.evaluate(() => {
      const b = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      return {
        footer: b(document.querySelector('.deck-footer')),
        footerText: (document.querySelector('.deck-footer .counter') || {}).textContent,
        runhead: b(document.querySelector('.deck-runhead')),
        runheadHidden: document.querySelector('.deck-runhead')?.hidden,
        fragVisible: document.querySelectorAll('.fragment.visible').length,
        fragTotal: document.querySelectorAll('.fragment').length,
        counts: [...document.querySelectorAll('[data-count]')].map(e => e.textContent.trim()),
      };
    });
    console.log('after scroll:', JSON.stringify(after));
    await ctx.close();
  }
}
await browser.close();
await site.close?.();
process.exit(0);
