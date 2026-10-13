import * as THREE from 'three';
import './style.css';

type NeedKey = 'hunger' | 'clean' | 'energy' | 'happy';
type PetSave = {
  version: number;
  name: string;
  coins: number;
  xp: number;
  level: number;
  needs: Record<NeedKey, number>;
  items: string[];
  equipped: string;
  lastSaved: number;
};

const SAVE_KEY = 'petlife-save-v1';
const defaultSave = (): PetSave => ({
  version: 1, name: 'Mochi', coins: 80, xp: 0, level: 1,
  needs: { hunger: 76, clean: 82, energy: 90, happy: 84 },
  items: ['none'], equipped: 'none', lastSaved: Date.now()
});

let save = loadSave();
let currentAction = 'idle';
let actionUntil = 0;
let isDragging = false;
let lastPointerX = 0;
let joystick = { x: 0, y: 0, active: false };
let moveX = 0;
let moveZ = 0;
let toastTimer = 0;
let gamePaused = false;

function loadSave(): PetSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as PetSave;
    if (!parsed.needs || typeof parsed.coins !== 'number') return defaultSave();
    return { ...defaultSave(), ...parsed, needs: { ...defaultSave().needs, ...parsed.needs } };
  } catch {
    return defaultSave();
  }
}
function persist() {
  save.lastSaved = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* browser storage may be disabled */ }
}
function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">🐾</div><div><strong>PetLife</strong><small>your little companion</small></div></div>
      <div class="wallet"><span>🪙</span><b id="coins">80</b></div>
      <button class="icon-button" id="settingsBtn" aria-label="Pengaturan">⚙</button>
    </header>
    <section class="scene-card">
      <div class="scene-top">
        <div class="location-pill"><span class="live-dot"></span><span>KAMAR MOCHI</span></div>
        <div class="weather-pill">☀️ <span>Cerah</span></div>
      </div>
      <div id="scene" class="scene" aria-label="Dunia 3D PetLife"></div>
      <div class="pet-bubble" id="petBubble"><span>💬</span><span id="bubbleText">Miaw! Main bareng, yuk?</span></div>
      <div class="scene-bottom">
        <div class="level-pill"><span>⭐</span><span>LV <b id="level">1</b></span><div class="xp-track"><div id="xpBar"></div></div><small id="xpText">0/100 XP</small></div>
        <button class="round-button" id="cameraBtn" title="Atur tampilan">⤢</button>
      </div>
      <div class="joystick-wrap" id="joystickWrap" aria-label="Joystick gerak">
        <div class="joystick-base"><div class="joystick-knob" id="joystickKnob"></div></div>
        <small>GERAK</small>
      </div>
      <button class="jump-btn" id="jumpBtn" title="Lompat">↟</button>
    </section>

    <section class="pet-summary">
      <div class="pet-avatar">🐱<span class="status-dot"></span></div>
      <div class="pet-intro"><div class="pet-name-row"><h1 id="petName">Mochi</h1><span class="mood-tag" id="moodTag">Senang ✨</span></div><p id="petLine">Si kecil siap menemani harimu.</p></div>
      <button class="edit-name" id="renameBtn" aria-label="Ganti nama">✎</button>
    </section>

    <section class="needs-panel">
      <div class="section-heading"><h2>Kebutuhan Mochi</h2><span class="tiny-label">JAGA DIA TETAP HAPPY</span></div>
      <div class="need-grid">
        <div class="need-card"><div class="need-icon hunger-icon">🍗</div><div class="need-info"><div><b>Lapar</b><strong id="hungerVal">76%</strong></div><div class="meter"><span id="hungerBar" class="meter-fill hunger-fill"></span></div></div></div>
        <div class="need-card"><div class="need-icon clean-icon">🫧</div><div class="need-info"><div><b>Kebersihan</b><strong id="cleanVal">82%</strong></div><div class="meter"><span id="cleanBar" class="meter-fill clean-fill"></span></div></div></div>
        <div class="need-card"><div class="need-icon energy-icon">⚡</div><div class="need-info"><div><b>Energi</b><strong id="energyVal">90%</strong></div><div class="meter"><span id="energyBar" class="meter-fill energy-fill"></span></div></div></div>
        <div class="need-card"><div class="need-icon happy-icon">💗</div><div class="need-info"><div><b>Bahagia</b><strong id="happyVal">84%</strong></div><div class="meter"><span id="happyBar" class="meter-fill happy-fill"></span></div></div></div>
      </div>
    </section>

    <section class="actions-section">
      <div class="section-heading"><h2>Waktunya beraktivitas</h2><span class="tiny-label">PILIH AKSI</span></div>
      <div class="action-grid">
        <button class="action-card" data-action="feed"><span class="action-emoji food-bg">🍗</span><b>Beri makan</b><small>Isi perut Mochi</small></button>
        <button class="action-card" data-action="bath"><span class="action-emoji bath-bg">🛁</span><b>Mandi</b><small>Biar makin bersih</small></button>
        <button class="action-card" data-action="play"><span class="action-emoji play-bg">🧶</span><b>Main bareng</b><small>Tambah bahagia</small></button>
        <button class="action-card" data-action="sleep"><span class="action-emoji sleep-bg">🌙</span><b>Istirahat</b><small>Pulihkan energi</small></button>
      </div>
    </section>

    <section class="extras-grid">
      <button class="extra-card" id="shopBtn"><span class="extra-icon shop-icon">🛍️</span><span><b>Toko Mochi</b><small>Topi, kalung, mainan</small></span><span class="arrow">›</span></button>
      <button class="extra-card" id="voiceBtn"><span class="extra-icon voice-icon">🎙️</span><span><b>Panggil Mochi</b><small>Kontrol suara opsional</small></span><span class="arrow">›</span></button>
    </section>

    <nav class="bottom-nav"><button class="nav-item active"><span>🏠</span><b>Rumah</b></button><button class="nav-item" id="missionsBtn"><span>🎯</span><b>Misi</b></button><button class="nav-item" id="petBtn"><span>🐾</span><b>Pet</b></button><button class="nav-item" id="profileBtn"><span>👤</span><b>Profil</b></button></nav>
  </main>
  <div class="toast" id="toast" role="status"></div>
  <div class="modal-backdrop hidden" id="modalBackdrop"><section class="modal" id="modal" role="dialog" aria-modal="true"></section></div>
