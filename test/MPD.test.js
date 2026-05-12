import { testFiles } from './util.js';
import { test } from './util.js';
import { MPD } from '../dist/MPD.js';
import { Reader } from '../dist/Reader.js';
import * as assert from 'assert';

testFiles({
  label: 'MPD',
  dir: 'data/MAP',
  filter: (it) => it.match(/\.MPD$/),
  test: (file, buffer) => {
    const reader = new Reader(buffer);
    const it = new MPD(reader);
    it.read();
  },
});

test({
  label: 'MPD traps',
  test() {
    const buffer = new ArrayBuffer(48 + 96 + 4 + 36);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    view.setUint32(0x00, 0x30, true);
    view.setUint32(0x04, 0x88, true);

    view.setUint32(0x30, 4, true);
    view.setUint32(0x34, 0, true);
    view.setUint32(0x38, 0, true);
    view.setUint32(0x3c, 0, true);
    view.setUint32(0x40, 0, true);
    view.setUint32(0x44, 0, true);
    view.setUint32(0x48, 0, true);
    view.setUint32(0x4c, 0, true);
    view.setUint32(0x50, 36, true);

    view.setUint32(0x90, 0, true);

    let pos = 0x94;

    function writeTrap(tileX, tileY, tileZ, trapId, state, argA, argB) {
      view.setInt16(pos + 0x00, tileX, true);
      view.setInt16(pos + 0x02, tileY, true);
      view.setInt16(pos + 0x04, tileZ, true);
      view.setUint16(pos + 0x06, trapId, true);
      view.setInt16(pos + 0x08, state, true);
      view.setInt8(pos + 0x0a, argA);
      view.setInt8(pos + 0x0b, argB);
      pos += 0x0c;
    }

    writeTrap(3, 10, 0, 0x07, 0, 0, 0);
    writeTrap(8, 6, 0, 0x0c, 1, 4, 2);
    writeTrap(4, 4, 0, 0x10, 0, 0, 0);

    const it = new MPD(new Reader(u8));
    it.read();

    assert.deepEqual(
      it.traps.map((trap) => ({
        tileX: trap.tileX,
        tileY: trap.tileY,
        trapId: trap.trapId,
        name: trap.name,
      })),
      [
        {
          tileX: 3,
          tileY: 10,
          trapId: 0x07,
          name: 'Poison',
        },
        {
          tileX: 8,
          tileY: 6,
          trapId: 0x0c,
          name: 'Heal',
        },
      ]
    );
  },
});

test({
  label: 'MPD enemies',
  test() {
    const buffer = new ArrayBuffer(0x94 + 0x50);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    view.setUint32(0x00, 0x30, true);
    view.setUint32(0x04, 0x64, true);
    view.setUint32(0x20, 0x94, true);
    view.setUint32(0x24, 0x50, true);

    view.setUint32(0x30, 4, true);

    view.setUint32(0x90, 0, true);

    let pos = 0x94;

    function writeEnemy({
      deleted,
      mpdEnemyId,
      zndEnemyId,
      localTrigger,
      storyTrigger,
      localTriggerParam1,
      localTriggerParam2,
      posX,
      posY,
      directionRaw,
      initialState,
    }) {
      view.setUint8(pos + 0x00, deleted);
      view.setUint8(pos + 0x01, mpdEnemyId);
      view.setUint8(pos + 0x04, zndEnemyId);
      view.setUint8(pos + 0x07, localTrigger);
      view.setUint8(pos + 0x08, storyTrigger);
      view.setUint8(pos + 0x0a, localTriggerParam1);
      view.setUint8(pos + 0x0b, localTriggerParam2);
      view.setUint8(pos + 0x0c, posX);
      view.setUint8(pos + 0x0e, posY);
      view.setUint8(pos + 0x0f, directionRaw);
      view.setUint8(pos + 0x26, initialState);
      pos += 0x28;
    }

    writeEnemy({
      deleted: 0,
      mpdEnemyId: 1,
      zndEnemyId: 2,
      localTrigger: 3,
      storyTrigger: 4,
      localTriggerParam1: 0xaa,
      localTriggerParam2: 0xbb,
      posX: 9,
      posY: 11,
      directionRaw: 1,
      initialState: 5,
    });
    writeEnemy({
      deleted: 1,
      mpdEnemyId: 2,
      zndEnemyId: 7,
      localTrigger: 0,
      storyTrigger: 0,
      localTriggerParam1: 0,
      localTriggerParam2: 0,
      posX: 1,
      posY: 2,
      directionRaw: 3,
      initialState: 0,
    });

    const it = new MPD(new Reader(u8));
    it.read();

    assert.deepEqual(
      it.enemies.map((enemy) => ({
        deleted: enemy.deleted,
        mpdEnemyId: enemy.mpdEnemyId,
        zndEnemyId: enemy.zndEnemyId,
        localTrigger: enemy.localTrigger,
        storyTrigger: enemy.storyTrigger,
        posX: enemy.posX,
        posY: enemy.posY,
        directionRaw: enemy.directionRaw,
        initialState: enemy.initialState,
      })),
      [
        {
          deleted: 0,
          mpdEnemyId: 1,
          zndEnemyId: 2,
          localTrigger: 3,
          storyTrigger: 4,
          posX: 9,
          posY: 11,
          directionRaw: 1,
          initialState: 5,
        },
        {
          deleted: 1,
          mpdEnemyId: 2,
          zndEnemyId: 7,
          localTrigger: 0,
          storyTrigger: 0,
          posX: 1,
          posY: 2,
          directionRaw: 3,
          initialState: 0,
        },
      ]
    );
  },
});
