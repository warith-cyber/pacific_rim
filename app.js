import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const PARTS = [
  {
    id: "overview",
    code: "SYS-00",
    name: "Gipsy Danger",
    level: "MARK-III // FULL FRAME",
    description:
      "Explore the extracted Gipsy Danger frame. Drag to rotate, scroll or pinch to zoom, and select a visible component to isolate its system.",
    statLabel: "DISPLAY SCALE",
    stat: "14.50 M",
    focusLabel: "FRAME STATUS",
    focus: "ONLINE",
    yaw: 18,
    elevation: 8,
    padding: 1.12,
  },
  {
    id: "head",
    code: "CMD-01",
    name: "Conn-Pod",
    level: "HEAD // COMMAND SYSTEM",
    description:
      "The armoured Conn-Pod combines Gipsy Danger's illuminated visor, reinforced helmet shell and protected neural command interface.",
    statLabel: "SYSTEM STATUS",
    stat: "ONLINE",
    focusLabel: "PRIMARY ROLE",
    focus: "COMMAND",
    yaw: 8,
    elevation: 2,
    padding: 1.28,
  },
  {
    id: "chest",
    code: "PWR-02",
    name: "Vortex Turbine",
    level: "CENTRAL FRAME // POWER",
    description:
      "Layered chest armour surrounds the circular nuclear vortex turbine, abdominal frame and central power-transfer structure.",
    statLabel: "CORE STATUS",
    stat: "STABLE",
    focusLabel: "PRIMARY ROLE",
    focus: "POWER",
    yaw: 8,
    elevation: 0,
    padding: 1.18,
  },
  {
    id: "shoulders",
    code: "TRB-03",
    name: "Shoulder Armour",
    level: "UPPER FRAME // ARMOUR",
    description:
      "Numbered shoulder plates, heavy clavicle armour and raised rear fins establish Gipsy Danger's broad Mark-III silhouette.",
    statLabel: "SYSTEM STATUS",
    stat: "LOCKED",
    focusLabel: "VIEW VECTOR",
    focus: "REAR 3/4",
    yaw: 154,
    elevation: 8,
    padding: 1.2,
  },
  {
    id: "arms",
    code: "WPN-04",
    name: "Arms & Weapons",
    level: "ARM SYSTEM // COMBAT",
    description:
      "Click either hand on the live model: the left deploys the chain sword; the right fully converts into the plasma cannon, charges and fires an electric blast while Combat Idle continues.",
    statLabel: "WEAPON LOADOUT",
    stat: "SWORD + PLASMA",
    focusLabel: "PRIMARY ROLE",
    focus: "STRIKE",
    yaw: 20,
    elevation: 0,
    padding: 1.16,
  },
  {
    id: "legs",
    code: "DRV-05",
    name: "Leg Drive",
    level: "LOWER FRAME // KINETIC",
    description:
      "Independent hip, thigh, knee and ankle assemblies carry the Mark-III frame through a wide, heavily armoured stance.",
    statLabel: "SYSTEM STATUS",
    stat: "READY",
    focusLabel: "PRIMARY ROLE",
    focus: "MOBILITY",
    yaw: 8,
    elevation: -4,
    padding: 1.14,
  },
  {
    id: "back",
    code: "RCT-06",
    name: "Rear Frame",
    level: "REAR FRAME // STRUCTURE",
    description:
      "Rear-facing spinal armour, turbine housing, shoulder fins and layered mechanical panels protect the Jaeger's power train.",
    statLabel: "SYSTEM STATUS",
    stat: "SEALED",
    focusLabel: "VIEW VECTOR",
    focus: "REAR",
    yaw: 180,
    elevation: 5,
    padding: 1.12,
  },
];

const GROUP_RULES = [
  {
    part: 1,
    match:
      /\b(?:conn pod|face mask|helmet|head sensor|sensor glow|visor|neck|chin guard)\b/,
  },
  {
    part: 3,
    match:
      /\bshoulder\b/,
  },
  {
    part: 4,
    match:
      /\b(?:arm cable|arm panel|cannon|chain sword|elbow|finger|forearm|hand|palm|plasma|spinning blade|sword|thumb|upper arm|upperarm|wrist)\b/,
  },
  {
    part: 5,
    match:
      /\b(?:ankle|calf|foot|heel|hip|knee|shin|thigh|toe)\b/,
  },
  {
    part: 6,
    match:
      /\b(?:backpack|dorsal|rear|scapula|reactor|spine)\b/,
  },
  {
    part: 2,
    match:
      /\b(?:abdomen|body|chest|collar|gold|pelvis|pectoral|pinggang|sternum|torso|turbine|waist)\b/,
  },
];

const SYSTEM_PART_INDEX = Object.freeze({
  head: 1,
  chest: 2,
  shoulders: 3,
  arms: 4,
  legs: 5,
  back: 6,
});

const canvas = document.querySelector("#jaegerCanvas");
const showcase = document.querySelector("#showcase");
const loaderElement = document.querySelector("#loader");
const loadBar = document.querySelector("#loadBar");
const loadPercent = document.querySelector("#loadPercent");
const modelError = document.querySelector("#modelError");
const rotationToggle = document.querySelector("#rotationToggle");
const resetViewButton = document.querySelector("#resetView");
const prevPartButton = document.querySelector("#prevPart");
const nextPartButton = document.querySelector("#nextPart");
const replayPowerUpButton = document.querySelector("#replayPowerUp");
const skipPowerUpButton = document.querySelector("#skipPowerUp");
const powerUpHud = document.querySelector("#powerUpHud");
const powerUpMode = document.querySelector("#powerUpMode");
const powerUpMeter = document.querySelector("#powerUpMeter");
const powerUpPhase = document.querySelector("#powerUpPhase");
const powerUpAnnouncement = document.querySelector("#powerUpAnnouncement");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let prefersReducedMotion = motionQuery.matches;
const debugHitAreas = new URLSearchParams(window.location.search).has(
  "debug-hit-areas",
);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: "high-performance",
  stencil: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, window.innerWidth <= 860 ? 1.5 : 1.9),
);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05090c, 34, 88);

const camera = new THREE.PerspectiveCamera(
  34,
  window.innerWidth / window.innerHeight,
  0.05,
  180,
);
camera.position.set(8, 8, 25);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 2.4;
controls.maxDistance = 58;
controls.minPolarAngle = THREE.MathUtils.degToRad(22);
controls.maxPolarAngle = THREE.MathUtils.degToRad(132);
controls.target.set(0, 6.4, 0);
controls.autoRotate = !prefersReducedMotion;
controls.autoRotateSpeed = 0.42;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const targetGoal = new THREE.Vector3(0, 6.4, 0);
const cameraGoal = new THREE.Vector3(8, 8, 25);
const selectionLightGoal = new THREE.Vector3(0, 7, 3);

let model = null;
let fullModelBox = null;
let index = 0;
let modelReady = false;
let cameraTransition = true;
let autoRotateEnabled = !prefersReducedMotion;
let sunAngle = 0.72;
let sunVelocity = 0.095;
let sunImpulse = 0;
let elapsed = 0;
let pointerDown = null;
let frameCounter = 0;
let mixer = null;
let combatClips = null;
let combatIdleAction = null;
let activeBodyAction = null;
let sequenceStageAction = null;
let sequenceStageKey = "";
let sequenceStageStart = 0;
let sequenceStageDuration = 1;
let sequenceStageBase = 0;
let sequenceStageSpan = 0;
let sequenceRunId = 0;
let weaponRunId = 0;
let weaponState = "ready";
let smokeBurstStart = Number.NEGATIVE_INFINITY;
let reactorPowerLevel = 0;
let reactorPowerTarget = 0;
let powerState = "unavailable";
let reactorAnchor = null;
let steamLeftAnchor = null;
let steamRightAnchor = null;
let reactorGlow = null;
let reactorHalo = null;
let steam = null;
let plasmaFx = null;
let plasmaCannonDeployed = false;
let powerPhaseName = "";
let loaderStartFallback = null;
const animationFinishers = new Map();
const activeWeaponActions = new Set();

const STARTUP_TURBINE_SECONDS = 1.65;
const STARTUP_SMOKE_SECONDS = 1.05;
const PLASMA_CHARGE_SECONDS = 1.05;
const PLASMA_BLAST_SECONDS = 0.72;
const COMBAT_CLIP_NAMES = Object.freeze({
  turbine: "Turbine Powerup",
  idle: "Combat Idle",
  leftHook: "Combat Attack2",
  rightHook: "Combat Attack1",
  chainDeploy: "Init_ChainSword",
  plasmaDeploy: "Init_PlasmaCannon",
  plasmaCharge: "Charging_PlasmaCannon",
});
const reactorWorldPosition = new THREE.Vector3(0, 9.8, 2.2);
const reactorLightPosition = new THREE.Vector3();

const allMeshes = [];
const raycastMeshes = [];
const partMeshes = PARTS.map(() => []);
const partBoxes = PARTS.map(() => new THREE.Box3());
const highlightedOverlays = [];
const NOMINAL_PART_BOUNDS = [
  [[-5.2, 0, -3.1], [5.2, 14.5, 3.1]],
  [[-1.8, 11.1, -1.8], [1.8, 14.5, 2.1]],
  [[-3.25, 7.35, -2.5], [3.25, 12.45, 2.65]],
  [[-4.75, 9.55, -2.7], [4.75, 13.5, 2.3]],
  [[-5.45, 4.6, -2.5], [5.45, 12.35, 2.7]],
  [[-3.1, 0, -2.25], [3.1, 8.4, 2.25]],
  [[-4.35, 5.7, -3.15], [4.35, 13.65, 1.0]],
];

const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0xffc56a,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  toneMapped: false,
  blending: THREE.NormalBlending,
});

const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 6.5, 0);
scene.add(lightTarget);

scene.add(new THREE.HemisphereLight(0xbfe7ef, 0x030506, 1.55));

const keyLight = new THREE.DirectionalLight(0xeafaff, 4.5);
keyLight.position.set(18, 18, 18);
keyLight.target = lightTarget;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x43cce5, 3.8);
rimLight.position.set(-14, 10, -12);
rimLight.target = lightTarget;
scene.add(rimLight);

const warmLight = new THREE.PointLight(0xff8b44, 32, 28, 1.6);
warmLight.position.set(8, 8, 8);
scene.add(warmLight);

const reactorBounce = new THREE.PointLight(0x1adcf0, 0, 22, 1.8);
reactorBounce.position.set(0, 8.4, 4.8);
scene.add(reactorBounce);

