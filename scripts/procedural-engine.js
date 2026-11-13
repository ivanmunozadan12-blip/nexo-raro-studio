import * as THREE from 'three';

const COLORS = {
  skin: ['#d9a27e', '#b97855', '#edc19d', '#8d5b43'],
  cloth: ['#334e68', '#7d3f36', '#92734c', '#4c6550', '#6c557d'],
  wood: '#795337',
  stone: '#9b978e',
  gold: '#c6a04b',
};

export function seededRandom(seed = 'behind-del-mundo') {
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const material = (color, roughness = 0.78, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const addMesh = (group, geometry, color, position, scale = [1, 1, 1], opts = {}) => {
  const mesh = new THREE.Mesh(geometry, material(color, opts.roughness, opts.metalness));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};
const block = (g, p, s, c, opts) => addMesh(g, new THREE.BoxGeometry(...s), c, p, [1, 1, 1], opts);
const ellipsoid = (g, p, s, c, detail = 2) => addMesh(g, new THREE.SphereGeometry(1, 16, 12), c, p, s);
const cylinder = (g, p, rTop, rBottom, h, c, radial = 12) =>
  addMesh(g, new THREE.CylinderGeometry(rTop, rBottom, h, radial), c, p);
const cone = (g, p, r, h, c, radial = 10) =>
  addMesh(g, new THREE.ConeGeometry(r, h, radial), c, p);
const link = (g, a, b, radius, color, radial = 8) => {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const mesh = addMesh(g, new THREE.CylinderGeometry(radius, radius, delta.length(), radial), color,
    start.clone().add(end).multiplyScalar(.5).toArray());
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
};
const groupAt = (parent, position = [0, 0, 0], scale = 1) => {
  const group = new THREE.Group();
  group.position.set(...position);
  if (typeof scale === 'number') group.scale.setScalar(scale);
  else group.scale.set(...scale);
  parent.add(group);
  return group;
};
const pick = (rng, values) => values[Math.floor(rng() * values.length)];
const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function inferEntityType(value) {
  const text = clean(typeof value === 'string' ? value : [value?.type, value?.kind, value?.name, value?.description, value?.role].filter(Boolean).join(' '));
  if (/persona|personaje|rey|reina|soldado|marinero|explorador|colono|cientifico|astronauta|mujer|hombre|nino|niña/.test(text)) return 'human';
  if (/tigre|leon|jaguar|lobo|zorro|perro|gato|caballo|cebra|ciervo|venado|elefante|jirafa|oso|mono|gorila|vaca|toro|oveja|cabra|dinosaurio|dino|cocodrilo|lagarto|serpiente|tortuga|ballena|delfin|tiburon|pez|aguila|halcon|buho|pajaro|ave|flamenco|pingüino|pinguino/.test(text)) return 'animal';
  if (/barco|carabela|nao|navio|galeon|velero|lancha|buque|submarino|barca/.test(text)) return 'ship';
  if (/arbol|palmera|pino|roble|vegetacion|arbusto|planta/.test(text)) return 'tree';
  if (/castillo|palacio|templo|iglesia|catedral|piramide|casa|choza|edificio|faro|puente|torre|muralla|ruina/.test(text)) return 'building';
  if (/coche|automovil|carro|camion|tren|locomotora|avion|helicoptero|cohete|cohete|nave espacial|vehiculo/.test(text)) return 'vehicle';
  if (/maquina|motor|turbina|engranaje|robot|generador|prensa|maquinaria/.test(text)) return 'machine';
  if (/microscopio|telescopio|tubo de ensayo|matraz|probeta|laboratorio|instrumento cientifico/.test(text)) return 'lab';
  if (/planeta|luna|sol|estrella|asteroide|cometa|galaxia/.test(text)) return 'celestial';
  if (/mesa|silla|trono|cama|estanteria|mueble|banco/.test(text)) return 'furniture';
  if (/espada|lanza|escudo|arco|herramienta|martillo|pico|hacha|antorcha|brujula|mapa|cofre|ancla|campana|reloj|vasija|jarra|botella|libro|pergamino|moneda|tesoro/.test(text)) return 'prop';
  return 'artifact';
}

function createHuman(spec, rng) {
  const g = new THREE.Group();
  const appearance = clean(spec.appearance || spec.description || spec.name);
  const royal = /rey|reina|monarca|noble|principe|princesa/.test(appearance + ' ' + clean(spec.role));
  const sailor = /marinero|navegante|tripulante|pescador/.test(appearance + ' ' + clean(spec.role));
  const explorer = /explorador|colon|capitan|descubridor/.test(appearance + ' ' + clean(spec.role));
  const skin = spec.skinColor || pick(rng, COLORS.skin);
  const outfit = spec.clothingColor || (royal ? '#6f2941' : sailor ? '#3d5870' : pick(rng, COLORS.cloth));
  const hair = spec.hairColor || pick(rng, ['#30251f', '#49352a', '#9b7046', '#24201e']);
  const height = Number(spec.height) || 1;
  const torso = groupAt(g, [0, 0, 0], [height, height, height]);

  // Piernas con articulaciones y botas, preparadas para una marcha sencilla.
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = groupAt(torso, [side * .16, .82, 0]);
    cylinder(leg, [0, -.18, 0], .105, .12, .38, outfit, 10);
    ellipsoid(leg, [0, -.42, .045], [.11, .14, .19], skin, 1);
    block(leg, [0, -.55, .08], [.22, .13, .34], spec.bootColor || '#40352e');
    legs.push(leg);
  }
  // Cuerpo, chaqueta, cuello y cinturón.
  const body = cylinder(torso, [0, 1.15, 0], .24, .32, .72, outfit, 14);
  ellipsoid(torso, [0, 1.52, 0], [.32, .17, .23], outfit, 2);
  cylinder(torso, [0, 1.51, 0], .13, .15, .12, royal ? COLORS.gold : '#d2c3a2', 12);
  block(torso, [0, .84, .015], [.54, .1, .35], royal ? '#a47b37' : '#59402e');
  if (royal) {
    const cape = addMesh(torso, new THREE.ConeGeometry(.43, .92, 4, 1, true), '#702c42', [0, 1.08, -.2]);
    cape.rotation.x = Math.PI;
  }
  // Cabeza, orejas, nariz, ojos, pelo y rasgos.
  ellipsoid(torso, [0, 1.92, 0], [.235, .29, .22], skin, 3);
  ellipsoid(torso, [-.24, 1.93, 0], [.055, .09, .07], skin, 1);
  ellipsoid(torso, [.24, 1.93, 0], [.055, .09, .07], skin, 1);
  ellipsoid(torso, [-.085, 1.98, .194], [.025, .032, .018], '#28221f', 1);
  ellipsoid(torso, [.085, 1.98, .194], [.025, .032, .018], '#28221f', 1);
  ellipsoid(torso, [0, 1.89, .21], [.035, .055, .04], skin, 1);
  ellipsoid(torso, [0, 2.17, -.015], [.25, .13, .23], hair, 2);
  if (explorer || sailor) {
    cylinder(torso, [0, 2.2, 0], .28, .28, .055, '#c4a46a', 12);
    ellipsoid(torso, [0, 2.27, 0], [.29, .055, .26], '#5b4733', 1);
  }
  if (royal) {
    cylinder(torso, [0, 2.22, 0], .23, .28, .16, '#c9a64e', 10);
    for (let i = 0; i < 5; i++) cone(torso, [Math.cos(i * 1.256) * .18, 2.36, Math.sin(i * 1.256) * .18], .055, .19, '#f0d16c', 5);
  }
  if (/barba|barbudo/.test(appearance) || explorer) ellipsoid(torso, [0, 1.77, .14], [.16, .13, .1], hair, 2);

  // Brazos articulados, manos y codos.
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = groupAt(torso, [side * .31, 1.42, 0]);
    link(arm, [0, 0, 0], [side * .16, -.29, .035], .105, outfit);
    ellipsoid(arm, [side * .16, -.3, .035], [.11, .11, .11], outfit, 1);
    link(arm, [side * .16, -.3, .035], [side * .2, -.58, .12], .075, outfit);
    ellipsoid(arm, [side * .2, -.65, .13], [.075, .09, .075], skin, 1);
    arms.push({ group: arm, side });
  }
  g.userData.rig = { legs, arms, baseY: 0, motion: spec.motion || spec.action || 'idle' };
  return g;
}

