export const timeUniform = { value: 0 };
export const pixelUniform = { value: 1 };

export const starVertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  uniform float uTime;
  uniform float uPixel;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + aSize * 0.35) + position.x * 0.17);
    gl_PointSize = clamp(aSize * twinkle * uPixel * (260.0 / max(1.0, -mv.z)), 0.6, 5.5);
  }
`;

export const starFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float alpha = smoothstep(1.0, 0.2, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export const dustVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  varying float vSeed;
  uniform float uTime;
  uniform float uPixel;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    float cycle = fract(aSeed + uTime * aSpeed);
    p.y = position.y + cycle * 1.8;
    p.x += sin(uTime * 0.7 + aSeed * 6.2831) * 0.08;
    p.z += cos(uTime * 0.5 + aSeed * 4.1) * 0.08;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp((1.6 + aSeed * 2.4) * uPixel * (90.0 / max(1.0, -mv.z)), 0.8, 4.5);
  }
`;

export const dustFragment = /* glsl */ `
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    vec3 col = mix(vec3(0.55, 0.9, 1.0), vec3(1.0, 0.84, 0.55), step(0.62, vSeed));
    gl_FragColor = vec4(col, smoothstep(1.0, 0.0, d) * 0.85);
  }
`;

export const sparkVertex = /* glsl */ `
  attribute float aSeed;
  varying float vSeed;
  uniform float uTime;
  uniform float uPixel;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    float rise = fract(aSeed * 0.73 + uTime * (0.08 + aSeed * 0.05));
    p.y += rise * 1.35;
    p.x += sin(uTime + aSeed * 8.0) * 0.04;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp((1.8 + rise * 2.2) * uPixel * (70.0 / max(1.0, -mv.z)), 0.7, 5.0);
  }
`;

export const sparkFragment = /* glsl */ `
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    vec3 col = mix(vec3(1.0, 0.86, 0.55), vec3(0.7, 0.95, 1.0), vSeed);
    gl_FragColor = vec4(col * 1.35, smoothstep(1.0, 0.1, d));
  }
`;

export const nebulaVertex = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const nebulaFragment = /* glsl */ `
  varying vec3 vPos;
  uniform float uTime;
  void main() {
    vec3 p = normalize(vPos);
    float n = sin(p.x * 3.2 + uTime * 0.05) * sin(p.y * 2.4 - uTime * 0.03);
    float m = sin((p.z + n) * 2.6 + p.x);
    vec3 col = vec3(0.012, 0.016, 0.03);
    col += vec3(0.05, 0.16, 0.28) * smoothstep(0.15, 1.0, n) * 0.85;
    col += vec3(0.22, 0.05, 0.14) * smoothstep(0.35, 1.0, m) * 0.55;
    col += vec3(0.16, 0.1, 0.03) * smoothstep(0.72, 1.0, sin(p.x * 1.4 + p.y * 0.8)) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const ringVertex = /* glsl */ `
  varying float vAlong;
  varying float vTube;
  void main() {
    vAlong = atan(position.y, position.x);
    vTube = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ringFragment = /* glsl */ `
  varying float vAlong;
  varying float vTube;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float along = vAlong * 0.15915494 + 0.5;
    float phase = fract(along * 9.0 - uTime * 0.35);
    float dash = smoothstep(0.0, 0.08, phase) * smoothstep(0.62, 0.38, phase);
    float core = smoothstep(0.5, 0.05, abs(vTube - 0.5));
    vec3 col = mix(uColor, vec3(1.0), core * 0.55);
    float alpha = (0.14 + dash * 0.9) * core * uOpacity;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export const ribbonVertex = /* glsl */ `
  attribute float aAlong;
  varying float vAlong;
  void main() {
    vAlong = aAlong;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ribbonFragment = /* glsl */ `
  varying float vAlong;
  uniform float uTime;
  uniform vec3 uColor;
  void main() {
    float pulse = smoothstep(0.12, 0.0, abs(fract(vAlong - uTime * 0.18) - 0.08));
    float ends = smoothstep(0.0, 0.12, vAlong) * smoothstep(1.0, 0.88, vAlong);
    float alpha = (0.18 + pulse * 0.75) * ends;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), pulse), alpha);
  }
`;

export const flameVertex = /* glsl */ `
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  uniform float uTime;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec3 p = position;
    p.x += sin(uTime * 8.0 + aSeed * 12.0 + position.y * 10.0) * 0.012;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

export const flameFragment = /* glsl */ `
  varying vec2 vUv;
  varying float vSeed;
  uniform float uTime;
  void main() {
    vec2 p = vUv - vec2(0.5, 0.28);
    p.x += sin(p.y * 12.0 + uTime * 9.0 + vSeed * 6.0) * 0.04;
    float body = smoothstep(0.34, 0.02, length(p * vec2(1.85, 0.78)));
    float core = smoothstep(0.16, 0.0, length((vUv - vec2(0.5, 0.34)) * vec2(2.6, 1.5)));
    vec3 col = mix(vec3(1.0, 0.32, 0.08), vec3(1.0, 0.78, 0.35), core);
    col = mix(col, vec3(1.0, 0.97, 0.88), core * core);
    float alpha = body * (0.72 + 0.28 * sin(uTime * 14.0 + vSeed * 5.0));
    if (alpha < 0.03) discard;
    gl_FragColor = vec4(col * 1.35, alpha);
  }
`;

export const crystalVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = viewMatrix * world;
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const crystalFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vView;
  uniform float uTime;
  void main() {
    vec3 n = normalize(vNormal);
    float fres = pow(1.0 - clamp(dot(n, normalize(vView)), 0.0, 1.0), 1.7);
    float facet = abs(sin(vWorld.x * 22.0 + vWorld.y * 16.0 + uTime * 0.7));
    vec3 col = mix(vec3(0.12, 0.42, 0.58), vec3(0.98, 0.84, 0.55), fres);
    col += vec3(0.45, 0.9, 1.0) * facet * 0.16;
    float alpha = 0.22 + fres * 0.7;
    gl_FragColor = vec4(col * (0.8 + fres * 0.9), alpha);
  }
`;

export const portraitVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = viewMatrix * world;
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const portraitFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform sampler2D tMap;
  uniform float uTime;
  uniform float uPhoto;
  uniform float uOpacity;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float radius = length(p);
    float mask = smoothstep(1.0, 0.955, radius);
    if (mask < 0.01) discard;
    float shift = 0.0012 + (1.0 - uPhoto) * 0.0025;
    float r = texture2D(tMap, vUv + vec2(shift, 0.0)).r;
    vec4 tex = texture2D(tMap, vUv);
    float b = texture2D(tMap, vUv - vec2(shift, 0.0)).b;
    vec3 col = vec3(r, tex.g, b);
    vec3 holo = col * vec3(0.78, 0.98, 1.08) + vec3(0.015, 0.03, 0.04);
    col = mix(holo, col, 0.42 + uPhoto * 0.48);
    float scan = 0.9 + 0.1 * sin(vUv.y * 210.0 - uTime * 2.2);
    col *= scan;
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 2.0);
    col += vec3(0.45, 0.9, 1.0) * fres * 0.22;
    col *= mix(0.78, 1.0, smoothstep(1.0, 0.35, radius));
    gl_FragColor = vec4(col, mask * uOpacity);
  }
