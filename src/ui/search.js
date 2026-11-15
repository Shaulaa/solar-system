// Kotak pencarian benda langit (tekan / atau Ctrl+K)
//
// Pola combobox ARIA: fokus keyboard tetap di input, hasil yang lagi dipilih ditandai
// lewat aria-activedescendant + aria-selected. Panah atas bawah pindah pilihan, Enter terbang.
// Pencarian gak peka huruf besar kecil dan aksen, dan ikut nyocokin id + aliases
// (jadi "earth" ketemu Bumi, "phobos" ketemu Fobos, "milky way" ketemu Bima Sakti)
//
// Isinya bukan cuma benda tata surya: main.js ngasih daftar gabungan (benda tata surya, galaksi,
// bintang tetangga). Tiap item minimal punya id, name, kind, data (aliases, subtitle), dan boleh
// punya visible = false (easter egg Pluto). Hasil yang dipilih dioper utuh ke onSelect

const MAX_RESULTS = 8;

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const distanceFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function describe(item) {
  if (item.kind === 'nearby-star') return `Bintang tetangga · ${distanceFormat.format(item.data.distanceLy)} tahun cahaya`;
  if (item.data.subtitle) return item.data.subtitle;
  if (item.kind === 'planet') return `Planet ke ${item.index + 1} dari Matahari`;
  return '';
}

export function createSearch({ items, onSelect, onSecret }) {
  const root = document.getElementById('search');
  const box = root.querySelector('.search-box');
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');

  let open = false;
  let results = [];
  let active = 0;
  let returnFocus = null;

  function keywords(entry) {
    return [entry.name, entry.id, ...(entry.data.aliases ?? [])].map(normalize);
  }

  // Skor sederhana: cocok di awal kata lebih tinggi dari cocok di tengah
  function score(entry, query) {
    if (!query) return 1;
    let best = 0;
    for (const word of keywords(entry)) {
      if (word.startsWith(query)) best = Math.max(best, 3);
      else if (word.includes(query)) best = Math.max(best, 1);
    }
    return best;
  }

  function search(rawQuery) {
    const query = normalize(rawQuery);
    // Easter egg: ketik kata rahasia (misal "pluto") buat munculin benda tersembunyi
    if (query) onSecret?.(query);

    results = items
      .filter((entry) => entry.visible !== false)
      .map((entry) => ({ entry, score: score(entry, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.entry);

    active = 0;
    render();
  }

  function render() {
    list.replaceChildren(
      ...results.map((entry, i) => {
        const item = document.createElement('li');
        item.id = `search-option-${entry.id}`;
        item.className = 'search-option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(i === active));
        item.dataset.id = entry.id;

        const name = document.createElement('span');
        name.className = 'search-name';
        name.textContent = entry.name;
        const meta = document.createElement('span');
        meta.className = 'search-meta';
        meta.textContent = describe(entry);

        item.append(name, meta);
        return item;
      })
    );

    if (results.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'search-empty';
      empty.textContent = 'Gak ketemu. Coba nama planet, bulan, atau bintang lain';
      list.append(empty);
      input.removeAttribute('aria-activedescendant');
    } else {
      input.setAttribute('aria-activedescendant', `search-option-${results[active].id}`);
      list.children[active].scrollIntoView({ block: 'nearest' });
    }
  }

  function move(step) {
    if (results.length === 0) return;
    active = (active + step + results.length) % results.length;
    render();
  }

  function choose(item) {
    if (!item) return;
    close();
    onSelect?.(item);
  }

  function show() {
    if (open) return;
    open = true;
    returnFocus = document.activeElement;
    root.hidden = false;
    input.value = '';
    search('');
    input.focus();
  }

  function close() {
    if (!open) return;
    open = false;
    // Blur dulu secara eksplisit. Input yang disembunyikan bisa tetap pegang fokus,
    // akibatnya tombol berikutnya (misal "/") malah masuk ke input yang gak kelihatan
    input.blur();
    root.hidden = true;
    // Balikin fokus ke elemen sebelumnya (misal tombol cari di toolbar) biar keyboard user gak nyasar
    if (
      returnFocus instanceof HTMLElement &&
      returnFocus !== document.body &&
      !root.contains(returnFocus) &&
      document.contains(returnFocus)
    ) {
      returnFocus.focus();
    }
  }

  input.addEventListener('input', () => search(input.value));

  input.addEventListener('keydown', (event) => {
    // Semua tombol di sini punya input, jangan sampai bocor ke shortcut global
    event.stopPropagation();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      // Kotak ini modal, fokus gak boleh lompat ke elemen di belakangnya
      event.preventDefault();
    }
  });

  list.addEventListener('click', (event) => {
    const id = event.target.closest('[data-id]')?.dataset.id;
    choose(results.find((entry) => entry.id === id));
  });

  // Klik di luar kotak = tutup
  root.addEventListener('pointerdown', (event) => {
    if (!box.contains(event.target)) close();
  });

  return {
    open: show,
    close,
    get isOpen() {
      return open;
    }
  };
}