function createQuadruped(g, species, rng, palette = {}) {
  const fur = palette.body || pick(rng, ['#b58a5d', '#8a8b83', '#c6a875', '#4c4a45', '#c0b5a0']);
  const dark = palette.dark || '#45362d';
  const body = ellipsoid(g, [0, 1.12, 0], [1.02, .58, .42], fur, 3);
  const neck = ellipsoid(g, [0, 1.42, .48], [.34, .48, .34], fur, 2);
  const head = groupAt(g, [0, 1.7, .72]);
  ellipsoid(head, [0, 0, 0], [.36, .32, .34], fur, 3);
  const muzzle = /lobo|zorro|perro|tigre|leon|jaguar|gato/.test(species);
  if (muzzle) ellipsoid(head, [0, -.12, .28], [.2, .14, .23], palette.muzzle || '#d7c3a3', 2);
  ellipsoid(head, [-.13, .06, .29], [.035, .04, .025], '#171514', 1);
  ellipsoid(head, [.13, .06, .29], [.035, .04, .025], '#171514', 1);
  if (/tigre|leon|jaguar/.test(species)) {
    for (let i = 0; i < 7; i++) {
      const stripe = block(g, [(i - 3) * .22, 1.38 + (i % 2) * .12, .39], [.055, .48, .035], dark);
      stripe.rotation.z = (i - 3) * .12;
    }
  }
  if (/elefante/.test(species)) {
    ellipsoid(head, [-.32, -.02, .03], [.23, .32, .12], fur, 2);
    ellipsoid(head, [.32, -.02, .03], [.23, .32, .12], fur, 2);
    link(head, [0, -.15, .25], [0, -.62, .38], .105, fur);
    cone(head, [-.13, -.24, .26], .055, .32, '#d8c6a3', 7);
    cone(head, [.13, -.24, .26], .055, .32, '#d8c6a3', 7);
  } else if (/ciervo|venado/.test(species)) {
    link(head, [-.13, .22, 0], [-.28, .68, -.02], .035, dark);
    link(head, [-.28, .48, -.02], [-.48, .62, .02], .025, dark);
    link(head, [-.28, .48, -.02], [-.27, .72, .02], .025, dark);
    link(head, [.13, .22, 0], [.28, .68, -.02], .035, dark);
    link(head, [.28, .48, -.02], [.48, .62, .02], .025, dark);
    link(head, [.28, .48, -.02], [.27, .72, .02], .025, dark);
  } else {
    ellipsoid(head, [-.2, .27, 0], [.12, .2, .12], fur, 2);
    ellipsoid(head, [.2, .27, 0], [.12, .2, .12], fur, 2);
  }
  const legs = [];
  for (const x of [-.68, .68]) for (const z of [-.24, .25]) {
    const leg = groupAt(g, [x, .83, z]);
    link(leg, [0, 0, 0], [0, -.55, .02], .09, fur);
    ellipsoid(leg, [0, -.58, .1], [.12, .1, .2], dark, 1);
    legs.push(leg);
  }
  const tail = link(g, [0, 1.25, -.35], [.08, 1.03, -.95], .055, fur);
  if (/caballo|cebra/.test(species)) {
    ellipsoid(g, [0, 1.42, -.45], [.12, .38, .1], dark, 1);
    for (const x of [-.1, .1]) ellipsoid(head, [x, .25, -.03], [.06, .12, .06], dark, 1);
  }
  g.userData.rig = { legs, tail, motion: 'walk' };
}

