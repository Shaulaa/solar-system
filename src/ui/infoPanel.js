import gsap from 'gsap';
import { START_DAYS_SINCE_J2000, simDate } from '../utils/time.js';
import { moonPhase } from '../utils/moon.js';
import { solarEclipses, lunarEclipses, nextEclipse, eclipseRegion } from '../data/eclipses.js';
import { t, LOCALE } from '../i18n/index.js';
import { motion, shift } from '../utils/motion.js';
import { bodyFigures, bodyColor } from './bodyFigure.js';
import { planets as planetData } from '../data/planets.js';

// Panel info benda langit
// Desktop muncul dari kanan, mobile (lebar < 768px) jadi bottom sheet dari bawah.
// Semua isi diambil dari data/planets.js. Angka mentah (AU, hari, derajat) diformat di sini

const MOBILE_QUERY = '(max-width: 767px)';
// Kira kira seberapa jauh framing kamera digeser ke atas waktu bottom sheet kebuka,
// biar planet yang difokus pas di area yang gak ketutup sheet (sheet tingginya maks 55vh)
const SHEET_VIEW_SHIFT = 0.2;
// Lebar gradasi di sisi kiri panel desktop (piksel), harus sama dengan padding kiri .info-panel di style.css
const PANEL_FADE = 56;
// Jumlah baris data yang langsung kelihatan di HP
const KEY_ROWS = 4;
// Bottom sheet ditutup kalau ditarik turun sejauh ini (px) atau dilepas dengan kecepatan segini (px/ms)
const SWIPE_CLOSE_DISTANCE = 90;
const SWIPE_CLOSE_VELOCITY = 0.6;
const KM_PER_AU_MILLION = 149.6;
const DAYS_PER_YEAR = 365.25;

const number1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const number2 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const number0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

// Di bawah 2 tahun lebih kebayang kalau ditulis dalam hari
function formatYear(days) {
  return days < 730
    ? t('unit.days', { value: number2.format(days) })
    : t('unit.earthYears', { value: number2.format(days / DAYS_PER_YEAR) });
}

// Rotasi di bawah 2 hari ditulis dalam jam. Nilai negatif = rotasi berlawanan arah (retrograde)
function formatDay(days) {
  const abs = Math.abs(days);
  const text = abs < 2 ? t('unit.hours', { value: number1.format(abs * 24) }) : t('unit.days', { value: number1.format(abs) });
  return days < 0 ? t('unit.retrograde', { value: text }) : text;
}

// Jarak dalam tahun cahaya. Dari sejuta ke atas ditulis "x juta" biar gak kepanjangan
function formatLightYears(ly) {
  return ly >= 1e6
    ? t('unit.millionLightYears', { value: number2.format(ly / 1e6) })
    : t('unit.lightYears', { value: number0.format(ly) });
}

const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });

// Tanggal perihelion (titik terdekat ke Matahari) berikutnya dari hari ini, dari elemen orbit komet
function nextPerihelion(data) {
  const { perihelion, meanLongitude } = data.orbit;
  const anomaly = meanLongitude - perihelion + (360 / data.orbitPeriod) * START_DAYS_SINCE_J2000;
  const remaining = (360 - (((anomaly % 360) + 360) % 360)) / 360;
  return monthYear.format(simDate(remaining * data.orbitPeriod));
}

// Nama fase Bulan (phase.0 sampai phase.7 di kamus), delapan bagian siklus yang berpusat di tiap fase utama
function formatPhase(simDays) {
  const phase = moonPhase(START_DAYS_SINCE_J2000 + simDays);
  const name = t(`phase.${Math.floor(phase.fraction * 8 + 0.5) % 8}`);
  return t('phase.value', { name, percent: number0.format(phase.illumination * 100) });
}

const fullDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Gerhana berikutnya setelah tanggal simulasi, null di luar rentang daftar (data/eclipses.js)
function formatNextEclipse(list, simDays) {
  const date = simDate(simDays);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const eclipse = nextEclipse(list, iso);
  if (!eclipse) return null;
  const text = `${fullDate.format(new Date(`${eclipse.date}T00:00:00Z`))}, ${t(`eclipse.${eclipse.type}`)}`;
  const region = eclipseRegion(eclipse);
  return region ? `${text} (${region})` : text;
}

function formatDistance(au) {
  return t('unit.auKm', { au: number2.format(au), km: number1.format(au * KM_PER_AU_MILLION) });
}

// Baris statistik per jenis benda. Baris dengan nilai kosong otomatis dilewati
// simDays = hari simulasi sekarang, buat fase Bulan dan gerhana berikutnya
function getStats(body, simDays) {
  const { data, kind } = body;
  const info = data.info ?? {};

  // Bintang tetangga (data/nearbyStars.js) punya baris sendiri
  if (kind === 'nearby-star') {
    return [
      [t('row.distanceFromSun'), t('unit.lightYears', { value: number2.format(data.distanceLy) })],
      [t('row.spectral'), data.spectral],
      [t('row.surfaceTemperature'), `${number0.format(data.temperature)} K`],
      [t('row.constellation'), data.constellation]
    ];
  }
  // Galaksi Grup Lokal (data/localGroup.js). Bima Sakti gak punya jarak, gantinya jarak Matahari ke pusatnya
  if (kind === 'local-galaxy') {
    return [
      [t('row.distanceFromSun'), data.distanceLy != null ? formatLightYears(data.distanceLy) : null],
      [t('row.sunToCenter'), data.sunDistanceLy != null ? formatLightYears(data.sunDistanceLy) : null],
      [t('row.diameter'), t('unit.about', { value: formatLightYears(data.diameterLy) })],
      [t('row.galaxyType'), data.galaxyType],
      [t('row.stars'), data.stars],
      [t('row.constellation'), data.constellation]
    ].filter((row) => row[1] != null);
  }
  // Komet: jarak terdekat dan terjauh dari elemen orbitnya
  if (kind === 'comet') {
    const { eccentricity } = data.orbit;
    return [
      [t('row.size'), info.diameter],
      [t('row.orbitPeriod'), formatYear(data.orbitPeriod)],
      [t('row.perihelion'), formatDistance(data.distance * (1 - eccentricity))],
      [t('row.aphelion'), formatDistance(data.distance * (1 + eccentricity))],
      [t('row.nextPerihelion'), nextPerihelion(data)]
    ];
  }
  // Planet katai ngorbit Matahari juga, jadi datanya ditampilkan sama kayak planet
  const isPlanet = kind === 'planet' || kind === 'dwarf';
  const eclipses = data.id === 'moon' || data.id === 'earth';

  return [
    [t('row.diameter'), info.diameter],
    isPlanet && [t('row.meanDistance'), formatDistance(data.distance)],
    kind === 'moon' && [t('row.orbitDistance'), info.jarak],
    isPlanet && [t('row.year'), formatYear(data.orbitPeriod)],
    kind === 'moon' && [t('row.orbitTime'), formatYear(data.orbitPeriod)],
    data.rotationPeriod != null && [t(isPlanet ? 'row.day' : 'row.rotation'), formatDay(data.rotationPeriod)],
    [t('row.temperature'), info.suhu],
    isPlanet && [t('row.moons'), info.bulan],
    data.tilt != null && [t('row.tilt'), `${number2.format(data.tilt)}°`],
    // Fase dan gerhana dihitung dari tanggal simulasi waktu panel dibuka
    data.id === 'moon' && [t('row.moonPhase'), formatPhase(simDays)],
    eclipses && [t('row.nextSolarEclipse'), formatNextEclipse(solarEclipses, simDays)],
    eclipses && [t('row.nextLunarEclipse'), formatNextEclipse(lunarEclipses, simDays)]
  ].filter((row) => row && row[1] != null && row[1] !== '');
}

