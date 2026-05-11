import type { BinaryReader } from './types.js';

export class WEPVertex {
  [key: string]: any;

  constructor(reader: BinaryReader) {
    this.reader = reader;
    this.groupId = -1;
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }

  read() {
    const r = this.reader;

    this.x = r.s16();
    this.y = r.s16();
    this.z = r.s16();
    r.padding(2);
  }
}
