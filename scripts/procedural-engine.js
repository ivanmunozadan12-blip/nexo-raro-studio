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
  const meshMaterial = material(color, opts.roughness, opts.metalness);
  if (opts.transparent) {
    meshMaterial.transparent = true;
    meshMaterial.opacity = Number.isFinite(Number(opts.opacity)) ? Number(opts.opacity) : .58;
    meshMaterial.depthWrite = false;
  }
  const mesh = new THREE.Mesh(geometry, meshMaterial);
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

export function detectEnvironment(value, type = '') {
  const text = clean(String(value || ''));
  const has = pattern => new RegExp('(?:^|[^a-z])(?:' + pattern + ')(?:$|[^a-z])').test(text);
  return {
    water: String(type).toLowerCase() === 'ocean' || has('mar|oceano|agua|rio|barco|ballena|coral|oceano atlantico'),
    space: String(type).toLowerCase() === 'space' || has('espacio|planeta|luna|estrella|orbita|galaxia'),
    historic: String(type).toLowerCase() === 'history' || has('antiguo|romano|egipto|medieval|castillo|imperio|fortaleza'),
    forest: has('bosque|selva|arbol|jungla|selva tropical'),
    science: String(type).toLowerCase() === 'science' || has('laboratorio|experimento|motor|maquina|ciencia|cohete|lanzamiento'),
  };
}

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
  const astronaut = /astronauta|astronaut/.test(appearance + ' ' + clean(spec.role));
  const scientist = /cientifico|investigador|doctor/.test(appearance + ' ' + clean(spec.role));
  const skin = spec.skinColor || pick(rng, COLORS.skin);
  const outfit = spec.clothingColor || (astronaut ? '#e8ecee' : scientist ? '#e7ece8' : royal ? '#6f2941' : sailor ? '#3d5870' : pick(rng, COLORS.cloth));
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
  block(torso, [0, .84, .015], [.54, .1, .35], astronaut ? '#aab5bb' : royal ? '#a47b37' : '#59402e');
  if (astronaut) {
    block(torso, [0, 1.18, -.29], [.52, .72, .25], '#aeb9bf');
    block(torso, [0, 1.23, .245], [.32, .24, .045], '#344653');
    for (let i = 0; i < 3; i++) ellipsoid(torso, [((i - 1) * .09), 1.23, .275], [.035, .035, .018], ['#c74b3f','#d4b34f','#5b9a9d'][i], 1);
    for (const side of [-1,1]) cylinder(torso, [side * .29, 1.45, 0], .12, .12, .13, '#aeb9bf', 12).rotation.z = Math.PI / 2;
  } else if (scientist) {
    block(torso, [-.16, .93, .205], [.16, .22, .045], '#f7f7f2');
    block(torso, [.16, .93, .205], [.16, .22, .045], '#f7f7f2');
    for (let y of [1.08, 1.28]) ellipsoid(torso, [0, y, .245], [.025,.025,.02], '#687d8b', 1);
  }
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
  if (!astronaut) ellipsoid(torso, [0, 2.17, -.015], [.25, .13, .23], hair, 2);
  if (astronaut) {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(.34, 20, 16), new THREE.MeshStandardMaterial({ color:'#9db4c0', metalness:.55, roughness:.2, transparent:true, opacity:.28 }));
    helmet.position.set(0, 2.0, 0);torso.add(helmet);
    const visor = ellipsoid(torso, [0, 1.99, .245], [.235, .19, .055], '#b99a56', 3);
    visor.material.metalness = .55;visor.material.roughness = .22;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.29, .035, 8, 24), material('#8b989d', .32, .6));
    rim.position.set(0, 2.0, .02);torso.add(rim);
  }
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
  g.userData.rig = { legs, arms, body: torso, humanArms: true, baseY: 0, motion: spec.motion || spec.action || 'idle' };
  return g;
}

