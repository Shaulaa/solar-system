import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Label nama di atas tiap benda langit, pakai CSS2DRenderer (elemen HTML biasa yang
// posisinya ngikutin titik 3D). Layer-nya pointer-events: none, jadi gak ngalangin drag kamera
//
// Aturan tampil
//   normal         redup (opacity 0.4)
//   di-hover       terang penuh
//   tersembunyi    kalau terlalu jauh dari kamera, atau lagi fokus ke benda lain
//                  (induk dan bulan bulan dari benda yang difokus tetap tampil)

// Batas jarak kamera ke benda. Bulan cuma muncul kalau kamera sudah cukup dekat,
// kalau nggak labelnya numpuk sama label planet induknya di tampilan overview
const MAX_DISTANCE = { star: Infinity, planet: Infinity, moon: 40 };
// Jarak label di atas permukaan, kelipatan radius
const LABEL_LIFT = 1.25;

export function createLabels({ bodies }) {
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'labels-layer';
  document.body.appendChild(renderer.domElement);

  const items = bodies.list.map((body) => {
    const element = document.createElement('div');
    element.className = 'label';
    element.textContent = body.name;

    const object = new CSS2DObject(element);
    // Titik jangkar di tengah bawah elemen, jadi labelnya duduk pas di atas benda
    object.center.set(0.5, 1);
    object.position.y = body.radius * LABEL_LIFT;
    body.labelAnchor.add(object);

    return { body, element, object, state: '' };
  });

  let enabled = true;
  let hoveredId = null;
  let focusedId = null;
  const position = new THREE.Vector3();

  // Waktu fokus, yang tampil cuma benda yang nyambung: bulan dari benda itu, atau planet induknya.
  // Label benda yang difokus sendiri disembunyikan karena namanya sudah besar di panel info
  function isRelated(body, focus) {
    if (!focus) return true;
    return body.parentId === focus.id || body.id === focus.parentId;
  }

  return {
    setEnabled(value) {
      enabled = value;
    },
    setHovered(id) {
      hoveredId = id;
    },
    setFocus(id) {
      focusedId = id;
    },
    setSize(width, height) {
      renderer.setSize(width, height);
    },
    update(camera) {
      const focus = focusedId ? bodies.get(focusedId) : null;

      for (const item of items) {
        const { body } = item;
        const distance = body.getPosition(position).distanceTo(camera.position);
        const visible =
          enabled && distance <= MAX_DISTANCE[body.kind] && isRelated(body, focus);

        // Class cuma diganti kalau state-nya berubah, biar gak nyentuh DOM tiap frame
        const state = !visible ? 'is-hidden' : body.id === hoveredId ? 'is-hover' : '';
        if (state !== item.state) {
          item.element.className = state ? `label ${state}` : 'label';
          item.state = state;
        }
      }
    },
    render(scene, camera) {
      renderer.render(scene, camera);
    }
  };
}
