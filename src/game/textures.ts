import * as THREE from 'three';

export interface ProceduralTextureSet {
  cobbleMap: THREE.CanvasTexture;
  cobbleBump: THREE.CanvasTexture;
  snowBump: THREE.CanvasTexture;
  hazardMap: THREE.CanvasTexture;
  woodPlankMap: THREE.CanvasTexture;
  shingleMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  warmGlowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const textures: THREE.Texture[] = [];
  const register = (tex: THREE.CanvasTexture, isColor: boolean, repeat = 1): THREE.CanvasTexture => {
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.anisotropy = Math.min(8, maxAnisotropy);
    if (repeat > 1) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat, repeat);
    }
    tex.needsUpdate = true;
    textures.push(tex);
    return tex;
  };

  // 1. Alpine Village Cobblestone Albedo + Bump (revealed as you plow!)
  const [cobCanvas, cobCtx] = createCanvas(512);
  const [cobBumpCanvas, cobBumpCtx] = createCanvas(512);

  // Warm frosty slate mortar base
  cobCtx.fillStyle = '#3c4957';
  cobCtx.fillRect(0, 0, 512, 512);
  cobBumpCtx.fillStyle = '#202020';
  cobBumpCtx.fillRect(0, 0, 512, 512);

  const rows = 12;
  const cols = 8;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  // Deterministic pseudo-random helper
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset + 3;
      const y = r * rowH + 3;
      const w = colW - 6;
      const h = rowH - 6;

      // Subtle warm granite / slate palette variation
      const shade = 0.85 + rand() * 0.3;
      const warm = rand() > 0.62 ? 12 : 0;
      const red = Math.min(255, Math.floor((88 + warm) * shade));
      const grn = Math.min(255, Math.floor((95 + warm * 0.6) * shade));
      const blu = Math.min(255, Math.floor((106 - warm * 0.3) * shade));

      cobCtx.fillStyle = `rgb(${red}, ${grn}, ${blu})`;
      cobCtx.beginPath();
      cobCtx.roundRect(x, y, w, h, 7);
      cobCtx.fill();

      // Subtle highlight rim on top edge of stone
      cobCtx.strokeStyle = `rgba(215, 228, 240, ${0.08 + rand() * 0.08})`;
      cobCtx.lineWidth = 1.5;
      cobCtx.stroke();

      // Bump height
      const bVal = Math.floor(175 + rand() * 65);
      cobBumpCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      cobBumpCtx.beginPath();
      cobBumpCtx.roundRect(x + 1, y + 1, w - 2, h - 2, 6);
      cobBumpCtx.fill();
    }
  }

  // Light frost speckle along mortar
  for (let i = 0; i < 650; i++) {
    const fx = rand() * 512;
    const fy = rand() * 512;
    cobCtx.fillStyle = `rgba(230, 242, 255, ${0.05 + rand() * 0.12})`;
    cobCtx.fillRect(fx, fy, 2 + rand() * 2, 2 + rand() * 2);
  }

  const cobbleMap = register(new THREE.CanvasTexture(cobCanvas), true, 16);
  const cobbleBump = register(new THREE.CanvasTexture(cobBumpCanvas), false, 16);

  // 2. Snow Micro-Grain Bump Texture
  const [snowCanvas, snowCtx] = createCanvas(256);
  snowCtx.fillStyle = '#808080';
  snowCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const sx = rand() * 256;
    const sy = rand() * 256;
    const val = Math.floor(110 + rand() * 140);
    snowCtx.fillStyle = `rgb(${val},${val},${val})`;
    snowCtx.fillRect(sx, sy, 2, 2);
  }
  const snowBump = register(new THREE.CanvasTexture(snowCanvas), false, 6);

  // 3. Plow Blade Safety Hazard Stripes
  const [hazCanvas, hazCtx] = createCanvas(256);
  hazCtx.fillStyle = '#e8a825';
  hazCtx.fillRect(0, 0, 256, 256);
  hazCtx.fillStyle = '#1e242c';
  for (let i = -256; i < 512; i += 48) {
    hazCtx.beginPath();
    hazCtx.moveTo(i, 0);
    hazCtx.lineTo(i + 24, 0);
    hazCtx.lineTo(i - 100, 256);
    hazCtx.lineTo(i - 124, 256);
    hazCtx.closePath();
    hazCtx.fill();
  }
  const hazardMap = register(new THREE.CanvasTexture(hazCanvas), true, 1);

  // 4. Warm Timber Wood Planks (Truck bed & Cottage beams)
  const [woodCanvas, woodCtx] = createCanvas(256);
  woodCtx.fillStyle = '#7a4f2d';
  woodCtx.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 6; p++) {
    const py = p * (256 / 6);
    const tone = 0.88 + rand() * 0.22;
    woodCtx.fillStyle = `rgb(${Math.floor(124 * tone)}, ${Math.floor(78 * tone)}, ${Math.floor(44 * tone)})`;
    woodCtx.fillRect(0, py + 2, 256, 256 / 6 - 3);
    woodCtx.fillStyle = 'rgba(35, 18, 8, 0.35)';
    woodCtx.fillRect(0, py, 256, 2);
    for (let g = 0; g < 18; g++) {
      woodCtx.fillStyle = `rgba(60, 32, 14, ${0.08 + rand() * 0.1})`;
      woodCtx.fillRect(0, py + 4 + rand() * 34, 256, 1.5);
    }
  }
  const woodPlankMap = register(new THREE.CanvasTexture(woodCanvas), true, 2);

  // 5. Roof Shingles
  const [shingCanvas, shingCtx] = createCanvas(256);
  shingCtx.fillStyle = '#3b4a5e';
  shingCtx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) {
    const y = r * 32;
    const shift = (r % 2) * 16;
    for (let c = -1; c < 9; c++) {
      const x = c * 32 + shift;
      const v = 0.85 + rand() * 0.25;
      shingCtx.fillStyle = `rgb(${Math.floor(66 * v)}, ${Math.floor(80 * v)}, ${Math.floor(98 * v)})`;
      shingCtx.fillRect(x + 1, y + 1, 30, 30);
    }
  }
  const shingleMap = register(new THREE.CanvasTexture(shingCanvas), true, 3);

  // 6. Soft Radial Contact Shadow
  const [shadCanvas, shadCtx] = createCanvas(128);
  const sGrad = shadCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  sGrad.addColorStop(0, 'rgba(12, 22, 38, 0.56)');
  sGrad.addColorStop(0.55, 'rgba(14, 26, 44, 0.28)');
  sGrad.addColorStop(1, 'rgba(14, 26, 44, 0.0)');
  shadCtx.fillStyle = sGrad;
  shadCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = register(new THREE.CanvasTexture(shadCanvas), true, 1);

  // 7. Warm Amber Lantern Light Pool Decal
  const [glowCanvas, glowCtx] = createCanvas(128);
  const gGrad = glowCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gGrad.addColorStop(0, 'rgba(255, 198, 102, 0.45)');
  gGrad.addColorStop(0.45, 'rgba(255, 175, 76, 0.16)');
  gGrad.addColorStop(1, 'rgba(255, 160, 60, 0.0)');
  glowCtx.fillStyle = gGrad;
  glowCtx.fillRect(0, 0, 128, 128);
  const warmGlowMap = register(new THREE.CanvasTexture(glowCanvas), true, 1);

  return {
    cobbleMap,
    cobbleBump,
    snowBump,
    hazardMap,
    woodPlankMap,
    shingleMap,
    contactShadowMap,
    warmGlowMap,
    dispose: () => {
      textures.forEach((t) => t.dispose());
    },
  };
}
