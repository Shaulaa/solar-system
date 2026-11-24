// Toolbar mengambang di bawah tengah: play / pause, kecepatan waktu, tanggal simulasi,
// dan toggle tampilan. Modul ini cuma ngurus tampilan dan event tombol.
// State aslinya (waktu, orbit, label, skala) tetap dipegang main.js, jadi tombol toolbar
// dan shortcut keyboard selalu lewat jalur yang sama dan gak mungkin beda state

import { simDate } from '../utils/time.js';
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
  onDateChange,
  onSpeedChange,
  onToggleOrbits,
  onToggleLabels,
  onToggleScale,
  onToggleTour,
  onSearch,
  onAbout
}) {
  const element = document.getElementById('toolbar');
  const playButton = element.querySelector('[data-action="play"]');
  const orbitsButton = element.querySelector('[data-action="orbits"]');
  const labelsButton = element.querySelector('[data-action="labels"]');
  const scaleButton = element.querySelector('[data-action="scale"]');
  const tourButton = element.querySelector('[data-action="tour"]');
  const speedInput = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');
  const dateElement = document.getElementById('sim-date');
  const dateButton = element.querySelector('[data-action="date"]');
  const dateInput = document.getElementById('date-input');
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
    { control: dateButton, tooltipHost: dateButton }
  ].map((item) => ({ ...item, tooltip: item.tooltipHost.dataset.tooltip }));
  let solarControlsEnabled = true;

  // Tanggal simulasi mulai dari hari ini, lalu maju sesuai simDays (lihat utils/time.js)
  let shownDay = null;

  element.addEventListener('click', (event) => {
    const action = event.target.closest('button[data-action]')?.dataset.action;
    if (action === 'play') onTogglePlay?.();
    else if (action === 'reverse') onToggleReverse?.();
    else if (action === 'date') openDatePicker();
    else if (action === 'orbits') onToggleOrbits?.();
    else if (action === 'labels') onToggleLabels?.();
    else if (action === 'scale') onToggleScale?.();
    else if (action === 'tour') onToggleTour?.();
    else if (action === 'search') onSearch?.();
    else if (action === 'about') onAbout?.();
  });

  speedInput.addEventListener('input', () => onSpeedChange?.(Number(speedInput.value)));

  // Pemilih tanggal bawaan browser. Nilainya diisi tanggal simulasi sekarang dulu, jadi kalendernya
  // kebuka di bulan yang lagi tampil. Browser tanpa showPicker (lama) dapat fokus ke inputnya
  function openDatePicker() {
    if (dateButton.disabled) return;
    dateInput.value = dateElement.dateTime;
    try {
      dateInput.showPicker();
    } catch {
      dateInput.focus();
    }
  }

  dateInput.addEventListener('change', () => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.value);
    if (match) onDateChange?.(Number(match[1]), Number(match[2]), Number(match[3]));
  });

  function setPressed(button, pressed) {
    button.setAttribute('aria-pressed', String(pressed));
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
      setPressed(reverseButton, value);
      reverseButton.setAttribute('aria-label', t(value ? 'toolbar.forward' : 'toolbar.backward'));
      reverseButton.dataset.tooltip = t(value ? 'toolbar.forwardTip' : 'toolbar.backwardTip');
      solarOnly.find((item) => item.control === reverseButton).tooltip = reverseButton.dataset.tooltip;
      this.setSpeedIndex(speedIndex);
    },

    openDatePicker,

    setOrbitsVisible(visible) {
      setPressed(orbitsButton, visible);
    },

    setLabelsVisible(visible) {
      setPressed(labelsButton, visible);
    },

    setScaleMode(mode) {
      setPressed(scaleButton, mode === 'real');
    },

    setTourActive(active) {
      setPressed(tourButton, active);
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
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      dateElement.dateTime = `${date.getFullYear()}-${month}-${dayOfMonth}`;
    }
  };
}
