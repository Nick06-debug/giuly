import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createWorld } from './world.js';
import { Soundscape } from './audio.js';
import { Progress, readProgress, saveProgress } from './progress.js';
import './style.css';

const $ = id => document.getElementById(id);
const coarse = matchMedia('(pointer: coarse)').matches;
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let progress = readProgress(storage);
let renderer, composer, world, camera;
let mode = 'intro';
let yaw = 0, pitch = -0.035, jumpHeight = 0, jumpVelocity = 0;
let elapsed = 0, walkingTime = 0, nearest = null, activeQuest = 'cat';
let toastTimer, puzzleCleanup = null;
let lastFrame = performance.now();
const keys = new Set();
const joystick = { x: 0, y: 0, id: null };
const player = new THREE.Vector3(0, 1.7, 22);
const sound = new Soundscape();
const quests = {
  cat: { title: 'Il custode dei complimenti', short: 'Un complimento stellare', subtitle: 'Sua Maestà il Gatto accetta solo verità bellissime.', reward: 'Un complimento stellare', symbol: '♡' },
  washer: { title: 'La lavanderia delle galassie', short: 'Una galassia pulita', subtitle: 'Qualcuno ha messo Saturno con i calzini. Serve il tuo aiuto.', reward: 'Una galassia pulita', symbol: '✧' },
  phone: { title: 'Una chiamata alla luna', short: 'Un invito dalla luna', subtitle: 'La luna risponde soltanto a chi conosce la sua melodia.', reward: 'Un invito dalla luna', symbol: '☾' },
};

function persist() { saveProgress(storage, progress); }
function show(id, visible) { $(id).hidden = !visible; }
function toast(message, duration = 3500) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  show('toast', true);
  toastTimer = setTimeout(() => show('toast', false), duration);
}
function applyPersonalization() {
  $('brand-name').textContent = progress.name.toUpperCase();
  $('intro-name').value = progress.name;
  $('name-input').value = progress.name;
  $('intro-dedication').value = progress.dedication;
  $('dedication-input').value = progress.dedication;
  const heading = document.querySelector('#intro h1');
  if (heading) {
    const ending = document.createElement('em'); ending.textContent = 'fuori dal mondo.';
    heading.replaceChildren(document.createTextNode(`${progress.name}, ti porto`), document.createElement('br'), ending);
  }
  document.title = `${progress.name} · Fuori dal mondo`;
}
function updateHUD() {
  $('quest-list').replaceChildren();
  Object.entries(quests).forEach(([id, quest], index) => {
    const done = progress.completed.has(id);
    const button = document.createElement('button');
    button.className = `quest-item${done ? ' is-complete' : ''}${activeQuest === id && !done ? ' is-active' : ''}`;
    button.type = 'button';
    button.setAttribute('aria-label', `${quest.short}${done ? ', completato' : ', segui questo obiettivo'}`);
    const marker = document.createElement('span');
    marker.className = 'quest-marker';
    marker.textContent = done ? '✓' : String(index + 1).padStart(2, '0');
    const copy = document.createElement('span');
    copy.className = 'quest-copy';
    copy.textContent = quest.short;
    button.append(marker, copy);
    button.addEventListener('click', () => { activeQuest = id; updateHUD(); sound.play('click'); });
    $('quest-list').append(button);
  });
  $('progress-label').textContent = `${progress.completed.size} / 3`;
  $('progress-label').setAttribute('aria-label', `${progress.completed.size} di 3 ricordi per il nostro appuntamento`);
  $('progress-bar').style.width = `${progress.completed.size / 3 * 100}%`;
  $('star-counter').textContent = `✦ ${progress.collected.size} / 5 stelle segrete`;
  if (progress.portalOpen) {
    $('quest-title').textContent = 'Il nostro appuntamento può iniziare.';
    $('quest-subtitle').textContent = 'Raggiungi l’arco luminoso al centro dell’isola.';
  } else {
    const quest = quests[activeQuest];
    $('quest-title').textContent = quest.title;
    $('quest-subtitle').textContent = quest.subtitle;
  }
  if (world) {
    world.pickups.forEach((pickup, i) => {
      pickup.gameId = `star-${i}`;
      pickup.object.visible = !progress.collected.has(pickup.gameId);
    });
  }
}

