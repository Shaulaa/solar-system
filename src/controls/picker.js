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
// hit area 1.6x jadi selebar layar dan "klik area kosong buat balik" malah gak bisa.
//
// Urutan pencarian, berhenti di yang pertama kena:
//   1. mesh asli
//   2. hit area kecil (HIT_AREA_NEAR_PX): klik / ketuk yang memang nyaris tepat di titik benda.
//      Duluan dari label, karena di overview HP label Matahari bisa nutupin titik Venus di dekatnya
//   3. label nama (ui/labels.js), sasaran paling besar buat benda yang cuma beberapa piksel
//   4. hit area lebar (HIT_AREA_MIN_SCREEN_RADIUS), buat jari yang mendarat agak meleset
// Bulan yang di layar masih nempel ke planet induknya (lebih dekat dari hit area-nya) dihitung planetnya.
// Di overview Deimos dan Ganymede cuma sepiksel dari Mars dan Jupiter, gak mungkin sengaja dipilih
//
// Jari jauh lebih kasar dari kursor, jadi beberapa batas dibedakan per jenis pointer (touch / lainnya)

// Klik dianggap valid kalau pointer gerak kurang dari ini antara pointerdown dan pointerup.
// Lebih dari itu berarti user lagi muter kamera, bukan klik. Jari biasa geser beberapa piksel waktu ngetuk
const CLICK_TOLERANCE_PX = { touch: 12, mouse: 5 };
const HIT_AREA_SCALE = 1.6;
// Di atas jari jari layar segini (px) benda sudah cukup besar buat diklik langsung
const HIT_AREA_MAX_SCREEN_RADIUS = 24;
// Hit area minimal segini (px) di layar. Di overview HP Bumi cuma sekitar 4 px, dan di mode Skala Nyata
// planet jauh lebih kecil dari 1 piksel, 1.6x radius tetap gak kena. Jadi hit area dijamin minimal
// seukuran ini: 24 px buat kursor (batas minimum WCAG 2.5.8), 44 px buat jari. Hit area yang numpuk
// gak masalah, yang dipilih benda yang pusatnya paling dekat ke titik ketuk
const HIT_AREA_MIN_SCREEN_RADIUS = { touch: 22, mouse: 12 };
// Hit area tahap 2 (lihat urutan di atas)
const HIT_AREA_NEAR_PX = { touch: 14, mouse: 8 };
// Kotak label diperlebar segini (px) ke segala arah waktu dicocokkan dengan titik klik / ketuk
const LABEL_PADDING_PX = { touch: 8, mouse: 2 };
const byPointer = (values, pointerType) => (pointerType === 'touch' ? values.touch : values.mouse);

export function createPicker({
  scene,
  camera,
  domElement,
  bodies,
  onSelect,
  onEmptyClick,
  onHoverChange,
  pickLabel
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // Titik pointer terakhir dalam piksel CSS, buat dicocokkan dengan kotak label
  const client = { x: 0, y: 0 };

  // Satu geometry dan material dipakai bareng semua hit area
  const hitGeometry = new THREE.SphereGeometry(1, 16, 12);
  const hitMaterial = new THREE.MeshBasicMaterial();
  const meshTargets = [];
  const hitTargets = [];
  const hitAreaBody = new Map();
  const bodyPosition = new THREE.Vector3();
  const parentPosition = new THREE.Vector3();

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
    client.x = event.clientX;
    client.y = event.clientY;
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

  function placeHitAreas(minScreenRadius) {
    for (const [hitArea, body] of hitAreaBody) {
      // Benda yang masih tersembunyi gak boleh bisa diklik (mesh invisible tetap kena raycast)
      if (!body.visible) {
        hitArea.position.set(0, -1e9, 0);
        hitArea.updateMatrixWorld();
        continue;
      }
      body.getPosition(hitArea.position);
      const minRadius = worldPerPixel(hitArea.position.distanceTo(camera.position)) * minScreenRadius;
      hitArea.scale.setScalar(Math.max(body.radius * HIT_AREA_SCALE, minRadius));
      hitArea.updateMatrixWorld();
    }
  }

  // Bulan yang jaraknya ke planet induk di layar kurang dari mergeRadius (px) dihitung planetnya
  function resolveMoon(body, mergeRadius) {
    const parent = body.parentId ? bodies.get(body.parentId) : null;
    if (!parent?.visible) return body.id;
    body.getPosition(bodyPosition);
    parent.getPosition(parentPosition);
    const pixels = bodyPosition.distanceTo(parentPosition) / worldPerPixel(bodyPosition.distanceTo(camera.position));
    return pixels < mergeRadius ? parent.id : body.id;
  }

  // Kalau beberapa hit area numpuk (misal Bumi dan Bulan di overview), pilih yang pusatnya paling dekat
  // ke arah kursor, bukan yang permukaannya paling dekat kamera
  function pickHitArea(minScreenRadius, mergeRadius) {
    placeHitAreas(minScreenRadius);
    let best = null;
    let bestAngle = Infinity;
    for (const hit of raycaster.intersectObjects(hitTargets, false)) {
      const body = hitAreaBody.get(hit.object);
      if (screenRadius(body) >= HIT_AREA_MAX_SCREEN_RADIUS) continue;
      const center = hit.object.position;
      const angle = raycaster.ray.distanceToPoint(center) / center.distanceTo(raycaster.ray.origin);
      if (angle < bestAngle) {
        bestAngle = angle;
        best = body;
      }
    }
    return best ? resolveMoon(best, mergeRadius) : null;
  }

  function pick(pointerType = 'mouse') {
    raycaster.setFromCamera(pointer, camera);
    // Raycaster tetap kena mesh yang ada di dalam grup tersembunyi, jadi dicek manual
    const direct = raycaster
      .intersectObjects(meshTargets, false)
      .find((hit) => bodies.get(hit.object.userData.selectable)?.visible);
    if (direct) return direct.object.userData.selectable;

    const wide = byPointer(HIT_AREA_MIN_SCREEN_RADIUS, pointerType);
    return (
      pickHitArea(byPointer(HIT_AREA_NEAR_PX, pointerType), wide) ??
      pickLabel?.(client.x, client.y, byPointer(LABEL_PADDING_PX, pointerType)) ??
      pickHitArea(wide, wide)
    );
  }

  function setHovered(id) {
    if (id === hoveredId) return;
    hoveredId = id;
    domElement.style.cursor = id ? 'pointer' : '';
    onHoverChange?.(id);
  }

  function handlePointerDown(event) {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType };
  }

  function handlePointerUp(event) {
    if (!pressed || event.pointerId !== pressed.id) return;
    const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
    const pointerType = pressed.type;
    pressed = null;
    if (moved >= byPointer(CLICK_TOLERANCE_PX, pointerType)) return;

    setPointer(event);
    const id = pick(pointerType);
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