`;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const sceneEl = $('#scene');
const toastEl = $('#toast');
function toast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2300);
}
function say(message: string) {
  $('#bubbleText').textContent = message;
  $('#petBubble').classList.remove('bubble-pop');
  void $('#petBubble').offsetWidth;
  $('#petBubble').classList.add('bubble-pop');
}
function gainXP(amount: number) {
  save.xp += amount;
  while (save.xp >= 100) {
    save.xp -= 100; save.level += 1; save.coins += 25;
    toast(`Naik level! Mochi sekarang level ${save.level} 🎉`);
    say('Yeay! Aku naik level!');
  }
}
function startAction(action: string, message: string, duration = 2600) {
  currentAction = action; actionUntil = performance.now() + duration;
  say(message);
}
function performAction(action: string) {
  if (action === 'feed') {
    if (save.coins < 5) return toast('Koin belum cukup untuk membeli makanan.');
    save.coins -= 5; save.needs.hunger = clamp(save.needs.hunger + 28);
    save.needs.happy = clamp(save.needs.happy + 4); gainXP(10);
    startAction('eat', 'Nyam nyam! Enak banget!'); toast('Mochi makan dengan lahap 🍗');
  } else if (action === 'bath') {
    save.needs.clean = clamp(save.needs.clean + 35); save.needs.happy = clamp(save.needs.happy + 3);
    save.needs.energy = clamp(save.needs.energy - 5); gainXP(12);
    startAction('bath', 'Brrr… sekarang aku wangi!'); toast('Mochi sudah bersih 🫧');
  } else if (action === 'play') {
    save.needs.happy = clamp(save.needs.happy + 20); save.needs.energy = clamp(save.needs.energy - 12);
    gainXP(15); startAction('play', 'Tangkap aku kalau bisa!'); toast('Waktunya bermain! 🧶');
  } else if (action === 'sleep') {
    save.needs.energy = clamp(save.needs.energy + 35); save.needs.happy = clamp(save.needs.happy + 2);
    startAction('sleep', 'Zzz… bangunkan aku nanti, ya.', 4000); toast('Mochi sedang beristirahat 🌙');
  }
  persist(); renderHUD();
}
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn => btn.addEventListener('click', () => performAction(btn.dataset.action!)));

function renderHUD() {
  $('#coins').textContent = String(save.coins);
  $('#level').textContent = String(save.level);
  $('#xpBar').style.width = `${save.xp}%`;
  $('#xpText').textContent = `${save.xp}/100 XP`;
  $('#petName').textContent = save.name;
  const mood = Math.min(...Object.values(save.needs));
  $('#moodTag').textContent = mood > 65 ? 'Senang ✨' : mood > 35 ? 'Lumayan 🙂' : 'Butuh perhatian 💭';
  $('#petLine').textContent = mood > 65 ? 'Si kecil siap menemani harimu.' : 'Mochi butuh sedikit perhatianmu.';
  (Object.keys(save.needs) as NeedKey[]).forEach(key => {
    const value = Math.round(save.needs[key]);
    $(`#${key}Val`).textContent = `${value}%`;
    $(`#${key}Bar`).style.width = `${value}%`;
  });
}
renderHUD();

