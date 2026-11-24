import * as THREE from 'three';
import { fadeBetween, STAGES } from '../galaxy/zoomLevels.js';

// Bloom per tahap zoom. Setelan tata surya bikin glow Matahari. Di tahap galaksi inti galaksi dan ribuan
// partikel terang ikut kena, dan pendarnya kelihatan sebagai kotak samar di sekitar bulge.
// Penyebabnya UnrealBloomPass: blur di tiap mip pakai kernel gaussian yang dipotong tepat di
// 1 sigma, jadi sumber yang sangat terang selalu menghasilkan kotak, paling kelihatan di dua mip
// terbesar. Parameter radius cuma menggeser bobot mip, gak bisa mematikannya. Jadi di tahap galaksi
// bobot tiap mip (bloomFactors) diatur langsung: mip besar hampir 0, pendar inti tinggal dari mip
// kecil yang tepinya ketutup inti yang memang sudah jenuh. Kekuatan juga dikurangi biar gak putih semua
export function createStageBloom(bloom) {
  const factors = bloom.compositeMaterial.uniforms.bloomFactors.value;
  const settings = {
    solar: { strength: bloom.strength, radius: bloom.radius, threshold: bloom.threshold, factors: [...factors] },
    galaxy: { strength: bloom.strength * 0.6, radius: 0, threshold: 1.0, factors: [1, 0.55, 0.18, 0.03, 0] }
  };
  const { lerp } = THREE.MathUtils;

  return {
    update(zoomLevel) {
      const t = fadeBetween(zoomLevel, STAGES.galaxyBloom.start, STAGES.galaxyBloom.end);
      const { solar, galaxy } = settings;
      bloom.strength = lerp(solar.strength, galaxy.strength, t);
      bloom.radius = lerp(solar.radius, galaxy.radius, t);
      bloom.threshold = lerp(solar.threshold, galaxy.threshold, t);
      for (let i = 0; i < factors.length; i++) factors[i] = lerp(solar.factors[i], galaxy.factors[i], t);
    }
  };
}
