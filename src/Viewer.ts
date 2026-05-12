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
  SphereGeometry,
  Vector3,
  WireframeGeometry,
  LineSegments,
  LineBasicMaterial,
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
import {
  buildShpSupplementalCandidates,
  type ShpSupplementalCandidate,
} from './shp-seq-resolver.js';

type ViewerContext = {
  [key: string]: any;
};

export function Viewer(this: ViewerContext) {
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
  const frameTarget = new Vector3();
  const orbitCameraOffset = new Vector3();
  const dragDirection = new Vector3();
  const dragRightDirection = new Vector3();
  const dragOffset = new Vector3();
  const boneFocusPoint = new Vector3();
  const orbitCenterSphere = new LineSegments(
    new WireframeGeometry(new SphereGeometry(0.5, 4, 2)),
    new LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
    })
  );
  let orbitCenterRadius = 3;

  const renderer = new WebGLRenderer();
  renderer.setClearColor(0x333333, 1);

  resize();

  const root = new Object3D();
  const helpers = new Object3D();

  orbitCenterSphere.name = 'orbit-center-sphere';
  orbitCenterSphere.visible = false;

  scene.add(root);
  scene.add(helpers);

  document.querySelector('body').appendChild(renderer.domElement);

  camera.position.z = 500;
  const orbitControls = new OrbitControls(camera, renderer.domElement);
  const viewerDocument = renderer.domElement.ownerDocument;
  let activeMousePointerId: number | null = null;
  let activeMouseDragMode: 'rotate' | 'pan' | 'groundPan' | null = null;
  let activeMouseLastX = 0;
  let activeMouseLastY = 0;

  const mixer = new AnimationMixer(scene);
  let mixerAction;

  function render() {
    requestAnimationFrame(render);
    orbitCenterSphere.position.copy(orbitControls.target);
    orbitControls.update();
    mixer.update(0.01);
    renderer.render(scene, camera);
  }

  orbitControls.mouseButtons.LEFT = -1;
  orbitControls.mouseButtons.MIDDLE = -1;
  orbitControls.mouseButtons.RIGHT = -1;

  function getMouseDragMode(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return null;

    switch (event.buttons & 3) {
      case 1:
        return 'rotate';
      case 2:
        return 'groundPan';
      case 3:
        return 'pan';
      default:
        return null;
    }
  }

  function resetMouseDrag(pointerId: number | null = null) {
    if (pointerId !== null && pointerId !== activeMousePointerId) return;

    activeMousePointerId = null;
    activeMouseDragMode = null;
    activeMouseLastX = 0;
    activeMouseLastY = 0;
  }

  function moveCameraAcrossGroundPlane(
    mouseDeltaX: number,
    mouseDeltaY: number
  ) {
    if (mouseDeltaX === 0 && mouseDeltaY === 0) return;

    const distanceToTarget = Math.max(
      camera.position.distanceTo(orbitControls.target),
      1
    );
    const worldUnitsPerPixel =
      (distanceToTarget * 2 * orbitControls.panSpeed) /
      Math.max(renderer.domElement.clientHeight, 1);

    camera.getWorldDirection(dragDirection);
    dragDirection.y = 0;
    if (dragDirection.lengthSq() === 0) {
      dragDirection.set(0, 0, -1);
    } else {
      dragDirection.normalize();
    }

    dragRightDirection.crossVectors(dragDirection, camera.up);
    dragRightDirection.y = 0;
    if (dragRightDirection.lengthSq() === 0) {
      dragRightDirection.set(1, 0, 0);
    } else {
      dragRightDirection.normalize();
    }

    dragOffset
      .copy(dragRightDirection)
      .multiplyScalar(-mouseDeltaX * worldUnitsPerPixel)
      .addScaledVector(dragDirection, mouseDeltaY * worldUnitsPerPixel);

    camera.position.add(dragOffset);
    orbitControls.target.add(dragOffset);
    orbitControls.update();
  }

  function onMousePointerDown(event: PointerEvent) {
    const nextMode = getMouseDragMode(event);
    if (nextMode === null) return;

    if (activeMousePointerId === null) {
      activeMousePointerId = event.pointerId;
      renderer.domElement.setPointerCapture(event.pointerId);
    } else if (event.pointerId !== activeMousePointerId) {
      return;
    }

    activeMouseDragMode = nextMode;
    activeMouseLastX = event.clientX;
    activeMouseLastY = event.clientY;
    event.preventDefault();
    event.stopPropagation();
  }

  function onMousePointerMove(event: PointerEvent) {
    if (event.pointerId !== activeMousePointerId) {
      return;
    }

    const nextMode = getMouseDragMode(event);
    if (nextMode === null) {
      if (event.buttons === 0) {
        resetMouseDrag(event.pointerId);
      }
      return;
    }

    if (nextMode !== activeMouseDragMode) {
      activeMouseDragMode = nextMode;
      activeMouseLastX = event.clientX;
      activeMouseLastY = event.clientY;
      event.preventDefault();
      return;
    }

    const mouseDeltaX = event.clientX - activeMouseLastX;
    const mouseDeltaY = event.clientY - activeMouseLastY;
    activeMouseLastX = event.clientX;
    activeMouseLastY = event.clientY;

    if (activeMouseDragMode === 'rotate') {
      const angleScale =
        (2 * Math.PI * orbitControls.rotateSpeed) /
        Math.max(renderer.domElement.clientHeight, 1);
      orbitControls.rotateLeft(angleScale * mouseDeltaX);
      orbitControls.rotateUp(angleScale * mouseDeltaY);
      orbitControls.update();
    } else if (activeMouseDragMode === 'pan') {
      orbitControls.pan(
        mouseDeltaX * orbitControls.panSpeed,
        mouseDeltaY * orbitControls.panSpeed
      );
    } else if (activeMouseDragMode === 'groundPan') {
      moveCameraAcrossGroundPlane(mouseDeltaX, mouseDeltaY);
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function onMousePointerEnd(event: PointerEvent) {
    if (event.pointerId !== activeMousePointerId) return;

    const nextMode = getMouseDragMode(event);
    if (nextMode === null) {
      resetMouseDrag(event.pointerId);
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      return;
    }

    activeMouseDragMode = nextMode;
    activeMouseLastX = event.clientX;
    activeMouseLastY = event.clientY;
    event.preventDefault();
  }

  renderer.domElement.addEventListener('pointerdown', onMousePointerDown);
  viewerDocument.addEventListener('pointermove', onMousePointerMove);
  viewerDocument.addEventListener('pointerup', onMousePointerEnd);
  viewerDocument.addEventListener('pointercancel', onMousePointerEnd);

  function resize() {
    setTimeout(function () {
      camera.aspect = (window.innerWidth - 360) / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth - 360, window.innerHeight);
    }, 1);
  }

  function frameRootObject(focusSource = null) {
    if (root.children.length === 0) return;

    frameBox.setFromObject(root);
    if (frameBox.isEmpty()) return;

    root.updateMatrixWorld(true);
    frameBox.getSize(frameSize);
    frameBox.getCenter(frameCenter);

    const maxDim = Math.max(frameSize.x, frameSize.y, frameSize.z, 1);
    const fitHeightDistance =
      maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.35;
    orbitCenterRadius = Math.max(maxDim * 0.025, 3);
    const focusPoint = getPreferredOrbitFocusPoint(focusSource);
    const targetPoint = focusPoint || frameCenter;

    camera.near = Math.max(0.1, distance / 100);
    camera.far = Math.max(10000, distance * 20);
    camera.position.set(
      targetPoint.x,
      targetPoint.y,
      targetPoint.z + distance
    );
    camera.updateProjectionMatrix();

    setOrbitTarget(targetPoint, false);
  }

  function setOrbitTarget(targetPoint, preserveCameraOffset = false) {
    if (preserveCameraOffset) {
      orbitCameraOffset.subVectors(camera.position, orbitControls.target);
      camera.position.copy(targetPoint).add(orbitCameraOffset);
    }

    orbitControls.target.copy(targetPoint);
    orbitCenterSphere.scale.setScalar(orbitCenterRadius);
    orbitCenterSphere.position.copy(targetPoint);
    orbitControls.update();
  }

  function syncOrbitTargetToFocusSource(focusSource, preserveCameraOffset = false) {
    if (!focusSource) return false;

    root.updateMatrixWorld(true);
    const focusPoint = getPreferredOrbitFocusPoint(focusSource);
    if (!focusPoint) return false;

    setOrbitTarget(focusPoint, preserveCameraOffset);
    return true;
  }

  window.addEventListener('resize', resize);

  this.run = function () {
    render();
  };

  //

  let activeSHP, activeSEQ, activeZND, activeZUD, activeSEQLabel;
  let activeMountedEquipment = [];
  const autoConfig = parseAutoConfig();
  const embeddedMode = autoConfig.embedded;

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
  document.querySelector('.app-mount').addEventListener('change', onMountChange);

  applyAutoConfig(autoConfig);
  updateEmbeddedUi();
  updateAnimationPanelVisibility();
  updateMountPanelVisibility();
  void initAutoLoad();

  // loading

  const loaders: Record<string, any> = {};

  async function load() {
    const f1 = getInput('.app-file .file1').files[0];
    const f2 = getInput('.app-file .file2').files[0];

    if (!f1) return;

    try {
      await loadFile(f1, { seqPreference: readSeqPreference() });

      if (f2) {
        await loadFile(f2);
      }
    } catch (error) {
      showLoadError(error);
    }
  }

  function load2(ext, data, options: any = {}) {
    const loader = loaders[ext];
    if (!loader) throw new Error('Unknown file extension ' + ext);

    loader(new Reader(data), options);
  }

  loaders.wep = function (reader) {
    const wep = new WEP(reader);
    wep.read();
    wep.build();

    clean();
    root.remove(root.children[0]);
    root.add(wep.mesh);
    frameRootObject(wep);

    updateTextures(wep.textureMap.textures);
    updateAnim();
    updateSettings();
  };

  loaders.shp = function (reader, options: any = {}) {
    const shp = new SHP(reader);
    shp.read();
    shp.build();

    clean();
    activeSHP = shp;
    root.remove(root.children[0]);
    root.add(shp.mesh);
    frameRootObject(shp);

    updateTextures(shp.textureMap.textures);

    if (!options.deferInitialAnimLoad) {
      updateAnim();
    }
  };

  loaders.seq = function (reader, options: any = {}) {
    if (activeSHP) {
      const seq = new SEQ(reader, activeSHP);
      activeSEQLabel = options.label || 'external';
      seq.read();
      seq.build();

      stopAnim();
      resetAnimSelection();
      activeSEQ = seq;
      updateAnim();
      updateSettings();
    } else {
      throw new Error('Cannot load SEQ without SHP');
    }
  };

  loaders.zud = function (reader, options: any = {}) {
    const zud = new ZUD(reader);
    zud.read();
    zud.build();

    clean();
    activeZUD = zud;
    activeSHP = zud.shp;
    [activeSEQ, activeSEQLabel] = pickZudSequence(
      zud,
      options.seqPreference || readSeqPreference()
    );
    updateMountPanelVisibility();

    updateAnim();

    root.remove(root.children[0]);
    root.add(zud.shp.mesh);
    attachZudEquipment();
    frameRootObject(zud.shp);

    updateTextures(collectZudTextures(zud));
    updateAnim();
    updateSettings();
  };

  loaders.znd = function (reader, options: any = {}) {
    const znd = new ZND(reader);
    znd.read();

    znd.frameBuffer.build();

    if (options.supplemental && activeZND) {
      activeZND.addFallback(znd);
      updateSettings();
      return;
    }

    clean();
    activeZND = znd;
    //scene.add( znd.frameBuffer.mesh );

    updateTextures(znd.textures);
    updateSettings();
  };

  loaders.mpd = function (reader) {
    const mpd = new MPD(reader, activeZND);
    mpd.read();
    mpd.build();

    clean();
    root.remove(root.children[0]);
    root.add(mpd.mesh);
    frameRootObject();

    if (activeZND) updateTextures(activeZND.textures);
    updateSettings();
  };

  loaders.arm = function (reader) {
    const arm = new ARM(reader);
    arm.read();
    arm.build();

    clean();
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
    resetAnimSelection();

    stopAnim();
    clearAnimMeta();
    updateAnimationPanelVisibility();
    updateMountPanelVisibility();
  }

  function resetAnimSelection() {
    getInput('.app-animation .animation').value = '0';
  }

  function setPanelHidden(selector, hidden) {
    getElement(selector).classList.toggle('is-hidden', hidden);
  }

  function hasAnimations() {
    return Boolean(activeSEQ?.animations?.length);
  }

  function updateEmbeddedUi() {
    setPanelHidden('.app-file', embeddedMode);

    getElement('.app-mount')
      .querySelectorAll('.mount-select')
      .forEach((element) => element.classList.toggle('is-hidden', embeddedMode));
    getElement('.app-mount')
      .querySelectorAll('.mount-static')
      .forEach((element) => element.classList.toggle('is-hidden', !embeddedMode));
  }

  function updateAnimationPanelVisibility() {
    setPanelHidden('.app-animation', !hasAnimations());
  }

  function updateMountPanelVisibility() {
    setPanelHidden('.app-mount', !activeZUD);
  }

  function showAnimationError(message) {
    setPanelHidden('.app-animation', false);
    document.querySelector('.app-animation .animation-meta').innerHTML =
      `<p class="error">${escapeHtml(message)}</p>`;
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
    resetAnimSelection();
    updateAnim();
  }

  function updateAnim() {
    updateAnimationPanelVisibility();

    if (!hasAnimations()) {
      clearAnimMeta();
      document.querySelector('.app-animation .animation-count').innerHTML = '';

      if (activeSHP) {
        activeSHP.buildTPose();
        frameRootObject(activeSHP);
      }

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
    mixer.update(0);
    syncOrbitTargetToFocusSource(activeSHP, true);

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
    if (!getInput('.app-mount .attach-equipment').checked) {
      return;
    }

    mountEquipmentMesh(
      activeZUD.weapon,
      'weapon',
      readEquipmentMount('weapon', DEFAULT_WEAPON_MOUNT_ID, embeddedMode)
    );
    mountEquipmentMesh(
      activeZUD.shield,
      'shield',
      readEquipmentMount('shield', DEFAULT_SHIELD_MOUNT_ID, embeddedMode)
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

  function getPreferredOrbitFocusPoint(model) {
    if (!model?.mesh || !model?.bones || !model?.skeleton?.bones) return null;

    const chestPoint = getChestOrbitFocusPoint(model);
    if (chestPoint) {
      return chestPoint;
    }

    const bonePoint = getBestBoneOrbitFocusPoint(model);
    if (bonePoint) {
      return bonePoint;
    }

    return null;
  }

  function getChestOrbitFocusPoint(model) {
    let bestPoint = null;
    let bestScore = -Infinity;
    const upperBodyThreshold = frameCenter.y;

    for (let i = 1; i < model.bones.length; ++i) {
      const boneInfo = model.bones[i];
      const bone = model.skeleton.bones[i];
      if (!bone || boneInfo.length === 0) continue;

      const childCount = model.bones.filter((candidate) => candidate.parentId === i).length;
      if (childCount === 0) continue;

      // Use the middle of the bone segment so the focus sits in the torso
      // instead of snapping to a shoulder or neck pivot.
      boneFocusPoint.set(-boneInfo.length * 0.5, 0, 0);
      bone.localToWorld(boneFocusPoint);

      const distance = boneFocusPoint.distanceTo(frameCenter);
      const hasGeometry = boneInfo.groupId >= 0;
      const isUpperBody = boneFocusPoint.y >= upperBodyThreshold;
      const isBranch = childCount >= 2;
      const hasKnownBodyPart = boneInfo.bodyPartId !== 0;
      const score =
        (isBranch ? 1000 : 0) +
        (isUpperBody ? 200 : 0) +
        (hasGeometry ? 100 : 0) +
        (hasKnownBodyPart ? 25 : 0) -
        distance;

      if (score > bestScore) {
        bestScore = score;
        bestPoint = boneFocusPoint.clone();
      }
    }

    return bestPoint;
  }

  function getBestBoneOrbitFocusPoint(model) {
    let bestPoint = null;
    let bestDistance = Infinity;
    let bestHasGeometry = false;

    for (let i = 1; i < model.bones.length; ++i) {
      const boneInfo = model.bones[i];
      const bone = model.skeleton.bones[i];
      if (!bone || boneInfo.length === 0) continue;

      // Favor non-root bones with actual mesh attachment or terminal links,
      // then keep the anchor close to the model's visual center.
      const hasGeometry = boneInfo.groupId >= 0;
      const isLeaf = !model.bones.some((candidate) => candidate.parentId === i);
      if (!hasGeometry && !isLeaf) continue;

      boneFocusPoint.set(-boneInfo.length, 0, 0);
      bone.localToWorld(boneFocusPoint);

      const distance = boneFocusPoint.distanceTo(frameCenter);
      if (
        distance < bestDistance ||
        (distance === bestDistance && hasGeometry && !bestHasGeometry)
      ) {
        bestDistance = distance;
        bestHasGeometry = hasGeometry;
        bestPoint = boneFocusPoint.clone();
      }
    }

    return bestPoint;
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

  function readEquipmentMount(kind, fallbackMountId, forceDefault = false) {
    if (forceDefault) return fallbackMountId;

    const value = getSelect(`.app-mount .${kind}-mount`).value;
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

  function onMountChange() {
    if (activeZUD) {
      attachZudEquipment();
    }
  }

  function updateSettings() {
    const wireframe = getInput('.app-settings .wireframe').checked;
    const noVertexColors = getInput(
      '.app-settings .no-vertex-colors'
    ).checked;
    const noTexture = getInput('.app-settings .no-texture').checked;
    const normals = getInput('.app-settings .normals').checked;
    const skeleton = getInput('.app-settings .skeleton').checked;
    const showOrbitCenter = getInput(
      '.app-settings .show-orbit-center'
    ).checked;

    helpers.clear();
    orbitCenterSphere.visible = showOrbitCenter;
    orbitCenterSphere.position.copy(orbitControls.target);
    orbitCenterSphere.scale.setScalar(orbitCenterRadius);

    if (showOrbitCenter) {
      helpers.add(orbitCenterSphere);
    }

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

  async function loadFile(file, options: any = {}) {
    const ext = parseExt(file.name);
    const data = new Uint8Array(await file.arrayBuffer());
    load2(ext, data, options);
  }

  async function loadUrl(url, options: any = {}) {
    const ext = parseExt(url);
    const response = await fetch(new URL(url, window.location.href));
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());
    load2(ext, data, options);
  }

  async function tryLoadMatchingSeqForShp(url, preference) {
    const candidates = buildShpSupplementalCandidates(url, preference);

    for (const candidate of candidates) {
      try {
        if (candidate.source === 'seq') {
          await loadUrl(candidate.url, { label: candidate.label });
        } else {
          await loadSupplementalZudForShp(candidate, preference);
        }
        return true;
      } catch {
        // Keep trying adjacent extracted sequence or zud sources.
      }
    }

    return false;
  }

  async function tryLoadMatchingZudForShpUrl(url, preference) {
    const candidates = buildShpSupplementalCandidates(url, preference).filter(
      (candidate) => candidate.source === 'zud'
    );

    for (const candidate of candidates) {
      try {
        await loadUrl(candidate.url, { seqPreference: preference });
        return true;
      } catch {
        // Keep trying adjacent zud sources.
      }
    }

    return false;
  }

  function shouldPreferZudForShpUrl(url) {
    return /_Model_SHP\/[^/]*_Character_SHP\.SHP$/i.test(url);
  }

  async function loadSupplementalZudForShp(
    candidate: ShpSupplementalCandidate,
    preference
  ) {
    const response = await fetch(new URL(candidate.url, window.location.href));
    if (!response.ok) {
      throw new Error(
        `Failed to load ${candidate.url}: ${response.status} ${response.statusText}`
      );
    }

    if (!activeSHP) {
      throw new Error('Cannot load supplemental ZUD without SHP');
    }

    const data = new Uint8Array(await response.arrayBuffer());
    const zud = new ZUD(new Reader(data));
    zud.read();
    zud.build();

    if (!zud.shp || !shpsAreCompatible(activeSHP, zud.shp)) {
      throw new Error(
        `Supplemental ZUD ${candidate.url} is incompatible with active SHP`
      );
    }

    activeZUD = zud;
    [activeSEQ, activeSEQLabel] = pickZudSequence(zud, preference);
    updateMountPanelVisibility();

    if (!activeSEQ) {
      throw new Error(`Supplemental ZUD ${candidate.url} did not provide a SEQ`);
    }

    activeSEQLabel = candidate.label;
  }

  function shpsAreCompatible(left, right) {
    if (!left || !right) return false;
    if (left.numBones !== right.numBones) return false;
    if (left.numGroups !== right.numGroups) return false;
    if (!left.bones || !right.bones) return false;

    for (let i = 0; i < left.numBones; ++i) {
      const a = left.bones[i];
      const b = right.bones[i];
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      if (a.parentId !== b.parentId) return false;
      if (a.groupId !== b.groupId) return false;
      if (a.mountId !== b.mountId) return false;
      if (a.bodyPartId !== b.bodyPartId) return false;
    }

    return true;
  }

  async function initAutoLoad() {
    if (!autoConfig.file1) return;

    try {
      const file1Ext = parseExt(autoConfig.file1);
      const shouldAutoLoadSeq =
        file1Ext === 'shp' && autoConfig.file2 === null;
      let loadedFromShpFallbackZud = false;

      if (shouldAutoLoadSeq) {
        if (shouldPreferZudForShpUrl(autoConfig.file1)) {
          clean();
          const loadedZud = await tryLoadMatchingZudForShpUrl(
            autoConfig.file1,
            autoConfig.seqPreference
          );
          if (loadedZud) {
            loadedFromShpFallbackZud = true;
          } else {
            await loadUrl(autoConfig.file1, {
              seqPreference: autoConfig.seqPreference,
              deferInitialAnimLoad: true,
            });
          }
        } else {
          try {
            await loadUrl(autoConfig.file1, {
              seqPreference: autoConfig.seqPreference,
              deferInitialAnimLoad: true,
            });
          } catch (error) {
            clean();
            const loadedZud = await tryLoadMatchingZudForShpUrl(
              autoConfig.file1,
              autoConfig.seqPreference
            );
            if (!loadedZud) {
              throw error;
            }
            loadedFromShpFallbackZud = true;
          }
        }
      } else {
        await loadUrl(autoConfig.file1, {
          seqPreference: autoConfig.seqPreference,
          deferInitialAnimLoad: false,
        });
      }

      if (
        file1Ext === 'znd' &&
        autoConfig.file2 &&
        parseExt(autoConfig.file2) === 'mpd'
      ) {
        for (const file of autoConfig.auxFiles) {
          if (parseExt(file) !== 'znd') continue;

          await loadUrl(file, {
            supplemental: true,
          });
        }
      }

      if (loadedFromShpFallbackZud) {
        if (autoConfig.anim !== null) {
          getInput('.app-animation .animation').value = String(autoConfig.anim);
          updateAnim();
        }
        return;
      }

      if (autoConfig.file2) {
        await loadUrl(autoConfig.file2);
      } else if (file1Ext === 'shp' && activeSHP && !loadedFromShpFallbackZud) {
        const loadedSeq = await tryLoadMatchingSeqForShp(
          autoConfig.file1,
          autoConfig.seqPreference
        );

        if (!loadedSeq) {
          updateAnim();
        }
      }

      if (autoConfig.anim !== null) {
        getInput('.app-animation .animation').value = String(autoConfig.anim);
        updateAnim();
      }
    } catch (error) {
      console.error(error);
      showAnimationError(error instanceof Error ? error.message : String(error));
    }
  }

  function parseAutoConfig() {
    const params = new URLSearchParams(window.location.search);
    const anim = params.get('anim');
    const auxFiles = [];

    for (let i = 1; ; ++i) {
      const value = params.get(`aux${i}`);
      if (value === null) break;
      auxFiles.push(value);
    }

    return {
      file1: params.get('file1'),
      file2: params.get('file2'),
      auxFiles,
      seqPreference: normalizeSeqPreference(params.get('seq')),
      anim: anim === null ? null : parseInt(anim, 10),
      embedded: params.get('embedded') === '1',
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

  function showLoadError(error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    showAnimationError(message);
  }
}
