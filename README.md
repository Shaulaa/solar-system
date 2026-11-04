# Tata Surya Interaktif

Project web 3D tata surya pake Three.js, GSAP, dan Vite.

## Cara jalanin

```bash
npm install
npm run dev
```

Terus buka alamat yang muncul di terminal (biasanya http://localhost:5173).

## Tekstur

Tekstur planet diambil dari [Solar System Scope](https://www.solarsystemscope.com/textures/) (lisensi CC BY 4.0).
Unduh versi 2k lalu taruh di `public/textures/` dengan nama file berikut

```
2k_sun.jpg               2k_earth_clouds.jpg      2k_saturn.jpg
2k_mercury.jpg           2k_moon.jpg              2k_saturn_ring_alpha.png
2k_venus_atmosphere.jpg  2k_mars.jpg              2k_uranus.jpg
2k_earth_daymap.jpg      2k_jupiter.jpg           2k_neptune.jpg
2k_earth_nightmap.jpg    2k_stars_milky_way.jpg
```

`2k_stars_milky_way.jpg` dipakai buat latar Bima Sakti. Semua file opsional. Kalau ada yang belum ada, objek itu otomatis pakai tekstur prosedural (latar Bima Sakti cukup gak ditampilkan), jadi project tetap jalan walau foldernya kosong.

Tekstur lain yang belum dipakai (planet katai, normal map dan specular map Bumi versi `.png`, dll) disimpan di `textures-extra/`. Folder ini di luar `public/` biar gak ikut ke build, dan di-ignore git.

## Kontrol

1. Drag mouse buat muter kamera
2. Scroll buat zoom
3. Klik kanan + drag buat geser
4. Spasi buat pause atau lanjut

## Struktur

```
src/
├── main.js              renderer, kamera, bloom, loop utama
├── style.css
├── data/planets.js      data dan info tiap planet
├── scene/
│   ├── sun.js           matahari (shader plasma + glow + cahaya)
│   ├── planets.js       8 planet dengan revolusi, rotasi, kemiringan sumbu
│   ├── earth.js         Bumi 3 lapis (siang malam, awan, atmosfer)
│   ├── moons.js         bulan yang mengorbit planet induknya
│   ├── saturnRing.js    cincin dengan UV radial + bayangan planet
│   ├── asteroidBelt.js  sabuk asteroid (InstancedMesh, 1 draw call)
│   ├── orbits.js        garis orbit
│   ├── stars.js         background bintang berkelip
│   └── milkyWay.js      latar Bima Sakti (sphere BackSide redup)
├── shaders/             shader Bumi dan atmosfer (di-import pakai ?raw)
└── utils/
    ├── scale.js         rumus skala "enak dilihat"
    ├── loader.js        LoadingManager bersama + muat tekstur dengan fallback
    ├── device.js        deteksi mobile
    ├── noise.js         noise buat tekstur prosedural
    └── planetTexture.js tekstur prosedural (fallback kalau file tekstur gak ada)
```

## Progress

- [x] Fase 1, scene dasar, matahari, 8 planet muter, bintang, orbit
- [x] Fase 2, tekstur asli, Bumi 3 lapis, cincin Saturnus, sabuk asteroid
- [ ] Fase 3, klik planet, label, kamera terbang, panel info
- [ ] Fase 4, toolbar waktu, mode skala, loading screen
- [ ] Fase 5, tur otomatis, bulan, versi mobile, polish
