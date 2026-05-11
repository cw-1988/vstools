import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Box3,
  AnimationMixer,
  SkeletonHelper,
  Mesh,
  MeshNormalMaterial,
  OBJExporter,
  SkinnedMesh,
  OrbitControls,
  Object3D,
  BufferGeometry,
  Vector3,
} from './three.js';
import { SHP } from './SHP.js';
import { WEP } from './WEP.js';
import { SEQ } from './SEQ.js';
import { ZND } from './ZND.js';
import { ZUD } from './ZUD.js';
import { Reader } from './Reader.js';
import { MPD } from './MPD.js';
import { ARM } from './ARM.js';
import { GIM } from './GIM.js';
import { P } from './P.js';
import { FBC } from './FBC.js';
import { FBT } from './FBT.js';
import { cloneMeshWithPose, exportPng, parseExt } from './VSTOOLS.js';
import { initUiPanel } from './ui/ui-panel.js';

/** @this {Record<string, any>} */
export function Viewer() {
  function getElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }

  function getInput(selector) {
    return /** @type {HTMLInputElement} */ (getElement(selector));
  }

  function getSelect(selector) {
    return /** @type {HTMLSelectElement} */ (getElement(selector));
  }

  const DEFAULT_WEAPON_MOUNT_ID = 2;
  const DEFAULT_SHIELD_MOUNT_ID = 3;
  const PREFERRED_BODY_PART_BY_MOUNT = {
    1: 51,
    2: 17,
    3: 34,
    4: 85,
    5: 68,
    6: 68,
  };
  const scene = (this.scene = new Scene());
  const camera = new PerspectiveCamera(75, 1, 0.1, 10000);
  const frameBox = new Box3();
  const frameSize = new Vector3();
  const frameCenter = new Vector3();

  const renderer = new WebGLRenderer();
  renderer.setClearColor(0x333333, 1);

  resize();

  const root = new Object3D();
  const helpers = new Object3D();

  scene.add(root);
  scene.add(helpers);

  document.querySelector('body').appendChild(renderer.domElement);

  camera.position.z = 500;
  const orbitControls = new OrbitControls(camera, renderer.domElement);

  const mixer = new AnimationMixer(scene);
  let mixerAction;

  function render() {
    requestAnimationFrame(render);
    orbitControls.update();
    mixer.update(0.01);
    renderer.render(scene, camera);
  }

  function resize() {
    setTimeout(function () {
      camera.aspect = (window.innerWidth - 360) / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth - 360, window.innerHeight);
    }, 1);
  }

  function frameRootObject() {
    if (root.children.length === 0) return;

    frameBox.setFromObject(root);
    if (frameBox.isEmpty()) return;

    frameBox.getSize(frameSize);
    frameBox.getCenter(frameCenter);

    const maxDim = Math.max(frameSize.x, frameSize.y, frameSize.z, 1);
    const fitHeightDistance =
      maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.35;

    camera.near = Math.max(0.1, distance / 100);
    camera.far = Math.max(10000, distance * 20);
    camera.position.set(frameCenter.x, frameCenter.y, frameCenter.z + distance);
    camera.updateProjectionMatrix();

    orbitControls.target.copy(frameCenter);
    orbitControls.update();
  }

  window.addEventListener('resize', resize);

  this.run = function () {
    render();
  };

  //

  let activeSHP, activeSEQ, activeZND, activeZUD, activeSEQLabel;
  let activeMountedEquipment = [];
  const autoConfig = parseAutoConfig();

  // ui

  document.querySelectorAll('.ui-panel').forEach(initUiPanel);
  document.querySelector('.app-file .load').addEventListener('click', load);
  document
    .querySelector('.app-animation .next')
    .addEventListener('click', nextAnim);
  document
    .querySelector('.app-animation .prev')
    .addEventListener('click', prevAnim);
  document
    .querySelector('.app-animation .seq-source')
    .addEventListener('change', onSeqSourceChange);
  document
    .querySelector('.app-export .export-obj')
    .addEventListener('click', exportOBJ);
  document
    .querySelector('.app-settings')
    .addEventListener('change', onSettingsChange);

  applyAutoConfig(autoConfig);
  void initAutoLoad();

  // loading

  const loaders = {};

  async function load() {
    const f1 = getInput('.app-file .file1').files[0];
    const f2 = getInput('.app-file .file2').files[0];

    if (!f1) return;

    await loadFile(f1, { seqPreference: readSeqPreference() });

    if (f2) {
      await loadFile(f2);
    }
  }

  function load2(ext, data, options = {}) {
    const loader = loaders[ext];
    if (!loader) throw new Error('Unknown file extension ' + ext);

    loader(new Reader(data), options);
  }

  loaders.wep = function (reader) {
    clean();

    const wep = new WEP(reader);
    wep.read();
    wep.build();

    root.remove(root.children[0]);
    root.add(wep.mesh);
    frameRootObject();

    updateTextures(wep.textureMap.textures);
    updateAnim();
    updateSettings();
  };

  loaders.shp = function (reader) {
    clean();

    const shp = (activeSHP = new SHP(reader));
    shp.read();
    shp.build();

    root.remove(root.children[0]);
    root.add(shp.mesh);
    frameRootObject();

    updateTextures(shp.textureMap.textures);
    updateAnim();
  };

  loaders.seq = function (reader) {
    if (activeSHP) {
      stopAnim();

      const seq = (activeSEQ = new SEQ(reader, activeSHP));
      activeSEQLabel = 'external';
      seq.read();
      seq.build();

      updateAnim();
      updateSettings();
    } else {
      throw new Error('Cannot load SEQ without SHP');
    }
  };

  loaders.zud = function (reader, options = {}) {
    clean();

    const zud = (activeZUD = new ZUD(reader));
    zud.read();
    zud.build();

    activeSHP = zud.shp;
    [activeSEQ, activeSEQLabel] = pickZudSequence(
      zud,
      options.seqPreference || readSeqPreference()
    );

    updateAnim();

    root.remove(root.children[0]);
    root.add(zud.shp.mesh);
    attachZudEquipment();
    frameRootObject();

    updateTextures(collectZudTextures(zud));
    updateAnim();
    updateSettings();
  };

  loaders.znd = function (reader) {
    clean();

    const znd = (activeZND = new ZND(reader));
    znd.read();

    znd.frameBuffer.build();

    //scene.add( znd.frameBuffer.mesh );

    updateTextures(znd.textures);
    updateSettings();
  };

  loaders.mpd = function (reader) {
    clean();

    const mpd = new MPD(reader, activeZND);
    mpd.read();
    mpd.build();

    root.remove(root.children[0]);
    root.add(mpd.mesh);
    frameRootObject();

    if (activeZND) updateTextures(activeZND.textures);
    updateSettings();
  };

  loaders.arm = function (reader) {
    clean();

    const arm = new ARM(reader);
    arm.read();
    arm.build();

    root.remove(root.children[0]);
    root.add(arm.object);
    frameRootObject();

    updateTextures([]);
    updateSettings();
  };

  loaders.gim = function (reader) {
    const gim = new GIM(reader);
    gim.read();
    gim.build();

    updateTextures(gim.textures);
    updateSettings();
  };

  loaders.p = function (reader) {
    const p = new P(reader);
    p.read();
    p.build();

    updateTextures(p.textures);
    updateSettings();
  };

  let activeFBC;

  loaders.fbc = function (reader) {
    const fbc = (activeFBC = new FBC(reader));
    fbc.read();
  };

  loaders.fbt = function (reader) {
    const fbt = new FBT(reader, activeFBC);
    fbt.read();

    updateTextures(fbt.textures);
    updateSettings();
  };

  function clean() {
    activeSHP = null;
    activeSEQ = null;
    activeZUD = null;
    activeSEQLabel = null;
    clearMountedEquipment();

    stopAnim();
    clearAnimMeta();
  }

  // animation

  function nextAnim() {
    getInput('.app-animation .animation').value = String(parseAnim() + 1);

    updateAnim();
  }

  function prevAnim() {
    getInput('.app-animation .animation').value = String(parseAnim() - 1);

    updateAnim();
  }

  function onSeqSourceChange() {
    if (!activeZUD) return;

    [activeSEQ, activeSEQLabel] = pickZudSequence(activeZUD, readSeqPreference());
    updateAnim();
  }

  function updateAnim() {
    if (!activeSEQ) {
      clearAnimMeta();
      document.querySelector('.app-animation .animation-count').innerHTML = '';
      return;
    }

    stopAnim();

    const id = parseAnim();

    mixer.uncacheClip(activeSEQ.animations[id].animationClip);
    mixerAction = mixer.clipAction(
      activeSEQ.animations[id].animationClip,
      activeSHP.mesh
    );
    mixerAction.play();

    getInput('.app-animation .animation').value = String(id);
    document.querySelector('.app-animation .animation-count').innerHTML =
      '0&ndash;' + (activeSEQ.animations.length - 1);
    updateAnimMeta(id);
  }

  function parseAnim() {
    if (!activeSEQ) return 0;

    let id = parseInt(
      getInput('.app-animation .animation').value,
      10
    );

    if (!id) id = 0;

    id = Math.min(activeSEQ.animations.length - 1, Math.max(0, id));

    return id;
  }

  function stopAnim() {
    if (mixerAction) mixerAction.stop();
  }

  function updateAnimMeta(id) {
    const target = document.querySelector('.app-animation .animation-meta');
    const animation = activeSEQ && activeSEQ.animations ? activeSEQ.animations[id] : null;

    if (!animation) {
      clearAnimMeta();
      return;
    }

    const slotRefs =
      activeSEQ.slots
        ?.map((animationId, slotId) => ({ animationId, slotId }))
        .filter((it) => it.animationId === id)
        .map((it) => it.slotId) || [];
    const actions =
      animation.actions?.map((it) => {
        const params = it.params.length ? `(${it.params.join(', ')})` : '';
        return `${it.f}:${it.name}${params}`;
      }) || [];

    target.innerHTML = [
      `<p><strong>Source:</strong> ${escapeHtml(activeSEQLabel || 'unknown')}</p>`,
      `<p><strong>Frames:</strong> ${animation.length} | <strong>Base:</strong> ${animation.baseAnimationId} | <strong>Scale Flags:</strong> ${animation.scaleFlags}</p>`,
      `<p><strong>Slots:</strong> ${slotRefs.length ? slotRefs.join(', ') : 'none'}</p>`,
      `<p><strong>Actions:</strong> ${actions.length ? escapeHtml(actions.join(' | ')) : 'none'}</p>`,
    ].join('');
  }

  function clearAnimMeta() {
    document.querySelector('.app-animation .animation-meta').innerHTML = '';
  }

  // textures

  function updateTextures(textures) {
    document.querySelector('.app-textures .textures').innerHTML = '';

    if (!textures) return;

    document.querySelector('.app-textures .textures').innerHTML = textures
      .map((texture) => {
        const src = exportPng(
          texture.image.data,
          texture.image.width,
          texture.image.height
        );
        return `<img title="${texture.title}" src="${src}">`;
      })
      .join('\n');
  }

  function collectZudTextures(zud) {
    const textures = [];
    if (zud?.shp?.textureMap?.textures) {
      textures.push(...zud.shp.textureMap.textures);
    }
    if (zud?.weapon?.textureMap?.textures) {
      textures.push(...zud.weapon.textureMap.textures);
    }
    if (zud?.shield?.textureMap?.textures) {
      textures.push(...zud.shield.textureMap.textures);
    }
    return textures;
  }

  function clearMountedEquipment() {
    for (const mesh of activeMountedEquipment) {
      if (mesh?.parent) {
        mesh.parent.remove(mesh);
      }
    }
    activeMountedEquipment = [];
  }

  function attachZudEquipment() {
    clearMountedEquipment();

    if (!activeZUD || !activeSHP) return;
    if (!getInput('.app-settings .attach-equipment').checked) {
      return;
    }

    mountEquipmentMesh(
      activeZUD.weapon,
      'weapon',
      readEquipmentMount('weapon', DEFAULT_WEAPON_MOUNT_ID)
    );
    mountEquipmentMesh(
      activeZUD.shield,
      'shield',
      readEquipmentMount('shield', DEFAULT_SHIELD_MOUNT_ID)
    );
  }

  function mountEquipmentMesh(equipment, kind, mountId) {
    if (!equipment?.mesh || mountId === null) return;

    const mount = findMountBone(activeSHP, mountId);
    if (!mount) return;

    if (equipment.mesh.parent) {
      equipment.mesh.parent.remove(equipment.mesh);
    }

    const pivot = new Object3D();
    pivot.name = `${kind}-mount-pivot`;
    pivot.position.x = -mount.anchorInfo.length;
    pivot.rotation.z = getEquipmentPivotTurn(kind);

    equipment.mesh.position.set(0, 0, 0);
    equipment.mesh.rotation.set(0, 0., 0);
    equipment.mesh.scale.set(1, 1, 1);

    pivot.add(equipment.mesh);
    mount.anchorBone.add(pivot);
    activeMountedEquipment.push(pivot);
  }

  function findMountBone(shp, mountId) {
    if (!shp?.bones || !shp?.skeleton?.bones) return null;
    const candidates = shp.bones
      .map((bone, index) => ({ ...bone, index }))
      .filter((bone) => bone.mountId === mountId);
    if (candidates.length === 0) return null;

    const preferredBodyPart = PREFERRED_BODY_PART_BY_MOUNT[mountId] || 0;
    const boneInfo = candidates.sort((a, b) => {
      return scoreMountCandidate(b, preferredBodyPart) - scoreMountCandidate(a, preferredBodyPart);
    })[0];
    if (!boneInfo) return null;

    const bone = shp.skeleton.bones[boneInfo.id] || null;
    if (!bone) return null;

    const anchorInfo = findNextBoneInfo(shp, boneInfo.id);
    const anchorBone =
      anchorInfo && shp.skeleton.bones[anchorInfo.id]
        ? shp.skeleton.bones[anchorInfo.id]
        : bone;

    return {
      bone,
      anchorBone,
      anchorInfo: anchorInfo || boneInfo,
      info: boneInfo,
    };
  }

  function scoreMountCandidate(bone, preferredBodyPart) {
    let score = 0;

    if (bone.bodyPartId === preferredBodyPart) score += 1000;
    if (bone.bodyPartId !== 0) score += 100;
    if (bone.length < 0) score += 10;
    score += bone.index;

    return score;
  }

  function findNextBoneInfo(shp, parentId) {
    const children = shp.bones
      .map((bone, index) => ({ ...bone, index }))
      .filter((bone) => bone.parentId === parentId)
      .sort((a, b) => a.index - b.index);

    return children.length > 0 ? children[0] : null;
  }

  function readEquipmentMount(kind, fallbackMountId) {
    const value = getSelect(`.app-settings .${kind}-mount`).value;
    if (value === 'none') return null;
    if (value === 'auto' || value === '') return fallbackMountId;

    const mountId = parseInt(value, 10);
    return Number.isNaN(mountId) ? fallbackMountId : mountId;
  }

  function getEquipmentPivotTurn(_kind) {
    return Math.PI / 2;
  }

  // settings

  document
    .querySelector('.app-settings')
    .addEventListener('click', updateSettings);

  function onSettingsChange() {
    if (activeZUD) {
      attachZudEquipment();
    }
    updateSettings();
  }

  function updateSettings() {
    const wireframe = getInput('.app-settings .wireframe').checked;
    const noVertexColors = getInput(
      '.app-settings .no-vertex-colors'
    ).checked;
    const noTexture = getInput('.app-settings .no-texture').checked;
    const normals = getInput('.app-settings .normals').checked;
    const skeleton = getInput('.app-settings .skeleton').checked;

    helpers.traverse((object) => {
      helpers.remove(object);
    });

    root.traverse((object) => {
      if (object instanceof Mesh) {
        if (normals && !(object.material instanceof MeshNormalMaterial)) {
          object.originalMaterial = object.material;
          object.material = new MeshNormalMaterial();
          object.material.skinning = object.originalMaterial.skinning;
        }

        if (
          !normals &&
          object.material instanceof MeshNormalMaterial &&
          object.originalMaterial
        ) {
          object.material = object.originalMaterial;
        }

        if (
          object.material.defines &&
          noTexture &&
          object.material.defines.USE_MAP
        ) {
          object.material.defines.USE_MAP = false;
          object.material.needsUpdate = true;
        }

        if (
          object.material.defines &&
          !noTexture &&
          !object.material.defines.USE_MAP
        ) {
          object.material.defines.USE_MAP = true;
          object.material.needsUpdate = true;
        }

        if (
          object.geometry instanceof BufferGeometry &&
          object.geometry.attributes.color
        ) {
          object.material.vertexColors = !noVertexColors;
          object.material.needsUpdate = true;
        }

        object.material.wireframe = wireframe;
        object.material.wireframeLinewidth = 2;
      }

      if (skeleton && object instanceof SkinnedMesh) {
        const skeletonHelper = new SkeletonHelper(object);
        skeletonHelper.material.linewidth = 3;
        helpers.add(skeletonHelper);
      }
    });
  }

  // export

  function exportOBJ() {
    const exporter = new OBJExporter();

    if (root instanceof SkinnedMesh) {
      const clone = cloneMeshWithPose(root);

      exportString(exporter.parse(clone));
    } else {
      exportString(exporter.parse(root));
    }
  }

  function exportString(output) {
    const blob = new Blob([output], { type: 'text/plain' });
    const objectURL = URL.createObjectURL(blob);

    window.open(objectURL, '_blank');
    window.focus();
  }

  async function loadFile(file, options = {}) {
    const ext = parseExt(file.name);
    const data = new Uint8Array(await file.arrayBuffer());
    load2(ext, data, options);
  }

  async function loadUrl(url, options = {}) {
    const ext = parseExt(url);
    const response = await fetch(new URL(url, window.location.href));
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());
    load2(ext, data, options);
  }

  async function initAutoLoad() {
    if (!autoConfig.file1) return;

    try {
      await loadUrl(autoConfig.file1, { seqPreference: autoConfig.seqPreference });

      if (autoConfig.file2) {
        await loadUrl(autoConfig.file2);
      }

      if (autoConfig.anim !== null) {
        getInput('.app-animation .animation').value = String(autoConfig.anim);
        updateAnim();
      }
    } catch (error) {
      console.error(error);
      document.querySelector('.app-animation .animation-meta').innerHTML =
        `<p class="error">${escapeHtml(error.message)}</p>`;
    }
  }

  function parseAutoConfig() {
    const params = new URLSearchParams(window.location.search);
    const anim = params.get('anim');

    return {
      file1: params.get('file1'),
      file2: params.get('file2'),
      seqPreference: normalizeSeqPreference(params.get('seq')),
      anim: anim === null ? null : parseInt(anim, 10),
    };
  }

  function applyAutoConfig(config) {
    getSelect('.app-animation .seq-source').value = config.seqPreference;

    if (config.anim !== null && !Number.isNaN(config.anim)) {
      getInput('.app-animation .animation').value = String(config.anim);
    }
  }

  function normalizeSeqPreference(value) {
    if (value === 'battle' || value === 'common') return value;
    return 'auto';
  }

  function readSeqPreference() {
    return normalizeSeqPreference(
      getSelect('.app-animation .seq-source').value
    );
  }

  function pickZudSequence(zud, preference) {
    if (preference === 'common') {
      if (zud.com) return [zud.com, 'common'];
      if (zud.bt) return [zud.bt, 'battle'];
      return [null, 'none'];
    }

    if (preference === 'battle') {
      if (zud.bt) return [zud.bt, 'battle'];
      if (zud.com) return [zud.com, 'common'];
      return [null, 'none'];
    }

    if (zud.bt) return [zud.bt, 'battle'];
    if (zud.com) return [zud.com, 'common'];
    return [null, 'none'];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return char;
      }
    });
  }
}


