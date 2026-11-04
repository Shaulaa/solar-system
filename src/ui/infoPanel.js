import gsap from 'gsap';

// Panel info benda langit
// Desktop muncul dari kanan, mobile (lebar < 768px) jadi bottom sheet dari bawah.
// Semua isi diambil dari data/planets.js. Angka mentah (AU, hari, derajat) diformat di sini

const MOBILE_QUERY = '(max-width: 767px)';
// Kira kira seberapa jauh framing kamera digeser ke atas waktu bottom sheet kebuka,
// biar planet yang difokus pas di area yang gak ketutup sheet (sheet tingginya maks 55vh)
const SHEET_VIEW_SHIFT = 0.22;
const KM_PER_AU_MILLION = 149.6;
const DAYS_PER_YEAR = 365.25;

const number1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const number2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

// Di bawah 2 tahun lebih kebayang kalau ditulis dalam hari
function formatYear(days) {
  return days < 730
    ? `${number2.format(days)} hari`
    : `${number2.format(days / DAYS_PER_YEAR)} tahun Bumi`;
}

// Rotasi di bawah 2 hari ditulis dalam jam. Nilai negatif = rotasi berlawanan arah (retrograde)
function formatDay(days) {
  const abs = Math.abs(days);
  const text = abs < 2 ? `${number1.format(abs * 24)} jam` : `${number1.format(abs)} hari`;
  return days < 0 ? `${text}, berlawanan arah` : text;
}

function formatDistance(au) {
  return `${number2.format(au)} AU · ${number1.format(au * KM_PER_AU_MILLION)} juta km`;
}

// Baris statistik per jenis benda. Baris dengan nilai kosong otomatis dilewati
function getStats(body) {
  const { data, kind } = body;
  const info = data.info ?? {};
  const isPlanet = kind === 'planet';

  return [
    ['Diameter', info.diameter],
    isPlanet && ['Jarak dari Matahari', formatDistance(data.distance)],
    kind === 'moon' && ['Jarak orbit', info.jarak],
    isPlanet && ['Lama setahun', formatYear(data.orbitPeriod)],
    kind === 'moon' && ['Lama mengorbit', formatYear(data.orbitPeriod)],
    data.rotationPeriod != null && [
      isPlanet ? 'Lama sehari' : 'Lama rotasi',
      formatDay(data.rotationPeriod)
    ],
    ['Suhu', info.suhu],
    isPlanet && ['Jumlah bulan', info.bulan],
    data.tilt != null && ['Kemiringan sumbu', `${number2.format(data.tilt)}°`]
  ].filter((row) => row && row[1] != null && row[1] !== '');
}

function getSubtitle(body) {
  return body.data.subtitle ?? `Planet ke ${body.index + 1} dari Matahari`;
}

export function createInfoPanel({ onBack, onPrev, onNext }) {
  const panel = document.getElementById('info-panel');
  const title = document.getElementById('info-title');
  const subtitle = document.getElementById('info-subtitle');
  const stats = document.getElementById('info-stats');
  const fact = document.getElementById('info-fact');
  const prevButton = document.getElementById('info-prev');
  const nextButton = document.getElementById('info-next');

  let open = false;
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
  // Arah masuk keluar panel beda antara desktop (geser dari kanan) dan mobile (naik dari bawah)
  const hiddenPose = () => (isMobile() ? { x: 0, yPercent: 100 } : { x: 48, yPercent: 0 });

  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') onBack?.();
    else if (action === 'prev') onPrev?.();
    else if (action === 'next') onNext?.();
  });

  function setNavButton(button, body, direction) {
    const arrow = direction === 'prev' ? '←' : '→';
    const word = direction === 'prev' ? 'Sebelumnya' : 'Berikutnya';
    button.textContent = direction === 'prev' ? `${arrow} ${body.name}` : `${body.name} ${arrow}`;
    button.setAttribute('aria-label', `${word}: ${body.name}`);
    button.title = `${word}: ${body.name} (panah ${direction === 'prev' ? 'kiri' : 'kanan'})`;
  }

  // Isi pakai textContent (bukan innerHTML) biar aman walaupun datanya nanti datang dari luar
  function fill(body, { prev, next }) {
    title.textContent = body.name;
    subtitle.textContent = getSubtitle(body);
    fact.textContent = body.data.info?.fakta ?? '';

    stats.replaceChildren(
      ...getStats(body).map(([label, value]) => {
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
  }

  const animatedItems = () => panel.querySelectorAll('[data-animate]');

  function staggerIn() {
    gsap.fromTo(
      animatedItems(),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04, overwrite: true }
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
        { opacity: 0, ...hiddenPose() },
        { opacity: 1, x: 0, yPercent: 0, duration: 0.7, ease: 'power3.out' }
      );
      staggerIn();
      return;
    }

    // Panel sudah kebuka (pindah planet): cukup isinya yang ganti, panelnya diam
    gsap.to(panel, { opacity: 1, x: 0, yPercent: 0, duration: 0.3 });
    gsap.to(animatedItems(), {
      opacity: 0,
      y: -6,
      duration: 0.15,
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
      duration: 0.45,
      ease: 'power3.inOut',
      onComplete: () => {
        panel.hidden = true;
      }
    });
  }

  return {
    show,
    hide,
    // Berapa framing kamera perlu digeser biar gak ketutup panel. Desktop 0 karena panel di samping
    get viewShift() {
      return open && isMobile() ? SHEET_VIEW_SHIFT : 0;
    },
    get isOpen() {
      return open;
    }
  };
}
