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
const MAX_DISTANCE = { star: Infinity, planet: Infinity, dwarf: Infinity, moon: 40 };
// Jarak label di atas permukaan, kelipatan radius
const LABEL_LIFT = 1.25;

// Anti tumpuk. Di mode Skala Nyata (dan kalau zoom jauh) label planet dalam bisa numpuk jadi satu.
// Label yang tabrakan di layar disembunyikan, yang menang yang prioritasnya lebih tinggi.
// Lebar label diperkirakan dari jumlah huruf (font 11px uppercase + letter spacing 0.22em),
// biar gak perlu baca ukuran DOM tiap frame (itu maksa browser hitung ulang layout)
const LABEL_CHAR_WIDTH = 9.5;
const LABEL_PADDING = 10;
const LABEL_HEIGHT = 18;
const KIND_PRIORITY = { star: 3, planet: 2, dwarf: 2, moon: 1 };
// Label yang sebagian keluar layar disembunyikan (bukan digeser masuk, karena label yang
// digeser jadi gak nunjuk ke bendanya lagi). Tinggi elemen termasuk padding bawah 6px
const LABEL_BOX_HEIGHT = 22;
const EDGE_MARGIN = 4;

export function createLabels({ bodies }) {
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'labels-layer';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  document.body.appendChild(renderer.domElement);

  // Label gak ditempel ke hierarki benda (yang bisa ke-scale waktu ganti mode skala),
  // tapi ditaruh di grup sendiri dan posisinya di-set di world space tiap frame.
  // Jadi jarak label di atas permukaan selalu benar di skala mana pun
  const group = new THREE.Group();
  group.name = 'labels';

  const items = bodies.list.map((body) => {
    const element = document.createElement('div');
    element.className = 'label';
    element.textContent = body.name;

    const object = new CSS2DObject(element);
    // Titik jangkar di tengah bawah elemen, jadi labelnya duduk pas di atas benda
    object.center.set(0.5, 1);
    group.add(object);

    return {
      body,
      element,
      object,
      state: '',
      width: body.name.length * LABEL_CHAR_WIDTH + LABEL_PADDING,
      screen: new THREE.Vector3()
    };
  });

  let viewWidth = window.innerWidth;
  let viewHeight = window.innerHeight;

  // Makin tinggi makin didahulukan: yang di-hover, lalu jenis benda, lalu ukuran asli bendanya
  function priority(item) {
    const { body } = item;
    if (body.id === hoveredId) return Infinity;
    // Data Matahari gak punya radius (relatif Bumi), tapi jenisnya sudah paling tinggi
    return KIND_PRIORITY[body.kind] * 1000 + (body.data.radius ?? 0);
  }

  function overlaps(a, b) {
    return (
      Math.abs(a.screen.x - b.screen.x) < (a.width + b.width) / 2 &&
      Math.abs(a.screen.y - b.screen.y) < LABEL_HEIGHT
    );
  }

  // screen.y = tepi bawah label (titik jangkarnya di tengah bawah)
  function isInsideView(item) {
    const half = item.width / 2;
    return (
      item.screen.x - half >= EDGE_MARGIN &&
      item.screen.x + half <= viewWidth - EDGE_MARGIN &&
      item.screen.y - LABEL_BOX_HEIGHT >= EDGE_MARGIN &&
      item.screen.y <= viewHeight - EDGE_MARGIN
    );
  }

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
    group,
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
      viewWidth = width;
      viewHeight = height;
      renderer.setSize(width, height);
    },
    update(camera) {
      const focus = focusedId ? bodies.get(focusedId) : null;
      const candidates = [];

      for (const item of items) {
        const { body, object } = item;
        body.getPosition(position);
        const distance = position.distanceTo(camera.position);
        object.position.copy(position);
        object.position.y += body.radius * LABEL_LIFT;

        item.visible =
          enabled &&
          body.visible &&
          distance <= MAX_DISTANCE[body.kind] &&
          isRelated(body, focus);

        if (item.visible) {
          // Posisi di layar (piksel), z > 1 berarti di belakang kamera
          item.screen.copy(object.position).project(camera);
          if (item.screen.z > 1) {
            item.visible = false;
          } else {
            item.screen.x = ((item.screen.x + 1) / 2) * viewWidth;
            item.screen.y = ((1 - item.screen.y) / 2) * viewHeight;
            if (isInsideView(item)) candidates.push(item);
            else item.visible = false;
          }
        }
      }

      // Greedy: yang prioritas tinggi duluan dapat tempat, yang nabrak disembunyikan
      candidates.sort((a, b) => priority(b) - priority(a));
      const placed = [];
      for (const item of candidates) {
        if (placed.some((other) => overlaps(item, other))) item.visible = false;
        else placed.push(item);
      }

      for (const item of items) {
        const { body } = item;
        // Class cuma diganti kalau state-nya berubah, biar gak nyentuh DOM tiap frame
        const state = !item.visible ? 'is-hidden' : body.id === hoveredId ? 'is-hover' : '';
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
