import * as THREE from './three.module.min.js';

const canvas = document.querySelector('#genesis');
const hero = document.querySelector('.hero');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, preserveDrawingBuffer:true, powerPreference:'high-performance'});
document.documentElement.classList.add('webgl-ready');
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const camera = new THREE.PerspectiveCamera(33, 1, .1, 100);
camera.position.set(0, .15, 12);

const world = new THREE.Group();
world.position.set(2.25, .6, 0);
scene.add(world);

function mobiusGeometry(segments=420, widthSegments=22, radius=2.35, halfWidth=.48){
  const pos=[], norm=[], uv=[], idx=[];
  for(let i=0;i<=segments;i++){
    const u=i/segments*Math.PI*2;
    for(let j=0;j<=widthSegments;j++){
      const t=(j/widthSegments-.5)*2*halfWidth;
      const x=(radius+t*Math.cos(u/2))*Math.cos(u);
      const y=(radius+t*Math.cos(u/2))*Math.sin(u);
      const z=t*Math.sin(u/2);
      pos.push(x,y,z); uv.push(i/segments,j/widthSegments);
      const eps=.001;
      const tx=(radius+(t+eps)*Math.cos(u/2))*Math.cos(u)-x;
      const ty=(radius+(t+eps)*Math.cos(u/2))*Math.sin(u)-y;
      const tz=(t+eps)*Math.sin(u/2)-z;
      const u2=u+eps;
      const ux=(radius+t*Math.cos(u2/2))*Math.cos(u2)-x;
      const uy=(radius+t*Math.cos(u2/2))*Math.sin(u2)-y;
      const uz=t*Math.sin(u2/2)-z;
      const n=new THREE.Vector3(tx,ty,tz).cross(new THREE.Vector3(ux,uy,uz)).normalize();
      norm.push(n.x,n.y,n.z);
    }
  }
  const row=widthSegments+1;
  for(let i=0;i<segments;i++) for(let j=0;j<widthSegments;j++){const a=i*row+j,b=a+row,c=b+1,d=a+1;idx.push(a,b,d,b,c,d)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();return g;
}

const gold = new THREE.MeshPhysicalMaterial({color:0xd69b3c,metalness:1,roughness:.16,clearcoat:1,clearcoatRoughness:.08,side:THREE.DoubleSide,emissive:0x2a1302,emissiveIntensity:.45});
const mobius = new THREE.Mesh(mobiusGeometry(), gold);
mobius.rotation.set(.75,.35,-.3);
world.add(mobius);

const inner = new THREE.Mesh(mobiusGeometry(300,12,2.05,.08), new THREE.MeshBasicMaterial({color:0xffd97c,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
inner.rotation.copy(mobius.rotation);world.add(inner);

const ringMat=new THREE.MeshBasicMaterial({color:0xc88a2f,transparent:true,opacity:.19,blending:THREE.AdditiveBlending});
for(const [scale,rx,ry] of [[1.25,1.2,.18],[1.48,.35,1.05],[1.72,.55,.65]]){const r=new THREE.Mesh(new THREE.TorusGeometry(2.05*scale,.007,5,180),ringMat.clone());r.rotation.set(rx,ry,Math.random()*2);world.add(r)}

const particles=240;
const pa=new Float32Array(particles*3), pc=new Float32Array(particles*3);
for(let i=0;i<particles;i++){const a=Math.random()*Math.PI*2,rad=2.9+Math.random()*3.2,h=(Math.random()-.5)*3.5;pa[i*3]=Math.cos(a)*rad;pa[i*3+1]=h;pa[i*3+2]=Math.sin(a)*rad*.42;const hot=Math.random();pc[i*3]=1;pc[i*3+1]=.52+.4*hot;pc[i*3+2]=.12+.35*hot}
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pa,3));pg.setAttribute('color',new THREE.BufferAttribute(pc,3));
const pm=new THREE.PointsMaterial({size:.035,vertexColors:true,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false});
const points=new THREE.Points(pg,pm);world.add(points);

// Miniature stage below the object: distant, elegant, intentionally small.
const stage=new THREE.Group();stage.position.set(.2,-3.55,-.7);stage.scale.set(.68,.68,.68);world.add(stage);
const stageMat=new THREE.MeshStandardMaterial({color:0x17120c,metalness:.65,roughness:.5});
const stageGold=new THREE.MeshBasicMaterial({color:0xf2b548,transparent:true,opacity:.85});
const deck=new THREE.Mesh(new THREE.BoxGeometry(5.2,.12,1.7),stageMat);stage.add(deck);
const trussTop=new THREE.Mesh(new THREE.BoxGeometry(5.6,.05,.05),stageGold);trussTop.position.y=2.1;stage.add(trussTop);
for(const x of [-2.7,2.7]){const t=new THREE.Mesh(new THREE.BoxGeometry(.05,2.15,.05),stageGold);t.position.set(x,1.05,0);stage.add(t)}
for(let i=-2;i<=2;i++){const beam=new THREE.Mesh(new THREE.ConeGeometry(.42,3.7,16,1,true),new THREE.MeshBasicMaterial({color:0xffc963,transparent:true,opacity:.045,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));beam.position.set(i*.9,1.55,.1);beam.rotation.z=(i*.045);stage.add(beam);const lamp=new THREE.PointLight(0xffb748,2.0,5.0,2);lamp.position.set(i*.9,1.95,.1);stage.add(lamp)}
for(const x of [-1.1,-.55,0,.55,1.1]){const body=new THREE.Mesh(new THREE.CapsuleGeometry(.08,.26,4,8),new THREE.MeshBasicMaterial({color:0x18120c}));body.position.set(x,.25,.15);stage.add(body)}

scene.add(new THREE.AmbientLight(0x5f3a13,1.8));
const key=new THREE.PointLight(0xffd27a,80,15,2);key.position.set(4,4,5);scene.add(key);
const rim=new THREE.PointLight(0xff8c1e,55,12,2);rim.position.set(-1,-1,4);scene.add(rim);
const white=new THREE.PointLight(0xfff1c9,50,10,2);white.position.set(1,1,-3);scene.add(white);

let mouseX=0,mouseY=0,targetX=0,targetY=0;
window.addEventListener('pointermove',e=>{targetX=(e.clientX/innerWidth-.5)*2;targetY=(e.clientY/innerHeight-.5)*2},{passive:true});
function resize(){const w=hero.clientWidth,h=hero.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const mobile=w<720;world.position.set(mobile?0:2.25,mobile?-1.0:.6,0);world.scale.setScalar(mobile?.68:1)}
new ResizeObserver(resize).observe(hero);resize();
const clock=new THREE.Clock();
function tick(){const t=clock.getElapsedTime();mouseX+=(targetX-mouseX)*.025;mouseY+=(targetY-mouseY)*.025;if(!reduced){mobius.rotation.y=t*.18+mouseX*.22;mobius.rotation.x=.72+Math.sin(t*.35)*.08+mouseY*.12;mobius.rotation.z=-.3+Math.sin(t*.21)*.11;inner.rotation.copy(mobius.rotation);points.rotation.y=-t*.035;points.rotation.z=Math.sin(t*.09)*.14;stage.rotation.y=Math.sin(t*.12)*.04;world.position.y+=(Math.sin(t*.5)*.03-world.position.y+(innerWidth<720?-1.0:.6))*.006;}renderer.render(scene,camera);requestAnimationFrame(tick)}tick();

const menu=document.querySelector('#menuToggle'),nav=document.querySelector('#mobileNav');
menu?.addEventListener('click',()=>{const open=nav.hidden;nav.hidden=!open;menu.setAttribute('aria-expanded',String(open))});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.hidden=true;menu.setAttribute('aria-expanded','false')}));

const revealEls=[...document.querySelectorAll('.section-head,.cap-grid article,.proof-row b,.about-copy,.about-orbit,.partner-copy,.partner-cards article,.contact>*')];
revealEls.forEach(el=>{el.style.opacity='0';el.style.transform='translateY(22px)'});
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.animate([{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}],{duration:750,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});io.unobserve(e.target)}}),{threshold:.12});revealEls.forEach(el=>io.observe(el));
