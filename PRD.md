# PRD Tata Surya Interaktif

> Dokumen ini jadi acuan utama pengerjaan project. Kerjakan **per fase secara berurutan**, jangan lompat. Tiap fase selesai kalau semua acceptance criteria-nya terpenuhi dan `npm run build` sukses tanpa error.

---

## 1. Ringkasan

Web 3D tata surya interaktif yang bisa dijelajahi bebas di browser. User bisa muter kamera, klik planet buat terbang ke sana dan baca info lengkapnya, ngatur kecepatan waktu, ganti mode skala, sampai nonton tur otomatis. Tujuannya jadi project portofolio front end creative developer, jadi kualitas visual, kehalusan animasi, dan performa sama pentingnya.

**Target kesan pertama** dalam 5 detik pertama user harus ngerasa "ini kayak aplikasi luar angkasa beneran", bukan demo Three.js biasa.

## 2. Tujuan dan Non Tujuan

### Tujuan
1. Visual sinematik (bloom, atmosfer, shader) yang tetap jalan mulus minimal 50 fps di laptop menengah
2. Interaksi intuitif tanpa perlu tutorial
3. Data planet akurat (periode, kemiringan sumbu, jumlah bulan, dll)
4. Responsif dan bisa dipakai di HP
5. Kode rapi, modular, gampang dibaca recruiter yang buka repo

### Non Tujuan
1. Simulasi fisika gravitasi beneran (orbit cukup lingkaran sempurna dengan periode asli)
2. Orbit elips dan inklinasi orbit (opsional, boleh di fase polish kalau sempat)
3. Backend, database, login
4. Framework UI (React, Vue, dll). Tetap vanilla JS

## 3. Tech Stack

| Bagian | Pilihan |
|---|---|
| Bundler | Vite 5 |
| 3D | Three.js 0.170 (`three/addons/...` buat addon) |
| Animasi | GSAP 3 |
| Bahasa | JavaScript ES Modules (vanilla, tanpa TypeScript) |
| Styling | CSS biasa, font Space Grotesk dari Google Fonts |
| Label 3D | `CSS2DRenderer` dari Three.js addons |

Jangan nambah dependency lain tanpa alasan kuat. Kalau perlu, tulis alasannya di commit message.

## 4. Kondisi Sekarang (Fase 1 sudah selesai)

Struktur yang sudah ada
```
solar-system/
├── index.html
├── package.json
├── PRD.md
├── README.md
└── src/
    ├── main.js              renderer, kamera, OrbitControls, bloom, loop utama, intro GSAP
    ├── style.css
    ├── data/planets.js      data 8 planet + matahari (radius, distance AU, orbitPeriod, rotationPeriod, tilt, look, info)
    ├── scene/
    │   ├── sun.js           shader plasma simplex noise + halo fresnel + PointLight (decay 0)
    │   ├── planets.js       hierarki orbitPivot > anchor > tiltGroup > mesh
    │   ├── orbits.js        LineLoop dari EllipseCurve
    │   └── stars.js         9000 Points dengan shader kelap kelip
    └── utils/
        ├── scale.js         SUN_RADIUS = 6, scaleDistance(au), scaleRadius(earthRadius)
        ├── noise.js         value noise 3D + fbm
        └── planetTexture.js tekstur prosedural di canvas (sementara, diganti di fase 2)
```

Hal penting yang sudah berjalan
1. `window.solar = { scene, camera, planets, time }` tersedia buat debug
2. Waktu simulasi pakai `time.simDays`, bertambah `delta * time.daysPerSecond` tiap frame (default 10 hari per detik)
3. Rotasi planet di-scale pakai `ROTATION_SCALE = 0.04` biar gak pusing
4. Spasi buat pause
5. Bloom `UnrealBloomPass` dengan threshold 0.9, cuma matahari yang nge-glow

## 5. Aturan Umum Pengerjaan

1. **Komentar kode** pakai bahasa Indonesia santai dan jelas, jelaskan *kenapa*, bukan cuma *apa*
2. Tiap modul scene mengembalikan objek dengan pola `{ group/mesh, update(...) }` seperti yang sudah ada
3. Semua data planet tetap terpusat di `src/data/planets.js`. Jangan hardcode info planet di file lain
4. Setiap resource GPU (geometry, material, texture) yang dibuang harus di-`dispose()`
5. Pixel ratio maksimal 2
6. Jangan pakai `alert`, `confirm`, atau `prompt`
7. Teks UI pakai bahasa Indonesia
8. Setelah tiap fase, update checklist Progress di `README.md`
9. Hindari em dash di teks UI

## 6. Spesifikasi Per Fase

---

### FASE 2 Visual Realistis

**Tujuan** ganti tekstur prosedural dengan tekstur asli dan tambah detail yang bikin "wah".

#### 2.1 Tekstur Asli
Sumber tekstur dari https://www.solarsystemscope.com/textures/ (lisensi CC BY 4.0, wajib kasih kredit di UI). User akan menaruh file di `public/textures/` dengan nama berikut

