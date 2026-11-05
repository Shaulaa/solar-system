uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uNormalMap;
uniform sampler2D uSpecularMap;
uniform float uNormalStrength;
uniform float uSpecularStrength;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uAtmosphereColor;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vTangentW;
varying vec3 vPositionW;

// Normal permukaan setelah ditambah relief dari normal map (tangent space)
vec3 perturbNormal(vec3 normal) {
  // Di titik kutub tangent-nya nol, pakai normal bola apa adanya
  if (dot(vTangentW, vTangentW) < 1e-8) return normal;
  vec3 tangent = normalize(vTangentW - normal * dot(normal, vTangentW));
  // Arah v naik (ke utara), sesuai konvensi normal map OpenGL (hijau = atas)
  vec3 bitangent = cross(normal, tangent);

  vec3 mapNormal = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
  // Normal map Solar System Scope halus banget, jadi kemiringannya diperkuat
  mapNormal.xy *= uNormalStrength;
  return normalize(tangent * mapNormal.x + bitangent * mapNormal.y + normal * mapNormal.z);
}

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vPositionW);
  // sunDot dari normal bola (bukan yang sudah ada reliefnya) dipakai buat batas siang malam,
  // biar lampu kota gak berkedip ikut relief gunung di sekitar terminator
  float sunDot = dot(normal, uSunDirection);
  vec3 surfaceNormal = perturbNormal(normal);

  // Tekstur sRGB sudah otomatis jadi linear waktu di-sample, jadi bisa langsung dihitung
  vec3 day = texture2D(uDayMap, vUv).rgb;
  vec3 night = texture2D(uNightMap, vUv).rgb;
  // Specular map putih di laut, hitam di daratan. Disimpan linear (data, bukan warna)
  float ocean = texture2D(uSpecularMap, vUv).r;

  // Sisi siang pakai difus Lambert biasa plus ambient tipis,
  // biar kecerahannya senada sama planet lain yang pakai MeshStandardMaterial
  vec3 dayColor = day * (max(dot(surfaceNormal, uSunDirection), 0.0) + 0.02);

  // Kilau matahari di laut (Blinn Phong). Ada dua lobus: titik pantul yang tajam
  // dan pendar lebar yang lebih redup biar sekitarnya ikut berkilau
  vec3 halfway = normalize(uSunDirection + viewDir);
  float facing = max(dot(normal, halfway), 0.0);
  float glint = pow(facing, 48.0) + pow(facing, 8.0) * 0.1;
  dayColor += uSunColor * glint * ocean * uSpecularStrength * smoothstep(0.0, 0.2, sunDot);

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
