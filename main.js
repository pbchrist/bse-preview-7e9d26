import * as THREE from 'three';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';

const canvas = document.querySelector('#genesis');
const hero = document.querySelector('.hero');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) { document.documentElement.classList.add('no-webgl'); }

if (renderer) {
  document.documentElement.classList.add('webgl-ready');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x030303, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030303);
  scene.fog = new THREE.FogExp2(0x030303, 0.017);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  const camBase = new THREE.Vector3(0, 3.6, 46);
  const lookAt = new THREE.Vector3(0, 4.3, 0);

  /* ---------- Studio environment: warm softboxes on black, for gold reflections only ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);
  const panel = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); envScene.add(m);
  };
  panel(14, 2.2, 0xfff1d6, 9, [0, 8, 0], [Math.PI / 2, 0, 0]);          // overhead strip
  panel(1.4, 10, 0xffc27a, 5, [-9, 1, 2], [0, Math.PI / 2, 0]);         // left strip
  panel(1.4, 10, 0xffe2b0, 6, [9, 2, -2], [0, -Math.PI / 2, 0]);        // right strip
  panel(10, 3, 0xff9a3c, 2.2, [0, -1, -10], [0, 0, 0]);                 // warm back glow
  panel(6, 1.2, 0xffffff, 12, [3, 5, 9], [-0.6, Math.PI, 0]);           // front key kicker
  panel(20, 20, 0x2a1606, 1, [0, -9, 0], [-Math.PI / 2, 0, 0]);         // bounce floor
  panel(18, 5, 0xffcf8a, 3.2, [0, 7, 12], [-0.5, 0, 0]);                // big warm scrim over the camera
  panel(8, 0.5, 0xffffff, 16, [-4, 3, 11], [0, 0.3, 0.2]);              // crisp edge highlight
  panel(12, 3, 0xb86a1e, 1.6, [0, -4, 9], [0.6, 0, 0]);                 // amber under-bounce
  const envMap = pmrem.fromScene(envScene, 0.035).texture;

  /* ---------- The stage: empty, unlit, far away ---------- */
  const stage = new THREE.Group();
  scene.add(stage);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0x0b0a08, roughness: 0.62, metalness: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2; stage.add(floor);

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.55, metalness: 0.25 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(15, 1.15, 6), deckMat);
  deck.position.set(0, 0.575, -1); stage.add(deck);
  // lacquered deck surface — mirrors the gold above it
  const deckTop = new THREE.Mesh(new THREE.PlaneGeometry(14.9, 5.9), new THREE.MeshStandardMaterial({ color: 0x120e0a, roughness: 0.18, metalness: 0.75, envMap, envMapIntensity: 0.08 }));
  deckTop.rotation.x = -Math.PI / 2; deckTop.position.set(0, 1.152, -1); stage.add(deckTop);
  // polished lip on the deck edge — catches the gold
  const lip = new THREE.Mesh(new THREE.BoxGeometry(15.02, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x6b4a1c, roughness: 0.25, metalness: 1 }));
  lip.position.set(0, 1.15, 2.0); stage.add(lip);
  // step unit
  const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 0.9), deckMat);
  step.position.set(0, 0.275, 2.45); stage.add(step);

  // back wall + wings: pure black masking
  const maskMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, metalness: 0 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), new THREE.MeshBasicMaterial({ color: 0x030303 })); back.position.set(0, 9, -4.2); stage.add(back);

  // box truss silhouette: two towers + header, thin and architectural
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x16130f, roughness: 0.45, metalness: 0.9 });
  const truss = new THREE.Group(); stage.add(truss);
  const bar = (len, axis, x, y, z) => {
    const g = axis === 'y' ? new THREE.BoxGeometry(0.07, len, 0.07) : new THREE.BoxGeometry(len, 0.07, 0.07);
    const m = new THREE.Mesh(g, trussMat); m.position.set(x, y, z); truss.add(m);
  };
  for (const x of [-7.2, 7.2]) for (const dx of [-0.25, 0.25]) for (const dz of [-0.25, 0.25]) bar(8.6, 'y', x + dx, 1.15 + 4.3, -2.6 + dz);
  for (const dy of [-0.25, 0.25]) for (const dz of [-0.25, 0.25]) bar(14.9, 'x', 0, 9.2 + dy, -2.6 + dz);
  // dark, unlit fixtures hanging from the header
  const fixMat = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.35, metalness: 0.8 });
  for (let i = -3; i <= 3; i++) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.62, 20), fixMat);
    can.position.set(i * 1.9, 8.55, -2.6); can.rotation.x = 0.35; truss.add(can);
  }
  // speaker columns flanking
  for (const x of [-8.6, 8.6]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.8, 1.0), fixMat);
    col.position.set(x, 1.9, 0.6); stage.add(col);
  }

  /* ---------- The Genesis object: molten gold Möbius ---------- */
  const genesis = new THREE.Group();
  genesis.position.set(0, 5.1, 0.4);
  genesis.scale.setScalar(1.18);
  scene.add(genesis);

  const N = innerWidth < 760 ? 360 : 520, M = 40;                 // rings along the band, points around the profile (even)
  const R = 2.3, HALF_W = 0.92, HALF_T = 0.075;
  const tilt = new THREE.Euler(0.95, 0.0, 0.28);
  const tiltM = new THREE.Matrix4().makeRotationFromEuler(tilt);

  const positions = new Float32Array(N * M * 3);
  const idx = [];
  for (let i = 0; i < N; i++) {
    const ni = (i + 1) % N, wrap = ni === 0;
    for (let k = 0; k < M; k++) {
      const nk = (k + 1) % M;
      const a = i * M + k, b = i * M + nk;
      const c = ni * M + ((wrap ? k + M / 2 : k) % M);
      const d = ni * M + ((wrap ? nk + M / 2 : nk) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  band.setIndex(idx);

  // superellipse profile — soft, poured edges rather than a hard ribbon
  const prof = [];
  for (let k = 0; k < M; k++) {
    const th = (k / M) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    prof.push([Math.sign(c) * Math.pow(Math.abs(c), 0.42), Math.sign(s) * Math.pow(Math.abs(s), 0.42)]);
  }

  const drips = [0.18, 0.47, 0.81].map((u0, n) => ({ u0, phase: n * 2.3, len: 0 }));
  const v = new THREE.Vector3();
  const tmp = [];

  function sculpt(t) {
    const flow = t * 0.55;
    for (let i = 0; i < N; i++) {
      const u = (i / N) * Math.PI * 2;
      const half = u / 2;
      const swell = 1 + 0.1 * Math.sin(u * 2 + flow) + 0.035 * Math.sin(u * 5 - flow * 1.4);
      const w = HALF_W * swell;
      const th = HALF_T * (1.1 + 0.25 * Math.sin(u * 3 + flow * 0.8));
      const cu = Math.cos(u), su = Math.sin(u), ch = Math.cos(half), sh = Math.sin(half);
      for (let k = 0; k < M; k++) {
        const px = prof[k][0] * w, py = prof[k][1] * th;
        // rotate profile by half-angle in the (radial, z) plane
        const rad = px * ch - py * sh;
        const z = px * sh + py * ch;
        const r = R + rad + 0.018 * Math.sin(u * 4 + flow * 1.2);
        v.set(r * cu, r * su, z).applyMatrix4(tiltM);
        // gravity: the lower half sags like warm metal
        const low = Math.max(0, -v.y - 0.6);
        v.y -= low * low * 0.07;
        // drips forming along the underside
        for (const d of drips) {
          let du = Math.abs(i / N - d.u0); du = Math.min(du, 1 - du);
          const g = Math.exp(-(du * du) / 0.00035);
          if (g > 0.001 && v.y < -0.4) v.y -= g * d.len * Math.min(1, (-v.y - 0.4) * 1.5) * (0.6 + 0.4 * prof[k][1] * -1 + 0.4);
          v.x += 0; // keep lateral
        }
        const o = (i * M + k) * 3;
        positions[o] = v.x; positions[o + 1] = v.y; positions[o + 2] = v.z;
      }
    }
    band.attributes.position.needsUpdate = true;
    band.computeVertexNormals();
  }

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.72, 0.33),
    metalness: 1, roughness: 0.11,
    clearcoat: 1, clearcoatRoughness: 0.05,
    envMap, envMapIntensity: 2.1,
    emissive: new THREE.Color(0x3a1c03), emissiveIntensity: 0.55,
  });
  const mobius = new THREE.Mesh(band, goldMat);
  genesis.add(mobius);

  // falling droplets
  const dropGeo = new THREE.SphereGeometry(0.07, 24, 16);
  const droplets = [];
  for (let n = 0; n < 5; n++) {
    const m = new THREE.Mesh(dropGeo, goldMat.clone());
    m.material.transparent = true; m.visible = false; genesis.add(m);
    droplets.push({ m, vy: 0, alive: false });
  }
  function releaseDrop(d) {
    const i = Math.round(d.u0 * N) % N;
    let lowest = null, ly = Infinity;
    for (let k = 0; k < M; k++) { const o = (i * M + k) * 3; if (positions[o + 1] < ly) { ly = positions[o + 1]; lowest = o; } }
    const slot = droplets.find(p => !p.alive); if (!slot) return;
    slot.alive = true; slot.vy = 0; slot.m.visible = true; slot.m.material.opacity = 1;
    slot.m.position.set(positions[lowest], positions[lowest + 1], positions[lowest + 2]);
    slot.m.scale.set(1, 1.6, 1);
  }

  // halo orbits + gold dust
  const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffc56a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const orbits = [];
  for (const [s, rx, ry, rz] of [[3.35, 1.35, 0.1, 0.2], [3.9, 1.2, -0.35, -0.5]]) {
    const o = new THREE.Mesh(new THREE.TorusGeometry(s, 0.006, 6, 320), orbitMat.clone());
    o.rotation.set(rx, ry, rz); genesis.add(o); orbits.push(o);
  }
  const DUST = 700, dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = Math.random() * Math.PI * 2, rr = 1.2 + Math.pow(Math.random(), 0.6) * 6.5;
    dp[i * 3] = Math.cos(a) * rr; dp[i * 3 + 1] = (Math.random() - 0.35) * 7; dp[i * 3 + 2] = Math.sin(a) * rr * 0.6;
    ds[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(ds, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uPx; varying float vA;
      void main(){ vec3 p = position; p.y += sin(uTime*.25 + seed*40.)*.25; p.x += cos(uTime*.18 + seed*30.)*.2;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        vA = .25 + .75*pow(.5+.5*sin(uTime*(.6+seed)+seed*80.), 3.);
        gl_PointSize = (1.2 + seed*2.2) * uPx * (22. / -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d);
        gl_FragColor = vec4(1., .78, .42, a*vA*.8); }`,
  });
  genesis.add(new THREE.Points(dustGeo, dustMat));

  // haze volume: soft light spilling down from the object onto the empty stage
  const hazeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,190,100,.5)'); gr.addColorStop(.22, 'rgba(210,130,50,.18)'); gr.addColorStop(.55, 'rgba(120,60,15,.04)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  })();
  const hazeMat = new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32, fog: false });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), hazeMat);
  haze.position.set(0, 5.2, -3.9); scene.add(haze);
  const backHaze = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), hazeMat.clone());
  backHaze.material.opacity = 0.16; backHaze.position.set(0, 5.5, -4.05); scene.add(backHaze);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 5), hazeMat.clone());
  pool.material.opacity = 0.22; pool.rotation.x = -Math.PI / 2; pool.position.set(0, 1.17, -0.8); scene.add(pool);

  // the only light in the room comes from the gold
  const glow = new THREE.PointLight(0xffb45c, 30, 22, 1.7); glow.position.set(0, 4.6, 0.6); scene.add(glow);
  const underGlow = new THREE.PointLight(0xff9a3a, 3.5, 12, 2); underGlow.position.set(0, 4.2, 4.5); scene.add(underGlow);
  scene.add(new THREE.HemisphereLight(0x1a1410, 0x000000, 0.35));

  /* ---------- Post ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.55, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- Layout ---------- */
  let mobile = false;
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    mobile = w < 760;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h;
    // push the composition right on desktop so the headline owns the left third
    if (!mobile) camera.setViewOffset(w, h, -w * 0.17, 0, w, h); else camera.setViewOffset(w, h, 0, -h * 0.25, w, h);
    camera.fov = mobile ? 50 : 26;
    camera.updateProjectionMatrix();
    dustMat.uniforms.uPx.value = renderer.getPixelRatio();
  }
  new ResizeObserver(resize).observe(hero); resize();

  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  const clock = new THREE.Clock();
  let last = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const t = reduced ? 4 : clock.getElapsedTime();
    const dt = Math.min(0.05, t - last); last = t;
    mx += (tx - mx) * 0.03; my += (ty - my) * 0.03;

    // drips grow, stretch, then let go
    for (const d of drips) {
      const cyc = ((t * 0.22 + d.phase) % 3.2) / 3.2;
      const prev = d.len;
      d.len = Math.pow(cyc, 2.4) * 1.25;
      if (!reduced && prev > 0.9 && d.len < prev) releaseDrop(d);
    }
    sculpt(t);
    for (const p of droplets) {
      if (!p.alive) continue;
      p.vy -= 9.8 * dt * 0.35; p.m.position.y += p.vy * dt;
      p.m.scale.y = 1.2 + Math.min(1.6, -p.vy * 0.5);
      p.m.material.opacity = Math.max(0, Math.min(1, (p.m.position.y + 3.4) / 1.4));
      if (p.m.position.y < -3.9) { p.alive = false; p.m.visible = false; }
    }

    genesis.rotation.y = t * 0.16 + mx * 0.5;
    genesis.rotation.x = Math.sin(t * 0.3) * 0.05 + my * 0.12;
    genesis.position.y = (mobile ? 6.0 : 5.4) + Math.sin(t * 0.6) * 0.12;
    orbits[0].rotation.z = t * 0.05; orbits[1].rotation.z = -t * 0.04;
    dustMat.uniforms.uTime.value = t;
    glow.intensity = 30 + Math.sin(t * 0.9) * 3;

    camera.position.set(camBase.x + mx * 1.6, camBase.y - my * 0.8, camBase.z + (mobile ? 6 : 0));
    camera.lookAt(lookAt.x, lookAt.y + (mobile ? 0.6 : 0), lookAt.z);
    composer.render();
  }
  tick();
}

/* ---------- UI ---------- */
const menu = document.querySelector('#menuToggle'), nav = document.querySelector('#mobileNav');
menu?.addEventListener('click', () => { const open = nav.hidden; nav.hidden = !open; menu.setAttribute('aria-expanded', String(open)); });
nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.hidden = true; menu.setAttribute('aria-expanded', 'false'); }));

const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

const revealEls = [...document.querySelectorAll('.section-head,.cap-grid article,.proof-row b,.about-copy,.about-orbit,.partner-copy,.partner-cards article,.contact>*')];
revealEls.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(22px)'; });
const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 750, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }); io.unobserve(e.target); } }), { threshold: 0.12 });
revealEls.forEach(el => io.observe(el));
