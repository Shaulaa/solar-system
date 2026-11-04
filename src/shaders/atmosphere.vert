varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  // Normal tetap normal luar bola walaupun yang digambar BackSide,
  // jadi masih bisa dibandingkan sama arah matahari
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPositionW = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