function createQuadruped(g, species, rng, palette = {}) {
  const fur = palette.body || pick(rng, ['#b58a5d', '#8a8b83', '#c6a875', '#4c4a45', '#c0b5a0']);
  const dark = palette.dark || '#40352d';
  const feline = /tigre|leon|jaguar|lobo|zorro|perro|gato/.test(species);
  const horse = /caballo|cebra/.test(species);
  const elephant = /elefante/.test(species);
  const bodyLength = horse ? 1.22 : elephant ? 1.3 : 1.1;
  ellipsoid(g, [0, 1.18, 0], [bodyLength, elephant ? .78 : .52, elephant ? .62 : .46], fur, 4);
  ellipsoid(g, [-.62, 1.12, 0], [.42, .48, .48], fur, 3);
  ellipsoid(g, [.62, 1.13, 0], [.42, .48, .48], fur, 3);

  const head = groupAt(g, [0, horse ? 1.9 : 1.62, horse ? .8 : .78]);
  const headScale = elephant ? 1.15 : horse ? .9 : 1;
  ellipsoid(head, [0, 0, 0], [.34 * headScale, .31 * headScale, .35 * headScale], fur, 4);
  const muzzleColor = palette.muzzle || (feline ? '#d0bda0' : fur);
  if (feline) {
    ellipsoid(head, [0, -.12, .28], [.21, .14, .23], muzzleColor, 3);
    ellipsoid(head, [0, -.025, .47], [.065, .045, .04], '#29211d', 2);
    ellipsoid(head, [-.12, .08, .27], [.045, .055, .035], '#171514', 2);
    ellipsoid(head, [.12, .08, .27], [.045, .055, .035], '#171514', 2);
    for (const side of [-1, 1]) {
      cone(head, [side * .22, .28, -.01], .14, .32, fur, 7);
      for (let i = 0; i < 3; i++) link(head, [side * .18, -.13, .34], [side * (.38 + i * .08), -.1 - i * .04, .42], .008, '#d7d0c2', 4);
    }
  } else {
    ellipsoid(head, [-.18, .26, -.02], [.13, .18, .12], fur, 3);
    ellipsoid(head, [.18, .26, -.02], [.13, .18, .12], fur, 3);
    ellipsoid(head, [-.12, .08, .27], [.035, .04, .025], '#171514', 2);
    ellipsoid(head, [.12, .08, .27], [.035, .04, .025], '#171514', 2);
  }
  if (horse) {
    ellipsoid(head, [0, -.13, .3], [.2, .14, .25], '#47372c', 2);
    for (let i = 0; i < 8; i++) ellipsoid(head, [(i - 3.5) * .055, .3 + (i % 2) * .05, -.16], [.045, .18, .07], '#342a23', 1);
  }
  if (/leon/.test(species)) {
    ellipsoid(head, [0, .02, -.12], [.48, .48, .28], '#9b7043', 3);
    ellipsoid(head, [0, -.12, .16], [.2, .16, .17], '#d4bb91', 2);
  }
  if (elephant) {
    ellipsoid(head, [-.34, .02, -.02], [.25, .38, .13], fur, 3);
    ellipsoid(head, [.34, .02, -.02], [.25, .38, .13], fur, 3);
    link(head, [0, -.08, .25], [.02, -.42, .43], .13, fur, 12);
    link(head, [.02, -.42, .43], [.04, -.72, .48], .105, fur, 12);
    cone(head, [-.13, -.2, .28], .055, .38, '#e1d4bd', 8);
    cone(head, [.13, -.2, .28], .055, .38, '#e1d4bd', 8);
  }
  if (/ciervo|venado/.test(species)) {
    for (const side of [-1, 1]) {
      link(head, [side * .13, .22, 0], [side * .28, .65, -.02], .035, dark);
      link(head, [side * .28, .48, -.02], [side * .48, .62, .02], .025, dark);
      link(head, [side * .28, .48, -.02], [side * .27, .72, .02], .025, dark);
    }
  }

  const legs = [];
  for (const x of [-.72, .72]) for (const z of [-.29, .29]) {
    const leg = groupAt(g, [x, .9, z]);
    const upperLength = horse ? .48 : elephant ? .5 : .4;
    link(leg, [0, 0, 0], [0, -upperLength, .025], horse ? .105 : elephant ? .17 : .09, fur, 10);
    ellipsoid(leg, [0, -upperLength, .025], [horse ? .12 : .1, .11, .12], fur, 2);
    link(leg, [0, -upperLength, .025], [0, -.79, .12], horse ? .075 : elephant ? .13 : .06, fur, 10);
    ellipsoid(leg, [0, -.82, .18], [.14, .09, .2], horse ? '#3b3029' : dark, 2);
    legs.push(leg);
  }

  const tail = new THREE.Group();tail.position.set(0, 1.35, -.88);g.add(tail);
  link(tail, [0, 0, 0], [.04, -.14, -.32], .045, fur);
  link(tail, [.04, -.14, -.32], [.12, -.28, -.64], .035, fur);
  link(tail, [.12, -.28, -.64], [.2, -.23, -.92], .028, dark);
  if (horse) ellipsoid(tail, [.2, -.26, -.94], [.12, .2, .14], dark, 2);

  if (/jaguar/.test(species)) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
        const x = (col - 2) * .34 + (row % 2) * .08;
        const y = .98 + row * .2;
        const z = side * (.43 * Math.sqrt(Math.max(.12, 1 - (x / 1.12) ** 2)) + .012);
        const spot = new THREE.Mesh(new THREE.TorusGeometry(.065, .018, 6, 10), material(dark));
        spot.position.set(x, y, z);spot.rotation.x = side * Math.PI / 2;g.add(spot);
        ellipsoid(g, [x, y, z + side * .018], [.022, .022, .018], dark, 1);
      }
    }
  } else if (/tigre/.test(species)) {
    for (let i = 0; i < 9; i++) {
      const stripe = ellipsoid(g, [(i - 4) * .22, 1.48 - (i % 2) * .08, .18], [.045, .28, .035], dark, 1);
      stripe.rotation.z = (i - 4) * .1;
    }
  } else if (/cebra/.test(species)) {
    for (let i = 0; i < 9; i++) {
      const stripe = ellipsoid(g, [(i - 4) * .22, 1.28, .34], [.045, .34, .035], '#242424', 1);
      stripe.rotation.z = (i - 4) * .1;
    }
  }
  g.userData.rig = { legs, tail, motion: horse ? 'walk' : 'idle' };
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


