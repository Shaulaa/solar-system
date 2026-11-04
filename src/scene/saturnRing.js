import * as THREE from 'three';
import { loadTexture, assignTexture } from '../utils/loader.js';
import { createRingTexture } from '../utils/planetTexture.js';

// Cincin planet (dipakai Saturnus)
// ring = { texture, inner, outer } dari data/planets.js, inner dan outer dalam kelipatan radius planet

// UV bawaan RingGeometry itu planar (kayak tekstur ditempel dari atas),
// padahal tekstur cincin bentuknya strip: kiri tepi dalam, kanan tepi luar.
// Jadi UV di-remap: u = jarak vertex dari pusat yang dinormalisasi 0..1, v di tengah strip
function remapRadialUV(geometry, innerRadius, outerRadius) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const span = outerRadius - innerRadius;

  for (let i = 0; i < position.count; i++) {
    const distance = Math.hypot(position.getX(i), position.getY(i));
    uv.setXY(i, (distance - innerRadius) / span, 0.5);
  }
  uv.needsUpdate = true;
}

// Bonus bayangan planet di cincin, disuntik ke MeshStandardMaterial lewat onBeforeCompile.
// Matahari di origin, jadi sinar ke planet arahnya kira kira normalize(posisiPlanet).
// Titik cincin yang ada di belakang planet (searah sinar) dan jarak tegak lurusnya
// ke garis sinar kurang dari radius planet berarti kena bayangan
function addPlanetShadow(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPlanetPosition = uniforms.uPlanetPosition;
    shader.uniforms.uPlanetRadius = uniforms.uPlanetRadius;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRingWorldPosition;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvRingWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uPlanetPosition;
        uniform float uPlanetRadius;
        varying vec3 vRingWorldPosition;`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        vec3 sunRay = normalize(uPlanetPosition);
        vec3 fromPlanet = vRingWorldPosition - uPlanetPosition;
        float along = dot(fromPlanet, sunRay);
        float offAxis = length(fromPlanet - sunRay * along);
        float lit = smoothstep(uPlanetRadius * 0.9, uPlanetRadius * 1.02, offAxis);
        float shadow = mix(1.0, lit, step(0.0, along));
        reflectedLight.directDiffuse *= shadow;
        reflectedLight.directSpecular *= shadow;`
      );
  };
}

export function createSaturnRing(ring, planetRadius) {
  const innerRadius = ring.inner * planetRadius;
  const outerRadius = ring.outer * planetRadius;

  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
  remapRadialUV(geometry, innerRadius, outerRadius);

  // transparent wajib biar alpha dari map dipakai.
  // depthWrite false biar bagian cincin yang tembus pandang gak nutupin planet / cincin di belakangnya
  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    roughness: 0.9,
    metalness: 0
  });

  const uniforms = {
    uPlanetPosition: { value: new THREE.Vector3() },
    uPlanetRadius: { value: planetRadius }
  };
  addPlanetShadow(material, uniforms);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ring';
  // RingGeometry aslinya tegak di bidang XY, direbahin ke bidang XZ (bidang ekuator planet).
  // Kemiringan 26,7 derajat datang dari tiltGroup tempat mesh ini ditempel
  mesh.rotation.x = -Math.PI / 2;
  // Disembunyikan sampai tekstur siap, kalau nggak sempat kelihatan cakram putih solid
  mesh.visible = false;

  // Cukup map aja, tanpa alphaMap.
  // PNG cincin itu RGBA, transparansinya sudah ada di channel alpha dan langsung kebaca lewat map.
  // alphaMap three.js justru baca channel HIJAU, jadi kalau dipasang juga
  // transparansinya kepotong dua kali dan cincin jadi redup kecoklatan
  loadTexture(ring.texture, { fallback: () => createRingTexture() }).then((texture) => {
    assignTexture(material, 'map', texture);
    mesh.visible = true;
  });

  return {
    mesh,
    update() {
      // Posisi planet = pusat cincin, karena cincin nempel di tiltGroup planet
      mesh.getWorldPosition(uniforms.uPlanetPosition.value);
    }
  };
}
