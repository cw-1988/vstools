import { testFiles, debugHtml, dumpReader, printResults } from './util.js';
import { SEQ } from '../dist/SEQ.js';
import { Reader } from '../dist/Reader.js';
import * as fs from 'fs';

testFiles({
  label: 'SEQ',
  dir: 'data/OBJ',
  filter: (it) => it.match(/\.SEQ$/) && it.match(/./),
  test: (file, buffer) => {
    const reader = new Reader(buffer);
    const it = new SEQ(reader);
    //console.log(file);
    it.read();
    it.build();

    fs.writeFileSync(`debug/${file}.html`, debugHtml(file, dumpReader(reader)));
  },
});

printResults();
