import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { seededRandom, inferEntityType, detectEnvironment, createProceduralEntity, directScene, animateEntities } from './procedural-engine.js';

test('the seeded generator is repeatable', () => {
  const a = seededRandom('same-entity');
  const b = seededRandom('same-entity');
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()]);
});

test('environment detection does not confuse ordinary words with sea keywords', () => {
  assert.equal(detectEnvironment('Jaguar camina por la selva y una exploradora lo observa', 'landscape').water, false);
  assert.equal(detectEnvironment('Castillo medieval en una colina con patio exterior', 'history').water, false);
  assert.equal(detectEnvironment('Tres barcos navegan por el mar abierto', 'ocean').water, true);
  assert.equal(detectEnvironment('Un cohete despega hacia el espacio', 'science').space, true);
});

test('semantic names resolve to distinct model families', () => {
  assert.equal(inferEntityType('jaguar adulto'), 'animal');
  assert.equal(inferEntityType('carabela de madera'), 'ship');
  assert.equal(inferEntityType('castillo medieval'), 'building');
  assert.equal(inferEntityType('astronauta'), 'human');
  assert.equal(inferEntityType('microscopio'), 'lab');
  assert.equal(inferEntityType('reloj antiguo'), 'prop');
});

test('all procedural families create real Three.js meshes, not placeholder spheres', () => {
  const samples = [
    { type: 'human', name: 'explorador', appearance: 'hombre con barba y ropa de cuero' },
    { type: 'animal', name: 'jaguar' },
    { type: 'animal', name: 'aguila' },
    { type: 'animal', name: 'tiburon' },
    { type: 'animal', name: 'cocodrilo' },
    { type: 'ship', name: 'carabela' },
    { type: 'tree', name: 'roble' },
    { type: 'building', name: 'castillo medieval' },
    { type: 'vehicle', name: 'automovil' },
    { type: 'machine', name: 'motor industrial' },
    { type: 'lab', name: 'laboratorio cientifico' },
    { type: 'celestial', name: 'planeta tierra' },
    { type: 'furniture', name: 'trono real' },
    { type: 'prop', name: 'espada medieval' },
    { type: 'artifact', name: 'reliquia misteriosa' },
  ];
  for (const sample of samples) {
    const world = new THREE.Group();
    const model = createProceduralEntity(world, sample, 0);
    let meshCount = 0;
    model.traverse(node => { if (node.isMesh) meshCount++; });
    assert.ok(model instanceof THREE.Group, sample.name + ' should be a group');
    assert.ok(meshCount >= 2, sample.name + ' should contain multiple mesh parts');
    assert.equal(world.children[0], model);
    assert.ok(model.userData.entity.id);
    assert.ok(model.userData.entity.type);
  }
});

test('self-contained blueprints create a valid group with positioned mesh children', () => {
  const world = new THREE.Group();
  const model = createProceduralEntity(world, {
    id: 'blueprint-test', type: 'prop', name: 'Modelo blueprint',
    position: [1, 2, 3],
    blueprint: {
      version: 1,
      parts: [
        { id: 'body', primitive: 'box', size: [2, 1, 1], position: [0, 0.5, 0], color: '#cc8844' },
        { id: 'detail', primitive: 'sphere', parent: 'body', size: [0.3, 0.3, 0.3], position: [0, 0.7, 0.6], color: '#ffffff' }
      ],
      animations: []
    }
  });
  assert.ok(model instanceof THREE.Group);
  assert.equal(model.position.x, 1);
  assert.equal(model.position.y, 2);
  assert.equal(model.position.z, 3);
  assert.equal(model.userData.blueprintNodes.get('body').isMesh, true);
  assert.equal(model.userData.blueprintNodes.get('detail').isMesh, true);
  assert.equal(model.userData.blueprintNodes.get('body').position.y, 0.5);
  let meshCount = 0;
  model.traverse(node => { if (node.isMesh) meshCount++; });
  assert.equal(meshCount, 2);
});