| File | Dipakai untuk |
|---|---|
| `2k_sun.jpg` | opsional, campuran warna matahari |
| `2k_mercury.jpg` | Merkurius |
| `2k_venus_atmosphere.jpg` | Venus |
| `2k_earth_daymap.jpg` | Bumi siang |
| `2k_earth_nightmap.jpg` | Bumi malam (lampu kota) |
| `2k_earth_clouds.jpg` | awan Bumi |
| `2k_moon.jpg` | Bulan |
| `2k_mars.jpg` | Mars |
| `2k_jupiter.jpg` | Jupiter |
| `2k_saturn.jpg` | Saturnus |
| `2k_saturn_ring_alpha.png` | cincin Saturnus |
| `2k_uranus.jpg` | Uranus |
| `2k_neptune.jpg` | Neptunus |

Requirement
1. Tambah field `texture` di tiap item `planets.js`
2. Buat `src/utils/loader.js` berisi satu `THREE.LoadingManager` bersama yang dipakai semua `TextureLoader`. Manager ini nanti dipakai loading screen di fase 4
3. Semua tekstur warna wajib `colorSpace = THREE.SRGBColorSpace`
4. **Fallback** kalau tekstur gagal dimuat (file belum ada), pakai tekstur prosedural dari `planetTexture.js`. Jadi project tetap jalan walau folder textures kosong
5. Kredit "Textures by Solar System Scope (CC BY 4.0)" tampil kecil di pojok kanan bawah

#### 2.2 Bumi 3 Lapis
Buat `src/scene/earth.js`, Bumi tidak lagi dibuat lewat jalur generik.
1. **Permukaan** pakai `ShaderMaterial` custom yang menerima `uDayMap`, `uNightMap`, `uSunDirection`. Sisi yang kena matahari tampil daymap, sisi gelap tampil nightmap (lampu kota), transisinya halus pakai `smoothstep` di area terminator
2. `uSunDirection` dihitung ulang tiap frame dalam ruang yang sama dengan normal di shader (hati hati world space vs view space)
3. **Awan** sphere radius 1.01x, `MeshStandardMaterial` dengan `alphaMap` dari clouds, `transparent`, `depthWrite: false`, berputar sedikit lebih cepat dari permukaan
4. **Atmosfer** sphere radius 1.04x, shader fresnel warna biru muda, `BackSide`, `AdditiveBlending`. Makin ke tepi makin terang, sisi gelap atmosfernya ikut redup

#### 2.3 Bulan
1. Bulan mengorbit Bumi, periode 27.3 hari, ukuran 0.27x Bumi (sebelum scale)
2. Bulan ditempel ke `anchor` Bumi (bukan ke tiltGroup) supaya orbitnya gak ikut miring 23.4 derajat
3. Data bulan masuk `planets.js` sebagai field `moons: [...]` di objek Bumi, biar fase 5 tinggal nambah bulan planet lain

#### 2.4 Cincin Saturnus
1. Buat `src/scene/saturnRing.js`
2. `RingGeometry(innerRadius = 1.24 * r, outerRadius = 2.27 * r, 128)`
3. **Wajib remap UV** supaya tekstur dibaca secara radial. Untuk tiap vertex, hitung jarak dari pusat, normalisasi ke 0..1 antara inner dan outer, set `uv.x = jarak ternormalisasi`, `uv.y = 0.5`
4. Material `MeshStandardMaterial` dengan map + alphaMap dari `2k_saturn_ring_alpha.png`, `side: DoubleSide`, `transparent`
5. Ring diputar `-Math.PI / 2` di sumbu X, ditempel ke `tiltGroup` Saturnus biar ikut miring 26.7 derajat
6. Bonus opsional, bayangan planet di cincin lewat shader sederhana

#### 2.5 Sabuk Asteroid
1. Buat `src/scene/asteroidBelt.js`
2. `InstancedMesh` dengan `IcosahedronGeometry(1, 0)` yang vertex-nya diacak sedikit biar bentuknya gak bulat sempurna
3. 2000 instance di desktop, 600 di mobile
4. Posisi di antara orbit Mars dan Jupiter (pakai `scaleDistance(2.2)` sampai `scaleDistance(3.2)`), sedikit acak di sumbu Y
5. Ukuran, rotasi acak per instance. Seluruh belt berputar pelan sebagai satu grup
6. Hanya 1 draw call

#### Acceptance Criteria Fase 2
- [ ] Semua planet pakai tekstur asli kalau file ada, fallback prosedural kalau tidak
- [ ] Sisi malam Bumi menampilkan lampu kota, terminator halus
- [ ] Awan berputar terpisah, atmosfer biru terlihat di tepi
- [ ] Bulan mengorbit Bumi
- [ ] Cincin Saturnus tampil radial (tidak ada tekstur yang melintir), ikut miring
- [ ] Sabuk asteroid terlihat dan fps tetap di atas 50
- [ ] Kredit tekstur tampil

---

### FASE 3 Interaksi

**Tujuan** user bisa klik planet, kamera terbang ke sana, dan baca info.

#### 3.1 Raycasting
1. Buat `src/controls/picker.js`
2. Raycast hanya ke mesh dengan `userData.selectable` (matahari + 8 planet + bulan)
3. Bedakan **klik** dan **drag**. Klik dianggap valid kalau pointer bergerak kurang dari 5px antara `pointerdown` dan `pointerup`. Ini penting biar muter kamera gak dianggap klik
4. Hover mengubah cursor jadi `pointer`
5. Hit area planet kecil diperbesar pakai sphere invisible 1.6x radius, biar Merkurius gampang diklik

