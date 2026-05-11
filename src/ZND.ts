import { newVSMaterial } from './VSTOOLS.js';
import { FrameBuffer } from './FrameBuffer.js';
import { TIM } from './TIM.js';

export class ZND {
  [key: string]: any;
  constructor(reader) {
    this.reader = reader;
    this.materials = {};
    this.missingMaterials = {};
    this.textures = [];
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
    const x = (id * 64) % 1024;
    //const y = Math.floor((id * 64) / 1024);

    for (let i = 0; i < this.tims.length; ++i) {
      const tim = this.tims[i];

      if (tim.fx === x) {
        return tim;
      }
    }
  }

  getRoomMaterials(textureId, clutId, semiTransparent = false) {
    if (!semiTransparent) {
      return [this.getMaterial(textureId, clutId, 'opaque')];
    }

    return [
      this.getMaterial(textureId, clutId, 'semiOpaque'),
      this.getMaterial(textureId, clutId, 'semiBlend'),
    ];
  }

  getMaterial(textureId, clutId, mode = 'opaque') {
    const tims = this.tims;
    const transparent = mode === 'semiBlend';
    const id = textureId + '-' + clutId + '-' + mode;

    const materials = this.materials;
    let material = materials[id];

    if (material) {
      return material;
    } else {
      // find texture
      const textureTIM = this.getTIM(textureId);

      this.frameBuffer.markCLUT(clutId);

      // find CLUT
      const x = (clutId * 16) % 1024;
      const y = Math.floor((clutId * 16) / 1024);

      //console.log( x, y );

      let clut = null;

      for (let i = 0, l = tims.length; i < l; ++i) {
        const tim = tims[i];

        if (
          tim.fx <= x &&
          tim.fx + tim.width > x &&
          tim.fy <= y &&
          tim.fy + tim.height > y
        ) {
          // we found the CLUT
          clut = tim.buildCLUT(x, y);
          break;
        }
      }

      if (!textureTIM || !clut) {
        material = newVSMaterial({
          flatShading: true,
          transparent,
          depthWrite: !transparent,
          alphaTest: 0.001,
          polygonOffset: transparent,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -2,
          vertexColors: true,
        });

        if (!this.missingMaterials[id]) {
          const missing = [];
          if (!textureTIM) missing.push(`texture page ${textureId}`);
          if (!clut) missing.push(`CLUT ${clutId}`);
          console.warn(
            `Missing ${missing.join(
              ' and '
            )} for ZND material ${id}; rendering without texture.`
          );
          this.missingMaterials[id] = true;
        }

        materials[id] = material;
        return material;
      }

      const texture = textureTIM.build(clut, mode);
      texture.title = id;

      this.textures.push(texture);

      // build texture
      material = newVSMaterial({
        map: texture,
        flatShading: true,
        // PS1 textured semi-transparent polygons can mix opaque texels and
        // blended texels within the same face via the CLUT STP bit. Split the
        // room face into an opaque cutout pass plus a blend pass so the opaque
        // texels still write depth like the original draw.
        transparent,
        depthWrite: !transparent,
        alphaTest: 0.001,
        polygonOffset: transparent,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
        vertexColors: true,
      });

      // cache
      materials[id] = material;

      return material;
    }
  }
}

