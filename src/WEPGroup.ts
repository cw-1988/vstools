import type { BinaryReader } from './types.js';

export class WEPGroup {
  [key: string]: any;

  constructor(reader: BinaryReader, id: number) {
    this.reader = reader;
    this.id = id;
  }

  read() {
    const r = this.reader;
    this.boneId = r.s16();
    this.lastVertex = r.u16();
  }
}