function setMode(next) {
  mode = next;
  keys.clear();
  joystick.x = joystick.y = 0;
  $('joystick-knob').style.transform = 'translate(-50%, -50%)';
  show('intro', next === 'intro');
  show('hud', next !== 'intro');
  show('pause-overlay', next === 'paused');
  show('dialog-overlay', next === 'dialog');
  show('finale-overlay', next === 'finale');
  show('crosshair', next === 'playing');
  show('touch-controls', next === 'playing' && coarse);
  show('interaction', false);
  if (next !== 'playing' && document.pointerLockElement) document.exitPointerLock();
}
function lockPointer() {
  if (coarse || mode !== 'playing' || document.pointerLockElement) return;
  try {
    const result = renderer.domElement.requestPointerLock();
    result?.catch?.(() => {});
  } catch { /* Dragging also works when pointer lock is unavailable. */ }
}
function begin() {
  progress.personalize($('intro-name').value, $('intro-dedication').value);
  persist();
  applyPersonalization();
  camera.position.copy(player);
  setMode('playing');
  sound.start();
  lockPointer();
  toast(coarse ? 'Trascina a destra per guardarti intorno. Il joystick è a sinistra.' : 'WASD per camminare. E per interagire. Esc per una pausa.', 5000);
}
function pause() {
  if (mode === 'dialog') closeDialog(false);
  setMode('paused');
  $('name-input').value = progress.name;
  $('dedication-input').value = progress.dedication;
  $('resume-button').focus();
}
function resume() { setMode('playing'); lockPointer(); }
function restart() {
  puzzleCleanup?.();
  puzzleCleanup = null;
  const old = progress;
  progress = new Progress({ name: old.name, dedication: old.dedication });
  persist();
  player.copy(world.spawn);
  yaw = 0; pitch = -0.035; jumpHeight = jumpVelocity = 0;
  activeQuest = 'cat';
  updateHUD();
  resume();
  toast('Il sogno ricomincia. Le stelle ti stavano aspettando.');
}
function finishQuest(id) {
  if (!progress.complete(id)) return;
  sound.play('success');
  persist();
  activeQuest = Object.keys(quests).find(key => !progress.completed.has(key)) || 'cat';
  updateHUD();
  closeDialog();
  toast(progress.portalOpen ? 'I tre ricordi sono tuoi. L’arco luminoso vi aspetta. ♡' : `Ricordo trovato: ${quests[id].reward}.`);
}
function closeDialog(returnToGame = true) {
  puzzleCleanup?.();
  puzzleCleanup = null;
  show('dialog-overlay', false);
  if (returnToGame) resume();
}
function openDialog(title, subtitle) {
  puzzleCleanup?.();
  puzzleCleanup = null;
  setMode('dialog');
  $('dialog-title').textContent = title;
  $('dialog-subtitle').textContent = subtitle;
  $('dialog-body').replaceChildren();
  $('dialog-actions').replaceChildren();
  $('dialog-close').focus();
}
function textBlock(text, className = 'puzzle-note') {
  const p = document.createElement('p'); p.className = className; p.textContent = text; return p;
}
function action(label, handler, className = 'puzzle-button') {
  const button = document.createElement('button');
  button.className = className; button.type = 'button'; button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}
