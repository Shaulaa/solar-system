// Kotak pencarian benda langit (tekan / atau Ctrl+K)
//
// Pola combobox ARIA: fokus keyboard tetap di input, hasil yang lagi dipilih ditandai
// lewat aria-activedescendant + aria-selected. Panah atas bawah pindah pilihan, Enter terbang.
// Pencarian gak peka huruf besar kecil dan aksen, dan ikut nyocokin id + aliases
// (jadi "earth" ketemu Bumi, "phobos" ketemu Fobos)

const MAX_RESULTS = 8;

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

function describe(body) {
  if (body.data.subtitle) return body.data.subtitle;
  if (body.kind === 'planet') return `Planet ke ${body.index + 1} dari Matahari`;
  return '';
}

export function createSearch({ bodies, onSelect, onSecret }) {
  const root = document.getElementById('search');
  const box = root.querySelector('.search-box');
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');

  let open = false;
  let results = [];
  let active = 0;
  let returnFocus = null;

  function keywords(body) {
    return [body.name, body.id, ...(body.data.aliases ?? [])].map(normalize);
  }

  // Skor sederhana: cocok di awal kata lebih tinggi dari cocok di tengah
  function score(body, query) {
    if (!query) return 1;
    let best = 0;
    for (const word of keywords(body)) {
      if (word.startsWith(query)) best = Math.max(best, 3);
      else if (word.includes(query)) best = Math.max(best, 1);
    }
    return best;
  }

  function search(rawQuery) {
    const query = normalize(rawQuery);
    // Easter egg: ketik kata rahasia (misal "pluto") buat munculin benda tersembunyi
    if (query) onSecret?.(query);

    results = bodies.list
      .filter((body) => body.visible)
      .map((body) => ({ body, score: score(body, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.body);

    active = 0;
    render();
  }

  function render() {
    list.replaceChildren(
      ...results.map((body, i) => {
        const item = document.createElement('li');
        item.id = `search-option-${body.id}`;
        item.className = 'search-option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(i === active));
        item.dataset.id = body.id;

        const name = document.createElement('span');
        name.className = 'search-name';
        name.textContent = body.name;
        const meta = document.createElement('span');
        meta.className = 'search-meta';
        meta.textContent = describe(body);

        item.append(name, meta);
        return item;
      })
    );

    if (results.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'search-empty';
      empty.textContent = 'Gak ketemu. Coba nama planet atau bulan lain';
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

  function choose(body) {
    if (!body) return;
    close();
    onSelect?.(body.id);
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
    choose(results.find((body) => body.id === id));
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