// Three.js scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f5e9dc');
scene.fog = new THREE.Fog('#f5e9dc', 11, 26);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 7.2, 11.5);
camera.lookAt(0, 1.0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.setAttribute('aria-label', 'Tampilan 3D kamar Mochi');
sceneEl.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xfff4e7, 0x8b9c9c, 2.1));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.5);
sun.position.set(-4, 8, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
scene.add(sun);

const mat = (color: string, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const materials = {
  floor: mat('#e7c9a9'), wall: mat('#f4dfc8'), trim: mat('#c79d79'), cream: mat('#fff0d9'),
  wood: mat('#b77c54'), woodLight: mat('#dba87a'), pink: mat('#eaa6a4'), green: mat('#91b7a0'),
  dark: mat('#473b3b'), white: mat('#fffaf3'), grey: mat('#9da5ad'), greyLight: mat('#c7cbd0'),
  blue: mat('#9ecbdc'), yellow: mat('#efc66e'), bowl: mat('#a4c7c4', 0.25, 0.05)
};
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, cast = true) {
  const obj = new THREE.Mesh(geometry, material);
  obj.position.set(x, y, z); obj.castShadow = cast; obj.receiveShadow = true; parent.add(obj); return obj;
}
function box(parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material, cast = true) {
  return mesh(new THREE.BoxGeometry(sx, sy, sz), material, parent, x, y, z, cast);
}
function sphere(parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material) {
  const obj = mesh(new THREE.SphereGeometry(1, 20, 14), material, parent, x, y, z);
  obj.scale.set(sx, sy, sz); return obj;
}
function cylinder(parent: THREE.Object3D, x: number, y: number, z: number, rt: number, rb: number, h: number, material: THREE.Material, segments = 20) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material, parent, x, y, z);
}
const room = new THREE.Group(); scene.add(room);
box(room, 0, -0.16, 0, 14, 0.3, 12, materials.floor);
box(room, 0, 2.1, -5.9, 14, 4.4, 0.22, materials.wall);
box(room, -6.9, 2.1, 0, 0.22, 4.4, 12, materials.wall);
box(room, 6.9, 2.1, 0, 0.22, 4.4, 12, materials.wall);
box(room, 0, 4.28, 0, 14, 0.12, 12, materials.cream, false);
box(room, 0, 0.04, -5.75, 13.8, 0.16, 0.14, materials.trim, false);
box(room, -6.75, 0.04, 0, 0.14, 0.16, 11.7, materials.trim, false);
box(room, 6.75, 0.04, 0, 0.14, 0.16, 11.7, materials.trim, false);

// Window and panes
box(room, 0, 2.65, -5.74, 3.6, 2.15, 0.08, materials.wood);
box(room, 0, 2.65, -5.67, 3.28, 1.84, 0.08, materials.blue, false);
box(room, 0, 2.65, -5.6, 0.07, 1.9, 0.06, materials.white, false);
box(room, 0, 2.65, -5.59, 3.25, 0.07, 0.06, materials.white, false);
sphere(room, -1.0, 3.05, -5.53, 0.26, 0.26, 0.08, materials.yellow);
box(room, 0, 1.48, -5.55, 4.0, 0.12, 0.42, materials.woodLight);

// Rug
const rug = mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.07, 48), mat('#e9b6a3'), room, 0.0, 0.01, 0.8, false);
rug.scale.set(1.45, 1, 0.8);

// Bed to the left
const bed = new THREE.Group(); bed.position.set(-4.1, 0, -2.5); room.add(bed);
box(bed, 0, 0.28, 0, 2.3, 0.45, 1.6, materials.wood);
box(bed, 0, 0.55, 0, 2.2, 0.16, 1.48, materials.pink);
box(bed, 0, 0.68, -0.35, 1.4, 0.15, 0.6, materials.cream);
for (const x of [-0.85, 0.85]) box(bed, x, 0.68, 0.1, 0.18, 0.3, 1.45, materials.woodLight);

