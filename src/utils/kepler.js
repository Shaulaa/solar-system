// Orbit elips planet dari elemen orbit Kepler (J2000)
//
// Posisi dihitung di bidang orbit (elips dengan Matahari di salah satu fokus), lalu diputar
// ke bidang ekliptika pakai tiga sudut: node (bujur titik naik), inclination, dan argumen
// perihelion. Hasilnya dalam AU, sudah dalam koordinat three.js:
//   x = arah titik Aries (vernal equinox), y = kutub utara ekliptika, z = -y ekliptika
// Jadi planet tetap muter berlawanan jarum jam kalau dilihat dari atas, sama seperti sebelumnya

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// Persamaan Kepler M = E - e sin E diselesaikan pakai Newton.
// Eksentrisitas planet paling besar 0,25 (Pluto), 5 iterasi sudah jauh di bawah presisi float
function solveKepler(meanAnomaly, e) {
  let E = meanAnomaly + e * Math.sin(meanAnomaly);
  for (let i = 0; i < 5; i++) {
    E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  }
  return E;
}

// a = sumbu semi mayor (AU), period = periode sidereal (hari)
// elements = { eccentricity, inclination, node, perihelion, meanLongitude } dalam derajat,
// perihelion dan meanLongitude berupa bujur (sudah termasuk node), sesuai tabel JPL
export function createKeplerOrbit(a, period, elements) {
  const { eccentricity: e, inclination, node, perihelion, meanLongitude } = elements;
  const b = a * Math.sqrt(1 - e * e);

  const I = inclination * DEG;
  const O = node * DEG;
  const w = (perihelion - node) * DEG;

  // Matriks rotasi bidang orbit ke ekliptika, cukup dihitung sekali
  const cosO = Math.cos(O);
  const sinO = Math.sin(O);
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);
  const xx = cosO * cosW - sinO * sinW * cosI;
  const xy = -cosO * sinW - sinO * cosW * cosI;
  const yx = sinO * cosW + cosO * sinW * cosI;
  const yy = -sinO * sinW + cosO * cosW * cosI;
  const zx = sinW * sinI;
  const zy = cosW * sinI;

  const meanAnomalyAtJ2000 = (meanLongitude - perihelion) * DEG;
  const meanMotion = TAU / period; // radian per hari

  // Titik di elips untuk anomali eksentrik E, ditulis ke out (THREE.Vector3)
  function pointAt(E, out) {
    const px = a * (Math.cos(E) - e);
    const py = b * Math.sin(E);
    const x = xx * px + xy * py;
    const y = yx * px + yy * py;
    const z = zx * px + zy * py;
    return out.set(x, z, -y);
  }

  return {
    // Posisi planet (AU) di hari ke sekian sejak J2000
    positionAt(daysSinceJ2000, out) {
      const M = (meanAnomalyAtJ2000 + meanMotion * daysSinceJ2000) % TAU;
      return pointAt(solveKepler(M, e), out);
    },
    // Titik titik sepanjang elips buat garis orbit, dalam AU
    // Disampel rata di anomali eksentrik, hasilnya sedikit lebih rapat di dekat perihelion
    path(segments, makeVector) {
      const points = [];
      for (let i = 0; i < segments; i++) points.push(pointAt((i / segments) * TAU, makeVector()));
      return points;
    }
  };
}
