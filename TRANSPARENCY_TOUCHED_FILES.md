# Transparency Debug Touched Files

This file tracks the transparency/debug-related changes touched in `_refs/vstools`
while investigating the MPD/ZND room rendering artifacts seen in maps like
`ZONE022 / MAP063`.

## Still Active

### `src/MPDFace.ts`
- Added `semiTransparent = (type & 0x02) !== 0`.
- Applied group offsets `decX/decY/decZ` during face build.

### `src/MPDGroup.ts`
- Replaced raw 64-byte group header blob parsing with structured fields:
  - `display`
  - `scaleFlags`
  - `overlapping`
  - `decX`
  - `decY`
  - `decZ`
- Scale logic now uses `scaleFlags & 0x08`.
- Opaque and semi-transparent faces are separated into different mesh buckets.

### `src/MPDMesh.ts`
- Constructor now carries `semiTransparent`.
- Semi-transparent room faces can now emit multiple draw meshes from one geometry.
- Room material lookup now uses `znd.getRoomMaterials(...)`.

### `src/MPD.ts`
- Room build now adds all meshes emitted by an `MPDMesh`, not just one.
- `setMaterial()` now updates every emitted mesh for a room batch.

### `src/TIM.ts`
- `buildCLUT()` now returns raw 16-bit CLUT values instead of pre-expanded RGBA.
- Added `decodeTexel(rawColor, mode)`.
- Texture build now supports:
  - normal opaque room decode
  - semi-transparent opaque-cutout pass
  - semi-transparent blend-only pass

### `src/ZND.ts`
- Material cache keys now include the room texture pass mode.
- Added `getRoomMaterials(...)` so semi-transparent room faces can render in two passes.
- Room textures are now built per pass mode.
- Blend-only room pass uses:
  - `transparent: true`
  - `depthWrite: false`
  - `alphaTest: 0.001`
  - `polygonOffset: true`
- Added fallback handling when texture page or CLUT is missing.

### `src/VSTOOLS.ts`
- Reverted `parseColor()` back to simple non-experimental behavior.
- Only minimal cleanup remains in this file.

## Touched Earlier, Then Backed Out

### `src/Viewer.ts`
- Transparent mesh sorting.
- Render-order hacks.
- Visibility/group culling attempt.
- Alpha-hash / transparency-specific viewer logic.

### `src/MPDMesh.ts`
- Quad diagonal split heuristic.

### `src/ZND.ts`
- Earlier global "all room textures transparent" / "all opaque" experiments.

### `src/VSTOOLS.ts`
- Earlier global STP alpha hack.

## Current Working Set

The remaining transparency-specific code that is still active is limited to:

- `src/MPDFace.ts`
- `src/MPDGroup.ts`
- `src/MPDMesh.ts`
- `src/TIM.ts`
- `src/ZND.ts`

## Current Fix Direction

The remaining bad section in `MAP063` came from a more specific mismatch between
PS1 textured semi-transparency and the current Three.js material model.

What was confirmed during inspection:

- The bad wall area involves exactly three semi-transparent `0x3e` quads.
- Those quads sit directly on top of matching opaque `0x3c` quads.
- They use the same texture page and CLUT as the base wall.
- On PS1, a textured semi-transparent polygon can still contain opaque texels and
  semi-transparent texels in the same face, based on the CLUT STP bit.

The current fix therefore splits `0x3e` room faces into:

- an opaque cutout pass for texels that should still write depth normally
- a blend pass for texels that actually need semi-transparency

That keeps the base opaque behavior for most of the wall while still allowing the
intended translucent overlay texels to blend on top.
