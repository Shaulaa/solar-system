uniform vec3 uSunDirection;
uniform vec3 uAtmosphereColor;

varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vPositionW);

  // Yang kelihatan cuma sisi belakang shell, jadi dot(normal, viewDir) negatif.
  // Nilainya 0 tepat di siluet luar atmosfer dan makin besar mendekati tepi planet.
  // Hasilnya cahaya paling terang nempel di tepi planet lalu memudar ke luar
  float rim = clamp(-dot(normal, viewDir), 0.0, 1.0);
  float intensity = pow(smoothstep(0.0, 0.3, rim), 1.5);

  // Sisi malam atmosfernya ikut redup, dengan sedikit sisa cahaya di area terminator
  float sunFactor = smoothstep(-0.3, 0.45, dot(normal, uSunDirection));
  intensity *= sunFactor;

  // Alpha 1 karena AdditiveBlending (SRC_ALPHA, ONE), jadi terangnya murni dari rgb
  gl_FragColor = vec4(uAtmosphereColor * intensity, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
