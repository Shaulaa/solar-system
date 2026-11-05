import * as THREE from 'three';
import earthVertex from '../shaders/earth.vert?raw';
import earthFragment from '../shaders/earth.frag?raw';
import atmosphereVertex from '../shaders/atmosphere.vert?raw';
import atmosphereFragment from '../shaders/atmosphere.frag?raw';
import { loadTexture, assignTexture } from '../utils/loader.js';
import { createPlanetTexture } from '../utils/planetTexture.js';

// Bumi dibikin 3 lapis, gak lewat jalur planet generik
// 1. permukaan, shader custom yang nyampur daymap dan nightmap (lampu kota) berdasarkan arah matahari,
//    plus relief dari normal map dan kilau matahari di laut dari specular map
// 2. awan, sphere 1.01x dengan alphaMap, muter sedikit lebih cepat dari permukaan
// 3. atmosfer, shell 1.04x BackSide + additive, nyala biru di tepi

const CLOUD_SPEED = 1.15;
const CLOUD_SCALE = 1.01;
// Lapisan terluar Bumi, dipakai juga buat bounding sphere (jarak kamera fokus)
export const ATMOSPHERE_SCALE = 1.04;
const SEGMENTS = 64;
const NORMAL_STRENGTH = 8;
const SPECULAR_STRENGTH = 0.9;
const SUN_COLOR = new THREE.Color(0xfff1dd); // sama dengan PointLight di scene/sun.js

// Tekstur 1x1 pengganti selama normal map / specular map belum ada (atau gak dipakai).
// Normal (0.5, 0.5, 1) berarti permukaan rata, specular hitam berarti gak ada kilau
function createFlatTexture(r, g, b) {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

export function createEarth(data, radius, seed) {
  const group = new THREE.Group();
  group.name = `${data.id}-layers`;

  // Satu Vector3 dipakai bareng sama shader permukaan dan atmosfer,
  // jadi cukup di-update sekali per frame
  const sunDirection = new THREE.Vector3(1, 0, 0);
  const atmosphereColor = new THREE.Color('#78b6ff');

  // Permukaan
  const surfaceMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: null },
      uNightMap: { value: null },
      uNormalMap: { value: createFlatTexture(128, 128, 255) },
      uSpecularMap: { value: createFlatTexture(0, 0, 0) },
      uNormalStrength: { value: NORMAL_STRENGTH },
      uSpecularStrength: { value: SPECULAR_STRENGTH },
      uSunDirection: { value: sunDirection },
      uSunColor: { value: SUN_COLOR },
      uAtmosphereColor: { value: atmosphereColor }
    },
    vertexShader: earthVertex,
    fragmentShader: earthFragment
  });

  const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, SEGMENTS, SEGMENTS), surfaceMaterial);
  surface.name = data.id;
  surface.userData.selectable = data.id;
  group.add(surface);

  // Awan
  // Disembunyikan dulu sampai alphaMap siap, kalau nggak Bumi bakal ketutup bola putih polos
  const cloudsMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    roughness: 1,
    metalness: 0
  });
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * CLOUD_SCALE, SEGMENTS, SEGMENTS),
    cloudsMaterial
  );
  clouds.name = `${data.id}-clouds`;
  clouds.visible = false;
  group.add(clouds);

  // Atmosfer
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * ATMOSPHERE_SCALE, SEGMENTS, SEGMENTS),
    new THREE.ShaderMaterial({
      uniforms: {
        uSunDirection: { value: sunDirection },
        uAtmosphereColor: { value: atmosphereColor }
      },
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    })
  );
  atmosphere.name = `${data.id}-atmosphere`;
  group.add(atmosphere);

  // Tekstur, masing masing punya fallback prosedural sendiri.
  // Seed day dan night sengaja sama supaya lampu kota prosedural jatuh di daratan prosedural juga
  const { day, night, clouds: cloudsFile, normal, specular } = data.texture;
  const uniforms = surfaceMaterial.uniforms;

  const dayLoaded = loadTexture(day, { fallback: () => createPlanetTexture(data.look, seed) });
  dayLoaded.then((texture) => {
    uniforms.uDayMap.value = texture;
  });

  // Normal map dan specular map itu data, jadi linear. Gak ada fallback prosedural:
  // kalau filenya gak ada, Bumi tetap rata tanpa kilau. Kalau daymap-nya yang prosedural
  // (file asli gak ada), dua peta ini juga gak dipakai, karena benua dan lautnya gak bakal pas
  const attachDataMap = (file, uniform) => {
    Promise.all([dayLoaded, loadTexture(file, { color: false })]).then(([dayTexture, texture]) => {
      if (!texture) return;
      if (dayTexture.isCanvasTexture) {
        texture.dispose();
        return;
      }
      uniforms[uniform].value.dispose();
      uniforms[uniform].value = texture;
    });
  };
  attachDataMap(normal, 'uNormalMap');
  attachDataMap(specular, 'uSpecularMap');

  loadTexture(night, {
    fallback: () => createPlanetTexture({ type: 'earthNight', colors: data.look.colors }, seed)
  }).then((texture) => {
    surfaceMaterial.uniforms.uNightMap.value = texture;
  });

  // Awan dipakai sebagai alphaMap (data, bukan warna), jadi dibiarkan linear
  loadTexture(cloudsFile, {
    color: false,
    fallback: () => {
      const texture = createPlanetTexture({ type: 'clouds', colors: [] }, seed + 1);
      texture.colorSpace = THREE.NoColorSpace;
      return texture;
    }
  }).then((texture) => {
    assignTexture(cloudsMaterial, 'alphaMap', texture);
    clouds.visible = true;
  });

  const worldPosition = new THREE.Vector3();

  return {
    group,
    mesh: surface,
    boundingScale: ATMOSPHERE_SCALE,
    update(spin) {
      surface.rotation.y = spin;
      clouds.rotation.y = spin * CLOUD_SPEED;

      // Matahari ada di titik (0,0,0) world, jadi arah ke matahari = -posisi Bumi.
      // Dihitung di world space biar sama dengan vNormalW di shader.
      // getWorldPosition ikut nge-update matrix parent, jadi orbit frame ini sudah kehitung
      surface.getWorldPosition(worldPosition);
      sunDirection.copy(worldPosition).negate().normalize();
    }
  };
}