const selectionLight = new THREE.PointLight(0xffb347, 0, 9, 1.7);
scene.add(selectionLight);

createStudioEnvironment();
createStage();
const dust = createDust();

const fields = {
  no: document.querySelector("#currentNo"),
  total: document.querySelector("#totalNo"),
  level: document.querySelector("#partLevel"),
  title: document.querySelector("#partTitle"),
  description: document.querySelector("#partDescription"),
  statLabel: document.querySelector("#statLabel"),
  stat: document.querySelector("#statValue"),
  focusLabel: document.querySelector("#focusLabel"),
  focus: document.querySelector("#focusValue"),
  control: document.querySelector("#controlTitle"),
};

fields.total.textContent = String(PARTS.length).padStart(2, "0");

const partList = document.querySelector("#partList");
PARTS.forEach((part, partIndex) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.part = String(partIndex);
  button.setAttribute("aria-label", `Inspect ${part.name}`);
  button.innerHTML = `
    <span class="part-index">${String(partIndex + 1).padStart(2, "0")}</span>
    <span class="part-name">${part.name}</span>
    <span class="part-code">${part.code}</span>
  `;
  button.addEventListener("click", () => selectPart(partIndex));
  partList.appendChild(button);
});

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPartForName(name) {
  const normalized = normalizeName(name);
  const rule = GROUP_RULES.find((entry) => entry.match.test(normalized));
  return rule ? rule.part : 0;
}

function findPartForObject(object) {
  const system = String(object.userData?.system || "").toLowerCase();
  return SYSTEM_PART_INDEX[system] || findPartForName(object.name);
}

function createStudioEnvironment() {
  const environmentScene = new THREE.Scene();
  environmentScene.background = new THREE.Color(0x050a0d);

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(34, 34, 34),
    new THREE.MeshBasicMaterial({
      color: 0x081116,
      side: THREE.BackSide,
    }),
  );
  environmentScene.add(room);

  const addPanel = (size, position, color) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    panel.position.set(...position);
    panel.lookAt(0, 5.5, 0);
    environmentScene.add(panel);
  };

  addPanel([4, 14], [-9, 7, 6], 0xc7f5ff);
  addPanel([5, 10], [9, 11, 2], 0x7faeb6);
  addPanel([7, 4], [0, 14, -9], 0x397d89);
  addPanel([3, 7], [-5, 3, -10], 0xff7a3d);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const renderTarget = pmrem.fromScene(environmentScene, 0.04);
  scene.environment = renderTarget.texture;
  pmrem.dispose();

  environmentScene.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
}

function createStage() {
  const stage = new THREE.Group();
  stage.name = "WEB_DISPLAY_STAGE";

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(6.25, 6.6, 0.34, 96),
    new THREE.MeshStandardMaterial({
      color: 0x111a1e,
      metalness: 0.92,
      roughness: 0.27,
      envMapIntensity: 1.4,
    }),
  );
  base.position.y = -0.22;
  stage.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(5.95, 6.12, 0.08, 96),
    new THREE.MeshStandardMaterial({
      color: 0x071014,
      metalness: 0.74,
      roughness: 0.34,
      envMapIntensity: 1.1,
    }),
  );
  top.position.y = -0.02;
  stage.add(top);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x72e8f4,
    transparent: true,
    opacity: 0.64,
    toneMapped: false,
  });

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.6, 0.035, 8, 144),
    ringMaterial,
  );
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = 0.035;
  stage.add(outerRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.8, 0.015, 6, 128),
    ringMaterial.clone(),
  );
  innerRing.material.opacity = 0.33;
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.038;
  stage.add(innerRing);

  const radial = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 5.25, 64, 1),
    new THREE.MeshBasicMaterial({
      color: 0x2d8e9c,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  radial.rotation.x = -Math.PI / 2;
  radial.position.y = 0.042;
  stage.add(radial);

  const grid = new THREE.GridHelper(42, 42, 0x306f78, 0x183b42);
  grid.position.y = -0.035;
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  grid.material.depthWrite = false;
  stage.add(grid);

  const shadowTexture = createShadowTexture();
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 5.6),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.045;
  stage.add(contactShadow);

  scene.add(stage);
}

function createShadowTexture() {
  const surface = document.createElement("canvas");
  surface.width = 256;
  surface.height = 256;
  const context = surface.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 126);
  gradient.addColorStop(0, "rgba(0,0,0,.92)");
  gradient.addColorStop(0.35, "rgba(0,0,0,.54)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createDust() {
  const count = window.innerWidth <= 860 ? 260 : 520;
  const positions = new Float32Array(count * 3);
  const random = seededRandom(508);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (random() - 0.5) * 34;
    positions[i * 3 + 1] = random() * 19;
    positions[i * 3 + 2] = (random() - 0.5) * 23;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x92cbd3,
      size: 0.025,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  points.name = "ATMOSPHERIC_PARTICLES";
  scene.add(points);
  return points;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function rebuildPartBoxes(recomputeSkinnedBounds = false) {
  if (!model) return;

  model.updateMatrixWorld(true);
  const updatedSkeletons = new Set();
  allMeshes.forEach((mesh) => {
    if (!mesh.isSkinnedMesh || updatedSkeletons.has(mesh.skeleton)) return;
    mesh.skeleton.update();
    updatedSkeletons.add(mesh.skeleton);
  });
  if (recomputeSkinnedBounds) {
    allMeshes.forEach((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      mesh.computeBoundingBox?.();
      mesh.computeBoundingSphere?.();
    });
  }

  fullModelBox = new THREE.Box3();
  allMeshes.forEach((mesh) => fullModelBox.expandByObject(mesh, true));
  partBoxes[0].copy(fullModelBox);
  for (let partIndex = 1; partIndex < PARTS.length; partIndex += 1) {
    const box = partBoxes[partIndex];
    box.makeEmpty();
    partMeshes[partIndex].forEach((mesh) => box.expandByObject(mesh, true));
  }

  const measuredSize = fullModelBox.getSize(new THREE.Vector3());
  if (
    fullModelBox.isEmpty() ||
    measuredSize.y < 8 ||
    measuredSize.y > 24 ||
    measuredSize.x < 3
  ) {
    NOMINAL_PART_BOUNDS.forEach(([minimum, maximum], partIndex) => {
      partBoxes[partIndex].set(
        new THREE.Vector3(...minimum),
        new THREE.Vector3(...maximum),
      );
    });
    fullModelBox = partBoxes[0].clone();
  }
}

function createGlowTexture(innerColor, middleColor) {
  const surface = document.createElement("canvas");
  surface.width = 256;
  surface.height = 256;
  const context = surface.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 3, 128, 128, 126);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.13, middleColor);
  gradient.addColorStop(0.43, "rgba(60,220,245,.22)");
  gradient.addColorStop(1, "rgba(20,150,190,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createReactorEffects() {
  const coreTexture = createGlowTexture(
    "rgba(255,255,244,1)",
    "rgba(255,181,72,.9)",
  );
  const haloTexture = createGlowTexture(
    "rgba(220,255,255,.82)",
    "rgba(48,224,246,.62)",
  );

  reactorHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      color: 0x65edff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  reactorHalo.name = "WEB_REACTOR_HALO";
  reactorHalo.scale.setScalar(2.35);
  reactorHalo.renderOrder = 11;
  scene.add(reactorHalo);

  reactorGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: coreTexture,
      color: 0xffcf74,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  reactorGlow.name = "WEB_REACTOR_CORE";
  reactorGlow.scale.setScalar(1.05);
  reactorGlow.renderOrder = 12;
  scene.add(reactorGlow);
}

function createSteamSystem() {
  const lowPowerDevice =
    (navigator.hardwareConcurrency || 8) <= 4 ||
    (navigator.deviceMemory || 8) <= 4;
  const maxParticles = lowPowerDevice ? 48 : window.innerWidth <= 860 ? 88 : 170;
  const positions = new Float32Array(maxParticles * 3);
  const alphas = new Float32Array(maxParticles);
  const sizes = new Float32Array(maxParticles);
  const ages = new Float32Array(maxParticles);
  const lives = new Float32Array(maxParticles);
  const velocities = new Float32Array(maxParticles * 3);
  const drift = new Float32Array(maxParticles);

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);
  const sizeAttribute = new THREE.BufferAttribute(sizes, 1);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  alphaAttribute.setUsage(THREE.DynamicDrawUsage);
  sizeAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("aAlpha", alphaAttribute);
  geometry.setAttribute("aSize", sizeAttribute);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColorLow: { value: new THREE.Color(0x7fc5cf) },
      uColorHigh: { value: new THREE.Color(0xe6fbff) },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      varying float vAlpha;
      varying float vHeight;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vAlpha = aAlpha;
        vHeight = clamp(aSize / 1.35, 0.0, 1.0);
        gl_PointSize = aSize * (285.0 / max(1.0, -viewPosition.z));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorLow;
      uniform vec3 uColorHigh;
      varying float vAlpha;
      varying float vHeight;
      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float radius = length(centered);
        float density = smoothstep(0.5, 0.08, radius);
        float softCore = smoothstep(0.38, 0.0, radius);
        vec3 color = mix(uColorLow, uColorHigh, softCore * 0.72 + vHeight * 0.18);
        gl_FragColor = vec4(color, density * vAlpha * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "REACTOR_STEAM";
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  const leftPosition = new THREE.Vector3();
  const rightPosition = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  let cursor = 0;
  let spawnAccumulator = 0;
  let random = seededRandom(1945);
  let activeCount = 0;

  const reset = () => {
    cursor = 0;
    spawnAccumulator = 0;
    activeCount = 0;
    random = seededRandom(1945);
    ages.fill(999);
    alphas.fill(0);
    sizes.fill(0);
    alphaAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
  };

  const spawnParticle = (origin, side) => {
    const particleIndex = cursor;
    const offset = particleIndex * 3;
    cursor = (cursor + 1) % maxParticles;

    positions[offset] = origin.x + (random() - 0.5) * 0.24;
    positions[offset + 1] = origin.y + (random() - 0.5) * 0.12;
    positions[offset + 2] = origin.z + (random() - 0.5) * 0.2;
    velocities[offset] = side * (0.32 + random() * 0.48);
    velocities[offset + 1] = 0.82 + random() * 0.86;
    velocities[offset + 2] = 0.55 + random() * 0.65;
    ages[particleIndex] = 0;
    lives[particleIndex] = 0.85 + random() * 0.9;
    sizes[particleIndex] = 1.35 + random() * 1.05;
    drift[particleIndex] = random() * Math.PI * 2;
  };

  const update = (delta, envelope) => {
    if (prefersReducedMotion) envelope = 0;

    const left =
      steamLeftAnchor?.getWorldPosition(leftPosition) ||
      leftPosition.set(0, 9.8, 2.2);
    const right =
      steamRightAnchor?.getWorldPosition(rightPosition) ||
      rightPosition.set(0, 9.8, 2.2);
    left.x -= 0.22;
    left.y += 0.06;
    left.z += 0.14;
    right.x += 0.22;
    right.y += 0.06;
    right.z += 0.14;
    cameraOffset
      .copy(camera.position)
      .sub(left)
      .normalize()
      .multiplyScalar(0.42);
    left.add(cameraOffset);
    right.add(cameraOffset);

    spawnAccumulator += delta * (window.innerWidth <= 860 ? 74 : 126) * envelope;
    while (spawnAccumulator >= 1) {
      const emitLeft = random() > 0.5;
      spawnParticle(emitLeft ? left : right, emitLeft ? -1 : 1);
      spawnAccumulator -= 1;
    }

    activeCount = 0;
    for (let particleIndex = 0; particleIndex < maxParticles; particleIndex += 1) {
      if (ages[particleIndex] > lives[particleIndex]) {
        alphas[particleIndex] = 0;
        continue;
      }

      const offset = particleIndex * 3;
      ages[particleIndex] += delta;
      const progress = ages[particleIndex] / lives[particleIndex];
      if (progress >= 1) {
        alphas[particleIndex] = 0;
        continue;
      }

      activeCount += 1;
      const drag = Math.pow(0.86, delta);
      velocities[offset] *= drag;
      velocities[offset + 1] =
        velocities[offset + 1] * drag + delta * 0.24;
      velocities[offset + 2] *= drag;
      positions[offset] +=
        velocities[offset] * delta +
        Math.sin(drift[particleIndex] + ages[particleIndex] * 4.2) *
          delta *
          0.08;
      positions[offset + 1] += velocities[offset + 1] * delta;
      positions[offset + 2] += velocities[offset + 2] * delta;

      const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.12);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.38, 1);
      alphas[particleIndex] = fadeIn * fadeOut;
      sizes[particleIndex] += delta * 0.4;
    }

    positionAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
  };

  reset();
  return {
    update,
    reset,
    hasActive: () => activeCount > 0,
  };
}