// Cat tree right side
const tree = new THREE.Group(); tree.position.set(4.3, 0, -2.3); room.add(tree);
cylinder(tree, 0, 0.95, 0, 0.22, 0.26, 1.9, materials.wood);
cylinder(tree, 0, 0.2, 0, 0.7, 0.7, 0.22, materials.green);
box(tree, 0, 1.75, 0, 1.35, 0.22, 1.1, materials.green);
cylinder(tree, 0, 2.2, 0, 0.16, 0.16, 0.7, materials.wood);
sphere(tree, 0, 2.7, 0, 0.7, 0.42, 0.6, materials.green);

// Shelf and plant
box(room, -5.6, 1.35, 1.2, 0.65, 2.7, 0.65, materials.wood);
for (let i = 0; i < 3; i++) box(room, -5.6, 0.55 + i * 0.75, 1.2, 0.75, 0.07, 0.7, materials.woodLight);
cylinder(room, 5.5, 0.45, 1.5, 0.38, 0.3, 0.75, materials.pink);
for (let i = 0; i < 5; i++) {
  const leaf = sphere(room, 5.5 + Math.cos(i * 1.25) * 0.32, 1.05 + (i % 2) * 0.2, 1.5 + Math.sin(i * 1.25) * 0.22, 0.2, 0.45, 0.18, materials.green);
  leaf.rotation.z = (i - 2) * 0.25;
}

// Food and water bowls
function makeBowl(x: number, z: number, color: THREE.Material) {
  const g = new THREE.Group(); g.position.set(x, 0, z); room.add(g);
  cylinder(g, 0, 0.16, 0, 0.42, 0.34, 0.28, color);
  cylinder(g, 0, 0.30, 0, 0.37, 0.37, 0.05, materials.dark);
  cylinder(g, 0, 0.32, 0, 0.30, 0.30, 0.035, materials.yellow);
  return g;
}
makeBowl(-2.4, 2.5, materials.pink);
makeBowl(-1.2, 2.5, materials.bowl);

// Yarn ball and small toy
const yarn = sphere(room, 2.8, 0.27, 2.3, 0.28, 0.28, 0.28, materials.pink);
for (let i = 0; i < 3; i++) {
  const line = mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 22), materials.white, room, 2.8, 0.27, 2.3, false);
  line.rotation.set(i * 0.7, i * 0.9, i * 0.4);
}
sphere(room, 3.8, 0.15, 2.0, 0.18, 0.14, 0.26, materials.yellow);

