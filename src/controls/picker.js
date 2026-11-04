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
// Hit area minimal segini (px) di layar. Di mode Skala Nyata planet jauh lebih kecil dari
// 1 piksel, 1.6x radius tetap gak kena kursor. Jadi hit area dijamin minimal seukuran ini
const HIT_AREA_MIN_SCREEN_RADIUS = 9;

export function createPicker({
  scene,
  camera,
  domElement,
  bodies,
  onSelect,
  onEmptyClick,
  onHoverChange
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Satu geometry dan material dipakai bareng semua hit area
  const hitGeometry = new THREE.SphereGeometry(1, 16, 12);
  const hitMaterial = new THREE.MeshBasicMaterial();
  const meshTargets = [];
  const hitTargets = [];
  const hitAreaBody = new Map();
  const bodyPosition = new THREE.Vector3();

  // Hit area ada di grup sendiri (bukan anak mesh benda), posisi dan ukurannya diatur
  // di world space sebelum tiap raycast. Jadi gak ikut ke-scale dua kali waktu ganti mode skala
  const hitGroup = new THREE.Group();
  hitGroup.name = 'hit-areas';
  scene.add(hitGroup);

  // userData.selectable di mesh asli sudah diisi waktu mesh dibuat (scene/*.js)
  for (const body of bodies.list) {
    meshTargets.push(body.mesh);
    // Matahari sudah besar, gak perlu hit area tambahan
    if (body.kind === 'star') continue;

    const hitArea = new THREE.Mesh(hitGeometry, hitMaterial);
    hitArea.name = `${body.id}-hit`;
    hitArea.visible = false;
    hitArea.userData.selectable = body.id;
    hitGroup.add(hitArea);
    hitTargets.push(hitArea);
    hitAreaBody.set(hitArea, body);
  }

  // Dimatikan selama loading dan intro. pointerdown yang terjadi waktu mati diabaikan,
  // jadi klik buat skip intro gak sekalian dianggap milih planet waktu pointerup-nya datang
  let enabled = true;
  let pointerInside = false;
  let hasMouse = false;
  let pressed = null;
  let hoveredId = null;

  function setPointer(event) {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // Berapa unit dunia per piksel layar di jarak tertentu (kamera perspektif)
  function worldPerPixel(distance) {
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    return (distance * Math.tan(halfFov)) / (domElement.clientHeight / 2);
  }

  // Perkiraan jari jari benda di layar dalam piksel
  function screenRadius(body) {
    const distance = body.getPosition(bodyPosition).distanceTo(camera.position);
    return body.radius / worldPerPixel(distance);
  }

  function placeHitAreas() {
    for (const [hitArea, body] of hitAreaBody) {
      body.getPosition(hitArea.position);
      const minRadius = worldPerPixel(hitArea.position.distanceTo(camera.position)) *
        HIT_AREA_MIN_SCREEN_RADIUS;
      hitArea.scale.setScalar(Math.max(body.radius * HIT_AREA_SCALE, minRadius));
      hitArea.updateMatrixWorld();
    }
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    placeHitAreas();
    const direct = raycaster.intersectObjects(meshTargets, false)[0];
    if (direct) return direct.object.userData.selectable;

    // Kalau beberapa hit area kecil numpuk (misal Bumi dan Bulan di overview),
    // pilih yang pusatnya paling dekat ke arah kursor, bukan yang permukaannya paling dekat kamera
    let best = null;
    let bestAngle = Infinity;
    for (const hit of raycaster.intersectObjects(hitTargets, false)) {
      const body = hitAreaBody.get(hit.object);
      if (screenRadius(body) >= HIT_AREA_MAX_SCREEN_RADIUS) continue;
      const center = hit.object.position;
      const angle =
        raycaster.ray.distanceToPoint(center) / center.distanceTo(raycaster.ray.origin);
      if (angle < bestAngle) {
        bestAngle = angle;
        best = body.id;
      }
    }
    return best;
  }

  function setHovered(id) {
    if (id === hoveredId) return;
    hoveredId = id;
    domElement.style.cursor = id ? 'pointer' : '';
    onHoverChange?.(id);
  }

  function handlePointerDown(event) {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
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
    setEnabled(value) {
      enabled = value;
      if (!value) {
        pressed = null;
        setHovered(null);
      }
    },
    // Dipanggil tiap frame setelah kamera final. Hover dicek per frame (bukan cuma pas mouse gerak)
    // karena planet terus bergerak, bisa aja planet lewat di bawah kursor yang diam
    update() {
      if (!enabled || !hasMouse || !pointerInside || pressed) return;
      setHovered(pick());
    }
  };
}
