import { describe, expect, it } from 'vitest';
import { overviewFit, overviewElevation, overviewPositionAt } from '../src/scene/scaleMode.js';
import { OVERVIEW_POSITION } from '../src/controls/cameraRig.js';

const degrees = (radians) => (radians * 180) / Math.PI;

describe('framing kamera overview', () => {
  it('layar lebar dan laptop tetap persis posisi overview lama', () => {
    for (const aspect of [16 / 9, 16 / 10, 1440 / 900, 2.2]) {
      const position = overviewPositionAt(0, overviewFit(aspect));
      expect(position.x).toBe(0);
      expect(position.y / position.z).toBeCloseTo(OVERVIEW_POSITION.y / OVERVIEW_POSITION.z, 10);
    }
  });

  it('HP portrait: kamera naik sampai 52 derajat biar tata suryanya gak jadi pita tipis', () => {
    const fit = overviewFit(390 / 844);
    expect(degrees(overviewElevation(fit))).toBeCloseTo(52, 5);
    const position = overviewPositionAt(0, fit);
    expect(degrees(Math.atan2(position.y, position.z))).toBeCloseTo(52, 5);
  });

  it('jarak kamera gak berubah (zoomLevel dan batas zoom tetap), cuma sudutnya', () => {
    for (const aspect of [0.46, 0.75, 1.2, 1.78]) {
      const fit = overviewFit(aspect);
      expect(overviewPositionAt(0, fit).length()).toBeCloseTo(OVERVIEW_POSITION.length() * fit, 8);
    }
  });

  it('sudutnya naik bertahap makin sempit layarnya, gak loncat (paling 5 derajat tiap rasio turun 0,05)', () => {
    let previous = overviewElevation(overviewFit(2));
    for (let aspect = 1.95; aspect >= 0.4; aspect -= 0.05) {
      const elevation = overviewElevation(overviewFit(aspect));
      expect(elevation).toBeGreaterThanOrEqual(previous - 1e-12);
      expect(degrees(elevation - previous)).toBeLessThan(5);
      previous = elevation;
    }
  });
});
