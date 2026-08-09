import assert from 'node:assert/strict';
import test from 'node:test';
import { PNG } from 'pngjs';
import { frameKey, pngHasVisibleContent } from './lib/pdf-frames.mjs';

function image(width, height, paint) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [red, green, blue, alpha = 255] = paint(x, y);
      png.data[offset] = red;
      png.data[offset + 1] = green;
      png.data[offset + 2] = blue;
      png.data[offset + 3] = alpha;
    }
  }
  return PNG.sync.write(png);
}

test('frame keys distinguish repeated URLs deterministically', () => {
  assert.notEqual(frameKey('https://example.test/', 0), frameKey('https://example.test/', 1));
  assert.equal(frameKey('https://example.test/', 0), frameKey('https://example.test/', 0));
});

test('uniform iframe captures are treated as blank', () => {
  const blank = image(100, 60, () => [250, 250, 250]);
  assert.equal(pngHasVisibleContent(blank), false);
});

test('a capture with rendered content is retained', () => {
  const rendered = image(100, 60, (x, y) => (
    x > 20 && x < 80 && y > 24 && y < 36 ? [12, 85, 54] : [250, 250, 250]
  ));
  assert.equal(pngHasVisibleContent(rendered), true);
});

test('invalid image bytes are rejected safely', () => {
  assert.equal(pngHasVisibleContent(Buffer.from('not a png')), false);
});
