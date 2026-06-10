import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  haloVertexShader,
  occlusionFragmentShader,
  particleFragmentShader,
  particleVertexShader,
  sphereFragmentShader,
  sphereVertexShader,
} from "./particleCloudShaders";

type SourceImage = HTMLImageElement | HTMLCanvasElement;

type ParticleBuffers = {
  positions: number[];
  colors: number[];
  sizes: number[];
  scatters: number[];
  alphas: number[];
  spawnPool: SpawnPoint[];
};

type SpawnPoint = {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  weight: number;
};

type RendererConfig = {
  dispersion: number;
  particleSize: number;
  contrast: number;
  flowSpeed: number;
  flowAmplitude: number;
  depthStrength: number;
  sphereRadius: number;
  sphereStrength: number;
  sphereMass: number;
  depthWave: number;
  colorShiftSpeed: number;
  danceStrength: number;
  escapeCount: number;
};

const CYBER_CONFIG: RendererConfig = {
  dispersion: 0.86,
  particleSize: 1.35,
  contrast: 1.34,
  flowSpeed: 0.42,
  flowAmplitude: 0.78,
  depthStrength: 5.8,
  sphereRadius: 7.2,
  sphereStrength: 0.72,
  sphereMass: 0.72,
  depthWave: 0.24,
  colorShiftSpeed: 0.42,
  danceStrength: 1.85,
  escapeCount: 30000,
};

const INACTIVE = new THREE.Vector3(-9999, -9999, -9999);

export class CyberParticleCloudRenderer {
  private readonly config: RendererConfig;
  private host: HTMLDivElement | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private particles: THREE.Points | null = null;
  private particleOcclusion: THREE.Points | null = null;
  private halo: THREE.Points | null = null;
  private sphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  private particleMaterial: THREE.ShaderMaterial | null = null;
  private haloMaterial: THREE.ShaderMaterial | null = null;
  private occlusionMaterial: THREE.ShaderMaterial | null = null;
  private animationId = 0;
  private playing = false;
  private disposed = false;
  private readonly timer = new THREE.Timer();
  private readonly mouse = new THREE.Vector2(-9999, -9999);
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly sphereCenter = INACTIVE.clone();
  private readonly targetSphereCenter = INACTIVE.clone();
  private readonly previousSphereCenter = INACTIVE.clone();
  private readonly sphereVelocity = new THREE.Vector3();
  private sphereActive = false;
  private sphereAlpha = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(config: Partial<RendererConfig> = {}) {
    this.config = { ...CYBER_CONFIG, ...config };
  }

  mount(host: HTMLDivElement) {
    this.host = host;
    this.disposed = false;

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.z = 330;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(this.renderer.domElement);
    this.timer.connect(document);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.minDistance = 210;
    this.controls.maxDistance = 520;
    this.controls.rotateSpeed = 0.55;
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    this.sphere = createInteractionSphere();
    this.sphere.visible = false;
    this.scene.add(this.sphere);

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    canvas.addEventListener("contextmenu", this.preventDefault);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.animate();
  }

  dispose() {
    this.disposed = true;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    const canvas = this.renderer?.domElement;
    canvas?.removeEventListener("pointermove", this.handlePointerMove);
    canvas?.removeEventListener("pointerleave", this.handlePointerLeave);
    canvas?.removeEventListener("contextmenu", this.preventDefault);

    this.controls?.dispose();
    this.timer.dispose();
    this.clearParticleLayers();
    if (this.sphere) {
      this.scene?.remove(this.sphere);
      this.sphere.geometry.dispose();
      this.sphere.material.dispose();
      this.sphere = null;
    }
    this.renderer?.dispose();
    if (canvas?.parentElement) canvas.parentElement.removeChild(canvas);
    this.host = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
    const dance = playing ? this.config.danceStrength : 0;
    if (this.particleMaterial) this.particleMaterial.uniforms.uDanceStrength.value = dance;
    if (this.haloMaterial) this.haloMaterial.uniforms.uDanceStrength.value = dance * 0.62;
  }

  async setImageSource(source: string | SourceImage) {
    if (!this.scene) return;
    const image = typeof source === "string" ? await loadImage(source) : source;
    if (this.disposed) return;
    this.buildFromImage(image);
  }

