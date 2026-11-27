// Dialog Lompat ke tanggal (klik tanggal di toolbar, atau tekan D)
//
// Isinya input tanggal bawaan browser yang kelihatan, bukan cuma popup kalender yang ditempel ke input
// tersembunyi. Tanggal bisa diketik, dipilih dari kalender browser, atau di HP lewat pemilih tanggal
// sistem, dan cara mana pun yang dipakai hasilnya sama. Tanggal baru dipakai waktu Lompat ditekan
// (atau Enter): event change input tanggal juga terpicu di tengah ngetik tahun, jadi kalau langsung
// dipakai simulasinya bisa loncat ke tahun 0002 dulu.
// Pakai <dialog> seperti dialog Tentang dan Peristiwa: fokus terkunci di dalam dan Esc langsung nutup
//
//   getDate()        tanggal simulasi sekarang (Date)
//   onJump(value)    tanggal yang dipilih, { year, month (1 sampai 12), date }
//   onToday()        tombol Hari ini
//   onOpen()         dipanggil sebelum dialog tampil (main.js menahan waktu)
//   onClose(picked)  setelah dialog tertutup, picked = true kalau tadi lompat ke tanggal

import { DATE_RANGE, isoDate, parseIsoDate } from '../utils/time.js';
import { t } from '../i18n/index.js';
import { closeOnBackdrop } from './dialog.js';

export function createDateDialog({ getDate, onJump, onToday, onOpen, onClose }) {
  const dialog = document.getElementById('date-dialog');
  const form = document.getElementById('date-form');
  const input = document.getElementById('date-input');
  const hint = document.getElementById('date-hint');
  let picked = false;

  input.min = DATE_RANGE.min;
  input.max = DATE_RANGE.max;

  function setInvalid(invalid) {
    input.setAttribute('aria-invalid', String(invalid));
    hint.textContent = t(invalid ? 'date.invalid' : 'date.hint');
    hint.classList.toggle('is-error', invalid);
  }

  function choose(action) {
    picked = true;
    dialog.close();
    action();
  }

  // Validasi sendiri (form-nya novalidate): gelembung validasi browser bahasanya ikut browser,
  // bukan bahasa antarmuka, dan gak bisa dibaca dari luar input
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = parseIsoDate(input.value);
    if (!value) {
      setInvalid(true);
      input.focus();
      return;
    }
    choose(() => onJump(value));
  });

  input.addEventListener('input', () => setInvalid(false));
  dialog.querySelector('[data-action="date-today"]').addEventListener('click', () => choose(onToday));
  dialog.querySelector('[data-action="close-date"]').addEventListener('click', () => dialog.close());
  closeOnBackdrop(dialog);
  // Event close datang setelah semua cara nutup: tombol, Esc, backdrop, atau setelah memilih
  dialog.addEventListener('close', () => onClose?.(picked));

  return {
    get open() {
      return dialog.open;
    },
    show() {
      if (dialog.open) return;
      picked = false;
      onOpen?.();
      input.value = isoDate(getDate());
      setInvalid(false);
      dialog.showModal();
      // showModal memfokuskan elemen pertama (tombol tutup), padahal yang mau diisi tanggalnya
      input.focus();
    }
  };
}