function createPlasmaCannonEffects(root) {
  const mobile = window.innerWidth <= 860;
  const bodyHand =
    root.getObjectByName("Hand004") ||
    root.getObjectByName("Hand_004") ||
    root.getObjectByName("Hand.004");
  const cannonClaw =
    root.getObjectByName("Hand005_1") ||
    root.getObjectByName("Hand_005_1") ||
    root.getObjectByName("Hand.005");
  const muzzleNode =
    root.getObjectByName("CannonNose_1") ||
    root.getObjectByName("CannonNose001") ||
    root.getObjectByName("CannonNose.001");
  const electricAnchor =
    root.getObjectByName("Electric_Effects_1") ||
    root.getObjectByName("ElectricEffects_1") ||
    muzzleNode;
  const rightHandAnchor =
    root.getObjectByName("ANCHOR_HAND_R") ||
    root.getObjectByName("HandR") ||
    root.getObjectByName("Hand.R");
  const rightForearm =
    root.getObjectByName("ForearmR") ||
    root.getObjectByName("Forearm.R");

  const collectMeshes = (object) => {
    const meshes = [];
    object?.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    return meshes;
  };
  const bodyHandMeshes = collectMeshes(bodyHand);
  const cannonClawMeshes = collectMeshes(cannonClaw);
  const bodyVisibility = new Map(
    bodyHandMeshes.map((mesh) => [mesh, mesh.visible]),
  );

  const setMeshVisibility = (meshes, visible, restoreOriginal = false) => {
    meshes.forEach((mesh) => {
      mesh.visible = restoreOriginal
        ? bodyVisibility.get(mesh) !== false
        : visible;
      mesh.userData.plasmaHidden = !mesh.visible;
    });
  };
  const hideInternalClaw = () => {
    cannonClawMeshes.forEach((mesh) => {
      mesh.visible = false;
      mesh.userData.plasmaHidden = true;
    });
  };
  hideInternalClaw();

  const glowTexture = createGlowTexture(
    "rgba(255,255,255,1)",
    "rgba(55,228,255,.98)",
  );
  const makeSprite = (color, renderOrder) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    sprite.renderOrder = renderOrder;
    scene.add(sprite);
    return sprite;
  };

  const muzzleHalo = makeSprite(0x36eaff, 34);
  const muzzleCore = makeSprite(0xf1ffff, 35);
  const impactHalo = makeSprite(0x21cfff, 38);
  const impactCore = makeSprite(0xffffff, 39);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0x40ddff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const beamCoreMaterial = beamMaterial.clone();
  beamCoreMaterial.color.setHex(0xf2ffff);
  const beamHalo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.1, 1, 14, 1, true),
    beamMaterial,
  );
  const beamCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.035, 1, 12, 1, true),
    beamCoreMaterial,
  );
  beamHalo.renderOrder = 35;
  beamCore.renderOrder = 36;
  beamHalo.visible = false;
  beamCore.visible = false;
  scene.add(beamHalo, beamCore);

  const shockMaterial = new THREE.MeshBasicMaterial({
    color: 0x63edff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const shockRing = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.045, 8, 56),
    shockMaterial,
  );
  shockRing.renderOrder = 38;
  shockRing.visible = false;
  scene.add(shockRing);

  const shockShellMaterial = shockMaterial.clone();
  shockShellMaterial.wireframe = true;
  const shockShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    shockShellMaterial,
  );
  shockShell.renderOrder = 37;
  shockShell.visible = false;
  scene.add(shockShell);

  const makeArcField = (arcCount, segmentCount, color, renderOrder) => {
    const positions = new Float32Array(arcCount * segmentCount * 2 * 3);
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", attribute);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = renderOrder;
    lines.visible = false;
    scene.add(lines);
    return {
      arcCount,
      segmentCount,
      positions,
      attribute,
      material,
      lines,
    };
  };
  const chargeArcs = makeArcField(mobile ? 4 : 7, 6, 0x72f3ff, 37);
  const impactArcs = makeArcField(mobile ? 5 : 9, 6, 0xb8fbff, 40);

  const sparkCount = mobile ? 34 : 68;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkVelocities = new Float32Array(sparkCount * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkAttribute = new THREE.BufferAttribute(sparkPositions, 3);
  sparkAttribute.setUsage(THREE.DynamicDrawUsage);
  sparkGeometry.setAttribute("position", sparkAttribute);
  const sparks = new THREE.Points(
    sparkGeometry,
    new THREE.PointsMaterial({
      color: 0xbaf8ff,
      size: mobile ? 0.105 : 0.09,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    }),
  );
  sparks.frustumCulled = false;
  sparks.renderOrder = 41;
  sparks.visible = false;
  scene.add(sparks);

  const muzzleLight = new THREE.PointLight(0x5aeaff, 0, 9, 1.55);
  const impactLight = new THREE.PointLight(0xc4fbff, 0, 13, 1.45);
  scene.add(muzzleLight, impactLight);

  const coreMeshes = [];
  ["PlasmaCore_1", "PlasmaCore_2_1"].forEach((name) => {
    root.getObjectByName(name)?.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
      object.material = materials;
      coreMeshes.push(object);
    });
  });

  const muzzle = new THREE.Vector3();
  const muzzleBase = new THREE.Vector3();
  const direction = new THREE.Vector3(0, 0, 1);
  const impact = new THREE.Vector3();
  const impactOrigin = new THREE.Vector3();
  const forearmPosition = new THREE.Vector3();
  const handPosition = new THREE.Vector3();
  const localForward = new THREE.Vector3(0, -1, 0);
  const basisA = new THREE.Vector3();
  const basisB = new THREE.Vector3();
  const referenceAxis = new THREE.Vector3();
  const previousPoint = new THREE.Vector3();
  const currentPoint = new THREE.Vector3();
  const centerPoint = new THREE.Vector3();
  const beamMidpoint = new THREE.Vector3();
  const beamDirection = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const random = seededRandom(1986);
  let mode = "idle";
  let modeStarted = 0;
  let modeDuration = 1;
  let deployed = false;
  let lastArcRefresh = Number.NEGATIVE_INFINITY;

  const updatePose = () => {
    if (muzzleNode) {
      muzzleNode.getWorldPosition(muzzleBase);
      muzzleNode.localToWorld(localForward.set(0, -1, 0));
      direction.copy(localForward).sub(muzzleBase).normalize();
      muzzle.copy(muzzleBase).addScaledVector(direction, 0.3);
      return true;
    }
    if (electricAnchor) {
      electricAnchor.getWorldPosition(muzzle);
    } else if (rightHandAnchor) {
      rightHandAnchor.getWorldPosition(muzzle);
    } else {
      return false;
    }
    if (rightForearm && rightHandAnchor) {
      rightForearm.getWorldPosition(forearmPosition);
      rightHandAnchor.getWorldPosition(handPosition);
      direction.copy(handPosition).sub(forearmPosition).normalize();
    } else {
      direction.set(0, 0, 1).applyQuaternion(root.quaternion).normalize();
    }
    muzzle.addScaledVector(direction, 0.3);
    return true;
  };

  const updateBasis = () => {
    referenceAxis.set(0, 1, 0);
    if (Math.abs(direction.dot(referenceAxis)) > 0.88) {
      referenceAxis.set(1, 0, 0);
    }
    basisA.crossVectors(direction, referenceAxis).normalize();
    basisB.crossVectors(direction, basisA).normalize();
  };

  const writePoint = (array, offset, point) => {
    array[offset] = point.x;
    array[offset + 1] = point.y;
    array[offset + 2] = point.z;
  };

  const updateChargeArcs = (strength) => {
    updateBasis();
    let offset = 0;
    for (let arc = 0; arc < chargeArcs.arcCount; arc += 1) {
      const phase = (arc / chargeArcs.arcCount) * Math.PI * 2;
      previousPoint
        .copy(muzzle)
        .addScaledVector(direction, -0.9)
        .addScaledVector(basisA, Math.cos(phase) * 0.22)
        .addScaledVector(basisB, Math.sin(phase) * 0.22);
      for (
        let segment = 1;
        segment <= chargeArcs.segmentCount;
        segment += 1
      ) {
        const progress = segment / chargeArcs.segmentCount;
        const angle =
          phase +
          progress * 4.4 +
          elapsed * (7.2 + arc * 0.23);
        const radius =
          (0.08 + (1 - progress) * 0.17) *
          (0.72 + Math.sin(elapsed * 21 + segment + arc) * 0.28);
        centerPoint
          .copy(muzzle)
          .addScaledVector(direction, -0.9 * (1 - progress));
        currentPoint
          .copy(centerPoint)
          .addScaledVector(basisA, Math.cos(angle) * radius * strength)
          .addScaledVector(basisB, Math.sin(angle) * radius * strength);
        writePoint(chargeArcs.positions, offset, previousPoint);
        writePoint(chargeArcs.positions, offset + 3, currentPoint);
        offset += 6;
        previousPoint.copy(currentPoint);
      }
    }
    chargeArcs.attribute.needsUpdate = true;
  };

  const updateImpactArcs = (strength) => {
    updateBasis();
    let offset = 0;
    for (let arc = 0; arc < impactArcs.arcCount; arc += 1) {
      const phase = (arc / impactArcs.arcCount) * Math.PI * 2;
      previousPoint.copy(impactOrigin);
      for (
        let segment = 1;
        segment <= impactArcs.segmentCount;
        segment += 1
      ) {
        const progress = segment / impactArcs.segmentCount;
        const length = (0.65 + (arc % 3) * 0.24) * progress * strength;
        const twist = phase + progress * 2.2 + elapsed * 8;
        currentPoint
          .copy(impactOrigin)
          .addScaledVector(basisA, Math.cos(phase) * length)
          .addScaledVector(basisB, Math.sin(phase) * length)
          .addScaledVector(
            direction,
            Math.sin(twist) * 0.24 * strength,
          )
          .addScaledVector(
            basisA,
            Math.sin(elapsed * 28 + arc + segment) * 0.075 * strength,
          );
        writePoint(impactArcs.positions, offset, previousPoint);
        writePoint(impactArcs.positions, offset + 3, currentPoint);
        offset += 6;
        previousPoint.copy(currentPoint);
      }
    }
    impactArcs.attribute.needsUpdate = true;
  };

  const placeBeam = (mesh, start, end) => {
    beamDirection.copy(end).sub(start);
    const length = beamDirection.length();
    if (length <= 0.001) return;
    beamDirection.normalize();
    beamMidpoint.copy(start).add(end).multiplyScalar(0.5);
    mesh.position.copy(beamMidpoint);
    mesh.quaternion.setFromUnitVectors(yAxis, beamDirection);
    mesh.scale.set(1, length, 1);
  };

  const setCoreIntensity = (strength) => {
    coreMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => {
        if (!material) return;
        if (material.emissive) material.emissive.setHex(0x20eaff);
        if ("emissiveIntensity" in material) {
          material.emissiveIntensity = 1.8 + strength * 7;
        }
      });
    });
  };

  const hideTransientEffects = () => {
    beamHalo.visible = false;
    beamCore.visible = false;
    shockRing.visible = false;
    shockShell.visible = false;
    chargeArcs.lines.visible = false;
    impactArcs.lines.visible = false;
    impactHalo.material.opacity = 0;
    impactCore.material.opacity = 0;
    sparks.visible = false;
    sparks.material.opacity = 0;
    muzzleLight.intensity = 0;
    impactLight.intensity = 0;
  };

  const setDeployed = (value) => {
    deployed = value;
    plasmaCannonDeployed = value;
    setMeshVisibility(bodyHandMeshes, !value, !value);
    hideInternalClaw();
    if (!value) {
      muzzleHalo.material.opacity = 0;
      muzzleCore.material.opacity = 0;
      hideTransientEffects();
      setCoreIntensity(0);
    }
  };

  const reset = () => {
    mode = "idle";
    modeStarted = elapsed;
    setDeployed(false);
  };

  const beginTransform = (duration) => {
    setDeployed(true);
    mode = "transform";
    modeStarted = elapsed;
    modeDuration = Math.max(duration, 0.001);
  };

  const beginCharge = (duration = PLASMA_CHARGE_SECONDS) => {
    setDeployed(true);
    mode = "charge";
    modeStarted = elapsed;
    modeDuration = Math.max(duration, 0.001);
  };

  const fire = () => {
    setDeployed(true);
    updatePose();
    mode = "blast";
    modeStarted = elapsed;
    modeDuration = PLASMA_BLAST_SECONDS;
    const distance = mobile ? 5.4 : 7.2;
    impactOrigin.copy(muzzle).addScaledVector(direction, distance);
    for (let index = 0; index < sparkCount; index += 1) {
      const offset = index * 3;
      const azimuth = random() * Math.PI * 2;
      const vertical = random() * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      const speed = 1.7 + random() * 3.9;
      sparkPositions[offset] = impactOrigin.x;
      sparkPositions[offset + 1] = impactOrigin.y;
      sparkPositions[offset + 2] = impactOrigin.z;
      sparkVelocities[offset] = Math.cos(azimuth) * radial * speed;
      sparkVelocities[offset + 1] = vertical * speed;
      sparkVelocities[offset + 2] = Math.sin(azimuth) * radial * speed;
    }
    sparkAttribute.needsUpdate = true;
  };

  const update = (delta) => {
    if (!deployed && mode === "idle") return;
    if (!updatePose()) return;

    const age = elapsed - modeStarted;
    const normalizedAge = THREE.MathUtils.clamp(age / modeDuration, 0, 1);
    const idlePulse = 0.72 + Math.sin(elapsed * 8.5) * 0.18;
    let chargeStrength = deployed ? 0.3 * idlePulse : 0;
    if (mode === "transform") {
      chargeStrength =
        THREE.MathUtils.smoothstep(normalizedAge, 0.05, 0.72) *
        (0.52 + Math.sin(elapsed * 17) * 0.16);
    } else if (mode === "charge") {
      chargeStrength =
        0.42 +
        THREE.MathUtils.smoothstep(normalizedAge, 0, 1) * 0.58;
    } else if (mode === "blast") {
      chargeStrength = Math.max(0.2, 1 - normalizedAge * 0.72);
    }

    muzzleHalo.position.copy(muzzle);
    muzzleCore.position.copy(muzzle);
    muzzleHalo.scale.setScalar(0.72 + chargeStrength * 1.15);
    muzzleCore.scale.setScalar(0.2 + chargeStrength * 0.42);
    muzzleHalo.material.opacity = deployed
      ? 0.12 + chargeStrength * 0.55
      : 0;
    muzzleCore.material.opacity = deployed
      ? 0.2 + chargeStrength * 0.7
      : 0;
    muzzleLight.position.copy(muzzle);
    muzzleLight.intensity = chargeStrength * 28;
    setCoreIntensity(chargeStrength);

    const idleElectric = deployed && mode === "idle";
    const refreshInterval = idleElectric
      ? mobile
        ? 1 / 12
        : 1 / 18
      : mobile
        ? 1 / 24
        : 1 / 45;
    if (
      (mode === "transform" || mode === "charge" || idleElectric) &&
      elapsed - lastArcRefresh >= refreshInterval
    ) {
      updateChargeArcs(Math.max(0.25, chargeStrength));
      lastArcRefresh = elapsed;
    }
    chargeArcs.lines.visible =
      mode === "transform" || mode === "charge" || idleElectric;
    chargeArcs.material.opacity = chargeArcs.lines.visible
      ? idleElectric
        ? 0.2 + chargeStrength * 0.25
        : 0.34 + chargeStrength * 0.62
      : 0;

    if (mode !== "blast") {
      beamHalo.visible = false;
      beamCore.visible = false;
      shockRing.visible = false;
      shockShell.visible = false;
      impactArcs.lines.visible = false;
      impactHalo.material.opacity = 0;
      impactCore.material.opacity = 0;
      sparks.visible = false;
      sparks.material.opacity = 0;
      impactLight.intensity = 0;
      return;
    }

    impact.copy(impactOrigin);
    const beamIn = THREE.MathUtils.smoothstep(age, 0, 0.09);
    const beamOut =
      1 - THREE.MathUtils.smoothstep(age, 0.28, PLASMA_BLAST_SECONDS);
    const beamStrength = beamIn * beamOut;
    placeBeam(beamHalo, muzzle, impact);
    placeBeam(beamCore, muzzle, impact);
    beamHalo.visible = beamStrength > 0.01;
    beamCore.visible = beamStrength > 0.01;
    beamHalo.material.opacity = beamStrength * 0.62;
    beamCore.material.opacity = beamStrength * 0.98;

    const explosionIn = THREE.MathUtils.smoothstep(age, 0.035, 0.13);
    const explosionOut =
      1 - THREE.MathUtils.smoothstep(age, 0.34, 0.92);
    const explosionStrength = explosionIn * explosionOut;
    impactHalo.position.copy(impact);
    impactCore.position.copy(impact);
    impactHalo.scale.setScalar(1.5 + normalizedAge * 3.8);
    impactCore.scale.setScalar(0.48 + normalizedAge * 1.35);
    impactHalo.material.opacity = explosionStrength * 0.88;
    impactCore.material.opacity = explosionStrength;

    shockRing.position.copy(impact);
    shockShell.position.copy(impact);
    shockRing.quaternion.setFromUnitVectors(zAxis, direction);
    shockRing.scale.setScalar(0.35 + normalizedAge * 2.6);
    shockShell.scale.setScalar(0.25 + normalizedAge * 1.85);
    shockRing.visible = explosionStrength > 0.01;
    shockShell.visible = explosionStrength > 0.01;
    shockRing.material.opacity = explosionStrength * 0.8;
    shockShell.material.opacity = explosionStrength * 0.42;

    if (elapsed - lastArcRefresh >= refreshInterval) {
      updateImpactArcs(0.45 + explosionStrength * 1.35);
      lastArcRefresh = elapsed;
    }
    impactArcs.lines.visible = explosionStrength > 0.01;
    impactArcs.material.opacity = explosionStrength * 0.92;

    sparks.visible = normalizedAge < 1;
    sparks.material.opacity = Math.max(0, 1 - normalizedAge) * 0.95;
    for (let index = 0; index < sparkCount; index += 1) {
      const offset = index * 3;
      sparkVelocities[offset] *= Math.pow(0.965, delta * 60);
      sparkVelocities[offset + 1] -= delta * 1.7;
      sparkVelocities[offset + 2] *= Math.pow(0.965, delta * 60);
      sparkPositions[offset] += sparkVelocities[offset] * delta;
      sparkPositions[offset + 1] += sparkVelocities[offset + 1] * delta;
      sparkPositions[offset + 2] += sparkVelocities[offset + 2] * delta;
    }
    sparkAttribute.needsUpdate = true;
    impactLight.position.copy(impact);
    impactLight.intensity = explosionStrength * 62;

    if (age > 1.05) {
      mode = "idle";
      hideTransientEffects();
    }
  };

  reset();
  return {
    beginTransform,
    beginCharge,
    fire,
    reset,
    setDeployed,
    update,
    hasActive: () => deployed || mode !== "idle",
    getBodyHandMeshes: () => bodyHandMeshes,
  };
}