`;

export const plaqueVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z -= pow(uv.x - 0.5, 2.0) * 0.42;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const plaqueFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  void main() {
    vec2 c = vUv * 2.0 - 1.0;
    vec2 bounds = vec2(0.9, 0.7);
    float radius = 0.18;
    vec2 d = abs(c) - bounds + vec2(radius);
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
    float border = 1.0 - smoothstep(0.012, 0.07, abs(dist));
    float scan = 0.72 + 0.28 * sin(vUv.y * 36.0 + uTime * 1.6);
    vec3 col = mix(vec3(0.55, 0.95, 1.0), vec3(1.0, 0.86, 0.55), vUv.x);
    float alpha = border * scan * uOpacity;
    if (alpha < 0.04) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export const nameVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z -= pow(uv.x - 0.5, 2.0) * 0.42;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const nameFragment = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tMap;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uDim;
  void main() {
    vec4 tex = texture2D(tMap, vUv);
    float luma = max(tex.r, max(tex.g, tex.b));
    float scan = 0.86 + 0.14 * sin(vUv.y * 90.0 - uTime * 2.0);
    float alpha = max(tex.a, luma) * scan * uOpacity * mix(1.0, 0.8, uDim);
    if (luma < 0.045 || alpha < 0.04) discard;
    vec3 col = tex.rgb * mix(1.15, 0.9, uDim);
    gl_FragColor = vec4(col, alpha);
  }
`;

export const tetherVertex = /* glsl */ `
  varying float vAlong;
  void main() {
    vAlong = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const tetherFragment = /* glsl */ `
  varying float vAlong;
  uniform float uTime;
  uniform float uOpacity;
  void main() {
    float bead = smoothstep(0.045, 0.0, abs(fract(vAlong - uTime * 0.28) - 0.5));
    vec3 col = mix(vec3(0.35, 0.85, 1.0), vec3(1.0, 0.86, 0.5), bead);
    float alpha = (0.28 + bead * 0.72) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

export const columnVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const columnFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float x = pow(smoothstep(0.5, 0.0, abs(vUv.x - 0.5)), 1.8);
    float y = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
    float alpha = x * y * 0.28;
    if (alpha < 0.01) discard;
    vec3 col = mix(vec3(0.35, 0.8, 1.0), vec3(1.0, 0.9, 0.6), pow(x, 3.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

export const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.026 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    void main() {
      vec2 q = vUv - 0.5;
      float shift = length(q) * 0.0011;
      vec3 color;
      color.r = texture2D(tDiffuse, vUv + vec2(shift, 0.0)).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - vec2(shift, 0.0)).b;
      float grain = hash(vUv * vec2(980.0, 820.0) + fract(uTime * 13.0)) - 0.5;
      color += grain * uAmount;
      float vig = smoothstep(0.78, 0.22, length(q));
      color *= mix(0.62, 1.0, vig);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
