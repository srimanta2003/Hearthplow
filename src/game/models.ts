import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { UpgradeLevels } from './types';

export interface SnowplowTruckRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  frontWheelPivots: THREE.Group[];
  wheelMeshes: THREE.Object3D[];
  beaconPivot: THREE.Group;
  bladeGroup: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  thermalBar: THREE.Mesh;
  thermalMat: THREE.MeshStandardMaterial;
  turboGroup: THREE.Group;
  bellUpgradeMesh: THREE.Group;
  headlightGlow: THREE.Mesh;
  updateUpgrades: (upgrades: UpgradeLevels) => void;
}

/**
 * Builds a composite 12+ part vintage alpine snowplow truck,
 * pivoted cleanly at bottom-center (y = 0) with +Z as forward direction.
 */
export function createSnowplowTruck(textures: ProceduralTextureSet): SnowplowTruckRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Calibrated PBR material palette (distinct roughness/metalness contrast)
  const redEnamelMat = new THREE.MeshPhysicalMaterial({
    color: 0xc92c27,
    roughness: 0.24,
    metalness: 0.12,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
  });
  const creamTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf4ead6,
    roughness: 0.36,
    metalness: 0.05,
  });
  const chassisDarkMat = new THREE.MeshStandardMaterial({
    color: 0x222933,
    roughness: 0.78,
    metalness: 0.35,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf5,
    roughness: 0.14,
    metalness: 0.94,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xdca43b,
    roughness: 0.26,
    metalness: 0.86,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e23,
    roughness: 0.92,
    metalness: 0.04,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x28435e,
    roughness: 0.08,
    metalness: 0.45,
    envMapIntensity: 1.5,
  });
  const woodBedMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlankMap,
    roughness: 0.74,
    metalness: 0.04,
  });
  const headlightEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c2,
    emissive: 0xffc864,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });
  const taillightEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xff3b2f,
    emissive: 0xd9251b,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const plowSteelMat = new THREE.MeshStandardMaterial({
    color: 0x455365,
    roughness: 0.42,
    metalness: 0.72,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: textures.hazardMap,
    roughness: 0.48,
    metalness: 0.25,
  });
  const thermalMat = new THREE.MeshStandardMaterial({
    color: 0x5c3620,
    emissive: 0xff6218,
    emissiveIntensity: 0.0,
    roughness: 0.35,
    metalness: 0.7,
  });

  // Ground contact shadow
  const shadowGeo = new THREE.PlaneGeometry(3.2, 4.4);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.025, 0.15);
  root.add(contactShadow);

  // Soft headlight pool projected onto snow ahead of blade
  const hlPoolGeo = new THREE.PlaneGeometry(4.6, 5.2);
  const hlPoolMat = new THREE.MeshBasicMaterial({
    map: textures.warmGlowMap,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
  });
  const headlightGlow = new THREE.Mesh(hlPoolGeo, hlPoolMat);
  headlightGlow.rotation.x = -Math.PI / 2;
  headlightGlow.position.set(0, 0.04, 3.6);
  root.add(headlightGlow);

  // 1. Heavy Steel Chassis Frame
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.26, 3.15), chassisDarkMat);
  chassis.position.set(0, 0.52, -0.05);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bodyGroup.add(chassis);

  // Front & rear bumpers
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.2, 0.18), chromeMat);
  rearBumper.position.set(0, 0.54, -1.66);
  rearBumper.castShadow = true;
  bodyGroup.add(rearBumper);

  // 2. Engine Hood (Rounded beveled profile)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.62, 1.15), redEnamelMat);
  hood.position.set(0, 0.94, 0.88);
  hood.castShadow = true;
  hood.receiveShadow = true;
  bodyGroup.add(hood);

  // Cream racing / vintage alpine hood stripe
  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 1.12), creamTrimMat);
  hoodStripe.position.set(0, 1.26, 0.88);
  bodyGroup.add(hoodStripe);

  // Chrome radiator grille + horizontal slats
  const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.52, 0.08), chromeMat);
  grilleFrame.position.set(0, 0.92, 1.46);
  bodyGroup.add(grilleFrame);
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.045, 0.1), chassisDarkMat);
    slat.position.set(0, 0.76 + i * 0.11, 1.47);
    bodyGroup.add(slat);
  }

  // Front fenders
  [-0.78, 0.78].forEach((x) => {
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.92), redEnamelMat);
    fender.position.set(x, 0.78, 0.92);
    fender.castShadow = true;
    bodyGroup.add(fender);

    // Vintage round chrome headlight housings + warm glowing lenses
    const lampCup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.18, 14), chromeMat);
    lampCup.rotation.x = Math.PI / 2;
    lampCup.position.set(x * 0.82, 1.0, 1.44);
    bodyGroup.add(lampCup);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), headlightEmissiveMat);
    lens.position.set(x * 0.82, 1.0, 1.54);
    bodyGroup.add(lens);
  });

  // 3. Cozy Cab Body & Overhanging Cream Roof
  const cabLower = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.68, 1.08), redEnamelMat);
  cabLower.position.set(0, 0.98, -0.14);
  cabLower.castShadow = true;
  cabLower.receiveShadow = true;
  bodyGroup.add(cabLower);

  const cabUpper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.96), redEnamelMat);
  cabUpper.position.set(0, 1.6, -0.18);
  cabUpper.castShadow = true;
  bodyGroup.add(cabUpper);

  // Cream vintage roof cap with cozy overhang
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 1.12), creamTrimMat);
  roofCap.position.set(0, 1.94, -0.16);
  roofCap.castShadow = true;
  bodyGroup.add(roofCap);

  // Windshield & Side Windows
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.46, 0.06), glassMat);
  windshield.position.set(0, 1.6, 0.29);
  windshield.rotation.x = -0.12;
  bodyGroup.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.42, 0.06), glassMat);
  rearWindow.position.set(0, 1.6, -0.66);
  bodyGroup.add(rearWindow);

  [-0.75, 0.75].forEach((x) => {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.68), glassMat);
    sideWin.position.set(x, 1.6, -0.18);
    bodyGroup.add(sideWin);
  });

  // 4. Rotating Amber Roof Beacon
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.08, 12), chassisDarkMat);
  beaconBase.position.set(0, 2.04, -0.08);
  bodyGroup.add(beaconBase);

  const beaconPivot = new THREE.Group();
  beaconPivot.position.set(0, 2.18, -0.08);
  bodyGroup.add(beaconPivot);

  const beaconBulb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.12, 0.2, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffb830,
      emissive: 0xff9500,
      emissiveIntensity: 1.8,
      roughness: 0.15,
      transparent: true,
      opacity: 0.92,
    }),
  );
  beaconPivot.add(beaconBulb);

  const beaconBar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), brassMat);
  beaconBar.position.y = 0.04;
  beaconPivot.add(beaconBar);

  // 5. Wooden Flatbed Cargo Box + Salt/Grit Hopper
  const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.14, 1.12), woodBedMat);
  bedFloor.position.set(0, 0.72, -1.16);
  bedFloor.castShadow = true;
  bedFloor.receiveShadow = true;
  bodyGroup.add(bedFloor);

  // Wooden slatted side rails
  [-0.78, 0.78].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 1.1), woodBedMat);
    rail.position.set(x, 0.98, -1.16);
    rail.castShadow = true;
    bodyGroup.add(rail);
  });
  const tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.42, 0.1), woodBedMat);
  tailgate.position.set(0, 0.97, -1.67);
  tailgate.castShadow = true;
  bodyGroup.add(tailgate);

  // Taillights
  [-0.64, 0.64].forEach((x) => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), taillightEmissiveMat);
    tl.position.set(x, 0.82, -1.73);
    bodyGroup.add(tl);
  });

  // Cozy mounded grit/salt hopper in truck bed
  const gritMound = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.46, 1),
    new THREE.MeshStandardMaterial({ color: 0xdbe6f2, roughness: 0.92 }),
  );
  gritMound.scale.set(1.3, 0.62, 1.1);
  gritMound.position.set(0, 0.94, -1.14);
  bodyGroup.add(gritMound);

  // Twin chrome exhaust stacks behind cab
  [-0.86, 0.86].forEach((x) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.25, 10), chromeMat);
    pipe.position.set(x, 1.38, -0.68);
    pipe.castShadow = true;
    bodyGroup.add(pipe);
  });

  // 6. Upgradeable Copper Turbo Boiler Pipes (visible when turbo level >= 1)
  const turboGroup = new THREE.Group();
  [-0.44, 0.44].forEach((x) => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.82, 12), brassMat);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(x, 1.28, -1.18);
    tank.castShadow = true;
    turboGroup.add(tank);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.22, 10), chassisDarkMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, 1.28, -1.66);
    turboGroup.add(nozzle);
  });
  turboGroup.visible = false;
  bodyGroup.add(turboGroup);

  // 7. Upgradeable Hearth Brass Bell on Roof (visible when chime level >= 1)
  const bellUpgradeMesh = new THREE.Group();
  const bellBody = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 12), brassMat);
  bellBody.position.set(0.48, 2.13, -0.1);
  bellUpgradeMesh.add(bellBody);
  const bellMount = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 8), chassisDarkMat);
  bellMount.position.set(0.48, 2.04, -0.1);
  bellUpgradeMesh.add(bellMount);
  bellUpgradeMesh.visible = false;
  bodyGroup.add(bellUpgradeMesh);

  // 8. Heavy Snow Tires (4 wheels, front pair steerable)
  const wheelMeshes: THREE.Object3D[] = [];
  const frontWheelPivots: THREE.Group[] = [];

  const createWheel = (): THREE.Group => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 18), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), creamTrimMat);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.39, 10), brassMat);
    hub.rotation.z = Math.PI / 2;
    wg.add(hub);

    // Lug detail so spinning is visibly crisp
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.06), chassisDarkMat);
    wg.add(spoke);
    return wg;
  };

  const wheelPositions: [number, number, number, boolean][] = [
    [-0.88, 0.42, 0.92, true],
    [0.88, 0.42, 0.92, true],
    [-0.88, 0.42, -1.02, false],
    [0.88, 0.42, -1.02, false],
  ];

  wheelPositions.forEach(([x, y, z, isFront]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const wheel = createWheel();
    pivot.add(wheel);
    root.add(pivot);
    wheelMeshes.push(wheel);
    if (isFront) {
      frontWheelPivots.push(pivot);
    }
  });

  // 9. Curved Steel Snowplow Blade (ExtrudeGeometry C-scoop + Hydraulic Arms + Extendable Wings)
  const bladeGroup = new THREE.Group();
  bladeGroup.position.set(0, 0.12, 1.98);
  bodyGroup.add(bladeGroup);

  // Curved scoop cross-section extruded along X
  const scoopShape = new THREE.Shape();
  scoopShape.moveTo(0, 0);
  scoopShape.lineTo(0.24, 0.04);
  scoopShape.quadraticCurveTo(0.05, 0.42, 0.22, 0.78);
  scoopShape.lineTo(0.08, 0.84);
  scoopShape.quadraticCurveTo(-0.14, 0.44, -0.06, 0.0);
  scoopShape.closePath();

  const mainBladeWidth = 2.25;
  const scoopGeo = new THREE.ExtrudeGeometry(scoopShape, {
    depth: mainBladeWidth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  // Rotate so extrusion depth runs along X and scoop opens toward +Z
  scoopGeo.translate(0, 0, -mainBladeWidth / 2);
  scoopGeo.rotateY(-Math.PI / 2);

  const mainBlade = new THREE.Mesh(scoopGeo, plowSteelMat);
  mainBlade.castShadow = true;
  mainBlade.receiveShadow = true;
  bladeGroup.add(mainBlade);

  // Hazard stripe trim panel on top lip of blade
  const hazardStrip = new THREE.Mesh(new THREE.BoxGeometry(mainBladeWidth + 0.04, 0.16, 0.09), hazardMat);
  hazardStrip.position.set(0, 0.78, 0.14);
  bladeGroup.add(hazardStrip);

  // Hydraulic push arms connecting chassis to blade
  [-0.46, 0.46].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.72), chassisDarkMat);
    arm.position.set(x, 0.34, -0.34);
    bladeGroup.add(arm);

    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.56, 8), chromeMat);
    piston.rotation.x = Math.PI / 2 - 0.35;
    piston.position.set(x * 0.7, 0.52, -0.26);
    bladeGroup.add(piston);
  });

  // Side plow wings that expand visibly as Blade Width upgrade rises!
  const wingGeo = new THREE.BoxGeometry(0.55, 0.72, 0.12);
  const leftWing = new THREE.Mesh(wingGeo, hazardMat);
  leftWing.position.set(-mainBladeWidth / 2 - 0.18, 0.39, 0.14);
  leftWing.rotation.y = 0.28;
  leftWing.castShadow = true;
  bladeGroup.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, hazardMat);
  rightWing.position.set(mainBladeWidth / 2 + 0.18, 0.39, 0.14);
  rightWing.rotation.y = -0.28;
  rightWing.castShadow = true;
  bladeGroup.add(rightWing);

  // Heated thermal coil along the cutting edge (glows amber-orange when upgraded)
  const thermalBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, mainBladeWidth + 0.1, 10), thermalMat);
  thermalBar.rotation.z = Math.PI / 2;
  thermalBar.position.set(0, 0.08, 0.24);
  thermalBar.visible = false;
  bladeGroup.add(thermalBar);

  const updateUpgrades = (upgrades: UpgradeLevels) => {
    // 1. Scale blade wings & blade X scale with blade upgrade
    const widthScale = 1 + upgrades.blade * 0.16;
    bladeGroup.scale.set(widthScale, 1 + upgrades.blade * 0.04, 1);
    leftWing.visible = upgrades.blade >= 1;
    rightWing.visible = upgrades.blade >= 1;

    // 2. Turbo boiler pipes
    turboGroup.visible = upgrades.turbo >= 1;
    const turboScale = 0.85 + upgrades.turbo * 0.1;
    turboGroup.scale.set(1, turboScale, turboScale);

    // 3. Brass hearth bell
    bellUpgradeMesh.visible = upgrades.chime >= 1;

    // 4. Thermal heated blade strip
    thermalBar.visible = upgrades.thermal >= 1;
    thermalMat.emissiveIntensity = upgrades.thermal > 0 ? 0.9 + upgrades.thermal * 0.45 : 0;
  };

  return {
    group: root,
    bodyGroup,
    frontWheelPivots,
    wheelMeshes,
    beaconPivot,
    bladeGroup,
    leftWing,
    rightWing,
    thermalBar,
    thermalMat,
    turboGroup,
    bellUpgradeMesh,
    headlightGlow,
    updateUpgrades,
  };
}