function updateReactorPower(progress) {
  const power = THREE.MathUtils.smoothstep(progress, 0, 1);
  const pulse =
    power > 0.02 && !prefersReducedMotion
      ? 0.91 + Math.sin(elapsed * (5.2 + power * 7.4)) * 0.09
      : 1;

  if (reactorAnchor) reactorAnchor.getWorldPosition(reactorWorldPosition);
  reactorLightPosition.copy(reactorWorldPosition);
  reactorLightPosition.z += 1.8;
  reactorBounce.position.copy(reactorLightPosition);
  reactorBounce.intensity = power * 10 * pulse;

  if (reactorHalo && reactorGlow) {
    reactorHalo.position.copy(reactorWorldPosition);
    reactorGlow.position.copy(reactorWorldPosition);
    reactorHalo.material.opacity = power * (0.36 + pulse * 0.2);
    reactorGlow.material.opacity = power * (0.58 + pulse * 0.28);
    reactorHalo.scale.setScalar((1.55 + power * 1.05) * pulse);
    reactorGlow.scale.setScalar((0.58 + power * 0.58) * pulse);
  }
}

function reactorSmokeEnvelope() {
  const burstAge = elapsed - smokeBurstStart;
  if (burstAge < 0 || burstAge > 2.45) return 0;
  const rise = THREE.MathUtils.smoothstep(burstAge, 0, 0.16);
  const fall = 1 - THREE.MathUtils.smoothstep(burstAge, 0.78, 2.45);
  return rise * fall;
}

