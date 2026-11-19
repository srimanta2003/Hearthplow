import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CozySynthAudio } from './audio';
import {
  createAlpineCottage,
  createCocoaCrate,
  createSnowman,
  createSnowplowTruck,
  createStreetLamp,
  createVillageFountain,
  SnowplowTruckRig,
} from './models';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  DayConfig,
  GamePhase,
  getDayConfig,
  getUpgradeCost,
  HudSnapshot,
  loadProgress,
  saveProgress,
  UPGRADE_SPECS,
  UpgradeKey,
  UpgradeLevels,
} from './types';
import {
  buildPerimeterPineForest,
  buildVillageFencesAndRocks,
  generateVillageBlueprint,
  groundHeightAt,
  SnowCell,
  VillageBlueprint,
} from './world';

interface SnowParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  scale: number;
  age: number;
  life: number;
  isGold: boolean;
}

interface SmokeParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  age: number;
  life: number;
  isEmber: boolean;
}

interface Snowflake {
  x: number;
  y: number;
  z: number;
  speedY: number;
  driftPhase: number;
  scale: number;
}

interface InteractiveProp {
  id: number;
  x: number;
  z: number;
  collected: boolean;
  mesh: THREE.Group;
  kind: 'snowman' | 'crate';
  baseY: number;
}

// Pre-allocated scratch math objects (zero GC in render loop)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

// Snow color constants
const COLOR_SNOW_NORMAL = new THREE.Color(0xf5f9ff);
const COLOR_SNOW_DEEP = new THREE.Color(0xcce2fa);
const COLOR_SNOW_ICE = new THREE.Color(0x9bd7f7);
const COLOR_GOLD_SPARK = new THREE.Color(0xffc94d);
const COLOR_SMOKE_WARM = new THREE.Color(0xeef3f8);
const COLOR_SMOKE_EMBER = new THREE.Color(0xff9b42);

// Screen-aligned isometric basis vectors for camera at (+1, y, +1) looking at origin
const ISO_UP_X = -Math.SQRT1_2;
const ISO_UP_Z = -Math.SQRT1_2;
const ISO_RIGHT_X = Math.SQRT1_2;
const ISO_RIGHT_Z = -Math.SQRT1_2;

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function comboCountToMultiplier(count: number): number {
  if (count >= 75) return 12;
  if (count >= 50) return 8;
  if (count >= 32) return 5;
  if (count >= 18) return 3;
  if (count >= 8) return 2;
  return 1;
}

export class HearthplowEngine {
  private mountEl: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private audio = new CozySynthAudio();

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private textures: ProceduralTextureSet;

  // Dynamic world entities
  private truck: SnowplowTruckRig;
  private blueprint!: VillageBlueprint;
  private dayConfig: DayConfig;
  private snowMesh: THREE.InstancedMesh | null = null;
  private dynamicProps: InteractiveProp[] = [];
  private chimneyTops: THREE.Vector3[] = [];
  private dayGroup = new THREE.Group();

  // Particle instanced meshes
  private snowParticleMesh: THREE.InstancedMesh;
  private snowParticles: SnowParticle[] = [];
  private snowParticleCursor = 0;

  private smokeMesh: THREE.InstancedMesh;
  private smokeParticles: SmokeParticle[] = [];
  private smokeCursor = 0;

  private flakeMesh: THREE.InstancedMesh;
  private flakes: Snowflake[] = [];

  // Dynamic weather blowing-mist veil & atmosphere
  private mistVeilMesh: THREE.InstancedMesh;
  private mistVeilMat: THREE.MeshBasicMaterial;
  private mistWisps: { x: number; y: number; z: number; speed: number; scaleX: number; scaleY: number; phase: number }[] = [];
  private sceneFog: THREE.Fog;
  private skyColor: THREE.Color;
  private targetSkyColor = new THREE.Color(0xcfe2f4);

  // Lighting
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private truckHeadlight: THREE.PointLight;

  // Dynamic weather simulation state
  private weatherClock = 0;
  private gustAmount = 0; // 0..1 smooth current squall intensity
  private isGusting = false;
  private wasGusting = false;
  private currentVisibilityPercent = 95;
  private currentWindIntensity = 0.2;

  // Simulation state
  private phase: GamePhase = 'title';
  private day = 1;
  private coins = 0;
  private shiftCoins = 0;
  private score = 0;
  private highScore = 0;
  private bestDay = 1;
  private upgrades: UpgradeLevels;

  private clearedCount = 0;
  private totalSnowCells = 1;
  private timeRemaining = 95;
  private comboCount = 0;
  private comboMultiplier = 1;
  private comboTimer = 0;
  private maxCombo = 1;
  private cratesFound = 0;
  private cratesTotal = 5;

  // Truck kinematics
  private truckX = 0;
  private truckZ = 8.2;
  private truckHeading = Math.PI; // facing -Z toward town square
  private truckVx = 0;
  private truckVz = 0;
  private wheelSpin = 0;
  private steerAngle = 0;
  private chassisRoll = 0;
  private chassisPitch = 0;

  // Turbo & Feel
  private turboFuel = 1.0; // 0..1
  private isBoosting = false;
  private wasBoosting = false;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private plowActivitySmooth = 0;
  private refillAccum = 0;
  private chimneyTimer = 0;
  private exhaustTimer = 0;
  private titlePanAngle = 0.72;
  private frustumSize = 26;

  // Camera tracking
  private camTarget = new THREE.Vector3(0, 0, 4);
  private frustumCurrent = 26;

  // Floating HUD event callout
  private eventSeq = 0;
  private floatingEvent: HudSnapshot['floatingEvent'] = null;
  private floatingEventTimer = 0;

  // Input state (separated held vs edge)
  private heldKeys = new Set<string>();
  private pointerDown = false;
  private pointerVecX = 0;
  private pointerVecY = 0;

  // Loop & lifecycle
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private hudEmitAccum = 0;
  private elapsedTime = 0;

  constructor(mountEl: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.mountEl = mountEl;
    this.onHudUpdate = onHudUpdate;

    const saved = loadProgress();
    this.coins = saved.coins;
    this.highScore = saved.highScore;
    this.bestDay = saved.bestDay;
    this.upgrades = { ...saved.upgrades };
    this.day = 1;
    this.dayConfig = getDayConfig(this.day);

    // 1. Renderer & Software-WebGL guard
    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(mountEl.clientWidth || window.innerWidth, mountEl.clientHeight || window.innerHeight);

    mountEl.innerHTML = '';
    mountEl.appendChild(this.renderer.domElement);

    // 2. Scene, Linear Visibility Fog & Mandatory RoomEnvironment IBL
    this.scene = new THREE.Scene();
    this.skyColor = new THREE.Color(this.dayConfig.weather.skyHex);
    this.targetSkyColor.setHex(this.dayConfig.weather.skyHex);
    this.scene.background = this.skyColor;
    this.sceneFog = new THREE.Fog(
      this.dayConfig.weather.skyHex,
      this.dayConfig.weather.fogNear,
      this.dayConfig.weather.fogFar,
    );
    this.scene.fog = this.sceneFog;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3. Orthographic Isometric Camera
    const aspect = (mountEl.clientWidth || window.innerWidth) / Math.max(1, mountEl.clientHeight || window.innerHeight);
    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.5,
      220,
    );
    this.camera.position.set(30, 27, 30);
    this.camera.lookAt(0, 0, 0);

