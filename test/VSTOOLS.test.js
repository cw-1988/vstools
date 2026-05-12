import { test } from './util.js';
import * as assert from 'assert';
import { cloneMeshWithPose } from '../dist/VSTOOLS.js';
import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  Skeleton,
  SkinnedMesh,
} from '../dist/three.js';

test({
  label: 'VSTOOLS cloneMeshWithPose bakes live bone transforms',
  test() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([1, 0, 0], 3));
    geometry.setAttribute(
      'skinIndex',
      new Float32BufferAttribute([0, 0, 0, 0], 4)
    );
    geometry.setAttribute(
      'skinWeight',
      new Float32BufferAttribute([1, 0, 0, 0], 4)
    );

    const bone = new Bone();
    const skeleton = new Skeleton([bone]);
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
    mesh.add(bone);
    mesh.bind(skeleton);
    mesh.updateMatrixWorld(true);

    bone.rotation.z = Math.PI / 2;
    mesh.updateWorldMatrix(true, true);

    const clone = cloneMeshWithPose(mesh);
    const position = clone.geometry.attributes.position;

    assert.ok(Number.isFinite(position.getX(0)));
    assert.ok(Number.isFinite(position.getY(0)));
    assert.ok(Number.isFinite(position.getZ(0)));
    assert.ok(Math.abs(position.getX(0)) < 1e-6);
    assert.ok(Math.abs(position.getY(0) - 1) < 1e-6);
    assert.ok(Math.abs(position.getZ(0)) < 1e-6);
  },
});