#### 3.2 Label
1. Pakai `CSS2DRenderer`, renderer ini dipasang di atas canvas dengan `pointer-events: none`
2. Tiap planet punya label nama kecil di atas planet
3. Label muncul penuh saat hover, redup (opacity 0.4) saat tidak, dan disembunyikan kalau planet terlalu jauh atau sedang fokus ke planet lain
4. Label bisa dimatikan dari toolbar (fase 4)

#### 3.3 Kamera Terbang (bagian paling tricky)
Buat `src/controls/cameraRig.js` yang mengatur state `overview` dan `focus`.

Saat klik planet
1. Hitung posisi tujuan kamera, yaitu posisi planet + offset (arah dari matahari ke planet, sedikit ke atas) dengan jarak `radius * 5`
2. Tween `camera.position` dan `controls.target` bersamaan pakai GSAP, durasi 1.8 detik, ease `power3.inOut`
3. Selama tween, posisi tujuan harus **mengikuti planet yang terus bergerak**. Caranya tween sebuah progress `t` dari 0 ke 1, lalu tiap frame hitung `lerp(posisiAwal, posisiPlanetSekarang + offset, t)`
4. Setelah sampai, setiap frame geser `camera.position` dan `controls.target` sebesar delta pergerakan planet sejak frame sebelumnya. Dengan begini kamera nempel ke planet tapi user tetap bisa muter di sekitarnya
5. `controls.minDistance` disesuaikan dengan radius planet yang difokus
6. Tidak boleh ada getaran (jitter). Update rig dilakukan **setelah** planet di-update dan **sebelum** `controls.update()`

Kembali ke overview
1. Tombol "Kembali" di panel, tombol Esc, atau klik area kosong
2. Tween balik ke posisi overview default, target ke (0,0,0)

#### 3.4 Panel Info
1. Buat `src/ui/infoPanel.js` dan markup di `index.html`
2. Panel muncul dari kanan (desktop) atau dari bawah sebagai bottom sheet (mobile, lebar < 768px)
3. Isi panel nama planet, subjudul (misal "Planet ke 3 dari Matahari"), diameter, jarak dari matahari (AU dan juta km), lama setahun, lama sehari, suhu, jumlah bulan, kemiringan sumbu, fakta unik
4. Semua isi dibaca dari `planets.js`. Tambah field yang belum ada
5. Animasi masuk keluar pakai GSAP (slide + fade, item stagger)
6. Gaya visual glassmorphism gelap (`backdrop-filter: blur`), border tipis, font Space Grotesk, tipografi lega
7. Navigasi "planet sebelumnya / berikutnya" di bawah panel, juga bisa pakai tombol panah kiri kanan

#### Acceptance Criteria Fase 3
- [ ] Klik planet memicu kamera terbang mulus, drag tidak memicu klik
- [ ] Kamera mengikuti planet yang bergerak tanpa getar, user tetap bisa orbit di sekitar planet
- [ ] Panel info tampil dengan data benar dan animasi halus
- [ ] Esc, tombol Kembali, dan klik area kosong mengembalikan ke overview
- [ ] Panah kiri kanan pindah planet
- [ ] Label hover berfungsi

---

### FASE 4 Kontrol dan Pengalaman

#### 4.1 Toolbar
Buat `src/ui/toolbar.js`, toolbar mengambang di bawah tengah layar.
1. Tombol play / pause (sinkron dengan spasi)
2. Slider kecepatan waktu dengan preset 1 hari/dtk, 10 hari/dtk, 1 bulan/dtk, 1 tahun/dtk. Perubahan kecepatan di-tween biar gak kaget
3. Tampilan tanggal simulasi (mulai dari tanggal hari ini, bertambah sesuai `simDays`), format Indonesia, contoh "4 November 2026"
4. Toggle garis orbit
5. Toggle label
6. Toggle mode skala (lihat 4.2)
7. Tombol tur otomatis (implementasi di fase 5, di fase ini tombolnya disabled)
8. Semua tombol punya `aria-label` dan tooltip

#### 4.2 Mode Skala
1. Dua mode, **Enak Dilihat** (default, rumus di `scale.js` sekarang) dan **Skala Nyata**
2. Skala nyata pakai perbandingan asli. Gunakan satuan dimana 1 AU = 400 unit dan radius dihitung proporsional dari jarak yang sama (radius matahari 696.340 km). Konsekuensinya planet akan sangat kecil, itu memang tujuannya
3. Saat mode skala nyata, tampilkan teks kecil penjelasan, contoh "Ini perbandingan asli. Planet sekecil ini dibanding jarak antar orbitnya"
4. Transisi antar mode di-tween 2.5 detik. Radius tiap mesh dan posisi `anchor` di-interpolasi bersamaan, garis orbit di-rebuild atau di-scale mengikuti
5. Sesuaikan `controls.maxDistance` dan far plane kamera untuk mode nyata
6. Refactor `scale.js` supaya mendukung dua mode tanpa duplikasi

#### 4.3 Loading Screen
1. Overlay hitam penuh dengan judul, progress bar tipis, dan persentase
2. Terhubung ke `LoadingManager` dari fase 2
3. Setelah 100 persen, overlay fade out lalu intro kamera dimulai (intro saat ini dipindahkan supaya menunggu loading selesai)
4. Ada batas minimal tampil 800ms biar gak kedip

