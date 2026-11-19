import * as THREE from 'three';
import { DayConfig } from './types';

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
}

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type SnowKind = 'normal' | 'deep' | 'ice';

export interface SnowCell {
  index: number;
  x: number;
  z: number;
  kind: SnowKind;
  maxDepth: number;
  depth: number; // 0 = cleared, 1 = full
  cleared: boolean;
  scaleVar: number;
  rotY: number;
}

export interface CottagePlacement {
  x: number;
  z: number;
  rotY: number;
  variant: number;
}

export interface VillageBlueprint {
  halfArena: number;
  cellSize: number;
  gridSpan: number;
  cottages: CottagePlacement[];
  lamps: [number, number][];
  crateSpots: [number, number][];
  snowmanSpots: [number, number][];
  circleColliders: CircleCollider[];
  boxColliders: BoxCollider[];
  snowCells: SnowCell[];
}

/**
 * Deterministic terrain elevation outside the flat playable village basin.
 * Returns 0 across the entire village road/plaza basin so roads and snow sit flush.
 */
export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  const flatRadius = 29.5;
  if (dist <= flatRadius) return 0;
  const t = Math.min(1, (dist - flatRadius) / 26);
  const smooth = t * t * (3 - 2 * t);
  const hills =
    Math.sin(x * 0.085) * Math.cos(z * 0.085) * 4.2 +
    Math.sin((x + z) * 0.05) * 2.4 +
    3.6;
  return Math.max(0, smooth * hills);
}

/**
 * Determines whether a world (x, z) point lies on the village's paved cobblestone
 * roads, central town square, or cottage driveways.
 */
export function isRoadOrPlaza(x: number, z: number): boolean {
  // Central circular Hearthstone Square (around fountain at 0,0)
  const distCenter = Math.hypot(x, z);
  if (distCenter >= 3.6 && distCenter <= 11.4) {
    return true;
  }

  // Main East-West Village Avenue
  if (Math.abs(z) <= 4.6 && Math.abs(x) <= 23.5) {
    return true;
  }

  // Main North-South Alpine Lane
  if (Math.abs(x) <= 4.6 && Math.abs(z) <= 23.5) {
    return true;
  }

  // Cozy Outer Perimeter Loop Road (Ring around the cottages)
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const onHorizontalLoop = absZ >= 17.4 && absZ <= 23.4 && absX <= 23.4;
  const onVerticalLoop = absX >= 17.4 && absX <= 23.4 && absZ <= 23.4;
  if (onHorizontalLoop || onVerticalLoop) {
    return true;
  }

  // Cozy diagonal corner turnouts
  if (absX >= 10 && absX <= 17.5 && absZ >= 10 && absZ <= 14.5) {
    return false;
  }

  return false;
}

