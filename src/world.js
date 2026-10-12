import * as THREE from 'three';

// Every texture in this little world is painted locally. No asset host is needed.
export function createWorld({ quality = 'high' } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8b1b3');
  scene.fog = new THREE.FogExp2('#d6a9b4', 0.0067);
  const textures = new Set();
  const moving = [];
  const obstacles = [];
  const low = quality === 'low';
  let seed = 93271;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const canvasTexture = (size, paint) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    paint(canvas.getContext('2d'), size, canvas);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    return texture;
  };
  const noiseTexture = (color, variation, size = 256) => canvasTexture(size, (ctx, s) => {
    const data = ctx.createImageData(s, s);
    for (let i = 0; i < data.data.length; i += 4) {
      const n = (random() - 0.5) * variation;
      data.data[i] = color[0] + n; data.data[i + 1] = color[1] + n;
      data.data[i + 2] = color[2] + n; data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  });
  const repeat = (texture, n) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(n, n); return texture; };
  const sandTexture = repeat(noiseTexture([208, 180, 151], 33, 512), 22);
  const rockTexture = repeat(noiseTexture([157, 143, 145], 60), 3);
  const stoneTexture = repeat(noiseTexture([205, 190, 169], 43), 2);
  const barkTexture = repeat(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#776559'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      ctx.fillStyle = `rgba(33,28,22,${0.2 + random() * 0.3})`;
      ctx.fillRect(0, y, s, 2 + random() * 3);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(224,192,140,${random() * 0.3})`;
        ctx.fillRect(random() * s, y, 2 + random() * 13, 2);
      }
    }
  }), 4);
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture, bumpMap: sandTexture, bumpScale: 0.095, roughness: 0.99, color: '#ffe9d0' });
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.10, roughness: 0.91 });
  const rockMat = new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 0.2, roughness: 0.92, color: '#bfb3b6' });
  const gold = new THREE.MeshStandardMaterial({ color: '#d3aa54', metalness: 0.77, roughness: 0.31 });
  const rose = new THREE.MeshStandardMaterial({ color: '#b43755', metalness: 0.35, roughness: 0.33 });
  const dark = new THREE.MeshStandardMaterial({ color: '#302d3b', metalness: 0.28, roughness: 0.5 });
  const warmGlow = new THREE.MeshStandardMaterial({ color: '#ffdfa0', emissive: '#ffb04b', emissiveIntensity: 2.5, roughness: 0.3 });
  const pinkGlow = new THREE.MeshStandardMaterial({ color: '#ffd4e9', emissive: '#ff5b9d', emissiveIntensity: 2, roughness: 0.4 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#557567', roughness: 0.88, side: THREE.DoubleSide });
  const palmWind = { value: 0 };
  leafMat.onBeforeCompile = shader => {
    shader.uniforms.uPalmWind = palmWind;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uPalmWind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uPalmWind * .6 + position.z * .65) * pow(position.z / 4.8, 2.) * .11;');
  };
  leafMat.customProgramCacheKey = () => 'giuly-palm-wind';
  const add = (geometry, material, position, scale, parent = scene) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, position, parent) => add(new THREE.BoxGeometry(w, h, d), material, position, null, parent);
  const sphere = (r, material, position, scale, parent) => add(new THREE.SphereGeometry(r, low ? 16 : 28, low ? 12 : 20), material, position, scale, parent);
  const cylinder = (r1, r2, h, material, position, parent, count = 24) => add(new THREE.CylinderGeometry(r1, r2, h, count), material, position, null, parent);
  const tube = (points, radius, material, parent, segments = 32) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 7, false), material, null, null, parent);
  const roundedBox = (w, h, depth, radius, material, position, parent) => {
    const x = -w / 2, y = -h / 2, s = new THREE.Shape();
    s.moveTo(x + radius, y); s.lineTo(x + w - radius, y);
    s.quadraticCurveTo(x + w, y, x + w, y + radius); s.lineTo(x + w, y + h - radius);
    s.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); s.lineTo(x + radius, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - radius); s.lineTo(x, y + radius);
    s.quadraticCurveTo(x, y, x + radius, y);
    const geo = new THREE.ExtrudeGeometry(s, { depth: depth - 0.1, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, steps: 1, curveSegments: 8 });
    geo.translate(0, 0, -depth / 2 + 0.05);
    return add(geo, material, position, null, parent);
  };
  const heartGeometry = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.8); s.bezierCurveTo(-1.4, 0.1, -1.2, 1.2, -0.55, 1.1);
    s.bezierCurveTo(-0.2, 1.1, 0, 0.8, 0, 0.65);
    s.bezierCurveTo(0, 0.8, 0.2, 1.1, 0.55, 1.1);
    s.bezierCurveTo(1.2, 1.2, 1.4, 0.1, 0, -0.8);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.07, bevelThickness: 0.07, steps: 1, curveSegments: 16 });
    geo.translate(0, 0, -0.075); return geo;
  })();
  const haloTexture = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.16, 'rgba(255,211,196,.65)');
    g.addColorStop(0.45, 'rgba(255,175,178,.15)'); g.addColorStop(1, 'rgba(255,160,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const halo = (parent, position, size, color = '#ffdcaa', opacity = 0.65) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.position.set(...position); sprite.scale.set(size, size, 1); parent.add(sprite); return sprite;
  };
  const label = (title, subtitle, position, parent, width = 6) => {
    const texture = canvasTexture(512, (ctx) => {
      ctx.clearRect(0, 0, 512, 512); ctx.fillStyle = 'rgba(43,31,53,.82)';
      ctx.beginPath(); ctx.roundRect(8, 154, 496, 161, 40); ctx.fill();
      ctx.strokeStyle = 'rgba(255,226,198,.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff3e6'; ctx.font = '600 34px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText(title, 256, 217); ctx.fillStyle = '#f9c7d5'; ctx.font = '21px sans-serif'; ctx.fillText(subtitle, 256, 264);
      ctx.beginPath(); ctx.moveTo(240, 314); ctx.lineTo(272, 314); ctx.lineTo(256, 337); ctx.closePath(); ctx.fillStyle = '#f4d4a3'; ctx.fill();
    });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.position.set(...position); sprite.scale.set(width, width, 1); parent.add(sprite); return sprite;
  };

  // A sunset dome preserves a clear horizon instead of hiding the island in fog.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(430, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#655d93') }, mid: { value: new THREE.Color('#d3a1bb') }, bottom: { value: new THREE.Color('#ffd5b8') } },
    vertexShader: 'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 mid;uniform vec3 bottom;varying vec3 vP;void main(){float y=normalize(vP).y;vec3 c=mix(bottom,mid,smoothstep(-.05,.23,y));c=mix(c,top,smoothstep(.18,.82,y));gl_FragColor=vec4(c,1.);}',
  }));
  sky.renderOrder = -10; scene.add(sky);
  scene.add(new THREE.HemisphereLight('#ffdacf', '#7a8c9a', 2.1));
  const sun = new THREE.DirectionalLight('#ffd7b0', 3.4);
  sun.position.set(-32, 35, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  sun.shadow.camera.left = -44; sun.shadow.camera.right = 44;
  sun.shadow.camera.top = 44; sun.shadow.camera.bottom = -44;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 130; sun.shadow.normalBias = 0.06; sun.shadow.bias = -0.00015;
  // Architecture and sunlight stay fixed: cache the costly island shadow map.
  sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#a5b8ff', 1.3); rim.position.set(15, 23, -45); scene.add(rim);

  // Hand-painted lunar craters, rendered on a real shaded sphere.
  const moonTexture = canvasTexture(1024, (ctx, size) => {
    ctx.fillStyle = '#d5d0c3'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? '255,245,222' : '72,77,90'},${random() * 0.035})`;
      ctx.beginPath(); ctx.ellipse(random() * size, random() * size, 2 + random() * 42, 2 + random() * 25, random() * 6, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 230; i++) {
      const x = random() * size, y = random() * size, r = 3 + Math.pow(random(), 3) * 62;
      const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.23, r * 0.04, x, y, r);
      g.addColorStop(0, 'rgba(103,102,100,.32)'); g.addColorStop(0.68, 'rgba(87,90,94,.25)');
      g.addColorStop(0.87, 'rgba(244,234,214,.60)'); g.addColorStop(1, 'rgba(225,212,192,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
  const moon = sphere(15.7, new THREE.MeshStandardMaterial({ map: moonTexture, bumpMap: moonTexture, bumpScale: 0.3, roughness: 1, emissive: '#b6abb2', emissiveIntensity: 0.20, fog: false }), [-32, 41, -117]);
  moon.castShadow = false; moon.receiveShadow = false; moon.rotation.y = 1.3;
  halo(scene, [-32, 41, -119], 49, '#fff0d8', 0.2);
  const starsPositions = [];
  for (let i = 0; i < 150; i++) {
    const theta = random() * Math.PI * 2, y = 55 + random() * 140, r = 225;
    starsPositions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
  }
  const starsGeo = new THREE.BufferGeometry(); starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPositions, 3));
  const skyStars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#ffe7d9', size: 0.47, transparent: true, opacity: 0.48, sizeAttenuation: true, fog: false })); scene.add(skyStars);

  const oceanUniforms = { time: { value: 0 }, lightDirection: { value: new THREE.Vector3(-0.6, 0.55, 0.4).normalize() } };
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(760, 760, low ? 64 : 140, low ? 64 : 140), new THREE.ShaderMaterial({
    transparent: false, uniforms: oceanUniforms,
    vertexShader: `uniform float time;varying vec3 vWorld;varying vec3 vNormal;void main(){vec3 p=position;float a=sin(p.x*.09+time*.32),b=sin(p.y*.13-time*.4);p.z+=a*.18+b*.12;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vec3 n=normalize(vec3(-.016*cos(p.x*.09+time*.32),-.016*cos(p.y*.13-time*.4),1.));vNormal=normalize(mat3(modelMatrix)*n);gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float time;uniform vec3 lightDirection;varying vec3 vWorld;varying vec3 vNormal;void main(){vec3 viewDir=normalize(cameraPosition-vWorld);vec3 n=normalize(vNormal+vec3(sin(vWorld.x*1.4+time*.6)*.075,0.,cos(vWorld.z*1.7-time*.7)*.085));float fres=pow(1.-max(dot(n,viewDir),0.),3.);vec3 c=mix(vec3(.19,.35,.43),vec3(.78,.61,.66),fres);float spec=pow(max(dot(n,normalize(lightDirection+viewDir)),0.),160.);c+=vec3(1.,.77,.50)*spec*.8;float r=length(vWorld.xz);float wave=sin(r*3.7-time*.65+sin(atan(vWorld.x,vWorld.z)*15.)*.7);float foam=smoothstep(.6,.98,wave)*(1.-smoothstep(44.,47.,r))*smoothstep(41.5,43.6,r);c=mix(c,vec3(.94,.81,.74),foam*.65);gl_FragColor=vec4(c,1.);}`,
  }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -0.52; ocean.receiveShadow = true; scene.add(ocean);
  const groundGeo = new THREE.RingGeometry(42, 44, 144, 4);
  groundGeo.rotateX(-Math.PI / 2);
  const groundPos = groundGeo.attributes.position;
  for (let i = 0; i < groundPos.count; i++) {
    const radius = Math.hypot(groundPos.getX(i), groundPos.getZ(i));
    groundPos.setY(i, -0.035 - Math.max(0, radius - 42) * 0.29);
  }
  groundGeo.computeVertexNormals(); add(groundGeo, sandMat);
  // A second flat surface keeps the walking area exactly level.
  const walkGround = add(new THREE.CircleGeometry(42, 144), sandMat, [0, 0, 0]); walkGround.rotation.x = -Math.PI / 2;

  const paths = [[ [0,22], [0,8], [0,-12], [0,-31] ], [[0,8],[-8,7],[-16,5]], [[0,-5],[8,-5],[16,-6]], [[0,-16],[-7,-24]]];
  const pathTexture = canvasTexture(256, (ctx, size) => {
    const data = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, grain = (random() - 0.5) * 19;
      const edge = Math.min(x, size - x) / 38;
      data.data[i] = 222 + grain; data.data[i + 1] = 197 + grain;
      data.data[i + 2] = 168 + grain; data.data[i + 3] = Math.min(1, edge * edge) * 150;
    }
    ctx.putImageData(data, 0, 0);
  });
  pathTexture.wrapT = THREE.RepeatWrapping;
  const pathMat = new THREE.MeshStandardMaterial({ color: '#ffe9d0', roughness: 1, map: pathTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  paths.forEach(points => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], 0.012, p[1]))), vertices = [], uv = [], indices = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50, p = curve.getPoint(t), tangent = curve.getTangent(t), perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(1.15 + Math.sin(i * .63) * .13 + Math.sin(i * .18) * .1);
      vertices.push(p.x + perpendicular.x, p.y, p.z + perpendicular.z, p.x - perpendicular.x, p.y, p.z - perpendicular.z); uv.push(0, t * 10, 1, t * 10);
      if (i < 50) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); add(geo, pathMat);
  });

  // Stone architecture frames the final view, while its middle stays walkable.
  const portalGroup = new THREE.Group(); portalGroup.position.set(0, 0, -12); scene.add(portalGroup);
  [-1, 1].forEach(side => {
    box(1.65, 0.35, 1.9, stoneMat, [side * 3.8, 0.17, 0], portalGroup);
    for (let i = 0; i < 7; i++) {
      const block = roundedBox(1.15, 0.73, 1.25, 0.07, stoneMat, [side * 3.8, 0.7 + i * 0.75, 0], portalGroup);
      block.rotation.y = (i % 2 ? 1 : -1) * 0.022;
    }
    box(1.5, 0.25, 1.65, stoneMat, [side * 3.8, 5.76, 0], portalGroup);
    obstacles.push({ x: side * 3.8, z: -12, radius: 0.9 });
  });
  const arch = add(new THREE.TorusGeometry(3.8, 0.58, 12, 44, Math.PI), stoneMat, [0, 5.3, 0], null, portalGroup);
  for (let i = 0; i <= 12; i++) {
    const angle = i / 12 * Math.PI;
    const block = box(0.05, 1.18, 1.22, new THREE.MeshStandardMaterial({ color: '#a69788', roughness: 1 }), [Math.cos(angle) * 3.8, 5.3 + Math.sin(angle) * 3.8, 0], portalGroup);
    block.rotation.z = angle - Math.PI / 2;
  }
  const archHeart = add(heartGeometry, gold, [0, 8.9, 0.72], [0.46, 0.46, 0.46], portalGroup);
  const portalUniforms = { time: { value: 0 }, open: { value: 0 } };
  const portalShape = new THREE.Shape(); portalShape.moveTo(-3.2, 0.15); portalShape.lineTo(3.2, 0.15); portalShape.lineTo(3.2, 5.3); portalShape.absarc(0, 5.3, 3.2, 0, Math.PI, false); portalShape.lineTo(-3.2, 0.15);
  const portalSurface = add(new THREE.ShapeGeometry(portalShape, 40), new THREE.ShaderMaterial({
    uniforms: portalUniforms, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time;uniform float open;varying vec3 vP;void main(){float r=length(vP.xy-vec2(0.,4.2));float waves=sin(r*5.-time*1.8+sin(vP.y*1.8+time)*.5)*.5+.5;float edge=pow(abs(vP.x)/3.2,4.);vec3 c=mix(vec3(.47,.47,.78),vec3(1.,.64,.81),waves);float a=(.025+edge*.10)*(1.-open)+(.17+waves*.13+edge*.23)*open;gl_FragColor=vec4(c*(1.+open*.7),a);}',
  }), [0, 0, -0.1], null, portalGroup);
  portalSurface.castShadow = false;
  const portalLight = new THREE.PointLight('#fa80b8', 7, 15, 2); portalLight.position.set(0, 4.5, -11); scene.add(portalLight);
  label('IL PORTALE DEI DESIDERI', 'Tre follie. Un appuntamento.', [0, 10.7, 0], portalGroup, 7.3);
  const portal = { position: new THREE.Vector3(0, 0, -12), object: portalGroup };
  portalGroup.userData.portal = true;
  for (let i = 0; i < 25; i++) {
    const p = halo(portalGroup, [(random() - .5) * 7, random() * 8 + .8, (random() - .5) * .7], .11 + random() * .13, '#ffe1ae', .6);
    moving.push({ kind: 'portalSpark', object: p, phase: random() * 6.28, base: p.position.clone() });
  }

  // The sovereign cat is carved ivory, with gold eyes and an entirely serious crown.
  const catGroup = new THREE.Group(); catGroup.position.set(-16, 0, 5); catGroup.rotation.y = 0.55; scene.add(catGroup);
  const ivory = new THREE.MeshStandardMaterial({ color: '#f1e0cf', map: noiseTexture([225,214,198], 16), roughness: 0.67, metalness: 0.04 });
  cylinder(2.6, 2.85, 0.65, stoneMat, [0, 0.33, 0], catGroup, 48);
  cylinder(2.25, 2.6, 0.22, gold, [0, 0.74, 0], catGroup, 48);
  sphere(1, ivory, [0, 3.25, 0], [1.9, 2.75, 1.5], catGroup);
  sphere(1, ivory, [-1.2, 1.73, 0.7], [0.92, 1.15, 1.25], catGroup);
  sphere(1, ivory, [1.2, 1.73, 0.7], [0.92, 1.15, 1.25], catGroup);
  [-.68,.68].forEach(x => {
    sphere(1, ivory, [x, 2.35, 1.02], [0.47, 1.45, 0.49], catGroup);
    sphere(1, ivory, [x, 1.03, 1.45], [0.6, 0.35, 0.8], catGroup);
    for(let i=0;i<3;i++) tube([[x-.28+i*.28,.98,1.91],[x-.28+i*.28,1.17,2.03]],.018,gold,catGroup,5);
  });
  const catHead = new THREE.Group(); catHead.position.set(0, 6.05, 0.37); catHead.rotation.z = -.065; catGroup.add(catHead);
  sphere(1, ivory, [0, 0, 0], [1.6, 1.35, 1.37], catHead);
  [-1,1].forEach(side => {
    const ear = add(new THREE.ConeGeometry(.62, 1.55, 3), ivory, [side*1.02,1.47,-.08], [1,1,.6], catHead); ear.rotation.z = side * -.20; ear.rotation.y = Math.PI;
    const inner = add(new THREE.ConeGeometry(.36,.96,3), new THREE.MeshStandardMaterial({color:'#c99194',roughness:.75}), [side*1.03,1.47,.18], [1,1,.23], catHead); inner.rotation.z = side * -.2; inner.rotation.y = Math.PI;
    sphere(1, ivory, [side*.45,-.48,1.12], [.58,.42,.44], catHead);
    const eye = sphere(1, gold, [side*.66,.14,1.2], [.37,.31,.12], catHead); eye.rotation.z = side * .12;
    sphere(1, dark, [side*.66,.14,1.315], [.054,.23,.035], catHead);
    sphere(.045,warmGlow,[side*.59,.24,1.346],null,catHead);
    for(let i=0;i<3;i++) tube([[side*.46,-.49+i*.13,1.5],[side*1.5,-.33+i*.17,1.62],[side*2.1,-.21+i*.2,1.5]],.013,gold,catHead,10);
  });
  const nose=add(new THREE.ConeGeometry(.18,.23,3),rose,[0,-.34,1.63],null,catHead); nose.rotation.z=Math.PI;
  tube([[0,-.43,1.6],[0,-.64,1.59],[-.2,-.71,1.5]],.024,dark,catHead,10);
  tube([[0,-.64,1.59],[.2,-.71,1.5]],.024,dark,catHead,8);
  tube([[1.5,1.15,-.1],[2.65,1.25,-.25],[3,2.8,-.2],[2.3,3.65,-.5],[1.94,3.24,-.64]],.32,ivory,catGroup,36);
  const collar = add(new THREE.TorusGeometry(1.20,.10,8,40),rose,[0,4.75,.15],null,catGroup);collar.rotation.x=Math.PI/2;
  add(heartGeometry,gold,[0,4.41,1.62],[.27,.27,.27],catGroup);
  cylinder(.7,.86,.18,gold,[0,7.57,.32],catGroup);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;cylinder(.05,.16,.56,gold,[Math.sin(a)*.69,7.9,.32+Math.cos(a)*.69],catGroup,8);sphere(.11,pinkGlow,[Math.sin(a)*.69,8.18,.32+Math.cos(a)*.69],null,catGroup);}
  label('01 · SUA MAESTÀ MIAO', 'Il sovrano pretende complimenti.', [0, 9.25, 0], catGroup, 6.7);
  obstacles.push({x:-16,z:5,radius:2.55});

  // A six-metre vintage appliance launders an animated galaxy behind its glass.
  const washerGroup=new THREE.Group();washerGroup.position.set(16,0,-6);washerGroup.rotation.y=-.35;scene.add(washerGroup);
  const enamel=new THREE.MeshStandardMaterial({color:'#e8d9d4',metalness:.42,roughness:.28,map:noiseTexture([230,224,219],9)});
  roundedBox(5,5.8,2.8,.27,enamel,[0,3.16,0],washerGroup);
  roundedBox(4.74,.95,.16,.15,rose,[0,5.26,1.47],washerGroup);
  const drum=cylinder(1.6,1.6,.25,dark,[0,2.65,1.49],washerGroup,64);drum.rotation.x=Math.PI/2;
  add(new THREE.TorusGeometry(1.61,.16,12,64),gold,[0,2.65,1.70],null,washerGroup);
  add(new THREE.TorusGeometry(1.42,.075,8,64),enamel,[0,2.65,1.8],null,washerGroup);
  const galaxyUniforms={time:{value:0},complete:{value:0}};
  const galaxy=add(new THREE.CircleGeometry(1.39,64),new THREE.ShaderMaterial({uniforms:galaxyUniforms,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float time;uniform float complete;varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x)-time*.17;float swirl=sin(a*3.+r*10.-time*.25)*.5+.5;float arm=pow(swirl,8.)*exp(-r*2.4);vec3 c=vec3(.025,.018,.085)+vec3(.46,.14,.66)*arm+vec3(.16,.39,.8)*arm*r;float core=exp(-r*15.);c+=vec3(1.,.78,.51)*core*2.;vec2 grid=floor(vUv*100.);float star=step(.992,hash(grid))*pow(max(0.,1.-length(fract(vUv*100.)-.5)*2.),3.);c+=star*vec3(1.,.9,.75);c+=vec3(.5,.15,.24)*complete*.2;gl_FragColor=vec4(c,1.);}`,
  }),[0,2.65,1.815],null,washerGroup);
  // The highlight on the porthole makes it feel like curved glass, not a screen.
  const highlight=add(new THREE.TorusGeometry(1.28,.035,6,24,1.15),new THREE.MeshBasicMaterial({color:'#fff4eb',transparent:true,opacity:.58}),[0,2.65,1.84],null,washerGroup);highlight.rotation.z=.56;
  const knob=cylinder(.32,.32,.18,gold,[-1.59,5.26,1.67],washerGroup);knob.rotation.x=Math.PI/2;
  for(let i=0;i<3;i++){const button=cylinder(.095,.095,.09,i===0?pinkGlow:gold,[.93+i*.37,5.27,1.63],washerGroup,12);button.rotation.x=Math.PI/2;}
  roundedBox(1.35,.4,.09,.06,dark,[-.26,5.26,1.58],washerGroup);
  const displayTexture=canvasTexture(256,(ctx)=>{ctx.fillStyle='#262432';ctx.fillRect(0,0,256,256);ctx.fillStyle='#ebbbcf';ctx.font='bold 39px monospace';ctx.textAlign='center';ctx.fillText('∞ : 00',128,141);});
  const display=add(new THREE.PlaneGeometry(1.19,.34),new THREE.MeshBasicMaterial({map:displayTexture}),[-.26,5.26,1.64],null,washerGroup);
  roundedBox(3.5,.35,.1,.05,enamel,[0,.70,1.47],washerGroup);
  for(let i=0;i<12;i++)box(.10,.14,.035,dark,[-1.47+i*.27,.7,1.545],washerGroup);
  [-1.9,1.9].forEach(x=>{cylinder(.22,.26,.4,dark,[x,.2,.9],washerGroup);cylinder(.22,.26,.4,dark,[x,.2,-.9],washerGroup);});
  tube([[1.8,.8,-1.4],[2.9,1.2,-2.1],[3.15,2.3,-1.8],[2.5,3,-1.5]],.13,dark,washerGroup,24);
  const washerLight=new THREE.PointLight('#a48cff',4,10,2);washerLight.position.set(16,3.1,-3.8);scene.add(washerLight);
  for(let i=0;i<9;i++){const bubble=sphere(.10+random()*.13,new THREE.MeshStandardMaterial({color:'#e2c9f5',emissive:'#9786c9',emissiveIntensity:.3,metalness:.7,roughness:.12,transparent:true,opacity:.45}),[(random()-.5)*3,6.5+random()*2.2,(random()-.5)*1.5],null,washerGroup);bubble.castShadow=false;moving.push({kind:'bubble',object:bubble,base:bubble.position.clone(),phase:random()*6.28});}
  label('02 · LAVAGALASSIE', 'Programma delicati: universo.',[0,8.1,0],washerGroup,6.3);
  obstacles.push({x:16,z:-6,radius:2.6});

  // A British-inspired booth, with a moon-facing antenna and a coiled phone cord.
  const phoneGroup=new THREE.Group();phoneGroup.position.set(-7,0,-24);phoneGroup.rotation.y=.22;scene.add(phoneGroup);
  box(3.25,.26,2.85,stoneMat,[0,.13,0],phoneGroup);
  box(2.8,.24,2.5,rose,[0,.4,0],phoneGroup);
  const glass=new THREE.MeshStandardMaterial({color:'#c2dbd9',metalness:.05,roughness:.15,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
  [-1,1].forEach(s=>{
    box(.18,4.8,.18,rose,[s*1.35,2.89,1.17],phoneGroup);box(.18,4.8,.18,rose,[s*1.35,2.89,-1.17],phoneGroup);
    box(.12,3.95,2.16,glass,[s*1.35,2.75,0],phoneGroup);
    for(let j=0;j<4;j++)box(.19,.095,2.2,rose,[s*1.35,1.12+j*1.03,0],phoneGroup);
    box(.18,4.16,.09,rose,[s*1.35,2.64,0],phoneGroup);
  });
  box(2.65,4.64,.12,rose,[0,2.86,-1.19],phoneGroup);
  box(2.6,.36,2.54,rose,[0,5.24,0],phoneGroup);
  roundedBox(2.72,.56,.16,.08,gold,[0,5.35,1.31],phoneGroup);
  const boothSignTexture=canvasTexture(512,(ctx)=>{ctx.fillStyle='#f3e2cb';ctx.fillRect(0,0,512,512);ctx.fillStyle='#803c50';ctx.font='600 57px Georgia,serif';ctx.textAlign='center';ctx.fillText('LINEA LUNA',256,275);});
  add(new THREE.PlaneGeometry(2.48,.43),new THREE.MeshBasicMaterial({map:boothSignTexture}),[0,5.35,1.405],null,phoneGroup);
  box(2.8,.16,2.6,rose,[0,5.69,0],phoneGroup);
  sphere(1,rose,[0,5.72,0],[1.4,.45,1.3],phoneGroup);
  // An open front door reveals the warm telephone inside.
  const door=new THREE.Group();door.position.set(-1.24,.48,1.25);door.rotation.y=-.52;phoneGroup.add(door);
  [-1,1].forEach(s=>box(.12,4.36,.13,rose,[1.22+s*1.16,2.2,0],door));
  for(let i=0;i<5;i++)box(2.39,.12,.14,rose,[1.22,.07+i*1.05,0],door);
  box(.1,4.1,.14,rose,[1.22,2.2,0],door);
  box(2.29,4.12,.02,glass,[1.22,2.2,.015],door);
  box(.055,.46,.1,gold,[2.24,2.07,.12],door);
  roundedBox(1.05,1.55,.38,.15,dark,[0,3,-.86],phoneGroup);
  roundedBox(.84,.76,.07,.05,gold,[0,2.9,-.62],phoneGroup);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){const key=cylinder(.07,.07,.055,dark,[-.22+col*.22,2.72+row*.19,-.565],phoneGroup,12);key.rotation.x=Math.PI/2;}
  roundedBox(.60,.16,.05,.03,rose,[0,3.45,-.64],phoneGroup);
  const handset=new THREE.Group();handset.position.set(-.68,3.08,-.56);handset.rotation.z=-.1;phoneGroup.add(handset);
  tube([[0,-.43,0],[-.08,-.2,0],[-.08,.2,0],[0,.43,0]],.11,rose,handset,14);
  [-1,1].forEach(s=>{const end=cylinder(.19,.16,.18,dark,[.08,s*.46,0],handset,20);end.rotation.z=Math.PI/2;});
  const cord=[];for(let i=0;i<100;i++){const a=i/99*Math.PI*2*14;cord.push([-.57+Math.cos(a)*.055,2.63-i/99*1.37,-.56+Math.sin(a)*.055]);}cord.push([-.35,1.15,-.64],[.25,1.3,-.83]);tube(cord,.022,dark,phoneGroup,130);
  cylinder(.3,.3,.055,warmGlow,[0,5.12,0],phoneGroup);
  const phoneLight=new THREE.PointLight('#ffc786',6,10,2);phoneLight.position.set(-7,3.8,-23.7);scene.add(phoneLight);
  cylinder(.035,.055,1.04,gold,[0,6.52,0],phoneGroup,8);
  const dish=sphere(1,gold,[0,7.04,0],[.72,.17,.72],phoneGroup);dish.rotation.x=-.54;
  for(let i=0;i<3;i++){const ring=add(new THREE.TorusGeometry(.42+i*.34,.015,5,36),pinkGlow,[0,7.32+i*.20,-.25-i*.30],null,phoneGroup);ring.rotation.x=-.6;moving.push({kind:'signal',object:ring,phase:i*2});}
  label('03 · PRONTO, LUNA?', 'Una telefonata fuori dal mondo.',[0,8.9,0],phoneGroup,6.1);
  obstacles.push({x:-7,z:-24,radius:1.8});
  const quests=[{id:'cat',position:new THREE.Vector3(-16,0,5),object:catGroup},{id:'washer',position:new THREE.Vector3(16,0,-6),object:washerGroup},{id:'phone',position:new THREE.Vector3(-7,0,-24),object:phoneGroup}];
  quests.forEach(q=>q.object.traverse(o=>{o.userData.questId=q.id;}));

  // Five solid, beveled stars are scattered along a small exploration loop.
  const starShape=new THREE.Shape();for(let i=0;i<10;i++){const a=i/10*Math.PI*2+Math.PI/2,r=i%2?.24:.57;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)starShape.moveTo(x,y);else starShape.lineTo(x,y);}starShape.closePath();
  const starGeo=new THREE.ExtrudeGeometry(starShape,{depth:.18,bevelSize:.045,bevelThickness:.045,bevelSegments:2,steps:1});starGeo.translate(0,0,-.09);
  const starMat=new THREE.MeshStandardMaterial({color:'#ffe4a0',emissive:'#eea242',emissiveIntensity:.65,metalness:.62,roughness:.22});
  const pickupPositions=[[-6,13],[12,14],[-22,-12],[16,-23],[6,-34]];
  const pickups=pickupPositions.map(([x,z],i)=>{
    const object=new THREE.Group();object.position.set(x,1.75,z);object.userData.pickupId=`star-${i}`;scene.add(object);
    const star=add(starGeo,starMat,[0,0,0],null,object);star.castShadow=false;star.userData.pickupId=object.userData.pickupId;
    halo(object,[0,0,0],2.8,'#ffdd9a',.60);
    const ring=add(new THREE.TorusGeometry(.84,.018,5,44),gold,[0,-.14,0],null,object);ring.rotation.x=Math.PI/2;
    return {id:object.userData.pickupId,position:new THREE.Vector3(x,0,z),object};
  });

  // Palms use a single feather mesh per frond, instead of hundreds of leaf meshes.
  const frondGeo=(()=>{
    const vertices=[];const triangle=(a,b,c)=>vertices.push(...a,...b,...c);
    const backbone=s=>[0,Math.sin(s*Math.PI)*.45-s*s*.85,s*4.8];
    for(let i=0;i<25;i++){
      const t=.035+i/25*.93,p=backbone(t),next=backbone(t+.025),w=Math.pow(Math.sin(t*Math.PI),.55)*1.05;
      [-1,1].forEach(side=>{
        const tip=[side*w,p[1]-.18-w*.23,p[2]-.54+w*.1];
        const tipNext=[side*(w*.91),p[1]-.25-w*.23,p[2]-.34+w*.1];
        triangle([side*.035,...p.slice(1)],tip,tipNext);triangle([side*.035,...p.slice(1)],tipNext,[side*.035,...next.slice(1)]);
      });
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return geo;
  })();
  const palmPositions=[[-31,18],[-27,27],[-36,3],[-34,-15],[-26,-31],[-14,-37],[2,-40],[21,-34],[32,-25],[37,-8],[33,14],[27,27],[17,35],[-8,38],[-23,34]];
  const palmFronds = new THREE.InstancedMesh(frondGeo, leafMat, palmPositions.length * 8);
  palmFronds.castShadow = true; palmFronds.receiveShadow = true; scene.add(palmFronds);
  const palmDummy = new THREE.Object3D();
  palmPositions.forEach(([x,z],i)=>{
    const palm=new THREE.Group();palm.position.set(x,0,z);scene.add(palm);const h=8+random()*4;
    const leanX=(random()-.5)*2.5,leanZ=(random()-.5)*2.5;
    tube([[0,0,0],[leanX*.05,h*.25,leanZ*.05],[leanX*.3,h*.6,leanZ*.3],[leanX,h,leanZ]],.27,new THREE.MeshStandardMaterial({map:barkTexture,bumpMap:barkTexture,bumpScale:.10,roughness:1}),palm,22);
    for(let j=0;j<8;j++){
      palmDummy.position.set(x + leanX, h, z + leanZ);
      palmDummy.rotation.set((random() - .5) * .22, j / 8 * Math.PI * 2 + random() * .2, 0);
      palmDummy.scale.setScalar(.85 + random() * .28); palmDummy.updateMatrix();
      palmFronds.setMatrixAt(i * 8 + j, palmDummy.matrix);
    }
    for(let j=0;j<3;j++)sphere(.19,dark,[leanX+Math.sin(j*2.1)*.23,h-.3,leanZ+Math.cos(j*2.1)*.23],null,palm);
    obstacles.push({x,z,radius:.65});
  });

  // Rocky shoulders leave the central promenade and every interaction accessible.
  const boulderGeo=new THREE.DodecahedronGeometry(1,1);
  const boulders=new THREE.InstancedMesh(boulderGeo,rockMat,low?34:56);boulders.castShadow=true;boulders.receiveShadow=true;scene.add(boulders);
  const dummy=new THREE.Object3D();
  for(let i=0;i<boulders.count;i++){
    const a=i/boulders.count*Math.PI*2,r=35+random()*7,s=.9+random()*2.7;
    dummy.position.set(Math.sin(a)*r,s*.32,Math.cos(a)*r);dummy.scale.set(s*(1+random()),s*.75,s*(1+random()*.8));dummy.rotation.set(random()*.4,random()*6,random()*.35);dummy.updateMatrix();boulders.setMatrixAt(i,dummy.matrix);
  }
  [[-31,-22,6,7,6],[31,-22,7,5,5],[-37,-2,6,4,5],[34,6,5,3,6]].forEach(([x,z,sx,sy,sz])=>{const rock=add(boulderGeo,rockMat,[x,sy*.28,z],[sx,sy,sz]);rock.rotation.set(.1,random()*3,.15);obstacles.push({x,z,radius:sx*.7});});
  const distantMountainGeo = new THREE.SphereGeometry(1, 40, 20);
  const mountainVertices = distantMountainGeo.attributes.position;
  for (let i = 0; i < mountainVertices.count; i++) {
    const x = mountainVertices.getX(i), y = mountainVertices.getY(i), z = mountainVertices.getZ(i);
    const ridge = 1 + Math.sin(x * 9 + z * 5) * .1 + Math.cos(x * 17 - z * 7) * .065;
    mountainVertices.setXYZ(i, x * ridge, y * ridge, z * ridge);
  }
  distantMountainGeo.computeVertexNormals();
  const mountainMat = new THREE.MeshStandardMaterial({ color: '#858597', roughness: 1 });
  [[-155,-213,78,36,47],[-82,-190,62,27,43],[-15,-205,42,17,30],[97,-195,70,31,45],[167,-220,74,38,51]].forEach(([x,z,sx,sy,sz]) => {
    const mountain = add(distantMountainGeo, mountainMat, [x, -5, z], [sx, sy, sz]);
    mountain.castShadow = false; mountain.receiveShadow = false;
  });
  const plantGeo = (() => {
    const vertices = [], uvs = [], indices = [];
    for (let leaf = 0; leaf < 5; leaf++) {
      const angle = leaf * Math.PI * 2 / 5, height = .7 + (leaf % 3) * .22, spread = .35 + (leaf % 2) * .18;
      const start = vertices.length / 3;
      for (let step = 0; step <= 8; step++) {
        const t = step / 8, width = Math.pow(Math.sin(t * Math.PI), .65) * .12;
        const y = height * Math.sin(t * Math.PI * .65), outward = spread * t * t;
        for (let side = -1; side <= 1; side++) {
          const across = width * side;
          vertices.push(Math.sin(angle) * outward + Math.cos(angle) * across, y + (side === 0 ? .025 * Math.sin(t * Math.PI) : 0), Math.cos(angle) * outward - Math.sin(angle) * across);
          uvs.push((side + 1) / 2, t);
        }
        if (step < 8) for (let side = 0; side < 2; side++) {
          const index = start + step * 3 + side;
          indices.push(index, index + 3, index + 1, index + 1, index + 3, index + 4);
        }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  })();
  const plantTexture = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#657f65'; ctx.fillRect(0, 0, size, size);
    const g = ctx.createLinearGradient(0, 0, size, 0); g.addColorStop(0, '#3d5f54'); g.addColorStop(.5, '#93a274'); g.addColorStop(1, '#416659');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(203,211,141,.26)'; ctx.lineWidth = 1.5;
    for (let y = 0; y < size; y += 12) { ctx.beginPath(); ctx.moveTo(128, y); ctx.lineTo(15, y + 60); ctx.moveTo(128, y); ctx.lineTo(241, y + 60); ctx.stroke(); }
    ctx.strokeStyle = '#a1ac7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, size); ctx.stroke();
  });
  const plantMat = new THREE.MeshStandardMaterial({ map: plantTexture, roughness: .73, side: THREE.DoubleSide });
  const plants=new THREE.InstancedMesh(plantGeo,plantMat,low?270:550);plants.receiveShadow=true;scene.add(plants);
  let added=0;while(added<plants.count){
    const x=(random()-.5)*82,z=(random()-.5)*82,r=Math.hypot(x,z);
    if(r>40||r<15||Math.abs(x)<5||Math.hypot(x+16,z-5)<5||Math.hypot(x-16,z+6)<5||Math.hypot(x+7,z+24)<5||Math.hypot(x+22,z+12)<2.5||Math.hypot(x-16,z+23)<2.5)continue;
    dummy.position.set(x,0,z);dummy.scale.setScalar(.5+random()*1.1);dummy.rotation.set((random()-.5)*.15,random()*Math.PI*2,(random()-.5)*.15);dummy.updateMatrix();plants.setMatrixAt(added++,dummy.matrix);
  }
  // Purple and cream flowers catch the last light in the plant beds.
  const flowerGeo=new THREE.IcosahedronGeometry(.11,0);const flowerMat=new THREE.MeshStandardMaterial({color:'#e4b7d5',roughness:.6});
  const flowers=new THREE.InstancedMesh(flowerGeo,flowerMat,90);scene.add(flowers);
  for(let i=0;i<90;i++){const a=random()*Math.PI*2,r=24+random()*14;dummy.position.set(Math.sin(a)*r,.15+random()*.65,Math.cos(a)*r);dummy.scale.set(.8+random(),.6,.8+random());dummy.rotation.set(random(),random(),random());dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);}

  // Lanterns guide the route; only a few cast actual point light.
  const lanternPositions=[[-3,18],[3,9],[-3,0],[3,-8],[-3,-18],[3,-28],[-10,5],[10,-5],[-12,-18]];
  lanternPositions.forEach(([x,z],i)=>{
    const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    cylinder(.095,.14,2.2,dark,[0,1.1,0],group,8);
    box(.44,.10,.44,gold,[0,2.18,0],group);
    box(.32,.50,.32,warmGlow,[0,2.48,0],group);
    for(let a=0;a<4;a++)box(.035,.58,.035,dark,[Math.sin(a*Math.PI/2+.78)*.22,2.48,Math.cos(a*Math.PI/2+.78)*.22],group);
    add(new THREE.ConeGeometry(.35,.22,4),dark,[0,2.86,0],null,group).rotation.y=Math.PI/4;
    halo(group,[0,2.48,0],1.75,'#ffcc7b',.55);
    if(i< (low?1:3)){const light=new THREE.PointLight('#ffc57c',3.2,8,2);light.position.set(x,2.48,z);scene.add(light);}
    obstacles.push({x,z,radius:.27});
  });
  // A few fallen shells, pebbles and a welcome stepping stone lend the beach scale.
  const pebbleGeo=new THREE.IcosahedronGeometry(1,1);
  const pebbles=new THREE.InstancedMesh(pebbleGeo,new THREE.MeshStandardMaterial({color:'#dfcfc0',roughness:.9}),150);pebbles.receiveShadow=true;scene.add(pebbles);
  for(let i=0;i<150;i++){const a=random()*6.28,r=15+random()*26;dummy.position.set(Math.sin(a)*r,.04,Math.cos(a)*r);dummy.scale.set(.06+random()*.14,.025+random()*.045,.07+random()*.13);dummy.rotation.set(0,random()*6.28,0);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}
  const welcomeStone=roundedBox(3.4,.12,1.5,.18,stoneMat,[0,.065,19.5],scene);welcomeStone.rotation.x=0;
  // Tiny migrating fireflies use one draw call.
  const fireflyCount=low?60:140,fireflyGeo=new THREE.BufferGeometry(),fireflyPositions=new Float32Array(fireflyCount*3),fireflyBases=[];
  for(let i=0;i<fireflyCount;i++){const x=(random()-.5)*65,y=.7+random()*5.8,z=(random()-.5)*65;fireflyBases.push([x,y,z,random()*6.28]);fireflyPositions.set([x,y,z],i*3);}
  fireflyGeo.setAttribute('position',new THREE.BufferAttribute(fireflyPositions,3));
  const fireflies=new THREE.Points(fireflyGeo,new THREE.PointsMaterial({map:haloTexture,color:'#ffe0a4',size:.21,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(fireflies);

  function animate(dt,elapsed,progress={}){
    oceanUniforms.time.value=elapsed;galaxyUniforms.time.value=elapsed;portalUniforms.time.value=elapsed;palmWind.value=elapsed;
    const opened=progress.portalOpen?1:0;portalUniforms.open.value=THREE.MathUtils.damp(portalUniforms.open.value,opened,2,dt);
    portalLight.intensity=4+portalUniforms.open.value*14+Math.sin(elapsed*1.4)*.5;
    archHeart.rotation.y=Math.sin(elapsed*.4)*.12;
    galaxyUniforms.complete.value=progress.completed?.has('washer')?1:0;
    pickups.forEach((pickup,i)=>{pickup.object.visible=!progress.collected?.has(pickup.id);pickup.object.position.y=1.7+Math.sin(elapsed*1.7+i*1.5)*.19;pickup.object.rotation.y=elapsed*.5+i*.8;});
    moving.forEach(item=>{
      if(item.kind==='frond')item.object.rotation.z=item.baseRotation+Math.sin(elapsed*.55+item.phase)*.025;
      if(item.kind==='bubble'){item.object.position.y=item.base.y+Math.sin(elapsed*.55+item.phase)*.5;item.object.position.x=item.base.x+Math.sin(elapsed*.31+item.phase)*.25;}
      if(item.kind==='signal'){item.object.material=pinkGlow;item.object.scale.setScalar(1+Math.sin(elapsed*1.5-item.phase)*.06);item.object.visible=Math.sin(elapsed*2-item.phase)>-.45;}
      if(item.kind==='portalSpark'){item.object.position.y=item.base.y+Math.sin(elapsed*.6+item.phase)*.3;item.object.material.opacity=.4+Math.sin(elapsed*1.5+item.phase)*.2;}
    });
    for(let i=0;i<fireflyCount;i++){const[x,y,z,p]=fireflyBases[i];fireflyPositions[i*3]=x+Math.sin(elapsed*.22+p)*1.2;fireflyPositions[i*3+1]=y+Math.sin(elapsed*.45+p)*.4;fireflyPositions[i*3+2]=z+Math.cos(elapsed*.19+p)*1.2;}
    fireflyGeo.attributes.position.needsUpdate=true;
  }
  function dispose(){
    const geometries=new Set(),materials=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material){const list=Array.isArray(object.material)?object.material:[object.material];list.forEach(material=>materials.add(material));}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }
  return {scene,spawn:new THREE.Vector3(0,1.7,22),quests,portal,pickups,obstacles,animate,dispose};
}