// Original procedural kitten placeholder built from geometry, ready to be replaced with a rigged GLB.
const cat = new THREE.Group(); scene.add(cat); cat.position.set(0, 0, 1.1);
const body = new THREE.Group(); cat.add(body);
sphere(body, 0, 0.64, 0, 0.55, 0.52, 0.82, materials.grey);
sphere(body, 0, 0.48, 0.35, 0.39, 0.32, 0.55, materials.greyLight);
const head = new THREE.Group(); head.position.set(0, 1.25, -0.35); body.add(head);
sphere(head, 0, 0, 0, 0.62, 0.57, 0.55, materials.greyLight);
// forehead markings
sphere(head, -0.22, 0.38, 0.43, 0.08, 0.18, 0.035, materials.grey);
sphere(head, 0, 0.43, 0.47, 0.075, 0.19, 0.035, materials.grey);
sphere(head, 0.22, 0.38, 0.43, 0.08, 0.18, 0.035, materials.grey);
// ears
function makeEar(x: number) {
  const ear = new THREE.Group(); ear.position.set(x, 0.42, -0.02); head.add(ear);
  const outer = mesh(new THREE.ConeGeometry(0.22, 0.55, 4), materials.grey, ear, 0, 0.16, 0);
  outer.rotation.z = x < 0 ? 0.2 : -0.2;
  const inner = mesh(new THREE.ConeGeometry(0.12, 0.32, 4), materials.pink, ear, 0, 0.18, 0.12);
  inner.rotation.z = x < 0 ? 0.2 : -0.2;
  return ear;
}
const earL = makeEar(-0.4), earR = makeEar(0.4);
// eyes
const eyeWhiteL = sphere(head, -0.24, 0.05, 0.47, 0.15, 0.19, 0.075, materials.white);
const eyeWhiteR = sphere(head, 0.24, 0.05, 0.47, 0.15, 0.19, 0.075, materials.white);
const irisMat = new THREE.MeshStandardMaterial({ color: '#76b9d5', roughness: 0.25 });
const pupilMat = new THREE.MeshStandardMaterial({ color: '#252a31', roughness: 0.2 });
for (const x of [-0.24, 0.24]) {
  sphere(head, x, 0.035, 0.535, 0.09, 0.125, 0.045, irisMat);
  sphere(head, x, 0.025, 0.57, 0.048, 0.082, 0.025, pupilMat);
  sphere(head, x - 0.025, 0.08, 0.592, 0.025, 0.03, 0.015, materials.white);
}
const nose = mesh(new THREE.SphereGeometry(0.07, 12, 10), materials.pink, head, 0, -0.12, 0.56);
nose.scale.set(1, 0.7, 0.7);
// muzzle and mouth
sphere(head, -0.095, -0.2, 0.52, 0.13, 0.09, 0.08, materials.white);
sphere(head, 0.095, -0.2, 0.52, 0.13, 0.09, 0.08, materials.white);
const mouth = mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16, Math.PI), materials.dark, head, 0, -0.26, 0.59, false);
mouth.rotation.z = Math.PI;
const tail = new THREE.Group(); tail.position.set(0, 0.82, -0.7); body.add(tail);
const tailCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.2, -0.2),
  new THREE.Vector3(0.28, 0.35, -0.3), new THREE.Vector3(0.36, 0.5, -0.15)
]);
mesh(new THREE.TubeGeometry(tailCurve, 16, 0.105, 8, false), materials.grey, tail, 0, 0, 0);
// legs with simple animated pivot
const legs: THREE.Group[] = [];
for (const x of [-0.32, 0.32]) {
  for (const z of [-0.42, 0.48]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.43, z); body.add(leg);
    sphere(leg, 0, -0.17, 0, 0.16, 0.29, 0.16, materials.grey);
    sphere(leg, 0, -0.34, 0.04, 0.17, 0.11, 0.2, materials.greyLight);
    legs.push(leg);
  }
}
const blushL = sphere(head, -0.4, -0.19, 0.45, 0.07, 0.035, 0.02, materials.pink);
const blushR = sphere(head, 0.4, -0.19, 0.45, 0.07, 0.035, 0.02, materials.pink);

// Interaction zones in the room, also used by simple auto-navigation.
const targets = {
  bed: new THREE.Vector3(-4.0, 0, -2.1),
  food: new THREE.Vector3(-2.0, 0, 2.0),
  toy: new THREE.Vector3(2.7, 0, 2.0),
  tree: new THREE.Vector3(4.1, 0, -1.8)
};
let targetPosition: THREE.Vector3 | null = null;
function walkTo(target: THREE.Vector3, action: string) {
  targetPosition = target.clone(); currentAction = action; actionUntil = performance.now() + 5000;
}
function interactWithNearest() {
  const choices = Object.entries(targets).map(([name, p]) => ({ name, p, d: cat.position.distanceTo(p) })).sort((a, b) => a.d - b.d);
  const nearest = choices[0];
  if (!nearest || nearest.d > 7) return toast('Dekati objek yang ingin kamu gunakan.');
  walkTo(nearest.p, nearest.name === 'bed' ? 'sleep' : nearest.name === 'food' ? 'eat' : nearest.name === 'toy' ? 'play' : 'idle');
  say(nearest.name === 'bed' ? 'Aku mau rebahan sebentar…' : nearest.name === 'food' ? 'Wah, makanan!' : nearest.name === 'toy' ? 'Bola! Bola!' : 'Tempat ini seru!');
}
sceneEl.addEventListener('pointerdown', e => {
  isDragging = true; lastPointerX = e.clientX; sceneEl.setPointerCapture(e.pointerId);
});
sceneEl.addEventListener('pointermove', e => {
  if (!isDragging) return;
  const delta = e.clientX - lastPointerX; lastPointerX = e.clientX;
  cat.rotation.y += delta * 0.008;
});
sceneEl.addEventListener('pointerup', () => { isDragging = false; });
sceneEl.addEventListener('pointercancel', () => { isDragging = false; });
sceneEl.addEventListener('dblclick', interactWithNearest);