function announcePowerState(message) {
  powerUpAnnouncement.textContent = "";
  window.requestAnimationFrame(() => {
    powerUpAnnouncement.textContent = message;
  });
}

function setInterfaceLocked(locked) {
  document.querySelectorAll("#partList button").forEach((button) => {
    button.disabled = locked;
  });
  prevPartButton.disabled = locked;
  nextPartButton.disabled = locked;
  resetViewButton.disabled = locked;
  rotationToggle.disabled = locked;
  replayPowerUpButton.disabled = locked;
  controls.enabled = true;
}

function findAnimationClip(animations, requestedName) {
  const requested = normalizeName(requestedName);
  return (
    animations.find((clip) => normalizeName(clip.name) === requested) ||
    animations.find((clip) => normalizeName(clip.name).includes(requested)) ||
    null
  );
}

function cancelAnimationWaits() {
  [...animationFinishers.values()].forEach((finish) => finish(false));
  animationFinishers.clear();
}

function waitForAnimation(action) {
  return new Promise((resolve) => {
    const previous = animationFinishers.get(action);
    if (previous) previous(false);
    animationFinishers.set(action, resolve);
  });
}

function waitForSequenceDelay(milliseconds, runId) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(runId === sequenceRunId), milliseconds);
  });
}

function setSequenceStage(key, label, base, span, duration, action = null) {
  sequenceStageKey = key;
  sequenceStageStart = performance.now() * 0.001;
  sequenceStageDuration = Math.max(duration, 0.001);
  sequenceStageBase = base;
  sequenceStageSpan = span;
  sequenceStageAction = action;
  if (label !== powerPhaseName) {
    powerPhaseName = label;
    powerUpPhase.textContent = label;
  }
}

function sequenceStageProgress() {
  if (sequenceStageAction) {
    return THREE.MathUtils.clamp(
      sequenceStageAction.time / Math.max(sequenceStageAction.getClip().duration, 0.001),
      0,
      1,
    );
  }
  return THREE.MathUtils.clamp(
    (performance.now() * 0.001 - sequenceStageStart) / sequenceStageDuration,
    0,
    1,
  );
}

function updatePowerHud() {
  const progress = THREE.MathUtils.clamp(
    sequenceStageBase + sequenceStageProgress() * sequenceStageSpan,
    0,
    1,
  );
  powerUpMeter.style.width = `${Math.round(progress * 100)}%`;
}

function configureOneShot(action) {
  action.enabled = true;
  action.paused = false;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.reset();
  return action;
}

function startCombatIdle(fadeDuration = 0.22, staticPose = false) {
  if (!mixer || !combatClips?.idle) return;
  const previous = activeBodyAction;
  combatIdleAction = mixer.clipAction(combatClips.idle);
  combatIdleAction.enabled = true;
  combatIdleAction.paused = false;
  combatIdleAction.setEffectiveTimeScale(1);
  combatIdleAction.setEffectiveWeight(1);
  combatIdleAction.setLoop(THREE.LoopRepeat, Infinity);
  combatIdleAction.clampWhenFinished = false;
  combatIdleAction.reset().play();
  if (previous && previous !== combatIdleAction && fadeDuration > 0) {
    combatIdleAction.crossFadeFrom(previous, fadeDuration, true);
  }
  if (staticPose) {
    combatIdleAction.time = 0;
    mixer.update(0);
    combatIdleAction.paused = true;
  }
  activeBodyAction = combatIdleAction;
  sequenceStageAction = null;
}

async function playBodyClip(clip, runId, fadeDuration = 0.12) {
  if (!clip || runId !== sequenceRunId) return false;
  const previous = activeBodyAction;
  const action = configureOneShot(mixer.clipAction(clip));
  action.play();
  if (previous && previous !== action && fadeDuration > 0) {
    action.crossFadeFrom(previous, fadeDuration, true);
  }
  activeBodyAction = action;
  sequenceStageAction = action;
  const finished = await waitForAnimation(action);
  return finished && runId === sequenceRunId;
}

function setupPowerUp(gltf) {
  combatClips = {
    turbine: findAnimationClip(gltf.animations, COMBAT_CLIP_NAMES.turbine),
    idle: findAnimationClip(gltf.animations, COMBAT_CLIP_NAMES.idle),
    leftHook: findAnimationClip(gltf.animations, COMBAT_CLIP_NAMES.leftHook),
    rightHook: findAnimationClip(gltf.animations, COMBAT_CLIP_NAMES.rightHook),
    chainDeploy: findAnimationClip(
      gltf.animations,
      COMBAT_CLIP_NAMES.chainDeploy,
    ),
    chainDeployLeft: findAnimationClip(
      gltf.animations,
      `${COMBAT_CLIP_NAMES.chainDeploy}.L`,
    ),
    chainDeployRight: findAnimationClip(
      gltf.animations,
      `${COMBAT_CLIP_NAMES.chainDeploy}.R`,
    ),
    plasmaDeploy: findAnimationClip(
      gltf.animations,
      COMBAT_CLIP_NAMES.plasmaDeploy,
    ),
    plasmaDeployLeft: findAnimationClip(
      gltf.animations,
      `${COMBAT_CLIP_NAMES.plasmaDeploy}.L`,
    ),
    plasmaDeployRight: findAnimationClip(
      gltf.animations,
      `${COMBAT_CLIP_NAMES.plasmaDeploy}.R`,
    ),
    plasmaCharge: findAnimationClip(
      gltf.animations,
      COMBAT_CLIP_NAMES.plasmaCharge,
    ),
    plasmaChargeRight: findAnimationClip(
      gltf.animations,
      `${COMBAT_CLIP_NAMES.plasmaCharge}.R`,
    ),
  };

  if (!combatClips.idle) {
    powerState = "unavailable";
    replayPowerUpButton.hidden = true;
    return false;
  }

  mixer = new THREE.AnimationMixer(model);
  mixer.addEventListener("finished", (event) => {
    const finish = animationFinishers.get(event.action);
    if (!finish) return;
    animationFinishers.delete(event.action);
    finish(true);
  });
  powerState = "ready";
  replayPowerUpButton.hidden = prefersReducedMotion;
  return true;
}

function waitForGuardedDelay(milliseconds, isCurrent) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(isCurrent()), milliseconds);
  });
}

async function runRightPlasmaSequence({
  isCurrent,
  transformBase,
  transformSpan,
  chargeBase,
  chargeSpan,
  blastBase,
  blastSpan,
}) {
  const deployClip =
    combatClips?.plasmaDeployRight || combatClips?.plasmaDeploy;
  if (!deployClip || !isCurrent()) return false;

  clearHighlight();
  if (!plasmaCannonDeployed) {
    const deployAction = configureOneShot(mixer.clipAction(deployClip));
    activeWeaponActions.add(deployAction);
    plasmaFx?.beginTransform(deployClip.duration);
    setSequenceStage(
      "plasma-transform",
      "PLASMA CANNON TRANSFORMATION",
      transformBase,
      transformSpan,
      deployClip.duration,
      deployAction,
    );
    announcePowerState(
      "Right hand locked. Plasma cannon transformation initiated.",
    );
    deployAction.play();
    const deployed = await waitForAnimation(deployAction);
    activeWeaponActions.delete(deployAction);
    if (!deployed || !isCurrent()) return false;
  } else {
    plasmaFx?.setDeployed(true);
  }

  const chargeClip =
    combatClips?.plasmaChargeRight || combatClips?.plasmaCharge;
  let chargeAction = null;
  if (chargeClip) {
    chargeAction = mixer.clipAction(chargeClip);
    chargeAction.enabled = true;
    chargeAction.paused = false;
    chargeAction.setEffectiveTimeScale(1);
    chargeAction.setEffectiveWeight(1);
    chargeAction.setLoop(THREE.LoopRepeat, Infinity);
    chargeAction.clampWhenFinished = false;
    chargeAction.reset().play();
    activeWeaponActions.add(chargeAction);
  }
  plasmaFx?.beginCharge(PLASMA_CHARGE_SECONDS);
  setSequenceStage(
    "plasma-charge",
    "PLASMA CORE // ELECTRIC CHARGE",
    chargeBase,
    chargeSpan,
    PLASMA_CHARGE_SECONDS,
  );
  announcePowerState("Plasma cannon charged. Electrical field climbing.");
  const charged = await waitForGuardedDelay(
    PLASMA_CHARGE_SECONDS * 1000,
    isCurrent,
  );
  chargeAction?.stop();
  if (chargeAction) activeWeaponActions.delete(chargeAction);
  if (!charged || !isCurrent()) return false;

  plasmaFx?.fire();
  setSequenceStage(
    "plasma-blast",
    "ELECTRIC PLASMA DISCHARGE",
    blastBase,
    blastSpan,
    PLASMA_BLAST_SECONDS,
  );
  announcePowerState(
    "Plasma blast fired. Electric impact detonation confirmed.",
  );
  return waitForGuardedDelay(PLASMA_BLAST_SECONDS * 1000, isCurrent);
}