export function generateVillageBlueprint(dayConfig: DayConfig): VillageBlueprint {
  const halfArena = 25.0;
  const cellSize = 1.25;
  const gridSpan = Math.floor((halfArena * 2) / cellSize);

  // 4 cozy corner village quadrants with alpine cottages facing the roads/square
  const cottages: CottagePlacement[] = [
    { x: -11.4, z: -11.4, rotY: Math.PI * 0.25, variant: 0 },
    { x: 11.4, z: -11.4, rotY: -Math.PI * 0.25, variant: 1 },
    { x: -11.4, z: 11.4, rotY: Math.PI * 0.75, variant: 2 },
    { x: 11.4, z: 11.4, rotY: -Math.PI * 0.75, variant: 3 },
  ];

  // Wrought-iron streetlamps framing Hearthstone Square and avenue junctions
  const lamps: [number, number][] = [
    [-7.4, -7.4],
    [7.4, -7.4],
    [-7.4, 7.4],
    [7.4, 7.4],
    [-16.2, -5.6],
    [16.2, -5.6],
    [-16.2, 5.6],
    [16.2, 5.6],
    [-5.6, -16.2],
    [5.6, -16.2],
    [-5.6, 16.2],
    [5.6, 16.2],
  ];

  const circleColliders: CircleCollider[] = [
    // Central Village Fountain
    { x: 0, z: 0, radius: 2.85 },
  ];

  // Lamp post colliders
  lamps.forEach(([lx, lz]) => {
    circleColliders.push({ x: lx, z: lz, radius: 0.42 });
  });

  // Cottage bounding boxes (approximate rotated chalet footprint safely)
  const boxColliders: BoxCollider[] = cottages.map((c) => ({
    minX: c.x - 3.35,
    maxX: c.x + 3.35,
    minZ: c.z - 3.35,
    maxZ: c.z + 3.35,
  }));

  // Deterministic seeded RNG per day
  let seed = 1337 + dayConfig.day * 977;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const snowCells: SnowCell[] = [];
  let idx = 0;

  for (let gx = 0; gx < gridSpan; gx++) {
    for (let gz = 0; gz < gridSpan; gz++) {
      const wx = -halfArena + (gx + 0.5) * cellSize;
      const wz = -halfArena + (gz + 0.5) * cellSize;

      if (!isRoadOrPlaza(wx, wz)) continue;

      // Skip snow overlapping fountain or cottages or right on spawn pad
      let blocked = false;
      for (const cc of circleColliders) {
        if (Math.hypot(wx - cc.x, wz - cc.z) < cc.radius + 0.45) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (const bc of boxColliders) {
        if (wx > bc.minX - 0.3 && wx < bc.maxX + 0.3 && wz > bc.minZ - 0.3 && wz < bc.maxZ + 0.3) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      // Leave a cozy small cleared start patch right under the player truck at (0, 8.2)
      if (Math.hypot(wx - 0, wz - 8.2) < 2.2) continue;

      // Smooth noise-like wave for natural snowdrift clustering
      const wave =
        Math.sin(wx * 0.24 + dayConfig.day) * Math.cos(wz * 0.24 - dayConfig.day * 0.6) * 0.5 + 0.5;
      const r = rand();

      let kind: SnowKind = 'normal';
      let maxDepth = 0.85 + rand() * 0.35;

      if (wave > 1 - dayConfig.deepDriftRatio * 1.15 && r < 0.72) {
        kind = 'deep';
        maxDepth = 1.45 + rand() * 0.45;
      } else if (dayConfig.icePatchRatio > 0 && wave < dayConfig.icePatchRatio * 1.3 && r < 0.55) {
        kind = 'ice';
        maxDepth = 0.62;
      }

      snowCells.push({
        index: idx++,
        x: wx + (rand() - 0.5) * 0.14,
        z: wz + (rand() - 0.5) * 0.14,
        kind,
        maxDepth,
        depth: 1.0,
        cleared: false,
        scaleVar: 0.92 + rand() * 0.22,
        rotY: rand() * Math.PI * 2,
      });
    }
  }

  // Golden cocoa crate locations along the outer lanes & corners
  const crateSpots: [number, number][] = [
    [-20.4, -20.4],
    [20.4, -20.4],
    [-20.4, 20.4],
    [20.4, 20.4],
    [0, -20.4],
  ];

  // Playful snowmen near avenue corners
  const snowmanSpots: [number, number][] = [
    [-8.4, 0],
    [8.4, 0],
    [0, -8.8],
    [-20.4, 0],
    [20.4, 0],
  ];

  return {
    halfArena,
    cellSize,
    gridSpan,
    cottages,
    lamps,
    crateSpots,
    snowmanSpots,
    circleColliders,
    boxColliders,
    snowCells,
  };
}

/**
 * Generates instanced multi-tier snow-dusted alpine pine forests framing the village perimeter.
 */
export function buildPerimeterPineForest(scene: THREE.Scene): THREE.Object3D[] {
  const created: THREE.Object3D[] = [];
  const treeCoords: { x: number; z: number; scale: number; rotY: number; tint: number }[] = [];

  let seed = 88421;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Ring of dense pines outside the village perimeter (27..68m radius)
  for (let i = 0; i < 190; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 27.5 + rand() * 38;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Keep trees cleanly outside the playable 25x25 village square
    if (Math.abs(x) < 26.8 && Math.abs(z) < 26.8) continue;

    treeCoords.push({
      x,
      z,
      scale: 0.85 + rand() * 0.45,
      rotY: rand() * Math.PI * 2,
      tint: rand(),
    });
  }

  // Also add 4 cozy decorative courtyard pines nestled behind the 4 cottages
  const innerPines: [number, number][] = [
    [-14.8, -14.8],
    [14.8, -14.8],
    [-14.8, 14.8],
    [14.8, 14.8],
    [-15.2, -9.2],
    [15.2, -9.2],
    [-15.2, 9.2],
    [15.2, 9.2],
  ];
  innerPines.forEach(([x, z]) => {
    treeCoords.push({ x, z, scale: 0.82 + rand() * 0.25, rotY: rand() * Math.PI * 2, tint: rand() });
  });

  const count = treeCoords.length;

  // Trunk InstancedMesh
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 1.35, 7);
  trunkGeo.translate(0, 0.675, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3c24, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  trunks.castShadow = true;
  trunks.receiveShadow = true;

  // Foliage 3-tier cones (InstancedMesh x 3 for lush layered conifer silhouette)
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.02,
  });
  const snowCapMat = new THREE.MeshStandardMaterial({
    color: 0xf1f7ff,
    roughness: 0.78,
    metalness: 0.02,
  });

  const tier1Geo = new THREE.ConeGeometry(1.72, 2.35, 7);
  tier1Geo.translate(0, 2.15, 0);
  const tier2Geo = new THREE.ConeGeometry(1.36, 2.05, 7);
  tier2Geo.translate(0, 3.35, 0);
  const tier3Geo = new THREE.ConeGeometry(0.92, 1.65, 7);
  tier3Geo.translate(0, 4.42, 0);
  const snowTopGeo = new THREE.ConeGeometry(0.74, 0.95, 7);
  snowTopGeo.translate(0, 4.86, 0);

  const tier1 = new THREE.InstancedMesh(tier1Geo, foliageMat, count);
  const tier2 = new THREE.InstancedMesh(tier2Geo, foliageMat, count);
  const tier3 = new THREE.InstancedMesh(tier3Geo, foliageMat, count);
  const snowTop = new THREE.InstancedMesh(snowTopGeo, snowCapMat, count);

  [tier1, tier2, tier3].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  snowTop.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const tc = treeCoords[i];
    const gy = groundHeightAt(tc.x, tc.z);
    dummy.position.set(tc.x, gy - 0.08, tc.z);
    dummy.rotation.set(0, tc.rotY, 0);
    dummy.scale.setScalar(tc.scale);
    dummy.updateMatrix();

    trunks.setMatrixAt(i, dummy.matrix);
    tier1.setMatrixAt(i, dummy.matrix);
    tier2.setMatrixAt(i, dummy.matrix);
    tier3.setMatrixAt(i, dummy.matrix);
    snowTop.setMatrixAt(i, dummy.matrix);

    // Rich spruce/pine color variation per tree
    color.setHSL(0.39 + tc.tint * 0.05, 0.36 + tc.tint * 0.12, 0.22 + tc.tint * 0.08);
    tier1.setColorAt(i, color);
    color.offsetHSL(0, 0.02, 0.03);
    tier2.setColorAt(i, color);
    color.offsetHSL(0, 0.02, 0.03);
    tier3.setColorAt(i, color);
  }

  [trunks, tier1, tier2, tier3, snowTop].forEach((im) => {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    scene.add(im);
    created.push(im);
  });

  return created;
}