// Joystick supports pointer and touch through Pointer Events.
const joyWrap = $('#joystickWrap');
const joyKnob = $('#joystickKnob');
function updateJoy(e: PointerEvent) {
  const rect = joyWrap.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const max = rect.width * 0.31;
  const length = Math.hypot(dx, dy);
  if (length > max) { dx = dx / length * max; dy = dy / length * max; }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joystick.x = dx / max; joystick.y = dy / max; joystick.active = true;
  moveX = joystick.x; moveZ = joystick.y;
  targetPosition = null;
}
joyWrap.addEventListener('pointerdown', e => {
  e.preventDefault(); joyWrap.setPointerCapture(e.pointerId); updateJoy(e);
});
joyWrap.addEventListener('pointermove', e => { if (joystick.active) updateJoy(e); });
function endJoy() {
  joystick.active = false; moveX = 0; moveZ = 0;
  joyKnob.style.transform = 'translate(0px, 0px)';
}
joyWrap.addEventListener('pointerup', endJoy);
joyWrap.addEventListener('pointercancel', endJoy);
$('#jumpBtn').addEventListener('click', () => { startAction('jump', 'Wheee! Lihat aku melompat!'); cat.position.y = 0.65; gainXP(1); persist(); renderHUD(); });

// Shop and modal helpers
const backdrop = $('#modalBackdrop');
const modal = $('#modal');
function openModal(title: string, content: string) {
  modal.innerHTML = `<button class="modal-close" id="modalClose" aria-label="Tutup">×</button><div class="modal-kicker">PETLIFE • MOCHI'S WORLD</div><h2>${title}</h2>${content}`;
  backdrop.classList.remove('hidden');
  $('#modalClose').addEventListener('click', () => backdrop.classList.add('hidden'));
}
backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
$('#shopBtn').addEventListener('click', () => {
  const products = [
    { id: 'ribbon', emoji: '🎀', name: 'Pita manis', price: 35, desc: 'Pita pink kecil' },
    { id: 'hat', emoji: '🎩', name: 'Topi mini', price: 50, desc: 'Topi lucu untuk Mochi' },
    { id: 'collar', emoji: '🔵', name: 'Kalung biru', price: 45, desc: 'Kalung warna pastel' }
  ];
  openModal('Toko Mochi', `<p class="modal-copy">Pilih aksesori dari koin yang kamu kumpulkan.</p><div class="shop-list">${products.map(p => `<div class="shop-product"><div class="product-emoji">${p.emoji}</div><div class="product-info"><b>${p.name}</b><small>${p.desc}</small><strong>🪙 ${p.price}</strong></div><button class="buy-btn" data-buy="${p.id}" data-price="${p.price}" data-emoji="${p.emoji}" ${save.items.includes(p.id) ? 'disabled' : ''}>${save.items.includes(p.id) ? 'Dimiliki' : 'Beli'}</button></div>`).join('')}</div>`);
  modal.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.buy!, price = Number(btn.dataset.price), emoji = btn.dataset.emoji!;
    if (save.coins < price) return toast('Koin belum cukup.');
    save.coins -= price; save.items.push(id); save.equipped = id;
    persist(); renderHUD(); toast('Aksesori berhasil dibeli!');
    // simple accessory visible above the head
    if (id === 'ribbon') addRibbon();
    if (id === 'hat') addHat();
    if (id === 'collar') addCollar();
    btn.textContent = 'Dimiliki'; btn.disabled = true;
    say(`Lihat! Aku punya ${id === 'ribbon' ? 'pita' : id === 'hat' ? 'topi' : 'kalung'} baru!`);
  }));
});
let ribbonObj: THREE.Group | null = null, hatObj: THREE.Group | null = null, collarObj: THREE.Mesh | null = null;
function addRibbon() {
  if (ribbonObj) return;
  ribbonObj = new THREE.Group(); head.add(ribbonObj); ribbonObj.position.set(0.37, 0.48, 0.05);
  sphere(ribbonObj, -0.12, 0, 0, 0.13, 0.08, 0.06, materials.pink);
  sphere(ribbonObj, 0.12, 0, 0, 0.13, 0.08, 0.06, materials.pink);
  sphere(ribbonObj, 0, 0, 0.02, 0.06, 0.06, 0.06, materials.yellow);
}
function addHat() {
  if (hatObj) return;
  hatObj = new THREE.Group(); head.add(hatObj); hatObj.position.set(0, 0.5, 0);
  cylinder(hatObj, 0, 0.02, 0, 0.28, 0.28, 0.09, materials.dark);
  cylinder(hatObj, 0, 0.16, 0, 0.19, 0.24, 0.27, materials.dark);
}
function addCollar() {
  if (collarObj) return;
  collarObj = mesh(new THREE.TorusGeometry(0.31, 0.045, 8, 28), materials.blue, body, 0, 0.74, 0.25);
  collarObj.rotation.x = 1.3;
}
function restoreAccessory() {
  if (save.items.includes('ribbon')) addRibbon();
  if (save.items.includes('hat')) addHat();
  if (save.items.includes('collar')) addCollar();
}
restoreAccessory();