function sampleFinalPowerPose() {
  if (!mixer || !combatClips?.idle) return;
  sequenceRunId += 1;
  weaponRunId += 1;
  cancelAnimationWaits();
  mixer.stopAllAction();
  activeWeaponActions.clear();
  plasmaFx?.reset();
  startCombatIdle(0, prefersReducedMotion);
  powerState = "complete";
  weaponState = "ready";
  reactorPowerLevel = 1;
  reactorPowerTarget = 1;
  model.updateMatrixWorld(true);
  updateReactorPower(1);
  steam?.reset();
  rebuildPartBoxes(true);
}

async function playPowerUp() {
  if (!modelReady || !mixer || !combatClips?.idle || prefersReducedMotion) {
    return;
  }

  const runId = sequenceRunId + 1;
  sequenceRunId = runId;
  weaponRunId += 1;
  cancelAnimationWaits();
  activeWeaponActions.clear();
  mixer.stopAllAction();
  plasmaFx?.reset();
  startCombatIdle(0, true);
  if (powerState !== "playing") selectPart(0, true);
  clearHighlight();
  steam?.reset();
  smokeBurstStart = Number.NEGATIVE_INFINITY;

  powerState = "playing";
  weaponState = "ready";
  powerPhaseName = "";
  powerUpMode.textContent = "COMBAT STARTUP";
  autoRotateEnabled = false;
  controls.autoRotate = false;
  setInterfaceLocked(true);
  powerUpHud.hidden = false;
  skipPowerUpButton.hidden = false;
  skipPowerUpButton.disabled = false;
  reactorPowerLevel = 0;
  reactorPowerTarget = 0;
  let turbineAction = null;
  const turbineDuration =
    combatClips.turbine?.duration || STARTUP_TURBINE_SECONDS;
  if (combatClips.turbine) {
    turbineAction = configureOneShot(mixer.clipAction(combatClips.turbine));
    activeWeaponActions.add(turbineAction);
    turbineAction.play();
  }
  setSequenceStage(
    "turbine",
    "VORTEX TURBINE SPIN-UP",
    0,
    0.18,
    turbineDuration,
    turbineAction,
  );
  updatePowerHud();
  updateReactorPower(0);
  announcePowerState(
    "Vortex turbine ignition. Gipsy Danger combat sequence started.",
  );

  if (turbineAction) {
    const turbineFinished = await waitForAnimation(turbineAction);
    activeWeaponActions.delete(turbineAction);
    if (!turbineFinished || runId !== sequenceRunId) return;
  } else {
    if (!(await waitForSequenceDelay(turbineDuration * 1000, runId))) return;
  }

  combatIdleAction.paused = false;
  if (combatClips.leftHook) {
    setSequenceStage(
      "left-hook",
      "LEFT DOWN-HOOK",
      0.18,
      0.17,
      combatClips.leftHook.duration,
    );
    if (!(await playBodyClip(combatClips.leftHook, runId))) return;
  }

  if (combatClips.rightHook) {
    setSequenceStage(
      "right-hook",
      "RIGHT DOWN-HOOK",
      0.35,
      0.17,
      combatClips.rightHook.duration,
    );
    if (!(await playBodyClip(combatClips.rightHook, runId))) return;
  }

  startCombatIdle(0.18);
  const plasmaFired = await runRightPlasmaSequence({
    isCurrent: () => runId === sequenceRunId,
    transformBase: 0.52,
    transformSpan: 0.2,
    chargeBase: 0.72,
    chargeSpan: 0.12,
    blastBase: 0.84,
    blastSpan: 0.1,
  });
  if (!plasmaFired || runId !== sequenceRunId) return;

  smokeBurstStart = elapsed;
  setSequenceStage(
    "reactor-smoke",
    "REACTOR VENTING // COMBAT IDLE",
    0.94,
    0.06,
    STARTUP_SMOKE_SECONDS,
  );
  announcePowerState(
    "Plasma strike complete. Reactor venting and combat idle engaged.",
  );
  if (!(await waitForSequenceDelay(STARTUP_SMOKE_SECONDS * 1000, runId))) {
    return;
  }
  completePowerUp("completed");
}

function completePowerUp(reason = "completed", restoreFocus = false) {
  if (!mixer || !combatClips?.idle) return;
  powerState = "complete";
  reactorPowerTarget = 1;
  if (activeBodyAction !== combatIdleAction) startCombatIdle(0.22);
  powerUpHud.hidden = true;
  skipPowerUpButton.hidden = false;
  replayPowerUpButton.hidden = prefersReducedMotion;
  setInterfaceLocked(false);
  model.updateMatrixWorld(true);
  updateReactorPower(1);
  rebuildPartBoxes(true);
  showHighlight(index);
  framePart(index, true);

  autoRotateEnabled = index === 0 && !prefersReducedMotion;
  controls.autoRotate = autoRotateEnabled;
  updateRotationButton();
  announcePowerState(
    reason === "skipped"
      ? "Power-up skipped. Gipsy Danger is ready to fight."
      : "Power-up complete. Gipsy Danger is ready to fight.",
  );
  if (restoreFocus && !replayPowerUpButton.hidden) replayPowerUpButton.focus();
}

function skipPowerUp(restoreFocus = false) {
  if (powerState !== "playing" || !mixer || !combatClips?.idle) return;
  sequenceRunId += 1;
  cancelAnimationWaits();
  mixer.stopAllAction();
  plasmaFx?.reset();
  startCombatIdle(0, prefersReducedMotion);
  steam?.reset();
  smokeBurstStart = Number.NEGATIVE_INFINITY;
  reactorPowerLevel = 1;
  reactorPowerTarget = 1;
  completePowerUp("skipped", restoreFocus);
}

async function playWeaponDeployment(side) {
  if (
    !modelReady ||
    !mixer ||
    powerState === "playing" ||
    weaponState === "deploying"
  ) {
    return;
  }

  const isLeft = side === "left";
  powerUpMode.textContent = "WEAPON SYSTEM";
  if (!isLeft) {
    const runId = weaponRunId + 1;
    weaponRunId = runId;
    weaponState = "deploying";
    selectPart(SYSTEM_PART_INDEX.arms);
    clearHighlight();
    powerUpHud.hidden = false;
    skipPowerUpButton.hidden = true;

    const alreadyDeployed = plasmaCannonDeployed;
    const fired = await runRightPlasmaSequence({
      isCurrent: () => runId === weaponRunId && powerState !== "playing",
      transformBase: 0,
      transformSpan: alreadyDeployed ? 0 : 0.55,
      chargeBase: alreadyDeployed ? 0 : 0.55,
      chargeSpan: alreadyDeployed ? 0.56 : 0.25,
      blastBase: alreadyDeployed ? 0.56 : 0.8,
      blastSpan: alreadyDeployed ? 0.44 : 0.2,
    });
    if (!fired || runId !== weaponRunId) return;

    weaponState = "ready";
    powerUpHud.hidden = true;
    skipPowerUpButton.hidden = false;
    sequenceStageAction = null;
    model.updateMatrixWorld(true);
    rebuildPartBoxes(true);
    showHighlight(index);
    announcePowerState(
      "Plasma cannon deployed. Electric blast discharged; Combat Idle maintained.",
    );
    return;
  }

  const clip = isLeft
    ? combatClips?.chainDeployLeft || combatClips?.chainDeploy
    : null;
  const weaponName = "CHAIN SWORD";
  if (!clip) {
    announcePowerState(`${weaponName} deployment animation is unavailable.`);
    return;
  }

  const runId = weaponRunId + 1;
  weaponRunId = runId;
  weaponState = "deploying";
  selectPart(SYSTEM_PART_INDEX.arms);
  const action = configureOneShot(mixer.clipAction(clip));
  activeWeaponActions.add(action);
  action.play();
  setSequenceStage(
    "weapon-deploy",
    `${weaponName} DEPLOYMENT`,
    0,
    1,
    clip.duration,
    action,
  );
  powerUpHud.hidden = false;
  skipPowerUpButton.hidden = true;
  announcePowerState(`${weaponName} deployment started.`);

  const finished = await waitForAnimation(action);
  activeWeaponActions.delete(action);
  if (!finished || runId !== weaponRunId) return;
  weaponState = "ready";
  powerUpHud.hidden = true;
  skipPowerUpButton.hidden = false;
  sequenceStageAction = null;
  model.updateMatrixWorld(true);
  rebuildPartBoxes(true);
  showHighlight(index);
  announcePowerState(`${weaponName} deployed. Combat idle maintained.`);
}

function revealViewer(onRevealed) {
  let revealed = false;
  const finish = () => {
    if (revealed) return;
    revealed = true;
    window.clearTimeout(loaderStartFallback);
    loaderElement.removeEventListener("transitionend", onTransitionEnd);
    onRevealed?.();
  };
  const onTransitionEnd = (event) => {
    if (event.target === loaderElement && event.propertyName === "opacity") {
      finish();
    }
  };

  loaderElement.addEventListener("transitionend", onTransitionEnd);
  window.setTimeout(() => loaderElement.classList.add("done"), 320);
  loaderStartFallback = window.setTimeout(finish, 1550);
}

function normalizeModelForDisplay(root) {
  root.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(root);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  if (initialBox.isEmpty() || initialSize.y <= 0.001) return;

  const displayScale = 14.5 / initialSize.y;
  root.scale.multiplyScalar(displayScale);
  root.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(root);
  root.position.y -= scaledBox.min.y;
  root.updateMatrixWorld(true);
  root.userData.displayScale = displayScale;
}

