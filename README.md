# Tata Surya Interaktif

Tata surya 3D yang bisa dijelajahi langsung di browser. Klik planet buat terbang ke sana, ikuti tur otomatis, atau ganti ke skala asli dan lihat betapa kecilnya planet dibanding jarak antar orbitnya.

Dibuat dengan Three.js, GSAP, dan Vite, tanpa framework UI.

![Demo: klik Saturnus, kamera terbang, panel info muncul](docs/demo.gif)

## Fitur

- **Visual sinematik.** Matahari dari shader plasma + bloom, Bumi 3 lapis (siang malam dengan lampu kota, relief, kilau matahari di laut, awan, atmosfer), cincin Saturnus dengan bayangan planet, sabuk asteroid 2.000 batu dalam 1 draw call, dan latar Bima Sakti
- **Posisi planet asli.** Orbit elips dan miring dari elemen orbit JPL, posisi tiap planet dihitung pakai persamaan Kepler sesuai tanggal simulasi. Jadi susunan planet di layar sama dengan langit hari ini
- **Kamera terbang.** Klik planet, Matahari, atau bulan, kamera terbang dan nempel ke benda yang terus bergerak tanpa getar, tapi tetap bisa diputar bebas
- **Panel info.** Diameter, jarak, lama setahun dan sehari, suhu, jumlah bulan, kemiringan sumbu, dan fakta unik. Semua dari satu file data
- **Tur otomatis.** Matahari sampai Neptunus dengan narasi singkat di tiap pemberhentian, berhenti sendiri kalau user ngambil alih kamera
- **Skala Nyata.** Transisi 2,5 detik dari skala "enak dilihat" ke perbandingan asli (1 AU = 400 unit) dan balik lagi
- **Kontrol waktu.** Pause, 4 preset kecepatan (1 hari sampai 1 tahun per detik), dan tanggal simulasi yang mulai dari hari ini
- **Pencarian.** Tekan `/` atau `Ctrl+K`, ketik nama planet atau bulan, Enter langsung terbang. Ada satu benda rahasia yang muncul kalau namanya diketik
- **9 bulan.** Bulan, Fobos, Deimos, dan 4 bulan Galilean Jupiter, semuanya bisa diklik
- **Nyaman di HP.** Bottom sheet yang bisa ditarik turun, toolbar ringkas, beban grafis dikurangi otomatis
- **Aksesibel.** Semua tombol punya label dan tooltip, bisa dipakai penuh pakai keyboard

## Tampilan

| | |
|---|---|
| ![Tampilan tata surya](docs/overview.jpg) | ![Bumi dengan panel info](docs/earth.jpg) |
| ![Saturnus dan cincinnya](docs/saturn.jpg) | ![Tur otomatis](docs/tour.jpg) |
| ![Mode Skala Nyata](docs/real-scale.jpg) | ![Versi HP](docs/mobile.jpg) |

## Cara jalanin

Butuh Node.js 18 atau lebih baru.

