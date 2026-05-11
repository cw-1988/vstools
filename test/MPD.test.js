import { testFiles } from './util.js';
import { MPD } from '../dist/MPD.js';
import { Reader } from '../dist/Reader.js';

testFiles({
  label: 'MPD',
  dir: 'data/MAP',
  filter: (it) => it.match(/\.MPD$/),
  test: (file, buffer) => {
    const reader = new Reader(buffer);
    const it = new MPD(reader);
    it.read();
  },
});