#### 4.4 Intro Sinematik
1. Kamera mulai dekat matahari, mundur sambil sedikit berputar (orbit 30 derajat) ke posisi overview
2. Judul dan HUD fade in setelah kamera hampir sampai
3. Interaksi user dikunci selama intro, bisa di-skip dengan klik atau tombol apa saja

#### Acceptance Criteria Fase 4
- [ ] Semua tombol toolbar berfungsi dan sinkron dengan shortcut keyboard
- [ ] Tanggal simulasi berjalan benar sesuai kecepatan
- [ ] Transisi mode skala mulus dan bisa bolak balik tanpa glitch
- [ ] Loading screen menunjukkan progress nyata, lalu intro berjalan
- [ ] Intro bisa di-skip

---

### FASE 5 Polish dan Mobile

#### 5.1 Tur Otomatis
1. Buat `src/controls/tour.js`
2. Kamera mengunjungi Matahari lalu Merkurius sampai Neptunus berurutan, berhenti sekitar 6 detik di tiap objek
3. Panel info tampil otomatis di tiap pemberhentian, ditambah teks narasi singkat di bawah layar (field `narration` di `planets.js`)
4. Tombol stop, dan tur otomatis berhenti kalau user drag atau klik
5. Pakai GSAP timeline biar gampang di-pause

#### 5.2 Bulan Tambahan
1. Mars dengan Phobos dan Deimos
2. Jupiter dengan 4 bulan Galilean (Io, Europa, Ganymede, Callisto)
3. Ukuran dan jarak bulan di-scale supaya tidak tabrakan dengan planet, warna atau tekstur sederhana cukup
4. Bulan bisa diklik dan punya info singkat

#### 5.3 Pencarian
1. Tekan `/` atau `Ctrl+K` membuka kotak pencarian kecil
2. Ketik nama planet atau bulan, Enter langsung terbang ke sana
3. Navigasi hasil pakai panah atas bawah

#### 5.4 Mobile
1. Deteksi mobile lewat lebar layar dan `pointer: coarse`
2. Kurangi jumlah bintang jadi 4000, asteroid 600, bloom strength diturunkan atau dimatikan kalau fps rendah
3. Panel info jadi bottom sheet yang bisa di-swipe turun
4. Toolbar jadi lebih ringkas (ikon saja)
5. Tap = klik, pinch = zoom, satu jari = muter

#### 5.5 Performa
1. Pantau fps rata rata. Kalau di bawah 40 selama 3 detik, turunkan pixel ratio ke 1 secara otomatis
2. Pause render loop saat tab tidak aktif (`visibilitychange`)
3. Konversi tekstur ke `.webp` kalau memungkinkan (dokumentasikan di README caranya)
4. Pastikan tidak ada memory leak saat bolak balik mode skala

#### 5.6 Polish Akhir
1. Favicon planet sederhana
2. Meta tag Open Graph (judul, deskripsi, gambar preview `public/og.jpg`)
3. Halaman "Tentang" kecil (modal) berisi kredit, tech stack, link GitHub
4. Easter egg opsional, misal Pluto tersembunyi yang muncul kalau ketik "pluto"
5. README lengkap dengan screenshot, GIF demo, fitur, cara jalanin, kredit

#### Acceptance Criteria Fase 5
- [ ] Tur otomatis jalan dari awal sampai akhir dan bisa dihentikan
- [ ] Bulan Mars dan Jupiter tampil dan bisa diklik
- [ ] Pencarian berfungsi dengan keyboard
- [ ] Nyaman dipakai di HP (tes di viewport 390x844)
- [ ] Fps desktop stabil di atas 50
- [ ] README siap dipamerkan

---

## 7. Struktur Folder Target

```
solar-system/
├── index.html
├── PRD.md
├── README.md
├── public/
│   ├── textures/
│   ├── favicon.svg
│   └── og.jpg
└── src/
    ├── main.js
    ├── style.css
    ├── data/
    │   └── planets.js
    ├── scene/
    │   ├── sun.js
    │   ├── planets.js
    │   ├── earth.js
    │   ├── moons.js
    │   ├── saturnRing.js
    │   ├── asteroidBelt.js
    │   ├── orbits.js
    │   └── stars.js
    ├── controls/
    │   ├── picker.js
    │   ├── cameraRig.js
    │   └── tour.js
    ├── ui/
    │   ├── infoPanel.js
    │   ├── toolbar.js
    │   ├── loader.js
    │   ├── search.js
    │   └── labels.js
    ├── shaders/
    │   ├── earth.vert / earth.frag
    │   ├── atmosphere.vert / atmosphere.frag
    │   └── sun.vert / sun.frag
    └── utils/
        ├── scale.js
        ├── noise.js
        ├── planetTexture.js
        ├── loader.js
        └── device.js
```

Shader boleh dipindah ke file terpisah dan di-import pakai `?raw` dari Vite (`import frag from './earth.frag?raw'`).

## 8. Urutan Update di Loop Utama

Urutan ini penting supaya kamera gak getar
```
1. hitung delta, update simDays
2. sun.update(elapsed)
3. planets.update(simDays)        posisi planet final untuk frame ini
4. moons.update(simDays)
5. cameraRig.update()             ikutin planet yang difokus
6. controls.update()
7. labels / ui update
8. composer.render() lalu labelRenderer.render()
```

## 9. Desain Visual

