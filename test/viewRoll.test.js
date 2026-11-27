import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { alignRoll, blendRoll, stabilizeRoll } from '../src/galaxy/viewRoll.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

describe('arah atas kamera di tahap Grup Lokal', () => {
  it('pertama kali (belum ada arah sebelumnya) disamakan dengan arah acuan, seperti sebelumnya', () => {
    expect(alignRoll(v(0, -1, 0), null, v(0, 1, 0)).toArray()).toEqual([-0, 1, -0]);
    expect(alignRoll(v(1, 0.2, 0), null, v(0, 1, 0)).toArray()).toEqual([1, 0.2, 0]);
  });

  it('setelah itu ikut arah frame sebelumnya, walaupun arah acuannya sudah di sisi lain (gak membalik 180 derajat)', () => {
    const previous = v(1, 0.01, 0).normalize();
    // Kamera diputar sedikit: calon arah atas baru hampir sama dengan sebelumnya, tapi dot-nya dengan
    // arah acuan (kutub utara galaksi) sudah lewat nol. Aturan lama membaliknya
    const candidate = v(1, -0.01, 0).normalize();
    const result = alignRoll(candidate.clone(), previous, v(0, 1, 0));
    expect(result.dot(previous)).toBeGreaterThan(0.99);
  });

  it('calon yang terhitung terbalik dari frame sebelumnya dibalik lagi supaya tetap nyambung', () => {
    const result = alignRoll(v(-1, 0, 0), v(1, 0.05, 0).normalize(), v(0, -1, 0));
    expect(result.x).toBe(1);
  });
});

describe('peralihan arah atas waktu masuk / keluar tahap Grup Lokal', () => {
  const axis = v(0, 0, -1);

  it('t = 0 arah asal, t = 1 arah tujuan', () => {
    const from = v(0, 1, 0);
    const to = v(1, 0, 0);
    expect(blendRoll(from, to, 0, axis, v()).distanceTo(from)).toBeLessThan(1e-9);
    expect(blendRoll(from, to, 1, axis, v()).distanceTo(to)).toBeLessThan(1e-9);
  });

  it('dua arah yang berlawanan tetap berputar mulus, gak lewat vektor nol (lerp biasa jadi nol di tengah)', () => {
    const from = v(0, 1, 0);
    const to = v(0, -1, 0.000001).normalize();
    let previous = from.clone();
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const result = blendRoll(from, to, t, axis, v());
      expect(result.length()).toBeCloseTo(1, 9);
      // tiap langkah 5% dari 180 derajat = 9 derajat
      expect(result.angleTo(previous)).toBeLessThan((10 * Math.PI) / 180);
      previous = result;
    }
  });
});

describe('arah atas waktu kamera hampir melihat sepanjang acuan atasnya', () => {
  it('jauh dari sejajar: hasilnya persis acuan yang diproyeksikan, arah frame sebelumnya gak berpengaruh', () => {
    const view = v(0, 0, -1);
    const result = stabilizeRoll(v(0, 1, 0.3), v(1, 0, 0), view, v());
    expect(result.distanceTo(v(0, 1, 0))).toBeLessThan(1e-9);
  });

  it('pas sejajar (acuan gak bisa menentukan putaran): pertahankan arah frame sebelumnya', () => {
    const view = v(0, -1, 0);
    const result = stabilizeRoll(v(0, 1, 0), v(1, 0, 0), view, v());
    expect(result.distanceTo(v(1, 0, 0))).toBeLessThan(1e-9);
  });

  it('kamera menyapu lewat dekat kutub acuan: putarannya berubah sedikit demi sedikit, gak berayun', () => {
    const desired = v(0, 1, 0);
    // Sebelum mendekati kutub, arah atas kamera sudah selaras dengan acuannya (proyeksi acuan di arah awal)
    const start = v(-0.05, -1, 0.002).normalize();
    let previous = desired.clone().addScaledVector(start, -desired.dot(start)).normalize();
    // Arah pandang lewat 0,1 derajat dari kutub. Proyeksi acuannya berputar hampir 180 derajat di sini
    for (let x = -0.05; x <= 0.05; x += 0.001) {
      const view = v(x, -1, 0.002).normalize();
      // Batas putaran 4 derajat per panggilan, sama dengan yang dipakai kamera galaksi di 60 fps
      const result = stabilizeRoll(desired, previous, view, v(), (4 * Math.PI) / 180);
      expect(result.length()).toBeCloseTo(1, 9);
      expect(Math.abs(result.dot(view))).toBeLessThan(1e-9);
      expect(result.angleTo(previous)).toBeLessThan((6 * Math.PI) / 180);
      previous = result;
    }
  });
});
