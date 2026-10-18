'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Signal, type SignalSide } from '@/database/models/signal.model';
import { getSession } from '@/lib/better-auth/auth';

export type SignalRow = {
    id: string;
    bot: string;
    symbol: string;
    pairSymbol: string | null;
    side: SignalSide;
    strength: number | null;
    price: number | null;
    stop: number | null;
    note: string | null;
    createdAt: string;
};

export type SignalsResult =
    | { status: 'ok'; latest: SignalRow[]; history: SignalRow[] }
    | { status: 'forbidden' }
    | { status: 'error'; message: string };

const HISTORY_LIMIT = 200;

// Signals are private trading output. Anyone can sign up to an OpenStock instance, so only the emails listed in
// SIGNALS_ALLOWED_EMAILS (comma-separated) may see them. Unset means nobody can.
function isAllowed(email?: string | null) {
    if (!email) return false;
    const allowed = (process.env.SIGNALS_ALLOWED_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return allowed.includes(email.toLowerCase());
}

const toRow = (d: Record<string, unknown>): SignalRow => ({
    id: String(d._id),
    bot: String(d.bot ?? ''),
    symbol: String(d.symbol ?? ''),
    pairSymbol: (d.pairSymbol as string) ?? null,
    side: d.side as SignalSide,
    strength: typeof d.strength === 'number' ? d.strength : null,
    price: typeof d.price === 'number' ? d.price : null,
    stop: typeof d.stop === 'number' ? d.stop : null,
    note: (d.note as string) ?? null,
    createdAt: new Date(d.createdAt as Date).toISOString(),
});

export async function getSignals(): Promise<SignalsResult> {
    const session = await getSession();
    if (!isAllowed(session?.user?.email)) return { status: 'forbidden' };

    try {
        await connectToDatabase();
        const docs = await Signal.find({}).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean();
        const history = docs.map((d) => toRow(d as unknown as Record<string, unknown>));

        // Newest signal per bot + symbol (+ pair leg): what each bot currently thinks.
        const seen = new Set<string>();
        const latest = history.filter((s) => {
            const key = `${s.bot}|${s.symbol}|${s.pairSymbol ?? ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return { status: 'ok', latest, history };
    } catch (error) {
        console.error('Error loading signals:', error);
        return { status: 'error', message: 'Could not load signals from the database.' };
    }
}
