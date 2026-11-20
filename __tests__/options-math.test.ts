import { describe, it, expect } from 'vitest';
import { bsPrice, greeks, impliedVol, normCdf, parseOcc, yearsToExpiry } from '@/lib/options-math';

describe('options math', () => {
    it('matches the Hull textbook example', () => {
        expect(bsPrice('call', 42, 40, 0.5, 0.2, 0.1)).toBeCloseTo(4.76, 2);
        expect(bsPrice('put', 42, 40, 0.5, 0.2, 0.1)).toBeCloseTo(0.81, 2);
    });

    it('normal cdf is accurate', () => {
        expect(normCdf(0)).toBeCloseTo(0.5, 7);
        expect(normCdf(1.96)).toBeCloseTo(0.9750021, 6);
    });

    it('respects put-call parity', () => {
        const [S, K, T, v, r] = [100, 90, 1, 0.3, 0.04];
        const c = bsPrice('call', S, K, T, v, r)!, p = bsPrice('put', S, K, T, v, r)!;
        expect(c - p).toBeCloseTo(S - K * Math.exp(-r * T), 6);
    });

    it('greeks match finite differences', () => {
        const [S, K, T, v] = [100, 105, 0.4, 0.25], h = 1e-3;
        const g = greeks('put', S, K, T, v)!;
        const p = (s = S, t = T, vol = v) => bsPrice('put', s, K, t, vol)!;
        expect(g.delta).toBeCloseTo((p(S + h) - p(S - h)) / (2 * h), 4);
        expect(g.vega).toBeCloseTo((p(S, T, v + h) - p(S, T, v - h)) / (2 * h) / 100, 4);
        expect(g.theta).toBeCloseTo(-(p(S, T + h) - p(S, T - h)) / (2 * h) / 365, 4);
    });

    it('implied vol round-trips and rejects impossible prices', () => {
        const price = bsPrice('call', 100, 110, 0.5, 0.42)!;
        expect(impliedVol('call', price, 100, 110, 0.5)).toBeCloseTo(0.42, 4);
        expect(impliedVol('call', 5, 100, 80, 0.5)).toBeNull();
    });

    it('parses OCC symbols', () => {
        expect(parseOcc('AAPL261218C00150000')).toEqual({ root: 'AAPL', expiry: '2026-12-18', kind: 'call', strike: 150 });
        expect(parseOcc('SPY261120P00592500')?.strike).toBe(592.5);
        expect(parseOcc('nonsense')).toBeNull();
    });

    it('expiry uses the New York close', () => {
        const now = Date.UTC(2026, 11, 18, 20); // 15:00 EST
        expect(yearsToExpiry('2026-12-18', now)!).toBeCloseTo(1 / (365 * 24), 8);
    });
});
