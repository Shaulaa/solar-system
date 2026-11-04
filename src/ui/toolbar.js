// Toolbar mengambang di bawah tengah: play / pause, kecepatan waktu, tanggal simulasi,
// dan toggle tampilan. Modul ini cuma ngurus tampilan dan event tombol.
// State aslinya (waktu, orbit, label, skala) tetap dipegang main.js, jadi tombol toolbar
// dan shortcut keyboard selalu lewat jalur yang sama dan gak mungkin beda state

// Preset kecepatan, urut dari slider paling kiri
export const SPEED_PRESETS = [
  { days: 1, label: '1 hari/dtk', spoken: '1 hari per detik' },
  { days: 10, label: '10 hari/dtk', spoken: '10 hari per detik' },
  { days: 30.44, label: '1 bulan/dtk', spoken: '1 bulan per detik' },
  { days: 365.25, label: '1 tahun/dtk', spoken: '1 tahun per detik' }
];

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function createToolbar({
  onTogglePlay,
  onSpeedChange,
  onToggleOrbits,
  onToggleLabels,
  onToggleScale
}) {
  const element = document.getElementById('toolbar');
  const playButton = element.querySelector('[data-action="play"]');
  const orbitsButton = element.querySelector('[data-action="orbits"]');
  const labelsButton = element.querySelector('[data-action="labels"]');
  const scaleButton = element.querySelector('[data-action="scale"]');
  const speedInput = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');
  const dateElement = document.getElementById('sim-date');

  // Tanggal simulasi mulai dari hari ini, lalu maju sesuai simDays.
  // Dihitung lewat new Date(tahun, bulan, tanggal + n), bukan tambah milidetik,
  // biar gak meleset sehari di negara yang pakai daylight saving time
  const today = new Date();
  let shownDay = null;

  element.addEventListener('click', (event) => {
    const action = event.target.closest('button[data-action]')?.dataset.action;
    if (action === 'play') onTogglePlay?.();
    else if (action === 'orbits') onToggleOrbits?.();
    else if (action === 'labels') onToggleLabels?.();
    else if (action === 'scale') onToggleScale?.();
  });

  speedInput.addEventListener('input', () => onSpeedChange?.(Number(speedInput.value)));

  function setPressed(button, pressed) {
    button.setAttribute('aria-pressed', String(pressed));
  }

  return {
    element,

    setPaused(paused) {
      playButton.classList.toggle('is-paused', paused);
      const label = paused ? 'Lanjutkan simulasi' : 'Jeda simulasi';
      playButton.setAttribute('aria-label', label);
      playButton.dataset.tooltip = `${paused ? 'Lanjutkan' : 'Jeda'} (Spasi)`;
    },

    setSpeedIndex(index) {
      const preset = SPEED_PRESETS[index];
      speedInput.value = String(index);
      speedInput.setAttribute('aria-valuetext', preset.spoken);
      speedLabel.textContent = preset.label;
    },

    setOrbitsVisible(visible) {
      setPressed(orbitsButton, visible);
    },

    setLabelsVisible(visible) {
      setPressed(labelsButton, visible);
    },

    setScaleMode(mode) {
      setPressed(scaleButton, mode === 'real');
    },

    // Dipanggil tiap frame. Teks cuma diganti kalau harinya berubah
    setDays(simDays) {
      const day = Math.floor(simDays);
      if (day === shownDay) return;
      shownDay = day;
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + day);
      dateElement.textContent = dateFormat.format(date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      dateElement.dateTime = `${date.getFullYear()}-${month}-${dayOfMonth}`;
    }
  };
}