  resize() {
    if (!this.host || !this.camera || !this.renderer) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private buildFromImage(source: SourceImage) {
    if (!this.scene) return;
    const buffers = sampleSourceToParticles(source, this.config.escapeCount);
    this.clearParticleLayers();

    const uniforms = this.createParticleUniforms();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
    geometry.setAttribute("size", new THREE.Float32BufferAttribute(buffers.sizes, 1));
    geometry.setAttribute("scatter", new THREE.Float32BufferAttribute(buffers.scatters, 1));
    geometry.setAttribute("alpha", new THREE.Float32BufferAttribute(buffers.alphas, 1));

    const occlusionGeometry = geometry.clone();
    this.occlusionMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: occlusionFragmentShader,
      uniforms,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NoBlending,
    });
    this.occlusionMaterial.colorWrite = false;
    this.particleOcclusion = new THREE.Points(occlusionGeometry, this.occlusionMaterial);
    this.particleOcclusion.renderOrder = 1;
    this.scene.add(this.particleOcclusion);

    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.particles.renderOrder = 3;
    this.scene.add(this.particles);

    const haloField = buildHaloField(buffers.spawnPool, this.config.escapeCount);
    const haloGeometry = new THREE.BufferGeometry();
    haloGeometry.setAttribute("position", new THREE.Float32BufferAttribute(haloField.birth, 3));
    haloGeometry.setAttribute("color", new THREE.Float32BufferAttribute(haloField.colors, 3));
    haloGeometry.setAttribute("size", new THREE.Float32BufferAttribute(haloField.sizes, 1));
    haloGeometry.setAttribute("scatter", new THREE.Float32BufferAttribute(haloField.scatters, 1));
    haloGeometry.setAttribute("alpha", new THREE.Float32BufferAttribute(haloField.alphas, 1));
    haloGeometry.setAttribute("aBirth", new THREE.Float32BufferAttribute(haloField.birth, 3));
    haloGeometry.setAttribute("aVel", new THREE.Float32BufferAttribute(haloField.velocity, 3));
    haloGeometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(haloField.phase, 1));
    haloGeometry.setAttribute("aMaxL", new THREE.Float32BufferAttribute(haloField.life, 1));
    haloGeometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(haloField.seed, 1));

    this.haloMaterial = new THREE.ShaderMaterial({
      vertexShader: haloVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: this.createParticleUniforms(),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.halo = new THREE.Points(haloGeometry, this.haloMaterial);
    this.halo.renderOrder = 2;
    this.scene.add(this.halo);
    this.setPlaying(this.playing);
  }

  private clearParticleLayers() {
    for (const layer of [this.particles, this.particleOcclusion, this.halo]) {
      if (!layer) continue;
      this.scene?.remove(layer);
      layer.geometry.dispose();
      const material = layer.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
    }
    this.particles = null;
    this.particleOcclusion = null;
    this.halo = null;
    this.particleMaterial = null;
    this.occlusionMaterial = null;
    this.haloMaterial = null;
  }

  private createParticleUniforms() {
    return {
      uTime: { value: 0 },
      uSphereCenter: { value: this.sphereCenter.clone() },
      uSphereVelocity: { value: this.sphereVelocity.clone() },
      uSphereRadius: { value: this.config.sphereRadius },
      uSphereStrength: { value: this.config.sphereStrength },
      uSphereMass: { value: this.config.sphereMass },
      uDispersion: { value: this.config.dispersion },
      uParticleSize: { value: this.config.particleSize },
      uContrast: { value: this.config.contrast },
      uDepthStrength: { value: this.config.depthStrength },
      uFlowSpeed: { value: this.config.flowSpeed },
      uFlowAmplitude: { value: this.config.flowAmplitude },
      uDepthWave: { value: this.config.depthWave },
      uDanceStrength: { value: this.playing ? this.config.danceStrength : 0 },
      uColorShiftSpeed: { value: this.config.colorShiftSpeed },
    };
  }

  private updateUniforms(elapsed: number) {
    for (const material of [this.particleMaterial, this.occlusionMaterial, this.haloMaterial]) {
      if (!material) continue;
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uSphereCenter.value.copy(this.sphereCenter);
      material.uniforms.uSphereVelocity.value.copy(this.sphereVelocity);
      material.uniforms.uSphereRadius.value = this.config.sphereRadius;
      material.uniforms.uSphereStrength.value = this.config.sphereStrength;
      material.uniforms.uSphereMass.value = this.config.sphereMass;
    }
  }

  private animate = (timestamp?: number) => {
    if (this.disposed || !this.renderer || !this.scene || !this.camera) return;
    this.animationId = requestAnimationFrame(this.animate);
    this.timer.update(timestamp);
    const elapsed = this.timer.getElapsed();

    this.previousSphereCenter.copy(this.sphereCenter);
    if (this.sphereActive) {
      this.sphereCenter.lerp(this.targetSphereCenter, 0.22);
    }
    this.sphereVelocity.copy(this.sphereCenter).sub(this.previousSphereCenter);
    this.sphereAlpha += ((this.sphereActive ? 1 : 0) - this.sphereAlpha) * 0.14;
    this.updateUniforms(elapsed);

    if (this.sphere) {
      this.sphere.visible = this.sphereAlpha > 0.015;
      this.sphere.position.copy(this.sphereCenter);
      this.sphere.scale.setScalar(this.config.sphereRadius);
      this.sphere.material.uniforms.uTime.value = elapsed;
      this.sphere.material.uniforms.uAlpha.value = this.sphereAlpha;
      this.sphere.material.uniforms.uVelocity.value = clamp(this.sphereVelocity.length() * 0.05, 0, 1);
    }

    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.renderer || !this.camera) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersectPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, intersectPoint);
    this.targetSphereCenter.set(intersectPoint.x, intersectPoint.y, 11.5);
    if (!this.sphereActive && this.sphereAlpha < 0.05) {
      this.sphereCenter.copy(this.targetSphereCenter);
      this.previousSphereCenter.copy(this.targetSphereCenter);
      this.sphereVelocity.set(0, 0, 0);
    }
    this.sphereActive = true;
  };

  private handlePointerLeave = () => {
    this.sphereActive = false;
    this.targetSphereCenter.copy(INACTIVE);
  };

  private preventDefault = (event: Event) => event.preventDefault();
}