function createBird(g, species, rng) {
  const feather = pick(rng, ['#9b704c', '#4b6478', '#d0c4a6', '#3d3934']);
  ellipsoid(g, [0, 1.3, 0], [.48, .36, .72], feather, 3);
  const head = groupAt(g, [0, 1.55, .58]);
  ellipsoid(head, [0, 0, 0], [.28, .27, .3], feather, 3);
  ellipsoid(head, [-.1, .06, .26], [.035, .04, .025], '#171514', 1);
  ellipsoid(head, [.1, .06, .26], [.035, .04, .025], '#171514', 1);
  cone(head, [0, -.08, .34], .12, .3, '#d5a24b', 6).rotation.x = Math.PI / 2;
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = groupAt(g, [side * .32, 1.4, .05]);
    ellipsoid(wing, [side * .36, 0, 0], [.5, .12, .25], feather, 2);
    wings.push({ group: wing, side });
    link(g, [side * .13, 1.08, -.15], [side * .13, .78, -.22], .035, '#9d784d');
    for (let i = 0; i < 3; i++) link(g, [side * .13, .78, -.22], [side * (.13 + .1 * (i - 1)), .72, -.3], .018, '#9d784d');
  }
  g.userData.rig = { wings, motion: 'fly' };
}

function createFish(g, species, rng) {
  const color = pick(rng, ['#397b99', '#b77b4e', '#5e9b79', '#9c6e91']);
  ellipsoid(g, [0, 1.1, 0], [.42, .42, .95], color, 3);
  ellipsoid(g, [0, 1.13, .72], [.24, .2, .28], color, 2);
  cone(g, [0, 1.1, -1.12], .38, .62, color, 4).rotation.x = Math.PI / 2;
  const fins = [];
  for (const side of [-1, 1]) {
    const fin = cone(g, [side * .36, 1.13, -.1], .25, .55, '#d9b16b', 5);
    fin.rotation.z = Math.PI / 2 * side;
    fins.push(fin);
  }
  g.userData.rig = { fins, motion: 'swim' };
}

