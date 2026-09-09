import { startStaticServer, launchChromium } from '../tools/lib/runtime.mjs';
import { resolve } from 'node:path';
const { chromium } = await import('playwright');
const site = await startStaticServer(resolve('_site'));
const browser = await launchChromium(chromium, {});
for (const [label, url] of [['landing', '/'], ['deck-screen', '/talks/2026-06-29-erlangen-islam-peripheries/']]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(site.base + url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => [...document.querySelectorAll('img')]
    .filter(i => /africamultiple|logo-kcl|logo-mcp|logo-zmo/.test(i.src))
    .map(i => { const r = i.getBoundingClientRect();
      return { src: i.src.split('/').pop(), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
               nat: i.naturalWidth + 'x' + i.naturalHeight, cls: i.className, par: i.parentElement.className }; }));
  console.log(label, JSON.stringify(out, null, 1));
  await ctx.close();
}
await browser.close(); await site.close();