function catChallenge() {
  openDialog('Sua Maestà vuole un complimento.', 'INCONTRO 01 · IL CUSTODE DEI COMPLIMENTI');
  $('dialog-body').append(textBlock(`«Miao. Sono alto sei metri e possiedo quest’isola. Ma ${progress.name} ha qualcosa che io non ho. Dimmi cosa, e lascerò passare il vostro appuntamento.»`, 'puzzle-quote'));
  $('dialog-body').append(textBlock('Indizio: la risposta giusta non è nel portafoglio.'));
  const status = textBlock('Il gatto attende, con un’aria molto importante.', 'puzzle-status');
  status.setAttribute('aria-live', 'polite');
  $('dialog-body').append(status);
  const options = [
    ['Un abbonamento premium al tonno.', false, '«Interessante. Ma non basta per conquistare un cuore. Riprova.»'],
    ['Il potere di rendere speciale anche una giornata normale.', true],
    ['Una patente per guidare Saturno.', false, '«Io guido già Saturno il martedì. Pensa a qualcosa di più bello.»'],
  ];
  options.forEach(([label, correct, response]) => {
    $('dialog-actions').append(action(label, () => {
      if (correct) finishQuest('cat');
      else { status.textContent = response; sound.play('wrong'); }
    }, 'puzzle-button choice-button'));
  });
}
function washerChallenge() {
  openDialog('Centrifuga le preoccupazioni.', 'INCONTRO 02 · LAVANDERIA DELLE GALASSIE');
  $('dialog-body').append(textBlock('La galassia gira insieme ai calzini. Premi il pulsante quando la luce entra nella zona rosa. Tre colpi delicati e tutte le preoccupazioni se ne vanno.'));
  const meter = document.createElement('div'); meter.className = 'timing-meter';
  const target = document.createElement('span'); target.className = 'timing-target';
  const needle = document.createElement('span'); needle.className = 'timing-needle';
  meter.append(target, needle);
  meter.setAttribute('aria-label', 'Premi quando la luce attraversa la zona centrale rosa');
  $('dialog-body').append(meter);
  const status = textBlock('0 / 3 · Lascia girare, poi premi al momento giusto.', 'puzzle-status');
  status.setAttribute('aria-live', 'polite');
  $('dialog-body').append(status);
  let hits = 0, value = 0, raf, lastHit = 0;
  const start = performance.now();
  const tick = () => {
    value = (Math.sin((performance.now() - start) / 650 - Math.PI / 2) + 1) / 2;
    needle.style.left = `${value * 100}%`;
    meter.dataset.inZone = String(value >= 0.32 && value <= 0.68);
    raf = requestAnimationFrame(tick);
  };
  tick();
  const press = action('♡  Ora! Programma delicati', () => {
    if (performance.now() - lastHit < 500) return;
    lastHit = performance.now();
    if (value >= 0.32 && value <= 0.68) {
      hits++; sound.play('collect');
      status.textContent = `${hits} / 3 · Perfetto. Anche Saturno profuma di buono.`;
      if (hits === 3) finishQuest('washer');
    } else {
      sound.play('wrong');
      status.textContent = `${hits} / 3 · Un po’ fuori tempo. Nessuna fretta, il cielo può aspettare.`;
    }
  }, 'puzzle-button primary-button');
  $('dialog-actions').append(press);
  puzzleCleanup = () => cancelAnimationFrame(raf);
}
function phoneChallenge() {
  openDialog('La luna ha una password musicale.', 'INCONTRO 03 · TELEFONO INTERPLANETARIO');
  $('dialog-body').append(textBlock('Guarda le quattro luci. Poi ripeti la melodia nello stesso ordine per invitare la luna al vostro appuntamento.'));
  const symbols = ['✦', '♡', '☾', '☀'];
  const labels = ['Stella', 'Cuore', 'Luna', 'Sole'];
  const sequence = [0, 2, 1, 3];
  const grid = document.createElement('div'); grid.className = 'memory-grid';
  const status = textBlock('Premi «Ascolta la luna» per iniziare.', 'puzzle-status');
  status.setAttribute('aria-live', 'polite');
  let index = 0, playingSequence = false, ready = false, timers = [];
  const buttons = symbols.map((symbol, i) => {
    const button = action(symbol, () => {
      if (!ready || playingSequence) return;
      sound.play('click');
      button.classList.add('is-lit');
      timers.push(setTimeout(() => button.classList.remove('is-lit'), 180));
      if (i !== sequence[index]) {
        ready = false;
        sound.play('wrong');
        status.textContent = 'La luna ride: «Riascoltiamo? Abbiamo tutta la notte.»';
        listen.disabled = false;
        return;
      }
      index++;
      status.textContent = `${index} / 4 · ${labels[i]}`;
      if (index === sequence.length) finishQuest('phone');
    }, 'memory-key');
    button.setAttribute('aria-label', labels[i]); button.dataset.note = String(i);
    grid.append(button); return button;
  });
  $('dialog-body').append(grid, status);
  const listen = action('☾  Ascolta la luna', () => {
    if (playingSequence) return;
    timers.forEach(clearTimeout); timers = [];
    buttons.forEach(button => button.classList.remove('is-lit'));
    playingSequence = true; ready = false; index = 0; listen.disabled = true;
    status.textContent = 'Guarda le luci…';
    sequence.forEach((note, i) => {
      timers.push(setTimeout(() => {
        buttons[note].classList.add('is-lit'); sound.play('collect');
        status.textContent = `${i + 1}. ${labels[note]}`;
      }, 400 + i * 750));
      timers.push(setTimeout(() => buttons[note].classList.remove('is-lit'), 900 + i * 750));
    });
    timers.push(setTimeout(() => {
      playingSequence = false; ready = true;
      status.textContent = 'Ora tocca a te. Ripeti le quattro luci.';
    }, 3500));
  }, 'puzzle-button primary-button');
  $('dialog-actions').append(listen);
  puzzleCleanup = () => timers.forEach(clearTimeout);
}
function finale() {
  if (!progress.finish()) { toast('Servono tre ricordi per aprire il nostro appuntamento.'); return; }
  persist();
  setMode('finale');
  $('finale-name').textContent = `${progress.name}.`;
  $('finale-message').textContent = progress.dedication;
  $('finale-star-note').textContent = progress.collected.size === 5 ? 'Hai raccolto tutte le stelle. Ma la più bella sei tu.' : `${progress.collected.size} stelle raccolte. Un intero universo per noi.`;
  sound.play('finale');
  $('finale-dismiss-button').focus();
}
function interact(id) {
  if (mode !== 'playing') return;
  const target = id || nearest?.id;
  if (target === 'portal') { finale(); return; }
  if (!target || !quests[target]) return;
  if (progress.completed.has(target)) { toast('Questo ricordo è già tuo. L’isola ha ancora qualche sorpresa.'); return; }
  ({ cat: catChallenge, washer: washerChallenge, phone: phoneChallenge })[target]();
}

