#!/usr/bin/env node
/** Browser regression for the optional pipeline; uses only local assets. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { launchChromium, startStaticServer } from './lib/runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await startStaticServer(root);
const browser = await launchChromium(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = server.base + '/talks/_showcase/';
const pipeline = page.locator('#pipeline-example');
async function open(query = '') {
  await page.goto(url + query + '#/pipeline-example');
  await page.waitForFunction(() => window.Reveal?.isReady());
  await page.evaluate(() => document.fonts.ready);
  await pipeline.waitFor({ state: 'visible' });
}
async function visibleCount() {
  return pipeline.locator('.pipeline-step.fragment.visible').count();
}
try {
  await open();
  assert.equal(await pipeline.locator('svg').count(), 5);
  assert.equal(await visibleCount(), 0);
  await page.keyboard.press('ArrowRight');
  assert.equal(await visibleCount(), 1);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await visibleCount(), 0);
  await pipeline.getByRole('button', { name: 'Play sequence' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#pipeline-example .fragment.visible').length === 4);
  await page.waitForFunction(() => document.querySelector('.pipeline-play').getAttribute('aria-pressed') === 'false');
  assert.equal(await page.evaluate(() => Reveal.getCurrentSlide().id), 'pipeline-example');
  await pipeline.getByRole('button', { name: 'Play sequence' }).click();
  assert.equal(await visibleCount(), 0, 'replay resets to the source');
  await pipeline.getByRole('button', { name: 'Pause sequence' }).click();
  await page.waitForTimeout(1600);
  assert.equal(await visibleCount(), 0, 'paused playback does not advance');
  await pipeline.getByRole('button', { name: 'Play sequence' }).click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await pipeline.locator('button').textContent(), 'Play sequence', 'manual input stops playback');
  await pipeline.getByRole('button', { name: 'Play sequence' }).click();
  await page.evaluate(() => Reveal.slide(0));
  await page.waitForTimeout(1600);
  assert.notEqual(await page.evaluate(() => Reveal.getCurrentSlide().id), 'pipeline-example');
  assert.equal(await visibleCount(), 0, 'leaving the slide stops the timer');

  await open();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('[data-pipeline]').classList.contains('pipeline-static'));
  assert.equal(await pipeline.locator('.fragment').count(), 0);
  assert.equal(await pipeline.locator('button').isVisible(), false);
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.evaluate(() => Reveal.getCurrentSlide().id), 'pipeline-example', 'no invisible clicks in reduced motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await open();
  await page.evaluate(() => document.querySelector('.reveal').classList.add('no-draw'));
  await page.waitForFunction(() => !document.querySelector('#pipeline-example .fragment'));
  assert.equal(await pipeline.locator('button').isVisible(), false);
  await page.evaluate(() => document.querySelector('.reveal').classList.remove('no-draw'));
  await page.waitForFunction(() => document.querySelectorAll('#pipeline-example .fragment').length === 4);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await pipeline.locator('button').isVisible(), false);
  assert.equal(await pipeline.locator('[data-pipeline-art]').last().isVisible(), true);
  assert.equal(await pipeline.locator('.pipeline-step').last().evaluate(el => getComputedStyle(el).opacity), '1');
  await page.emulateMedia({ media: 'screen' });

  await open('?print-pdf');
  assert.equal(await pipeline.locator('.fragment').count(), 0);
  assert.equal(await pipeline.locator('button').isVisible(), false);
  assert.equal(await pipeline.locator('[data-pipeline-art]').last().isVisible(), true);
  await page.pdf({ path: '/tmp/slides-pipeline-check.pdf', preferCSSPageSize: true, printBackground: true });

  await page.goto(url + '?view=scroll');
  await page.waitForFunction(() => window.Reveal?.isReady());
  assert.equal(await pipeline.locator('.fragment').count(), 0);
  assert.equal(await pipeline.locator('.pipeline-controls').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('ok    pipeline: clicker, reverse, replay, pause, manual takeover, exit, reduced motion, no-draw, print and scroll');
} finally {
  await browser.close();
  await server.close();
}
