// Normal dan posisi dikirim dalam WORLD space,
// karena uSunDirection juga dihitung di world space (lihat scene/earth.js).
// Kalau salah satunya view space, terminator bakal ikut geser waktu kamera diputar
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  vUv = uv;
  // mat3(modelMatrix) aman dipakai buat normal karena Bumi gak pernah di-scale tidak seragam
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPositionW = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