function updateNavigation() {
  const target = progress.portalOpen ? world.portal : world.quests.find(quest => quest.id === activeQuest);
  if (!target) return;
  const dx = target.position.x - player.x, dz = target.position.z - player.z;
  const angle = Math.atan2(-dx, -dz) - yaw;
  const relative = Math.atan2(Math.sin(angle), Math.cos(angle));
  const direction = Math.abs(relative) < 0.4 ? '↑' : Math.abs(relative) > 2.5 ? '↓' : relative > 0 ? '←' : '→';
  $('navigation-hint').textContent = `${direction} ${Math.round(Math.hypot(dx, dz))} m · ${progress.portalOpen ? 'L’arco dell’appuntamento' : quests[activeQuest].short}`;
}
function updateNearby() {
  nearest = null;
  let distance = 5.7;
  const targets = [...world.quests, { ...world.portal, id: 'portal' }];
  for (const target of targets) {
    const d = Math.hypot(player.x - target.position.x, player.z - target.position.z);
    if (d < distance && !progress.completed.has(target.id)) { nearest = target; distance = d; }
  }
  show('interaction', !!nearest);
  $('touch-interact-button').disabled = !nearest;
  if (nearest) {
    $('interaction-label').textContent = nearest.id === 'portal' ? (progress.portalOpen ? 'Il tuo posto, in ogni universo.' : 'L’arco aspetta i vostri tre ricordi.') : quests[nearest.id].title;
    $('interact-button').textContent = coarse ? 'Interagisci' : 'E · Interagisci';
  }
  for (const pickup of world.pickups) {
    if (!progress.collected.has(pickup.gameId) && Math.hypot(player.x - pickup.position.x, player.z - pickup.position.z) < 1.65) {
      if (progress.collect(pickup.gameId)) {
        pickup.object.visible = false;
        sound.play('collect'); persist(); updateHUD();
        toast(`Una stella per te. ✦ ${progress.collected.size} / 5`);
      }
    }
  }
}
function jump() {
  if (mode === 'playing' && jumpHeight <= 0.001) { jumpVelocity = 5.3; sound.play('jump'); }
}
function canWalk(x, z) {
  if (Math.hypot(x, z) > 42) return false;
  return !world.obstacles.some(obstacle => Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + 0.42);
}
function movePlayer(dt) {
  let forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joystick.y;
  let side = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joystick.x;
  const length = Math.hypot(forward, side);
  if (length > 1) { forward /= length; side /= length; }
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 8 : 4.8;
  const dx = (side * Math.cos(yaw) - forward * Math.sin(yaw)) * speed * dt;
  const dz = (-side * Math.sin(yaw) - forward * Math.cos(yaw)) * speed * dt;
  // Resolve axes separately so collisions slide instead of trapping the player.
  if (canWalk(player.x + dx, player.z)) player.x += dx;
  if (canWalk(player.x, player.z + dz)) player.z += dz;
  if (jumpHeight > 0 || jumpVelocity > 0) {
    jumpVelocity -= 13.5 * dt; jumpHeight += jumpVelocity * dt;
    if (jumpHeight < 0) { jumpHeight = 0; jumpVelocity = 0; }
  }
  walkingTime += dt * (length > 0.05 ? speed * 1.4 : 0);
  const bob = length > 0.05 && jumpHeight === 0 ? Math.sin(walkingTime * 2) * 0.024 : 0;
  camera.position.set(player.x, 1.7 + jumpHeight + bob, player.z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  sound.setLocation(player.x, player.z);
}
function rotate(dx, dy) {
  if (mode !== 'playing') return;
  yaw -= dx * (coarse ? 0.005 : 0.0021);
  pitch = THREE.MathUtils.clamp(pitch - dy * (coarse ? 0.004 : 0.0021), -1.25, 1.1);
}

function toggleAudio() {
  const enabled = sound.toggle();
  $('audio-button').setAttribute('aria-pressed', String(enabled));
  $('audio-button').setAttribute('aria-label', enabled ? 'Disattiva suoni' : 'Attiva suoni');
  $('audio-button').innerHTML = enabled ? '♫' : '♫ <span class="sound-off">×</span>';
  $('pause-audio-button').textContent = enabled ? '♫ Musica attiva · disattiva' : '♫ Musica spenta · attiva';
  if (enabled) sound.start();
}

function bindControls() {
  $('start-button').addEventListener('click', begin);
  $('pause-button').addEventListener('click', pause);
  $('help-button').addEventListener('click', pause);
  $('resume-button').addEventListener('click', resume);
  $('close-help-button')?.addEventListener('click', resume);
  $('restart-button').addEventListener('click', restart);
  $('play-again-button').addEventListener('click', restart);
  $('finale-dismiss-button').addEventListener('click', resume);
  $('dialog-close').addEventListener('click', () => closeDialog());
  $('interact-button').addEventListener('click', () => interact());
  $('touch-interact-button').addEventListener('click', () => interact());
  $('jump-button').addEventListener('click', jump);
  $('audio-button').setAttribute('aria-pressed', 'true');
  $('audio-button').addEventListener('click', toggleAudio);
  $('pause-audio-button').addEventListener('click', toggleAudio);
  $('save-settings-button').addEventListener('click', () => {
    progress.personalize($('name-input').value, $('dedication-input').value);
    persist(); applyPersonalization(); toast('La dedica è salvata, qui sul tuo dispositivo. ♡');
  });
  addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === 'Escape') {
      if (mode === 'playing' || mode === 'dialog') pause();
      else if (mode === 'paused') resume();
      return;
    }
    if (mode !== 'playing') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.code === 'KeyE' && !event.repeat) interact();
    if (event.code === 'KeyM' && !event.repeat) toggleAudio();
    if (event.code === 'Space' && !event.repeat) jump();
  });
  addEventListener('keyup', event => keys.delete(event.code));
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && mode === 'playing' && !coarse) pause();
  });
  addEventListener('blur', () => { keys.clear(); if (mode === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); });
  let dragging = false, lastX = 0, lastY = 0, lookId = null;
  renderer.domElement.addEventListener('pointerdown', event => {
    if (mode !== 'playing') return;
    if (!coarse) { lockPointer(); dragging = true; }
    else if (event.clientX > innerWidth * 0.3) lookId = event.pointerId;
    lastX = event.clientX; lastY = event.clientY;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  });
  addEventListener('pointermove', event => {
    if (document.pointerLockElement === renderer.domElement) rotate(event.movementX, event.movementY);
    else if ((!coarse && dragging) || (coarse && event.pointerId === lookId)) {
      rotate(event.clientX - lastX, event.clientY - lastY); lastX = event.clientX; lastY = event.clientY;
    }
  });
  addEventListener('pointerup', () => { dragging = false; lookId = null; });
  addEventListener('pointercancel', () => { dragging = false; lookId = null; });
  const stick = $('joystick');
  const stickMove = event => {
    if (joystick.id !== event.pointerId) return;
    const rect = stick.getBoundingClientRect();
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const radius = rect.width * 0.3, length = Math.hypot(x, y);
    if (length > radius) { x *= radius / length; y *= radius / length; }
    joystick.x = x / radius; joystick.y = y / radius;
    $('joystick-knob').style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };
  stick.addEventListener('pointerdown', event => {
    event.preventDefault(); joystick.id = event.pointerId; stick.setPointerCapture(event.pointerId); stickMove(event);
  });
  stick.addEventListener('pointermove', stickMove);
  const stickEnd = () => { joystick.id = null; joystick.x = joystick.y = 0; $('joystick-knob').style.transform = 'translate(-50%, -50%)'; };
  stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
  // Keep Tab within whichever modal is currently open.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const overlay = mode === 'paused' ? $('pause-overlay') : mode === 'dialog' ? $('dialog-overlay') : mode === 'finale' ? $('finale-overlay') : null;
    if (!overlay) return;
    const focusable = [...overlay.querySelectorAll('button:not(:disabled), input, textarea')].filter(node => !node.hidden && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.25 : 1.6));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.info.autoReset = false;
    world = createWorld({ quality: coarse ? 'low' : 'high' });
    player.copy(world.spawn);
    camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);
    camera.position.copy(player); camera.rotation.set(pitch, yaw, 0, 'YXZ');
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(world.scene, camera));
    if (!coarse) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.22, 0.55, 1.3);
      composer.addPass(bloom);
    }
    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    });
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); pause(); toast('Il browser ha sospeso la grafica. Ricarica la pagina: i ricordi sono salvati.', 12000);
    });
    applyPersonalization(); updateHUD(); bindControls();
    $('start-button').disabled = false;
    if (progress.completed.size > 0) $('start-button').textContent = 'Riprendiamo il nostro sogno';
    show('loading', false);
    requestAnimationFrame(frame);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
      window.__GIULY_TEST__ = {
        state: () => ({ mode, position: player.toArray(), ...progress.toJSON(), portalOpen: progress.portalOpen }),
        teleport: (x, z) => { player.x = x; player.z = z; },
        quest: id => interact(id),
        pickupPositions: () => world.pickups.map(pickup => ({ id: pickup.gameId, x: pickup.position.x, z: pickup.position.z })),
        renderer: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
      };
    }
  } catch (error) {
    console.error('Impossibile avviare il mondo 3D:', error);
    $('loading-label').textContent = 'Il sogno ha bisogno della grafica 3D. Prova Chrome, Edge o Safari aggiornato, con accelerazione hardware attiva.';
    $('start-button').disabled = true;
    show('loading', true);
  }
}
let hudTimer = 0;
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05); lastFrame = now; elapsed += dt;
  if (mode === 'playing') {
    movePlayer(dt);
    hudTimer += dt;
    if (hudTimer > 0.08) { updateNearby(); updateNavigation(); hudTimer = 0; }
  } else if (mode === 'intro') {
    camera.position.set(Math.sin(elapsed * 0.06) * 0.65, 2.1 + Math.sin(elapsed * 0.12) * 0.08, 22);
    camera.lookAt(0, 4.2, -25);
  }
  world.animate(dt, elapsed, progress);
  renderer.info.reset();
  composer.render();
  requestAnimationFrame(frame);
}

init();