/**
 * Builds rustic wooden split-rail fences and snow-dusted boulders around the village edge.
 */
export function buildVillageFencesAndRocks(scene: THREE.Scene): THREE.Object3D[] {
  const created: THREE.Object3D[] = [];
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f4e32, roughness: 0.88 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x738191, roughness: 0.86 });

  const posts: [number, number][] = [];
  const rails: { x: number; z: number; rotY: number }[] = [];

  const edge = 25.4;
  const step = 3.2;

  for (let p = -edge; p <= edge; p += step) {
    // North & South fence lines
    posts.push([p, -edge], [p, edge]);
    if (p + step <= edge + 0.1) {
      rails.push({ x: p + step / 2, z: -edge, rotY: 0 });
      rails.push({ x: p + step / 2, z: edge, rotY: 0 });
    }
    // West & East fence lines
    posts.push([-edge, p], [edge, p]);
    if (p + step <= edge + 0.1) {
      rails.push({ x: -edge, z: p + step / 2, rotY: Math.PI / 2 });
      rails.push({ x: edge, z: p + step / 2, rotY: Math.PI / 2 });
    }
  }

  const postGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.05, 6);
  postGeo.translate(0, 0.52, 0);
  const postMesh = new THREE.InstancedMesh(postGeo, woodMat, posts.length);
  postMesh.castShadow = true;

  const dummy = new THREE.Object3D();
  posts.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    postMesh.setMatrixAt(i, dummy.matrix);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.computeBoundingSphere();
  scene.add(postMesh);
  created.push(postMesh);

  const railGeo = new THREE.BoxGeometry(step, 0.11, 0.09);
  const railMesh = new THREE.InstancedMesh(railGeo, woodMat, rails.length * 2);
  let ri = 0;
  rails.forEach((r) => {
    [0.36, 0.78].forEach((ry) => {
      dummy.position.set(r.x, ry, r.z);
      dummy.rotation.set(0, r.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      railMesh.setMatrixAt(ri++, dummy.matrix);
    });
  });
  railMesh.instanceMatrix.needsUpdate = true;
  railMesh.computeBoundingSphere();
  scene.add(railMesh);
  created.push(railMesh);

  // Scattered snow-dusted alpine boulders around outer hills
  const rockGeo = new THREE.DodecahedronGeometry(1.1, 0);
  const rockCount = 34;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  let seed = 5521;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < rockCount; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 28 + rand() * 24;
    const rx = Math.cos(ang) * rad;
    const rz = Math.sin(ang) * rad;
    dummy.position.set(rx, groundHeightAt(rx, rz) + 0.2, rz);
    dummy.rotation.set(rand() * 2, rand() * 3, rand() * 2);
    dummy.scale.set(0.7 + rand() * 1.1, 0.5 + rand() * 0.6, 0.7 + rand() * 1.1);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  scene.add(rocks);
  created.push(rocks);

  return created;
}