function createReptile(g, species, rng) {
  const skin = pick(rng, ['#6d8153', '#8b8b58', '#4d6c5c']);
  ellipsoid(g, [0, .8, 0], [.48, .32, .95], skin, 2);
  ellipsoid(g, [0, .82, .85], [.35, .24, .42], skin, 2);
  ellipsoid(g, [0, .76, 1.2], [.3, .14, .34], '#b9a67b', 2);
  for (const side of [-1, 1]) {
    ellipsoid(g, [side * .19, .96, 1], [.04, .045, .04], '#171514', 1);
    for (const z of [-.55, .55]) {
      const leg = groupAt(g, [side * .34, .72, z]);
      link(leg, [0, 0, 0], [side * .18, -.24, .08], .065, skin);
      ellipsoid(leg, [side * .22, -.26, .14], [.15, .07, .17], skin, 1);
    }
  }
  link(g, [0, .82, -.8], [0, .58, -1.8], .16, skin);
  g.userData.rig = { motion: 'crawl' };
}

function createAnimal(spec, rng) {
  const g = new THREE.Group();
  const species = clean(spec.species || spec.name || spec.description || 'animal');
  if (/ave|aguila|halcon|buho|pajaro|flamenco|pinguino/.test(species)) createBird(g, species, rng);
  else if (/pez|tiburon|ballena|delfin/.test(species)) createFish(g, species, rng);
  else if (/serpiente|cocodrilo|lagarto|tortuga/.test(species)) createReptile(g, species, rng);
  else createQuadruped(g, species, rng, spec.palette || {});
  return g;
}

