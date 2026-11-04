// Skala "enak dilihat"
// Ukuran asli tata surya bikin planet cuma jadi titik, jadi jarak dan radius dikompres pake pangkat

export const SUN_RADIUS = 6;

export function scaleDistance(au) {
  return SUN_RADIUS + 8 + 22 * Math.pow(au, 0.55);
}

export function scaleRadius(earthRadius) {
  return 0.9 * Math.pow(earthRadius, 0.55);
}
