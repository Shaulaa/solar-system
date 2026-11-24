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
// Planet (e paling besar 0,25) konvergen dalam 3 sampai 4 iterasi. Komet (Halley e = 0,967) butuh
// tebakan awal PI: dari tebakan M + e sin M, Newton bisa loncat jauh di dekat perihelion
// (turunannya 1 - e cos E hampir 0). Iterasi berhenti begitu langkahnya di bawah 1e-12
const MAX_ITERATIONS = 30;
const TOLERANCE = 1e-12;

function solveKepler(meanAnomaly, e) {
  let E = e > 0.8 ? Math.PI : meanAnomaly + e * Math.sin(meanAnomaly);
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const step = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < TOLERANCE) break;
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
      // Dinormalkan ke 0 sampai 2 PI, tebakan awal PI buat komet cuma dijamin konvergen di rentang ini
      const M = (((meanAnomalyAtJ2000 + meanMotion * daysSinceJ2000) % TAU) + TAU) % TAU;
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