function createShip(spec, rng) {
  const g = new THREE.Group();
  const wood = spec.woodColor || '#65432f';
  const sail = spec.sailColor || '#e6dcc4';
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.6, .1); hullShape.lineTo(-1.25, -.28); hullShape.lineTo(-.75, -.4);
  hullShape.lineTo(.95, -.4); hullShape.lineTo(1.45, -.2); hullShape.lineTo(1.7, .1);
  hullShape.lineTo(1.2, .18); hullShape.lineTo(-1.3, .18); hullShape.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 4.4, bevelEnabled: true, bevelSegments: 2, bevelSize: .08, bevelThickness: .08 }), material(wood));
  hull.rotation.x = -Math.PI / 2; hull.position.z = -2.2; hull.castShadow = true; g.add(hull);
  block(g, [0, .02, 0], [2.5, .12, 4.2], '#a67b4d');
  for (const side of [-1, 1]) {
    link(g, [side * 1.1, .12, -2], [side * 1.15, .48, 1.8], .045, '#4d3829');
    for (let z = -1.5; z <= 1.5; z += .42) link(g, [side * 1.1, .12, z], [side * 1.12, .4, z], .025, '#b18b5c');
  }
  const mastPositions = [-1.35, 0, 1.35], mastHeights = [2.6, 3.8, 2.9];
  mastPositions.forEach((z, i) => {
    const h = mastHeights[i];
    link(g, [0, .12, z], [0, h, z], .07, '#4b3528');
    link(g, [-.85, h * .68, z], [.85, h * .68, z], .035, '#4b3528');
    const cloth = block(g, [0, h * .48, z + .035], [1.35, h * .36, .045], sail);
    cloth.rotation.z = .025;
    for (const side of [-1, 1]) link(g, [0, .2, z], [side * .8, h * .7, z], .012, '#b7a17c', 5);
  });
  link(g, [0, .25, 1.7], [0, 1.2, 2.8], .05, '#4b3528');
  const flag = block(g, [0, 3.95, -1.35], [.52, .22, .025], spec.flagColor || '#9f3030');
  flag.userData.isFlag = true;
  g.userData.rig = { flag, motion: 'sail' };
  return g;
}

function createTree(spec, rng) {
  const g = new THREE.Group();
  const trunkColor = spec.trunkColor || '#765137';
  const leafColor = spec.leafColor || pick(rng, ['#47784d', '#527d46', '#648a52']);
  cylinder(g, [0, 1.1, 0], .2, .32, 2.2, trunkColor, 10);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const branch = [Math.cos(angle) * .55, 2.1 + (i % 2) * .3, Math.sin(angle) * .55];
    link(g, [0, 1.2, 0], branch, .075, trunkColor);
    ellipsoid(g, [branch[0], branch[1] + .38, branch[2]], [.62, .75, .6], leafColor, 2);
  }
  ellipsoid(g, [0, 2.65, 0], [.72, .85, .68], leafColor, 2);
  return g;
}

function createBuilding(spec, rng) {
  const g = new THREE.Group();
  const name = clean(spec.style || spec.name || spec.description || '');
  const wall = spec.wallColor || (/castillo|fortaleza/.test(name) ? '#8b8173' : '#c5b392');
  const roof = spec.roofColor || '#874b38';
  const width = Number(spec.width) || 4;
  const height = Number(spec.height) || 3;
  const depth = Number(spec.depth) || 3;
  block(g, [0, height / 2, 0], [width, height, depth], wall);
  block(g, [0, .08, depth / 2 + .025], [.8, 1.7, .08], '#4a382d');
  for (let x = -width / 2 + .6; x < width / 2; x += 1.1) {
    for (const y of [height * .55, height * .8]) {
      block(g, [x, y, depth / 2 + .045], [.35, .48, .07], '#3c5260');
      block(g, [x, y, depth / 2 + .09], [.05, .5, .06], '#d0b98e');
    }
  }
  if (/castillo|fortaleza|palacio/.test(name)) {
    const towerXs = [-width / 2 - .3, width / 2 + .3];
    for (const x of towerXs) {
      cylinder(g, [x, height * .55, 0], .58, .65, height * 1.1, wall, 8);
      cone(g, [x, height * 1.15, 0], .72, 1.1, roof, 8);
      block(g, [x, height * .85, depth / 2 + .08], [.24, .35, .08], '#344958');
    }
    for (let x = -width / 2; x <= width / 2; x += .45) block(g, [x, height + .16, depth / 2], [.24, .34, .3], wall);
  } else if (/templo|iglesia|catedral/.test(name)) {
    for (const x of [-width / 2 + .35, width / 2 - .35]) cylinder(g, [x, height / 2, depth / 2 + .2], .14, .17, height, '#ded3b9', 12);
    cone(g, [0, height + .5, 0], width * .68, 1.1, roof, 4);
  } else {
    const roofMesh = cone(g, [0, height + .62, 0], width * .72, 1.25, roof, 4);
    roofMesh.scale.z = depth / width;
  }
  return g;
}