function buildRuntimeReactorAnchor(root) {
  const existing = root.getObjectByName("FX_REACTOR_CORE");
  if (existing) return existing;

  const reactorBox = new THREE.Box3();
  allMeshes.forEach((mesh) => {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    if (
      materials.some((material) =>
        /reactor|turbine|spinning blade/i.test(
          `${material?.name || ""} ${mesh.name}`,
        ),
      )
    ) {
      reactorBox.expandByObject(mesh, true);
    }
  });

  const anchorPosition = reactorBox.isEmpty()
    ? new THREE.Vector3(0, 9.75, 2.25)
    : reactorBox.getCenter(new THREE.Vector3());
  const chestBone =
    root.getObjectByName("Chest") ||
    root.getObjectByName("Spine1") ||
    root;
  const anchor = new THREE.Object3D();
  anchor.name = "FX_REACTOR_CORE";
  anchor.position.copy(chestBone.worldToLocal(anchorPosition.clone()));
  chestBone.add(anchor);
  root.updateMatrixWorld(true);
  return anchor;
}

function buildHandHitProxy(root, side) {
  const anchor =
    root.getObjectByName(`ANCHOR_HAND_${side === "left" ? "L" : "R"}`) ||
    root.getObjectByName(`Hand.${side === "left" ? "L" : "R"}`);
  if (!anchor) return null;

  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff3158,
      transparent: true,
      opacity: debugHitAreas ? 0.34 : 0,
      depthWrite: false,
      colorWrite: debugHitAreas,
      toneMapped: false,
    }),
  );
  proxy.name = `HAND_HIT_${side.toUpperCase()}`;
  proxy.userData.hitRegion = "hand";
  proxy.userData.side = side;
  proxy.userData.interaction = "weapon-deployment";
  proxy.frustumCulled = false;
  anchor.add(proxy);
  anchor.updateWorldMatrix(true, false);
  const anchorScale = anchor.getWorldScale(new THREE.Vector3());
  const worldRadius = 0.72;
  proxy.scale.set(
    worldRadius / Math.max(Math.abs(anchorScale.x), 0.000001),
    worldRadius / Math.max(Math.abs(anchorScale.y), 0.000001),
    worldRadius / Math.max(Math.abs(anchorScale.z), 0.000001),
  );
  raycastMeshes.push(proxy);
  return proxy;
}

function prepareModel(gltf) {
  model = gltf.scene;
  model.name = "GIPSY_DANGER_UNITY_COMBAT_MODEL";

  scene.add(model);
  const sceneHelpers = [];
  model.traverse((object) => {
    if (/^Icosphere(?:\.\d+)?$/i.test(object.name)) sceneHelpers.push(object);
  });
  sceneHelpers.forEach((helper) => helper.parent?.remove(helper));
  normalizeModelForDisplay(model);

  const seenMaterials = new Set();
  model.traverse((object) => {
    if (!object.isMesh) return;

    allMeshes.push(object);
    raycastMeshes.push(object);
    partMeshes[0].push(object);

    const partIndex = findPartForObject(object);
    object.userData.partIndex = partIndex;
    if (partIndex > 0) partMeshes[partIndex].push(object);

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => {
      if (!material || seenMaterials.has(material)) return;
      seenMaterials.add(material);
      if ("envMapIntensity" in material) material.envMapIntensity = 2.05;
      if ("metalness" in material) {
        material.metalness = Math.max(material.metalness, 0.64);
        material.roughness = Math.min(material.roughness, 0.31);
      }
      if (/blue neon|bloomwhite|reactorvoxel/i.test(material.name)) {
        material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 2.6);
      }
      if (/gipsyeye/i.test(material.name)) {
        material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 2.2);
      }
      material.needsUpdate = true;
    });
  });

  rebuildPartBoxes(true);
  reactorAnchor = buildRuntimeReactorAnchor(model);
  steamLeftAnchor = reactorAnchor;
  steamRightAnchor = reactorAnchor;
  buildHandHitProxy(model, "left");
  buildHandHitProxy(model, "right");
  plasmaFx = createPlasmaCannonEffects(model);
  createReactorEffects();
  steam = createSteamSystem();
  const hasPowerUp = setupPowerUp(gltf);

  modelReady = true;
  showcase.classList.add("model-ready");
  modelError.classList.remove("visible");
  setLoadProgress(1);
  if (
    debugHitAreas ||
    new URLSearchParams(window.location.search).has("qa")
  ) {
    window.__JAEGER_QA__ = {
      model,
      camera,
      controls,
      raycastMeshes,
      combatClips,
      playWeaponDeployment,
    };
  }

  const requestedPart = Number(
    new URLSearchParams(window.location.search).get("part") || 0,
  );
  const validRequestedPart =
    Number.isInteger(requestedPart) &&
    requestedPart >= 0 &&
    requestedPart < PARTS.length
      ? requestedPart
      : 0;

  if (hasPowerUp && (prefersReducedMotion || validRequestedPart > 0)) {
    sampleFinalPowerPose();
    selectPart(validRequestedPart, true);
    revealViewer();
  } else {
    selectPart(validRequestedPart, true);
    if (!hasPowerUp) {
      reactorPowerLevel = 1;
      reactorPowerTarget = 1;
      updateReactorPower(1);
    }
    revealViewer(hasPowerUp ? playPowerUp : undefined);
  }
}

function setLoadProgress(progress) {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  const percentage = Math.round(clamped * 100);
  loadBar.style.width = `${percentage}%`;
  loadPercent.textContent = `${String(percentage).padStart(2, "0")}%`;
}

new GLTFLoader().load(
  "./assets/gipsy-danger-combat.glb?v=1669b871",
  prepareModel,
  (event) => {
    if (event.total > 0) {
      setLoadProgress(Math.min(0.96, event.loaded / event.total));
    } else {
      setLoadProgress(0.32);
    }
  },
  (error) => {
    console.error("Unable to load the Gipsy Danger GLB.", error);
    setLoadProgress(1);
    modelError.classList.add("visible");
    window.setTimeout(() => loaderElement.classList.add("done"), 350);
  },
);

function clearHighlight() {
  highlightedOverlays.splice(0).forEach((overlay) => {
    overlay.parent?.remove(overlay);
  });
}

function showHighlight(partIndex) {
  clearHighlight();
  selectionLight.intensity = 0;

  if (!modelReady || partIndex === 0) {
    return;
  }

  partMeshes[partIndex].forEach((mesh) => {
    if (!mesh.visible || mesh.userData?.plasmaHidden) return;
    let overlay;
    if (mesh.isSkinnedMesh) {
      overlay = mesh.clone(false);
      overlay.material = highlightMaterial;
      overlay.frustumCulled = false;
      mesh.parent.add(overlay);
    } else {
      overlay = new THREE.Mesh(mesh.geometry, highlightMaterial);
      overlay.scale.setScalar(1.006);
      mesh.add(overlay);
    }
    overlay.name = `${mesh.name}__ACTIVE_OVERLAY`;
    overlay.renderOrder = 20;
    overlay.raycast = () => {};
    highlightedOverlays.push(overlay);
  });

  const box = partBoxes[partIndex];
  if (!box.isEmpty()) {
    box.getCenter(selectionLightGoal);
    selectionLightGoal.z += 2.5;
    selectionLight.intensity = 8;
  }
}

function getSafeViewport() {
  const mobile = window.innerWidth <= 860;
  if (mobile) {
    const compact = window.innerHeight <= 700;
    const top = 68 + (compact ? 139 : window.innerWidth <= 520 ? 165 : 154);
    const bottom = (compact ? 78 : 88) + (compact ? 53 : 62) + 18;
    return {
      left: 14,
      right: 14,
      top,
      bottom,
    };
  }

  const sideNav = Math.min(275, Math.max(220, window.innerWidth * 0.2));
  const dossier = Math.min(420, Math.max(335, window.innerWidth * 0.27));
  return {
    left: sideNav + 46,
    right: dossier + 56,
    top: 105,
    bottom: 112,
  };
}

function fitDistanceForBox(box, padding = 1.15) {
  const size = box.getSize(new THREE.Vector3());
  const safe = getSafeViewport();
  const widthFraction = THREE.MathUtils.clamp(
    (window.innerWidth - safe.left - safe.right) / window.innerWidth,
    0.24,
    1,
  );
  const heightFraction = THREE.MathUtils.clamp(
    (window.innerHeight - safe.top - safe.bottom) / window.innerHeight,
    0.28,
    1,
  );

  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);

  const verticalDistance =
    size.y / (2 * Math.tan(verticalFov / 2) * heightFraction);
  const horizontalDistance =
    size.x / (2 * Math.tan(horizontalFov / 2) * widthFraction);

  return (
    Math.max(verticalDistance, horizontalDistance, size.z * 1.8, 2.8) * padding
  );
}

function directionFromView(yawDegrees, elevationDegrees) {
  const yaw = THREE.MathUtils.degToRad(yawDegrees);
  const elevation = THREE.MathUtils.degToRad(elevationDegrees);
  const horizontal = Math.cos(elevation);
  return new THREE.Vector3(
    Math.sin(yaw) * horizontal,
    Math.sin(elevation),
    Math.cos(yaw) * horizontal,
  ).normalize();
}

function composeTarget(center, distance) {
  const safe = getSafeViewport();
  const safeCenterY =
    (safe.top + (window.innerHeight - safe.bottom)) * 0.5;
  const pixelOffset = safeCenterY - window.innerHeight * 0.5;
  const worldPerPixel =
    (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) /
    window.innerHeight;
  center.y += pixelOffset * worldPerPixel;
  return center;
}

function framePart(partIndex, immediate = false) {
  if (!modelReady) return;

  const part = PARTS[partIndex];
  const box =
    partBoxes[partIndex] && !partBoxes[partIndex].isEmpty()
      ? partBoxes[partIndex]
      : fullModelBox;
  const distance = fitDistanceForBox(box, part.padding);
  const center = box.getCenter(new THREE.Vector3());
  composeTarget(center, distance);
  const direction = directionFromView(part.yaw, part.elevation);

  targetGoal.copy(center);
  cameraGoal.copy(center).addScaledVector(direction, distance);
  controls.minDistance = Math.max(2.2, distance * 0.42);
  controls.maxDistance = Math.max(48, distance * 2.25);

  if (immediate) {
    controls.target.copy(targetGoal);
    camera.position.copy(cameraGoal);
    controls.update();
    cameraTransition = false;
  } else {
    cameraTransition = true;
  }
}