export function createCyberFallbackCanvas(text = "AIyou") {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#03040a");
  bg.addColorStop(0.42, "#0d1020");
  bg.addColorStop(1, "#03070a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const halo = ctx.createRadialGradient(480, 244, 20, 480, 244, 330);
  halo.addColorStop(0, "rgba(255,255,255,0.95)");
  halo.addColorStop(0.16, "rgba(255,58,177,0.72)");
  halo.addColorStop(0.42, "rgba(0,229,255,0.28)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.font = "900 178px Microsoft YaHei, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(0,229,255,0.82)";
  ctx.shadowColor = "rgba(255,58,177,0.95)";
  ctx.shadowBlur = 26;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 18);

  const textGradient = ctx.createLinearGradient(240, 0, 720, 0);
  textGradient.addColorStop(0, "#00e5ff");
  textGradient.addColorStop(0.48, "#ffffff");
  textGradient.addColorStop(1, "#ff3ab1");
  ctx.fillStyle = textGradient;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 18);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "700 22px ui-monospace, SFMono-Regular, monospace";
  ctx.fillText("KURO NEON STAGE", canvas.width / 2, canvas.height / 2 + 132);
  return canvas;
}

async function loadImage(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}

function sampleSourceToParticles(source: SourceImage, escapeCount: number): ParticleBuffers {
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, 380 / Math.max(source.width, source.height));
  canvas.width = Math.max(1, Math.floor(source.width * ratio));
  canvas.height = Math.max(1, Math.floor(source.height * ratio));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return emptyBuffers();
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return buildParticleBuffers(image.data, canvas.width, canvas.height, escapeCount);
}