/**
 * Builds a cozy alpine timber-framed cottage with snow-capped roof,
 * glowing amber windows, stone chimney, and warm porch light.
 * Pivoted at bottom-center (y = 0).
 */
export function createAlpineCottage(
  textures: ProceduralTextureSet,
  variant: number,
): { group: THREE.Group; chimneyLocalTop: THREE.Vector3 } {
  const g = new THREE.Group();

  const wallColors = [0xe8dfd0, 0xd8cdb8, 0xe4d5c3, 0xd4dde5];
  const roofColors = [0x3d4d63, 0x5c3832, 0x344a45, 0x4b4358];

  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColors[variant % wallColors.length],
    roughness: 0.82,
    metalness: 0.02,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlankMap,
    color: 0x6f4a2e,
    roughness: 0.78,
    metalness: 0.05,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x6d7785,
    roughness: 0.88,
    metalness: 0.04,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.shingleMap,
    color: roofColors[variant % roofColors.length],
    roughness: 0.72,
    metalness: 0.06,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf6f9fe,
    roughness: 0.75,
    metalness: 0.02,
    bumpMap: textures.snowBump,
    bumpScale: 0.03,
  });
  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a1,
    emissive: 0xffa73b,
    emissiveIntensity: 1.55,
    roughness: 0.2,
  });

  const w = 4.6 + (variant % 2) * 0.7;
  const d = 3.8 + ((variant + 1) % 2) * 0.5;
  const h = 2.6;

  // Stone foundation plinth
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.55, d + 0.22), stoneMat);
  base.position.y = 0.275;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Main plastered walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = 0.55 + h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);

  // Corner timber beams
  const halfW = w / 2;
  const halfD = d / 2;
  [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ].forEach(([cx, cz]) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.1, 0.22), timberMat);
    beam.position.set(cx, 0.55 + h / 2, cz);
    g.add(beam);
  });

  // Pitched A-frame roof using extruded triangle prism
  const roofH = 2.05;
  const overhang = 0.52;
  const tri = new THREE.Shape();
  tri.moveTo(-(halfW + overhang), 0);
  tri.lineTo(halfW + overhang, 0);
  tri.lineTo(0, roofH);
  tri.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(tri, {
    depth: d + overhang * 1.6,
    bevelEnabled: false,
  });
  roofGeo.translate(0, 0, -(d + overhang * 1.6) / 2);

  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.55 + h - 0.1;
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);

  // Lush thick snow blanket resting on the pitched roof
  const snowRoofShape = new THREE.Shape();
  snowRoofShape.moveTo(-(halfW + overhang + 0.08), -0.06);
  snowRoofShape.lineTo(0, roofH + 0.24);
  snowRoofShape.lineTo(halfW + overhang + 0.08, -0.06);
  snowRoofShape.lineTo(halfW + overhang - 0.15, -0.18);
  snowRoofShape.lineTo(0, roofH - 0.04);
  snowRoofShape.lineTo(-(halfW + overhang - 0.15), -0.18);
  snowRoofShape.closePath();

  const snowRoofGeo = new THREE.ExtrudeGeometry(snowRoofShape, {
    depth: d + overhang * 1.68,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  snowRoofGeo.translate(0, 0, -(d + overhang * 1.68) / 2);

  const snowRoof = new THREE.Mesh(snowRoofGeo, snowMat);
  snowRoof.position.y = 0.55 + h + 0.02;
  snowRoof.receiveShadow = true;
  g.add(snowRoof);

  // Stone Chimney
  const chimX = halfW * 0.48;
  const chimZ = -halfD * 0.25;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.76, 2.3, 0.76), stoneMat);
  chimney.position.set(chimX, 0.55 + h + 1.15, chimZ);
  chimney.castShadow = true;
  g.add(chimney);

  const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 0.92), snowMat);
  chimCap.position.set(chimX, 0.55 + h + 2.34, chimZ);
  g.add(chimCap);

  // Cozy Timber Front Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.55, 0.14), timberMat);
  door.position.set(0, 0.55 + 0.78, halfD + 0.04);
  g.add(door);

  // Glowing Amber Windows (Front + Sides)
  const addWindow = (wx: number, wy: number, wz: number, rotY = 0) => {
    const wg = new THREE.Group();
    wg.position.set(wx, wy, wz);
    wg.rotation.y = rotY;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.96, 0.12), timberMat);
    wg.add(frame);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.78, 0.15), windowGlowMat);
    wg.add(pane);
    // Cross mullions
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.18), timberMat);
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.18), timberMat);
    wg.add(mullV, mullH);
    g.add(wg);
  };

  addWindow(-halfW * 0.56, 1.85, halfD + 0.02, 0);
  addWindow(halfW * 0.56, 1.85, halfD + 0.02, 0);
  addWindow(halfW + 0.02, 1.85, 0, Math.PI / 2);
  addWindow(-halfW - 0.02, 1.85, 0, Math.PI / 2);

  // Warm porch amber ground glow pool
  const glowPool = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.2),
    new THREE.MeshBasicMaterial({
      map: textures.warmGlowMap,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.42,
    }),
  );
  glowPool.rotation.x = -Math.PI / 2;
  glowPool.position.set(0, 0.035, halfD + 1.15);
  g.add(glowPool);

  return {
    group: g,
    chimneyLocalTop: new THREE.Vector3(chimX, 0.55 + h + 2.48, chimZ),
  };
}

