// Pemanasan GPU setelah intro, biar zoom keluar pertama kali gak tersendat
//
//   1. Shader yang baru dipakai waktu zoom keluar (titik bintang Matahari, partikel galaksi, debu,
//      lapisan tekstur, penanda "Kamu di sini") dikompilasi duluan lewat compileAsync
//      (KHR_parallel_shader_compile, gak ngeblok). Tanpa ini, waktu cache shader GPU masih kosong
//      (pengunjung pertama), frame setelah shader baru dipakai macet 33 sampai 67 ms (terukur di 1920x1080).
//      Render target composer diaktifkan dulu, karena program three.js ikut ditentukan tone mapping dan
//      color space render target. Kalau dikompilasi ke layar, programnya beda dan gak kepakai ulang.
//      Satu objek per frame: kerja JavaScript three.js nyusun semua program sekaligus jadi satu long task
//      154 ms di 390x844 dengan CPU 4x lebih lambat (pemanggilan WebGL-nya sendiri gak ada yang di atas 11 ms)
//   2. Tekstur yang belum pernah diupload ke GPU dikirim duluan, satu per frame. three.js baru upload
//      tekstur waktu bendanya pertama kali digambar, padahal benda di luar layar gak digambar (frustum
//      culling). Di HP portrait Neptunus ada di luar layar waktu overview, jadi teksturnya (2048x1024 plus
//      mipmap) baru diupload waktu zoom keluar mulai: satu frame 166 ms di 390x844 dengan CPU 4x lebih lambat.
//      Tekstur lapisan galaksi gak ikut, diurus sendiri per tile (galaxy/galaxyTexture.js)

// Jeda setelah intro selesai sebelum pemanasan mulai (milidetik)
export const GPU_WARMUP_DELAY = 1500;

function precompileZoomOutShaders({ renderer, composer, galaxy, sun, scene, camera }, onDone) {
  const warmup = galaxy.particles.createWarmupObjects();
  const jobs = [];
  const add = (root, jobCamera, targetScene) =>
    root.traverse((object) => {
      if (object.material) jobs.push([object, jobCamera, targetScene]);
    });
  add(warmup.group, galaxy.camera, galaxy.scene);
  add(galaxy.scene, galaxy.camera, galaxy.scene);
  add(sun.group, camera, scene);

  const tasks = [];
  const next = () => {
    const job = jobs.shift();
    if (!job) {
      Promise.all(tasks).then(warmup.dispose, warmup.dispose);
      onDone?.();
      return;
    }
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer);
    tasks.push(renderer.compileAsync(...job));
    renderer.setRenderTarget(previousTarget);
    requestAnimationFrame(next);
  };
  next();
}

function warmPendingTextures({ renderer, scene }) {
  const pending = new Set();
  const collect = (value) => {
    if (!value?.isTexture || value.isRenderTargetTexture) return;
    const image = value.image;
    const ready =
      image instanceof HTMLImageElement
        ? image.complete && image.naturalWidth > 0
        : image instanceof ImageBitmap || image instanceof HTMLCanvasElement;
    if (ready && !renderer.properties.get(value).__webglTexture) pending.add(value);
  };
  scene.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) collect(value);
      if (material.uniforms) for (const uniform of Object.values(material.uniforms)) collect(uniform.value);
    }
  });
  const queue = [...pending];
  const isUploaded = (texture) => Boolean(renderer.properties.get(texture).__webglTexture);
  const step = async () => {
    const texture = queue.shift();
    if (!texture) return;
    if (!isUploaded(texture)) await uploadDecoded(texture);
    requestAnimationFrame(step);
  };
  // Upload HTMLImageElement bikin browser decode gambarnya (WebP) di main thread saat itu juga (terukur 197 ms
  // untuk Neptunus di CPU 4x lebih lambat). createImageBitmap dari elemen <img> ternyata juga decode
  // di main thread (terukur 138 ms), yang benar benar di luar main thread cuma dari Blob. Gambarnya
  // diambil ulang dari cache HTTP, di-decode, lalu bitmap yang sudah jadi tinggal disalin ke GPU.
  // Orientasi bitmap diatur waktu decode (imageOrientation), karena WebGL mengabaikan flipY untuk
  // ImageBitmap. Kalau gagal, upload cara biasa
  async function uploadDecoded(texture) {
    const image = texture.image;
    if (image instanceof HTMLImageElement && image.src && typeof createImageBitmap === 'function') {
      try {
        const response = await fetch(image.src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob(), {
          imageOrientation: texture.flipY ? 'flipY' : 'from-image',
          premultiplyAlpha: texture.premultiplyAlpha ? 'premultiply' : 'none',
          colorSpaceConversion: 'none'
        });
        // Sempat digambar (dan diupload pakai gambar aslinya) selama nunggu decode: bitmap gak dipakai
        if (isUploaded(texture)) {
          bitmap.close();
          return;
        }
        texture.image = bitmap;
        texture.flipY = false;
        texture.needsUpdate = true;
      } catch {
        // Upload pakai gambar asli di bawah
      }
    }
    renderer.initTexture(texture);
  }
  requestAnimationFrame(step);
}

// deps = { renderer, composer, galaxy, sun, scene, camera }. Shader dulu, baru tekstur
export function warmUpGpu(deps) {
  precompileZoomOutShaders(deps, () => warmPendingTextures(deps));
}