function buildParticleBuffers(data: Uint8ClampedArray, imgW: number, imgH: number, escapeCount: number): ParticleBuffers {
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const scatters: number[] = [];
  const alphas: number[] = [];
  const spawnPool: SpawnPoint[] = [];
  const step = Math.max(1, Math.floor(Math.max(imgW, imgH) / 230));
  const aspect = imgH / imgW;
  const widthArea = 108;
  const heightArea = widthArea * aspect;
  const depthArea = 42;
  const curvedSurfaceRadius = Math.max(widthArea, heightArea) * 0.72;
  const curvedSurfaceLift = 34;

  for (let y = 0; y < imgH; y += step) {
    for (let x = 0; x < imgW; x += step) {
      const idx = (y * imgW + x) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      const a = data[idx + 3] / 255;
      if (a < 0.08) continue;

      const nx = x / imgW - 0.5;
      const ny = y / imgH - 0.5;
      const radius = Math.sqrt((nx / 0.58) * (nx / 0.58) + (ny / 0.58) * (ny / 0.58));
      const brightness = r * 0.299 + g * 0.587 + b * 0.114;
      const subject = 1 - getWhiteBackgroundMask(r, g, b);
      const organicNoise = hash2(Math.floor(x / 7), Math.floor(y / 7), 1) * 0.12 + hash2(x, y, 2) * 0.04;
      const centerDensity = 1 - smoothstep(0.18, 0.7, radius);
      const edgeDensity = 1 - smoothstep(0.46, 1.1, radius);
      const reveal = Math.max(subject, a) * (1 - smoothstep(0.96 + organicNoise, 1.12 + organicNoise, radius));
      const edgeStrength = getEdgeStrength(data, imgW, imgH, x, y);
      const subjectEdge = getSubjectEdgeStrength(data, imgW, imgH, x, y);
      const density = clamp(0.72 + centerDensity * 0.7 + edgeDensity * 0.32, 0.38, 1);
      const keepChance = centerDensity > 0.42 ? 0.98 : clamp(reveal * density + edgeStrength * 0.12 + subjectEdge * 0.18, 0, 1);

      if (radius > 1.16 + organicNoise * 0.14) continue;
      if (hash2(x, y, 3) > keepChance) continue;

      const outerFalloff = 1 - centerDensity;
      const scatter = clamp(edgeStrength * 0.28 + subjectEdge * 0.34 + outerFalloff * 0.12, 0, 0.64);
      const jitterScale = 0.12 + scatter * 0.48 + outerFalloff * 0.1;
      const jitterX = (hash2(x, y, 4) - 0.5) * step * jitterScale;
      const jitterY = (hash2(x, y, 5) - 0.5) * step * jitterScale;
      const flatX = (x / imgW - 0.5) * widthArea + jitterX;
      const flatY = -(y / imgH - 0.5) * heightArea + jitterY;
      const surfaceRadius = clamp(Math.sqrt(flatX * flatX + flatY * flatY) / curvedSurfaceRadius, 0, 0.98);
      const sphericalLift = (Math.sqrt(1 - surfaceRadius * surfaceRadius) - 1) * curvedSurfaceLift;
      const rimWrap = surfaceRadius * surfaceRadius * depthArea * 0.1;
      const posX = flatX * (1 + surfaceRadius * surfaceRadius * 0.12);
      const posY = flatY * (1 + surfaceRadius * surfaceRadius * 0.12);
      const posZ = sphericalLift + rimWrap + (brightness - 0.45) * depthArea * 0.09 + edgeStrength * depthArea * 0.08 + (hash2(x, y, 6) - 0.5) * depthArea * (0.045 + scatter * 0.11);

      pushParticle({ positions, colors, sizes, scatters, alphas, spawnPool }, posX, posY, posZ, r, g, b, brightness, scatter, centerDensity, edgeStrength);

      if (centerDensity > 0.48 && hash2(x, y, 60) < centerDensity * 0.82) {
        pushParticle({ positions, colors, sizes, scatters, alphas, spawnPool }, posX + (hash2(x, y, 61) - 0.5) * step, posY + (hash2(x, y, 62) - 0.5) * step, posZ, r, g, b, brightness, scatter * 0.45, centerDensity, edgeStrength);
      }

      const topRegion = 1 - smoothstep(0.14, 0.58, y / imgH);
      const sidePlume = Math.exp(-Math.pow((nx + 0.28) / 0.2, 2)) + Math.exp(-Math.pow((nx - 0.26) / 0.22, 2));
      const ragged = hash2(Math.floor(x / 17), Math.floor(y / 11), 301);
      const weight = (subjectEdge * 1.2 + edgeStrength * 0.52 + brightness * 0.18 + ragged * 0.16) * topRegion * (0.48 + sidePlume * 0.42);
      if (weight > 0.12 && spawnPool.length < escapeCount) {
        spawnPool.push({ x: posX, y: posY, z: posZ, r, g, b, weight });
      }
    }
  }

  if (positions.length < 900) {
    return buildEmergencyBurst();
  }
  return { positions, colors, sizes, scatters, alphas, spawnPool };
}

function pushParticle(
  buffers: ParticleBuffers,
  x: number,
  y: number,
  z: number,
  r: number,
  g: number,
  b: number,
  brightness: number,
  scatter: number,
  centerDensity: number,
  edgeStrength: number,
) {
  buffers.positions.push(x, y, z);
  const neon = scatter * 0.35 + edgeStrength * 0.25;
  buffers.colors.push(clamp(r + neon * 0.8, 0, 1), clamp(g + neon * 0.2, 0, 1), clamp(b + neon * 0.72, 0, 1));
  buffers.sizes.push(0.86 + brightness * 1.2 + scatter * 1.5);
  buffers.scatters.push(scatter);
  buffers.alphas.push(clamp(0.48 + centerDensity * 0.42 + edgeStrength * 0.34, 0.35, 1));
}

