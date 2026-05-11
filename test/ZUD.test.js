import { testFiles } from './util.js';
import { ZUD } from '../dist/ZUD.js';
import { Reader } from '../dist/Reader.js';

testFiles({
  label: 'ZUD',
  dir: 'data/MAP',
  filter: (it) => it.match(/\.ZUD$/),
  test: (file, buffer) => {
    const reader = new Reader(buffer);
    const it = new ZUD(reader);
    it.read();
    it.build();
  },
});
