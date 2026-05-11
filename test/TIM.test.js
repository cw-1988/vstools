import { strict as assert } from 'assert';
import { TIM } from '../dist/TIM.js';
import { test } from './util.js';

test({
  label: 'TIM.decodeTexel',
  test: () => {
    assert.deepEqual(TIM.decodeTexel(0x0000), [0, 0, 0, 0]);
    assert.deepEqual(TIM.decodeTexel(0x8000, 'opaque'), [0, 0, 0, 255]);
    assert.deepEqual(TIM.decodeTexel(0x8001, 'opaque'), [8, 0, 0, 255]);
    assert.deepEqual(TIM.decodeTexel(0x8001, 'semiOpaque'), [8, 0, 0, 0]);
    assert.deepEqual(TIM.decodeTexel(0x8001, 'semiBlend'), [8, 0, 0, 128]);
    assert.deepEqual(TIM.decodeTexel(0x0001, 'semiBlend'), [8, 0, 0, 0]);
    assert.deepEqual(TIM.decodeTexel(0x8000, 'semiBlend'), [0, 0, 0, 0]);
  },
});