function createVehicle(spec, rng) {
  const g = new THREE.Group();
  const name = clean(spec.name || spec.description || '');
  const bodyColor = spec.color || pick(rng, ['#536f85', '#9c493b', '#6b7663']);
  if (/avion|helicoptero|cohete/.test(name)) {
    ellipsoid(g, [0, 1.1, 0], [.42, .38, 2.2], bodyColor, 3);
    block(g, [0, 1.08, 0], [3.5, .08, .62], '#a8b2b5');
    cone(g, [0, 1.1, 2.25], .4, .8, '#d6dce0', 12).rotation.x = Math.PI / 2;
    if (/cohete/.test(name)) {
      cylinder(g, [0, 2, 0], .38, .42, 2.3, '#d9dce0', 16);
      cone(g, [0, 3.25, 0], .4, .65, '#c84b3c', 12);
      for (const side of [-1, 1]) block(g, [side * .42, 1.2, -.45], [.22, .75, .65], '#c84b3c');
    }
  } else {
    block(g, [0, 1.05, 0], [2.6, .75, 1.3], bodyColor);
    block(g, [0, 1.62, -.1], [1.35, .55, 1.12], '#9db4c1');
    for (const x of [-.9, .9]) for (const z of [-.48, .48]) {
      cylinder(g, [x, .48, z], .28, .28, .18, '#252525', 16).rotation.z = Math.PI / 2;
      cylinder(g, [x, .48, z + .1], .1, .1, .19, '#8c8c8c', 12).rotation.z = Math.PI / 2;
    }
  }
  return g;
}

function createMachine(spec, rng) {
  const g = new THREE.Group();
  const metal = spec.color || '#76868a';
  block(g, [0, .85, 0], [2.2, 1.3, 1.4], metal, { metalness: .55, roughness: .38 });
  for (const x of [-.78, .78]) {
    cylinder(g, [x, 1.8, 0], .48, .48, .28, '#454e52', 24).rotation.z = Math.PI / 2;
    const wheel = new THREE.Group(); wheel.position.set(x, 1.8, .2); g.add(wheel);
    for (let i = 0; i < 8; i++) link(wheel, [0, 0, 0], [Math.cos(i * Math.PI / 4) * .43, Math.sin(i * Math.PI / 4) * .43, 0], .035, '#c1c7c8');
    g.userData.wheels = g.userData.wheels || []; g.userData.wheels.push(wheel);
  }
  cylinder(g, [0, 1.8, -.45], .3, .3, .9, '#b2bdc0', 16);
  return g;
}

function createLab(spec, rng) {
  const g = new THREE.Group();
  block(g, [0, .75, 0], [2.8, .16, 1.4], '#65777d');
  for (const x of [-.85, 0, .85]) {
    cylinder(g, [x, 1.25, 0], .18, .24, .82, '#a7d0d1', 18);
    cylinder(g, [x, .85, 0], .22, .22, .1, '#8a9da0', 16);
    const liquid = cylinder(g, [x, 1.05, 0], .15, .18, .22, pick(rng, ['#4d9fc4', '#c17a52', '#7caa79']), 16);
    liquid.material.transparent = true; liquid.material.opacity = .85;
  }
  return g;
}

function createCelestial(spec, rng) {
  const g = new THREE.Group();
  const name = clean(spec.name || spec.description || '');
  const color = spec.color || (/luna/.test(name) ? '#a9a9a4' : /sol|estrella/.test(name) ? '#f2b94d' : '#b16c54');
  ellipsoid(g, [0, 1.6, 0], [1.35, 1.35, 1.35], color, 4);
  if (/planeta|tierra|saturno/.test(name)) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, .12, 8, 64), material('#c6b18b'));
    ring.rotation.x = Math.PI / 2.7; ring.position.y = 1.6; g.add(ring);
  }
  if (/tierra/.test(name)) {
    ellipsoid(g, [-.45, 1.9, .9], [.45, .18, .2], '#397a56', 2);
    ellipsoid(g, [.48, 1.3, .72], [.32, .2, .25], '#397a56', 2);
  }
  return g;
}