function createOctopus(spec, rng) {
  const g = new THREE.Group();
  const palette = spec.palette || {};
  const bodyColor = palette.body || spec.color || '#a65e4b';
  const mantle = ellipsoid(g, [0, 1.72, -0.12], [.62, .72, .7], bodyColor, 4);
  mantle.rotation.x = -.18;
  ellipsoid(g, [0, 1.22, .18], [.48, .42, .48], bodyColor, 3);
  for (const side of [-1, 1]) {
    ellipsoid(g, [side * .23, 1.48, .55], [.13, .14, .1], '#f0dfc4', 2);
    ellipsoid(g, [side * .23, 1.48, .635], [.055, .065, .035], '#171514', 2);
  }
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const arm = groupAt(g, [Math.cos(angle) * .22, 1.13, Math.sin(angle) * .22]);
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const points = [[0,0,0],[dx*.34,-.12,dz*.34],[dx*.7,-.32,dz*.7],[dx*1.05,-.58,dz*1.05],[dx*1.28,-.82,dz*1.28]];
    for (let k = 0; k < points.length - 1; k++) {
      const radius = .105 - k * .014;
      link(arm, points[k], points[k+1], radius, bodyColor, 9);
      for (let s = 1; s <= 3; s++) {
        const t = s / 4;
        const p = points[k].map((v, axis) => v + (points[k+1][axis] - v) * t);
        ellipsoid(arm, [p[0], p[1] - radius*.82, p[2]], [radius*.24, radius*.12, radius*.24], '#e7d6c7', 1);
      }
    }
    arms.push({ group: arm, angle, phase: i * .55 });
  }
  g.userData.rig = { arms, octopus: true, motion: spec.motion || 'swim' };
  return g;
}