```bash
npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya http://localhost:5173).

Buat versi produksi

```bash
npm run build     # hasilnya di folder dist/
npm run preview   # cek hasil build secara lokal
```

## Kontrol

| Aksi | Mouse / sentuh | Keyboard |
|---|---|---|
| Pilih benda langit | Klik / tap | |
| Muter kamera | Drag / satu jari | |
| Zoom | Scroll / cubit | |
| Geser kamera | Klik kanan + drag | |
| Balik ke tampilan awal | Klik area kosong, tombol Kembali, tarik turun panel (HP) | `Esc` |
| Planet sebelumnya / berikutnya | Tombol di bawah panel info | `←` `→` |
| Pause / lanjut | Tombol play | `Spasi` |
| Kecepatan waktu | Slider | `1` sampai `4` |
| Garis orbit / label | Tombol toolbar | `O` / `L` |
| Skala Nyata | Tombol toolbar | `S` |
| Tur otomatis | Tombol toolbar | `T` |
| Cari | Tombol toolbar | `/` atau `Ctrl+K` |
| Tentang | Tombol toolbar | `?` |
| Skip intro | Klik di mana saja | Tombol apa saja |

## Catatan teknis

Beberapa bagian yang paling menarik buat dibaca kodenya

- **Kamera ngikutin planet tanpa getar** ([cameraRig.js](src/controls/cameraRig.js)). Selama terbang, tujuan kamera dihitung ulang tiap frame dari posisi planet sekarang. Setelah sampai, kamera dan target digeser sebesar pergerakan planet. Urutan update di loop utama sengaja diatur (planet, lalu kamera, lalu `controls.update()`), hasil ukurnya selisih posisi kamera ke planet cuma 1e-14 selama 120 frame
- **Siang malam Bumi** ([earth.frag](src/shaders/earth.frag)). Satu shader nyampur daymap dan nightmap pakai `smoothstep` di area terminator. Arah matahari dan normal sama sama di world space, jadi terminator gak ikut geser waktu kamera diputar. Relief dari normal map (tangent dihitung langsung di shader, tanpa `computeTangents`) dan kilau matahari Blinn Phong yang cuma muncul di laut lewat specular map
- **Orbit Kepler** ([kepler.js](src/utils/kepler.js)). Elemen orbit J2000 diputar ke bidang ekliptika, persamaan Kepler diselesaikan pakai Newton. Di mode Enak Dilihat cuma jarak ke Matahari yang dikompres, arahnya tetap, jadi kemiringan orbit dan arah perihelion tetap benar
- **Dua mode skala tanpa bikin geometry baru** ([scaleMode.js](src/scene/scaleMode.js), [scale.js](src/utils/scale.js)). Geometry dibuat sekali, transisi cuma ngubah scale dan posisi dengan interpolasi geometris (bedanya sampai 76x). Near plane kamera dinamis, karena di skala nyata kamera bisa cuma 0,085 unit dari Bumi
- **Klik yang tepat sasaran** ([picker.js](src/controls/picker.js)). Raycast ke mesh asli dulu, baru hit area yang diperbesar. Hit area minimal 9 px di layar biar planet sekecil 1 piksel tetap bisa diklik, dan cuma dipakai kalau bendanya kelihatan kecil
- **Label anti tumpuk** ([labels.js](src/ui/labels.js)). Label yang tabrakan di layar disembunyikan berdasarkan prioritas, tanpa baca ukuran DOM tiap frame
- **Performa.** Fps dipantau per detik. Kalau di bawah 40 selama 3 detik, pixel ratio diturunin ke 1 (di HP bloom juga dimatikan). Render berhenti total waktu tab gak aktif. Tekstur WebP, 58 persen lebih kecil dari JPG aslinya

Semua keputusan teknis dan alasannya dicatat di bagian Catatan Keputusan di [PRD.md](PRD.md).

## Tekstur

Tekstur dari [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), disimpan di `public/textures/` dalam format WebP.

Kode tetap pakai nama file asli (misal `2k_mars.jpg`), loader nyoba versi `.webp` dulu, lalu file aslinya, lalu tekstur prosedural. Jadi folder ini boleh isi WebP, file asli dari Solar System Scope, atau kosong sama sekali (project tetap jalan).

Cara konversi ulang ke WebP, pakai [cwebp](https://developers.google.com/speed/webp/download)

```bash
cd public/textures
for f in *.jpg; do cwebp -q 85 "$f" -o "${f%.jpg}.webp"; done
cwebp -lossless 2k_saturn_ring_alpha.png -o 2k_saturn_ring_alpha.webp
cwebp -q 90 2k_earth_normal_map.png -o 2k_earth_normal_map.webp
cwebp -q 85 2k_earth_specular_map.png -o 2k_earth_specular_map.webp
```

Normal map dan specular map Bumi dari Solar System Scope berformat `.tif` yang gak bisa dibaca browser, jadi dikonversi dulu ke `.png` (misal pakai Pillow atau GIMP) sebelum ke WebP.

Cincin Saturnus wajib lossless karena transparansinya ada di channel alpha. Setelah dikonversi, file JPG / PNG aslinya boleh dipindah keluar dari `public/` biar gak ikut ke build. Di project ini dipindah ke `textures-extra/original/` (di-ignore git).

## Deploy

Semua path aset sudah relatif ke `BASE_URL` Vite, jadi aman di-deploy ke subfolder (misal GitHub Pages). Setelah punya alamat tetap, ganti `og:image` di [index.html](index.html) jadi URL lengkap (misal `https://contoh.com/og.jpg`), karena sebagian besar media sosial gak bisa baca path relatif.

