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
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}

if (renderer) {
  document.documentElement.classList.add('webgl-ready');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.set(0, 0, 13.2);

  // High-contrast studio environment for polished gold reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x010101);
  const panel = (w, h, color, intensity, pos, rot) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(...pos); mesh.rotation.set(...rot); envScene.add(mesh);
  };
  panel(15, 1.5, 0xfff0c4, 10, [0, 7, 3], [-0.7, 0, 0]);
  panel(1.2, 11, 0xffbd58, 7, [-8, 0, 1], [0, Math.PI / 2, 0]);
  panel(1.2, 11, 0xffe5a6, 8, [8, 1, -1], [0, -Math.PI / 2, 0]);
  panel(9, 1, 0xffffff, 18, [1, 2.5, 7], [0, Math.PI, -0.25]);
  panel(10, 2, 0xe77b18, 3.5, [0, -5, 4], [0.45, 0, 0]);
  const envMap = pmrem.fromScene(envScene, 0.025).texture;

  function buildMobiusGeometry(segments = 300, across = 26, radius = 3.0, halfWidth = 1.08, thickness = 0.095) {
    const positions = [];
    const indices = [];
    const layerSize = (segments + 1) * across;

    function point(u, v) {
      const cu = Math.cos(u), su = Math.sin(u), ch = Math.cos(u * 0.5), sh = Math.sin(u * 0.5);
      const breathing = 1 + 0.018 * Math.cos(u * 3) - 0.012 * Math.sin(u * 5);
      const rr = radius * breathing + v * ch;
      return new THREE.Vector3(rr * cu, v * sh, rr * su);
    }

    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * Math.PI * 2;
      for (let j = 0; j < across; j++) {
        const v = ((j / (across - 1)) * 2 - 1) * halfWidth;
        const p = point(u, v);
        const pu = point(u + 0.0008, v).sub(point(u - 0.0008, v));
        const pv = point(u, v + 0.0008).sub(point(u, v - 0.0008));
        const n = new THREE.Vector3().crossVectors(pu, pv).normalize();
        const front = p.clone().addScaledVector(n, thickness * 0.5);
        const back = p.clone().addScaledVector(n, -thickness * 0.5);
        positions.push(front.x, front.y, front.z);
        positions.push(back.x, back.y, back.z);
      }
    }

    const idx = (i, j, side) => ((i * across + j) * 2 + side);
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < across - 1; j++) {
        const a = idx(i, j, 0), b = idx(i + 1, j, 0), c = idx(i + 1, j + 1, 0), d = idx(i, j + 1, 0);
        indices.push(a, b, d, b, c, d);
        const ab = idx(i, j, 1), bb = idx(i + 1, j, 1), cb = idx(i + 1, j + 1, 1), db = idx(i, j + 1, 1);
        indices.push(ab, db, bb, bb, db, cb);
      }
      for (const j of [0, across - 1]) {
        const a = idx(i, j, 0), b = idx(i + 1, j, 0), c = idx(i + 1, j, 1), d = idx(i, j, 1);
        if (j === 0) indices.push(a, d, b, b, d, c); else indices.push(a, b, d, b, c, d);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xe9aa3f,
    metalness: 1,
    roughness: 0.07,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    envMap,
    envMapIntensity: 3.5,
    emissive: new THREE.Color(0x3c1a01),
    emissiveIntensity: 0.34,
    side: THREE.DoubleSide
  });

  const mobius = new THREE.Group();
  const ribbon = new THREE.Mesh(buildMobiusGeometry(innerWidth < 760 ? 190 : 320, innerWidth < 760 ? 18 : 30), gold);
  mobius.add(ribbon);

  // A soft inner echo adds liquid depth without changing the silhouette.
  const echo = new THREE.Mesh(buildMobiusGeometry(innerWidth < 760 ? 150 : 230, innerWidth < 760 ? 14 : 22, 2.94, 1.02, 0.045), gold.clone());
  echo.material.color.set(0x7e470f);
  echo.material.envMapIntensity = 2.1;
  echo.material.emissiveIntensity = 0.14;
  echo.scale.setScalar(0.992);
  mobius.add(echo);

  mobius.rotation.set(0.22, -0.34, -0.17);
  scene.add(mobius);

  // Orbiting filament energy and star-like points.
  const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffc96d, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  const orbits = [];
  [[4.1, 1.22, 0.18, 0.12], [4.55, 1.05, -0.28, -0.42], [3.85, 1.46, 0.36, 0.72]].forEach(([r, x, y, z], i) => {
    const o = new THREE.Mesh(new THREE.TorusGeometry(r, i === 0 ? 0.012 : 0.007, 7, 360), orbitMat.clone());
    o.rotation.set(x, y, z); mobius.add(o); orbits.push(o);
  });

  const COUNT = innerWidth < 760 ? 360 : 760;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.8 + Math.pow(Math.random(), 0.55) * 5.3;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (Math.random() - 0.48) * 6.2;
    pos[i * 3 + 2] = Math.sin(a) * r * 0.45;
    seed[i] = Math.random();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uPx; varying float vA;
      void main(){ vec3 p=position; p.y += sin(uTime*.24 + seed*45.)*.22; p.x += cos(uTime*.16 + seed*35.)*.18;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        vA=.18+.82*pow(.5+.5*sin(uTime*(.45+seed)+seed*90.),4.);
        gl_PointSize=(1.0+seed*2.6)*uPx*(24./-mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(1.,.76,.35,a*vA*.78); }`
  });
  const dust = new THREE.Points(pg, dustMat); mobius.add(dust);

  // A screen-facing halo gives the same luminous presence as the brand-kit render.
  const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 256;
  const hg = haloCanvas.getContext('2d');
  const grad = hg.createRadialGradient(128,128,0,128,128,128);
  grad.addColorStop(0,'rgba(255,201,105,.40)'); grad.addColorStop(.22,'rgba(242,158,49,.16)'); grad.addColorStop(.62,'rgba(150,72,10,.035)'); grad.addColorStop(1,'rgba(0,0,0,0)');
  hg.fillStyle=grad; hg.fillRect(0,0,256,256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(haloCanvas), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:.86 }));
  halo.scale.set(13,13,1); halo.position.z=-1.4; mobius.add(halo);

  const key = new THREE.PointLight(0xffbf62, 16, 18, 1.65); key.position.set(-1.5,2.5,4.5); scene.add(key);
  const rim = new THREE.PointLight(0xffe2a0, 11, 16, 1.9); rim.position.set(3.6,-1.5,4); scene.add(rim);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1,1), 1.1, 0.56, 0.64);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let mobile = false;
  function resize(){
    const w=hero.clientWidth, h=hero.clientHeight;
    mobile=w<760;
    renderer.setSize(w,h,false); composer.setSize(w,h); bloom.setSize(w,h);
    camera.aspect=w/h;
    camera.fov=mobile?36:31;
    camera.updateProjectionMatrix();
    if(mobile){
      mobius.position.set(0,-3.0,0);
      mobius.scale.setScalar(.68);
      camera.position.z=14.7;
    }else{
      mobius.position.set(3.4,.55,0);
      mobius.scale.setScalar(1.0);
      camera.position.z=13.2;
    }
    dustMat.uniforms.uPx.value=renderer.getPixelRatio();
  }
  new ResizeObserver(resize).observe(hero); resize();

  let tx=0,ty=0,mx=0,my=0;
  addEventListener('pointermove',e=>{tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5;},{passive:true});
  let visible=true;
  new IntersectionObserver(([e])=>visible=e.isIntersecting).observe(hero);
  const clock=new THREE.Clock();
  function tick(){
    requestAnimationFrame(tick);
    if(!visible) return;
    const t=reduced?2.5:clock.getElapsedTime();
    mx+=(tx-mx)*.035; my+=(ty-my)*.035;
    mobius.rotation.y=-.34 + Math.sin(t*.18)*.08 + mx*.14;
    mobius.rotation.x=.22 + Math.sin(t*.22)*.045 + my*.07;
    mobius.rotation.z=-.17 + Math.sin(t*.13)*.028;
    mobius.position.y=(mobile?-3.0:.55)+Math.sin(t*.55)*.07;
    orbits[0].rotation.z=t*.045; orbits[1].rotation.z=-t*.035; orbits[2].rotation.z=t*.026;
    dustMat.uniforms.uTime.value=t;
    composer.render();
  }
  tick();
}

const menu=document.querySelector('#menuToggle'), nav=document.querySelector('#mobileNav');
menu?.addEventListener('click',()=>{const open=nav.hidden;nav.hidden=!open;menu.setAttribute('aria-expanded',String(open));});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.hidden=true;menu.setAttribute('aria-expanded','false');}));
const header=document.querySelector('.site-header');
const onScroll=()=>header.classList.toggle('scrolled',scrollY>40);
addEventListener('scroll',onScroll,{passive:true});onScroll();
const revealEls=[...document.querySelectorAll('.section-head,.cap-grid article,.proof-row b,.about-copy,.about-orbit,.partner-copy,.partner-cards article,.contact>*')];
revealEls.forEach(el=>{el.style.opacity='0';el.style.transform='translateY(22px)';});
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.animate([{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}],{duration:750,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});io.unobserve(e.target);}}),{threshold:.12});
revealEls.forEach(el=>io.observe(el));
