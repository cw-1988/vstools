import { testFiles } from './util.js';
import { test } from './util.js';
import { ZND } from '../dist/ZND.js';
import { Reader } from '../dist/Reader.js';
import * as assert from 'assert';

testFiles({
  label: 'ZND',
  dir: 'data/MAP',
  filter: (it) => it.match(/\.ZND$/),
  test: (file, buffer) => {
    const reader = new Reader(buffer);
    const it = new ZND(reader);
    it.read();
  },
});

test({
  label: 'ZND missing texture fallback',
  test() {
    const it = new ZND(new Reader(new Uint8Array()));
    it.materials = {};
    it.textures = [];
    it.tims = [];
    it.frameBuffer = {
      markCLUT() {},
    };

    const material = it.getMaterial(11, 14387);

    assert.ok(material);
    assert.equal(material.userData.missingTexture, true);
    assert.equal(material.userData.missingMaterialId, '11-14387');
    assert.equal(it.textures.length, 0);
    assert.strictEqual(it.getMaterial(11, 14387), material);
  },
});

test({
  label: 'ZND supplemental source',
  test() {
    const primary = new ZND(new Reader(new Uint8Array()));
    primary.materials = {};
    primary.textures = [];
    primary.tims = [];
    primary.frameBuffer = {
      markCLUT() {},
    };

    const supplemental = new ZND(new Reader(new Uint8Array()));
    supplemental.materials = {};
    supplemental.textures = [];
    supplemental.tims = [
      {
        fx: 704,
        fy: 0,
        width: 64,
        height: 256,
        build(clut) {
          return { clut };
        },
      },
      {
        fx: 0,
        fy: 0,
        width: 64,
        height: 1,
        buildCLUT() {
          return new Uint8Array(64);
        },
      },
    ];

    primary.addFallback(supplemental);

    const material = primary.getMaterial(11, 1);

    assert.ok(material);
    assert.equal(material.userData?.missingTexture, undefined);
    assert.equal(primary.textures.length, 1);
  },
});