| Elemen | Nilai |
|---|---|
| Background | `#010104` |
| Teks utama | `#e8e8f0` |
| Teks sekunder | opacity 0.55 |
| Aksen | `#8fb4ff` (biru dingin) dan `#ffb36b` (oranye matahari) |
| Panel | `rgba(10, 12, 20, 0.55)` + `backdrop-filter: blur(16px)` + border `rgba(255,255,255,0.08)` |
| Radius sudut | 14px |
| Font | Space Grotesk 300 / 400 / 600 |
| Judul | uppercase, letter spacing lebar (0.3em) |
| Easing default | `power3.inOut` |

Nuansanya minimalis dan sinematik, UI gak boleh nutupin pemandangan 3D. Semua elemen UI tipis, transparan, dan muncul hanya saat dibutuhkan.

## 10. Testing Checklist (setiap selesai fase)

1. `npm run build` sukses tanpa error
2. Tidak ada error atau warning di console browser (kecuali yang wajar dari font)
3. Tes di Chrome desktop 1920x1080 dan viewport mobile 390x844
4. Tes resize jendela tidak merusak tampilan
5. Biarkan jalan 2 menit, pastikan memori tidak terus naik
6. Ambil screenshot hasil fase untuk dokumentasi

## 11. Cara Kerja dengan Claude Code

Contoh prompt yang bisa dipakai
```
Baca PRD.md, lalu kerjakan FASE 2 sampai semua acceptance criteria terpenuhi.
Jangan lanjut ke fase berikutnya. Setelah selesai, jalankan npm run build,
update checklist di README.md, dan rangkum apa saja yang berubah.
```

Kalau ada keputusan teknis yang tidak tercakup di PRD, pilih opsi paling sederhana yang konsisten dengan kode yang sudah ada, lalu catat di bagian "Catatan Keputusan" di bawah.

## 12. Catatan Keputusan

