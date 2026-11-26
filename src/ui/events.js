// Dialog kalender peristiwa (tombol di sebelah tanggal, atau tekan E)
//
// Daftarnya dihitung ulang tiap kali dibuka, mulai dari tanggal simulasi saat itu (data/events.js).
// Memilih satu peristiwa dioper ke onSelect(event), main.js yang lompat waktu dan fokus kameranya.
// Pakai <dialog> bawaan browser seperti dialog Tentang: fokus terkunci di dalam dan Esc langsung nutup

import { upcomingEvents } from '../data/events.js';
import { eclipseRegion } from '../data/eclipses.js';
import { t, LOCALE } from '../i18n/index.js';
import { bodyColor } from './bodyFigure.js';

const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const dayMonthUtc = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const fullDateUtc = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const kmFormat = new Intl.NumberFormat(LOCALE);
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

const MS_PER_DAY = 86_400_000;

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
export function createEventsDialog({ getNow, getBody, onSelect }) {
  const dialog = document.getElementById('events');
  const lead = document.getElementById('events-lead');
  const list = document.getElementById('events-list');
  let events = [];

  dialog.querySelector('[data-action="close-events"]').addEventListener('click', () => dialog.close());

  // Item dicek duluan: Enter / spasi di tombol juga memicu click, tapi koordinatnya (0, 0) dan
  // bakal dikira klik di luar kotak. Klik backdrop selalu ber-target elemen dialog itu sendiri
  dialog.addEventListener('click', (event) => {
    const index = event.target.closest('[data-index]')?.dataset.index;
    if (index !== undefined) {
      const chosen = events[Number(index)];
      dialog.close();
      onSelect?.(chosen);
      return;
    }
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });

  function render(now) {
    lead.textContent = t('events.lead', { date: fullDate.format(now) });
    events = upcomingEvents(now.getTime());

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
      when.textContent = (event.dateOnly ? dayMonthUtc : dayMonth).format(date);

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
      button.append(when, text, soon);
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
      render(getNow());
      dialog.showModal();
      list.scrollTop = 0;
    }
  };
}
