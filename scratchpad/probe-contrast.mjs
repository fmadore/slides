import { chromium } from 'playwright';

const TARGETS = [
  ['2026-05-06-dga-dormant-collections', '.ruse .n', 'dga: roadmap numeral in raw --green'],
  ['2026-05-06-dga-dormant-collections', '.bio-gallery figcaption', 'dga: book-cover caption 0.74rem'],
  ['2026-06-15-luxembourg-beyond-keywords', '.mcp-uses-sep', 'lux: separator in raw --green'],
  ['2026-06-15-luxembourg-beyond-keywords', '.kvm-tag', 'lux: demo tag 0.62rem'],
  ['2026-06-15-luxembourg-beyond-keywords', '.kvm-count', 'lux: demo count (control, uses --green-deep)'],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const out = [];
for (const [deck, sel, label] of TARGETS) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:8742/talks/${deck}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { missing: true };
    // Resolve ANY css color (oklch, color-mix, rgb) to sRGB by painting it and
    // reading the pixel back — the browser does the conversion, not us.
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 1;
    const c2 = cvs.getContext('2d', { willReadFrequently: true });
    const toRGB = (col) => {
      c2.clearRect(0, 0, 1, 1);
      c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, 1, 1);   // composite over white
      c2.fillStyle = col; c2.fillRect(0, 0, 1, 1);
      const d = c2.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const srgb = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, bb]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(bb);

    let node = el, bg = null;
    while (node && node !== document.documentElement) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
      node = node.parentElement;
    }
    const cs = getComputedStyle(el);
    const fg = toRGB(cs.color), bgc = toRGB(bg || '#ffffff');
    const L1 = lum(fg), L2 = lum(bgc);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400;
    const large = px >= 24 || (px >= 18.66 && w >= 700);
    return { color: cs.color, bgSrc: bg, fgRGB: fg, bgRGB: bgc, ratio: +ratio.toFixed(2),
             px: +px.toFixed(1), weight: w, large, needs: large ? 3.0 : 4.5,
             text: el.textContent.trim().slice(0, 34) };
  }, sel);
  out.push({ label, ...r, verdict: r.missing ? 'MISSING' : (r.ratio >= r.needs ? 'PASS' : 'FAIL') });
  await page.close();
}
for (const o of out) {
  if (o.missing) { console.log(`MISSING  ${o.label}`); continue; }
  console.log(`${o.verdict.padEnd(7)} ${o.ratio}:1 (needs ${o.needs})  ${o.px}px/${o.weight}${o.large ? ' large' : ''}  ${o.label}`);
  console.log(`         fg ${o.color} -> rgb(${o.fgRGB})   bg ${o.bgSrc} -> rgb(${o.bgRGB})   "${o.text}"`);
}
await b.close();
