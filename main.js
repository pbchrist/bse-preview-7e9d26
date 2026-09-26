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

  /* ---------- Brand-kit stage: circular rig, haze, distant performance ---------- */
  const stage = new THREE.Group();
  stage.position.set(0.85, -0.75, -5.35);
  stage.scale.setScalar(1.14);
  scene.add(stage);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.72, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2; stage.add(floor);

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x090806, roughness: 0.42, metalness: 0.42 });
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(8.0, 8.35, 0.72, 96), deckMat);
  deck.scale.z = 0.48; deck.position.set(0, 0.36, -1.6); stage.add(deck);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(8.08, 0.045, 12, 160), new THREE.MeshPhysicalMaterial({ color: 0xc79033, metalness: 1, roughness: 0.16, emissive: 0x2b1602, emissiveIntensity: 0.62 }));
  lip.rotation.x = Math.PI / 2; lip.scale.y = 0.48; lip.position.set(0, 0.73, -1.6); stage.add(lip);

  const trussMat = new THREE.MeshStandardMaterial({ color: 0x17130d, roughness: 0.34, metalness: 0.95 });
  const ringRig = new THREE.Group(); ringRig.position.set(0, 8.25, -1.7); stage.add(ringRig);
  for (const [r,tube,op] of [[6.9,.11,1],[5.9,.07,.82],[4.95,.045,.58]]) {
    const m = new THREE.MeshStandardMaterial({ color: op===1?0x3b2914:0x513715, roughness:0.32, metalness:0.95, emissive:0x1d0e01, emissiveIntensity:.38*op });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r,tube,12,180),m); ring.rotation.x=1.18; ring.scale.y=.94; ringRig.add(ring);
  }
  const practicalGeo=new THREE.SphereGeometry(.055,10,8);
  const practicalMat=new THREE.MeshBasicMaterial({color:0xffc96f,transparent:true,opacity:.9});
  for(let i=0;i<28;i++){
    const a=i/28*Math.PI*2, rr=6.55, th=1.18; const l=new THREE.Mesh(practicalGeo,practicalMat);
    const sy=Math.sin(a)*rr; l.position.set(Math.cos(a)*rr,sy*Math.cos(th)-.10,sy*Math.sin(th)); ringRig.add(l);
  }
  const stageGlow=new THREE.PointLight(0xffb45a,11,24,1.8); stageGlow.position.set(0,4.3,1.8); stage.add(stageGlow);
  const rimGlow=new THREE.PointLight(0xffd18c,7,18,2); rimGlow.position.set(-4.2,5.2,2.0); stage.add(rimGlow);
  const lampMat = new THREE.MeshStandardMaterial({ color:0x0b0907,roughness:.28,metalness:.88 });
  const beamMat = new THREE.MeshBasicMaterial({ color:0xffbd65,transparent:true,opacity:.044,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide });
  const beamMatHot = new THREE.MeshBasicMaterial({ color:0xffd690,transparent:true,opacity:.068,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide });
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2, rx=Math.cos(a)*5.7, rz=Math.sin(a)*3.75;
    const can=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,.42,16),lampMat); can.position.set(rx,-.18,rz); ringRig.add(can);
    if(i%2===0 || i===3 || i===11){
      const target=new THREE.Vector3(Math.cos(a)*2.2,-8.0,Math.sin(a)*1.1-0.2);
      const from=new THREE.Vector3(rx,-.32,rz); const dir=target.clone().sub(from); const len=dir.length();
      const beam=new THREE.Mesh(new THREE.ConeGeometry(i%4===0?.72:.5,len,28,1,true),i%4===0?beamMatHot:beamMat.clone());
      beam.position.copy(from.clone().add(target).multiplyScalar(.5));
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),dir.clone().normalize());
      ringRig.add(beam);
    }
  }

  // distant band line — enough human scale to read as a live room, never a foreground silhouette
  const blackMat = new THREE.MeshBasicMaterial({ color:0x010101 });
  const riser = new THREE.Mesh(new THREE.BoxGeometry(7.0,.34,1.2),blackMat); riser.position.set(0,.90,-1.65); stage.add(riser);
  for(let i=-3;i<=3;i++){
    const person=new THREE.Group(); person.position.set(i*1.03,1.38,-1.52 + Math.abs(i)*.05); stage.add(person);
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.42,3,8),blackMat); person.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.145,12,10),blackMat); head.position.y=.42; person.add(head);
    if(i!==0){ const stand=new THREE.Mesh(new THREE.BoxGeometry(.025,.72,.025),blackMat); stand.position.set(.20,.18,.08); stand.rotation.z=i<0?-.16:.16; person.add(stand); }
  }
  const backPracticalMat=new THREE.MeshBasicMaterial({color:0xffc66b,transparent:true,opacity:.88});
  for(let i=-4;i<=4;i++){
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),backPracticalMat); bulb.position.set(i*1.35,2.65,-3.35); stage.add(bulb);
  }

  // low audience silhouette line, kept below the stage sightline
  const crowd=new THREE.Group(); crowd.position.set(0,.15,5.5); stage.add(crowd);
  for(let i=0;i<42;i++){
    const x=(i/41-.5)*18 + (Math.random()-.5)*.24;
    const z=(Math.random()-.5)*1.4;
    const h=.22+Math.random()*.25;
    const person=new THREE.Mesh(new THREE.CapsuleGeometry(.08,.18+h,3,6),blackMat); person.position.set(x,h*.55,z); crowd.add(person);
  }

  /* ---------- Brand-kit Genesis object: liquid black + molten gold ---------- */
  const genesis = new THREE.Group();
  genesis.position.set(3.55, 5.25, 1.15);
  genesis.scale.setScalar(0.84);
  scene.add(genesis);

  class LiquidLoop extends THREE.Curve {
    constructor(phase=0, wobble=1){ super(); this.phase=phase; this.wobble=wobble; }
    getPoint(t,target=new THREE.Vector3()){
      const a=t*Math.PI*2, p=this.phase;
      const r=2.72 + .34*Math.sin(a*3+p) + .15*Math.sin(a*7-p*.7);
      const x=r*Math.cos(a);
      const y=(2.06 + .18*Math.sin(a*2+p))*Math.sin(a) + .20*Math.sin(a*5+p);
      const z=.62*Math.sin(a*2+p) + .26*Math.cos(a*4-p) + .12*Math.sin(a*9+p);
      return target.set(x,y,z);
    }
  }
  const goldMat = new THREE.MeshPhysicalMaterial({color:0xf3b94f,metalness:1,roughness:.105,clearcoat:1,clearcoatRoughness:.035,envMap,envMapIntensity:2.5,emissive:0x3d1d02,emissiveIntensity:.58});
  const blackLiquidMat = new THREE.MeshPhysicalMaterial({color:0x030303,metalness:.96,roughness:.075,clearcoat:1,clearcoatRoughness:.025,envMap,envMapIntensity:2.15});
  const champagneMat = new THREE.MeshPhysicalMaterial({color:0xffdf8f,metalness:1,roughness:.08,clearcoat:1,clearcoatRoughness:.02,envMap,envMapIntensity:2.8,emissive:0x4e2503,emissiveIntensity:.42});

  const liquidParts=[];
  const loopSpecs=[
    [new LiquidLoop(0.0), .43, blackLiquidMat, 0.0, 0.0, 0.0],
    [new LiquidLoop(1.25), .34, goldMat, .08, .08, .16],
    [new LiquidLoop(3.0), .22, champagneMat, -.05, -.12, -.13],
    [new LiquidLoop(4.2), .16, goldMat, .04, .14, -.08]
  ];
  for(const [curve,rad,mat,ox,oy,oz] of loopSpecs){
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve, innerWidth<760?180:260, rad, innerWidth<760?10:14, true),mat);
    mesh.position.set(ox,oy,oz); genesis.add(mesh); liquidParts.push(mesh);
  }
  // black glass under-core makes the object read as liquid black/gold, not a clean gold ribbon
  const core=new THREE.Mesh(new THREE.TorusGeometry(2.28,.34,18,180),blackLiquidMat.clone());
  core.scale.set(1,.76,1); core.rotation.set(.92,.05,.28); core.material.roughness=.04; genesis.add(core); liquidParts.push(core);

  // molten beads splashing off the mass
  const beadGeo=new THREE.SphereGeometry(.075,20,14), beads=[];
  for(let i=0;i<22;i++){
    const b=new THREE.Mesh(beadGeo,i%4===0?champagneMat:goldMat);
    const a=Math.random()*Math.PI*2, rr=3.1+Math.random()*1.9;
    b.position.set(Math.cos(a)*rr,(Math.random()-.4)*4.8,Math.sin(a)*rr*.45);
    const sc=.35+Math.random()*1.15; b.scale.set(sc,sc*(.65+Math.random()*.9),sc); genesis.add(b); beads.push(b);
  }

  // slow liquid droplets shedding from the object
  const dropGeo = new THREE.SphereGeometry(0.07, 20, 14);
  const droplets=[];
  for(let n=0;n<7;n++){
    const m=new THREE.Mesh(dropGeo,n%3===0?champagneMat:goldMat.clone()); genesis.add(m);
    droplets.push({m,seed:Math.random()*10,baseX:(Math.random()-.5)*4.1,baseZ:(Math.random()-.5)*1.8});
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
  const glow = new THREE.PointLight(0xffb45c, 42, 26, 1.65); glow.position.set(0, 4.6, 0.6); scene.add(glow);
  const underGlow = new THREE.PointLight(0xff9a3a, 7.5, 18, 1.85); underGlow.position.set(0, 4.2, 4.5); scene.add(underGlow);
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
    stage.position.set(mobile ? 0 : 0.85, mobile ? -2.0 : -0.75, mobile ? -4.8 : -5.35);
    stage.scale.setScalar(mobile ? 0.76 : 1.14);
    genesis.position.x = mobile ? 0 : 3.55;
    genesis.scale.setScalar(mobile ? 0.72 : 0.84);
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

    liquidParts.forEach((p,i)=>{ p.rotation.z=Math.sin(t*.19+i)*.018; p.rotation.x=Math.cos(t*.16+i*.7)*.014; });
    beads.forEach((b,i)=>{ b.position.y += Math.sin(t*.55+i*1.7)*.0009; b.rotation.y=t*(.06+(i%4)*.008); });
    droplets.forEach((p,i)=>{
      const cyc=((t*.12+p.seed)%1);
      p.m.position.set(p.baseX,1.7-cyc*6.0,p.baseZ);
      const fade=Math.sin(Math.PI*cyc); p.m.scale.set(.7,.75+cyc*2.2,.7); p.m.material.transparent=true; p.m.material.opacity=Math.max(0,fade*.78);
    });

    genesis.rotation.y = 0.14 + Math.sin(t * 0.18) * 0.24 + mx * 0.24;
    genesis.rotation.x = -0.08 + Math.sin(t * 0.27) * 0.055 + my * 0.08;
    genesis.rotation.z = -0.10 + Math.sin(t * 0.13) * 0.055;
    genesis.position.y = (mobile ? 5.15 : 5.25) + Math.sin(t * 0.55) * 0.10;
    orbits[0].rotation.z = t * 0.05; orbits[1].rotation.z = -t * 0.04;
    dustMat.uniforms.uTime.value = t;
    glow.intensity = 30 + Math.sin(t * 0.9) * 3;

    camera.position.set(camBase.x + mx * 1.0, camBase.y - my * 0.55, camBase.z + (mobile ? 6 : 0));
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
