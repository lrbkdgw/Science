import * as THREE from "three";
import { galaxies, imagePath, type Galaxy } from "./catalog";

export interface ViewSettings {
  auto: boolean;
  speed: number;
  light: number;
  marks: boolean;
  guides: boolean;
}
interface SceneEvents {
  zoom: (zoom: number) => void;
  mode: (mode: "orbit" | "top") => void;
  ready: (webgl: boolean) => void;
}
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const ease = (from: number, to: number, delta: number) =>
  THREE.MathUtils.lerp(from, to, 1 - Math.exp(-delta * 11));
function randomSeed(value: number) {
  return () => {
    let a = (value += 0x6d2b79f5);
    a = Math.imul(a ^ (a >>> 15), a | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

/** A thin, stratified emissive volume and its individually positioned stellar population. */
export class GalaxyScene {
  readonly settings: ViewSettings;
  suspended = false;
  private events: SceneEvents;
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(22, 1, 0.1, 160);
  private inclinedFrame = new THREE.Group();
  private disk = new THREE.Group();
  private reference = new THREE.Group();
  private volume = new THREE.Group();
  private field = new THREE.Group();
  private starMaterial?: THREE.ShaderMaterial;
  private volumeMaterials: THREE.ShaderMaterial[] = [];
  private galaxy: Galaxy = galaxies[0];
  private textures = new Map<string, Promise<THREE.Texture>>();
  private changeToken = 0;
  private hasTexture = false;
  private width = 1;
  private height = 1;
  private centerX = 0;
  private centerY = 0;
  private discPixels = 0;
  private frameId = 0;
  private lastTime = 0;
  private clock = 0;
  private tilt = galaxies[0].tilt;
  private targetTilt = this.tilt;
  private roll = galaxies[0].roll;
  private targetRoll = this.roll;
  private angle = 0;
  private targetAngle = 0;
  private zoom = 1;
  private targetZoom = 1;
  private mode: "orbit" | "top" = "orbit";
  private points = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private markers: HTMLElement[];
  private vector = new THREE.Vector3();
  private axisBasis = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    -0.62,
  );
  private fallback: HTMLImageElement;
  private fallbackOrbits: HTMLElement;
  private axis = document.querySelector<SVGSVGElement>("#axis-gizmo");
  private observer: ResizeObserver;
  private lostContext = false;
  private onRestore = () => {
    this.lostContext = false;
    if (this.hasTexture) this.host.classList.add("webgl-ready");
    this.events.ready(true);
  };

  constructor(host: HTMLElement, settings: ViewSettings, events: SceneEvents) {
    this.host = host;
    this.settings = settings;
    this.events = events;
    this.canvas = host.querySelector("canvas")!;
    this.fallback = host.querySelector(".fallback-galaxy")!;
    this.fallbackOrbits = host.querySelector(".compat-orbits")!;
    this.markers = Array.from(
      document.querySelectorAll<HTMLElement>(".sky-mark"),
    );
    try {
      const attributes: WebGLContextAttributes = {
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      };
      const context = this.canvas.getContext("webgl2", attributes);
      if (!context) throw new Error("WebGL 2 is unavailable");
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        context,
        ...attributes,
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      this.canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.lostContext = true;
        this.host.classList.remove("webgl-ready");
        this.events.ready(false);
      });
      this.canvas.addEventListener("webglcontextrestored", this.onRestore);
    } catch {
      // The same orbit UI stays usable with the photographic fallback on devices without WebGL.
      this.renderer = null;
    }
    this.scene.add(this.inclinedFrame, this.field);
    this.inclinedFrame.add(this.disk, this.reference);
    this.disk.add(this.volume);
    this.inclinedFrame.rotation.order = "ZXY";
    this.makeGuides();
    if (this.renderer) this.makeStarField();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.bindPointer();
    this.setGalaxy(this.galaxy);
    this.frameId = requestAnimationFrame(this.frame);
  }

  private resize() {
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    const w = this.width,
      h = this.height;
    const phone = w < 680,
      tablet = w <= 960;
    this.centerX = w * (phone ? 0.51 : tablet ? 0.535 : 0.474);
    this.centerY = h * (phone ? 0.625 : tablet ? 0.555 : 0.485);
    this.discPixels = phone
      ? Math.min(w * 1.12, h * 1.06)
      : tablet
        ? Math.min(w * 0.91, h * 1.73)
        : Math.min(w * 0.633, h * 1.86);
    this.camera.aspect = w / h;
    this.camera.position.set(
      0,
      0,
      (10.4 * h) /
        this.discPixels /
        (2 * Math.tan(THREE.MathUtils.degToRad(11))),
    );
    this.camera.setViewOffset(
      w,
      h,
      w / 2 - this.centerX,
      h / 2 - this.centerY,
      w,
      h,
    );
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.renderer?.setSize(w, h, false);
    this.fallback.style.width = `${this.discPixels}px`;
    this.fallback.style.left = `${this.centerX}px`;
    this.fallback.style.top = `${this.centerY}px`;
    this.fallbackOrbits.style.cssText = `width:${(this.discPixels * 5.33) / 5.2}px;left:${this.centerX}px;top:${this.centerY}px`;
  }

  async setGalaxy(g: Galaxy) {
    const token = ++this.changeToken;
    this.galaxy = g;
    this.reset(true);
    this.fallback.src = imagePath(g);
    this.host.classList.remove("webgl-ready");
    this.hasTexture = false;
    this.volume.visible = false;
    if (!this.renderer) {
      this.events.ready(false);
      return;
    }
    let promise = this.textures.get(g.id);
    if (!promise) {
      promise = new THREE.TextureLoader().loadAsync(imagePath(g));
      this.textures.set(g.id, promise);
    }
    try {
      const tex = await promise;
      if (token !== this.changeToken) return;
      tex.anisotropy = Math.min(
        this.renderer.capabilities.getMaxAnisotropy(),
        8,
      );
      this.disposeVolume();
      this.makeVolume(tex);
      this.makeStellarPopulation(
        tex.image as HTMLImageElement,
        Number(g.number) * 229,
      );
      this.volume.visible = true;
      this.hasTexture = true;
      this.frameScene(0);
      this.host.classList.add("webgl-ready");
      this.events.ready(true);
    } catch {
      this.textures.delete(g.id);
      if (token === this.changeToken) this.events.ready(false);
    }
  }

  private makeVolume(texture: THREE.Texture) {
    // Each slice has an arm-dependent warp and a thicker central bulge, rather than a flat billboard.
    const slices = [-0.22, -0.095, 0, 0.095, 0.22];
    const weights = [0.0225, 0.08, 0.795, 0.08, 0.0225];
    slices.forEach((depth, i) => {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTexture: { value: texture },
          uDepth: { value: depth },
          uLight: { value: 1 },
          uWeight: { value: weights[i] },
        },
        vertexShader: `varying vec2 vUv; uniform float uDepth;
          void main(){vUv=uv; vec3 p=position; float r=length(p.xy);
          p.z += uDepth*(0.35+2.15*exp(-r*r/1.24)) + 0.028*sin(p.x*1.8+p.y)*smoothstep(0.7,3.2,r);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
        fragmentShader: `varying vec2 vUv; uniform sampler2D uTexture; uniform float uLight; uniform float uWeight;
          void main(){vec3 c=texture2D(uTexture,vUv).rgb; gl_FragColor=vec4(c*uLight,uWeight);}`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        forceSinglePass: true,
      });
      this.volumeMaterials.push(material);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(10.4, 10.4, 48, 48),
        material,
      );
      plane.renderOrder = 1;
      this.volume.add(plane);
    });
  }

  private makeStellarPopulation(image: HTMLImageElement, seed: number) {
    const samplingCanvas = document.createElement("canvas");
    samplingCanvas.width = samplingCanvas.height = 512;
    const ctx = samplingCanvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0, 512, 512);
    const pixels = ctx.getImageData(0, 0, 512, 512).data;
    const random = randomSeed(seed);
    const count = this.width < 680 ? 16000 : 34000;
    const pos = new Float32Array(count * 3),
      color = new Float32Array(count * 3),
      size = new Float32Array(count),
      phase = new Float32Array(count);
    let n = 0;
    while (n < count) {
      const u = random(),
        v = random();
      const offset = (((v * 512) | 0) * 512 + ((u * 512) | 0)) * 4;
      const r = pixels[offset] / 255,
        g = pixels[offset + 1] / 255,
        b = pixels[offset + 2] / 255;
      const brightness = 0.28 * r + 0.5 * g + 0.22 * b;
      if (random() > brightness ** 1.32 * 0.94 + 0.001) continue;
      const x = (u - 0.5) * 10.4,
        y = (0.5 - v) * 10.4,
        radius = Math.hypot(x, y);
      const gaussian =
        Math.sqrt(-2 * Math.log(Math.max(0.000001, random()))) *
        Math.cos(TAU * random());
      const z =
        gaussian *
        (0.055 +
          0.32 * Math.exp((-radius * radius) / 1.25) +
          0.06 * (1 - brightness));
      pos.set([x, y, z], n * 3);
      const intensity = (0.6 + random() * 0.5) / (0.28 + Math.max(r, g, b));
      color.set(
        [
          (r * 0.9 + 0.1) * intensity,
          (g * 0.9 + 0.1) * intensity,
          (b * 0.93 + 0.09) * intensity,
        ],
        n * 3,
      );
      size[n] =
        n % 911 === 0 && radius > 1.2
          ? 6.5 + random() * 4.5
          : 0.36 + Math.pow(random(), 4.2) * 1.5;
      phase[n] = random() * TAU;
      n++;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
        uLight: { value: 1 },
      },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aPhase; varying vec3 vColor; varying float vPhase; varying float vGlint; uniform float uScale;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vColor=aColor;vPhase=aPhase;vGlint=step(3.0,aSize);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uScale*18.0/(-mv.z),0.65,12.0);}`,
      fragmentShader: `varying vec3 vColor; varying float vPhase;varying float vGlint;uniform float uTime;uniform float uLight;
        void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;
        float twinkle=.86+.14*sin(vPhase+uTime*.72);float a=exp(-4.1*r)*.54;
        if(vGlint>0.5){vec2 q=mat2(.985,-.173,.173,.985)*p;
        a=exp(-59.0*r)+.12*exp(-5.0*r)+.5*exp(-abs(q.x)*33.0-abs(q.y)*4.4)+.5*exp(-abs(q.y)*33.0-abs(q.x)*4.4);}
        gl_FragColor=vec4(mix(vColor,vec3(.92,.94,1.0),vGlint*.65)*uLight,a*twinkle);}`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const stars = new THREE.Points(geometry, this.starMaterial);
    stars.renderOrder = 2;
    this.volume.add(stars);
  }

  private makeStarField() {
    const random = randomSeed(18841),
      count = 2550;
    const positions: number[] = [],
      colors: number[] = [],
      sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      positions.push(
        (random() - 0.5) * 62,
        (random() - 0.5) * 26,
        -random() * 32 - 1,
      );
      const l = i % 83 === 0 ? 1.0 : 0.26 + random() ** 2 * 0.62,
        warm = random() > 0.8;
      colors.push(
        l * (warm ? 1 : 0.72),
        l * (warm ? 0.84 : 0.8),
        l * (warm ? 0.77 : 1),
      );
      sizes.push(
        i % 83 === 0 ? 7.5 + random() * 7 : 0.6 + random() ** 2.6 * 1.8,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uDpr: { value: this.renderer!.getPixelRatio() } },
      vertexShader:
        "attribute vec3 color;attribute float aSize;varying vec3 vColor;varying float vSpike;uniform float uDpr;void main(){vColor=color;vSpike=step(3.0,aSize);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uDpr;}",
      fragmentShader:
        "varying vec3 vColor;varying float vSpike;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;float a=(1.-r)*.86;if(vSpike>.5){a=exp(-55.*r)+.15*exp(-4.*r)+.45*exp(-abs(p.x)*38.-abs(p.y)*3.7)+.45*exp(-abs(p.y)*38.-abs(p.x)*3.7);}gl_FragColor=vec4(vColor,a);}",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.field.add(new THREE.Points(geo, mat));
  }

  private makeGuides() {
    const ring = (r: number, opacity: number, dashed: boolean) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 360; i++)
        points.push(
          new THREE.Vector3(
            r * Math.cos((i / 360) * TAU),
            r * Math.sin((i / 360) * TAU),
            -0.025,
          ),
        );
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const opts = {
        color: 0x91b7bd,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
      };
      const mat = dashed
        ? new THREE.LineDashedMaterial({
            ...opts,
            dashSize: 0.06,
            gapSize: 0.105,
          })
        : new THREE.LineBasicMaterial(opts);
      const line = new THREE.Line(geo, mat);
      if (dashed) line.computeLineDistances();
      this.reference.add(line);
    };
    ring(5.33, 0.3, false);
    ring(5.53, 0.25, true);
    const ticks: number[] = [];
    for (let i = 0; i < 150; i++) {
      const a = (i / 150) * TAU,
        r = 5.33,
        length = i % 5 ? 0.035 : 0.085;
      ticks.push(
        Math.cos(a) * r,
        Math.sin(a) * r,
        0,
        Math.cos(a) * (r + length),
        Math.sin(a) * (r + length),
        0,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(ticks, 3));
    this.reference.add(
      new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x9ed7d8,
          transparent: true,
          opacity: 0.27,
          depthWrite: false,
        }),
      ),
    );
  }

  private disposeVolume() {
    this.volume.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.volume.clear();
    this.volumeMaterials = [];
    this.starMaterial = undefined;
  }

  setMode(mode: "orbit" | "top") {
    this.mode = mode;
    this.targetTilt = mode === "top" ? 0.015 : this.galaxy.tilt;
    this.targetRoll = mode === "top" ? 0 : this.galaxy.roll;
    this.events.mode(mode);
  }
  setZoom(value: number) {
    this.targetZoom = clamp(Math.round(value * 100) / 100, 0.55, 2.0);
    this.events.zoom(this.targetZoom);
  }
  zoomBy(amount: number) {
    this.setZoom(this.targetZoom + amount);
  }
  reset(immediate = false) {
    this.setMode("orbit");
    this.setZoom(1);
    this.targetAngle = 0;
    if (immediate) {
      this.tilt = this.targetTilt;
      this.roll = this.targetRoll;
      this.angle = 0;
      this.zoom = 1;
    }
  }
  private bindPointer() {
    const gap = () => {
      const p = [...this.points.values()];
      return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    };
    this.host.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      this.host.setPointerCapture(e.pointerId);
      this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pinchDistance = gap();
      this.host.classList.add("grabbing");
    });
    this.host.addEventListener("pointermove", (e) => {
      const p = this.points.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.points.size >= 2) {
        const dist = gap();
        if (this.pinchDistance > 0)
          this.setZoom((this.targetZoom * dist) / this.pinchDistance);
        this.pinchDistance = dist;
      } else {
        this.targetAngle -= dx * 0.005;
        this.targetTilt = clamp(this.targetTilt + dy * 0.006, -1.48, 1.48);
        if (this.mode === "top" && Math.abs(dy) > 0) {
          this.mode = "orbit";
          this.events.mode("orbit");
        }
      }
    });
    const release = (e: PointerEvent) => {
      this.points.delete(e.pointerId);
      this.pinchDistance = gap();
      if (!this.points.size) this.host.classList.remove("grabbing");
    };
    this.host.addEventListener("pointerup", release);
    this.host.addEventListener("pointercancel", release);
    this.host.addEventListener("lostpointercapture", release);
    this.host.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.setZoom(
          this.targetZoom *
            Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.035 : 0.00135)),
        );
      },
      { passive: false },
    );
    this.host.addEventListener("dblclick", () => this.reset());
  }

  private frame = (time: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const delta = Math.min((time - (this.lastTime || time)) / 1000, 0.05);
    this.lastTime = time;
    if (document.hidden || this.suspended) return;
    this.clock += delta;
    this.frameScene(delta);
  };
  private frameScene(delta: number) {
    if (this.settings.auto && !this.points.size)
      this.targetAngle += delta * this.settings.speed * 0.045;
    this.tilt = ease(this.tilt, this.targetTilt, delta);
    this.roll = ease(this.roll, this.targetRoll, delta);
    this.angle = ease(this.angle, this.targetAngle, delta);
    this.zoom = ease(this.zoom, this.targetZoom, delta);
    this.inclinedFrame.rotation.x = -this.tilt;
    this.inclinedFrame.rotation.z = this.roll;
    this.disk.rotation.z = this.angle;
    this.reference.visible = this.settings.guides;
    this.field.rotation.z = Math.sin(this.angle) * 0.023;
    this.field.rotation.x = (this.tilt - this.galaxy.tilt) * 0.045;
    if (this.camera.zoom !== this.zoom) {
      this.camera.zoom = this.zoom;
      this.camera.updateProjectionMatrix();
    }
    const light = (this.settings.light / 100) * 1.3175;
    this.volumeMaterials.forEach((m) => {
      m.uniforms.uLight.value = light;
    });
    if (this.starMaterial) {
      this.starMaterial.uniforms.uTime.value = this.clock;
      this.starMaterial.uniforms.uScale.value =
        (this.renderer?.getPixelRatio() || 1) *
        this.zoom *
        (this.discPixels / 835);
      this.starMaterial.uniforms.uLight.value = light;
    }
    if (this.renderer && !this.lostContext && this.hasTexture)
      this.renderer.render(this.scene, this.camera);
    else {
      this.inclinedFrame.updateMatrixWorld(true);
      const projection = `translate(-50%,-50%) scale(${this.zoom}) perspective(${(this.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(11))}px) rotateZ(${-this.roll}rad) rotateX(${this.tilt}rad)`;
      this.fallback.style.transform = `${projection} rotateZ(${-this.angle}rad)`;
      this.fallbackOrbits.style.transform = projection;
      this.fallbackOrbits.hidden = !this.settings.guides;
      this.fallback.style.filter = `brightness(${light})`;
    }
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      this.vector.fromArray(this.galaxy.marks[i].position);
      this.disk.localToWorld(this.vector);
      this.vector.project(this.camera);
      const x = ((this.vector.x + 1) / 2) * this.width,
        y = ((-this.vector.y + 1) / 2) * this.height;
      m.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      m.hidden =
        !this.settings.marks ||
        x < 12 ||
        x > this.width - 38 ||
        y < 16 ||
        y > this.height - 35;
    }
    if (this.axis) {
      const axes = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      axes.forEach((axis, i) => {
        this.vector
          .fromArray(axis)
          .applyQuaternion(this.axisBasis)
          .applyQuaternion(this.disk.quaternion)
          .applyQuaternion(this.inclinedFrame.quaternion);
        const x = 30 + this.vector.x * 19,
          y = 27 - this.vector.y * 19;
        const line = this.axis!.children[i * 2],
          text = this.axis!.children[i * 2 + 1];
        line.setAttribute("x2", String(x));
        line.setAttribute("y2", String(y));
        text.setAttribute("x", String(x + (this.vector.x < -0.3 ? -7 : 3)));
        text.setAttribute("y", String(y + (this.vector.y < -0.3 ? 7 : -2)));
      });
    }
  }

  async saveImage() {
    const output = document.createElement("canvas");
    const scale = Math.min(2, 2200 / this.width);
    output.width = Math.round(this.width * scale);
    output.height = Math.round(this.height * scale);
    const ctx = output.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#060a15";
    ctx.fillRect(0, 0, this.width, this.height);
    const bg = new Image();
    bg.src = "/assets/deep-field.webp";
    await bg.decode();
    const cover = Math.max(this.width / bg.width, this.height / bg.height);
    ctx.drawImage(
      bg,
      (this.width - bg.width * cover) / 2,
      (this.height - bg.height * cover) / 2,
      bg.width * cover,
      bg.height * cover,
    );
    ctx.globalCompositeOperation = "screen";
    if (this.renderer && !this.lostContext && this.hasTexture) {
      this.renderer.render(this.scene, this.camera);
      ctx.drawImage(this.canvas, 0, 0, this.width, this.height);
    } else {
      await this.fallback.decode();
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.rotate(-this.roll);
      ctx.scale(this.zoom, this.zoom * Math.cos(this.tilt));
      ctx.rotate(-this.angle);
      ctx.filter = `brightness(${(this.settings.light / 100) * 1.3175})`;
      ctx.drawImage(
        this.fallback,
        -this.discPixels / 2,
        -this.discPixels / 2,
        this.discPixels,
        this.discPixels,
      );
      if (this.settings.guides) {
        ctx.filter = "none";
        ctx.strokeStyle = "#9dbece55";
        ctx.beginPath();
        ctx.arc(0, 0, (this.discPixels * 5.33) / 10.4, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, (this.discPixels * 5.53) / 10.4, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#7de2d4";
    ctx.font = '10px "Plex Mono", monospace';
    ctx.fillText(
      `ASTRA OBSERVATORY   /   OBJECT 0${this.galaxy.number}`,
      28,
      35,
    );
    ctx.font = '38px "Space Grotesk", sans-serif';
    ctx.fillStyle = "#f3f5f9";
    ctx.fillText(this.galaxy.en, 26, 84);
    ctx.font = '10px "Plex Mono", monospace';
    ctx.fillStyle = "#9daab9";
    ctx.fillText(
      `RA ${this.galaxy.ra}    DEC ${this.galaxy.dec}`,
      28,
      this.height - 26,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Image export unavailable");
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `ASTRA-${this.galaxy.id}-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  dispose() {
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.disposeVolume();
    this.textures.forEach(
      (p) => void p.then((t) => t.dispose()).catch(() => {}),
    );
    this.renderer?.dispose();
  }
}