function updateFields(partIndex) {
  const part = PARTS[partIndex];
  fields.no.textContent = String(partIndex + 1).padStart(2, "0");
  fields.level.textContent = part.level;
  fields.title.textContent = part.name;
  fields.description.textContent = part.description;
  fields.statLabel.textContent = part.statLabel;
  fields.stat.textContent = part.stat;
  fields.focusLabel.textContent = part.focusLabel;
  fields.focus.textContent = part.focus;
  fields.control.textContent = part.name.toUpperCase();
}

function updateRotationButton() {
  if (prefersReducedMotion) autoRotateEnabled = false;
  rotationToggle.classList.toggle("active", autoRotateEnabled);
  rotationToggle.disabled =
    prefersReducedMotion || powerState === "playing";
  rotationToggle.setAttribute(
    "aria-pressed",
    autoRotateEnabled ? "true" : "false",
  );
}

function selectPart(nextIndex, immediate = false) {
  if (powerState === "playing") return;
  index = (nextIndex + PARTS.length) % PARTS.length;
  const info = document.querySelector("#partInfo");
  info.classList.add("changing");

  window.setTimeout(
    () => {
      updateFields(index);
      info.classList.remove("changing");
    },
    immediate ? 0 : 190,
  );

  document.querySelectorAll("#partList button").forEach((button, buttonIndex) => {
    const active = buttonIndex === index;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "true" : "false");
    if (active && window.innerWidth <= 860) {
      button.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: immediate || prefersReducedMotion ? "auto" : "smooth",
      });
    }
  });

  autoRotateEnabled = index === 0 && !prefersReducedMotion;
  controls.autoRotate = autoRotateEnabled;
  updateRotationButton();
  showHighlight(index);
  framePart(index, immediate);

  const url = new URL(window.location.href);
  if (index === 0) {
    url.searchParams.delete("part");
  } else {
    url.searchParams.set("part", String(index));
  }
  window.history.replaceState(null, "", url);
}

prevPartButton.addEventListener("click", () => {
  selectPart(index - 1);
});

nextPartButton.addEventListener("click", () => {
  selectPart(index + 1);
});

resetViewButton.addEventListener("click", () => {
  selectPart(0);
});

replayPowerUpButton.addEventListener("click", playPowerUp);
skipPowerUpButton.addEventListener("click", () => skipPowerUp(true));

rotationToggle.addEventListener("click", () => {
  if (prefersReducedMotion || powerState === "playing") return;
  autoRotateEnabled = !autoRotateEnabled;
  controls.autoRotate = autoRotateEnabled;
  cameraTransition = false;
  updateRotationButton();
});

controls.addEventListener("start", () => {
  cameraTransition = false;
});

function dominantHitBoneName(hit) {
  const mesh = hit.object;
  const skinIndex = mesh.geometry?.getAttribute("skinIndex");
  const skinWeight = mesh.geometry?.getAttribute("skinWeight");
  const skeleton = mesh.skeleton;
  if (!mesh.isSkinnedMesh || !skinIndex || !skinWeight || !skeleton || !hit.face) {
    return "";
  }

  const scores = new Map();
  [hit.face.a, hit.face.b, hit.face.c].forEach((vertexIndex) => {
    for (let influence = 0; influence < 4; influence += 1) {
      const boneIndex = skinIndex.getComponent(vertexIndex, influence);
      const weight = skinWeight.getComponent(vertexIndex, influence);
      if (weight <= 0) continue;
      scores.set(boneIndex, (scores.get(boneIndex) || 0) + weight);
    }
  });
  const strongest = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return strongest ? skeleton.bones[strongest[0]]?.name || "" : "";
}

function handSideFromName(name) {
  const normalized = String(name || "").toLowerCase();
  if (/(?:^|[_.\s-])l(?:$|[_.\s-])|\bleft\b/.test(normalized)) return "left";
  if (/(?:^|[_.\s-])r(?:$|[_.\s-])|\bright\b/.test(normalized)) return "right";
  return "";
}

function inspectHandHit(hit) {
  const names = [];
  let node = hit.object;
  while (node && node !== model) {
    names.push(node.name);
    node = node.parent;
  }
  const boneName = dominantHitBoneName(hit);
  const searchable = `${boneName} ${names.join(" ")}`;
  const explicitHitRegion =
    hit.object.userData?.hitRegion === "hand" ||
    /weapon.?deployment/i.test(hit.object.userData?.interaction || "");
  if (!explicitHitRegion && !/\b(?:hand|palm|finger|thumb|wrist)\b/i.test(searchable)) {
    return null;
  }

  if (hit.object.userData?.side) return hit.object.userData.side;
  const namedSide = handSideFromName(`${boneName} ${names.join(" ")}`);
  if (namedSide) return namedSide;
  const localHit = model.worldToLocal(hit.point.clone());
  return localHit.x >= 0 ? "left" : "right";
}

canvas.addEventListener("pointerdown", (event) => {
  if (pointerDown) return;
  pointerDown = {
    id: event.pointerId,
    type: event.pointerType,
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
  };
  canvas.setPointerCapture?.(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointerDown || event.pointerId !== pointerDown.id) return;
  sunImpulse += event.movementX * 0.0014;
  sunImpulse = THREE.MathUtils.clamp(sunImpulse, -0.7, 0.7);
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerDown || event.pointerId !== pointerDown.id || !modelReady) {
    pointerDown = null;
    return;
  }

  const movement = Math.hypot(
    event.clientX - pointerDown.x,
    event.clientY - pointerDown.y,
  );
  const duration = performance.now() - pointerDown.time;
  const isTouch = pointerDown.type === "touch";
  pointerDown = null;

  if (movement > (isTouch ? 16 : 8) || duration > (isTouch ? 650 : 520)) {
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(raycastMeshes, false);
  if (!hits.length) return;

  const handHit = hits.find((candidate) => inspectHandHit(candidate));
  const handSide = handHit ? inspectHandHit(handHit) : null;
  if (handSide) {
    playWeaponDeployment(handSide);
    return;
  }

  const hit = hits[0];
  const selectedPart = hit.object.userData.partIndex || 0;
  if (selectedPart > 0) selectPart(selectedPart);
});

canvas.addEventListener("pointercancel", () => {
  pointerDown = null;
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const targetIsInteractive =
    target instanceof Element &&
    target.closest(
      "button, a, input, textarea, select, [contenteditable='true']",
    );
  if (event.key === "Escape" && powerState === "playing") {
    event.preventDefault();
    skipPowerUp();
    return;
  }
  if (targetIsInteractive) return;
  if (event.key === "ArrowLeft") selectPart(index - 1);
  if (event.key === "ArrowRight") selectPart(index + 1);
  if (event.key.toLowerCase() === "r") selectPart(0);
  if (event.code === "Space") {
    event.preventDefault();
    rotationToggle.click();
  }
});

motionQuery.addEventListener("change", (event) => {
  prefersReducedMotion = event.matches;
  if (prefersReducedMotion) {
    autoRotateEnabled = false;
    controls.autoRotate = false;
    replayPowerUpButton.hidden = true;
    if (powerState === "playing") {
      skipPowerUp();
    } else if (modelReady && combatClips?.idle) {
      sampleFinalPowerPose();
      framePart(index, true);
    }
  } else if (combatClips?.idle) {
    replayPowerUpButton.hidden = false;
  }
  updateRotationButton();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clock.stop();
  } else {
    clock.start();
  }
});

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;

  if (mixer) mixer.update(delta);

  if (model && (mixer || steam?.hasActive())) {
    model.updateMatrixWorld(true);
  }

  if (powerState === "playing") {
    reactorPowerTarget =
      sequenceStageKey === "turbine" ? sequenceStageProgress() : 1;
  } else if (powerState === "complete") {
    reactorPowerTarget = 1;
  }
  reactorPowerLevel = THREE.MathUtils.damp(
    reactorPowerLevel,
    reactorPowerTarget,
    sequenceStageKey === "turbine" ? 2.8 : 7,
    delta,
  );
  updateReactorPower(reactorPowerLevel);
  plasmaFx?.update(delta);

  const smokeEnvelope = reactorSmokeEnvelope();
  if (smokeEnvelope > 0 || steam?.hasActive()) {
    steam?.update(delta, smokeEnvelope);
  }
  if (
    (powerState === "playing" || weaponState === "deploying") &&
    frameCounter % 3 === 0
  ) {
    updatePowerHud();
  }

  if (cameraTransition) {
    const blend = prefersReducedMotion ? 1 : 1 - Math.exp(-delta * 4.3);
    controls.target.lerp(targetGoal, blend);
    camera.position.lerp(cameraGoal, blend);

    if (
      camera.position.distanceToSquared(cameraGoal) < 0.0008 &&
      controls.target.distanceToSquared(targetGoal) < 0.0002
    ) {
      camera.position.copy(cameraGoal);
      controls.target.copy(targetGoal);
      cameraTransition = false;
    }
  }

  controls.autoRotate = autoRotateEnabled && !cameraTransition;
  controls.update();

  if (!prefersReducedMotion) {
    sunVelocity +=
      (0.095 + sunImpulse - sunVelocity) * Math.min(1, delta * 2.4);
    sunImpulse *= Math.pow(0.12, delta);
    sunAngle += sunVelocity * delta;
    keyLight.position.set(
      Math.cos(sunAngle) * 19,
      15.5 + Math.sin(sunAngle * 0.73) * 2.7,
      Math.sin(sunAngle) * 19,
    );
    warmLight.position.x = Math.sin(sunAngle * 0.82) * 9;
  }

  selectionLight.position.lerp(
    selectionLightGoal,
    Math.min(1, delta * 5),
  );
  if (highlightedOverlays.length) {
    if (prefersReducedMotion) {
      highlightMaterial.opacity = 0.5;
      selectionLight.intensity = 8;
    } else {
      highlightMaterial.opacity =
        0.46 + (Math.sin(elapsed * 3.4) + 1) * 0.04;
      selectionLight.intensity =
        7 + (Math.sin(elapsed * 2.8) + 1) * 1.5;
    }
  }

  if (!prefersReducedMotion) {
    dust.rotation.y += delta * 0.005;
    dust.position.y = Math.sin(elapsed * 0.12) * 0.12;
  }

  frameCounter += 1;
  if (frameCounter % 12 === 0) {
    document.querySelector("#frameReadout").textContent =
      `X ${camera.position.x.toFixed(1)}  Y ${camera.position.y.toFixed(1)}`;
  }

  renderer.render(scene, camera);
}

animate();
updateFields(0);
updateRotationButton();
document.querySelector("#partList button")?.classList.add("active");

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, window.innerWidth <= 860 ? 1.5 : 1.9),
  );
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (modelReady) framePart(index, true);
});