    // 4. Warm/Cool Alpine Studio Lighting Rig (<= 2 shadow/point lights)
    this.hemiLight = new THREE.HemisphereLight(0xbbe0ff, 0x4c5d78, this.dayConfig.weather.hemiIntensity);
    this.hemiLight.position.set(0, 40, 0);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe1b8, 2.05);
    this.keyLight.position.set(28, 42, 18);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 6;
    this.keyLight.shadow.camera.far = 115;
    const sd = 34;
    this.keyLight.shadow.camera.left = -sd;
    this.keyLight.shadow.camera.right = sd;
    this.keyLight.shadow.camera.top = sd;
    this.keyLight.shadow.camera.bottom = -sd;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x9ecaff, 0.45);
    rimLight.position.set(-28, 20, -24);
    this.scene.add(rimLight);

    // 5. Procedural Textures & Static Alpine Village Environment
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.buildStaticTerrainAndRoads();
    this.buildStaticVillageStructures();
    buildPerimeterPineForest(this.scene);
    buildVillageFencesAndRocks(this.scene);

    // 6. Hero Snowplow Truck
    this.truck = createSnowplowTruck(this.textures);
    this.truck.updateUpgrades(this.upgrades);
    this.scene.add(this.truck.group);

    this.truckHeadlight = new THREE.PointLight(0xffcb78, 3.2, 15, 1.8);
    this.truckHeadlight.position.set(0, 1.5, 3.2);
    this.truck.group.add(this.truckHeadlight);

    // 7. Pooled Particle & Weather InstancedMeshes
    this.snowParticleMesh = this.initSnowParticles();
    this.smokeMesh = this.initSmokeParticles();
    this.flakeMesh = this.initFallingSnowflakes();
    const mist = this.initBlowingSnowMist();
    this.mistVeilMesh = mist.mesh;
    this.mistVeilMat = mist.material;

    this.scene.add(this.dayGroup);

    // 8. Build Day 1 Snow Field & Props
    this.loadDay(1, false);

    // Pre-warm shaders on GPU devices
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 9. Attach Listeners & Start Simulation Loop
    this.bindEvents();
    this.emitHud(true);

    this.lastTimeMs = performance.now();
    this.tick();
  }

  private buildStaticTerrainAndRoads(): void {
    // Rolling snowy alpine valley floor extending far into the horizon fog
    const terrainGeo = new THREE.PlaneGeometry(190, 190, 72, 72);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeightAt(x, z);
      pos.setY(i, y);

      // Subtle cool-blue valley shading on hills, creamy white in village
      const hNorm = Math.min(1, y / 7.5);
      _color.setRGB(0.89 - hNorm * 0.08, 0.93 - hNorm * 0.05, 0.98 - hNorm * 0.01);
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
      bumpMap: this.textures.snowBump,
      bumpScale: 0.04,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);

    // Warm cobblestone paved roads & Hearthstone Village Square (offset cleanly on Y = 0.018)
    const cobbleMat = new THREE.MeshStandardMaterial({
      map: this.textures.cobbleMap,
      bumpMap: this.textures.cobbleBump,
      bumpScale: 0.06,
      roughness: 0.78,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x627080,
      roughness: 0.84,
      metalness: 0.05,
    });

    // Central circular Hearthstone Square plaza
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(11.7, 11.9, 0.04, 36), cobbleMat);
    plaza.position.y = 0.018;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // Main East-West & North-South Avenues
    const ewRoad = new THREE.Mesh(new THREE.BoxGeometry(47.4, 0.04, 9.4), cobbleMat);
    ewRoad.position.y = 0.016;
    ewRoad.receiveShadow = true;
    this.scene.add(ewRoad);

    const nsRoad = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.04, 47.4), cobbleMat);
    nsRoad.position.y = 0.017;
    nsRoad.receiveShadow = true;
    this.scene.add(nsRoad);

    // Outer village loop road (4 perimeter segments)
    const loopPositions: [number, number, number, number][] = [
      [0, -20.4, 47.4, 6.4],
      [0, 20.4, 47.4, 6.4],
      [-20.4, 0, 6.4, 47.4],
      [20.4, 0, 6.4, 47.4],
    ];
    loopPositions.forEach(([x, z, w, d]) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 0.038, d), cobbleMat);
      seg.position.set(x, 0.015, z);
      seg.receiveShadow = true;
      this.scene.add(seg);
    });

    // Cozy raised snowy lawn islands around each of the 4 cottages
    const lawnSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f6fd,
      roughness: 0.82,
      bumpMap: this.textures.snowBump,
      bumpScale: 0.03,
    });
    const quadCoords: [number, number][] = [
      [-11.2, -11.2],
      [11.2, -11.2],
      [-11.2, 11.2],
      [11.2, 11.2],
    ];
    quadCoords.forEach(([qx, qz]) => {
      const island = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.14, 11.6), curbMat);
      island.position.set(qx, 0.05, qz);
      island.receiveShadow = true;
      this.scene.add(island);

      const snowPad = new THREE.Mesh(new THREE.BoxGeometry(11.1, 0.18, 11.1), lawnSnowMat);
      snowPad.position.set(qx, 0.1, qz);
      snowPad.receiveShadow = true;
      this.scene.add(snowPad);
    });
  }

  private buildStaticVillageStructures(): void {
    // Build temporary day-1 blueprint to place static cottages, lamps, and central fountain
    const layout = generateVillageBlueprint(this.dayConfig);

    // Central frozen stone fountain
    const fountain = createVillageFountain(this.textures);
    this.scene.add(fountain);

    // 4 Cozy Timber Alpine Cottages with curling chimney smoke
    this.chimneyTops = [];
    layout.cottages.forEach((c) => {
      const { group, chimneyLocalTop } = createAlpineCottage(this.textures, c.variant);
      group.position.set(c.x, 0.16, c.z);
      group.rotation.y = c.rotY;
      this.scene.add(group);

      // Compute world chimney emission point
      group.updateMatrixWorld(true);
      const worldTop = chimneyLocalTop.clone().applyMatrix4(group.matrixWorld);
      this.chimneyTops.push(worldTop);
    });

    // Warm Wrought-Iron Streetlamps
    layout.lamps.forEach(([lx, lz]) => {
      const lamp = createStreetLamp(this.textures);
      lamp.position.set(lx, 0.02, lz);
      this.scene.add(lamp);
    });
  }

  private initSnowParticles(): THREE.InstancedMesh {
    const count = 240;
    const geo = new THREE.DodecahedronGeometry(0.24, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.05,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.snowParticles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotY: 0,
        scale: 0,
        age: 0,
        life: 0.7,
        isGold: false,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, COLOR_SNOW_NORMAL);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  private initSmokeParticles(): THREE.InstancedMesh {
    const count = 90;
    const geo = new THREE.SphereGeometry(0.28, 7, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.smokeParticles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
        age: 0,
        life: 2.2,
        isEmber: false,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, COLOR_SMOKE_WARM);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  private initFallingSnowflakes(): THREE.InstancedMesh {
    const count = 720;
    const geo = new THREE.OctahedronGeometry(0.115, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      fog: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      const f: Snowflake = {
        x: (Math.random() - 0.5) * 66,
        y: Math.random() * 24,
        z: (Math.random() - 0.5) * 66,
        speedY: 1.9 + Math.random() * 2.2,
        driftPhase: Math.random() * Math.PI * 2,
        scale: 0.55 + Math.random() * 0.95,
      };
      this.flakes.push(f);
      _dummy.position.set(f.x, f.y, f.z);
      _dummy.scale.setScalar(f.scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  private initBlowingSnowMist(): { mesh: THREE.InstancedMesh; material: THREE.MeshBasicMaterial } {
    const count = 44;
    const geo = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: this.textures.warmGlowMap,
      color: 0xe6f1fc,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      const wisp = {
        x: (Math.random() - 0.5) * 58,
        y: 2.2 + Math.random() * 9.5,
        z: (Math.random() - 0.5) * 58,
        speed: 4.5 + Math.random() * 5.0,
        scaleX: 7.5 + Math.random() * 8.5,
        scaleY: 2.0 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
      };
      this.mistWisps.push(wisp);
      _dummy.position.set(wisp.x, wisp.y, wisp.z);
      _dummy.rotation.set(-0.45, Math.PI * 0.25, 0);
      _dummy.scale.set(wisp.scaleX, wisp.scaleY, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return { mesh, material };
  }

  /**
   * Resets snow blanket, collectibles, snowmen, and truck spawn for a specific Day shift.
   */
  public loadDay(dayNumber: number, enterPlaying: boolean): void {
    this.day = Math.max(1, dayNumber);
    this.dayConfig = getDayConfig(this.day);
    this.blueprint = generateVillageBlueprint(this.dayConfig);

    // Clear previous day dynamic meshes
    if (this.snowMesh) {
      this.dayGroup.remove(this.snowMesh);
      this.snowMesh.geometry.dispose();
      (this.snowMesh.material as THREE.Material).dispose();
      this.snowMesh = null;
    }
    this.dynamicProps.forEach((p) => this.dayGroup.remove(p.mesh));
    this.dynamicProps = [];

    // Build Snow Cushion InstancedMesh
    const cellCount = this.blueprint.snowCells.length;
    this.totalSnowCells = Math.max(1, cellCount);
    this.clearedCount = 0;

    // Pillowy rounded snowdrift geometry (bottom at y = 0)
    const snowGeo = new THREE.CylinderGeometry(0.68, 0.88, 0.56, 7);
    snowGeo.translate(0, 0.25, 0);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.74,
      metalness: 0.04,
      bumpMap: this.textures.snowBump,
      bumpScale: 0.045,
    });
    const snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, cellCount);
    snowMesh.receiveShadow = true;
    snowMesh.castShadow = false;
    snowMesh.frustumCulled = false;

    for (let i = 0; i < cellCount; i++) {
      const cell = this.blueprint.snowCells[i];
      this.writeSnowCellMatrix(snowMesh, cell);
      snowMesh.setColorAt(
        i,
        cell.kind === 'deep'
          ? COLOR_SNOW_DEEP
          : cell.kind === 'ice'
            ? COLOR_SNOW_ICE
            : COLOR_SNOW_NORMAL,
      );
    }
    snowMesh.instanceMatrix.needsUpdate = true;
    if (snowMesh.instanceColor) snowMesh.instanceColor.needsUpdate = true;
    this.snowMesh = snowMesh;
    this.dayGroup.add(snowMesh);

    // Spawn Golden Cocoa Crates
    let propId = 1;
    this.cratesTotal = this.blueprint.crateSpots.length;
    this.cratesFound = 0;
    this.blueprint.crateSpots.forEach(([x, z]) => {
      const mesh = createCocoaCrate(this.textures);
      mesh.position.set(x, 0.03, z);
      this.dayGroup.add(mesh);
      this.dynamicProps.push({
        id: propId++,
        x,
        z,
        collected: false,
        mesh,
        kind: 'crate',
        baseY: 0.03,
      });
    });

    // Spawn Playful Village Snowmen
    this.blueprint.snowmanSpots.forEach(([x, z]) => {
      const mesh = createSnowman();
      mesh.position.set(x, 0.03, z);
      mesh.rotation.y = Math.atan2(-x, -z);
      this.dayGroup.add(mesh);
      this.dynamicProps.push({
        id: propId++,
        x,
        z,
        collected: false,
        mesh,
        kind: 'snowman',
        baseY: 0.03,
      });
    });

    // Reset truck position to cozy south entrance of Hearthstone Square
    this.truckX = 0;
    this.truckZ = 8.4;
    this.truckHeading = Math.PI;
    this.truckVx = 0;
    this.truckVz = 0;
    this.chassisRoll = 0;
    this.chassisPitch = 0;
    this.truck.group.position.set(this.truckX, 0.02, this.truckZ);
    this.truck.group.rotation.set(0, this.truckHeading, 0);
    this.truck.updateUpgrades(this.upgrades);

    // Reset shift stats
    this.timeRemaining = this.dayConfig.durationSec;
    this.shiftCoins = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.maxCombo = 1;
    this.turboFuel = 1.0;
    this.isBoosting = false;
    this.refillAccum = 0;
    this.floatingEvent = null;
    this.weatherClock = 0;
    this.gustAmount = 0;
    this.isGusting = false;
    this.wasGusting = false;
    this.targetSkyColor.setHex(this.dayConfig.weather.skyHex);
    this.currentVisibilityPercent = this.dayConfig.weather.baseVisibilityPercent;

    if (enterPlaying) {
      this.phase = 'playing';
      this.camTarget.set(this.truckX, 0, this.truckZ);
    }
    this.emitHud(true);
  }

  private writeSnowCellMatrix(mesh: THREE.InstancedMesh, cell: SnowCell): void {
    if (cell.cleared || cell.depth <= 0.04) {
      _dummy.position.set(cell.x, -5, cell.z);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      mesh.setMatrixAt(cell.index, _dummy.matrix);
      return;
    }

    const hScale = cell.maxDepth * cell.depth * (cell.kind === 'ice' ? 0.24 : 1.0);
    const xzScale = cell.scaleVar * (0.72 + 0.28 * cell.depth);
    _dummy.position.set(cell.x, 0.02, cell.z);
    _dummy.rotation.set(0, cell.rotY, 0);
    _dummy.scale.set(xzScale, hScale, xzScale);
    _dummy.updateMatrix();
    mesh.setMatrixAt(cell.index, _dummy.matrix);
  }

  // --- Public UI Controls ---

  public previewDay(dayNumber: number): void {
    this.audio.unlock();
    this.loadDay(dayNumber, false);
  }

  public startNewGame(startDay?: number): void {
    this.audio.unlock();
    this.score = 0;
    this.loadDay(startDay ?? this.day, true);
    this.audio.playComboTierUp(2);
  }

  public startNextDay(): void {
    this.audio.unlock();
    this.loadDay(this.day + 1, true);
    this.audio.playComboTierUp(3);
  }

  public retryCurrentDay(): void {
    this.audio.unlock();
    this.loadDay(this.day, true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.heldKeys.clear();
      this.pointerDown = false;
      this.emitHud(true);
    } else if (this.phase === 'paused' || this.phase === 'workshop') {
      this.phase = 'playing';
      this.emitHud(true);
    }
  }

  public openWorkshop(): void {
    this.audio.unlock();
    if (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'victory' || this.phase === 'sunset') {
      this.phase = 'workshop';
      this.heldKeys.clear();
      this.pointerDown = false;
      this.emitHud(true);
    }
  }

  public closeWorkshop(startNextIfCleared = false): void {
    if (startNextIfCleared && this.getClearedPercent() >= this.dayConfig.targetPercent) {
      this.startNextDay();
      return;
    }
    if (this.timeRemaining <= 0 && this.getClearedPercent() < this.dayConfig.targetPercent) {
      this.retryCurrentDay();
      return;
    }
    this.phase = 'playing';
    this.emitHud(true);
  }

  public buyUpgrade(key: UpgradeKey): boolean {
    this.audio.unlock();
    const spec = UPGRADE_SPECS.find((s) => s.key === key);
    if (!spec) return false;
    const current = this.upgrades[key];
    if (current >= spec.maxLevel) return false;
    const cost = getUpgradeCost(spec, current);
    if (this.coins < cost) return false;

    this.coins -= cost;
    this.upgrades = { ...this.upgrades, [key]: current + 1 };
    this.truck.updateUpgrades(this.upgrades);
    this.audio.playUpgradeBuy();
    this.persistProgress();
    this.emitHud(true);
    return true;
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.emitHud(true);
  }

  private persistProgress(): void {
    if (this.score > this.highScore) this.highScore = this.score;
    if (this.day > this.bestDay) this.bestDay = this.day;
    saveProgress({
      coins: this.coins,
      highScore: this.highScore,
      bestDay: this.bestDay,
      upgrades: this.upgrades,
    });
  }

  private getClearedPercent(): number {
    return Math.min(100, Math.round((this.clearedCount / this.totalSnowCells) * 100));
  }

  private triggerFloatingEvent(text: string, tone: 'gold' | 'combo' | 'clear'): void {
    this.eventSeq += 1;
    this.floatingEvent = { id: this.eventSeq, text, tone };
    this.floatingEventTimer = 1.6;
  }

  // --- Event Binding ---

  private onKeyDown = (e: KeyboardEvent) => {
    this.audio.unlock();
    const code = e.code;

    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    // Edge-triggered global game shell shortcuts
    if (!e.repeat) {
      if (this.phase === 'title' && (code === 'Enter' || code === 'Space')) {
        this.startNewGame();
        return;
      }
      if (code === 'KeyM') {
        this.toggleMute();
        return;
      }
      if (code === 'Escape') {
        if (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'workshop') {
          this.togglePause();
        }
        return;
      }
      if (code === 'KeyU') {
        if (this.phase === 'playing' || this.phase === 'paused') {
          this.openWorkshop();
        } else if (this.phase === 'workshop') {
          this.closeWorkshop(false);
        }
        return;
      }
      if (this.phase === 'workshop') {
        const digitMap: Record<string, UpgradeKey> = {
          Digit1: 'blade',
          Digit2: 'engine',
          Digit3: 'turbo',
          Digit4: 'chime',
          Digit5: 'thermal',
        };
        if (digitMap[code]) {
          this.buyUpgrade(digitMap[code]);
          return;
        }
      }
    }

    this.heldKeys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.heldKeys.clear();
    this.pointerDown = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    if (e.button !== 0) return;
    this.audio.unlock();
    this.pointerDown = true;
    this.updatePointerDir(e);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown) return;
    this.updatePointerDir(e);
  };

  private onPointerUp = () => {
    this.pointerDown = false;
  };

  private updatePointerDir(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const mag = Math.hypot(dx, dy);
    if (mag > 18) {
      this.pointerVecX = dx / mag;
      this.pointerVecY = -dy / mag; // +Y is screen UP
    } else {
      this.pointerVecX = 0;
      this.pointerVecY = 0;
    }
  }

  private onResize = () => {
    const w = this.mountEl.clientWidth || window.innerWidth;
    const h = Math.max(1, this.mountEl.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h);
    this.updateCameraProjection(w / h);
  };

  private updateCameraProjection(aspect: number): void {
    this.camera.left = (-this.frustumCurrent * aspect) / 2;
    this.camera.right = (this.frustumCurrent * aspect) / 2;
    this.camera.top = this.frustumCurrent / 2;
    this.camera.bottom = -this.frustumCurrent / 2;
    this.camera.updateProjectionMatrix();
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('resize', this.onResize);
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('webglcontextlost', this.onContextLost);
  }

  // --- Particle Emitters ---

  private spawnSnowBurst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    count: number,
    isGold = false,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.snowParticles[this.snowParticleCursor];
      this.snowParticleCursor = (this.snowParticleCursor + 1) % this.snowParticles.length;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.45;
      p.y = y + Math.random() * 0.25;
      p.z = z + (Math.random() - 0.5) * 0.45;
      p.vx = vx + (Math.random() - 0.5) * 3.8;
      p.vy = vy + Math.random() * 3.2;
      p.vz = vz + (Math.random() - 0.5) * 3.8;
      p.rotX = Math.random() * 6;
      p.rotY = Math.random() * 6;
      p.scale = (isGold ? 0.9 : 0.75) + Math.random() * 0.75;
      p.age = 0;
      p.life = 0.48 + Math.random() * 0.36;
      p.isGold = isGold;
    }
  }

  private spawnSmoke(x: number, y: number, z: number, vy: number, scale: number, isEmber = false): void {
    const s = this.smokeParticles[this.smokeCursor];
    this.smokeCursor = (this.smokeCursor + 1) % this.smokeParticles.length;
    s.active = true;
    s.x = x + (Math.random() - 0.5) * 0.14;
    s.y = y;
    s.z = z + (Math.random() - 0.5) * 0.14;
    s.vx = (Math.random() - 0.5) * 0.55 + 0.35;
    s.vy = vy + Math.random() * 0.45;
    s.vz = (Math.random() - 0.5) * 0.55 - 0.25;
    s.scale = scale;
    s.age = 0;
    s.life = isEmber ? 0.55 + Math.random() * 0.25 : 1.7 + Math.random() * 0.9;
    s.isEmber = isEmber;
  }

  // --- Main Simulation Step ---

  private stepSimulation(dt: number): void {
    this.elapsedTime += dt;

    // Animate beacon light & floating golden crates even on title screen
    this.truck.beaconPivot.rotation.y += dt * (this.phase === 'playing' ? 5.6 : 2.2);
    for (const prop of this.dynamicProps) {
      if (!prop.collected && prop.kind === 'crate') {
        prop.mesh.rotation.y += dt * 1.15;
        prop.mesh.position.y = prop.baseY + Math.sin(this.elapsedTime * 3.2 + prop.id) * 0.1;
      }
    }

    // Gentle chimney smoke puffs from all 4 alpine cottages
    this.chimneyTimer += dt;
    if (this.chimneyTimer >= 0.28) {
      this.chimneyTimer = 0;
      const top = this.chimneyTops[Math.floor(Math.random() * this.chimneyTops.length)];
      if (top) {
        this.spawnSmoke(top.x, top.y, top.z, 1.45, 0.72, false);
      }
    }

    // Floating HUD event decay
    if (this.floatingEventTimer > 0) {
      this.floatingEventTimer -= dt;
      if (this.floatingEventTimer <= 0) {
        this.floatingEvent = null;
      }
    }

    // Update dynamic weather (fog depth, gusts, snow density, lighting, and blowing mist veil)
    this.updateDynamicWeather(dt);

    // Hitstop freeze frame (35ms punch on heavy snowbank/crate bursts)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.35);
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'playing') {
      this.stepPlaying(dt);
    } else {
      // Idle engine & camera choreography during Title / Pause / Workshop / Victory
      this.audio.updateContinuous(0, 0, false, false, this.currentWindIntensity);
      if (this.phase === 'title') {
        this.titlePanAngle += dt * 0.13;
      }
    }

    this.updateParticles(dt);
    this.updateCamera(dt);
  }

  private stepPlaying(dt: number): void {
    // 1. Shift Daylight Timer
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining <= 0) {
      this.phase = 'sunset';
      this.isBoosting = false;
      this.heldKeys.clear();
      this.pointerDown = false;
      this.persistProgress();
      this.emitHud(true);
      return;
    }

    // 2. Combo Decay Timer
    const comboMaxDuration = 2.6 + this.upgrades.chime * 0.42;
    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
      }
    }

    // 3. Read Isometric Input Vector
    let screenX = 0;
    let screenY = 0;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) screenY += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) screenY -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) screenX += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) screenX -= 1;

    if (screenX === 0 && screenY === 0 && this.pointerDown) {
      screenX = this.pointerVecX;
      screenY = this.pointerVecY;
    }

    const inputMag = Math.hypot(screenX, screenY);
    let desiredWorldX = 0;
    let desiredWorldZ = 0;
    if (inputMag > 0.05) {
      const nx = screenX / Math.max(1, inputMag);
      const ny = screenY / Math.max(1, inputMag);
      desiredWorldX = nx * ISO_RIGHT_X + ny * ISO_UP_X;
      desiredWorldZ = nx * ISO_RIGHT_Z + ny * ISO_UP_Z;
    }

    // 4. Turbo Boost Fuel Logic
    const wantsBoost = (this.heldKeys.has('Space') || this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight')) && inputMag > 0.05;
    const turboDrainRate = 1 / (3.2 + this.upgrades.turbo * 0.9);
    const turboRegenRate = 0.28 + this.upgrades.turbo * 0.07;

    if (wantsBoost && this.turboFuel > 0.04) {
      this.isBoosting = true;
      this.turboFuel = Math.max(0, this.turboFuel - turboDrainRate * dt);
      if (!this.wasBoosting) {
        this.audio.playTurboIgnite();
      }
    } else {
      this.isBoosting = false;
      this.turboFuel = Math.min(1, this.turboFuel + turboRegenRate * dt);
    }
    this.wasBoosting = this.isBoosting;

    // 5. Vehicle Physics (responsive arcade-isometric steering + ice traction)
    const baseMaxSpeed = 10.2 + this.upgrades.engine * 1.45;
    const boostMult = this.isBoosting ? 1.42 + this.upgrades.turbo * 0.06 : 1.0;
    const targetSpeed = baseMaxSpeed * boostMult;

    // Check if driving over uncleared ice patch (reduces grip unless Thermal >= 2)
    let onIce = false;
    if (this.upgrades.thermal < 2) {
      for (let i = 0; i < this.blueprint.snowCells.length; i++) {
        const c = this.blueprint.snowCells[i];
        if (!c.cleared && c.kind === 'ice') {
          if (Math.abs(c.x - this.truckX) < 1.1 && Math.abs(c.z - this.truckZ) < 1.1) {
            onIce = true;
            break;
          }
        }
      }
    }

    const accelRate = onIce ? 3.2 : 9.2 + this.upgrades.engine * 1.1;
    const frictionRate = onIce ? 1.6 : 6.4;

    let targetSteerVis = 0;
    if (inputMag > 0.05) {
      const targetAngle = Math.atan2(desiredWorldX, desiredWorldZ);
      let angleDiff = targetAngle - this.truckHeading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const turnRate = (onIce ? 5.2 : 9.6) * dt;
      const stepAngle = THREE.MathUtils.clamp(angleDiff, -turnRate, turnRate);
      this.truckHeading += stepAngle;
      targetSteerVis = THREE.MathUtils.clamp(angleDiff * 0.75, -0.45, 0.45);

      const fwdX = Math.sin(this.truckHeading);
      const fwdZ = Math.cos(this.truckHeading);
      // Drive cleanly along heading while blending toward desired direction
      const blendSpeed = targetSpeed * Math.max(0.35, Math.cos(angleDiff * 0.55));
      this.truckVx = THREE.MathUtils.damp(this.truckVx, fwdX * blendSpeed, accelRate, dt);
      this.truckVz = THREE.MathUtils.damp(this.truckVz, fwdZ * blendSpeed, accelRate, dt);
    } else {
      this.truckVx = THREE.MathUtils.damp(this.truckVx, 0, frictionRate, dt);
      this.truckVz = THREE.MathUtils.damp(this.truckVz, 0, frictionRate, dt);
    }

    // Integrate position
    this.truckX += this.truckVx * dt;
    this.truckZ += this.truckVz * dt;

    // 6. Collisions (Village Perimeter Fence, Cottages, Fountain, Lamps)
    this.resolveCollisions();

    // 7. Snow Plowing & Clearing Check
    const plowedInfo = this.processSnowPlowing(dt, comboMaxDuration);

    // 8. Interactive Props (Golden Cocoa Crates & Snowmen)
    this.processInteractiveProps(comboMaxDuration);

    // 9. Gentle Storm Snow Refill on Harder Days
    if (this.dayConfig.refillRate > 0 && this.clearedCount > 25) {
      this.refillAccum += this.dayConfig.refillRate * dt;
      if (this.refillAccum >= 1) {
        this.refillAccum -= 1;
        this.refillRandomClearedCell();
      }
    }

    // 10. Visual Kinematics on the 3D Truck
    const speed = Math.hypot(this.truckVx, this.truckVz);
    const speedRatio = Math.min(1.4, speed / baseMaxSpeed);
    this.wheelSpin += speed * dt * 2.2;
    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, targetSteerVis, 14, dt);
    this.chassisRoll = THREE.MathUtils.damp(this.chassisRoll, -targetSteerVis * speedRatio * 0.14, 10, dt);
    this.chassisPitch = THREE.MathUtils.damp(
      this.chassisPitch,
      (this.isBoosting ? -0.055 : 0) + (plowedInfo.heavyHit ? 0.04 : 0),
      11,
      dt,
    );

    this.truck.group.position.set(this.truckX, 0.02, this.truckZ);
    this.truck.group.rotation.set(0, this.truckHeading, 0);
    this.truck.bodyGroup.rotation.set(this.chassisPitch, 0, this.chassisRoll);
    this.truck.bodyGroup.position.y = Math.sin(this.elapsedTime * 22) * Math.min(0.018, speed * 0.002);

    this.truck.frontWheelPivots.forEach((p) => {
      p.rotation.y = this.steerAngle;
    });
    this.truck.wheelMeshes.forEach((w) => {
      w.rotation.x = this.wheelSpin;
    });

    // Twin exhaust stack smoke/ember puffs
    this.exhaustTimer += dt * (this.isBoosting ? 3.5 : 1 + speedRatio);
    if (this.exhaustTimer >= 0.14) {
      this.exhaustTimer = 0;
      const sinH = Math.sin(this.truckHeading);
      const cosH = Math.cos(this.truckHeading);
      const side = Math.random() > 0.5 ? 0.86 : -0.86;
      const exX = this.truckX + cosH * side - sinH * 0.68;
      const exZ = this.truckZ - sinH * side - cosH * 0.68;
      this.spawnSmoke(exX, 2.02, exZ, this.isBoosting ? 2.6 : 1.3, this.isBoosting ? 0.55 : 0.36, this.isBoosting);
    }

    // Continuous Web Audio engine + snow crunch + dynamic weather wind
    this.plowActivitySmooth = THREE.MathUtils.damp(
      this.plowActivitySmooth,
      Math.min(1, plowedInfo.cellsTouched * 0.45),
      12,
      dt,
    );
    this.audio.updateContinuous(
      speedRatio,
      this.plowActivitySmooth,
      this.isBoosting,
      true,
      this.currentWindIntensity,
    );

    // Check Shift Clear Victory!
    if (this.getClearedPercent() >= this.dayConfig.targetPercent) {
      const timeBonus = Math.round(this.timeRemaining * 2.5);
      const totalBonus = this.dayConfig.clearBonus + timeBonus;
      this.coins += totalBonus;
      this.shiftCoins += totalBonus;
      this.score += totalBonus * 5;
      this.phase = 'victory';
      this.isBoosting = false;
      this.heldKeys.clear();
      this.pointerDown = false;
      this.audio.playShiftComplete();
      this.persistProgress();
      this.emitHud(true);
    }
  }

  private resolveCollisions(): void {
    const truckRadius = 1.28;
    const bound = this.blueprint.halfArena - 1.3;
    let bumped = false;

    // Outer village split-rail fences
    if (this.truckX < -bound) {
      this.truckX = -bound;
      this.truckVx = Math.abs(this.truckVx) * 0.25;
      bumped = true;
    } else if (this.truckX > bound) {
      this.truckX = bound;
      this.truckVx = -Math.abs(this.truckVx) * 0.25;
      bumped = true;
    }
    if (this.truckZ < -bound) {
      this.truckZ = -bound;
      this.truckVz = Math.abs(this.truckVz) * 0.25;
      bumped = true;
    } else if (this.truckZ > bound) {
      this.truckZ = bound;
      this.truckVz = -Math.abs(this.truckVz) * 0.25;
      bumped = true;
    }

    // Circle obstacles (Fountain + Streetlamps)
    for (const c of this.blueprint.circleColliders) {
      const dx = this.truckX - c.x;
      const dz = this.truckZ - c.z;
      const dist = Math.hypot(dx, dz);
      const minDist = truckRadius + c.radius;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        this.truckX = c.x + nx * minDist;
        this.truckZ = c.z + nz * minDist;
        const dot = this.truckVx * nx + this.truckVz * nz;
        if (dot < 0) {
          this.truckVx -= nx * dot * 1.25;
          this.truckVz -= nz * dot * 1.25;
          if (Math.abs(dot) > 3.2) bumped = true;
        }
      }
    }

    // Cottage box colliders
    for (const b of this.blueprint.boxColliders) {
      const closestX = THREE.MathUtils.clamp(this.truckX, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(this.truckZ, b.minZ, b.maxZ);
      const dx = this.truckX - closestX;
      const dz = this.truckZ - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < truckRadius * truckRadius && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const push = truckRadius - dist;
        this.truckX += nx * push;
        this.truckZ += nz * push;
        const dot = this.truckVx * nx + this.truckVz * nz;
        if (dot < 0) {
          this.truckVx -= nx * dot * 1.2;
          this.truckVz -= nz * dot * 1.2;
          if (Math.abs(dot) > 3.2) bumped = true;
        }
      }
    }

    if (bumped) {
      this.audio.playBump();
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.22);
    }
  }

  private processSnowPlowing(dt: number, comboMaxDuration: number): { cellsTouched: number; heavyHit: boolean } {
    if (!this.snowMesh) return { cellsTouched: 0, heavyHit: false };

    const sinH = Math.sin(this.truckHeading);
    const cosH = Math.cos(this.truckHeading);
    // Plow blade center sits 2.05m ahead of truck center
    const bladeX = this.truckX + sinH * 2.05;
    const bladeZ = this.truckZ + cosH * 2.05;
    // Right perpendicular vector for blade width sweep
    const rightX = cosH;
    const rightZ = -sinH;

    const bladeHalfWidth = (2.3 + this.upgrades.blade * 0.48) * 0.54;
    const thermalAura = this.upgrades.thermal * 0.14;
    const reachRadius = bladeHalfWidth + 0.55 + thermalAura;
    const reachSq = reachRadius * reachRadius;

    let cellsTouched = 0;
    let heavyHit = false;
    let matrixDirty = false;
    const speed = Math.hypot(this.truckVx, this.truckVz);

    for (let i = 0; i < this.blueprint.snowCells.length; i++) {
      const cell = this.blueprint.snowCells[i];
      if (cell.cleared) continue;

      const dx = cell.x - bladeX;
      const dz = cell.z - bladeZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > reachSq) continue;

      // Project into blade local coordinates (lateral along blade width, forward depth)
      const lateral = dx * rightX + dz * rightZ;
      const forward = dx * sinH + dz * cosH;

      if (Math.abs(lateral) > bladeHalfWidth + 0.42 + thermalAura) continue;
      if (forward < -1.15 || forward > 1.05 + thermalAura) continue;

      cellsTouched++;

      // Deep drifts take resistance unless powered up by Engine / Thermal / Boost
      const power = 1 + this.upgrades.engine * 0.35 + this.upgrades.thermal * 0.55 + (this.isBoosting ? 1.4 : 0);
      if (cell.kind === 'deep' && power < 2.2) {
        cell.depth -= dt * 7.8 * power;
        // Gentle physical snow drag
        this.truckVx *= Math.max(0.86, 1 - dt * 1.4);
        this.truckVz *= Math.max(0.86, 1 - dt * 1.4);
      } else {
        cell.depth = 0;
      }

      if (cell.depth <= 0.05) {
        cell.depth = 0;
        cell.cleared = true;
        this.clearedCount++;
        this.writeSnowCellMatrix(this.snowMesh, cell);
        matrixDirty = true;

        // Combo & Reward calculation
        const prevMult = this.comboMultiplier;
        this.comboCount += cell.kind === 'deep' ? 2 : 1;
        this.comboTimer = comboMaxDuration;
        this.comboMultiplier = comboCountToMultiplier(this.comboCount);
        if (this.comboMultiplier > this.maxCombo) {
          this.maxCombo = this.comboMultiplier;
        }

        const chimeBonus = 1 + this.upgrades.chime * 0.25;
        const baseCoins = cell.kind === 'deep' ? 5 : cell.kind === 'ice' ? 3 : 2;
        const earnedCoins = Math.max(1, Math.round(baseCoins * (1 + (this.comboMultiplier - 1) * 0.28) * chimeBonus));
        const earnedScore = (cell.kind === 'deep' ? 30 : 12) * this.comboMultiplier;

        this.coins += earnedCoins;
        this.shiftCoins += earnedCoins;
        this.score += earnedScore;

        // Launch sculpted snow spray off the angled side of the plow blade!
        const sideSign = lateral >= 0 ? 1 : -1;
        const spraySpeed = Math.max(3.6, speed * 0.55);
        this.spawnSnowBurst(
          cell.x,
          0.35,
          cell.z,
          rightX * sideSign * spraySpeed + sinH * 1.5,
          cell.kind === 'deep' ? 4.8 : 3.2,
          rightZ * sideSign * spraySpeed + cosH * 1.5,
          cell.kind === 'deep' ? 6 : 2,
          this.comboMultiplier >= 8 && Math.random() < 0.25,
        );

        if (cell.kind === 'deep') {
          heavyHit = true;
          this.audio.playDeepDriftBurst();
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.28);
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.028);
        } else {
          this.audio.playSnowChime(this.comboCount, false);
        }

        if (this.comboMultiplier > prevMult) {
          this.audio.playComboTierUp(this.comboMultiplier);
          this.triggerFloatingEvent(`x${this.comboMultiplier} Combo Streak!`, 'combo');
        }
      } else {
        this.writeSnowCellMatrix(this.snowMesh, cell);
        matrixDirty = true;
      }
    }

    if (matrixDirty) {
      this.snowMesh.instanceMatrix.needsUpdate = true;
    }

    return { cellsTouched, heavyHit };
  }

  private processInteractiveProps(comboMaxDuration: number): void {
    const sinH = Math.sin(this.truckHeading);
    const cosH = Math.cos(this.truckHeading);
    const hitX = this.truckX + sinH * 1.25;
    const hitZ = this.truckZ + cosH * 1.25;

    for (const prop of this.dynamicProps) {
      if (prop.collected) continue;
      const dist = Math.hypot(prop.x - hitX, prop.z - hitZ);
      const triggerR = 1.9 + this.upgrades.blade * 0.14;
      if (dist < triggerR) {
        prop.collected = true;
        prop.mesh.visible = false;

        if (prop.kind === 'crate') {
          this.cratesFound++;
          const bonusCoins = Math.round(45 * (1 + this.upgrades.chime * 0.25));
          this.coins += bonusCoins;
          this.shiftCoins += bonusCoins;
          this.score += 350 * this.comboMultiplier;
          this.timeRemaining = Math.min(this.dayConfig.durationSec + 20, this.timeRemaining + 8);
          this.turboFuel = 1.0;
          this.comboCount += 8;
          this.comboTimer = comboMaxDuration;
          this.comboMultiplier = comboCountToMultiplier(this.comboCount);
          if (this.comboMultiplier > this.maxCombo) this.maxCombo = this.comboMultiplier;

          this.audio.playGoldenPickup();
          this.spawnSnowBurst(prop.x, 0.7, prop.z, 0, 5.2, 0, 18, true);
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.36);
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.045);
          this.triggerFloatingEvent(`Cocoa Crate! +${bonusCoins} Coins · +8s`, 'gold');
        } else {
          // Playful snowman pop!
          const bonusCoins = 25;
          this.coins += bonusCoins;
          this.shiftCoins += bonusCoins;
          this.score += 180 * this.comboMultiplier;
          this.comboCount += 5;
          this.comboTimer = comboMaxDuration;
          this.comboMultiplier = comboCountToMultiplier(this.comboCount);
          if (this.comboMultiplier > this.maxCombo) this.maxCombo = this.comboMultiplier;

          this.audio.playDeepDriftBurst();
          this.audio.playSnowChime(this.comboCount + 3, true);
          this.spawnSnowBurst(prop.x, 0.9, prop.z, 0, 4.8, 0, 16, false);
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.26);
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.032);
          this.triggerFloatingEvent(`Snowman Pop! +${bonusCoins} Coins`, 'clear');
        }
      }
    }
  }

  private refillRandomClearedCell(): void {
    if (!this.snowMesh) return;
    // Try a few random cells away from the truck to gently drift back in heavy storms
    for (let attempt = 0; attempt < 8; attempt++) {
      const idx = Math.floor(Math.random() * this.blueprint.snowCells.length);
      const cell = this.blueprint.snowCells[idx];
      if (!cell.cleared) continue;
      if (Math.hypot(cell.x - this.truckX, cell.z - this.truckZ) < 8.5) continue;

      cell.cleared = false;
      cell.kind = 'normal';
      cell.maxDepth = 0.78;
      cell.depth = 0.9;
      this.clearedCount = Math.max(0, this.clearedCount - 1);
      this.writeSnowCellMatrix(this.snowMesh, cell);
      this.snowMesh.setColorAt(cell.index, COLOR_SNOW_NORMAL);
      this.snowMesh.instanceMatrix.needsUpdate = true;
      if (this.snowMesh.instanceColor) this.snowMesh.instanceColor.needsUpdate = true;
      break;
    }
  }

  private updateParticles(dt: number): void {
    // 1. Snow spray chunks
    let snowDirty = false;
    for (let i = 0; i < this.snowParticles.length; i++) {
      const p = this.snowParticles[i];
      if (!p.active) continue;
      snowDirty = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.snowParticleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      p.vy -= 14.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.1) {
        p.y = 0.1;
        p.vy *= -0.25;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      p.rotX += dt * 7;
      p.rotY += dt * 5;

      const t = p.age / p.life;
      const sc = p.scale * (1 - t * t);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.rotX, p.rotY, 0);
      _dummy.scale.setScalar(Math.max(0.01, sc));
      _dummy.updateMatrix();
      this.snowParticleMesh.setMatrixAt(i, _dummy.matrix);
      this.snowParticleMesh.setColorAt(i, p.isGold ? COLOR_GOLD_SPARK : COLOR_SNOW_NORMAL);
    }
    if (snowDirty) {
      this.snowParticleMesh.instanceMatrix.needsUpdate = true;
      if (this.snowParticleMesh.instanceColor) this.snowParticleMesh.instanceColor.needsUpdate = true;
    }

    // 2. Chimney & Exhaust Smoke
    let smokeDirty = false;
    for (let i = 0; i < this.smokeParticles.length; i++) {
      const s = this.smokeParticles[i];
      if (!s.active) continue;
      smokeDirty = true;
      s.age += dt;
      if (s.age >= s.life) {
        s.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const t = s.age / s.life;
      const sc = s.scale * (0.45 + t * 1.4) * (1 - Math.pow(t, 3));
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.rotation.set(0, t * 2, 0);
      _dummy.scale.setScalar(Math.max(0.01, sc));
      _dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, _dummy.matrix);
      this.smokeMesh.setColorAt(i, s.isEmber ? COLOR_SMOKE_EMBER : COLOR_SMOKE_WARM);
    }
    if (smokeDirty) {
      this.smokeMesh.instanceMatrix.needsUpdate = true;
      if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateDynamicWeather(dt: number): void {
    const w = this.dayConfig.weather;
    this.weatherClock += dt;

    // Smooth rolling squall gust wave (builds up organically, peaks, then eases)
    const cyclePhase = (this.weatherClock / w.gustPeriodSec) * Math.PI * 2;
    const rawWave = Math.sin(cyclePhase) * 0.65 + Math.sin(cyclePhase * 0.47 + 1.3) * 0.35;
    const targetGust = Math.pow(Math.max(0, rawWave), 1.8) * w.gustStrength;
    this.gustAmount = THREE.MathUtils.damp(this.gustAmount, targetGust, 1.4, dt);

    this.isGusting = this.gustAmount > 0.36;
    if (this.isGusting && !this.wasGusting && this.phase === 'playing' && this.day >= 2) {
      this.triggerFloatingEvent('Snow Squall — Visibility Dropping', 'clear');
    }
    this.wasGusting = this.isGusting;

    // 1. Linear Fog & Horizon Color Transition (directly alters gameplay visibility distance)
    this.targetSkyColor.setHex(w.skyHex);
    const colorLerp = 1 - Math.exp(-2.2 * dt);
    this.skyColor.lerp(this.targetSkyColor, colorLerp);
    this.sceneFog.color.copy(this.skyColor);

    const targetNear = Math.max(18, w.fogNear - this.gustAmount * w.gustFogPull * 0.55);
    const targetFar = Math.max(44, w.fogFar - this.gustAmount * w.gustFogPull);
    this.sceneFog.near = THREE.MathUtils.damp(this.sceneFog.near, targetNear, 2.2, dt);
    this.sceneFog.far = THREE.MathUtils.damp(this.sceneFog.far, targetFar, 2.2, dt);

    // Live visibility percentage readout (100% crisp morning -> ~20% severe whiteout gust)
    const visDrop = Math.round(this.gustAmount * 22);
    this.currentVisibilityPercent = Math.max(18, Math.min(100, w.baseVisibilityPercent - visDrop));

    // 2. Adaptive Storm Lighting & Brighter Headlights in Low Visibility
    const targetSun = Math.max(0.55, w.sunIntensity - this.gustAmount * 0.35);
    const targetHemi = Math.max(0.45, w.hemiIntensity - this.gustAmount * 0.14);
    this.keyLight.intensity = THREE.MathUtils.damp(this.keyLight.intensity, targetSun, 2.5, dt);
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, targetHemi, 2.5, dt);

    const hlBoost = w.headlightBoost + this.gustAmount * 0.9;
    this.truckHeadlight.intensity = THREE.MathUtils.damp(this.truckHeadlight.intensity, 3.2 + hlBoost * 2.4, 3.0, dt);
    const hlMat = this.truck.headlightGlow.material as THREE.MeshBasicMaterial;
    hlMat.opacity = THREE.MathUtils.damp(hlMat.opacity, Math.min(0.95, 0.52 + hlBoost * 0.28), 3.0, dt);

    // 3. Dynamic Ambient Wind Audio Level
    this.currentWindIntensity = THREE.MathUtils.damp(
      this.currentWindIntensity,
      (w.windSpeed / 6.5) * 0.7 + this.gustAmount * 0.85,
      2.0,
      dt,
    );

    // 4. Falling Snowflakes (active count, speed, and wind slant scale with day + gust)
    const activeRatio = Math.min(1, w.activeFlakeRatio + this.gustAmount * 0.26);
    const activeCount = Math.floor(this.flakes.length * activeRatio);
    const fallMult = this.dayConfig.snowIntensity + this.gustAmount * 0.65;
    const windTotal = w.windSpeed + this.gustAmount * 6.8;
    // Wind blows across the isometric frame diagonally
    const windX = windTotal * 0.88;
    const windZ = -windTotal * 0.48;

    for (let i = 0; i < this.flakes.length; i++) {
      if (i >= activeCount) {
        _dummy.position.set(0, -40, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.flakeMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const f = this.flakes[i];
      f.y -= f.speedY * fallMult * dt;
      f.x += (windX + Math.sin(this.elapsedTime * 1.7 + f.driftPhase) * (0.9 + this.gustAmount * 1.4)) * dt;
      f.z += (windZ + Math.cos(this.elapsedTime * 1.3 + f.driftPhase) * (0.9 + this.gustAmount * 1.4)) * dt;

      // Wrap flakes around active camera focus volume
      const relX = f.x - this.camTarget.x;
      const relZ = f.z - this.camTarget.z;
      if (f.y < 0.1 || Math.abs(relX) > 36 || Math.abs(relZ) > 36) {
        f.y = f.y < 0.1 ? 22 + Math.random() * 5 : f.y;
        f.x = this.camTarget.x + (Math.random() - 0.5) * 66;
        f.z = this.camTarget.z + (Math.random() - 0.5) * 66;
      }

      _dummy.position.set(f.x, f.y, f.z);
      _dummy.rotation.set(this.elapsedTime + f.driftPhase, f.driftPhase, 0);
      const gustScale = 1 + this.gustAmount * 0.25;
      _dummy.scale.set(f.scale * (1 + this.gustAmount * 0.55), f.scale * gustScale, f.scale);
      _dummy.updateMatrix();
      this.flakeMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.flakeMesh.instanceMatrix.needsUpdate = true;

    // 5. Blowing Snow Veil Wisps (translucent drifting fog bands in heavy snow/gusts)
    const mistStrength = Math.max(0, (w.activeFlakeRatio - 0.42) * 0.34 + this.gustAmount * 0.22);
    this.mistVeilMat.opacity = THREE.MathUtils.damp(this.mistVeilMat.opacity, Math.min(0.28, mistStrength), 2.0, dt);
    this.mistVeilMesh.visible = this.mistVeilMat.opacity > 0.008;

    if (this.mistVeilMesh.visible) {
      const wispWind = 1 + windTotal * 0.28;
      for (let i = 0; i < this.mistWisps.length; i++) {
        const m = this.mistWisps[i];
        m.x += m.speed * wispWind * 0.72 * dt;
        m.z -= m.speed * wispWind * 0.38 * dt;
        const dx = m.x - this.camTarget.x;
        const dz = m.z - this.camTarget.z;
        if (dx > 32 || dz < -32 || dx < -34 || dz > 34) {
          m.x = this.camTarget.x - 28 + Math.random() * 14;
          m.z = this.camTarget.z + (Math.random() - 0.5) * 52;
        }
        _dummy.position.set(m.x, m.y + Math.sin(this.elapsedTime * 0.9 + m.phase) * 0.45, m.z);
        _dummy.rotation.set(-0.55, Math.PI * 0.25, 0);
        _dummy.scale.set(m.scaleX, m.scaleY, 1);
        _dummy.updateMatrix();
        this.mistVeilMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.mistVeilMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateCamera(dt: number): void {
    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);

    if (this.phase === 'title') {
      // Atmospheric gentle live-world orbit over Hearthstone Alpine Village
      const radius = 38;
      const cx = Math.cos(this.titlePanAngle) * radius;
      const cz = Math.sin(this.titlePanAngle) * radius;
      this.camTarget.set(0, 1.0, 0);
      this.camera.position.set(cx, 27, cz);
      this.camera.lookAt(this.camTarget);
      this.frustumCurrent = THREE.MathUtils.damp(this.frustumCurrent, 31, 4, dt);
    } else {
      // Crisp isometric follow camera with gentle velocity look-ahead
      const lookAheadX = this.truckX + this.truckVx * 0.24;
      const lookAheadZ = this.truckZ + this.truckVz * 0.24;
      this.camTarget.x = THREE.MathUtils.damp(this.camTarget.x, lookAheadX, 5.8, dt);
      this.camTarget.z = THREE.MathUtils.damp(this.camTarget.z, lookAheadZ, 5.8, dt);
      this.camTarget.y = 0.5;

      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

      this.camera.position.set(
        this.camTarget.x + 28 + shakeX,
        26 + shakeY,
        this.camTarget.z + 28,
      );
      this.camera.lookAt(this.camTarget);

      // Subtle dynamic zoom out when turbo boosting or using wider blades, tightening slightly during whiteout gusts
      const targetFrustum =
        25 + this.upgrades.blade * 0.55 + (this.isBoosting ? 2.2 : 0) - this.gustAmount * 1.35;
      this.frustumCurrent = THREE.MathUtils.damp(this.frustumCurrent, targetFrustum, 4.5, dt);
    }

    const w = this.mountEl.clientWidth || window.innerWidth;
    const h = Math.max(1, this.mountEl.clientHeight || window.innerHeight);
    this.updateCameraProjection(w / h);

    // Keep shadow camera centered around active region
    _vec3A.set(this.camTarget.x + 26, 42, this.camTarget.z + 18);
    _vec3B.set(this.camTarget.x, 0, this.camTarget.z);
    this.keyLight.position.copy(_vec3A);
    this.keyLight.target.position.copy(_vec3B);
  }

  private emitHud(force = false): void {
    if (!force && this.hudEmitAccum < 0.08) return;
    this.hudEmitAccum = 0;

    const comboMaxDuration = 2.6 + this.upgrades.chime * 0.42;
    this.onHudUpdate({
      phase: this.phase,
      day: this.day,
      dayTitle: this.dayConfig.title,
      weatherLabel: this.dayConfig.weather.label,
      visibilityPercent: this.currentVisibilityPercent,
      isGusting: this.isGusting,
      clearedPercent: this.getClearedPercent(),
      targetPercent: this.dayConfig.targetPercent,
      timeRemaining: Math.ceil(this.timeRemaining),
      coins: this.coins,
      shiftCoins: this.shiftCoins,
      score: this.score,
      highScore: Math.max(this.highScore, this.score),
      comboCount: this.comboCount,
      comboMultiplier: this.comboMultiplier,
      comboTimerRatio: this.comboCount > 0 ? Math.max(0, Math.min(1, this.comboTimer / comboMaxDuration)) : 0,
      turboRatio: this.turboFuel,
      isBoosting: this.isBoosting,
      maxCombo: this.maxCombo,
      cratesFound: this.cratesFound,
      cratesTotal: this.cratesTotal,
      upgrades: this.upgrades,
      muted: this.audio.isMuted(),
      floatingEvent: this.floatingEvent,
    });
  }

  // --- Frame Pacing (GPU rAF vs Software WebGL fenceSync afterDraw) ---

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.stepSimulation(dt);
    this.hudEmitAccum += dt;
    this.emitHud(false);

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('webglcontextlost', this.onContextLost);

    this.audio.dispose();
    this.textures.dispose();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (dom.parentElement === this.mountEl) {
      this.mountEl.removeChild(dom);
    }
  }
}
