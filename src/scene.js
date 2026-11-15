import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PLACEHOLDER_NAME } from './content.js';
import {
  columnFragment,
  columnVertex,
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
  ribbonFragment,
  ribbonVertex,
  ringFragment,
  ringVertex,
  sparkFragment,
  sparkVertex,
  starFragment,
  starVertex,
  tetherFragment,
  tetherVertex,
  timeUniform,
} from './shaders.js';

const SERIF = '"Songti SC","STSong","Noto Serif SC","Source Han Serif SC","PMingLiU","Songti TC","WenQuanYi Micro Hei",serif';
const NAME_W = 1400;
const NAME_H = 480;

const layout = {
  camX: 0.9,
  camY: 1.55,
  camZ: 6.3,
  lookX: 0.1,
  lookY: 1.2,
  lookZ: 0,
  fov: 30,
  px: 2.05,
  py: 1.58,
  pz: 0.4,
  pScale: 1,
  pYaw: 0.48,
  nx: 0,
  ny: 2.55,
  nz: 0.05,
  nScale: 1,
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

function reveal(progress, start, duration) {
  const amount = (progress - start) / duration;
  if (amount <= 0) return 0;
  if (amount >= 1) return 1;
  return amount * amount * (3 - 2 * amount);
}

function easeOutQuart(amount) {
  return 1 - (1 - amount) ** 4;
}

function shaderMaterial(options) {
  const material = new THREE.ShaderMaterial(options);
  if (material.uniforms.uTime) material.uniforms.uTime = timeUniform;
  if (material.uniforms.uPixel) material.uniforms.uPixel = pixelUniform;
  return material;
}

function addRim(material, tint = 'vec3(0.4, 0.9, 1.0)') {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        float rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.5);
        totalEmissiveRadiance += vec3(0.08, 0.12, 0.16);
        totalEmissiveRadiance += ${tint} * rim * 0.55;
      }`,
    );
  };
}

function tierGeometry(radius, height) {
  const points = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(radius * 0.9, 0.0),
    new THREE.Vector2(radius, 0.035),
    new THREE.Vector2(radius * 0.99, height * 0.55),
    new THREE.Vector2(radius * 0.995, height - 0.02),
    new THREE.Vector2(radius * 0.72, height),
    new THREE.Vector2(0.001, height),
  ];
  return new THREE.LatheGeometry(points, 64);
}

function dripGeometry() {
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.064, 0),
      new THREE.Vector2(0.046, -0.07),
      new THREE.Vector2(0.022, -0.18),
      new THREE.Vector2(0.011, -0.3),
      new THREE.Vector2(0.001, -0.36),
    ],
    8,
  );
}

function crossFlameGeometry() {
  const w = 0.26;
  const h = 0.46;
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

function starGeometry() {
  const shape = new THREE.Shape();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? 0.2 : 0.086;
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 1,
  });
  geometry.center();
  return geometry;
}

function runeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  ctx.strokeStyle = 'rgba(150, 230, 255, 0.9)';
  ctx.fillStyle = 'rgba(240, 214, 160, 0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 188, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 228, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 24; i += 1) {
    ctx.save();
    ctx.rotate((i / 24) * Math.PI * 2);
    ctx.translate(0, -208);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(7, 9);
    ctx.lineTo(-7, 9);
    ctx.closePath();
    if (i % 2 === 0) ctx.fill();
    else ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 132;
    const y = Math.sin(angle) * 132;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
  gradient.addColorStop(0, 'rgba(255, 246, 224, 0.95)');
  gradient.addColorStop(0.2, 'rgba(120, 220, 255, 0.38)');
  gradient.addColorStop(0.55, 'rgba(90, 40, 110, 0.08)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawEmblem(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, '#1c4258');
  gradient.addColorStop(0.62, '#10202e');
  gradient.addColorStop(1, '#070c14');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(180, 236, 255, 0.85)';
  ctx.lineWidth = Math.max(2, size * 0.012);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2d7a4';
  ctx.beginPath();
  const cx = size / 2;
  const cy = size / 2;
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? size * 0.16 : size * 0.07;
    const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawNameplate(ctx, name, placeholder) {
  const width = NAME_W;
  const height = NAME_H;
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 42px ${SERIF}`;
  ctx.fillStyle = placeholder ? 'rgba(186, 214, 224, 0.55)' : 'rgba(244, 224, 180, 0.95)';
  ctx.fillText(placeholder ? '预 览' : '生 日 快 乐', width / 2, height * 0.28);
  ctx.strokeStyle = placeholder ? 'rgba(150, 190, 200, 0.25)' : 'rgba(150, 230, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.34, height * 0.4);
  ctx.lineTo(width * 0.66, height * 0.4);
  ctx.stroke();

  let size = 168;
  ctx.font = `600 ${size}px ${SERIF}`;
  while (ctx.measureText(name).width > width * 0.88 && size > 56) {
    size -= 4;
    ctx.font = `600 ${size}px ${SERIF}`;
  }
  const gradient = ctx.createLinearGradient(width * 0.12, 0, width * 0.88, height);
  if (placeholder) {
    gradient.addColorStop(0, 'rgba(198, 224, 232, 0.62)');
    gradient.addColorStop(1, 'rgba(214, 206, 230, 0.45)');
  } else {
    gradient.addColorStop(0, '#c8f6ff');
    gradient.addColorStop(0.48, '#fff4d4');
    gradient.addColorStop(1, '#ffc6e4');
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(6, 12, 20, 0.35)';
  ctx.strokeText(name, width / 2, height * 0.68);
  ctx.fillStyle = gradient;
  ctx.fillText(name, width / 2, height * 0.68);
}