function createFurniture(spec, rng) {
  const g = new THREE.Group();
  const wood = spec.color || '#795337';
  block(g, [0, 1.05, 0], [1.8, .18, 1.2], wood);
  for (const x of [-.72, .72]) for (const z of [-.42, .42]) link(g, [x, 1, z], [x, .08, z], .07, wood);
  if (/silla|trono/.test(clean(spec.name || spec.description))) {
    block(g, [0, 1.7, -.48], [1.8, 1.2, .16], wood);
    if (/trono/.test(clean(spec.name || spec.description))) {
      for (const x of [-.65, .65]) cone(g, [x, 2.5, -.48], .16, .4, COLORS.gold, 6);
    }
  }
  return g;
}

function createProp(spec, rng) {
  const g = new THREE.Group();
  const name = clean(spec.name || spec.description || '');
  if (/espada|lanza|hacha|herramienta|martillo|pico/.test(name)) {
    link(g, [0, .2, 0], [0, 1.8, 0], .055, '#75543a');
    if (/espada/.test(name)) {
      const blade = cone(g, [0, 2.2, 0], .16, .9, '#b9c5c8', 4);
      blade.rotation.z = Math.PI;
      block(g, [0, 1.77, 0], [.58, .08, .1], '#b28b4c');
    } else block(g, [0, 1.75, 0], [.65, .28, .3], '#9aa3a5', { metalness: .6, roughness: .3 });
  } else if (/brujula|reloj|moneda|campana/.test(name)) {
    cylinder(g, [0, 1, 0], .55, .55, .15, /moneda/.test(name) ? COLORS.gold : '#b6a06e', 32);
    cylinder(g, [0, 1.1, 0], .42, .42, .025, '#d7cba8', 32);
    if (/campana/.test(name)) cone(g, [0, .55, 0], .45, .7, COLORS.gold, 16);
  } else if (/cofre|tesoro/.test(name)) {
    block(g, [0, .7, 0], [1.5, .9, 1], '#68452c');
    const lid = new THREE.Mesh(new THREE.SphereGeometry(.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), material('#91633c'));
    lid.position.set(0, 1.15, 0); lid.scale.set(1, .65, .7); g.add(lid);
    block(g, [0, .78, .53], [.18, .28, .06], COLORS.gold);
  } else {
    cylinder(g, [0, .12, 0], .58, .62, .22, '#6d6253', 16);
    block(g, [0, .28, 0], [.9, .12, .9], '#a88c62');
    ellipsoid(g, [0, .88, 0], [.43, .62, .36], spec.color || '#9a7752', 2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .045, 8, 32), material(COLORS.gold));
    ring.position.y = .9; ring.rotation.x = Math.PI / 2; g.add(ring);
  }
  return g;
}

export function createProceduralEntity(parent, input, index = 0) {
  const spec = typeof input === 'string' ? { name: input } : { ...(input || {}) };
  const name = spec.name || spec.label || spec.role || spec.description || spec.type || 'objeto';
  const type = spec.type && ['human','animal','ship','tree','building','vehicle','machine','lab','celestial','furniture','prop','artifact'].includes(spec.type)
    ? spec.type : inferEntityType({ ...spec, name });
  const seed = spec.id || spec.name || spec.role || (type + '-' + index);
  const rng = seededRandom(seed);
  let model;
  if (type === 'human') model = createHuman(spec, rng);
  else if (type === 'animal') model = createAnimal(spec, rng);
  else if (type === 'ship') model = createShip(spec, rng);
  else if (type === 'tree') model = createTree(spec, rng);
  else if (type === 'building') model = createBuilding(spec, rng);
  else if (type === 'vehicle') model = createVehicle(spec, rng);
  else if (type === 'machine') model = createMachine(spec, rng);
  else if (type === 'lab') model = createLab(spec, rng);
  else if (type === 'celestial') model = createCelestial(spec, rng);
  else if (type === 'furniture') model = createFurniture(spec, rng);
  else model = createProp(spec, rng);

  const pos = Array.isArray(spec.position) ? spec.position : [spec.x ?? ((index - 1.5) * 3), spec.y ?? 0, spec.z ?? -3];
  const scale = spec.scale ?? 1;
  model.position.set(Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0);
  if (typeof scale === 'number') model.scale.setScalar(scale);
  else if (Array.isArray(scale)) model.scale.set(...scale);
  if (Number.isFinite(Number(spec.rotationY))) model.rotation.y = Number(spec.rotationY);
  model.userData.entity = { id: String(spec.id || seed), name: String(name), type, action: spec.action || spec.motion || 'idle' };
  model.userData.basePosition = model.position.clone();
  parent.add(model);
  return model;
}

