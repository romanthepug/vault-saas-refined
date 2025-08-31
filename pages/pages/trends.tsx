import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

/* -------------------------------------------------
   CONFIG & TYPES
-------------------------------------------------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

interface Trend {
  id: string;
  name: string;
  platform: 'tiktok' | 'etsy' | 'gumroad';
  velocity: number;
  profitScore: number;
  priceLadder: number[];
  cogs: number;
  fees: number;
  shipping: number;
  margin: number;
  createdAt: string;
}

/* -------------------------------------------------
   UTILITY: PROFIT FLOOR
-------------------------------------------------- */
function computeMargin(price: number, cogs: number, fees: number, shipping: number): number {
  return ((price - cogs - fees - shipping) / price) * 100;
}

function generatePriceLadder(cogs: number, fees: number, shipping: number): number[] {
  const base = cogs + fees + shipping;
  return [base * 1.3, base * 1.6, base * 2.0].map(p => Math.round(p * 100) / 100);
}

/* -------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------- */
export default function Trends() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<Trend | null>(null);

  /* ---------- 1. Fetch live data ---------- */
  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    /* MOCK: replace with real TikTok/Etsy/Gumroad calls */
    const mockData: Omit<Trend, 'id' | 'createdAt'>[] = [
      { name: '#LEDcollars', platform: 'tiktok', velocity: 450, cogs: 2.5, fees: 0.8, shipping: 1.2 },
      { name: '#tinyhats', platform: 'etsy', velocity: 310, cogs: 1.8, fees: 0.6, shipping: 1.0 },
      { name: '#AIstickers', platform: 'gumroad', velocity: 280, cogs: 0.5, fees: 0.3, shipping: 0.2 },
    ];

    const enriched = mockData.map((d, idx) => {
      const ladder = generatePriceLadder(d.cogs, d.fees, d.shipping);
      const margin = computeMargin(ladder[0], d.cogs, d.fees, d.shipping);
      return {
        ...d,
        id: `mock-${idx}`,
        velocity: d.velocity,
        profitScore: Math.min(100, Math.round(d.velocity * 0.2 + margin * 2)),
        priceLadder: ladder,
        margin,
        createdAt: new Date().toISOString(),
      };
    });

    /* Persist to Supabase */
    await supabase.from('trends').upsert(enriched, { onConflict: 'name' });
    const { data } = await supabase.from('trends').select('*').order('profitScore', { ascending: false });
    setTrends(data || []);
    setLoading(false);
  }, []);

  /* ---------- 2. UI ---------- */
  return (
    <div className="min-h-screen bg-dark text-white p-8">
      <header className="mb-6">
        <h1 className="text-4xl font-bold text-neon">Trend Scope</h1>
        {loading && <p className="text-sm text-gray-400 mt-2">Loading live data…</p>}
      </header>

      {/* Chart */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Velocity vs Profit Score</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#00f5ff' }}
            />
            <Line type="monotone" dataKey="velocity" stroke="#00f5ff" strokeWidth={2} />
            <Line type="monotone" dataKey="profitScore" stroke="#8b5cf6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-800 rounded">
          <thead>
            <tr>
              <th className="px-4 py-2">Trend</th>
              <th className="px-4 py-2">Platform</th>
              <th className="px-4 py-2">Velocity</th>
              <th className="px-4 py-2">Profit Score</th>
              <th className="px-4 py-2">Price Ladder</th>
              <th className="px-4 py-2">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((t) => (
              <tr key={t.id} className="hover:bg-gray-700" onClick={() => setSelected(t)}>
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2">{t.platform}</td>
                <td className="px-4 py-2">{t.velocity}</td>
                <td className="px-4 py-2">{t.profitScore}</td>
                <td className="px-4 py-2">{t.priceLadder.join(' → ')}</td>
                <td className="px-4 py-2">{t.margin.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected detail */}
      {selected && (
        <div className="mt-8 p-6 bg-gray-800 rounded">
          <h3 className="text-xl font-bold text-neon mb-2">{selected.name}</h3>
          <p className="text-sm">
            {selected.platform} trend with velocity {selected.velocity}. Suggested price ladder:{' '}
            {selected.priceLadder.join(' → ')} achieving {selected.margin.toFixed(1)}% margin.
          </p>
          <button className="mt-4 bg-neon text-black px-4 py-2 rounded">
            Generate Pitch & Ladder
          </button>
        </div>
      )}
    </div>
  );
}