function createAnimal(spec, rng) {
  const g = new THREE.Group();
  const species = clean(spec.species || spec.name || spec.description || 'animal');
  if (/pulpo|octopus/.test(species)) return createOctopus(spec, rng);
  if (/ave|aguila|halcon|buho|pajaro|flamenco|pinguino/.test(species)) createBird(g, species, rng);
  else if (/pez|peces|pescado|tiburon|ballena|delfin/.test(species)) createFish(g, species, rng);
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
  const leafColor = spec.leafColor || pick(rng, ['#47784d', '#527d46', '#648a52', '#3e6f49']);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .34, 3.5, 12), material(trunkColor));
  trunk.position.y = 1.75;trunk.castShadow = true;g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const start = [Math.cos(angle) * .06, 1.5 + (i % 3) * .22, Math.sin(angle) * .06];
    const end = [Math.cos(angle) * (1 + (i % 2) * .2), 2.5 + (i % 3) * .3, Math.sin(angle) * (1 + (i % 2) * .2)];
    link(g, start, end, .075, trunkColor);
    for (let leaf = 0; leaf < 4; leaf++) {
      const offset = (leaf - 1.5) * .2;
      ellipsoid(g, [end[0] + Math.cos(angle + offset) * .28, end[1] + .2 + (leaf % 2) * .18, end[2] + Math.sin(angle + offset) * .28], [.38, .52, .34], leafColor, 2);
    }
  }
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI * 2 / 8;
    ellipsoid(g, [Math.cos(angle) * .55, 3 + (i % 3) * .25, Math.sin(angle) * .55], [.48, .65, .42], leafColor, 2);
  }
  ellipsoid(g, [0, 3.55, 0], [.58, .72, .5], leafColor, 2);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    link(g, [0, .18, 0], [Math.cos(angle) * .62, .04, Math.sin(angle) * .62], .08, trunkColor);
  }
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
  const bodyColor = spec.color || '#e5e8e8';
  if (/cohete/.test(name)) {
    cylinder(g, [0, 2.05, 0], .43, .5, 3.25, bodyColor, 24);
    cone(g, [0, 4.08, 0], .45, .85, spec.noseColor || '#c94b3d', 20);
    for (const side of [-1, 1]) {
      const fin = new THREE.Shape();fin.moveTo(0, .2);fin.lineTo(side * .62, -.45);fin.lineTo(side * .5, .9);fin.lineTo(0, .75);fin.closePath();
      const finMesh = new THREE.Mesh(new THREE.ShapeGeometry(fin), material('#c84c3d'));
      finMesh.position.set(0, .38, side * .28);finMesh.rotation.y = side * Math.PI / 2;g.add(finMesh);
    }
    cylinder(g, [0, .38, 0], .34, .42, .42, '#596267', 20);
    for (let y of [1.25, 2.2, 3.05]) {
      const window = new THREE.Mesh(new THREE.CircleGeometry(.11, 20), material('#5f9eaf', .22, .25));
      window.position.set(0, y, .435);g.add(window);
      cylinder(g, [0, y, .43], .15, .15, .025, '#aeb8ba', 20).rotation.x = Math.PI / 2;
    }
    const flameOuter = cone(g, [0, -.25, 0], .34, .9, '#f18a37', 16);
    const flameInner = cone(g, [0, -.55, 0], .2, .7, '#f7d36b', 16);
    g.userData.rig = { motion: 'launch', flames: [flameOuter, flameInner] };
  } else if (/avion|helicoptero/.test(name)) {
    ellipsoid(g, [0, 1.35, 0], [.42, .38, 1.9], bodyColor, 4);
    ellipsoid(g, [0, 1.48, 1.15], [.28, .23, .42], '#8ab1c2', 3);
    block(g, [0, 1.3, -.05], [3.7, .09, .62], '#aeb8bd');
    block(g, [0, 1.3, -1.55], [1.3, .07, .38], '#aeb8bd');
    if (/helicoptero/.test(name)) {
      link(g, [0, 1.8, 0], [0, 2.35, 0], .045, '#454b4f');
      block(g, [0, 2.38, 0], [3.2, .045, .13], '#454b4f');
      link(g, [0, 1.15, -1.5], [0, 1.15, -2.2], .04, '#454b4f');
    } else {
      cylinder(g, [0, 1.35, 2.0], .05, .05, .12, '#50575b', 10).rotation.x = Math.PI / 2;
      for (const side of [-1, 1]) cylinder(g, [side * 1.45, .95, .1], .32, .32, .15, '#33383b', 16).rotation.z = Math.PI / 2;
    }
  } else {
    block(g, [0, 1.05, 0], [2.6, .75, 1.3], spec.color || pick(rng, ['#536f85', '#9c493b', '#6b7663']));
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
  const color = spec.color || (/luna/.test(name) ? '#a9a9a4' : /tierra/.test(name) ? '#347ca8' : /sol|estrella/.test(name) ? '#f2b94d' : '#b16c54');
  ellipsoid(g, [0, 1.6, 0], [1.35, 1.35, 1.35], color, 4);
  if (/saturno/.test(name)) {
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


function createFromBlueprint(spec) {
  const blueprint = spec.blueprint;
  if (!blueprint || !Array.isArray(blueprint.parts) || !blueprint.parts.length) return null;
  const root = new THREE.Group();
  const nodes = new Map([['root', root]]);
  root.userData.paletteMaterials = [];
  for (const part of blueprint.parts) {
    const parent = nodes.get(part.parent || 'root') || root;
    const position = Array.isArray(part.position) ? part.position : [0,0,0];
    const size = Array.isArray(part.size) ? part.size : [1,1,1];
    const isOctopusBody = /^(mantle|head-base|arm-\d+-segment)/.test(String(part.id || ''));
    const color = spec.colorOverrides?.[part.id] || (isOctopusBody && spec.palette?.body ? spec.palette.body : null) || part.color || spec.color || '#9b978e';
    const surface = clean(spec.material || '');
    const defaults = /metal|alumin|acero|reflect|iridoforo/.test(surface)
      ? { roughness: .28, metalness: .62 }
      : /cristal|membrana|transluc|vidrio|luz/.test(surface)
      ? { roughness: .24, metalness: .08, transparent: true, opacity: .58 }
      : /piedra|roca|arena|calc|mineral/.test(surface)
      ? { roughness: .94, metalness: .02 }
      : /piel|tejido|organ|muscular|vegetal/.test(surface)
      ? { roughness: .48, metalness: .02 }
      : { roughness: .72, metalness: .04 };
    const node = part.group ? new THREE.Group() : (() => {
      let geometry;
      switch (part.primitive) {
        case 'box': geometry = new THREE.BoxGeometry(...size); break;
        case 'cylinder': geometry = new THREE.CylinderGeometry(Number(part.radiusTop ?? 1), Number(part.radiusBottom ?? 1), 1, Number(part.segments ?? 12)); break;
        case 'cone': geometry = new THREE.ConeGeometry(Number(part.radius ?? 1), 1, Number(part.segments ?? 12)); break;
        case 'torus': geometry = new THREE.TorusGeometry(Number(part.radius ?? .42), Number(part.tube ?? .08), 8, Number(part.segments ?? 20)); break;
        case 'sphere':
        default: geometry = new THREE.SphereGeometry(1, Number(part.widthSegments ?? 16), Number(part.heightSegments ?? 12)); break;
      }
      const holder = new THREE.Group();
      addMesh(holder, geometry, color, [0,0,0], size, {roughness:part.roughness ?? defaults.roughness, metalness:part.metalness ?? defaults.metalness, transparent:part.transparent ?? defaults.transparent, opacity:part.opacity ?? defaults.opacity});
      if (isOctopusBody) root.userData.paletteMaterials.push(holder.children[0]);
      return holder;
    })();
    if (part.group) node.position.set(...position);
    else node.children[0].position.set(...position);
    const actual = part.group ? node : node.children[0];
    actual.name = String(part.id || 'part');
    if (part.rotation) actual.rotation.set(...part.rotation);
    if (!part.group) {
      const mesh = actual;
      parent.add(mesh);
      nodes.set(part.id, mesh);
    } else {
      parent.add(node);
      nodes.set(part.id, node);
    }
  }
  root.userData.colorAnimation = spec.colorAnimation || null;
  root.userData.blueprintNodes = nodes;
  root.userData.blueprintAnimations = (Array.isArray(blueprint.animations) ? blueprint.animations : []).map(track => {
    const node = nodes.get(track.target);
    const axis = ['x','y','z'].includes(track.axis) ? track.axis : 'z';
    const channel = node?.[track.property];
    const initial = channel ? Number(channel[axis]) : 0;
    return { ...track, axis, base: Number.isFinite(Number(track.base)) ? Number(track.base) : initial };
  });
  return root;
}

export function createProceduralEntity(parent, input, index = 0) {
  const spec = typeof input === 'string' ? { name: input } : { ...(input || {}) };
  const name = spec.name || spec.label || spec.role || spec.description || spec.type || 'objeto';
  const type = spec.type && ['human','animal','ship','tree','building','vehicle','machine','lab','celestial','furniture','prop','artifact'].includes(spec.type)
    ? spec.type : inferEntityType({ ...spec, name });
  const seed = spec.id || spec.name || spec.role || (type + '-' + index);
  const rng = seededRandom(seed);
  if (Array.isArray(spec.dimensions) && spec.dimensions.length === 3) {
    const [width, height, depth] = spec.dimensions.map(Number);
    if (type === 'building') { spec.width = width; spec.height = height; spec.depth = depth; }
    if (type === 'human' && !spec.scale) spec.scale = height / 2.5;
  }
  if (type === 'building') spec.wallColor = spec.wallColor || spec.color;
  if (type === 'ship') spec.woodColor = spec.woodColor || spec.color;
  if (type === 'tree') spec.leafColor = spec.leafColor || spec.color;
  if (type === 'human') spec.clothingColor = spec.clothingColor || spec.color;
  if (type === 'animal') spec.palette = { ...(spec.palette || {}), body: (spec.palette && spec.palette.body) || spec.color };
  let model = createFromBlueprint(spec);
  if (!model && type === 'human') model = createHuman(spec, rng);
  else if (!model && type === 'animal') model = createAnimal(spec, rng);
  else if (!model && type === 'ship') model = createShip(spec, rng);
  else if (!model && type === 'tree') model = createTree(spec, rng);
  else if (!model && type === 'building') model = createBuilding(spec, rng);
  else if (!model && type === 'vehicle') model = createVehicle(spec, rng);
  else if (!model && type === 'machine') model = createMachine(spec, rng);
  else if (!model && type === 'lab') model = createLab(spec, rng);
  else if (!model && type === 'celestial') model = createCelestial(spec, rng);
  else if (!model && type === 'furniture') model = createFurniture(spec, rng);
  else if (!model) model = createProp(spec, rng);

  const pos = Array.isArray(spec.position) ? spec.position : [spec.x ?? ((index - 1.5) * 3), spec.y ?? 0, spec.z ?? -3];
  const scale = spec.scale ?? 1;
  model.position.set(Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0);
  if (typeof scale === 'number') model.scale.setScalar(scale);
  else if (Array.isArray(scale)) model.scale.set(...scale);
  if (Number.isFinite(Number(spec.rotationY))) model.rotation.y = Number(spec.rotationY);
  model.userData.entity = { id: String(spec.id || seed), name: String(name), type, action: spec.action || spec.motion || 'idle', support: spec.support || 'ground', dimensions: spec.dimensions || null, shape: spec.shape || null, material: spec.material || null, color: spec.color || null };
  model.userData.rig = model.userData.rig || {};
  model.userData.blueprintNodes = model.userData.blueprintNodes || new Map();
  model.userData.blueprintAnimations = model.userData.blueprintAnimations || [];
  model.userData.basePosition = model.position.clone();
  model.userData.baseRotationY = model.rotation.y;
  model.userData.baseRotationZ = model.rotation.z;
  parent.add(model);
  return model;
}

export function directScene(parent, sceneData = {}) {
  const raw = [];
  const explicit = Array.isArray(sceneData.entities) ? sceneData.entities : [];
  if (explicit.length) {
    explicit.forEach(item => raw.push(item));
  } else {
    (sceneData.characters || []).forEach((item, i) => {
      const c = typeof item === 'string' ? { role: item } : item;
      raw.push({ ...c, type: 'human', name: c.name || c.role || ('Personaje ' + (i + 1)), position: c.position || [((i % 5) - 2) * 2.1, 0, -2 - Math.floor(i / 5) * 1.6] });
    });
    (sceneData.objects || []).forEach(item => raw.push(item));
    (sceneData.props || []).forEach(item => raw.push(item));
  }
  const limit = 18;
  const beats = Array.isArray(sceneData.beats) ? sceneData.beats : [];
  const entities = raw.slice(0, limit).map((item, i) => {
    const spec = typeof item === 'string' ? { name: item } : { ...(item || {}) };
    if (!spec.blueprint && spec.model_id && sceneData.models) spec.blueprint = sceneData.models[spec.model_id];
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
    const beatStart = Number(beat?.at || 0);
    const beatDuration = Math.max(.001, Number(beat?.duration || 1));
    const beatProgress = beat ? Math.max(0, Math.min(1, (time - beatStart) / beatDuration)) : 0;
    entity.position.set(base.x, base.y, base.z);
    entity.rotation.y = entity.userData.baseRotationY || 0;
    entity.rotation.z = entity.userData.baseRotationZ || 0;
    const entityType = entity.userData.entity?.type;
    if (entityType === 'animal' && /nadar|swim|volar|fly|flotar|ascender/.test(action)) entity.position.y = base.y + .12 * Math.sin(time * 1.7 + entities.indexOf(entity));

    const colorAnimation = entity.userData.colorAnimation;
    if (colorAnimation && Array.isArray(entity.userData.paletteMaterials)) {
      const colorStart = Number(colorAnimation.at || 0), colorDuration = Math.max(.001, Number(colorAnimation.duration || 1));
      const colorProgress = Math.max(0, Math.min(1, (time - colorStart) / colorDuration));
      const animatedColor = new THREE.Color(colorAnimation.from || '#a65e4b').lerp(new THREE.Color(colorAnimation.to || '#777d7d'), colorProgress);
      entity.userData.paletteMaterials.forEach(mesh => mesh.material.color.copy(animatedColor));
    }
    const actionBoost = /abrir|expand|extender|replegar|despegar|contraer|elevar|emerger|revelar/.test(action) ? 1.55 : 1;
    for (const track of entity.userData.blueprintAnimations || []) {
      const node = entity.userData.blueprintNodes.get(track.target);
      if (!node) continue;
      const axis = ['x','y','z'].includes(track.axis) ? track.axis : 'z';
      const channel = node[track.property];
      const phase = Number(track.phase || 0);
      const baseValue = Number(track.base);
      const raw = track.mode === 'spin' ? time * Number(track.frequency || 1) : Number(track.amplitude || 0) * actionBoost * Math.sin(time * Number(track.frequency || 1) + phase);
      channel[axis] = track.property === 'scale' ? Math.max(.045, baseValue + raw) : baseValue + raw;
    }
    const walking = /caminar|andar|correr|walk|run|marchar|avanzar|acercarse|alejarse|perseguir/.test(action);
    const working = /examinar|observar|mirar|manipular|construir|reparar|levantar|girar|abrir|cerrar|escribir|medir|tocar|sujetar|golpear|lanzar|recoger|senalar|señalar|hablar|gesticular|indicar/.test(action);
    if (rig.legs) rig.legs.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(time * 6 + i * Math.PI) * .38 : 0; });
    if (rig.humanArms) rig.arms.forEach(({ group, side }) => { group.rotation.z = working ? side * (.22 + .18 * Math.sin(time * 3 + side)) : side * .035 * Math.sin(time * 1.8); group.rotation.x = working ? .12 * Math.sin(time * 2.6 + side) : 0; });
    if (rig.head) rig.head.rotation.y = working ? .12 * Math.sin(time * 1.7) : .045 * Math.sin(time * 1.1);
    if (rig.body) rig.body.rotation.y = walking ? .12 * Math.sin(time * 3) : .025 * Math.sin(time * 1.2);
    if (rig.wings) rig.wings.forEach(({ group, side }) => { group.rotation.z = side * (.1 + .55 * Math.sin(time * 8)); });
    if (rig.octopus) rig.arms.forEach(({ group, angle, phase }) => { const active = /replegar|extender|despegar|acechar|nadar|mover/.test(action); const amount = active ? .28 : .16; group.rotation.x = amount * Math.sin(time * 2.2 + phase); group.rotation.z = amount * Math.sin(time * 1.8 + phase) + .08 * Math.cos(angle); });
    if (rig.tail) rig.tail.rotation.y = .25 * Math.sin(time * 2.5);
    if (rig.fins) rig.fins.forEach((fin, i) => { fin.rotation.y = .18 * Math.sin(time * 3 + i); });
    if (rig.wheels) rig.wheels.forEach(wheel => { wheel.rotation.x = time * 1.2; });
    if (rig.flag) rig.flag.rotation.y = .15 * Math.sin(time * 3);
    if (rig.flames) rig.flames.forEach((flame, i) => { flame.scale.y = .75 + .3 * Math.sin(time * 12 + i); });
    if (entity.userData.entity?.type === 'ship') entity.rotation.z = .025 * Math.sin(time * 1.4);
    if (entity.userData.entity?.type === 'tree') entity.rotation.z = .018 * Math.sin(time * .7 + entities.indexOf(entity));
    if (/girar|rotar|dar vueltas|orbitar|spin/.test(action)) entity.rotation.y = (entity.userData.baseRotationY || 0) + time * .65;
    if (/balancear|oscilar|temblar|vibrar|latir/.test(action)) entity.rotation.z = (entity.userData.baseRotationZ || 0) + .07 * Math.sin(time * 4);
    if (beat && /cruza|atraviesa|desaparece por la derecha|pasa por delante/.test(action)) {
      entity.position.x = base.x + (beatProgress - .5) * 4.2;
    } else if (beat && /se acerca|acecha|avanza hacia|persigue/.test(action)) {
      entity.position.z = base.z + beatProgress * .85;
    } else if (beat && /escapa|sale por la abertura|se desliza hacia la salida/.test(action)) {
      entity.position.x = base.x + beatProgress * 2.1;
      entity.position.z = base.z - beatProgress * .7;
    } else if (/moverse|desplazarse|avanzar|retroceder|rodar|caminar|nadar|volar/.test(action)) {
      entity.position.x = base.x + .18 * Math.sin(time * 1.25 + entities.indexOf(entity));
      entity.position.z = base.z + .14 * Math.cos(time * 1.1 + entities.indexOf(entity));
    }
    if (/despegar|ascender|launch/.test(action)) entity.position.y = base.y + Math.min(1.8, time * .3);
    else if (/volar|nadar|flotar/.test(action)) entity.position.y = base.y + .16 * Math.sin(time * 2.2);
  }
}
