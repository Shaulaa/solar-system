// Toolbar mengambang di bawah tengah: play / pause, kecepatan waktu, tanggal simulasi,
// dan toggle tampilan. Modul ini cuma ngurus tampilan dan event tombol.
// State aslinya (waktu, orbit, label, skala) tetap dipegang main.js, jadi tombol toolbar
// dan shortcut keyboard selalu lewat jalur yang sama dan gak mungkin beda state

import { simDate, isoDate } from '../utils/time.js';
import { t, LOCALE } from '../i18n/index.js';

// Preset kecepatan, urut dari slider paling kiri
export const SPEED_PRESETS = [
  { days: 1, label: t('speed.day'), spoken: t('speed.daySpoken') },
  { days: 10, label: t('speed.tenDays'), spoken: t('speed.tenDaysSpoken') },
  { days: 30.44, label: t('speed.month'), spoken: t('speed.monthSpoken') },
  { days: 365.25, label: t('speed.year'), spoken: t('speed.yearSpoken') }
];

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function createToolbar({
  onTogglePlay,
  onToggleReverse,
  onOpenDate,
  onSpeedChange,
  onToggleOrbits,
  onToggleLabels,
  onToggleScale,
  onToggleTour,
  onSearch,
  onEvents,
  onAbout
}) {
  const element = document.getElementById('toolbar');
  const playButton = element.querySelector('[data-action="play"]');
  // Ikon toolbar (desktop). Di HP toggle yang sama ada lagi sebagai item menu "lainnya" (#tb-menu)
  const orbitsButton = element.querySelector('.tb-btn[data-action="orbits"]');
  const scaleButton = element.querySelector('.tb-btn[data-action="scale"]');
  const tourButton = element.querySelector('.tb-btn[data-action="tour"]');
  const moreButton = element.querySelector('[data-action="more"]');
  const menu = document.getElementById('tb-menu');
  const menuItem = (action) => menu.querySelector(`[data-action="${action}"]`);
  const speedInput = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');
  const dateElement = document.getElementById('sim-date');
  const dateButton = element.querySelector('[data-action="date"]');
  const eventsButton = element.querySelector('[data-action="events"]');
  const reverseButton = element.querySelector('[data-action="reverse"]');
  let reversed = false;
  let speedIndex = 0;

  // Kontrol yang cuma berarti di tata surya. Di skala galaksi dimatikan (PRD-GALAXY bagian 4),
  // tooltip-nya ditambah keterangan biar jelas kenapa gak bisa dipencet
  const speedGroup = element.querySelector('.tb-speed');
  const solarOnly = [
    { control: speedInput, tooltipHost: speedGroup },
    { control: orbitsButton, tooltipHost: orbitsButton },
    { control: scaleButton, tooltipHost: scaleButton },
    { control: reverseButton, tooltipHost: reverseButton },
    { control: dateButton, tooltipHost: dateButton },
    { control: eventsButton, tooltipHost: eventsButton }
  ].map((item) => ({ ...item, tooltip: item.tooltipHost.dataset.tooltip }));
  const solarOnlyMenuItems = [menuItem('orbits'), menuItem('scale')];
  let solarControlsEnabled = true;

  // Tanggal simulasi mulai dari hari ini, lalu maju sesuai simDays (lihat utils/time.js)
  let shownDay = null;

  // Menu "lainnya" (HP). Toggle garis orbit dan label sering dicoba bolak balik, jadi menunya tetap
  // terbuka. Pilihan lain (skala, tur, Tentang) mengubah tampilan besar besaran, menunya ditutup
  const KEEP_MENU_OPEN = new Set(['orbits', 'labels']);

  function setMenuOpen(open, { returnFocus = false } = {}) {
    if (open === !menu.hidden) return;
    menu.hidden = !open;
    moreButton.setAttribute('aria-expanded', String(open));
    // Dibuka: fokus ke item pertama (pengguna keyboard langsung bisa Tab di dalamnya).
    // Ditutup lewat Esc: fokus balik ke tombol lainnya, jangan hilang ke body
    if (open) menu.querySelector('button:not(:disabled)')?.focus();
    else if (returnFocus) moreButton.focus();
  }

  // Esc nutup menu duluan, sebelum shortcut Esc global (balik ke overview) sempat jalan.
  // Fase capture di document jalan sebelum listener keydown di window (app/keyboard.js)
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || menu.hidden) return;
      event.stopPropagation();
      setMenuOpen(false, { returnFocus: true });
    },
    true
  );

  // Sentuhan / klik di luar toolbar (canvas, panel) nutup menu
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!menu.hidden && !element.contains(event.target)) setMenuOpen(false);
    },
    true
  );

  element.addEventListener('click', (event) => {
    const action = event.target.closest('button[data-action]')?.dataset.action;
    if (action === 'more') {
      setMenuOpen(menu.hidden);
      return;
    }
    // Item menu yang dipencet ikut hilang bareng menunya, fokusnya dibalikin ke tombol lainnya
    if (action && !menu.hidden && !KEEP_MENU_OPEN.has(action)) {
      setMenuOpen(false, { returnFocus: menu.contains(event.target) });
    }
    if (action === 'play') onTogglePlay?.();
    else if (action === 'reverse') onToggleReverse?.();
    else if (action === 'date') onOpenDate?.();
    else if (action === 'events') onEvents?.();
    else if (action === 'orbits') onToggleOrbits?.();
    else if (action === 'labels') onToggleLabels?.();
    else if (action === 'scale') onToggleScale?.();
    else if (action === 'tour') onToggleTour?.();
    else if (action === 'search') onSearch?.();
    else if (action === 'about') onAbout?.();
  });

  speedInput.addEventListener('input', () => onSpeedChange?.(Number(speedInput.value)));

  // Status ditulis ke ikon toolbar dan item menu yang sama sekaligus, jadi dua duanya selalu sinkron
  function setPressed(action, pressed) {
    for (const button of element.querySelectorAll(`[data-action="${action}"]`)) {
      button.setAttribute('aria-pressed', String(pressed));
    }
  }

  return {
    element,

    setPaused(paused) {
      playButton.classList.toggle('is-paused', paused);
      playButton.setAttribute('aria-label', t(paused ? 'toolbar.resume' : 'toolbar.pause'));
      playButton.dataset.tooltip = t(paused ? 'toolbar.resumeTip' : 'toolbar.pauseTip');
    },

    setSpeedIndex(index) {
      speedIndex = index;
      const preset = SPEED_PRESETS[index];
      speedInput.value = String(index);
      // Waktu mundur ditandai minus di label kecepatan
      speedInput.setAttribute('aria-valuetext', reversed ? t('speed.backwardSpoken', { speed: preset.spoken }) : preset.spoken);
      speedLabel.textContent = reversed ? `−${preset.label}` : preset.label;
    },

    setReversed(value) {
      reversed = value;
      setPressed('reverse', value);
      reverseButton.setAttribute('aria-label', t(value ? 'toolbar.forward' : 'toolbar.backward'));
      reverseButton.dataset.tooltip = t(value ? 'toolbar.forwardTip' : 'toolbar.backwardTip');
      solarOnly.find((item) => item.control === reverseButton).tooltip = reverseButton.dataset.tooltip;
      this.setSpeedIndex(speedIndex);
    },

    setOrbitsVisible(visible) {
      setPressed('orbits', visible);
    },

    setLabelsVisible(visible) {
      setPressed('labels', visible);
    },

    setScaleMode(mode) {
      setPressed('scale', mode === 'real');
    },

    setTourActive(active) {
      setPressed('tour', active);
      tourButton.setAttribute('aria-label', t(active ? 'toolbar.tourStop' : 'toolbar.tour'));
      tourButton.dataset.tooltip = t(active ? 'toolbar.tourStopTip' : 'toolbar.tourTip');
    },

    setSolarControlsEnabled(enabled) {
      if (enabled === solarControlsEnabled) return;
      solarControlsEnabled = enabled;
      element.classList.toggle('is-zoomed-out', !enabled);
      for (const { control, tooltipHost, tooltip } of solarOnly) {
        control.disabled = !enabled;
        tooltipHost.dataset.tooltip = enabled ? tooltip : t('toolbar.solarOnly', { label: tooltip.replace(/ \(.*\)$/, '') });
      }
      for (const item of solarOnlyMenuItems) item.disabled = !enabled;
    },

    get solarControlsEnabled() {
      return solarControlsEnabled;
    },

    // Dipanggil tiap frame. Teks cuma diganti kalau harinya berubah
    setDays(simDays) {
      const day = Math.floor(simDays);
      if (day === shownDay) return;
      shownDay = day;
      const date = simDate(day);
      dateElement.textContent = dateFormat.format(date);
      dateElement.dateTime = isoDate(date);
    }
  };
}
