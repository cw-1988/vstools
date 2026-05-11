import { MPDFace } from './MPDFace.js';
import { MPDMesh } from './MPDMesh.js';

export class MPDGroup {
  [key: string]: any;
  constructor(reader, mpd) {
    this.reader = reader;
    this.mpd = mpd;
  }

  read() {
    this.header();
    this.data();
  }

  header() {
    const r = this.reader;

    // Geometry group header layout matches the format used by other
    // working importers:
    //   u8  display flags
    //   u8  scale flags
    //   u16 overlap flags
    //   s16 decX, pad
    //   s16 decY, pad
    //   s16 decZ, pad
    //   48 bytes remaining unknown header data
    this.display = r.u8();
    this.scaleFlags = r.u8();
    this.overlapping = r.u16();
    this.decX = r.s16();
    r.s16(); // unknown/padding
    this.decY = r.s16();
    r.s16(); // unknown/padding
    this.decZ = r.s16();
    r.s16(); // unknown/padding
    this.headerData = r.buffer(48);

    // the header is not well understood
    // it seems that the scale flag bits control how relative vertices
    // expand from p1 within the group.

    // the following fixes the scaling issues in maps 001 and 002
    if ((this.scaleFlags & 0x08) > 0) {
      this.scale = 1;
    } else {
      this.scale = 8; // TODO is this the default?
    }
  }

  data() {
    const r = this.reader;

    this.triangleCount = r.u32();
    this.quadCount = r.u32();
    this.faceCount = this.triangleCount + this.quadCount;
    this.translucentMeshId = 0;

    this.meshes = {};

    for (let i = 0; i < this.triangleCount; ++i) {
      const face = new MPDFace(this.reader, this);
      face.read(false);

      const mesh = this.getMesh(face);
      mesh.add(face);
    }

    for (let i = this.triangleCount; i < this.faceCount; ++i) {
      const face = new MPDFace(this.reader, this);
      face.read(true); // quad

      const mesh = this.getMesh(face);
      mesh.add(face);
    }
  }

  build() {
    for (const id in this.meshes) {
      this.meshes[id].build();
    }
  }

  getMesh(face) {
    const meshes = this.meshes;
    const textureId = face.textureId;
    const clutId = face.clutId;
    const semiTransparent = face.semiTransparent;
    const id = semiTransparent
      ? textureId +
        '-' +
        clutId +
        '-st-' +
        this.translucentMeshId++
      : textureId + '-' + clutId + '-op';

    let mesh = meshes[id];

    if (mesh) {
      return mesh;
    } else {
      mesh = new MPDMesh(
        this.reader,
        this,
        textureId,
        clutId,
        semiTransparent
      );
      meshes[id] = mesh;
      return mesh;
    }
  }
}

