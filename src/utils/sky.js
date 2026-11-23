// Koordinat langit (ekuatorial J2000) ke koordinat galaxyScene
//
// Koordinat galaxyScene: pusat galaksi +X, kutub utara galaksi +Y, arah putaran galaksi
// (bujur galaktik 90 derajat) -Z, lihat workers/galaxyWorker.js. Dipakai bintang tetangga
// (data/nearbyStars.js) dan galaksi Grup Lokal (data/localGroup.js)

const DEG = Math.PI / 180;

// Matriks rotasi koordinat ekuatorial J2000 ke koordinat galaktik
// (x ke pusat galaksi, y ke bujur 90 derajat, z ke kutub utara galaksi)
const EQ_TO_GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762]
];

// Vektor ekuatorial -> galaxyScene. Pemetaan galaktik (x, y, z) -> (x, z, -y) itu rotasi murni
// (determinan 1), jadi hasil cross product tetap benar di dua sistem
function toScene(eq) {
  const gal = EQ_TO_GAL.map((row) => row[0] * eq[0] + row[1] * eq[1] + row[2] * eq[2]);
  return [gal[0], gal[2], -gal[1]];
}

// Arah ke titik di langit (vektor satuan galaxyScene). ra dalam jam, dec dalam derajat
export function skyDirection(raHours, decDegrees) {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = decDegrees * DEG;
  return toScene([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]);
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v) => {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
};

// Orientasi piringan galaksi dari data pengamatan (vektor satuan galaxyScene)
//   positionAngle  arah sumbu panjang di langit, derajat dari utara ke timur
//   inclination    kemiringan piringan, 0 = tampak dari atas, 90 = tampak dari samping
// Sumbu pendek di langit (positionAngle + 90) dimiringkan menjauh dari pengamat sebesar inclination.
// Sisi mana yang lebih dekat (tanda kemiringannya) gak bisa dibaca dari dua angka ini. Di sini sisi
// barat laut dianggap lebih dekat, benar untuk Andromeda
// Balikin { major, normal }: sumbu panjang dan normal piringan
export function diskOrientation(raHours, decDegrees, positionAngle, inclination) {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = decDegrees * DEG;
  const los = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const east = [-Math.sin(ra), Math.cos(ra), 0];
  const pa = positionAngle * DEG;
  const tilt = inclination * DEG;
  const major = [0, 1, 2].map((k) => Math.cos(pa) * north[k] + Math.sin(pa) * east[k]);
  const minorSky = [0, 1, 2].map((k) => -Math.sin(pa) * north[k] + Math.cos(pa) * east[k]);
  const minor = [0, 1, 2].map((k) => Math.cos(tilt) * minorSky[k] + Math.sin(tilt) * los[k]);
  return { major: toScene(major), normal: toScene(normalize(cross(major, minor))) };
}
