import { newVSMaterial } from './VSTOOLS.js';
import { FrameBuffer } from './FrameBuffer.js';
import { TIM } from './TIM.js';

export class ZND {
  [key: string]: any;

  constructor(reader) {
    this.reader = reader;
    this.materials = {};
    this.textures = [];
    this.fallbackZnds = [];
  }

  read() {
    this.header();
    this.data();
  }

  header() {
    const r = this.reader;

    this.mpdPtr = r.u32();
    this.mpdLen = r.u32();
    this.mpdNum = this.mpdLen / 8;
    this.enemyPtr = r.u32();
    this.enemyLen = r.u32();
    this.timPtr = r.u32();
    this.timLen = r.u32();
    this.wave = r.u8();
    r.skip(7); // unknown
  }

  data() {
    this.mpdSection();
    this.enemiesSection();
    this.timSection();
  }

  mpdSection() {
    const r = this.reader;

    this.mpdLBAs = [];
    this.mpdSizes = [];

    for (let i = 0; i < this.mpdNum; ++i) {
      this.mpdLBAs.push(r.u32());
      this.mpdSizes.push(r.u32());
    }
  }

  enemiesSection() {
    this.reader.skip(this.enemyLen);
  }

  timSection() {
    const r = this.reader;

    this.timLen2 = r.u32();
    r.skip(12); // TODO confirm this is 0 for all ZNDs
    this.timNum = r.u32();

    this.frameBuffer = new FrameBuffer();
    this.tims = [];

    for (let i = 0; i < this.timNum; ++i) {
      // tim length not technically part of tim, unused
      r.u32();

      const tim = new TIM(this.reader);
      tim.read();
      tim.id = i;

      //console.log( 'tim', i, ':', tim.width, 'x', tim.height, 'at', tim.fx, tim.fy );

      if (tim.height < 5) {
        tim.copyToFrameBuffer(this.frameBuffer);
      }

      tim.copyToFrameBuffer(this.frameBuffer);

      this.tims.push(tim);
    }
  }

  getTIM(id) {
    const match = this.findTIMSource(id);
    return match ? match.tim : undefined;
  }

  addFallback(znd) {
    if (!znd || znd === this) return;

    const fallbacks = this.fallbackZnds || (this.fallbackZnds = []);
    if (!fallbacks.includes(znd)) {
      fallbacks.push(znd);
    }
  }

  getTextureSources() {
    const sources = [this];
    const seen = new Set(sources);

    for (let i = 0; i < sources.length; ++i) {
      const source = sources[i];

      for (const fallback of source.fallbackZnds || []) {
        if (!fallback || seen.has(fallback)) continue;
        seen.add(fallback);
        sources.push(fallback);
      }
    }

    return sources;
  }

  findTIMSource(id) {
    const x = (id * 64) % 1024;

    for (const source of this.getTextureSources()) {
      for (let i = 0; i < source.tims.length; ++i) {
        const tim = source.tims[i];

        if (tim.fx === x) {
          return { source, tim };
        }
      }
    }
  }

  findCLUTSource(clutId) {
    const x = (clutId * 16) % 1024;
    const y = Math.floor((clutId * 16) / 1024);

    for (const source of this.getTextureSources()) {
      for (let i = 0, l = source.tims.length; i < l; ++i) {
        const tim = source.tims[i];

        if (
          tim.fx <= x &&
          tim.fx + tim.width > x &&
          tim.fy <= y &&
          tim.fy + tim.height > y
        ) {
          return { source, tim, x, y };
        }
      }
    }
  }

  getMaterial(textureId, clutId) {
    const id = textureId + '-' + clutId;

    const materials = this.materials;
    let material = materials[id];

    if (material) {
      return material;
    } else {
      const textureSource = this.findTIMSource(textureId);
      const clutSource = this.findCLUTSource(clutId);

      if (clutSource && clutSource.source.frameBuffer) {
        clutSource.source.frameBuffer.markCLUT(clutId);
      } else if (this.frameBuffer) {
        this.frameBuffer.markCLUT(clutId);
      }

      if (!textureSource || !clutSource) {
        material = this.buildFallbackMaterial(
          id,
          textureSource ? textureSource.tim : null,
          clutSource ? clutSource.tim : null
        );
        materials[id] = material;
        return material;
      }

      const clut = clutSource.tim.buildCLUT(clutSource.x, clutSource.y);
      const texture = textureSource.tim.build(clut);
      texture.title = id;

      this.textures.push(texture);

      // build texture
      material = newVSMaterial({
        map: texture,
        flatShading: true,
        transparent: true,
        vertexColors: true,
        alphaTest: 0.1,
      });

      // cache
      materials[id] = material;

      return material;
    }
  }

  buildFallbackMaterial(id, textureTIM, clut) {
    if (!this.missingMaterialWarnings) {
      this.missingMaterialWarnings = new Set();
    }

    if (!this.missingMaterialWarnings.has(id)) {
      const missing = [
        textureTIM ? null : 'texture page',
        clut ? null : 'CLUT',
      ]
        .filter(Boolean)
        .join(' and ');

      console.warn(`[vstools] Missing ${missing} for material ${id}`);
      this.missingMaterialWarnings.add(id);
    }

    const material = newVSMaterial({
      vertexColors: true,
      transparent: true,
      alphaTest: 0.1,
    });
    material.name = `missing-${id}`;
    material.userData = {
      missingTexture: true,
      missingMaterialId: id,
    };

    return material;
  }
}