/**
 * Cozy wrought-iron village streetlamp with glowing lantern and warm snow pool.
 */
export function createStreetLamp(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x222a34,
    roughness: 0.42,
    metalness: 0.78,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffefc2,
    emissive: 0xffb347,
    emissiveIntensity: 2.4,
    roughness: 0.1,
  });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.8 });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.45, 8), ironMat);
  plinth.position.y = 0.225;
  plinth.castShadow = true;
  g.add(plinth);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 3.2, 8), ironMat);
  post.position.y = 1.9;
  post.castShadow = true;
  g.add(post);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.16, 6), ironMat);
  collar.position.y = 3.5;
  g.add(collar);

  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 6), bulbMat);
  lantern.position.y = 3.76;
  g.add(lantern);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.24, 6), ironMat);
  cap.position.y = 4.08;
  g.add(cap);

  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.14, 6), snowMat);
  snowCap.position.y = 4.18;
  g.add(snowCap);

  // Warm amber pool on the ground around the lamp
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 5.5),
    new THREE.MeshBasicMaterial({
      map: textures.warmGlowMap,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.48,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.035;
  g.add(pool);

  return g;
}

/**
 * Frozen alpine stone fountain centerpiece in Hearthstone Village Square.
 */
export function createVillageFountain(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x7e8a99,
    roughness: 0.82,
    metalness: 0.06,
  });
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8e6ff,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xdca540,
    roughness: 0.28,
    metalness: 0.85,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf4f9ff,
    roughness: 0.78,
  });

  // Outer stone rim
  const basinOuter = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.55, 0.78, 8), stoneMat);
  basinOuter.position.y = 0.39;
  basinOuter.castShadow = true;
  basinOuter.receiveShadow = true;
  g.add(basinOuter);

  // Frozen glossy ice sheet inside basin
  const icePool = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 0.12, 8), iceMat);
  icePool.position.y = 0.74;
  g.add(icePool);

  // Central pedestal + bowl
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.85, 8), stoneMat);
  pillar.position.y = 1.25;
  pillar.castShadow = true;
  g.add(pillar);

  const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.55, 0.36, 8), stoneMat);
  upperBowl.position.y = 2.05;
  upperBowl.castShadow = true;
  g.add(upperBowl);

  const snowMound = new THREE.Mesh(new THREE.SphereGeometry(0.86, 12, 8), snowMat);
  snowMound.scale.set(1, 0.42, 1);
  snowMound.position.y = 2.24;
  g.add(snowMound);

  // Brass hearth lantern finial on top
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), brassMat);
  finial.position.y = 2.8;
  finial.castShadow = true;
  g.add(finial);

  const warmGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 7.2),
    new THREE.MeshBasicMaterial({
      map: textures.warmGlowMap,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.32,
    }),
  );
  warmGlow.rotation.x = -Math.PI / 2;
  warmGlow.position.y = 0.032;
  g.add(warmGlow);

  return g;
}

