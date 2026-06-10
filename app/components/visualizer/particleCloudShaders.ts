export const particleVertexShader = `
  uniform float uTime;
  uniform vec3 uSphereCenter;
  uniform vec3 uSphereVelocity;
  uniform float uSphereRadius;
  uniform float uSphereStrength;
  uniform float uSphereMass;
  uniform float uDispersion;
  uniform float uParticleSize;
  uniform float uDepthStrength;
  uniform float uFlowSpeed;
  uniform float uFlowAmplitude;
  uniform float uDepthWave;
  uniform float uDanceStrength;

  attribute vec3 color;
  attribute float size;
  attribute float scatter;
  attribute float alpha;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vScatter;

  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vColor = color;
    vAlpha = alpha;
    vScatter = scatter;

    vec3 pos = position;
    float brightness = dot(color, vec3(0.299, 0.587, 0.114));
    float noise = snoise(vec3(pos.x * 0.018, pos.y * 0.018, uTime * uFlowSpeed * 0.55));
    float breath = snoise(vec3(pos.x * 0.024, pos.y * 0.024, uTime * 0.22)) * 0.5 + 0.5;
    vec2 radial = normalize(pos.xy + vec2(0.001));
    vec2 wind = normalize(vec2(-0.62, 0.46));
    vec2 drift = vec2(
      snoise(vec3(pos.xy * 0.034, uTime * 0.28)),
      snoise(vec3(pos.yx * 0.034, uTime * 0.28 + 37.0))
    );
    float dust = scatter * (0.18 + breath * 0.22);

    pos.xy += drift * uFlowAmplitude * (1.0 - scatter) * 0.42;
    pos.xy += (radial * (3.2 + uDispersion * 3.3) + wind * (3.6 + uFlowAmplitude * 2.4) + drift * 3.8) * dust;
    pos.z += brightness * uDepthStrength * (0.35 + scatter * 0.1) + noise * uFlowAmplitude * 1.25 + dust * 2.1;
    pos.z += sin(pos.x * 0.026 + uTime) * cos(pos.y * 0.024 + uTime) * uDepthWave * (1.0 - scatter * 0.4);

    vec3 toParticle = pos - uSphereCenter;
    float sphereDist = length(toParticle);
    float sphereRadius = max(uSphereRadius, 0.001);
    vec3 sphereNormal = normalize(toParticle + vec3(0.001));
    vec3 toSphere = -sphereNormal;
    float gravityRange = sphereRadius * (2.15 + uSphereMass * 0.75);
    float gravity = 1.0 - smoothstep(sphereRadius * 0.72, gravityRange, sphereDist);
    float capture = 1.0 - smoothstep(sphereRadius * 0.2, sphereRadius * 1.08, sphereDist);
    float motion = clamp(length(uSphereVelocity.xy) * 0.04, 0.0, 1.0);
    float glassNoise = snoise(vec3(pos.xy * 0.05, uTime * 0.7));
    vec3 tangent = normalize(vec3(-sphereNormal.y, sphereNormal.x, 0.16 + glassNoise * 0.2));
    float physicalForce = uSphereStrength * (0.65 + uSphereMass * 0.7);
    vec3 capturePoint = uSphereCenter + vec3(
      snoise(vec3(position.xy * 0.13, uTime * 0.55)),
      snoise(vec3(position.yx * 0.13, uTime * 0.55 + 23.0)),
      snoise(vec3(position.xy * 0.09, uTime * 0.42 + 47.0))
    ) * sphereRadius * 0.42;

    pos += toSphere * gravity * physicalForce * (6.4 + scatter * 8.4);
    pos = mix(pos, capturePoint, capture * clamp(0.055 + uSphereMass * 0.075, 0.0, 0.18));
    pos += tangent * gravity * (0.75 + scatter * 2.0) * (0.25 + motion) * uSphereStrength;
    pos.xy += normalize(uSphereVelocity.xy + vec2(0.001)) * gravity * motion * (2.0 + scatter * 3.4) * uSphereMass;

    if (uDanceStrength > 0.0) {
      float kick = pow(max(0.0, sin(uTime * 6.2 + scatter * 4.0)), 6.0);
      pos.xy += radial * kick * uDanceStrength * (0.55 + scatter * 1.8);
      pos.y += snoise(vec3(pos.x * 0.05, uTime * 2.2, 0.0)) * uDanceStrength * 1.5;
      pos.z += kick * uDanceStrength * 1.35;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float sizeBoost = mix(0.9, 1.32, scatter) * (0.82 + brightness * 0.55);
    gl_PointSize = clamp(uParticleSize * size * sizeBoost * (300.0 / -mvPosition.z), 0.45, 3.8);
  }
`;

