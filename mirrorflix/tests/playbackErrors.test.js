import test from 'node:test';
import assert from 'node:assert/strict';
import { describeHlsError, describeMediaError } from '../src/playbackErrors.js';

test('HLS errors explain expired, missing, and unavailable media sources', () => {
  assert.match(describeHlsError({ response: { code: 403 } }), /expired.*fresh source/);
  assert.match(describeHlsError({ response: { code: 404 } }), /no longer available/);
  assert.match(describeHlsError({ response: { code: 502 } }), /proxy.*npm run dev/);
  assert.match(describeHlsError({ response: { code: 504 } }), /HTTP 504/);
});

test('HLS and media errors distinguish network failures from unsupported media', () => {
  assert.match(describeHlsError({ type: 'networkError' }), /npm run dev/);
  assert.match(describeHlsError({ type: 'mediaError' }), /could not decode/);
  assert.match(describeMediaError(2), /network error/);
  assert.match(describeMediaError(3), /could not decode/);
  assert.match(describeMediaError(4), /not supported/);
});
