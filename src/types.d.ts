export interface BinaryReader {
  data: ArrayLike<number>;
  pos: number;
  seek(position: number): this;
  skip(count: number): this;
  u8(): number;
  s8(): number;
  u16(): number;
  s16(): number;
  u32(): number;
  s32(): number;
  padding(length: number, byte?: number): this;
}

export type RgbaTuple = [number, number, number, number];

export interface PaletteSource {
  palette: RgbaTuple[];
}

export interface TextureImageData {
  data: Uint8Array | number[];
  width: number;
  height: number;
}

export interface TextureEntry {
  image: TextureImageData;
}

export interface AkaoOp {
  op: number;
  params: number[];
}

export interface AkaoChannel {
  c: number;
  ops: AkaoOp[];
  offset: number;
}