export const particleFragmentShader = `
  uniform float uContrast;
  uniform float uTime;
  uniform float uColorShiftSpeed;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vScatter;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    vec3 color = (vColor - 0.5) * uContrast + 0.5;
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + uTime * uColorShiftSpeed * 0.08);
    hsv.y = clamp(hsv.y * 1.24 + vScatter * 0.18, 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.08 + vScatter * 0.34), 0.0, 1.0);
    color = hsv2rgb(hsv);

    float alpha = exp(-dist * dist * 6.4) * vAlpha * mix(0.9, 1.24, vScatter);
    float core = pow(max(1.0 - dist * 1.82, 0.0), 2.3);
    color += core * mix(vec3(0.08, 0.22, 0.34), vec3(0.44, 0.08, 0.30), vScatter);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const occlusionFragmentShader = `
  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

export const haloVertexShader = particleVertexShader
  .replace("attribute float size;", "attribute float size;\n  attribute vec3 aBirth;\n  attribute vec3 aVel;\n  attribute float aPhase;\n  attribute float aMaxL;\n  attribute float aSeed;")
  .replace("vec3 pos = position;", `
    float life = max(aMaxL, 0.001);
    float age = mod(uTime * 0.34 + aPhase * life, life);
    float progress = age / life;
    float eased = progress * progress * (3.0 - 2.0 * progress);
    vec2 radial2 = normalize(aBirth.xy + vec2(0.001));
    vec2 orbit2 = vec2(-radial2.y, radial2.x);
    float stream = snoise(vec3(aBirth.x * 0.02, aBirth.y * 0.006, uTime * 0.18 + aSeed));
    vec3 pos = aBirth + aVel * age * (0.18 + uFlowAmplitude * 0.16);
    pos.y += eased * eased * (8.0 + scatter * 9.0);
    pos.xy += radial2 * eased * (1.2 + scatter * 8.0);
    pos.xy += orbit2 * sin(progress * 5.5 + aSeed) * eased * (1.2 + scatter * 3.2);
    pos.x += stream * eased * (4.4 + scatter * 7.4);
  `)
  .replace("gl_PointSize = clamp(uParticleSize * size * sizeBoost * (300.0 / -mvPosition.z), 0.45, 3.8);", "gl_PointSize = clamp(uParticleSize * size * sizeBoost * (300.0 / -mvPosition.z), 0.3, 5.4);");

export const sphereVertexShader = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  varying vec3 vLocalPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    vLocalPosition = position;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const sphereFragmentShader = `
  uniform float uTime;
  uniform float uAlpha;
  uniform float uVelocity;

  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  varying vec3 vLocalPosition;

  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0), 2.3);
    float ring = smoothstep(0.22, 0.92, length(vLocalPosition.xy));
    float pulse = sin(uTime * 5.0 + vLocalPosition.y * 7.0) * 0.5 + 0.5;
    vec3 color = mix(vec3(0.0, 0.92, 1.0), vec3(1.0, 0.18, 0.68), pulse);
    float alpha = (0.12 + fresnel * 0.62 + ring * 0.16 + uVelocity * 0.18) * uAlpha;
    gl_FragColor = vec4(color, alpha);
  }
`;
