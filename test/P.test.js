import { testFiles } from './util.js';
import { P } from '../dist/P.js';
import { Reader } from '../dist/Reader.js';

testFiles({
  label: 'P',
  dir: 'data/EFFECT',
  filter: (it) => it.match(/\.P$/),
  test: (file, buffer) => {
    const reader = new Reader(buffer);
    const it = new P(reader);
    it.read();
  },
});
