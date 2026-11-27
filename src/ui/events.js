// Dialog kalender peristiwa (tombol di sebelah tanggal, atau tekan E)
//
// Daftarnya dihitung ulang tiap kali dibuka, mulai dari tanggal simulasi saat itu (data/events.js).
// Selama dialog terbuka main.js menahan waktu (onOpen / onClose), kalau nggak simulasi terus jalan di
// belakangnya dan daftar yang lagi dibaca langsung basi (di kecepatan tertinggi setahun per detik).
// Memilih satu peristiwa dioper ke onSelect(event), main.js yang lompat waktu dan fokus kameranya.
// Pakai <dialog> bawaan browser seperti dialog Tentang: fokus terkunci di dalam dan Esc langsung nutup

import { upcomingEvents } from '../data/events.js';
import { eclipseRegion, ECLIPSE_RANGE } from '../data/eclipses.js';
import { t, LOCALE } from '../i18n/index.js';
import { bodyColor } from './bodyFigure.js';
import { closeOnBackdrop } from './dialog.js';

// Tanggal dipecah jadi angka hari dan nama bulan pendek (blok tanggal ala kalender)
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const dayMonthUtc = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
function dateParts(formatter, date) {
  const parts = formatter.formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return { day: pick('day'), month: pick('month').replace(/\.$/, '') };
}

// Tanda kecil per jenis peristiwa, digambar dari bentuk peristiwanya sendiri (viewBox 20 x 20).
// Warnanya dari CSS: currentColor = warna benda (--body-color), gerhana pakai warna tetap
//   oposisi          planet bulat penuh terang, memang begitu kelihatannya waktu oposisi
//   gerhana Matahari total: piringan Bulan gelap dengan korona dua lapis. Cincin: Matahari menyisakan cincin tebal.
//                    Sebagian: Bulan menggigit sebagian Matahari
//   gerhana Bulan    total: Bulan merah tembaga. Sebagian: Bulan sebagian masuk bayangan Bumi
//   perihelion       inti komet dengan ekor
//   lewat dekat      asteroid kecil di samping Bumi
const MARKS = {
  opposition: '<circle class="mark-body" cx="10" cy="10" r="5" />',
  'solarEclipse-total':
    '<circle class="mark-corona is-outer" cx="10" cy="10" r="8.6" /><circle class="mark-corona" cx="10" cy="10" r="6" /><circle class="mark-shadow" cx="10" cy="10" r="4.8" />',
  'solarEclipse-annular': '<circle class="mark-sun" cx="10" cy="10" r="6.8" /><circle class="mark-shadow" cx="10" cy="10" r="4.4" />',
  'solarEclipse-partial': '<circle class="mark-sun" cx="10" cy="10" r="6" /><circle class="mark-shadow" cx="13.4" cy="7.4" r="5.2" />',
  'lunarEclipse-total': '<circle class="mark-blood" cx="10" cy="10" r="5.6" />',
  'lunarEclipse-partial': '<circle class="mark-body" cx="10" cy="10" r="5.6" /><circle class="mark-umbra" cx="5" cy="12.6" r="5.6" />',
  perihelion:
    '<path class="mark-tail" d="M11.6 8.4 3.6 16.4" /><path class="mark-tail is-faint" d="M13.4 9.6 7.2 16.4" /><circle class="mark-body" cx="13.2" cy="6.8" r="2.7" />',
  flyby: '<circle class="mark-earth" cx="12.8" cy="11.6" r="4.6" /><circle class="mark-body" cx="4.6" cy="5.8" r="2.3" />'
};

function markFor(event) {
  const key = event.eclipse ? `${event.type}-${event.eclipse.type}` : event.type;
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">${MARKS[key] ?? MARKS.opposition}</svg>`;
}
const fullDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const fullDateUtc = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const kmFormat = new Intl.NumberFormat(LOCALE);
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

const MS_PER_DAY = 86_400_000;
// Akhir daftar gerhana (data/eclipses.js). Daftar yang lewat dari sini dikasih catatan
const ECLIPSES_UNTIL = Date.parse(`${ECLIPSE_RANGE.to}T23:59:59Z`);

const capitalize = (text) => text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1);

// "besok", "dalam 3 minggu", "dalam 5 bulan", "dalam 2 tahun"
function formatRelative(ms) {
  const days = ms / MS_PER_DAY;
  if (days < 14) return relative.format(Math.max(1, Math.round(days)), 'day');
  if (days < 60) return relative.format(Math.round(days / 7), 'week');
  if (days < 365 * 1.5) return relative.format(Math.round(days / 30.44), 'month');
  return relative.format(Math.round(days / 365.25), 'year');
}