/**
 * Interactive cozy Snowman that pops into snow sparkles + bonus coins when bumped!
 */
export function createSnowman(): THREE.Group {
  const g = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.78 });
  const scarfMat = new THREE.MeshStandardMaterial({ color: 0xc9312a, roughness: 0.85 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x232931, roughness: 0.7 });
  const carrotMat = new THREE.MeshStandardMaterial({ color: 0xee7422, roughness: 0.65 });

  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), snowMat);
  b1.position.y = 0.48;
  b1.castShadow = true;
  g.add(b1);

  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), snowMat);
  b2.position.y = 1.18;
  b2.castShadow = true;
  g.add(b2);

  const b3 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), snowMat);
  b3.position.y = 1.72;
  b3.castShadow = true;
  g.add(b3);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.075, 8, 16), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.48;
  g.add(scarf);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 8), carrotMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.72, 0.32);
  g.add(nose);

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 12), hatMat);
  hatBrim.position.y = 1.96;
  hatBrim.rotation.z = 0.1;
  g.add(hatBrim);

  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.34, 12), hatMat);
  hatTop.position.set(-0.02, 2.14, 0);
  hatTop.rotation.z = 0.1;
  g.add(hatTop);

  return g;
}

/**
 * Collectible Golden Hot-Cocoa Supply Crate (buried in snowdrifts for bonus coins + time!).
 */
export function createCocoaCrate(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlankMap,
    color: 0x9b683b,
    roughness: 0.65,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf7c244,
    emissive: 0xd98212,
    emissiveIntensity: 0.55,
    roughness: 0.22,
    metalness: 0.82,
  });
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xfff0b5,
    emissive: 0xffb732,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.82, 0.92), woodMat);
  box.position.y = 0.46;
  box.castShadow = true;
  g.add(box);

  // Brass corner bands
  const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.98), goldMat);
  band1.position.y = 0.72;
  g.add(band1);
  const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.98), goldMat);
  band2.position.y = 0.24;
  g.add(band2);

  // Floating golden frost bell beacon on top so player spots it peeking out of drifts
  const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), orbMat);
  lantern.position.y = 1.24;
  g.add(lantern);

  return g;
}
