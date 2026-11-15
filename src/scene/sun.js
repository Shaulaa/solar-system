import * as THREE from 'three';
import { SUN_RADIUS, sunRadius, blendScale } from '../utils/scale.js';
import { sun as sunData } from '../data/planets.js';
import { loadTexture } from '../utils/loader.js';

// Matahari pake shader noise yang gerak biar permukaannya kayak plasma
// Warnanya sengaja dibikin lebih terang dari 1.0 biar kena efek bloom

const noiseGLSL = /* glsl */ `
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const surfaceMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      // Tekstur matahari opsional, uMapMix tetap 0 sampai teksturnya beneran ada
      uMap: { value: null },
      uMapMix: { value: 0 },
      // Turun ke 0 waktu zoom keluar tata surya, bola Matahari diganti titik bintang
      uOpacity: { value: 1 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uMap;
      uniform float uMapMix;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      ${noiseGLSL}

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * snoise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 p = normalize(vPos) * 2.2;
        float t = uTime * 0.08;
        float warp = fbm(p + vec3(t, -t, t * 0.5));
        float n = fbm(p * 1.6 + warp * 1.4 + vec3(0.0, t * 2.0, 0.0));
        n = n * 0.5 + 0.5;

        vec3 dark = vec3(0.75, 0.2, 0.02);
        vec3 mid = vec3(1.25, 0.55, 0.08);
        vec3 hot = vec3(1.7, 1.2, 0.55);
        vec3 col = mix(dark, mid, smoothstep(0.25, 0.6, n));
        col = mix(col, hot, smoothstep(0.6, 0.9, n));

        // Dari tekstur cuma diambil terang gelapnya (granulasi), warnanya tetap dari plasma
        // biar matahari gak jadi kusam dan tetap cukup terang buat bloom
        float lum = dot(texture2D(uMap, vUv).rgb, vec3(0.2126, 0.7152, 0.0722));
        col *= mix(1.0, 0.55 + 1.3 * lum, uMapMix);

        float rim = 1.0 - max(dot(vNormal, vView), 0.0);
        col += vec3(1.0, 0.45, 0.08) * pow(rim, 2.5);

        gl_FragColor = vec4(col, uOpacity);
      }
    `
  });

// Halo tipis di sekitar matahari, ditambah bloom jadinya keliatan menyala
const glowMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float i = pow(max(dot(vNormal, vView), 0.0), 3.0);
        gl_FragColor = vec4(vec3(1.0, 0.5, 0.12) * i * 0.6, i * 0.6 * uOpacity);
      }
    `
  });

// Matahari dilihat dari jauh (zoom keluar tata surya): titik bintang yang ukurannya di layar tetap.
// Kotak titiknya STAR_SIZE px, inti terangnya (gaussian) selebar sekitar 6 px, sisanya pendar tipis.
// Intinya sedikit lebih terang dari 1 biar tetap kena bloom seperti bola Matahari
const STAR_SIZE = 28;

const starMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity: { value: 0 }
    },
    transparent: true,
    depthWrite: false,
    // Titiknya ada di pusat bola Matahari. Kalau depth test nyala, titiknya ketutup bola itu sendiri
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uPixelRatio;
      void main() {
        gl_PointSize = ${STAR_SIZE.toFixed(1)} * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      void main() {
        // Jarak dari tengah titik dalam piksel CSS
        vec2 p = (gl_PointCoord - 0.5) * ${STAR_SIZE.toFixed(1)};
        float r2 = dot(p, p);
        // Sigma 2,5 px, lebar setengah terangnya sekitar 6 px
        float r = sqrt(r2);
        float core = exp(-r2 / 12.5);
        // Pendar dipaksa habis sebelum tepi kotak. Sisa 1 persen pun setelah dikonversi ke sRGB
        // kelihatan sebagai bujur sangkar samar di latar hitam
        float halo = exp(-r / 3.0) * 0.16 * (1.0 - smoothstep(6.0, 13.0, r));
        // Puncak inti cuma sedikit di atas threshold bloom (0,9). Kalau jauh lebih terang,
        // kernel blur UnrealBloomPass yang terpotong bikin pendar bloom-nya berbentuk kotak
        vec3 color = vec3(1.0, 0.86, 0.62) * (core * 1.1 + halo);
        gl_FragColor = vec4(color, uOpacity);
      }
    `
  });

export function createSun() {
  const group = new THREE.Group();
  group.name = 'sun';

  const surface = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 96, 96), surfaceMaterial());
  surface.userData.selectable = 'sun';
  group.add(surface);

  const glow = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS * 1.25, 64, 64), glowMaterial());
  group.add(glow);

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const star = new THREE.Points(starGeometry, starMaterial());
  star.name = 'sun-star';
  star.visible = false;
  // Digambar setelah bola Matahari dan glow-nya
  star.renderOrder = 1;
  group.add(star);

  // Cahaya utama tata surya, decay 0 biar planet jauh tetep kebagian terang
  const light = new THREE.PointLight(0xfff1dd, 3.2, 0, 0);
  group.add(light);

  // Tanpa fallback, kalau file gak ada matahari cukup pakai shader plasma aja
  loadTexture(sunData.texture).then((texture) => {
    if (!texture) return;
    surface.material.uniforms.uMap.value = texture;
    surface.material.uniforms.uMapMix.value = 0.5;
  });

  const sun = {
    group,
    mesh: surface,
    // Radius sekarang (unit scene), berubah waktu transisi mode skala
    radius: SUN_RADIUS,
    // Geometry tetap ukuran mode pretty, mode lain cukup lewat scale grup.
    // Glow ikut ke-scale, PointLight gak kena efek scale
    applyScale(k) {
      sun.radius = blendScale(sunRadius('pretty'), sunRadius('real'), k);
      group.scale.setScalar(sun.radius / SUN_RADIUS);
    },
    // Waktu zoom keluar tata surya: body = opacity bola Matahari + glow, star = opacity titik bintang
    setFade({ body, star: starAlpha }) {
      const surfaceMaterial = surface.material;
      surfaceMaterial.uniforms.uOpacity.value = body;
      glow.material.uniforms.uOpacity.value = body;
      // Bola Matahari aslinya opaque. Baru dijadikan transparan selama memudar,
      // biar urutan gambar di tampilan normal gak berubah
      const transparent = body < 1;
      if (surfaceMaterial.transparent !== transparent) {
        surfaceMaterial.transparent = transparent;
        surfaceMaterial.needsUpdate = true;
      }
      surface.visible = body > 0;
      glow.visible = body > 0;

      star.material.uniforms.uOpacity.value = starAlpha;
      star.visible = starAlpha > 0;
    },
    // Ukuran titik bintang dalam piksel layar, jadi ikut pixel ratio
    setPixelRatio(ratio) {
      star.material.uniforms.uPixelRatio.value = ratio;
    },
    update(elapsed) {
      surface.material.uniforms.uTime.value = elapsed;
      surface.rotation.y = elapsed * 0.02;
    }
  };

  return sun;
}