function describe(event, body) {
  const name = body?.name ?? '';
  switch (event.type) {
    case 'opposition':
      return { title: t('events.opposition', { name }), note: t('events.oppositionNote') };
    case 'solarEclipse': {
      const where = eclipseRegion(event.eclipse);
      return {
        title: capitalize(t('events.solarEclipse', { kind: t(`eclipse.${event.eclipse.type}`) })),
        note: where ? t('events.totalityPath', { where }) : t('events.solarEclipseNote')
      };
    }
    case 'lunarEclipse':
      return {
        title: capitalize(t('events.lunarEclipse', { kind: t(`eclipse.${event.eclipse.type}`) })),
        note: t('events.lunarEclipseNote')
      };
    case 'perihelion':
      return { title: t('events.perihelion', { name }), note: t('events.perihelionNote') };
    case 'flyby':
      return { title: t('events.flyby', { name }), note: t('events.flybyNote', { km: kmFormat.format(event.km) }) };
    default:
      return { title: name, note: '' };
  }
}

//   getNow()      saat simulasi sekarang (Date)
//   getBody(id)   benda dari registry (nama terjemahan dan warna aksen), boleh null
//   onSelect      dipanggil dengan peristiwa yang dipilih, setelah dialog ditutup
//   onOpen        sebelum dialog tampil
//   onClose       setelah dialog tertutup, dengan true kalau tadi ada peristiwa yang dipilih
export function createEventsDialog({ getNow, getBody, onSelect, onOpen, onClose }) {
  const dialog = document.getElementById('events');
  const lead = document.getElementById('events-lead');
  const list = document.getElementById('events-list');
  const limit = document.getElementById('events-limit');
  let events = [];
  let picked = false;

  dialog.querySelector('[data-action="close-events"]').addEventListener('click', () => dialog.close());

  dialog.addEventListener('click', (event) => {
    const index = event.target.closest('[data-index]')?.dataset.index;
    if (index === undefined) return;
    const chosen = events[Number(index)];
    picked = true;
    dialog.close();
    onSelect?.(chosen);
  });
  closeOnBackdrop(dialog);
  dialog.addEventListener('close', () => onClose?.(picked));

  function render(now) {
    lead.textContent = t('events.lead', { date: fullDate.format(now) });
    events = upcomingEvents(now.getTime());

    // Gerhana cuma tercatat sampai ECLIPSE_RANGE.to, oposisi dan komet dihitung tanpa batas.
    // Daftar yang lewat dari situ (atau kosong karena tanggalnya sudah jauh) dikasih tahu biar
    // gak dikira memang gak ada gerhana
    const lastTime = events.length ? events[events.length - 1].time : now.getTime();
    limit.hidden = lastTime <= ECLIPSES_UNTIL;
    if (!limit.hidden) limit.textContent = t('events.eclipseLimit', { year: ECLIPSE_RANGE.to.slice(0, 4) });

    if (events.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'events-empty';
      empty.textContent = t('events.empty');
      list.replaceChildren(empty);
      return;
    }

    let year = null;
    const items = [];
    events.forEach((event, index) => {
      const date = new Date(event.time);
      const eventYear = event.dateOnly ? date.getUTCFullYear() : date.getFullYear();
      // Pemisah tahun, cuma kalau tahunnya ganti
      if (eventYear !== year) {
        year = eventYear;
        const heading = document.createElement('li');
        heading.className = 'events-year';
        heading.setAttribute('aria-hidden', 'true');
        heading.textContent = String(eventYear);
        items.push(heading);
      }

      const body = getBody(event.bodyId);
      const { title, note } = describe(event, body);

      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'events-item';
      button.dataset.index = String(index);
      if (body) button.style.setProperty('--body-color', bodyColor(body));

      const when = document.createElement('time');
      when.className = 'events-date';
      when.dateTime = date.toISOString();
      const { day, month } = dateParts(event.dateOnly ? dayMonthUtc : dayMonth, date);
      const dayEl = document.createElement('span');
      dayEl.className = 'events-day';
      dayEl.textContent = day;
      const monthEl = document.createElement('span');
      monthEl.className = 'events-month';
      monthEl.textContent = month;
      when.append(dayEl, monthEl);

      // SVG-nya dirakit dari MARKS (teks tetap di kode ini), gak ada data luar yang masuk innerHTML
      const mark = document.createElement('span');
      mark.className = 'events-mark';
      mark.innerHTML = markFor(event);

      const text = document.createElement('span');
      text.className = 'events-text';
      const titleEl = document.createElement('span');
      titleEl.className = 'events-title';
      titleEl.textContent = title;
      const noteEl = document.createElement('span');
      noteEl.className = 'events-note';
      noteEl.textContent = note;
      text.append(titleEl, noteEl);

      const soon = document.createElement('span');
      soon.className = 'events-relative';
      soon.textContent = formatRelative(event.time - now.getTime());

      // Tahun dibacakan pembaca layar lewat label tombol, karena pemisah tahunnya aria-hidden
      button.setAttribute('aria-label', `${title}, ${(event.dateOnly ? fullDateUtc : fullDate).format(date)}. ${note}`);
      button.append(when, mark, text, soon);
      item.append(button);
      items.push(item);
    });
    list.replaceChildren(...items);
  }

  return {
    get open() {
      return dialog.open;
    },
    show() {
      if (dialog.open) return;
      picked = false;
      onOpen?.();
      render(getNow());
      dialog.showModal();
      list.scrollTop = 0;
    }
  };
}