function pointsMaterial(vertexShader, fragmentShader) {
  return shaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: timeUniform, uPixel: pixelUniform },
    vertexShader,
    fragmentShader,
  });
}

export function createScene(canvas, hooks = {}) {
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = reduced || window.innerWidth < 860 || window.matchMedia('(pointer: coarse)').matches;

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
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x05060c, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060c);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 90);
  const rig = new THREE.Group();
  scene.add(rig);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const addEnv = (color, x, y, z, size, intensity) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 1,
        metalness: 0,
      }),
    );
    mesh.position.set(x, y, z);
    env.add(mesh);
  };
  addEnv(0x147898, -5, 3.2, -2, 2.1, 8);
  addEnv(0xc43b78, 5.2, 1.4, 2.2, 1.6, 6);
  addEnv(0xe2b15e, 0.2, 6.2, -1, 1.8, 5);
  addEnv(0x101828, 0, -3.2, 3.4, 5.5, 0.8);
  env.add(new THREE.AmbientLight(0x9fc4d4, 0.45));
  scene.environment = pmrem.fromScene(env, 0.04, 0.1, 24).texture;
  scene.environmentIntensity = 0.72;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xb7e7ff, 0x140910, 0.42));
  const key = new THREE.DirectionalLight(0xf4fbff, 1.85);
  key.position.set(-3.6, 6.4, 4.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff4f9a, 0.85);
  rim.position.set(4.4, 2.2, -3.4);
  scene.add(rim);
  const candleLight = new THREE.PointLight(0xffc48a, 1.5, 7.5, 2);
  candleLight.position.set(0, 1.7, 0.25);
  rig.add(candleLight);
  const fill = new THREE.PointLight(0x49d7ff, 1.15, 9, 2);
  fill.position.set(-2.3, 1.5, 2.2);
  rig.add(fill);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(56, 32, 20),
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

  const rnd = mulberry32(11);
  const starCount = compact ? 760 : 1500;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const palette = [
    [0.78, 0.9, 1],
    [1, 0.93, 0.78],
    [1, 0.74, 0.86],
    [0.92, 0.96, 1],
  ];
  for (let i = 0; i < starCount; i += 1) {
    const radius = 18 + rnd() * 28;
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.7;
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = palette[i % palette.length];
    starColors[i * 3] = color[0];
    starColors[i * 3 + 1] = color[1];
    starColors[i * 3 + 2] = color[2];
    starSizes[i] = 0.65 + rnd() * 1.7;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  const stars = new THREE.Points(starGeo, pointsMaterial(starVertex, starFragment));
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  scene.add(stars);

  const dustCount = compact ? 90 : 170;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount);
  const dustSpeeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (rnd() - 0.5) * 4.4;
    dustPositions[i * 3 + 1] = rnd() * 0.25;
    dustPositions[i * 3 + 2] = (rnd() - 0.5) * 4.4;
    dustSeeds[i] = rnd();
    dustSpeeds[i] = 0.03 + rnd() * 0.05;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeeds, 1));
  dustGeo.setAttribute('aSpeed', new THREE.BufferAttribute(dustSpeeds, 1));
  const dust = new THREE.Points(dustGeo, pointsMaterial(dustVertex, dustFragment));
  dust.frustumCulled = false;
  rig.add(dust);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x151b24,
    metalness: 0.92,
    roughness: 0.34,
    envMapIntensity: 0.48,
  });
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xf1d3a2,
    metalness: 1,
    roughness: 0.23,
    clearcoat: 0.4,
    emissive: 0x8a5820,
    emissiveIntensity: 0.32,
    envMapIntensity: 0.8,
  });
  const neon = new THREE.MeshStandardMaterial({
    color: 0x072028,
    emissive: 0x6af3ff,
    emissiveIntensity: 1.7,
    metalness: 0.3,
    roughness: 0.38,
  });
  const rose = new THREE.MeshStandardMaterial({
    color: 0x2a101c,
    emissive: 0xff5ea2,
    emissiveIntensity: 1.25,
    metalness: 0.28,
    roughness: 0.4,
  });
  addRim(metal, 'vec3(0.25, 0.7, 0.9)');

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.9, 0.24, 6), metal);
  plinth.position.y = 0.12;
  plinth.rotation.y = Math.PI / 6;
  const step = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.38, 0.12, 6), metal);
  step.position.y = 0.28;
  step.rotation.y = Math.PI / 6;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.08, 0.08, 48), metal);
  dais.position.y = 0.37;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.012, 12, 90), neon);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.34;
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.006, 8, 90), rose);
  roseRing.rotation.x = Math.PI / 2;
  roseRing.position.y = 0.14;
  rig.add(plinth, step, dais, trim, roseRing);

  const dummy = new THREE.Object3D();
  const pylons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.46, 0.035), neon, 6);
  pylons.frustumCulled = false;
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    dummy.position.set(Math.cos(angle) * 1.5, 0.34, Math.sin(angle) * 1.5);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pylons.setMatrixAt(i, dummy.matrix);
  }
  pylons.instanceMatrix.needsUpdate = true;
  rig.add(pylons);

  const runeMat = new THREE.MeshBasicMaterial({
    map: runeTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  const runeDisc = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 4.7), runeMat);
  runeDisc.rotation.x = -Math.PI / 2;
  runeDisc.position.y = 0.025;
  const runeDiscSmall = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.1), runeMat);
  runeDiscSmall.rotation.x = -Math.PI / 2;
  runeDiscSmall.position.y = 0.03;
  rig.add(runeDisc, runeDiscSmall);

  const armillary = new THREE.Group();
  armillary.position.y = 1.05;
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
  const ringH = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.012, 12, 140), ringMat(0xf0d7a4));
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.01, 10, 120), ringMat(0x8ef6ff));
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.008, 10, 110), ringMat(0xff8ec8));
  armillary.add(ringH, ringA, ringB);
  rig.add(armillary);

  const ribbonGroup = new THREE.Group();
  const makeRibbon = (phase, color) => {
    const segments = 80;
    const points = [];
    for (let i = 0; i < segments; i += 1) {
      const t = i / (segments - 1);
      const angle = t * Math.PI * 2 * 1.15 + phase;
      const y = 0.35 + t * 1.9;
      const radius = 1.55 + Math.sin(t * Math.PI) * 0.18;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    const positions = [];
    const along = [];
    const indices = [];
    const side = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const radial = new THREE.Vector3();
    for (let i = 0; i < segments; i += 1) {
      const t = i / (segments - 1);
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(segments - 1, i + 1)];
      tangent.subVectors(next, prev);
      if (tangent.lengthSq() < 1e-6) tangent.set(0, 1, 0);
      tangent.normalize();
      radial.set(points[i].x, 0, points[i].z);
      if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
      radial.normalize();
      side.crossVectors(tangent, radial).normalize();
      const width = 0.012 + 0.012 * Math.sin(t * Math.PI);
      const left = points[i].clone().addScaledVector(side, -width);
      const right = points[i].clone().addScaledVector(side, width);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      along.push(t, t);
      if (i < segments - 1) {
        const offset = i * 2;
        indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(
      geometry,
      shaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color(color) } },
        vertexShader: ribbonVertex,
        fragmentShader: ribbonFragment,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  };
  ribbonGroup.add(makeRibbon(0.2, 0x7eefff), makeRibbon(Math.PI, 0xff8ec4));
  rig.add(ribbonGroup);

  const columnMat = shaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {},
    vertexShader: columnVertex,
    fragmentShader: columnFragment,
  });
  const columnA = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.5), columnMat);
  columnA.position.y = 1.35;
  const columnB = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.5), columnMat);
  columnB.position.y = 1.35;
  columnB.rotation.y = Math.PI / 2;
  rig.add(columnA, columnB);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.4,
    }),
  );
  glow.position.set(0, 1.15, 0);
  glow.scale.set(4.6, 4.6, 1);
  rig.add(glow);

  const cake = new THREE.Group();
  cake.position.y = 0.42;
  const cakeColors = [
    { color: 0x4d6d8c, emissive: 0x1d4d6e },
    { color: 0x6a4d78, emissive: 0x5a2a58 },
    { color: 0x5d7394, emissive: 0x245878 },
  ];
  const tiers = [
    { r: 1.04, h: 0.5 },
    { r: 0.74, h: 0.4 },
    { r: 0.5, h: 0.34 },
  ];
  let tierY = 0;
  const tierTops = [];
  tiers.forEach((tier, index) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: cakeColors[index].color,
      roughness: 0.32,
      metalness: 0.08,
      clearcoat: 0.7,
      clearcoatRoughness: 0.28,
      iridescence: 0.8,
      iridescenceIOR: 1.2,
      iridescenceThicknessMinimum: 140,
      iridescenceThicknessMaximum: 540,
      emissive: cakeColors[index].emissive,
      emissiveIntensity: 0.9,
      envMapIntensity: 0.7,
    });
    addRim(material, index === 1 ? 'vec3(0.85, 0.45, 0.6)' : 'vec3(0.25, 0.55, 0.7)');
    const mesh = new THREE.Mesh(tierGeometry(tier.r, tier.h), material);
    mesh.position.y = index === 0 ? tierY : tierY - 0.02;
    cake.add(mesh);
    const icing = new THREE.Mesh(new THREE.TorusGeometry(tier.r * 1.03, 0.038, 12, 80), gold);
    icing.rotation.x = Math.PI / 2;
    icing.position.y = tierY + tier.h - 0.02;
    cake.add(icing);
    tierTops.push({ y: tierY + tier.h - 0.02, r: tier.r * 1.01 });
    tierY += tier.h;
  });

  const dripMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.58,
    emissive: 0x2c2418,
    emissiveIntensity: 0.22,
    envMapIntensity: 0.7,
  });
  const dripCounts = [11, 8, 6];
  const dripTotal = dripCounts.reduce((sum, count) => sum + count, 0);
  const drips = new THREE.InstancedMesh(dripGeometry(), dripMat, dripTotal);
  drips.frustumCulled = false;
  const goldColor = new THREE.Color(0xf3d7a6);
  const roseColor = new THREE.Color(0xf0a4c4);
  let dripIndex = 0;
  dripCounts.forEach((count, tierIndex) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + tierIndex * 0.35;
      const lip = tierTops[tierIndex];
      dummy.position.set(Math.cos(angle) * lip.r, lip.y, Math.sin(angle) * lip.r);
      dummy.rotation.set(0, -angle, 0);
      const scale = 0.78 + ((i * 17) % 5) * 0.08;
      dummy.scale.set(scale, 0.85 + (i % 3) * 0.12, scale);
      dummy.updateMatrix();
      drips.setMatrixAt(dripIndex, dummy.matrix);
      drips.setColorAt(dripIndex, i % 3 === 0 ? roseColor : goldColor);
      dripIndex += 1;
    }
  });
  drips.instanceMatrix.needsUpdate = true;
  drips.instanceColor.needsUpdate = true;
  cake.add(drips);

  const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.042, 16, 12), gold, 9);
  pearls.frustumCulled = false;
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + 0.2;
    dummy.position.set(Math.cos(angle) * 0.78, 0.7, Math.sin(angle) * 0.78);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pearls.setMatrixAt(i, dummy.matrix);
  }
  pearls.instanceMatrix.needsUpdate = true;
  cake.add(pearls);

  const top = tierY;
  const candleCount = 6;
  const candles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.013, 0.016, 0.2, 10),
    new THREE.MeshStandardMaterial({
      color: 0xf6f1e6,
      roughness: 0.62,
      metalness: 0.04,
      emissive: 0x3a3124,
      emissiveIntensity: 0.18,
    }),
    candleCount,
  );
  candles.frustumCulled = false;
  const flameGeo = crossFlameGeometry();
  const flameSeeds = new Float32Array(candleCount);
  for (let i = 0; i < candleCount; i += 1) flameSeeds[i] = rnd();
  flameGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(flameSeeds, 1));
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
  flames.renderOrder = 3;
  for (let i = 0; i < candleCount; i += 1) {
    const angle = (i / candleCount) * Math.PI * 2 + 0.35;
    dummy.position.set(Math.cos(angle) * 0.28, top + 0.1, Math.sin(angle) * 0.28);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    candles.setMatrixAt(i, dummy.matrix);
    dummy.position.y = top + 0.18;
    dummy.updateMatrix();
    flames.setMatrixAt(i, dummy.matrix);
  }
  candles.instanceMatrix.needsUpdate = true;
  flames.instanceMatrix.needsUpdate = true;
  cake.add(candles, flames);

  const crystal = new THREE.Group();
  const crystalGeo = new THREE.IcosahedronGeometry(0.2, 1);
  crystal.add(
    new THREE.Mesh(
      crystalGeo,
      shaderMaterial({
        transparent: true,
        depthWrite: true,
        uniforms: { uTime: timeUniform },
        vertexShader: crystalVertex,
        fragmentShader: crystalFragment,
      }),
    ),
  );
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.09, 0),
    new THREE.MeshBasicMaterial({
      color: 0xd8fbff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  crystal.add(core);
  crystal.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(crystalGeo),
      new THREE.LineBasicMaterial({ color: 0xd9fbff, transparent: true, opacity: 0.7 }),
    ),
  );
  crystal.position.y = top + 0.28;
  cake.add(crystal);

  const starMat = gold.clone();
  starMat.side = THREE.DoubleSide;
  const star = new THREE.Mesh(starGeometry(), starMat);
  star.position.y = top + 0.62;
  cake.add(star);

  const sparkCount = compact ? 36 : 80;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkSeeds = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i += 1) {
    const angle = rnd() * Math.PI * 2;
    const radius = 0.35 + rnd() * 0.95;
    sparkPositions[i * 3] = Math.cos(angle) * radius;
    sparkPositions[i * 3 + 1] = 0.15 + rnd() * 0.4;
    sparkPositions[i * 3 + 2] = Math.sin(angle) * radius;
    sparkSeeds[i] = rnd();
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(sparkSeeds, 1));
  const sparkles = new THREE.Points(sparkGeo, pointsMaterial(sparkVertex, sparkFragment));
  sparkles.frustumCulled = false;
  cake.add(sparkles);
  rig.add(cake);

  const moons = [];
  const moonGeo = new THREE.SphereGeometry(0.055, 16, 12);
  const moonMat = new THREE.MeshStandardMaterial({
    color: 0xe7fbff,
    emissive: 0x79e7ff,
    emissiveIntensity: 1.15,
    roughness: 0.28,
    metalness: 0.35,
  });
  const moonGold = moonMat.clone();
  moonGold.color.set(0xffe1a8);
  moonGold.emissive.set(0xffc56a);
  const moonSpecs = [
    { r: 2.72, speed: 0.16, y: 1.2, phase: 0.4, squash: 0.68, mat: moonMat, scale: 1 },
    { r: 3.15, speed: -0.1, y: 1.82, phase: 2.1, squash: 0.52, mat: moonGold, scale: 1.35 },
    { r: 2.9, speed: 0.2, y: 0.62, phase: 4.0, squash: 0.78, mat: moonMat, scale: 0.8 },
  ];
  moonSpecs.forEach((spec) => {
    const mesh = new THREE.Mesh(moonGeo, spec.mat);
    mesh.scale.setScalar(spec.scale);
    rig.add(mesh);
    moons.push({ mesh, ...spec });
  });

  const portrait = new THREE.Group();
  const portraitCanvas = document.createElement('canvas');
  portraitCanvas.width = 512;
  portraitCanvas.height = 512;
  const portraitTex = new THREE.CanvasTexture(portraitCanvas);
  portraitTex.colorSpace = THREE.SRGBColorSpace;
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
  const photo = new THREE.Mesh(new THREE.CircleGeometry(0.58, 72), portraitMat);
  photo.position.z = 0.025;
  photo.renderOrder = 6;
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x071018,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.76, 64), backMat);
  back.position.z = -0.05;
  back.renderOrder = 5;
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 16, 90), gold);
  bezel.renderOrder = 7;
  const outer = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.011, 12, 90), neon);
  outer.renderOrder = 7;
  const scanner = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.007, 8, 80), ringMat(0xbff6ff));
  scanner.renderOrder = 7;
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.048, 0.012), gold, 48);
  ticks.frustumCulled = false;
  ticks.renderOrder = 7;
  for (let i = 0; i < 48; i += 1) {
    const angle = (i / 48) * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * 0.79, Math.sin(angle) * 0.79, 0.02);
    dummy.rotation.set(0, 0, angle + Math.PI / 2);
    const major = i % 6 === 0;
    dummy.scale.set(major ? 1.15 : 0.65, major ? 1.65 : 1, 1);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.046, 0), gold);
  crown.position.set(0, 0.9, 0.03);
  portrait.add(back, photo, bezel, outer, scanner, ticks, crown);
  rig.add(portrait);

  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = NAME_W;
  nameCanvas.height = NAME_H;
  const nameCtx = nameCanvas.getContext('2d');
  const nameTex = new THREE.CanvasTexture(nameCanvas);
  nameTex.colorSpace = THREE.SRGBColorSpace;
  nameTex.generateMipmaps = false;
  nameTex.minFilter = THREE.LinearFilter;
  nameTex.magFilter = THREE.LinearFilter;
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  nameTex.anisotropy = aniso;
  portraitTex.anisotropy = aniso;
  const nameWidth = 2.42;
  const nameHeight = nameWidth * (NAME_H / NAME_W);
  const uNameOpacity = { value: 0 };
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(nameWidth * 1.06, nameHeight * 1.16),
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
  plaque.material.uniforms.uOpacity = uNameOpacity;
  plaque.renderOrder = 8;
  const nameMat = new THREE.MeshBasicMaterial({
    map: nameTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    alphaTest: 0.06,
    toneMapped: false,
  });
  const nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(nameWidth, nameHeight), nameMat);
  nameMesh.position.z = 0.03;
  nameMesh.renderOrder = 9;
  const underline = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.012),
    new THREE.MeshBasicMaterial({
      color: 0x9aebff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  underline.position.set(0, -nameHeight * 0.46, 0.04);
  underline.renderOrder = 9;
  const nameGroup = new THREE.Group();
  nameGroup.add(plaque, nameMesh, underline);
  rig.add(nameGroup);

  const tetherMat = shaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: timeUniform, uOpacity: { value: 0 } },
    vertexShader: tetherVertex,
    fragmentShader: tetherFragment,
  });
  let tether = null;
  let tetherKey = '';

  function updateTether() {
    const start = new THREE.Vector3(layout.px, layout.py - 0.7 * layout.pScale, layout.pz);
    const end = new THREE.Vector3(0.22, 0.5, 0.28);
    const mid = new THREE.Vector3(
      (start.x + end.x) * 0.48,
      Math.min(start.y, end.y) - 0.18,
      (start.z + end.z) * 0.5 + 0.2,
    );
    const geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, mid, end), 40, 0.01, 5, false);
    if (!tether) {
      tether = new THREE.Mesh(geometry, tetherMat);
      tether.frustumCulled = false;
      tether.renderOrder = 2;
      rig.add(tether);
    } else {
      tether.geometry.dispose();
      tether.geometry = geometry;
    }
    }

  function applyLayout() {
    const width = window.innerWidth;
    const mobile = width < 860;
    const desktopEdit = mode === 'edit' && width >= 980;
    if (mobile) {
      Object.assign(layout, {
        camX: 0.1, camY: 1.7, camZ: 7.4,
        lookX: 0, lookY: 1.25, lookZ: 0,
        fov: 33,
        px: 1.05, py: 1.95, pz: 0.95, pScale: 0.55, pYaw: 0.4,
        nx: 0, ny: 2.35, nz: 0.25, nScale: 0.58,
      });
    } else if (desktopEdit) {
      Object.assign(layout, {
        camX: -0.15, camY: 1.55, camZ: 6.3,
        lookX: -0.55, lookY: 1.15, lookZ: 0,
        fov: 30,
        px: 1.15, py: 1.55, pz: 0.4, pScale: 0.8, pYaw: 0.62,
        nx: -0.05, ny: 2.16, nz: 0.12, nScale: 0.6,
      });
    } else {
      Object.assign(layout, {
        camX: 0.25, camY: 1.5, camZ: 6.15,
        lookX: -0.05, lookY: 1.12, lookZ: 0,
        fov: 30,
        px: 1.45, py: 1.52, pz: 0.4, pScale: 0.84, pYaw: 0.52,
        nx: 0, ny: 2.18, nz: 0.12, nScale: 0.68,
      });
    }
    camera.fov = layout.fov;
    const key = `${mobile}|${desktopEdit}|${layout.px}|${layout.py}|${layout.pScale}`;
    if (key !== tetherKey) {
      tetherKey = key;
      updateTether();
    }
  }

  function choosePixelRatio() {
    const device = window.devicePixelRatio || 1;
    let cap = window.innerWidth < 860 ? 1.5 : 1.75;
    if (reduced) cap = 1.35;
    let ratio = Math.min(device, cap);
    const maxEdge = reduced ? 1500 : 2100;
    const longEdge = Math.max(window.innerWidth, window.innerHeight) * ratio;
    if (longEdge > maxEdge) {
      ratio = Math.max(1, maxEdge / Math.max(window.innerWidth, window.innerHeight));
    }
    return ratio;
  }

  const composer = new EffectComposer(renderer);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), reduced ? 0.2 : 0.38, 0.6, 0.86);
  const grade = new ShaderPass(gradeShader);
  grade.uniforms.uTime = timeUniform;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(grade);
  const samples = window.innerWidth >= 900 && !reduced
    ? Math.min(2, renderer.capabilities.maxSamples || 0)
    : 0;
  composer.renderTarget1.samples = samples;
  composer.renderTarget2.samples = samples;

  function applyQuality() {
    bloom.strength = reduced ? 0.18 : 0.38;
    bloom.radius = 0.58;
    bloom.threshold = 0.86;
    grade.uniforms.uAmount.value = reduced ? 0.012 : 0.022;
  }
  applyQuality();

  let mode = 'edit';
  let hold = true;
  let seenEditIntro = false;
  let introElapsed = 0;
  let visualTime = 0;
  let last = performance.now();
  let captionOn = false;
  let disposed = false;
  let composerReady = false;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let dragging = false;
  let dragLastX = 0;
  let dragYaw = 0;
  let dragTarget = 0;
  const camFrom = new THREE.Vector3(0.2, 4.6, 12.6);
  const desiredCam = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const look = new THREE.Vector3(0, 1.1, 0);
  const portraitCtx = portraitCanvas.getContext('2d');

  function resize() {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    const ratio = choosePixelRatio();
    pixelUniform.value = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    applyLayout();
    camera.updateProjectionMatrix();
  }

  function setName(text, placeholder) {
    drawNameplate(nameCtx, text || PLACEHOLDER_NAME, placeholder);
    nameTex.needsUpdate = true;
  }

  function setPortrait(source) {
    const size = portraitCanvas.width;
    if (!source) {
      drawEmblem(portraitCtx, size);
      portraitMat.uniforms.uPhoto.value = 0;
    } else {
      const iw = source.naturalWidth || source.width;
      const ih = source.naturalHeight || source.height;
      const side = Math.min(iw, ih);
      const sx = (iw - side) / 2;
      const sy = (ih - side) / 2;
      portraitCtx.clearRect(0, 0, size, size);
      portraitCtx.imageSmoothingEnabled = true;
      portraitCtx.imageSmoothingQuality = 'high';
      portraitCtx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
      portraitMat.uniforms.uPhoto.value = 1;
    }
    portraitTex.needsUpdate = true;
  }

  function start(nextMode) {
    mode = nextMode;
    hold = false;
    captionOn = false;
    hooks.onCaption?.(false);
    if (mode === 'view' || !seenEditIntro) {
      introElapsed = 0;
      if (mode === 'edit') seenEditIntro = true;
    } else {
      introElapsed = 100;
    }
    resize();
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    visualTime += dt * (reduced ? 0.35 : 1);
    timeUniform.value = visualTime;
    if (!hold && !reduced) introElapsed += Math.min(0.1, dt);
    const duration = reduced ? 0 : (mode === 'view' ? 6.1 : 3);
    const progress = duration === 0 ? 1 : Math.min(1, introElapsed / duration);
    const parallax = reduced ? 0.2 : 1;
    const follow = 1 - Math.exp(-4 * dt);
    pointer.sx += (pointer.x - pointer.sx) * follow;
    pointer.sy += (pointer.y - pointer.sy) * follow;
    dragYaw += (dragTarget - dragYaw) * (1 - Math.exp(-3 * dt));

    const eased = duration === 0 ? 1 : easeOutQuart(progress);
    desiredCam.set(
      camFrom.x + (layout.camX - camFrom.x) * eased + pointer.sx * 0.16 * parallax,
      camFrom.y + (layout.camY - camFrom.y) * eased + Math.sin(visualTime * 0.5) * (reduced ? 0 : 0.04),
      camFrom.z + (layout.camZ - camFrom.z) * eased,
    );
    desiredLook.set(
      layout.lookX * eased + pointer.sx * 0.08 * parallax,
      0.42 + (layout.lookY - 0.42) * eased,
      layout.lookZ,
    );
    if (progress < 1) {
      camera.position.copy(desiredCam);
      look.copy(desiredLook);
    } else {
      const glide = 1 - Math.exp(-3.2 * dt);
      camera.position.lerp(desiredCam, glide);
      look.lerp(desiredLook, glide);
    }
    camera.lookAt(look);
    renderer.toneMappingExposure = 0.74 + 0.34 * eased;

    rig.position.y = Math.sin(visualTime * 0.8) * (reduced ? 0.008 : 0.036);
    rig.rotation.y = dragYaw + Math.sin(visualTime * 0.12) * (reduced ? 0 : 0.04);

    const cakeReveal = reveal(progress, 0.12, 0.36);
    cake.position.y = 0.42 + (1 - cakeReveal) * -0.42;
    armillary.scale.setScalar(0.78 + 0.22 * reveal(progress, 0.04, 0.42));
    ringH.rotation.x = Math.PI / 2;
    ringH.rotation.z = visualTime * 0.16;
    ringA.rotation.x = 0.95;
    ringA.rotation.y = visualTime * 0.25;
    ringB.rotation.z = 1.05;
    ringB.rotation.y = -visualTime * 0.2;
    ribbonGroup.rotation.y = visualTime * 0.1;
    runeDisc.rotation.z = visualTime * 0.05;
    runeDiscSmall.rotation.z = -visualTime * 0.08;
    crystal.rotation.y = visualTime * 0.45;
    crystal.rotation.z = Math.sin(visualTime * 0.45) * 0.16;
    crystal.position.y = top + 0.28 + Math.sin(visualTime * 1.15) * 0.028;
    star.rotation.y = visualTime * 0.7;
    scanner.rotation.z = visualTime * 0.45;
    candleLight.intensity = (0.3 + 1.65 * reveal(progress, 0.28, 0.34))
      * (reduced ? 1 : 0.94 + Math.sin(visualTime * 11) * 0.045);

    for (let i = 0; i < moons.length; i += 1) {
      const moon = moons[i];
      const angle = visualTime * moon.speed + moon.phase;
      moon.mesh.position.set(
        Math.cos(angle) * moon.r,
        moon.y + Math.sin(visualTime * 0.7 + moon.phase) * 0.05,
        Math.sin(angle) * moon.r * moon.squash,
      );
    }

    const portraitReveal = reveal(progress, mode === 'view' ? 0.4 : 0.25, 0.3);
    portrait.position.set(
      layout.px + pointer.sx * 0.05 * parallax,
      layout.py + (1 - portraitReveal) * -0.24,
      layout.pz,
    );
    portrait.scale.setScalar(layout.pScale * (0.92 + 0.08 * portraitReveal));
    portrait.rotation.y = layout.pYaw + pointer.sx * 0.22 * parallax;
    portrait.rotation.x = -0.05 + pointer.sy * -0.1 * parallax;
    photo.position.x = pointer.sx * -0.03 * parallax;
    photo.position.y = pointer.sy * -0.016 * parallax;
    portraitMat.uniforms.uOpacity.value = portraitReveal;
    backMat.opacity = 0.28 * portraitReveal;
    tetherMat.uniforms.uOpacity.value = portraitReveal;

    const nameReveal = reveal(progress, mode === 'view' ? 0.56 : 0.38, 0.28);
    const nameOpacity = mode === 'edit' ? Math.max(nameReveal, 0.92) : nameReveal;
    uNameOpacity.value = nameOpacity;
    nameMat.opacity = nameOpacity;
    underline.material.opacity = nameReveal;
    nameGroup.position.set(
      layout.nx + pointer.sx * 0.04 * parallax,
      layout.ny + Math.sin(visualTime * 0.85) * 0.016,
      layout.nz,
    );
    nameGroup.scale.setScalar(layout.nScale);
    nameGroup.rotation.y = pointer.sx * -0.06 * parallax;
    nameGroup.rotation.x = -0.08 + pointer.sy * 0.04 * parallax;

    const showCaption = mode === 'view' && !hold && progress > 0.62;
    if (showCaption !== captionOn) {
      captionOn = showCaption;
      hooks.onCaption?.(showCaption);
    }

    if (!composerReady) {
      try {
        composer.render();
        composerReady = true;
      } catch {
        composerReady = false;
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
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    if (!dragging) return;
    const delta = (event.clientX - dragLastX) / window.innerWidth;
    dragLastX = event.clientX;
    dragTarget = Math.max(-0.55, Math.min(0.55, dragTarget + delta * 1.8));
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    dragTarget = 0;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    dragLastX = event.clientX;
    dragTarget = dragYaw;
    canvas.setPointerCapture?.(event.pointerId);
  });
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
      applyQuality();
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
