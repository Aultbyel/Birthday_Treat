import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PLACEHOLDER_NAME } from './content.js';
import {
  crystalFragment,
  crystalVertex,
  dustFragment,
  dustVertex,
  flameFragment,
  flameVertex,
  gradeShader,
  nebulaFragment,
  nebulaVertex,
  pixelUniform,
  plaqueFragment,
  plaqueVertex,
  portraitFragment,
  portraitVertex,
  ringFragment,
  ringVertex,
  starFragment,
  starVertex,
  timeUniform,
} from './shaders.js';

const SERIF = '"Songti SC","STSong","Noto Serif SC","Source Han Serif SC","PMingLiU","Songti TC","WenQuanYi Micro Hei",serif';
const NAME_W = 1400;
const NAME_H = 420;

const layout = {
  lookX: 0,
  dist: 6.2,
  pitch: 0.22,
  portrait: new THREE.Vector3(1.7, 1.58, 0.35),
  portraitScale: 0.86,
  portraitYaw: 0.55,
  nameY: 2.22,
  nameScale: 0.64,
};

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutCubic(amount) {
  return 1 - (1 - amount) ** 3;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shaderMaterial(options) {
  const material = new THREE.ShaderMaterial(options);
  if (material.uniforms.uTime) material.uniforms.uTime = timeUniform;
  if (material.uniforms.uPixel) material.uniforms.uPixel = pixelUniform;
  return material;
}

function lathe(pairs, segments, flutes = 0, amp = 0) {
  const points = pairs.map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(points, segments);
  if (flutes > 0 && amp > 0) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const radius = Math.hypot(x, z);
      if (radius < 0.04) continue;
      const angle = Math.atan2(z, x);
      const shaped = 1 + amp * Math.cos(angle * flutes);
      position.setX(i, Math.cos(angle) * radius * shaped);
      position.setZ(i, Math.sin(angle) * radius * shaped);
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

function addRim(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        float rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.2);
        totalEmissiveRadiance += vec3(0.05, 0.16, 0.2);
        totalEmissiveRadiance += vec3(0.45, 0.85, 1.0) * rim * 0.65;
      }`,
    );
  };
}

function drawNameplate(ctx, name, placeholder) {
  const width = NAME_W;
  const height = NAME_H;
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 36px ${SERIF}`;
  ctx.fillStyle = placeholder ? 'rgba(190, 220, 230, 0.7)' : 'rgba(246, 226, 184, 0.95)';
  ctx.fillText(placeholder ? '预 览' : '生 日 快 乐', width / 2, height * 0.28);
  let size = 156;
  ctx.font = `600 ${size}px ${SERIF}`;
  while (ctx.measureText(name).width > width * 0.86 && size > 64) {
    size -= 4;
    ctx.font = `600 ${size}px ${SERIF}`;
  }
  const gradient = ctx.createLinearGradient(width * 0.12, 0, width * 0.88, height);
  if (placeholder) {
    gradient.addColorStop(0, 'rgba(210, 236, 244, 0.8)');
    gradient.addColorStop(1, 'rgba(230, 220, 245, 0.7)');
  } else {
    gradient.addColorStop(0, '#d7fbff');
    gradient.addColorStop(0.5, '#fff6dc');
    gradient.addColorStop(1, '#ffd0ea');
  }
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(8, 14, 24, 0.45)';
  ctx.strokeText(name, width / 2, height * 0.66);
  ctx.fillStyle = gradient;
  ctx.fillText(name, width / 2, height * 0.66);
}