| Tanggal | Keputusan | Alasan |
|---|---|---|
| 2026-11-04 | Tekstur prosedural dipakai sementara di fase 1 | Tekstur asli belum diunduh |
| 2026-11-04 | Rotasi planet di-scale 0.04 | Rotasi asli terlalu cepat di kecepatan simulasi tinggi |
| 2026-11-04 | Skala enak dilihat pakai pangkat 0.55 untuk jarak dan radius | Planet dalam tidak berdempetan, planet luar masih masuk layar |
| 2026-11-04 | Jarak orbit Bulan disimpan sebagai `orbitRadius` (kelipatan radius Bumi yang sudah di-scale, 2.4x), bukan jarak asli | Jarak asli (60x radius Bumi) bikin Bulan nyasar ke orbit Venus/Mars di skala enak dilihat. 2.4x dipilih supaya gak pernah nyentuh Venus saat konjungsi |
| 2026-11-04 | Rotasi Bulan tidak di-update terpisah, mesh cukup ikut pivot orbit + diputar 180 derajat | Otomatis tidal lock, sisi dekat Bulan selalu menghadap Bumi |
| 2026-11-04 | Cincin Saturnus cuma pakai `map`, `alphaMap` dibuang (menyimpang dari 2.4.4). Tetap `transparent: true`, `side: DoubleSide`, `depthWrite: false` | `2k_saturn_ring_alpha.png` ternyata RGBA, transparansinya sudah ada di channel alpha dan kebaca lewat `map`. `alphaMap` three.js baca channel hijau, jadi transparansinya kepotong dua kali dan cincin jadi redup kecoklatan. Sudah dibandingkan langsung di browser |
| 2026-11-04 | Tekstur awan dan alphaMap dibiarkan linear (`NoColorSpace`) | Itu data transparansi, bukan warna. Aturan sRGB hanya untuk tekstur warna |
| 2026-11-04 | Bayangan Saturnus di cincin dibuat lewat `onBeforeCompile` di MeshStandardMaterial | Bonus 2.4.6 tanpa harus nulis ulang lighting cincin dari nol |
| 2026-11-04 | Sabuk asteroid berputar dengan periode 1620 hari (Kepler di 2,7 AU), mengikuti `simDays` | Konsisten dengan waktu simulasi dan ikut berhenti saat pause |
| 2026-11-04 | `2k_sun.jpg` cuma diambil kecerahannya (granulasi), warna tetap dari shader plasma | Warna tekstur mentah bikin matahari kusam dan kurang terang buat bloom |
| 2026-11-04 | Mobile = lebar <= 768px atau `pointer: coarse`, dipusatkan di `utils/device.js` | Dipakai bareng untuk jumlah asteroid dan bloom |
| 2026-11-04 | `controls` ditambahkan ke `window.solar` | Mempermudah debug kamera dari console |
| 2026-11-04 | **Tambahan di luar PRD:** latar Bima Sakti dari `2k_stars_milky_way.jpg` (`src/scene/milkyWay.js`). Sphere radius 2000 `BackSide`, opacity 0.35, digambar paling awal, bintang kelap kelip (radius 900 sampai 1500) tetap di depannya | Nambah kedalaman visual tanpa beban berarti (1 draw call, fps tetap 60) |
| 2026-11-04 | Tekstur Bima Sakti diperkecil ke 512x256 dan piksel terang dipotong di 32/255 lewat canvas, warnanya dikali 8 | Tekstur aslinya sangat gelap (pita rata rata sekitar 5/255), dan pada 2048 px bintang di tekstur tampil sebagai kotak buram yang bersaing dengan `stars.js`. Hasilnya cuma kabut pita galaksi, bintang tajam tetap dari `stars.js` |
| 2026-11-04 | Bidang Bima Sakti miring 60 derajat dari ekliptika, pusat galaksi diarahkan ke belakang matahari pada tampilan overview default | Kalau cuma diputar di sumbu X, kamera overview menghadap kutub galaksi dan pitanya gak kelihatan |
| 2026-11-04 | Tekstur yang belum dipakai disimpan di `textures-extra/` (di-ignore git, bukan di `public/`). Normal map dan specular map Bumi sudah dikonversi dari `.tif` ke `.png` | Isi `public/` ikut ke build, dan `.tif` gak bisa dibaca browser. Specular disiapkan buat kilau laut di fase polish |
| 2026-11-04 | `scene/bodies.js` jadi registri bersama (Matahari, planet, bulan) untuk picker, label, kamera, dan panel | Aturan "benda apa saja yang interaktif" cukup ditulis sekali |
| 2026-11-04 | Kamera fokus diletakkan di arah matahari ke planet lalu diputar 120 derajat di sumbu Y (menyimpang dari 3.3.1) | Kalau persis di arah matahari ke planet, kamera ada di belakang planet dan yang kelihatan cuma sisi malam. Dengan 120 derajat sisi siang dan terminator kelihatan. Matahari (di pusat) pakai arah kamera saat itu |
| 2026-11-04 | Pergantian state kamera (flying ke focus, returning ke overview) dilakukan di `cameraRig.update()`, bukan di `onComplete` GSAP | Posisi terakhir yang dipakai menghitung delta frame berikutnya pasti sama dengan yang dirender, gak tergantung urutan ticker GSAP. Hasil uji: offset kamera ke Bumi bergeser 1.5e-14 selama 120 frame |
| 2026-11-04 | Sisa inertia OrbitControls diselesaikan dulu (`enableDamping` dimatikan sesaat + `update()`) sebelum kamera terbang | Biar sisa putaran dari drag terakhir gak nyampur ke animasi terbang |
| 2026-11-04 | Raycast dua tahap: mesh asli dulu, baru hit area 1.6x. Hit area hanya dipakai kalau jari jari benda di layar kurang dari 24 px | Tanpa ini hit area Bumi menutupi Bulan, dan waktu kamera dekat hit area jadi selebar layar sehingga klik area kosong gak bisa balik ke overview |
| 2026-11-04 | Label benda yang sedang difokus disembunyikan, label induk / bulannya tetap tampil. Label bulan baru muncul kalau kamera dalam jarak 40 unit | Nama benda yang difokus sudah tampil besar di panel. Label bulan di overview numpuk dengan label planetnya |
| 2026-11-04 | Isi panel diformat dari angka di `planets.js` (AU ke juta km, hari ke tahun / jam, rotasi negatif ditulis "berlawanan arah"). `subtitle` hanya diisi untuk Matahari dan Bulan | Data tetap terpusat dan gak ada angka yang ditulis dua kali sebagai teks |
| 2026-11-04 | Di bottom sheet (lebar < 768px) framing kamera digeser ke atas 22 persen tinggi layar lewat `camera.setViewOffset`, dan di layar portrait jarak fokus ditambah (maks(1, 0.75 / aspect) x 5 radius) | Tanpa ini planet yang difokus memenuhi lebar layar HP dan separuhnya ketutup sheet. Desktop tetap persis 5x radius |
| 2026-11-04 | Spasi dan panah gak diproses kalau fokus keyboard ada di tombol / input | Biar spasi tetap bisa menekan tombol dan panah gak bentrok dengan slider di fase 4 |
| 2026-11-04 | Pindah mode skala gak bikin geometry baru. Geometry tetap ukuran Enak Dilihat, transisi cuma ngubah `scale` grup (radius) dan posisi `anchor` (jarak). Garis orbit pakai satu geometry lingkaran radius 1 yang di-scale | Gak ada yang perlu di-dispose, jadi bolak balik mode gak bocor memori. Hasil uji 6x bolak balik: jumlah geometry tetap 19, heap naik 0,05 MB |
| 2026-11-04 | Interpolasi antar mode skala pakai interpolasi geometris (`blendScale`), bukan linear | Bedanya sampai 76x (jarak) dan 50x (radius). Kalau linear, hampir semua perubahan kelihatan numpuk di awal transisi |
| 2026-11-04 | Bulan dapat field `distanceKm` (384.400 km) buat mode Skala Nyata | Mode nyata harus pakai jarak asli, `orbitRadius` cuma berlaku di mode Enak Dilihat |
| 2026-11-04 | Ukuran batu asteroid ikut mengecil di mode nyata, sebanding dengan Bumi | Kalau dibiarkan, batu asteroid jauh lebih besar dari Bumi di mode nyata |
| 2026-11-04 | Kamera overview mode nyata mundur 76,6x (sebanding melebarnya orbit Neptunus), `maxDistance` 31.191, far plane 60.000. Selama transisi batasnya dilonggarkan ke yang terbesar dari dua mode | Komposisi overview tetap mirip, dan OrbitControls gak nahan kamera di tengah transisi |
| 2026-11-04 | Near plane kamera dinamis: 1 persen jarak kamera ke target, dibatasi 0,0005 sampai 0,1 | Di mode nyata kamera fokus Bumi cuma 0,085 unit dari planet, near plane tetap 0,1 bakal motong planetnya. Di mode Enak Dilihat hasilnya tetap 0,1 seperti sebelumnya |
| 2026-11-04 | Bintang dan Bima Sakti ikut posisi kamera (teknik skybox) | Di mode nyata Neptunus ada di 12.028 unit, jauh di luar cangkang bintang (900 sampai 1500) |
| 2026-11-04 | Label diposisikan di world space tiap frame, hit area klik dipindah ke grup sendiri, dan hit area dijamin minimal 9 px di layar | Biar gak ke-scale dua kali waktu ganti mode. Di mode nyata planet jauh lebih kecil dari 1 piksel, tanpa batas minimal planet gak bisa diklik |
| 2026-11-04 | Kalau beberapa hit area kecil numpuk, yang dipilih benda dengan pusat paling dekat ke kursor | Di overview Bumi dan Bulan cuma berjarak sekitar 10 px |
| 2026-11-04 | Waktu simulasi baru jalan setelah intro selesai | Biar tanggal yang pertama kelihatan di toolbar benar benar tanggal hari ini (4.1.3) |
| 2026-11-04 | Tanggal simulasi dihitung pakai `new Date(tahun, bulan, tanggal + n)` | Kalau pakai tambah milidetik, tanggal bisa meleset sehari di negara yang pakai daylight saving time |
| 2026-11-04 | Preset "1 bulan/dtk" = 30,44 hari (rata rata panjang bulan) | Lebih akurat dari 30 hari |
| 2026-11-04 | Shortcut tambahan: 1 sampai 4 (kecepatan), O (orbit), L (label), S (skala). Elemen yang difokus keyboard tetap berhak atas tombol yang dia pakai (spasi di tombol, panah di slider) | Acceptance 4 minta toolbar sinkron dengan shortcut, jadi tiap tombol perlu shortcut |
| 2026-11-04 | Elemen `.status` lama dihapus, gantinya toolbar | Info kecepatan dan pause sudah ada di toolbar |
| 2026-11-04 | HUD disembunyikan lewat class `is-intro` di `<body>` (dari HTML) dan dimunculkan lewat transisi CSS, bukan GSAP | GSAP nulis `opacity: 1` inline dan nimpa opacity 0,4 kredit. Pakai class juga gak ada kedip sebelum JS jalan |
| 2026-11-04 | Hover tooltip dan tombol toolbar cuma aktif di `@media (hover: hover)` | Di layar sentuh `:hover` nyangkut setelah tap |
| 2026-11-04 | Intro 4,5 detik, mulai 26 unit dari Matahari, jarak diinterpolasi geometris, berputar 30 derajat | Mundurnya kerasa rata dari dekat sampai jauh |
| 2026-11-05 | Tur dibangun dari `bodies.sequence` (Matahari lalu 8 planet), tiap pemberhentian 1,8 detik terbang + 6 detik diam. Tur berhenti kalau user drag, klik, scroll, Esc, panah, pilih dari pencarian, atau ganti skala | 5.1.4 minta berhenti kalau user drag atau klik, scroll dan navigasi lain juga berarti user ngambil alih |
| 2026-11-05 | Di HP narasi tur dipindah ke paling atas dan judul HUD disembunyikan selama tur | Bagian bawah dipakai bottom sheet. Hasil ukur: narasi berakhir di y=135, planet mulai y=142, sheet mulai y=380 |
| 2026-11-05 | Periode orbit visual bulan dihaluskan `sqrt(p^2 + 3^2)` hari, panel info tetap nampilin angka asli | Fobos aslinya 7,6 jam, di 10 hari per detik jadi 31 putaran per detik dan kelihatan kedip (stroboskop). Urutan kecepatan tetap benar, Bulan Bumi cuma bergeser 0,6 persen |
| 2026-11-05 | Jarak orbit bulan baru (mode Enak Dilihat): Fobos 1,8x dan Deimos 2,8x radius Mars, Io 1,6x, Europa 2,0x, Ganimede 2,5x, Kalisto 3,1x radius Jupiter. Tekstur prosedural bulan 256x128 | Gak tabrakan dengan planet tetangga maupun sabuk asteroid (dicek manual), dan startup gak melambat |
| 2026-11-05 | Nama bulan pakai ejaan Indonesia (Fobos, Ganimede, Kalisto) dengan `aliases` ejaan Inggris buat pencarian | Teks UI wajib bahasa Indonesia, tapi orang sering ngetik ejaan Inggris |
| 2026-11-05 | Easter egg Pluto muncul lewat kotak pencarian (ketik "pluto"), bukan ketikan bebas | Huruf L dan O sudah jadi shortcut label dan orbit, ketik "pluto" bebas bakal ikut nge-toggle dua duanya |
| 2026-11-05 | Pluto ada di list planet dengan `kind: 'dwarf'` dan `hidden: true`, orbitnya miring 17,16 derajat. Gak masuk urutan tur maupun navigasi, dari Pluto panah kiri ke Neptunus dan kanan ke Matahari | Mode skala, garis orbit, label, dan klik otomatis jalan tanpa kode khusus. Inklinasi cuma buat Pluto karena PRD menganggap planet utama sebidang |
| 2026-11-05 | Label yang tabrakan di layar disembunyikan (greedy berdasarkan prioritas: hover, jenis benda, ukuran asli). Lebar label diperkirakan dari jumlah huruf | Label planet dalam numpuk di mode Skala Nyata. Ukuran DOM gak dibaca tiap frame biar gak maksa hitung ulang layout |
| 2026-11-05 | Panel info desktop juga menggeser framing kamera (ke kiri setengah lebar area yang ketutup panel) | Di laptop layar sempit panel nutupin hampir 40 persen layar, planet yang difokus jadi ketutup. Hasil ukur: planet tepat di tengah area yang kelihatan di 960 px dan 1920 px |
| 2026-11-05 | Selama terbang, arah kamera relatif ke Matahari dihitung ulang tiap frame (kecuali Matahari sendiri) | Di 1 tahun per detik Merkurius muter beberapa kali selama 1,8 detik terbang. Kalau offset dikunci dari awal, kamera bisa nyampe di sisi malam |
| 2026-11-05 | Pemantau fps menghitung rata rata per detik, turun level kalau di bawah 40 selama 3 detik berturut turut. Level 1 pixel ratio ke 1, level 2 (khusus HP) bloom dimatikan | Satu frame lambat (misal upload tekstur) gak langsung dianggap lemot |
| 2026-11-05 | Tekstur dikonversi ke WebP (6,38 MB jadi 2,67 MB, cincin lossless). Data tetap pakai nama `.jpg`, loader nyoba `.webp` dulu lalu file asli lalu prosedural. File asli dipindah ke `textures-extra/original/` | Nama file tetap sesuai tabel 2.1, dan user tetap bisa naruh file asli dari Solar System Scope tanpa konversi |
| 2026-11-05 | Dialog Tentang pakai elemen `<dialog>` bawaan, pencarian pakai pola combobox ARIA (`aria-activedescendant`) | Focus trap dan Esc dari browser, pembaca layar tahu hasil mana yang dipilih |
| 2026-11-05 | Input pencarian di-`blur()` eksplisit waktu ditutup | Input yang disembunyikan bisa tetap pegang fokus, tombol `/` berikutnya malah masuk ke input yang gak kelihatan |
| 2026-11-05 | Screenshot dan GIF README disimpan di `docs/` (JPEG dan GIF 640x360), `og.jpg` 1200x630 di `public/` | `og:image` masih path relatif, perlu diganti URL lengkap setelah deploy (dicatat di README) |
| 2026-11-05 | **Tambahan di luar PRD:** normal map dan specular map Bumi dipasang di shader permukaan. Relief dikuatkan 8x (normal map Solar System Scope sangat halus), kilau laut Blinn Phong dua lobus (pangkat 48 dan 8) dengan kekuatan 0,9. Tangent dihitung di vertex shader dari `cross(sumbu Y, normal)` | Sphere punya UV equirectangular, jadi tangent bisa diturunkan langsung tanpa `computeTangents()`. Batas siang malam tetap pakai normal bola biar lampu kota gak berkedip ikut relief |
| 2026-11-05 | Normal map dan specular map gak punya fallback prosedural, dan gak dipakai kalau daymap-nya prosedural | Benua prosedural gak bakal pas dengan peta laut asli. Tanpa file, Bumi tetap jalan seperti sebelumnya (rata, tanpa kilau) |
| 2026-11-05 | **Tambahan di luar PRD (Non Tujuan 2, opsional):** semua planet pakai orbit elips dan miring dari elemen orbit J2000 JPL, posisinya dihitung dengan persamaan Kepler sesuai tanggal simulasi. Menggantikan sudut awal acak dan pengecualian inklinasi khusus Pluto | Posisi planet di layar sama dengan langit asli di tanggal yang tampil di toolbar. Dicek: bujur heliosentris Bumi 5 November 2026 = 42 derajat (Matahari di Scorpius), Venus 7 derajat di depan Bumi (konjungsi inferior akhir Oktober 2026) |
| 2026-11-05 | Elemen orbit diperlakukan tetap (laju perubahan per abad diabaikan), gerak rata rata dari `orbitPeriod`. Periode orbit diganti ke periode sidereal yang lebih presisi (misal Merkurius 87,969 hari, bukan 88) | Dengan 88 hari posisi Merkurius sudah meleset sekitar 14 derajat dalam 27 tahun sejak J2000. Perubahan elemen per abad jauh lebih kecil dari itu |
| 2026-11-05 | Di mode Enak Dilihat posisi dihitung dalam AU lalu cuma jarak ke Matahari yang di-scale (arahnya tetap). Garis orbit disimpan dalam AU dan buffer-nya ditulis ulang waktu ganti skala | Kemiringan orbit dan arah perihelion tetap benar, elipsnya ikut terkompres seperti jaraknya. Tetap gak ada geometry baru yang dibuat |
| 2026-11-05 | Jarak orbit Bulan 2,4x jadi 2,3x radius Bumi, Deimos 2,8x jadi 2,6x radius Mars | Dengan orbit elips jarak antar planet berubah ubah. Simulasi 200 tahun: celah terkecil Venus ke sistem Bumi Bulan tadinya minus 0,02 unit dan Bumi ke Mars minus 0,07. Sekarang plus 0,07 dan plus 0,14 |
| 2026-11-05 | Label panel info "Jarak dari Matahari" jadi "Jarak rata rata dari Matahari" | Angkanya sumbu semi mayor, jarak aslinya berubah sepanjang orbit elips |
