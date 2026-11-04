uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereColor;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPositionW;

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vPositionW);
  float sunDot = dot(normal, uSunDirection);

  // Tekstur sRGB sudah otomatis jadi linear waktu di-sample, jadi bisa langsung dihitung
  vec3 day = texture2D(uDayMap, vUv).rgb;
  vec3 night = texture2D(uNightMap, vUv).rgb;

  // Sisi siang pakai difus Lambert biasa plus ambient tipis,
  // biar kecerahannya senada sama planet lain yang pakai MeshStandardMaterial
  vec3 dayColor = day * (max(sunDot, 0.0) + 0.02);
  vec3 nightColor = night * 1.3;

  // Terminator halus, area peralihannya agak lebar di sisi gelap
  // biar lampu kota pelan pelan muncul pas matahari terbenam
  float dayMix = smoothstep(-0.18, 0.22, sunDot);
  vec3 color = mix(nightColor, dayColor, dayMix);

  // Pinggiran Bumi yang kena matahari dikasih semburat biru tipis.
  // Ini nyambung sama shell atmosfer di luar, jadi tepinya gak kelihatan putus
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  color += uAtmosphereColor * fresnel * smoothstep(-0.1, 0.5, sunDot) * 0.6;

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