function buildHaloField(spawnPool: SpawnPoint[], count: number) {
  const birth: number[] = [];
  const colors: number[] = [];
  const velocity: number[] = [];
  const phase: number[] = [];
  const life: number[] = [];
  const seed: number[] = [];
  const sizes: number[] = [];
  const scatters: number[] = [];
  const alphas: number[] = [];
  const weightedPool = spawnPool.length > 0 ? spawnPool : [{ x: 0, y: 0, z: 0, r: 1, g: 0.2, b: 0.7, weight: 1 }];
  let totalWeight = 0;
  weightedPool.forEach((point) => {
    totalWeight += point.weight;
  });

  for (let i = 0; i < count; i++) {
    const p = sampleSpawn(weightedPool, totalWeight, i);
    const s = hash2(i, p.x * 10, 17);
    const angle = hash2(i, p.y * 10, 18) * Math.PI * 2;
    const speed = 8 + hash2(i, p.z * 10, 19) * 32;
    birth.push(p.x, p.y, p.z + (hash2(i, 1, 20) - 0.5) * 8);
    colors.push(clamp(p.r * 1.15 + 0.08, 0, 1), clamp(p.g * 1.08 + 0.04, 0, 1), clamp(p.b * 1.2 + 0.12, 0, 1));
    velocity.push(Math.cos(angle) * speed * 0.42, Math.sin(angle) * speed * 0.2 + 18, (hash2(i, 2, 21) - 0.5) * speed * 0.52);
    phase.push(hash2(i, 3, 22));
    life.push(12 + hash2(i, 4, 23) * 16);
    seed.push(s * 1000);
    sizes.push(0.6 + hash2(i, 5, 24) * 2.2);
    scatters.push(0.24 + hash2(i, 6, 25) * 0.56);
    alphas.push(0.12 + hash2(i, 7, 26) * 0.72);
  }
  return { birth, colors, velocity, phase, life, seed, sizes, scatters, alphas };
}

function sampleSpawn(pool: SpawnPoint[], totalWeight: number, idx: number) {
  let target = hash2(idx, 10, 11) * totalWeight;
  for (const point of pool) {
    target -= point.weight;
    if (target <= 0) return point;
  }
  return pool[pool.length - 1];
}

function createInteractionSphere() {
  const geometry = new THREE.SphereGeometry(1, 64, 32);
  const material = new THREE.ShaderMaterial({
    vertexShader: sphereVertexShader,
    fragmentShader: sphereFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uVelocity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
}

function getEdgeStrength(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const c = getPixelBrightness(data, width, height, x, y);
  const dx = Math.abs(c - getPixelBrightness(data, width, height, x + 1, y));
  const dy = Math.abs(c - getPixelBrightness(data, width, height, x, y + 1));
  return clamp((dx + dy) * 3.2, 0, 1);
}

function getSubjectEdgeStrength(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const center = getSubjectMaskAt(data, width, height, x, y);
  const samples = [
    getSubjectMaskAt(data, width, height, x + 2, y),
    getSubjectMaskAt(data, width, height, x - 2, y),
    getSubjectMaskAt(data, width, height, x, y + 2),
    getSubjectMaskAt(data, width, height, x, y - 2),
  ];
  return samples.reduce((max, sample) => Math.max(max, Math.abs(center - sample)), 0);
}

function getPixelBrightness(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const sx = clamp(Math.round(x), 0, width - 1);
  const sy = clamp(Math.round(y), 0, height - 1);
  const idx = (sy * width + sx) * 4;
  return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
}

function getSubjectMaskAt(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const sx = clamp(Math.round(x), 0, width - 1);
  const sy = clamp(Math.round(y), 0, height - 1);
  const idx = (sy * width + sx) * 4;
  return 1 - getWhiteBackgroundMask(data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255);
}

function getWhiteBackgroundMask(r: number, g: number, b: number) {
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const saturation = maxChannel - minChannel;
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  return smoothstep(0.72, 0.95, brightness) * (1 - smoothstep(0.08, 0.28, saturation));
}

function buildEmergencyBurst(): ParticleBuffers {
  const buffers = emptyBuffers();
  for (let i = 0; i < 9000; i++) {
    const angle = i * 0.094;
    const radius = Math.sqrt(i / 9000) * 68;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.52;
    const z = (hash2(i, 0, 1) - 0.5) * 22;
    const hot = i % 2 === 0;
    pushParticle(buffers, x, y, z, hot ? 1 : 0.0, hot ? 0.12 : 0.88, hot ? 0.62 : 1, 0.75, radius / 68, 0.4, 0.2);
  }
  buffers.spawnPool.push({ x: 0, y: 0, z: 0, r: 1, g: 0.2, b: 0.7, weight: 1 });
  return buffers;
}

function emptyBuffers(): ParticleBuffers {
  return { positions: [], colors: [], sizes: [], scatters: [], alphas: [], spawnPool: [] };
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(x: number, y: number, salt = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
