/** @typedef {import('./types').BinaryReader} BinaryReader */

export class WEPGroup {
  [key: string]: any;
  /** @param {BinaryReader} reader @param {number} id */
  constructor(reader, id) {
    this.reader = reader;
    this.id = id;
  }

  read() {
    const r = this.reader;
    this.boneId = r.s16();
    this.lastVertex = r.u16();
  }
}