export function directScene(parent, sceneData = {}) {
  const raw = [];
  const explicit = Array.isArray(sceneData.entities) ? sceneData.entities : [];
  explicit.forEach(item => raw.push(item));
  (sceneData.characters || []).forEach((item, i) => {
    const c = typeof item === 'string' ? { role: item } : item;
    raw.push({ ...c, type: 'human', name: c.name || c.role || ('Personaje ' + (i + 1)), position: c.position || [((i % 5) - 2) * 2.1, 0, -2 - Math.floor(i / 5) * 1.6] });
  });
  (sceneData.objects || []).forEach(item => raw.push(item));
  (sceneData.props || []).forEach(item => raw.push(item));
  const limit = 18;
  const beats = Array.isArray(sceneData.beats) ? sceneData.beats : [];
  const entities = raw.slice(0, limit).map((item, i) => {
    const spec = typeof item === 'string' ? { name: item } : { ...(item || {}) };
    if (!spec.position) {
      const col = (i % 5) - 2;
      const row = Math.floor(i / 5);
      spec.position = [col * 2.7, 0, -3.5 - row * 2.8];
    }
    const entity = createProceduralEntity(parent, spec, i);
    entity.userData.beats = beats.filter(beat => !beat.entity_id || beat.entity_id === entity.userData.entity.id);
    return entity;
  });
  return entities;
}

export function animateEntities(entities, time = 0) {
  for (const entity of entities) {
    const rig = entity.userData.rig || {};
    const beat = (entity.userData.beats || []).filter(item => time >= Number(item.at || 0) && time < Number(item.at || 0) + Number(item.duration || 999)).sort((a, b) => Number(a.at || 0) - Number(b.at || 0)).at(-1);
    const action = clean(beat?.action || entity.userData.entity?.action || rig.motion || 'idle');
    const base = entity.userData.basePosition || entity.position;
    entity.position.y = base.y + .035 * Math.sin(time * 1.6 + entities.indexOf(entity));
    if (rig.legs) rig.legs.forEach((leg, i) => { leg.rotation.x = /caminar|andar|correr|walk|run|marchar/.test(action) ? Math.sin(time * 5 + i * Math.PI) * .32 : 0; });
    if (rig.arms) rig.arms.forEach(({ group, side }) => { group.rotation.z = /saludar|senalar|señalar|hablar|gesticular|indicar/.test(action) ? side * (.18 + .12 * Math.sin(time * 2)) : side * .025 * Math.sin(time * 1.5); });
    if (rig.wings) rig.wings.forEach(({ group, side }) => { group.rotation.z = side * (.1 + .55 * Math.sin(time * 8)); });
    if (rig.tail) rig.tail.rotation.y = .25 * Math.sin(time * 2.5);
    if (rig.fins) rig.fins.forEach((fin, i) => { fin.rotation.y = .18 * Math.sin(time * 3 + i); });
    if (rig.wheels) rig.wheels.forEach(wheel => { wheel.rotation.x = time * 1.2; });
    if (rig.flag) rig.flag.rotation.y = .15 * Math.sin(time * 3);
    if (entity.userData.entity?.type === 'ship') entity.rotation.z = .018 * Math.sin(time * 1.4);
    if (/volar|nadar|flotar|despegar|ascender/.test(action)) entity.position.y = base.y + .16 * Math.sin(time * 2.2);
  }
}
