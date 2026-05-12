import {
  AnimationMixer,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from './three.js';
import { MPDGroup } from './MPDGroup.js';
import { convertText } from './Text.js';
import { cloneMeshWithPose } from './VSTOOLS.js';

const TRAP_NAME_BY_RAW_ID = {
  0x00: 'Death Vapor',
  0x01: 'Eruption',
  0x02: 'Freeze',
  0x03: 'Gust',
  0x04: 'Terra Thrust',
  0x05: 'Holy Light',
  0x06: 'Diabolos',
  0x07: 'Poison',
  0x08: 'Paralysis',
  0x0b: 'Curse',
  0x0c: 'Heal',
  0x0d: 'Cure',
  0x0f: 'Trap Clear',
};
const TRAP_GRID_UNIT = 128;
const TRAP_GRID_ORIGIN_OFFSET = 64;
const TRAP_PANEL_SIZE = 128;
const TRAP_PANEL_LIFT = 2;
const TRAP_LABEL_LIFT = 128;
const TRAP_DISPLAY_FRAME_WIDTH = 32;
const TRAP_DISPLAY_FRAME_HEIGHT = 32;
const TRAP_DISPLAY_FRAME_COUNT = 5;
const TRAP_DISPLAY_FRAME_Y = 96;
const TRAP_DISPLAY_FRAME_START_X = 32;
const TRAP_DISPLAY_FPS = 6;
const TRAP_DISPLAY_MIN_TRANSPARENT_PIXELS = 2000;
const TRAP_DISPLAY_TEXTURE_ID = 6;
const TRAP_DISPLAY_CLUT_ID = 14515;
const ROOM_GRID_UNIT = 256;
const ROOM_GRID_ORIGIN_OFFSET = 64;
const ROOM_WORLD_SCALE = 0.05;
const ENEMY_LABEL_WORLD_LIFT = 28;
const ENEMY_LABEL_WORLD_SCALE = 0.075;
const ENEMY_DIRECTION_LABELS = ['South', 'West', 'North', 'East'];

export class MPD {
  [key: string]: any;

  constructor(reader, znd) {
    this.reader = reader;
    this.znd = znd;
  }

  read() {
    this.header();
    this.roomHeader();
    this.roomSection();
    this.enemySection();
    //this.clearedSection();
    //this.scriptSection();
  }

  header() {
    const r = this.reader;

    this.ptrRoomSection = r.u32();
    this.lenRoomSection = r.u32();
    this.ptrClearedSection = r.u32();
    this.lenClearedSection = r.u32();
    this.ptrScriptSection = r.u32();
    this.lenScriptSection = r.u32();
    this.ptrDoorSection = r.u32();
    this.lenDoorSection = r.u32();
    this.ptrEnemySection = r.u32();
    this.lenEnemySection = r.u32();
    this.ptrTreasureSection = r.u32();
    this.lenTreasureSection = r.u32();
  }

  roomHeader() {
    const r = this.reader;

    this.lenGeometrySection = r.u32();
    this.lenCollisionSection = r.u32();
    this.lenSubSection03 = r.u32();
    this.lenDoorSectionRoom = r.u32();
    this.lenLightingSection = r.u32();

    this.lenSubSection06 = r.u32();
    this.lenSubSection07 = r.u32();
    this.lenSubSection08 = r.u32();
    this.lenSubSection09 = r.u32();
    this.lenSubSection0A = r.u32();
    this.lenSubSection0B = r.u32();

    this.lenTextureEffectsSection = r.u32();

    this.lenSubSection0D = r.u32();
    this.lenSubSection0E = r.u32();
    this.lenSubSection0F = r.u32();
    this.lenSubSection10 = r.u32();
    this.lenSubSection11 = r.u32();
    this.lenSubSection12 = r.u32();
    this.lenSubSection13 = r.u32();

    this.lenAKAOSubSection = r.u32();

    this.lenSubSection15 = r.u32();
    this.lenSubSection16 = r.u32();
    this.lenSubSection17 = r.u32();
    this.lenSubSection18 = r.u32();
  }

  roomSection() {
    this.geometrySection();
    this.collisionSection();
    this.SubSection03();
    this.doorSectionRoom();
    this.lightingSection();
    this.SubSection06();
    this.SubSection07();
    this.SubSection08();
    this.SubSection09();
    this.SubSection0A();
    this.SubSection0B();
    this.textureEffectsSection();
    this.SubSection0D();
    this.SubSection0E();
    this.SubSection0F();
    this.SubSection10();
    this.SubSection11();
    this.SubSection12();
    this.SubSection13();
    this.akaoSubSection();
    this.SubSection15();
    this.SubSection16();
    this.SubSection17();
    this.SubSection18();
  }

  geometrySection() {
    const r = this.reader;

    this.numGroups = r.u32();
    this.groups = [];

    for (let i = 0; i < this.numGroups; ++i) {
      this.groups[i] = new MPDGroup(this.reader, this);
      this.groups[i].header();
    }

    for (let i = 0; i < this.numGroups; ++i) {
      this.groups[i].data();
    }
  }

  collisionSection() {
    const r = this.reader;

    if (this.lenCollisionSection >= 8) {
      this.collisionWidth = r.u16();
      this.collisionHeight = r.u16();
      this.collisionUnknownA = r.u16();
      this.collisionUnknownB = r.u16();
      r.skip(this.lenCollisionSection - 8);
      return;
    }

    this.reader.skip(this.lenCollisionSection);
  }

  SubSection03() {
    this.reader.skip(this.lenSubSection03);
  }

  doorSectionRoom() {
    this.reader.skip(this.lenDoorSectionRoom);
  }

  lightingSection() {
    this.reader.skip(this.lenLightingSection);
  }

  SubSection06() {
    this.reader.skip(this.lenSubSection06);
  }

  SubSection07() {
    this.reader.skip(this.lenSubSection07);
  }

  SubSection08() {
    this.reader.skip(this.lenSubSection08);
  }

  SubSection09() {
    const r = this.reader;

    this.traps = [];

    const trapCount = Math.floor(this.lenSubSection09 / 0x0c);

    for (let i = 0; i < trapCount; ++i) {
      const tileX = r.s16();
      const tileY = r.s16();
      const tileZ = r.s16();
      const trapId = r.u16();
      const state = r.s16();
      const argA = r.s8();
      const argB = r.s8();
      const name = TRAP_NAME_BY_RAW_ID[trapId];

      if (!name) continue;

      this.traps.push({
        tileX,
        tileY,
        tileZ,
        trapId,
        state,
        argA,
        argB,
        name,
      });
    }

    const remaining = this.lenSubSection09 - trapCount * 0x0c;
    if (remaining > 0) {
      r.skip(remaining);
    }
  }

  SubSection0A() {
    this.reader.skip(this.lenSubSection0A);
  }

  SubSection0B() {
    this.reader.skip(this.lenSubSection0B);
  }

  textureEffectsSection() {
    this.reader.skip(this.lenTextureEffectsSection);
  }

  SubSection0D() {
    this.reader.skip(this.lenSubSection0D);
  }

  SubSection0E() {
    this.reader.skip(this.lenSubSection0E);
  }

  SubSection0F() {
    this.reader.skip(this.lenSubSection0F);
  }

  SubSection10() {
    this.reader.skip(this.lenSubSection10);
  }

  SubSection11() {
    this.reader.skip(this.lenSubSection11);
  }

  SubSection12() {
    this.reader.skip(this.lenSubSection12);
  }

  SubSection13() {
    this.reader.skip(this.lenSubSection13);
  }

  akaoSubSection() {
    this.reader.skip(this.lenAKAOSubSection);
  }

  SubSection15() {
    this.reader.skip(this.lenSubSection15);
  }

  SubSection16() {
    this.reader.skip(this.lenSubSection16);
  }

  SubSection17() {
    this.reader.skip(this.lenSubSection17);
  }

  SubSection18() {
    this.reader.skip(this.lenSubSection18);
  }

  clearedSection() {
    this.reader.skip(this.lenClearedSection);
  }

  enemySection() {
    const r = this.reader;

    this.enemies = [];

    if (!this.ptrEnemySection || this.lenEnemySection <= 0) {
      return;
    }

    const end = this.ptrEnemySection + this.lenEnemySection;
    r.seek(this.ptrEnemySection);

    while (r.pos + 0x28 <= end) {
      this.enemies.push({
        deleted: r.u8(),
        mpdEnemyId: r.u8(),
        unknown02: r.u8(),
        unknown03: r.u8(),
        zndEnemyId: r.u8(),
        bossFlag: r.u8(),
        storyEventOutcome: r.u8(),
        localTrigger: r.u8(),
        storyTrigger: r.u8(),
        unknown09: r.u8(),
        localTriggerParam1: r.u8(),
        localTriggerParam2: r.u8(),
        posX: r.u8(),
        posUnknown: r.u8(),
        posY: r.u8(),
        directionRaw: r.u8(),
        behavior: r.u8(),
        unknown11: r.u8(),
        unknown12: r.u8(),
        unknown13: r.u8(),
        unknown14: r.u8(),
        unknown15: r.u8(),
        unknown16: r.u8(),
        unknown17: r.u8(),
        unknown18: r.u8(),
        unknown19: r.u8(),
        alwaysDrop1: r.u16(),
        alwaysDrop2: r.u16(),
        randomDrop: r.u16(),
        alwaysDrop1Qty: r.u8(),
        alwaysDrop2Qty: r.u8(),
        randomDropPercent: r.u8(),
        unknown23: r.u8(),
        majorBoss: r.u8(),
        modelTexture: r.u8(),
        initialState: r.u8(),
        unknown27: r.u8(),
      });
    }
  }

  scriptSection() {
    const r = this.reader;

    r.u16(); // len

    this.ptrDialogText = r.u16();

    r.skip(this.ptrDialogText);

    const s = r.buffer(700);
    convertText(s, 700); // text
  }

  //

  build() {
    const groups = this.groups,
      numGroups = this.numGroups;

    this.mesh = new Object3D();

    for (let i = 0; i < numGroups; ++i) {
      const group = groups[i];
      group.build();

      for (const id in group.meshes) {
        this.mesh.add(group.meshes[id].mesh);
      }
    }

    this.buildTrapOverlay();
    this.buildEnemyOverlay();
  }

  setMaterial(mat) {
    const groups = this.groups,
      numGroups = this.numGroups;

    for (let i = 0; i < numGroups; ++i) {
      const group = groups[i];

      for (const id in group.meshes) {
        group.meshes[id].mesh.material = mat;
      }
    }
  }

  buildTrapOverlay() {
    if (!this.traps || this.traps.length === 0) return;

    const bounds = this.computeTrapBounds();
    const surfaces = this.collectTrapSurfaces();
    const trapPanelMaterial = this.createTrapPanelMaterial();
    const overlay = new Object3D();
    overlay.name = 'mpd-traps';
    overlay.rotation.x = Math.PI;
    overlay.scale.set(0.1, 0.1, 0.1);

    for (const trap of this.traps) {
      const position = this.getTrapWorldPosition(trap);
      const surfaceY = this.estimateTrapSurfaceY(
        position.x,
        position.z,
        surfaces,
        bounds,
        position.y
      );
      const panel = new Mesh(
        new PlaneGeometry(TRAP_PANEL_SIZE, TRAP_PANEL_SIZE),
        trapPanelMaterial
      );

      panel.rotation.x = Math.PI / 2;
      panel.position.set(position.x, surfaceY - TRAP_PANEL_LIFT, position.z);
      panel.onBeforeRender = () => {
        this.updateTrapPanelAnimation();
      };
      panel.renderOrder = 1;
      overlay.add(panel);

      const label = this.createTrapLabel(trap.name);
      if (label) {
        label.position.set(position.x, surfaceY - TRAP_LABEL_LIFT, position.z);
        label.renderOrder = 2;
        overlay.add(label);
      }
    }

    this.trapOverlay = overlay;
    this.mesh.add(overlay);
  }

  buildEnemyOverlay() {
    if (!this.enemies || this.enemies.length === 0) return;
    if (!this.znd?.enemyZuds || this.znd.enemyZuds.length === 0) return;

    const bounds = this.computeTrapBounds();
    const surfaces = this.collectTrapSurfaces();
    const overlay = new Object3D();
    overlay.name = 'mpd-enemies';

    for (const enemy of this.enemies) {
      if (enemy.deleted !== 0) continue;

      const zud = this.znd.getEnemyZud?.(enemy.zndEnemyId);
      if (!zud?.shp?.mesh) continue;

      const position = this.getEnemyWorldPosition(enemy);
      const surfaceY = this.estimateTrapSurfaceY(
        position.x,
        position.z,
        surfaces,
        bounds,
        0
      );
      const model = this.buildEnemyModel(zud, enemy);

      if (!model) continue;

      const container = new Object3D();
      container.name = `enemy-${enemy.mpdEnemyId}`;
      container.position.set(
        position.x * ROOM_WORLD_SCALE,
        -surfaceY * ROOM_WORLD_SCALE,
        -position.z * ROOM_WORLD_SCALE
      );
      container.scale.setScalar(ROOM_WORLD_SCALE);
      container.rotation.y = this.getEnemyFacingRotation(enemy.directionRaw);
      container.add(model);
      overlay.add(container);

      const label = this.createEnemyLabel(enemy, zud);
      if (label) {
        label.position.set(
          position.x * ROOM_WORLD_SCALE,
          -surfaceY * ROOM_WORLD_SCALE + ENEMY_LABEL_WORLD_LIFT,
          -position.z * ROOM_WORLD_SCALE
        );
        label.renderOrder = 2;
        overlay.add(label);
      }
    }

    this.enemyOverlay = overlay;
    this.mesh.add(overlay);
  }

  buildEnemyModel(zud, enemy) {
    const shp = zud?.shp;
    const mesh = shp?.mesh;

    if (!shp || !mesh) return null;

    this.applyEnemyPose(zud, enemy);

    const posed = cloneMeshWithPose(mesh);
    posed.rotation.copy(mesh.rotation);
    posed.position.copy(mesh.position);
    posed.scale.copy(mesh.scale);
    posed.updateMatrixWorld(true);
    posed.renderOrder = 1;

    shp.buildTPose();

    return posed;
  }

  applyEnemyPose(zud, enemy) {
    const shp = zud?.shp;
    const sequence = this.pickEnemySequence(zud);
    const animationId = this.pickEnemyAnimationId(sequence, enemy.initialState);

    if (!shp) return;

    shp.buildTPose();

    if (
      !sequence ||
      animationId === null ||
      !sequence.animations?.[animationId]?.animationClip
    ) {
      return;
    }

    const mixer = new AnimationMixer(shp.mesh);
    const action = mixer.clipAction(
      sequence.animations[animationId].animationClip,
      shp.mesh
    );
    action.play();
    mixer.update(0);
    shp.mesh.skeleton?.update();
    shp.mesh.updateMatrixWorld(true);
  }

  pickEnemySequence(zud) {
    if (zud?.bt?.animations?.length) return zud.bt;
    if (zud?.com?.animations?.length) return zud.com;
    return null;
  }

  pickEnemyAnimationId(sequence, initialState) {
    if (!sequence?.animations?.length) {
      return null;
    }

    const slotAnimationId = sequence.slots?.[initialState];
    if (
      Number.isInteger(slotAnimationId) &&
      slotAnimationId >= 0 &&
      slotAnimationId < sequence.animations.length
    ) {
      return slotAnimationId;
    }

    if (initialState >= 0 && initialState < sequence.animations.length) {
      return initialState;
    }

    return 0;
  }

  getEnemyFacingRotation(directionRaw) {
    switch (directionRaw & 0x03) {
      case 0:
        return 0;
      case 1:
        return Math.PI / 2;
      case 2:
        return Math.PI;
      case 3:
        return -Math.PI / 2;
      default:
        return 0;
    }
  }

  getEnemyWorldPosition(enemy) {
    return {
      x: enemy.posX * ROOM_GRID_UNIT + ROOM_GRID_ORIGIN_OFFSET,
      z: enemy.posY * ROOM_GRID_UNIT + ROOM_GRID_ORIGIN_OFFSET,
    };
  }

  createEnemyLabel(enemy, zud) {
    if (typeof document === 'undefined') return null;

    const lines = [
      this.getEnemyDisplayName(enemy, zud),
      this.formatEnemyTriggerLabel(enemy),
    ];

    const material = this.createLabelMaterial(lines.join('\n'), {
      accent: '#80d8ff',
    });
    if (!material) return null;

    const sprite = new Sprite(material);
    const image = material.map?.image;
    const width = image?.width || 320;
    const height = image?.height || 96;

    sprite.scale.set(
      width * ENEMY_LABEL_WORLD_SCALE,
      height * ENEMY_LABEL_WORLD_SCALE,
      1
    );

    return sprite;
  }

  getEnemyDisplayName(enemy, zud) {
    const stem = zud?.viewerMeta?.stem || zud?.viewerMeta?.name || 'Enemy';
    return `${stem} (${this.hexByte(enemy.zndEnemyId)})`;
  }

  formatEnemyTriggerLabel(enemy) {
    const local = enemy.localTrigger
      ? `L${this.hexByte(enemy.localTrigger)}(${this.hexByte(enemy.localTriggerParam1)},${this.hexByte(enemy.localTriggerParam2)})`
      : 'L--';
    const story = enemy.storyTrigger
      ? `S${this.hexByte(enemy.storyTrigger)}`
      : 'S--';
    const outcome = enemy.storyEventOutcome
      ? ` -> ${this.hexByte(enemy.storyEventOutcome)}`
      : '';
    const direction = ENEMY_DIRECTION_LABELS[enemy.directionRaw & 0x03] || '?';

    return `${local} | ${story}${outcome} | ${direction} | pose ${this.hexByte(enemy.initialState)}`;
  }

  createLabelMaterial(text, options: any = {}) {
    if (typeof document === 'undefined') return null;

    this.labelMaterials = this.labelMaterials || new Map();

    const accent = options.accent || '#ffcc66';
    const cacheKey = `${accent}:${text}`;
    let material = this.labelMaterials.get(cacheKey);

    if (material) {
      return material;
    }

    const lines = String(text).split('\n');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    const fontSize = 30;
    const lineGap = 8;
    const paddingX = 20;
    const paddingY = 16;
    const lineHeight = fontSize + lineGap;

    context.font = `bold ${fontSize}px sans-serif`;
    const textWidth = Math.max(
      ...lines.map((line) => Math.ceil(context.measureText(line).width)),
      1
    );

    canvas.width = textWidth + paddingX * 2;
    canvas.height =
      lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap + paddingY * 2;

    context.font = `bold ${fontSize}px sans-serif`;
    context.fillStyle = 'rgba(12, 18, 24, 0.86)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 3;
    context.strokeStyle = accent;
    context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'top';

    lines.forEach((line, index) => {
      const y = paddingY + index * lineHeight;
      context.fillText(line, canvas.width / 2, y);
    });

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;

    material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    this.labelMaterials.set(cacheKey, material);

    return material;
  }

  hexByte(value) {
    return value.toString(16).toUpperCase().padStart(2, '0');
  }

  createTrapPanelMaterial() {
    if (this.trapPanelMaterial) {
      return this.trapPanelMaterial;
    }

    const animatedTexture = this.createTrapPanelTexture();
    if (animatedTexture) {
      this.trapPanelMaterial = new MeshBasicMaterial({
        map: animatedTexture,
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false,
      });
      return this.trapPanelMaterial;
    }

    this.trapPanelMaterial = new MeshBasicMaterial({
      color: 0xffc857,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    return this.trapPanelMaterial;
  }

  createTrapPanelTexture() {
    if (typeof document === 'undefined') return null;

    const sourceTexture = this.findTrapPanelSourceTexture();
    const sourceImage = sourceTexture?.image;
    const sourceData = sourceImage?.data;
    const sourceWidth = sourceImage?.width;
    const sourceHeight = sourceImage?.height;

    if (
      !sourceData ||
      !sourceWidth ||
      !sourceHeight ||
      sourceWidth <
      TRAP_DISPLAY_FRAME_START_X +
      TRAP_DISPLAY_FRAME_WIDTH * TRAP_DISPLAY_FRAME_COUNT ||
      sourceHeight < TRAP_DISPLAY_FRAME_Y + TRAP_DISPLAY_FRAME_HEIGHT ||
      sourceWidth < TRAP_DISPLAY_FRAME_WIDTH ||
      sourceHeight < TRAP_DISPLAY_FRAME_HEIGHT
    ) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = TRAP_DISPLAY_FRAME_WIDTH;
    canvas.height = TRAP_DISPLAY_FRAME_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) return null;

    const imageData = context.createImageData(
      TRAP_DISPLAY_FRAME_WIDTH,
      TRAP_DISPLAY_FRAME_HEIGHT
    );
    const texture = new CanvasTexture(canvas);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.needsUpdate = true;

    this.trapPanelAnimation = {
      context,
      imageData,
      texture,
      sourceData,
      sourceWidth,
      sourceHeight,
      transparentColorKey:
        this.getTrapPanelTransparentColorKey(sourceTexture),
      lastFrame: -1,
    };

    this.drawTrapPanelFrame(0);

    return texture;
  }

  findTrapPanelSourceTexture() {
    const preferredTexture = this.getTrapPanelPreferredTexture();
    if (preferredTexture) {
      return preferredTexture;
    }

    let bestTexture = null;
    let bestScore = 0;
    const seen = new Set();
    const textures = [];

    for (const group of this.groups || []) {
      for (const id in group.meshes) {
        const texture = this.getMaterialTexture(group.meshes[id].material);
        const key = this.getTrapPanelTextureKey(texture);

        if (!key || seen.has(key)) continue;

        seen.add(key);
        textures.push(texture);
      }
    }

    for (const texture of this.znd?.textures || []) {
      const key = this.getTrapPanelTextureKey(texture);

      if (!key || seen.has(key)) continue;

      seen.add(key);
      textures.push(texture);
    }

    for (const texture of textures) {
      const score = this.scoreTrapPanelSourceTexture(texture);

      if (score > bestScore) {
        bestScore = score;
        bestTexture = texture;
      }
    }

    return bestTexture;
  }

  getTrapPanelPreferredTexture() {
    const material = this.znd?.getMaterial?.(
      TRAP_DISPLAY_TEXTURE_ID,
      TRAP_DISPLAY_CLUT_ID
    );
    const texture = this.getMaterialTexture(material);

    return this.isTrapPanelSourceTextureUsable(texture) ? texture : null;
  }

  getMaterialTexture(material) {
    return material?.map || material?.uniforms?.map?.value || null;
  }

  getTrapPanelTextureKey(texture) {
    const image = texture?.image;

    if (!image?.data || !image?.width || !image?.height) {
      return null;
    }

    return `${texture?.title || 'untitled'}:${image.width}x${image.height}`;
  }

  scoreTrapPanelSourceTexture(texture) {
    const image = texture?.image;
    const data = image?.data;
    const width = image?.width;
    const height = image?.height;

    if (!this.isTrapPanelSourceTextureUsable(texture)) {
      return 0;
    }

    let opaqueCount = 0;
    let transparentCount = 0;

    for (let y = 0; y < TRAP_DISPLAY_FRAME_HEIGHT; ++y) {
      const sourceRow = height - (TRAP_DISPLAY_FRAME_Y + y) - 1;

      for (
        let x = TRAP_DISPLAY_FRAME_START_X;
        x <
        TRAP_DISPLAY_FRAME_START_X +
        TRAP_DISPLAY_FRAME_WIDTH * TRAP_DISPLAY_FRAME_COUNT;
        ++x
      ) {
        const alpha = data[(sourceRow * width + x) * 4 + 3];

        if (alpha < 16) {
          ++transparentCount;
        } else {
          ++opaqueCount;
        }
      }
    }

    if (
      opaqueCount === 0 ||
      transparentCount < TRAP_DISPLAY_MIN_TRANSPARENT_PIXELS
    ) {
      return 0;
    }

    return transparentCount;
  }

  isTrapPanelSourceTextureUsable(texture) {
    const image = texture?.image;
    const data = image?.data;
    const width = image?.width;
    const height = image?.height;

    return !!(
      data &&
      width &&
      height &&
      width >=
      TRAP_DISPLAY_FRAME_START_X +
      TRAP_DISPLAY_FRAME_WIDTH * TRAP_DISPLAY_FRAME_COUNT &&
      height >= TRAP_DISPLAY_FRAME_Y + TRAP_DISPLAY_FRAME_HEIGHT
    );
  }

  getTrapPanelTransparentColorKey(texture) {
    if (
      texture?.title !==
      `${TRAP_DISPLAY_TEXTURE_ID}-${TRAP_DISPLAY_CLUT_ID}`
    ) {
      return null;
    }

    const image = texture?.image;
    const data = image?.data;
    const width = image?.width;
    const height = image?.height;

    if (!data || !width || !height) {
      return null;
    }

    const counts = new Map();

    for (let y = 0; y < TRAP_DISPLAY_FRAME_HEIGHT; ++y) {
      const sourceRow = height - (TRAP_DISPLAY_FRAME_Y + y) - 1;

      for (
        let x = TRAP_DISPLAY_FRAME_START_X;
        x <
        TRAP_DISPLAY_FRAME_START_X +
        TRAP_DISPLAY_FRAME_WIDTH * TRAP_DISPLAY_FRAME_COUNT;
        ++x
      ) {
        const sourceIndex = (sourceRow * width + x) * 4;
        const alpha = data[sourceIndex + 3];

        if (alpha < 16) continue;

        const key = `${data[sourceIndex + 0]},${data[sourceIndex + 1]},${data[sourceIndex + 2]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    let bestKey = null;
    let bestCount = 0;

    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestKey = key;
      }
    }

    return bestKey;
  }

  faceUsesTrapPanelStrip(face) {
    const stripMinX = TRAP_DISPLAY_FRAME_START_X;
    const stripMaxX =
      TRAP_DISPLAY_FRAME_START_X +
      TRAP_DISPLAY_FRAME_WIDTH * TRAP_DISPLAY_FRAME_COUNT;
    const stripMinY = TRAP_DISPLAY_FRAME_Y;
    const stripMaxY = TRAP_DISPLAY_FRAME_Y + TRAP_DISPLAY_FRAME_HEIGHT;
    const uvs = [face.u1, face.u2, face.u3];
    const vs = [face.v1, face.v2, face.v3];

    if (face.quad) {
      uvs.push(face.u4);
      vs.push(face.v4);
    }

    const minU = Math.min(...uvs);
    const maxU = Math.max(...uvs);
    const minV = Math.min(...vs);
    const maxV = Math.max(...vs);

    return (
      maxU >= stripMinX &&
      minU < stripMaxX &&
      maxV >= stripMinY &&
      minV < stripMaxY
    );
  }

  updateTrapPanelAnimation() {
    if (!this.trapPanelAnimation) return;

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const frame =
      Math.floor((now / 1000) * TRAP_DISPLAY_FPS) % TRAP_DISPLAY_FRAME_COUNT;

    this.drawTrapPanelFrame(frame);
  }

  drawTrapPanelFrame(frame) {
    const animation = this.trapPanelAnimation;
    if (!animation || animation.lastFrame === frame) return;

    const frameX = TRAP_DISPLAY_FRAME_START_X + frame * TRAP_DISPLAY_FRAME_WIDTH;
    const frameY = TRAP_DISPLAY_FRAME_Y;
    const {
      context,
      imageData,
      sourceData,
      sourceWidth,
      sourceHeight,
      texture,
      transparentColorKey,
    } = animation;

    for (let y = 0; y < TRAP_DISPLAY_FRAME_HEIGHT; ++y) {
      const sourceRow = sourceHeight - (frameY + y) - 1;

      for (let x = 0; x < TRAP_DISPLAY_FRAME_WIDTH; ++x) {
        const sourceIndex = (sourceRow * sourceWidth + frameX + x) * 4;
        const targetIndex = (y * TRAP_DISPLAY_FRAME_WIDTH + x) * 4;
        const r = sourceData[sourceIndex + 0];
        const g = sourceData[sourceIndex + 1];
        const b = sourceData[sourceIndex + 2];
        const a =
          transparentColorKey &&
            `${r},${g},${b}` === transparentColorKey
            ? 0
            : sourceData[sourceIndex + 3];

        imageData.data[targetIndex + 0] = r;
        imageData.data[targetIndex + 1] = g;
        imageData.data[targetIndex + 2] = b;
        imageData.data[targetIndex + 3] = a;
      }
    }

    context.putImageData(imageData, 0, 0);
    texture.needsUpdate = true;
    animation.lastFrame = frame;
  }

  getTrapWorldPosition(trap) {
    return {
      x: trap.tileX * TRAP_GRID_UNIT + TRAP_GRID_ORIGIN_OFFSET,
      y: trap.tileZ * TRAP_GRID_UNIT,
      z: trap.tileY * TRAP_GRID_UNIT + TRAP_GRID_ORIGIN_OFFSET,
    };
  }

  computeTrapBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const group of this.groups || []) {
      for (const id in group.meshes) {
        for (const face of group.meshes[id].faces || []) {
          const points = [face.p1, face.p2, face.p3];
          if (face.p4) points.push(face.p4);

          for (const point of points) {
            if (!point) continue;
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            minZ = Math.min(minZ, point.z);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
            maxZ = Math.max(maxZ, point.z);
          }
        }
      }
    }

    if (
      Number.isFinite(minX) &&
      Number.isFinite(minY) &&
      Number.isFinite(minZ) &&
      Number.isFinite(maxX) &&
      Number.isFinite(maxY) &&
      Number.isFinite(maxZ)
    ) {
      return { minX, minY, minZ, maxX, maxY, maxZ };
    }

    const trapMaxX = Math.max(...this.traps.map((trap) => trap.tileX), 0);
    const trapMaxZ = Math.max(...this.traps.map((trap) => trap.tileY), 0);

    return {
      minX: 0,
      minY: 0,
      minZ: 0,
      maxX: trapMaxX * TRAP_GRID_UNIT + TRAP_GRID_ORIGIN_OFFSET,
      maxY: 0,
      maxZ: trapMaxZ * TRAP_GRID_UNIT + TRAP_GRID_ORIGIN_OFFSET,
    };
  }

  collectTrapSurfaces() {
    const surfaces = [];

    for (const group of this.groups || []) {
      for (const id in group.meshes) {
        for (const face of group.meshes[id].faces || []) {
          if (!face.p1 || !face.p2 || !face.p3) continue;

          this.addTrapSurface(surfaces, face.p1, face.p2, face.p3);
          if (face.p4) {
            this.addTrapSurface(surfaces, face.p1, face.p3, face.p4);
          }
        }
      }
    }

    return surfaces;
  }

  addTrapSurface(surfaces, a, b, c) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const normalY = abz * acx - abx * acz;

    if (Math.abs(normalY) < 1) return;

    surfaces.push({
      a,
      b,
      c,
      centroid: new Vector3(
        (a.x + b.x + c.x) / 3,
        (a.y + b.y + c.y) / 3,
        (a.z + b.z + c.z) / 3
      ),
    });
  }

  estimateTrapSurfaceY(x, z, surfaces, bounds, fallbackY = 0) {
    let bestInsideY = -Infinity;
    let bestNearestDistance = Infinity;
    let bestNearestY = fallbackY ?? bounds.maxY;

    for (const surface of surfaces) {
      const y = this.interpolateTriangleY(x, z, surface.a, surface.b, surface.c);
      if (y !== null) {
        bestInsideY = Math.max(bestInsideY, y);
      }

      const dx = surface.centroid.x - x;
      const dz = surface.centroid.z - z;
      const distance = dx * dx + dz * dz;
      if (distance < bestNearestDistance) {
        bestNearestDistance = distance;
        bestNearestY = Math.max(
          surface.a.y,
          surface.b.y,
          surface.c.y
        );
      }
    }

    if (Number.isFinite(bestInsideY)) {
      return bestInsideY;
    }

    return Number.isFinite(bestNearestY) ? bestNearestY : bounds.maxY;
  }

  interpolateTriangleY(x, z, a, b, c) {
    const denominator =
      (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);

    if (Math.abs(denominator) < 0.0001) return null;

    const weightA =
      ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) /
      denominator;
    const weightB =
      ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) /
      denominator;
    const weightC = 1 - weightA - weightB;

    if (weightA < -0.001 || weightB < -0.001 || weightC < -0.001) {
      return null;
    }

    return a.y * weightA + b.y * weightB + c.y * weightC;
  }

  createTrapLabel(name) {
    if (typeof document === 'undefined') return null;

    this.trapLabelMaterials = this.trapLabelMaterials || new Map();

    let material = this.trapLabelMaterials.get(name);

    if (!material) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      const fontSize = 40;
      const paddingX = 24;
      const paddingY = 14;

      context.font = `bold ${fontSize}px sans-serif`;
      const textWidth = Math.ceil(context.measureText(name).width);

      canvas.width = textWidth + paddingX * 2;
      canvas.height = fontSize + paddingY * 2;

      context.font = `bold ${fontSize}px sans-serif`;
      context.fillStyle = 'rgba(20, 24, 28, 0.82)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 3;
      context.strokeStyle = 'rgba(255, 200, 87, 0.95)';
      context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(name, canvas.width / 2, canvas.height / 2);

      const texture = new CanvasTexture(canvas);
      texture.needsUpdate = true;

      material = new SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      this.trapLabelMaterials.set(name, material);
    }

    const sprite = new Sprite(material);
    const image = material.map?.image;
    const width = image?.width || 256;
    const height = image?.height || 64;

    sprite.scale.set(width * 0.7, height * 0.7, 1);

    return sprite;
  }
}
