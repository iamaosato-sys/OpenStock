import { describe, it, expect } from 'vitest';
import { stockTopicsFor } from '@/lib/prediction-markets/relevance';
import { filterEvents, normalizeKalshi, normalizePolymarket } from '@/lib/prediction-markets/fetch';

describe('stock relevance', () => {
    it('keeps rates, earnings, tariffs and AI', () => {
        expect(stockTopicsFor('Fed decision in December?')).toContain('economy');
        expect(stockTopicsFor('Will Nvidia beat earnings?')).toEqual(expect.arrayContaining(['companies', 'technology']));
        expect(stockTopicsFor('New tariffs on China by June?')).toContain('policy');
    });

    it('drops sport, celebrity, trivia and crypto price bets', () => {
        expect(stockTopicsFor('NBA Finals winner')).toEqual([]);
        expect(stockTopicsFor('Will Taylor Swift get married?')).toEqual([]);
        expect(stockTopicsFor('Will Elon Musk tweet the word Mars?')).toEqual([]);
        expect(stockTopicsFor('Bitcoin above $150k by Friday?')).toEqual([]);
    });

    it('keeps a corporate question even with a sport word', () => {
        expect(stockTopicsFor('Will Nike CEO resign after the World Cup?')).toContain('companies');
    });

    it('falls back to tags when the title is plain', () => {
        expect(stockTopicsFor('NVDA above $264?', '', ['Stocks', 'Equities'])).toEqual(['companies']);
    });
});

describe('normalisers', () => {
    it('reads a Polymarket event with JSON-string outcomes', () => {
        const e = normalizePolymarket({
            id: '1', slug: 'what-price-will-nvda-hit', title: 'What will NVIDIA (NVDA) hit in November?', volume24hr: 1200,
            endDate: '2026-12-01T04:59:59Z', tags: [{ label: 'Stocks' }],
            markets: [
                { question: 'Will NVIDIA (NVDA) hit $264?', outcomes: '["Yes", "No"]', outcomePrices: '["0.0105", "0.9895"]', groupItemTitle: '↑ $264' },
                { question: 'closed one', closed: true, outcomes: '["Yes","No"]', outcomePrices: '["1","0"]' },
            ],
        })!;
        expect(e.url).toBe('https://polymarket.com/event/what-price-will-nvda-hit');
        expect(e.markets).toHaveLength(1);
        expect(e.markets[0].yes).toBeCloseTo(0.0105);
    });

    it('reads Kalshi dollars and falls back to cents', () => {
        const e = normalizeKalshi({
            event_ticker: 'KXFEDDECISION-26DEC', series_ticker: 'KXFEDDECISION', title: 'Fed decision in Dec 2026', category: 'Economics',
            markets: [
                { yes_sub_title: 'Cut 25bps', status: 'active', yes_bid_dollars: '0.60', yes_ask_dollars: '0.62', volume_24h: 500 },
                { yes_sub_title: 'Hold', status: 'active', last_price: 35 },
            ],
        })!;
        expect(e.url).toBe('https://kalshi.com/markets/kxfeddecision');
        expect(e.markets[0].yes).toBeCloseTo(0.61);
        expect(e.markets[1].yes).toBeCloseTo(0.35);
    });

    it('filters by search text and topic', () => {
        const ev = [normalizeKalshi({ event_ticker: 'A', title: 'Fed decision', markets: [{ yes_sub_title: 'Cut', status: 'active' }] })!];
        expect(filterEvents(ev, 'fed', '')).toHaveLength(1);
        expect(filterEvents(ev, 'nvidia', '')).toHaveLength(0);
        expect(filterEvents(ev, '', 'energy')).toHaveLength(0);
    });
});