$('#renameBtn').addEventListener('click', () => {
  openModal('Nama temanmu', `<p class="modal-copy">Pilih nama yang paling cocok untuk si kecil.</p><input id="nameInput" class="name-input" maxlength="18" value="${save.name.replace(/"/g, '&quot;')}" /><button class="primary-btn" id="saveName">Simpan nama</button>`);
  $('#saveName').addEventListener('click', () => {
    const name = ($('#nameInput') as HTMLInputElement).value.trim();
    if (!name) return toast('Nama tidak boleh kosong.');
    save.name = name.slice(0, 18); persist(); renderHUD(); backdrop.classList.add('hidden'); toast(`Halo, ${save.name}!`);
  });
});
$('#settingsBtn').addEventListener('click', () => {
  openModal('Pengaturan', `<div class="setting-row"><div><b>Grafis</b><small>Atur kualitas sesuai kemampuan HP</small></div><select id="qualitySelect" class="quality-select"><option value="low">Ringan</option><option value="balanced" selected>Seimbang</option><option value="high">Tinggi</option></select></div><div class="setting-row"><div><b>Suara game</b><small>Efek suara sederhana</small></div><label class="switch"><input type="checkbox" id="soundToggle" checked><span></span></label></div><button class="secondary-btn" id="exportSave">Ekspor progres</button><button class="danger-btn" id="resetSave">Mulai ulang progres</button>`);
  $('#qualitySelect').addEventListener('change', e => {
    const quality = (e.target as HTMLSelectElement).value;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : quality === 'high' ? 2 : 1.5));
    sun.castShadow = quality !== 'low'; renderer.shadowMap.enabled = quality !== 'low';
    toast(`Kualitas grafis: ${quality}`);
  });
  $('#exportSave').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'petlife-save.json'; a.click(); URL.revokeObjectURL(a.href);
    toast('File progres disiapkan.');
  });
  $('#resetSave').addEventListener('click', () => {
    localStorage.removeItem(SAVE_KEY); save = defaultSave(); persist(); renderHUD(); backdrop.classList.add('hidden'); toast('Progres dimulai ulang.');
    location.reload();
  });
});
$('#cameraBtn').addEventListener('click', () => {
  camera.position.x = camera.position.x === 0 ? 1.5 : 0;
  camera.lookAt(0, 1.0, 0);
  toast('Sudut pandang diatur.');
});
$('#voiceBtn').addEventListener('click', () => {
  const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Pengenalan suara belum didukung browser ini. Gunakan tombol aksi, ya!');
  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase();
      if (text.includes('makan') || text.includes('lapar')) performAction('feed');
      else if (text.includes('mandi') || text.includes('bersih')) performAction('bath');
      else if (text.includes('main') || text.includes('bola')) performAction('play');
      else if (text.includes('tidur') || text.includes('istirahat')) performAction('sleep');
      else if (text.includes('kemari') || text.includes('sini')) { walkTo(new THREE.Vector3(0, 0, 0.5), 'walk'); say('Aku datang!'); }
      else { say('Miaw? Aku belum mengerti. Coba bilang makan, mandi, main, atau tidur.'); toast(`Kamu bilang: “${text}”`); }
    };
    recognition.onerror = () => toast('Suara tidak tertangkap. Coba lagi atau gunakan tombol aksi.');
    recognition.start();
    toast('Dengarkan… coba bilang “Mochi, ayo main!”');
  } catch { toast('Mikrofon tidak tersedia. Gunakan tombol aksi.'); }
});
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
}
$('#missionsBtn').addEventListener('click', () => openModal('Misi sederhana', `<div class="mission-row"><span>🍗</span><div><b>Beri makan Mochi</b><small>Rawat kebutuhan lapar</small></div><strong>+10 XP</strong></div><div class="mission-row"><span>🧶</span><div><b>Ajak bermain</b><small>Buat Mochi lebih bahagia</small></div><strong>+15 XP</strong></div><div class="mission-row"><span>🫧</span><div><b>Waktunya mandi</b><small>Jaga kebersihannya</small></div><strong>+12 XP</strong></div><p class="modal-copy">Misi versi awal ini belum punya reset harian otomatis.</p>`));
$('#petBtn').addEventListener('click', () => openModal('Tentang Mochi', `<div class="pet-profile"><div class="profile-cat">🐱</div><p>Nama: <b>${save.name}</b></p><p>Level: <b>${save.level}</b></p><p>Aksesori: <b>${save.items.length - 1}</b></p><p>Kepribadian: <b>Manja, penasaran, suka bermain</b></p></div>`));
$('#profileBtn').addEventListener('click', () => openModal('Profil pemain', `<div class="pet-profile"><div class="profile-cat">🌼</div><p>PetLife dimainkan secara lokal.</p><p>🪙 Koin: <b>${save.coins}</b></p><p>⭐ Level Mochi: <b>${save.level}</b></p><p class="modal-copy">Belum ada akun online. Progres disimpan di browser ini.</p></div>`));

