// Web Worker pemuat gambar besar (dipakai lapisan tekstur galaksi, galaxy/galaxyTexture.js)
//
// Decode gambar 4096 px makan sekitar 190 ms. Walaupun pakai createImageBitmap, di main thread
// Chrome tetap ngeblok halaman selama itu (terukur), jadi fetch dan decode dipindah ke sini.
// Gambarnya sekalian dipotong jadi tile persegi, biar main thread bisa upload ke GPU satu tile
// per frame. Upload 4096x4096 sekaligus bikin satu frame macet sekitar 100 ms
//
// Pesan masuk   { url, size, tile }   size = ukuran hasil (px), tile = ukuran tiap potongan (px)
// Pesan keluar  { size, tiles: [{ x, y, bitmap }], ms }  atau  { missing: true }
// Baris y = 0 adalah bawah gambar (dibalik vertikal), sesuai konvensi UV WebGL

self.onmessage = async ({ data }) => {
  const start = performance.now();
  try {
    const response = await fetch(data.url);
    const type = response.headers.get('content-type') ?? '';
    // File gak ada, atau server balikin index.html buat file yang gak ada (fallback SPA)
    if (!response.ok || type.includes('text/html')) {
      self.postMessage({ missing: true });
      return;
    }
    const blob = await response.blob();
    const full = await createImageBitmap(blob, {
      imageOrientation: 'flipY',
      resizeWidth: data.size,
      resizeHeight: data.size,
      resizeQuality: 'high'
    });

    const tiles = [];
    for (let y = 0; y < data.size; y += data.tile) {
      for (let x = 0; x < data.size; x += data.tile) {
        tiles.push({ x, y, bitmap: await createImageBitmap(full, x, y, data.tile, data.tile) });
      }
    }
    full.close();

    self.postMessage(
      { size: data.size, tiles, ms: performance.now() - start },
      tiles.map((t) => t.bitmap)
    );
  } catch {
    self.postMessage({ missing: true });
  }
};