function getSubtitle(body) {
  return body.data.subtitle ?? t('panel.planetOrder', { n: body.index + 1 });
}

// getSimDays() = hari simulasi sekarang (main.js)
export function createInfoPanel({ onBack, onPrev, onNext, onSwipeClose, getSimDays = () => 0 }) {
  const panel = document.getElementById('info-panel');
  const title = document.getElementById('info-title');
  const subtitle = document.getElementById('info-subtitle');
  const stats = document.getElementById('info-stats');
  const fact = document.getElementById('info-fact');
  const figures = document.getElementById('info-figures');
  const moreButton = document.getElementById('info-more');
  let expanded = false;
  const prevButton = document.getElementById('info-prev');
  const nextButton = document.getElementById('info-next');

  let open = false;
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
  // Arah masuk keluar panel beda antara desktop (geser dari kanan) dan mobile (naik dari bawah)
  // Dengan prefers-reduced-motion panel cuma memudar, gak meluncur (utils/motion.js)
  const hiddenPose = () => (isMobile() ? { x: 0, yPercent: shift(100) } : { x: shift(48), yPercent: 0 });

  // Swipe turun buat nutup bottom sheet (cuma di layout HP).
  // Area tarik cuma pegangan dan judul, bukan seluruh panel, biar isi panel yang panjang
  // tetap bisa di-scroll normal pakai jari
  let drag = null;

  panel.addEventListener('pointerdown', (event) => {
    if (!open || !isMobile() || !event.target.closest('.sheet-handle, .info-header')) return;
    drag = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
    panel.setPointerCapture(event.pointerId);
    gsap.killTweensOf(panel, 'y');
  });

  panel.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dt = Math.max(1, event.timeStamp - drag.lastTime);
    drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    // Ke atas ditahan (cuma bisa ditarik turun), dikasih efek karet sedikit
    const offset = event.clientY - drag.startY;
    gsap.set(panel, { y: offset > 0 ? offset : offset * 0.15 });
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const offset = event.clientY - drag.startY;
    const { velocity } = drag;
    drag = null;
    if (offset > SWIPE_CLOSE_DISTANCE || velocity > SWIPE_CLOSE_VELOCITY) onSwipeClose?.();
    else gsap.to(panel, { y: 0, duration: motion(0.35), ease: 'power3.out' });
  }

  panel.addEventListener('pointerup', endDrag);
  panel.addEventListener('pointercancel', endDrag);

  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') onBack?.();
    else if (action === 'prev') onPrev?.();
    else if (action === 'next') onNext?.();
  });

  // Panah digambar (SVG), bukan karakter, biar ketebalannya sama dengan ikon toolbar
  const ARROW = {
    prev: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>',
    next: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>'
  };

  function setNavButton(button, body, direction) {
    const word = t(direction === 'prev' ? 'panel.previous' : 'panel.next');
    const name = document.createElement('span');
    name.textContent = body.name;
    button.innerHTML = ARROW[direction];
    if (direction === 'prev') button.append(name);
    else button.prepend(name);
    button.setAttribute('aria-label', `${word}: ${body.name}`);
    button.title = t('panel.navTitle', { word, name: body.name, side: t(direction === 'prev' ? 'panel.left' : 'panel.right') });
  }

  // Isi pakai textContent (bukan innerHTML) biar aman walaupun datanya nanti datang dari luar
  function fill(body, { prev, next }) {
    const simDays = getSimDays();
    title.textContent = body.name;
    // Nama panjang (Awan Magellan Besar, Large Magellanic Cloud) diperkecil biar gak pecah jadi tiga baris
    title.classList.toggle('is-long', body.name.length > 12);
    subtitle.textContent = getSubtitle(body);
    fact.textContent = body.data.info?.fakta ?? '';
    // Warna aksen benda (pendar panel, keterangan, gambar), lihat ui/bodyFigure.js
    panel.style.setProperty('--body-color', bodyColor(body));
    const parent = body.parentId ? planetData.find((p) => p.id === body.parentId) : null;
    const drawing = bodyFigures(body, simDays, { parent });
    figures.hidden = !drawing;
    figures.innerHTML = drawing ?? '';

    stats.replaceChildren(
      ...getStats(body, simDays).map(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'info-row';
        row.dataset.animate = '';
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = String(value);
        row.append(dt, dd);
        return row;
      })
    );

    setNavButton(prevButton, prev, 'prev');
    setNavButton(nextButton, next, 'next');

    // Di HP baris data setelah KEY_ROWS disembunyikan (CSS .is-extra) sampai tombol Data lengkap ditekan.
    // Tiap ganti benda kembali ringkas
    const rows = stats.children;
    for (let i = 0; i < rows.length; i++) rows[i].classList.toggle('is-extra', i >= KEY_ROWS);
    moreButton.hidden = rows.length <= KEY_ROWS;
    setExpanded(false);
  }

  function setExpanded(value) {
    expanded = value;
    panel.classList.toggle('is-expanded', value);
    moreButton.setAttribute('aria-expanded', String(value));
    moreButton.textContent = t(value ? 'panel.less' : 'panel.more');
  }

  moreButton.addEventListener('click', () => setExpanded(!expanded));

  const animatedItems = () => panel.querySelectorAll('[data-animate]');

  function staggerIn() {
    gsap.fromTo(
      animatedItems(),
      { opacity: 0, y: shift(10) },
      { opacity: 1, y: 0, duration: motion(0.5), ease: 'power3.out', stagger: motion(0.04), overwrite: true }
    );
  }

  function show(body, neighbors) {
    gsap.killTweensOf(panel);

    if (!open) {
      open = true;
      fill(body, neighbors);
      panel.hidden = false;
      gsap.fromTo(
        panel,
        { opacity: 0, y: 0, ...hiddenPose() },
        { opacity: 1, x: 0, y: 0, yPercent: 0, duration: motion(0.7), ease: 'power3.out' }
      );
      staggerIn();
      return;
    }

    // Panel sudah kebuka (pindah planet): cukup isinya yang ganti, panelnya diam
    gsap.to(panel, { opacity: 1, x: 0, y: 0, yPercent: 0, duration: motion(0.3) });
    gsap.to(animatedItems(), {
      opacity: 0,
      y: shift(-6),
      duration: motion(0.15),
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => {
        fill(body, neighbors);
        staggerIn();
      }
    });
  }

  function hide() {
    if (!open) return;
    open = false;
    gsap.killTweensOf(animatedItems());
    gsap.to(panel, {
      opacity: 0,
      ...hiddenPose(),
      duration: motion(0.45),
      ease: 'power3.inOut',
      onComplete: () => {
        panel.hidden = true;
      }
    });
  }

  return {
    show,
    hide,
    // Seberapa jauh framing kamera perlu digeser biar benda yang difokus gak ketutup panel.
    // HP: naik ke atas bottom sheet. Desktop: geser ke kiri setengah lebar panel (plus jarak tepinya),
    // jadi benda ada di tengah area yang masih kelihatan. Kerasa banget di laptop layar sempit
    get viewShift() {
      if (!open) return { x: 0, y: 0 };
      if (isMobile()) return { x: 0, y: SHEET_VIEW_SHIFT };
      // offsetLeft (bukan getBoundingClientRect) karena gak kena transform animasi slide masuk.
      // Bagian kiri panel cuma gradasi gelap yang masih tembus, gak dihitung tertutup
      const covered = window.innerWidth - panel.offsetLeft - PANEL_FADE;
      return { x: covered / 2 / window.innerWidth, y: 0 };
    },
    get isOpen() {
      return open;
    }
  };
}