test('scene director creates named entities and animation advances without errors', () => {
  const world = new THREE.Group();
  const entities = directScene(world, {
    entities: [
      { id: 'ship-a', type: 'ship', name: 'Santa Maria', position: [-4, 0, -3], action: 'navegar' },
      { id: 'jaguar-a', type: 'animal', name: 'Jaguar', position: [3, 0, -2], action: 'caminar' },
    ],
    characters: [{ id: 'captain', role: 'capitan', appearance: 'barba roja y abrigo oscuro' }],
  });
  assert.equal(entities.length, 2);
  assert.equal(world.children.length, 2);
  assert.deepEqual(entities.map(x => x.userData.entity.id), ['ship-a', 'jaguar-a']);
  animateEntities(entities, 0.5);
  assert.ok(entities.every(x => Number.isFinite(x.position.y)));
});

test('blueprint animation is deterministic, positive-scale safe, and supports camouflage palette transitions', () => {
  const world = new THREE.Group();
  const model = createProceduralEntity(world, {
    id: 'octopus-animation-test', type: 'animal', name: 'Pulpo de prueba', species: 'pulpo',
    position: [0, 0, -3], palette: { body: '#a65e4b' },
    colorAnimation: { from: '#a65e4b', to: '#777d7d', at: 0, duration: 4 },
    blueprint: {
      version: 1,
      parts: [
        { id: 'mantle', primitive: 'sphere', size: [1, 1, 1], color: '#a65e4b' },
        { id: 'arm-0-segment-0', primitive: 'cylinder', size: [.1, 1, .1], color: '#a65e4b' },
        { id: 'papilla-0', primitive: 'cone', size: [.2, .2, .2], color: '#a65e4b' }
      ],
      animations: [
        { target: 'papilla-0', property: 'scale', axis: 'y', base: .1, amplitude: .9, frequency: 1 }
      ]
    }
  });
  const mantle = model.userData.paletteMaterials[0];
  const initial = mantle.material.color.clone();
  animateEntities([model], 2);
  const middle = mantle.material.color.clone();
  assert.notDeepEqual(middle.toArray(), initial.toArray());
  const firstAtTwo = middle.clone();
  const papilla = model.userData.blueprintNodes.get('papilla-0');
  animateEntities([model], Math.PI * 1.5);
  assert.ok(papilla.scale.y >= .045, 'animated geometry must never collapse through a negative scale');
  animateEntities([model], 2);
  assert.deepEqual(mantle.material.color.toArray(), firstAtTwo.toArray(), 'the same timeline time must render identically');
});

test('higher-detail blueprint geometry supports organic curves and lathed forms', () => {
  const world = new THREE.Group();
  const model = createProceduralEntity(world, {
    id: 'detailed-geometry-test', type: 'artifact', name: 'Pieza de geometría avanzada',
    blueprint: {
      version: 1,
      parts: [
        { id: 'capsule-body', primitive: 'capsule', size: [0.5, 1.2, 0.5], radius: 0.5, length: 1.2, color: '#b36d4c' },
        { id: 'vessel', primitive: 'lathe', parent: 'root', position: [1.2, 0, 0], size: [1, 1, 1], points: [[0.1,0],[0.35,0.1],[0.48,0.45],[0.3,0.8],[0.12,1]], segments: 32, color: '#b58b52' },
        { id: 'curved-branch', primitive: 'tube', parent: 'root', position: [-1.2,0,0], size: [1,1,1], points: [[0,0,0],[0.2,0.5,0],[0.55,0.8,0.2],[0.8,1.4,0.3]], radius: 0.08, color: '#47784d' },
        { id: 'ornament', primitive: 'torusknot', position: [0,2,0], size: [0.6,0.6,0.6], color: '#d0a34f' }
      ],
      animations: []
    }
  });
  const geometries = [];
  model.traverse(node => { if (node.isMesh) geometries.push(node.geometry.type); });
  assert.ok(geometries.includes('CapsuleGeometry'));
  assert.ok(geometries.includes('LatheGeometry'));
  assert.ok(geometries.includes('TubeGeometry'));
  assert.ok(geometries.includes('TorusKnotGeometry'));
  assert.equal(model.userData.blueprintNodes.size, 5);
});
