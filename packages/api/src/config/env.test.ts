import { describe, it, expect } from 'vitest';
import { PLATFORM_FEES } from './env.js';

describe('PLATFORM_FEES', () => {
  it('exposes the correct default platform fee per category (EGP)', () => {
    expect(PLATFORM_FEES.restaurant).toBe(25);
    expect(PLATFORM_FEES.salon).toBe(15);
    expect(PLATFORM_FEES.court).toBe(35);
    expect(PLATFORM_FEES.gaming_cafe).toBe(20);
    expect(PLATFORM_FEES.car_wash).toBe(20);
  });

  // Documents WHY the booking engine must use `PLATFORM_FEES[cat] ?? 25`:
  // an unknown / removed category (post gaming-only pivot) yields undefined.
  it('returns undefined for an unknown or removed category', () => {
    expect(PLATFORM_FEES['spa']).toBeUndefined();
    expect(PLATFORM_FEES['']).toBeUndefined();
  });
});
