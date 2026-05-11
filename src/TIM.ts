import {
  DataTexture,
  RGBAFormat,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from './three.js';
import { parseColor } from './VSTOOLS.js';

export class TIM {
  [key: string]: any;

  constructor(reader) {
    this.reader = reader;
    this.id = -1;
  }

  read() {
    const r = this.reader;

    // 12 byte header

    // magic 10 00 00 00
    this.magic = r.buffer(4);

    this.bpp = r.u32(); // always 2
    this.imgLen = r.u32();

    this.dataLen = this.imgLen - 12;

    // frame buffer positioning
    this.fx = r.u16();
    this.fy = r.u16();
    this.width = r.u16(); // width in frame buffer
    this.height = r.u16(); // height in frame buffer

    this.dataPtr = r.pos;

    // skip data as we don't know what kind of texture this is
    // will read data on build
    r.skip(this.dataLen);
  }

  copyToFrameBuffer(fb) {
    const r = this.reader;

    const fx = this.fx,
      fy = this.fy;

    r.seek(this.dataPtr);

    for (let y = 0; y < this.height; ++y) {
      for (let x = 0; x < this.width; ++x) {
        const c = parseColor(r.s16());
        fb.setPixel(fx + x, fy + y, c);
      }
    }
  }

  markFrameBuffer(fb) {
    const c = [
      255,
      Math.random() * 255,
      Math.random() * 255,
      Math.random() * 255,
    ];

    for (let y = 0; y < this.height; ++y) {
      for (let x = 0; x < this.width; ++x) {
        fb.setPixel(this.fx + x, this.fy + y, c);
      }
    }
  }

  buildCLUT(x, y) {
    const r = this.reader;

    const ox = x - this.fx;
    const oy = y - this.fy;

    r.seek(this.dataPtr + (oy * this.width + ox) * 2);

    const buffer = new Uint16Array(16);

    for (let i = 0; i < 16; ++i) {
      buffer[i] = r.u16();
    }

    return buffer;
  }

  /**
   * @param {'opaque' | 'semiOpaque' | 'semiBlend' | 'semiFull' | boolean} mode
   * @returns {'opaque' | 'semiOpaque' | 'semiBlend' | 'semiFull'}
   */
  static normalizeMode(mode) {
    if (mode === true) return 'semiFull';
    if (mode === false) return 'opaque';
    if (
      mode === 'semiOpaque' ||
      mode === 'semiBlend' ||
      mode === 'semiFull'
    ) {
      return mode;
    }
    return 'opaque';
  }

  /**
   * @param {number} rawColor
   * @param {'opaque' | 'semiOpaque' | 'semiBlend' | 'semiFull' | boolean} mode
   */
  static decodeTexel(rawColor, mode = 'opaque') {
    const normalizedMode = TIM.normalizeMode(mode);

    if (rawColor === 0) {
      return [0, 0, 0, 0];
    }

    const stp = (rawColor & 0x8000) >> 15;
    const b = (rawColor & 0x7c00) >> 10;
    const g = (rawColor & 0x03e0) >> 5;
    const r = rawColor & 0x001f;

    let a = 255;
    const isBlack = r === 0 && g === 0 && b === 0;

    if (isBlack) {
      if (!stp) {
        a = 0;
      } else {
        a = normalizedMode === 'semiBlend' ? 0 : 255;
      }
    } else if (normalizedMode === 'semiOpaque') {
      a = stp ? 0 : 255;
    } else if (
      normalizedMode === 'semiBlend' ||
      normalizedMode === 'semiFull'
    ) {
      a = stp ? 128 : normalizedMode === 'semiBlend' ? 0 : 255;
    }

    return [r * 8, g * 8, b * 8, a];
  }

  /**
   * @param {Uint16Array} clut
   * @param {'opaque' | 'semiOpaque' | 'semiBlend' | 'semiFull' | boolean} mode
   */
  build(clut, mode = 'opaque') {
    const normalizedMode = TIM.normalizeMode(mode);

    const r = this.reader;

    const width = this.width;
    const height = this.height;

    r.seek(this.dataPtr);

    const size = width * height * 16;
    const buffer = new Uint8Array(size);

    for (let i = 0; i < size; i += 8) {
      const c = r.u8();

      const hi = (c & 0xf0) >> 4;
      const lo = c & 0x0f;
      const left = TIM.decodeTexel(clut[lo], normalizedMode);
      const right = TIM.decodeTexel(clut[hi], normalizedMode);

      buffer[i + 0] = left[0];
      buffer[i + 1] = left[1];
      buffer[i + 2] = left[2];
      buffer[i + 3] = left[3];

      buffer[i + 4] = right[0];
      buffer[i + 5] = right[1];
      buffer[i + 6] = right[2];
      buffer[i + 7] = right[3];
    }

    const texture = new DataTexture(buffer, width * 4, height, RGBAFormat);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
  }
}