// Soft progression: needs decrease only while the page is active, and never cause permanent loss.
let lastTick = performance.now();
const clock = new THREE.Clock();
function updateNeeds(delta: number) {
  if (gamePaused) return;
  save.needs.hunger = clamp(save.needs.hunger - delta * 0.12);
  save.needs.clean = clamp(save.needs.clean - delta * 0.035);
  save.needs.energy = clamp(save.needs.energy - (currentAction === 'play' ? delta * 0.18 : delta * 0.025));
  save.needs.happy = clamp(save.needs.happy - delta * 0.04);
}
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  if (targetPosition) {
    const dir = targetPosition.clone().sub(cat.position); dir.y = 0;
    if (dir.length() > 0.18) {
      dir.normalize(); cat.position.addScaledVector(dir, delta * 1.9);
      cat.rotation.y = Math.atan2(dir.x, dir.z);
      currentAction = 'walk';
    } else {
      targetPosition = null;
      if (currentAction === 'food') performAction('feed');
      else if (currentAction === 'sleep') performAction('sleep');
      else if (currentAction === 'play') performAction('play');
      else currentAction = 'idle';
    }
  } else if (joystick.active && (Math.abs(moveX) + Math.abs(moveZ) > 0.12)) {
    const v = new THREE.Vector3(moveX, 0, moveZ);
    v.normalize();
    cat.position.addScaledVector(v, delta * 2.25);
    cat.position.x = clamp(cat.position.x, -5.7, 5.7);
    cat.position.z = clamp(cat.position.z, -4.8, 4.6);
    cat.rotation.y = Math.atan2(v.x, v.z);
    currentAction = 'walk';
  } else if (performance.now() > actionUntil && !['idle', 'walk'].includes(currentAction)) {
    currentAction = 'idle';
  }
  cat.position.x = clamp(cat.position.x, -5.7, 5.7);
  cat.position.z = clamp(cat.position.z, -4.8, 4.6);
  const walking = currentAction === 'walk' || currentAction === 'play';
  body.position.y = Math.sin(elapsed * (walking ? 12 : 2.4)) * (walking ? 0.07 : 0.018);
  body.rotation.z = walking ? Math.sin(elapsed * 6) * 0.035 : Math.sin(elapsed * 1.8) * 0.012;
  head.rotation.y = Math.sin(elapsed * 1.5) * 0.07;
  head.rotation.x = currentAction === 'eat' ? -0.28 + Math.sin(elapsed * 14) * 0.06 : currentAction === 'sleep' ? 0.22 : Math.sin(elapsed * 2) * 0.025;
  tail.rotation.x = Math.sin(elapsed * 3.5) * 0.25;
  tail.rotation.z = Math.sin(elapsed * 2.2) * 0.3;
  earL.rotation.z = Math.sin(elapsed * 2.5) * 0.05;
  earR.rotation.z = -Math.sin(elapsed * 2.5) * 0.05;
  legs.forEach((leg, i) => {
    leg.rotation.x = walking ? Math.sin(elapsed * 11 + (i % 2) * Math.PI) * 0.45 : 0;
  });
  if (currentAction === 'jump') cat.position.y = Math.max(0, cat.position.y - delta * 1.6);
  else cat.position.y = Math.max(0, cat.position.y - delta * 2);
  yarn.rotation.y += delta * 0.5;
  updateNeeds(delta);
  if (performance.now() - lastTick > 5000) { lastTick = performance.now(); persist(); renderHUD(); }
  renderer.render(scene, camera);
}
function resize() {
  const w = sceneEl.clientWidth || 1, h = sceneEl.clientHeight || 1;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
}
new ResizeObserver(resize).observe(sceneEl);
resize();
animate();
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
