import { Schema, model, models, type Document, type Model } from 'mongoose';

// Written by the Python trading bots (momentum_bot, pairs_bot) through signals_writer.py; OpenStock only reads.
// Keep the field names in step with that writer.
export type SignalSide = 'long' | 'short' | 'exit' | 'flat';

export interface SignalDoc extends Document {
    bot: string;
    symbol: string;
    pairSymbol?: string | null;
    side: SignalSide;
    strength?: number | null;
    price?: number | null;
    stop?: number | null;
    note?: string | null;
    meta?: Record<string, unknown>;
    createdAt: Date;
}

const SignalSchema = new Schema<SignalDoc>(
    {
        bot: { type: String, required: true, trim: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
        pairSymbol: { type: String, uppercase: true, trim: true, default: null },
        side: { type: String, required: true, enum: ['long', 'short', 'exit', 'flat'] },
        strength: { type: Number, default: null },
        price: { type: Number, default: null },
        stop: { type: Number, default: null },
        note: { type: String, default: null },
        meta: { type: Schema.Types.Mixed, default: {} },
        createdAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: false, collection: 'signals' }
);

export const Signal: Model<SignalDoc> =
    (models?.Signal as Model<SignalDoc>) || model<SignalDoc>('Signal', SignalSchema);