## Struktur

```
src/
├── main.js              renderer, kamera, bloom, loop utama, penghubung semua modul
├── style.css
├── data/planets.js      data planet, bulan, dan narasi tur (sumber tunggal semua isi)
├── controls/
│   ├── picker.js        klik / hover lewat raycasting, bedain klik dan drag
│   ├── cameraRig.js     intro, kamera terbang ke benda, ngikutin benda yang difokus
│   └── tour.js          tur otomatis (GSAP timeline)
├── ui/
│   ├── loader.js        loading screen (nyambung ke LoadingManager)
│   ├── toolbar.js       play / pause, kecepatan, tanggal, toggle tampilan
│   ├── labels.js        label nama di atas benda (CSS2DRenderer) + anti tumpuk
│   ├── infoPanel.js     panel info (samping di desktop, bottom sheet di HP)
│   └── search.js        pencarian (combobox ARIA)
├── scene/
│   ├── bodies.js        daftar benda yang bisa dipilih, dipakai bareng semua modul interaksi
│   ├── scaleMode.js     transisi mode Enak Dilihat dan Skala Nyata
│   ├── sun.js           matahari (shader plasma + glow + cahaya)
│   ├── planets.js       planet dan planet katai, orbit elips, rotasi, kemiringan sumbu
│   ├── earth.js         Bumi 3 lapis (siang malam, relief, kilau laut, awan, atmosfer)
│   ├── moons.js         bulan yang mengorbit planet induknya
│   ├── saturnRing.js    cincin dengan UV radial + bayangan planet
│   ├── asteroidBelt.js  sabuk asteroid (InstancedMesh, 1 draw call)
│   ├── orbits.js        garis orbit elips (buffer ditulis ulang waktu ganti skala)
│   ├── stars.js         bintang berkelip
│   └── milkyWay.js      latar Bima Sakti
├── shaders/             shader Bumi dan atmosfer (di-import pakai ?raw)
└── utils/
    ├── scale.js         rumus dua mode skala
    ├── kepler.js        posisi planet dari elemen orbit (persamaan Kepler)
    ├── time.js          tanggal simulasi dan jarak ke J2000
    ├── loader.js        LoadingManager bersama, WebP dulu lalu fallback
    ├── performance.js   pantau fps dan turunkan kualitas otomatis
    ├── device.js        deteksi mobile
    ├── noise.js         noise buat tekstur prosedural
    └── planetTexture.js tekstur prosedural (fallback kalau file tekstur gak ada)
```

## Kredit

- Tekstur oleh [Solar System Scope](https://www.solarsystemscope.com/textures/), lisensi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Data planet dari [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/)
- Elemen orbit dari [JPL, Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Font [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk)

## Progress

- [x] Fase 1, scene dasar, matahari, 8 planet muter, bintang, orbit
- [x] Fase 2, tekstur asli, Bumi 3 lapis, cincin Saturnus, sabuk asteroid
- [x] Fase 3, klik planet, label, kamera terbang, panel info
- [x] Fase 4, toolbar waktu, mode skala, loading screen
- [x] Fase 5, tur otomatis, bulan, versi mobile, polish
- [x] Tambahan, relief dan kilau laut Bumi, orbit elips dan miring sesuai posisi asli
- [ ] Deploy
