import * as THREE from 'three';

// Klik dan hover benda langit lewat raycasting
//
// Yang di-raycast cuma daftar target khusus (bukan seluruh scene), jadi awan, atmosfer,
// cincin, asteroid, dan orbit gak pernah ikut ketangkap.
// Planet dan bulan dapat hit area sphere tak terlihat 1.6x radius, biar Merkurius yang kecil
// tetap gampang diklik. Mesh dengan visible = false gak dirender tapi tetap kena raycast
//
// Raycast dua tahap: mesh asli dulu, baru hit area besar kalau gak kena apa apa.
// Kalau langsung ke hit area, hit area Bumi yang lebih dekat ke kamera bisa nutupin Bulan
// yang kelihatan jelas di sebelahnya, jadi klik Bulan malah kena Bumi.
// Hit area juga cuma dipakai kalau bendanya kelihatan kecil di layar. Kalau kamera lagi dekat,
// hit area 1.6x jadi selebar layar dan "klik area kosong buat balik" malah gak bisa

// Klik dianggap valid kalau pointer gerak kurang dari ini antara pointerdown dan pointerup.
// Lebih dari itu berarti user lagi muter kamera, bukan klik
const CLICK_TOLERANCE_PX = 5;
const HIT_AREA_SCALE = 1.6;
// Di atas jari jari layar segini (px) benda sudah cukup besar buat diklik langsung
const HIT_AREA_MAX_SCREEN_RADIUS = 24;

export function createPicker({ camera, domElement, bodies, onSelect, onEmptyClick, onHoverChange }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Satu geometry dan material dipakai bareng semua hit area
  const hitGeometry = new THREE.SphereGeometry(1, 16, 12);
  const hitMaterial = new THREE.MeshBasicMaterial();
  const meshTargets = [];
  const hitTargets = [];
  const hitAreaBody = new Map();
  const bodyPosition = new THREE.Vector3();

  // userData.selectable di mesh asli sudah diisi waktu mesh dibuat (scene/*.js)
  for (const body of bodies.list) {
    meshTargets.push(body.mesh);
    // Matahari sudah besar, gak perlu hit area tambahan
    if (body.kind === 'star') continue;

    const hitArea = new THREE.Mesh(hitGeometry, hitMaterial);
    hitArea.name = `${body.id}-hit`;
    hitArea.visible = false;
    hitArea.scale.setScalar(body.radius * HIT_AREA_SCALE);
    hitArea.userData.selectable = body.id;
    body.mesh.add(hitArea);
    hitTargets.push(hitArea);
    hitAreaBody.set(hitArea, body);
  }

  let pointerInside = false;
  let hasMouse = false;
  let pressed = null;
  let hoveredId = null;

  function setPointer(event) {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // Perkiraan jari jari benda di layar dalam piksel (kamera perspektif)
  function screenRadius(body) {
    const distance = body.getPosition(bodyPosition).distanceTo(camera.position);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    return (body.radius / distance / Math.tan(halfFov)) * (domElement.clientHeight / 2);
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const direct = raycaster.intersectObjects(meshTargets, false)[0];
    if (direct) return direct.object.userData.selectable;

    const assisted = raycaster
      .intersectObjects(hitTargets, false)
      .find((hit) => screenRadius(hitAreaBody.get(hit.object)) < HIT_AREA_MAX_SCREEN_RADIUS);
    return assisted ? assisted.object.userData.selectable : null;
  }

  function setHovered(id) {
    if (id === hoveredId) return;
    hoveredId = id;
    domElement.style.cursor = id ? 'pointer' : '';
    onHoverChange?.(id);
  }

  function handlePointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    pressed = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event) {
    if (!pressed || event.pointerId !== pressed.id) return;
    const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
    pressed = null;
    if (moved >= CLICK_TOLERANCE_PX) return;

    setPointer(event);
    const id = pick();
    if (id) onSelect?.(id);
    else onEmptyClick?.();
  }

  function handlePointerMove(event) {
    // Hover cuma buat mouse / pen. Di layar sentuh gak ada konsep hover
    if (event.pointerType === 'touch') return;
    hasMouse = true;
    pointerInside = true;
    setPointer(event);
  }

  function handlePointerLeave() {
    pointerInside = false;
    setHovered(null);
  }

  function handlePointerCancel() {
    pressed = null;
  }

  domElement.addEventListener('pointerdown', handlePointerDown);
  domElement.addEventListener('pointerup', handlePointerUp);
  domElement.addEventListener('pointermove', handlePointerMove);
  domElement.addEventListener('pointerleave', handlePointerLeave);
  domElement.addEventListener('pointercancel', handlePointerCancel);

  return {
    // Dipanggil tiap frame setelah kamera final. Hover dicek per frame (bukan cuma pas mouse gerak)
    // karena planet terus bergerak, bisa aja planet lewat di bawah kursor yang diam
    update() {
      if (!hasMouse || !pointerInside || pressed) return;
      setHovered(pick());
    }
  };
}