function drawEmblem(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, '#245068');
  gradient.addColorStop(1, '#081018');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(190, 240, 255, 0.9)';
  ctx.lineWidth = Math.max(2, size * 0.012);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f3d7a6';
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? size * 0.15 : size * 0.065;
    const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const x = size / 2 + Math.cos(angle) * radius;
    const y = size / 2 + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function crossFlame() {
  const w = 0.22;
  const h = 0.4;
  const hw = w / 2;
  const positions = new Float32Array([
    -hw, 0, 0, hw, 0, 0, hw, h, 0, -hw, h, 0,
    0, 0, -hw, 0, 0, hw, 0, h, hw, 0, h, -hw,
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geometry;
}

export function createScene(canvas, hooks = {}) {
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = reduced || window.innerWidth < 860;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
  });
  if (!renderer.getContext()) throw new Error('webgl');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x05060c, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070e);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.08, 80);
  const rig = new THREE.Group();
  scene.add(rig);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const addEnv = (color, x, y, z, size, intensity) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 1 }),
    );
    mesh.position.set(x, y, z);
    env.add(mesh);
  };
  addEnv(0x1a90b0, -5, 3, -2, 2, 8);
  addEnv(0xd24b86, 5, 1.2, 2, 1.5, 6);
  addEnv(0xf0c56a, 0, 6, -1, 1.6, 5);
  env.add(new THREE.AmbientLight(0xb7d0dc, 0.55));
  scene.environment = pmrem.fromScene(env, 0.04, 0.1, 24).texture;
  scene.environmentIntensity = 0.82;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xc5eeff, 0x1a1020, 0.55));
  const key = new THREE.DirectionalLight(0xfff8ef, 2.1);
  key.position.set(-4, 6.5, 4.2);
  scene.add(key);
  const overhead = new THREE.DirectionalLight(0xfff4e2, 1.8);
  overhead.position.set(0.4, 8, 1.2);
  scene.add(overhead);
  const rim = new THREE.DirectionalLight(0xff5aa8, 1.15);
  rim.position.set(5, 2.4, -3);
  scene.add(rim);
  const candleLight = new THREE.PointLight(0xffc48a, 2.4, 8, 2);
  candleLight.position.set(0, 1.85, 0.2);
  rig.add(candleLight);
  const fill = new THREE.PointLight(0x49d7ff, 1.4, 10, 2);
  fill.position.set(-2.2, 1.4, 2.4);
  rig.add(fill);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(48, 28, 18),
    shaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { uTime: timeUniform },
      vertexShader: nebulaVertex,
      fragmentShader: nebulaFragment,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  scene.add(sky);

  const rnd = mulberry32(19);
  const starCount = compact ? 700 : 1200;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const palette = [[0.8, 0.92, 1], [1, 0.94, 0.8], [1, 0.76, 0.88]];
  for (let i = 0; i < starCount; i += 1) {
    const radius = 16 + rnd() * 26;
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.65;
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = palette[i % palette.length];
    starColors.set(color, i * 3);
    starSizes[i] = 0.7 + rnd() * 1.5;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  const stars = new THREE.Points(
    starGeo,
    shaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: timeUniform, uPixel: pixelUniform },
      vertexShader: starVertex,
      fragmentShader: starFragment,
    }),
  );
  stars.frustumCulled = false;
  scene.add(stars);

  const dustCount = compact ? 80 : 140;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount);
  const dustSpeeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (rnd() - 0.5) * 3.6;
    dustPositions[i * 3 + 1] = rnd() * 0.2;
    dustPositions[i * 3 + 2] = (rnd() - 0.5) * 3.6;
    dustSeeds[i] = rnd();
    dustSpeeds[i] = 0.035 + rnd() * 0.04;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeeds, 1));
  dustGeo.setAttribute('aSpeed', new THREE.BufferAttribute(dustSpeeds, 1));
  const dust = new THREE.Points(
    dustGeo,
    shaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: timeUniform, uPixel: pixelUniform },
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
    }),
  );
  rig.add(dust);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x1a2230,
    metalness: 0.92,
    roughness: 0.28,
    envMapIntensity: 0.7,
  });
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xf4d7a6,
    metalness: 1,
    roughness: 0.2,
    clearcoat: 0.55,
    emissive: 0x8a5a22,
    emissiveIntensity: 0.35,
    envMapIntensity: 0.9,
  });
  const neon = new THREE.MeshStandardMaterial({
    color: 0x083038,
    emissive: 0x73f6ff,
    emissiveIntensity: 1.8,
    roughness: 0.35,
    metalness: 0.25,
  });
  addRim(metal);

  const pedestal = new THREE.Mesh(
    lathe([
      [0.02, 0], [1.72, 0], [1.78, 0.045], [1.55, 0.09],
      [1.5, 0.16], [1.18, 0.2], [1.14, 0.28], [0.92, 0.33],
      [0.88, 0.42], [0.02, 0.42],
    ], 96),
    metal,
  );
  rig.add(pedestal);
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.014, 12, 96), neon);
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = 0.3;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.02, 12, 80), gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.42;
  rig.add(inlay, lip);

  const dummy = new THREE.Object3D();
  const pylons = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.028, 0.42, 10), neon, 8);
  pylons.frustumCulled = false;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * 1.42, 0.28, Math.sin(angle) * 1.42);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pylons.setMatrixAt(i, dummy.matrix);
  }
  pylons.instanceMatrix.needsUpdate = true;
  rig.add(pylons);

  const tiers = [
    { r: 0.92, h: 0.46, color: 0x6e8eab, emissive: 0x1d5678, flutes: 18 },
    { r: 0.66, h: 0.38, color: 0x8a6798, emissive: 0x6a3068, flutes: 14 },
    { r: 0.44, h: 0.3, color: 0x7f96b4, emissive: 0x2a6284, flutes: 12 },
  ];
  const cake = new THREE.Group();
  cake.position.y = 0.42;
  let tierY = 0;
  const tierLips = [];
  tiers.forEach((tier) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: tier.color,
      roughness: 0.46,
      metalness: 0.02,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      iridescence: 0.25,
      iridescenceIOR: 1.15,
      iridescenceThicknessMinimum: 80,
      iridescenceThicknessMaximum: 320,
      emissive: tier.emissive,
      emissiveIntensity: 1.15,
      envMapIntensity: 0.55,
    });
    addRim(material);
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(
      lathe([
        [0.01, 0],
        [tier.r * 0.78, 0],
        [tier.r * 0.96, 0.02],
        [tier.r, 0.06],
        [tier.r * 0.985, tier.h * 0.45],
        [tier.r * 1.01, tier.h - 0.05],
        [tier.r * 0.78, tier.h],
        [0.01, tier.h],
      ], 80, tier.flutes, 0.02),
      material,
    );
    mesh.position.y = tierY;
    cake.add(mesh);
    const icing = new THREE.Mesh(new THREE.TorusGeometry(tier.r * 0.98, 0.028, 10, 72), gold);
    icing.rotation.x = Math.PI / 2;
    icing.position.y = tierY + tier.h - 0.015;
    cake.add(icing);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(tier.r * 0.96, tier.r * 0.96, 0.045, 64),
      material,
    );
    cap.position.y = tierY + tier.h - 0.02;
    cake.add(cap);
    tierLips.push({ y: icing.position.y, r: tier.r * 0.98 });
    tierY += tier.h;
  });

  const dripGeo = lathe([
    [0.001, 0], [0.055, 0], [0.04, -0.08], [0.018, -0.2], [0.001, -0.28],
  ], 8);
  const dripMat = new THREE.MeshStandardMaterial({
    color: 0xf6e2bf,
    roughness: 0.32,
    metalness: 0.45,
    emissive: 0x5a3a18,
    emissiveIntensity: 0.25,
  });
  const dripTotal = 10 + 8 + 6;
  const drips = new THREE.InstancedMesh(dripGeo, dripMat, dripTotal);
  drips.frustumCulled = false;
  let dripIndex = 0;
  [10, 8, 6].forEach((count, tierIndex) => {
    const lipInfo = tierLips[tierIndex];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + tierIndex * 0.4;
      dummy.position.set(Math.cos(angle) * lipInfo.r, lipInfo.y, Math.sin(angle) * lipInfo.r);
      dummy.rotation.set(0, -angle, 0);
      const s = 0.85 + (i % 3) * 0.1;
      dummy.scale.set(s, 0.9 + (i % 4) * 0.08, s);
      dummy.updateMatrix();
      drips.setMatrixAt(dripIndex, dummy.matrix);
      dripIndex += 1;
    }
  });
  drips.instanceMatrix.needsUpdate = true;
  cake.add(drips);

  const top = tierY;
  const candleCount = 6;
  const candleMat = new THREE.MeshStandardMaterial({
    color: 0xf7f2e8,
    roughness: 0.55,
    emissive: 0x3a3228,
    emissiveIntensity: 0.2,
  });
  const candles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.02, 0.22, 12), candleMat, candleCount);
  candles.frustumCulled = false;
  candles.userData.role = 'candles';
  const flameGeo = crossFlame();
  const seeds = new Float32Array(candleCount);
  for (let i = 0; i < candleCount; i += 1) seeds[i] = rnd();
  flameGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const flames = new THREE.InstancedMesh(
    flameGeo,
    shaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: timeUniform },
      vertexShader: flameVertex,
      fragmentShader: flameFragment,
    }),
    candleCount,
  );
  flames.frustumCulled = false;
  flames.userData.role = 'candles';
  for (let i = 0; i < candleCount; i += 1) {
    const angle = (i / candleCount) * Math.PI * 2 + 0.4;
    dummy.position.set(Math.cos(angle) * 0.24, top + 0.11, Math.sin(angle) * 0.24);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    candles.setMatrixAt(i, dummy.matrix);
    dummy.position.y = top + 0.2;
    dummy.updateMatrix();
    flames.setMatrixAt(i, dummy.matrix);
  }
  candles.instanceMatrix.needsUpdate = true;
  flames.instanceMatrix.needsUpdate = true;
  cake.add(candles, flames);

  const crystal = new THREE.Group();
  const crystalMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2, 1),
    shaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: { uTime: timeUniform },
      vertexShader: crystalVertex,
      fragmentShader: crystalFragment,
    }),
  );
  crystalMesh.userData.role = 'crystal';
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.08, 0),
    new THREE.MeshBasicMaterial({
      color: 0xe7fdff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  crystal.add(crystalMesh, core);
  crystal.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(crystalMesh.geometry),
    new THREE.LineBasicMaterial({ color: 0xe7fbff, transparent: true, opacity: 0.75 }),
  ));
  crystal.position.y = top + 0.34;
  cake.add(crystal);
  rig.add(cake);

  const ringMat = (color) => shaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: timeUniform,
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    },
    vertexShader: ringVertex,
    fragmentShader: ringFragment,
  });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.01, 12, 128), ringMat(0x9af4ff));
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.008, 10, 112), ringMat(0xffb0d8));
  ringA.position.y = 1.15;
  ringB.position.y = 1.15;
  rig.add(ringA, ringB);

  const wave = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.012, 8, 80), ringMat(0xffe2a8));
  wave.rotation.x = Math.PI / 2;
  wave.position.y = 1.15;
  wave.visible = false;
  rig.add(wave);

  const moons = [
    { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe9fbff, emissive: 0x7ee7ff, emissiveIntensity: 1.1, roughness: 0.3 })), r: 2.35, speed: 0.22, y: 1.25, phase: 0.4, squash: 0.72 },
    { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), gold), r: 2.7, speed: -0.16, y: 1.7, phase: 2.2, squash: 0.55 },
  ];
  moons.forEach((moon) => rig.add(moon.mesh));

  const portrait = new THREE.Group();
  const portraitCanvas = document.createElement('canvas');
  portraitCanvas.width = 512;
  portraitCanvas.height = 512;
  const portraitTex = new THREE.CanvasTexture(portraitCanvas);
  portraitTex.colorSpace = THREE.SRGBColorSpace;
  portraitTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const portraitMat = shaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      tMap: { value: portraitTex },
      uTime: timeUniform,
      uPhoto: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: portraitVertex,
    fragmentShader: portraitFragment,
  });
  const photo = new THREE.Mesh(new THREE.CircleGeometry(0.56, 64), portraitMat);
  photo.position.z = 0.03;
  photo.userData.role = 'portrait';
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.022, 16, 80), gold);
  bezel.userData.role = 'portrait';
  const outer = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.012, 12, 80), neon);
  const scanner = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.006, 8, 72), ringMat(0xc8f6ff));
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.045, 0.01), gold, 36);
  ticks.frustumCulled = false;
  for (let i = 0; i < 36; i += 1) {
    const angle = (i / 36) * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * 0.76, Math.sin(angle) * 0.76, 0.02);
    dummy.rotation.set(0, 0, angle + Math.PI / 2);
    const major = i % 6 === 0;
    dummy.scale.set(1, major ? 1.6 : 0.85, 1);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  const hitPortrait = new THREE.Mesh(
    new THREE.CircleGeometry(0.68, 24),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  hitPortrait.userData.role = 'portrait';
  portrait.add(photo, bezel, outer, scanner, ticks, hitPortrait);
  rig.add(portrait);

  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = NAME_W;
  nameCanvas.height = NAME_H;
  const nameCtx = nameCanvas.getContext('2d');
  const nameTex = new THREE.CanvasTexture(nameCanvas);
  nameTex.colorSpace = THREE.SRGBColorSpace;
  nameTex.generateMipmaps = false;
  nameTex.minFilter = THREE.LinearFilter;
  nameTex.anisotropy = portraitTex.anisotropy;
  const nameWidth = 2.15;
  const nameHeight = nameWidth * (NAME_H / NAME_W);
  const uPlaque = { value: 0 };
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(nameWidth * 1.04, nameHeight * 1.12),
    shaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: timeUniform, uOpacity: { value: 0 } },
      vertexShader: plaqueVertex,
      fragmentShader: plaqueFragment,
    }),
  );
  plaque.material.uniforms.uOpacity = uPlaque;
  const nameMat = new THREE.MeshBasicMaterial({
    map: nameTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    alphaTest: 0.05,
    toneMapped: false,
  });
  const nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(nameWidth, nameHeight), nameMat);
  nameMesh.position.z = 0.02;
  const nameGroup = new THREE.Group();
  nameGroup.add(plaque, nameMesh);
  rig.add(nameGroup);

  const composer = new EffectComposer(renderer);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), reduced ? 0.18 : 0.32, 0.45, 0.88);
  const grade = new ShaderPass(gradeShader);
  grade.uniforms.uTime = timeUniform;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(grade);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const look = new THREE.Vector3();
  const hitCrystal = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitCrystal.position.y = top + 0.34;
  hitCrystal.userData.role = 'crystal';
  cake.add(hitCrystal);
  const hitCandles = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.45, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitCandles.position.y = top + 0.2;
  hitCandles.userData.role = 'candles';
  cake.add(hitCandles);
  const interactive = [hitCrystal, hitCandles, hitPortrait, crystalMesh, candles, flames, photo, bezel];

  let mode = 'edit';
  let hold = true;
  let intro = 1;
  let visualTime = 0;
  let last = performance.now();
  let captionOn = false;
  let disposed = false;
  let composerReady = false;
  let orbitYaw = 0.58;
  let orbitPitch = 0.22;
  let yawVel = 0;
  let pitchVel = 0;
  let dist = 6.2;
  let distTarget = 6.2;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let dragMoved = 0;
  let lastMove = 0;
  let hoverRole = '';
  let wish = 0;
  let spark = 0;
  let focus = 0;
  let waveT = 2;
  let idle = 0;

  function choosePixelRatio() {
    const device = window.devicePixelRatio || 1;
    const small = Math.min(window.innerWidth, window.innerHeight) < 760;
    let ratio = Math.min(device, reduced ? 1.2 : small ? 1.5 : 1.65);
    const longEdge = Math.max(window.innerWidth, window.innerHeight) * ratio;
    if (longEdge > 1800) ratio *= 1800 / longEdge;
    return Math.max(1, ratio);
  }

  function applyLayout() {
    const width = window.innerWidth;
    const mobile = width < 860;
    const desktopEdit = mode === 'edit' && width >= 980;
    layout.lookX = desktopEdit ? -0.4 : 0;
    layout.dist = mobile ? 7.5 : desktopEdit ? 6.45 : 6.05;
    layout.pitch = mobile ? 0.3 : 0.2;
    layout.portrait.set(mobile ? 0.95 : 1.68, mobile ? 1.95 : 1.58, mobile ? 0.85 : 0.28);
    layout.portraitScale = mobile ? 0.56 : 0.84;
    layout.portraitYaw = mobile ? 0.35 : 0.58;
    layout.nameY = mobile ? 2.42 : 2.24;
    layout.nameScale = mobile ? 0.56 : 0.64;
    camera.fov = mobile ? 34 : 29;
    camera.aspect = width / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const ratio = choosePixelRatio();
    pixelUniform.value = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setSize(window.innerWidth, window.innerHeight);
    applyLayout();
  }

  function setPointer(event) {
    ndc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  }

  function pick(event) {
    setPointer(event);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(interactive, false);
    return hits.length ? hits[0].object.userData.role : '';
  }

  function trigger(role) {
    if (role === 'crystal') {
      wish = 1;
      waveT = 0;
      wave.visible = true;
      hooks.onInteract?.({ role, text: '愿望已点亮' });
    } else if (role === 'candles') {
      spark = 1;
      hooks.onInteract?.({ role, text: '烛火跳了一下' });
    } else if (role === 'portrait') {
      focus = 1;
      hooks.onInteract?.({ role, text: '肖像转过脸来' });
    }
  }

  function setName(text, placeholder) {
    drawNameplate(nameCtx, text || PLACEHOLDER_NAME, Boolean(placeholder));
    nameTex.needsUpdate = true;
  }

  const portraitCtx = portraitCanvas.getContext('2d');
  function setPortrait(source) {
    const size = portraitCanvas.width;
    if (!source) {
      drawEmblem(portraitCtx, size);
      portraitMat.uniforms.uPhoto.value = 0;
    } else {
      const iw = source.naturalWidth || source.width;
      const ih = source.naturalHeight || source.height;
      const side = Math.min(iw, ih);
      portraitCtx.clearRect(0, 0, size, size);
      portraitCtx.imageSmoothingEnabled = true;
      portraitCtx.imageSmoothingQuality = 'high';
      portraitCtx.drawImage(source, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, size, size);
      portraitMat.uniforms.uPhoto.value = 1;
    }
    portraitTex.needsUpdate = true;
  }

  function start(nextMode) {
    mode = nextMode;
    hold = false;
    intro = reduced ? 1 : 0;
    distTarget = layout.dist;
    orbitPitch = layout.pitch;
    yawVel = 0;
    pitchVel = 0;
    captionOn = false;
    hooks.onCaption?.(false);
    applyLayout();
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    visualTime += dt * (reduced ? 0.35 : 1);
    timeUniform.value = visualTime;
    if (!hold && intro < 1) intro = Math.min(1, intro + dt / 2.15);
    const eased = easeOutCubic(intro);
    idle = dragging ? 0 : idle + dt;

    const damp = 1 - Math.exp(-3.2 * dt);
    if (!dragging) {
      orbitYaw += yawVel * dt + (idle > 0.6 && !reduced ? dt * 0.08 : 0);
      orbitPitch += pitchVel * dt;
      yawVel *= Math.exp(-2.4 * dt);
      pitchVel *= Math.exp(-2.4 * dt);
      orbitPitch = clamp(orbitPitch, 0.08, 0.62);
    }
    dist += (distTarget - dist) * damp;
    const introYaw = orbitYaw + (1 - eased) * 0.7;
    const introPitch = orbitPitch + (1 - eased) * 0.18;
    const introDist = dist + (1 - eased) * 3.2;
    const bob = reduced ? 0 : Math.sin(visualTime * 0.7) * 0.03;
    look.set(layout.lookX, 1.18 + bob * 0.2, 0);
    camera.position.set(
      look.x + Math.sin(introYaw) * Math.cos(introPitch) * introDist,
      look.y + Math.sin(introPitch) * introDist * 0.85 + 0.35,
      look.z + Math.cos(introYaw) * Math.cos(introPitch) * introDist,
    );
    camera.lookAt(look);

    rig.position.y = bob;
    ringA.rotation.x = 0.95;
    ringA.rotation.y = visualTime * 0.22;
    ringB.rotation.z = 1.05;
    ringB.rotation.y = -visualTime * 0.18;
    crystal.rotation.y = visualTime * 0.45 + wish * 0.4;
    crystal.rotation.z = Math.sin(visualTime * 0.5) * 0.12;
    const crystalPop = wish > 0 ? 1 + Math.sin((1 - wish) * Math.PI) * 0.14 : 1;
    crystal.scale.setScalar(crystalPop);
    cake.rotation.y = Math.sin(visualTime * 0.15) * 0.04;
    scanner.rotation.z = visualTime * (0.45 + focus * 2.2);

    wish = Math.max(0, wish - dt * 0.55);
    spark = Math.max(0, spark - dt * 0.8);
    focus = Math.max(0, focus - dt * 0.7);
    candleLight.intensity = 1.6 + spark * 3.2 + Math.sin(visualTime * 9) * (reduced ? 0 : 0.08);
    if (wave.visible) {
      waveT += dt;
      const k = waveT / 1.25;
      wave.scale.setScalar(0.4 + k * 2.6);
      wave.material.uniforms.uOpacity.value = Math.max(0, 1 - k) * 0.9;
      if (k >= 1) wave.visible = false;
    }

    for (let i = 0; i < moons.length; i += 1) {
      const moon = moons[i];
      const angle = visualTime * moon.speed + moon.phase;
      moon.mesh.position.set(
        Math.cos(angle) * moon.r,
        moon.y + Math.sin(visualTime * 0.8 + moon.phase) * 0.05,
        Math.sin(angle) * moon.r * moon.squash,
      );
    }

    const revealAmount = Math.min(1, eased * 1.25);
    portrait.position.copy(layout.portrait);
    portrait.position.y += (1 - revealAmount) * -0.18;
    portrait.scale.setScalar(layout.portraitScale * (0.94 + focus * 0.05));
    portrait.rotation.y = layout.portraitYaw;
    portrait.rotation.z = Math.sin(visualTime * 0.6) * 0.03;
    portraitMat.uniforms.uOpacity.value = revealAmount;
    uPlaque.value = revealAmount;
    nameMat.opacity = revealAmount;
    nameGroup.position.set(layout.lookX * 0.15, layout.nameY + Math.sin(visualTime * 0.8) * 0.012, 0.05);
    nameGroup.scale.setScalar(layout.nameScale);
    nameGroup.rotation.x = -0.08;

    const showCaption = mode === 'view' && !hold && eased > 0.62;
    if (showCaption !== captionOn) {
      captionOn = showCaption;
      hooks.onCaption?.(showCaption);
    }

    if (!composerReady) {
      try {
        composer.render();
        composerReady = true;
      } catch {
        renderer.render(scene, camera);
      }
    } else {
      composer.render();
    }
    if (!frameNoted) {
      frameNoted = true;
      hooks.onFirstFrame?.();
    }
  }

  let frameNoted = false;
  setName(PLACEHOLDER_NAME, true);
  setPortrait(null);
  resize();

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    dragMoved = 0;
    dragX = event.clientX;
    dragY = event.clientY;
    lastMove = performance.now();
    yawVel = 0;
    pitchVel = 0;
    document.body.classList.add('is-dragging');
    canvas.setPointerCapture?.(event.pointerId);
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) {
      const nowMs = performance.now();
      if (nowMs - lastMove > 70) {
        lastMove = nowMs;
        const role = pick(event);
        if (role !== hoverRole) {
          hoverRole = role;
          document.body.classList.toggle('is-hovering', Boolean(role));
        }
      }
      return;
    }
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    const nowMs = performance.now();
    const step = Math.max(0.016, (nowMs - lastMove) / 1000);
    lastMove = nowMs;
    orbitYaw -= dx * 0.005;
    orbitPitch = clamp(orbitPitch + dy * 0.003, 0.08, 0.62);
    yawVel = (-dx * 0.005) / step;
    pitchVel = (dy * 0.003) / step;
    dragX = event.clientX;
    dragY = event.clientY;
  });
  window.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-dragging');
    if (dragMoved < 8) {
      const role = pick(event);
      if (role) trigger(role);
    }
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    distTarget = clamp(distTarget + Math.sign(event.deltaY) * 0.28, 4.4, 9.2);
  }, { passive: false });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    hooks.onContextLost?.();
  });
  document.addEventListener('visibilitychange', () => {
    if (disposed) return;
    if (document.hidden) renderer.setAnimationLoop(null);
    else {
      last = performance.now();
      renderer.setAnimationLoop(frame);
    }
  });
  renderer.setAnimationLoop(frame);

  return {
    start,
    setName,
    setPortrait,
    setReduced(next) {
      reduced = next;
      bloom.strength = next ? 0.16 : 0.32;
      grade.uniforms.uAmount.value = next ? 0.01 : 0.02;
      resize();
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      composer.dispose();
      renderer.dispose();
    },
  };
}
