import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { v4 as uuid } from 'uuid';

/* -------------------------------------------------
   CONFIG & TYPES
-------------------------------------------------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);
const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY, dangerouslyAllowBrowser: true });

interface Goal {
  id: string;
  text: string;
  created_at: string;
  screenshots: string[];
}

interface CalendarEvent {
  id: string;
  date: string;
  amount: number;
  source: string;
}

/* -------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------- */
export default function Dashboard() {
  const [goal, setGoal] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [coachMessage, setCoachMessage] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);

  /* ---------- 1. Load data ---------- */
  useEffect(() => {
    fetchGoals();
    fetchCalendarEvents();
  }, []);

  async function fetchGoals() {
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false });
    if (data) setGoals(data);
  }

  async function fetchCalendarEvents() {
    const { data } = await supabase.from('calendar_events').select('*').order('date', { ascending: false });
    if (data) setEvents(data);
  }

  /* ---------- 2. Save goal + coach ---------- */
  async function handleSaveGoal(e: FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    const id = uuid();
    await supabase.from('goals').insert({ id, text: goal, screenshots });
    await generateCoachMessage(goal);
    setGoal('');
    setScreenshots([]);
    fetchGoals();
  }

  async function generateCoachMessage(text: string) {
    const prompt = `User goal: ${text}.  Give a 1-sentence motivational pep talk + 3 micro-tasks.`;
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
    });
    setCoachMessage(res.choices[0]?.message?.content || '');
  }

  /* ---------- 3. File upload ---------- */
  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const { data, error } = await supabase.storage.from('screenshots').upload(`${uuid()}`, files[i]);
      if (data) urls.push(data.path);
    }
    setScreenshots(urls);
    setUploading(false);
  }

  /* ---------- 4. Calendar ---------- */
  async function addCalendarEvent(amount: number, source: string) {
    const id = uuid();
    await supabase.from('calendar_events').insert({ id, date: new Date().toISOString(), amount, source });
    fetchCalendarEvents();
  }

  /* ---------- 5. UI ---------- */
  return (
    <div className="min-h-screen bg-dark text-white p-8">
      <header className="mb-6">
        <h1 className="text-4xl font-bold text-neon">Money-Memory AI</h1>
        {coachMessage && <p className="text-sm text-accent mt-2">{coachMessage}</p>}
      </header>

      {/* Goal form */}
      <form onSubmit={handleSaveGoal} className="mb-8">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. $300/day LED collars"
          className="w-full md:w-1/2 p-3 rounded text-black"
        />
        <button className="ml-2 bg-neon text-black px-6 py-3 rounded font-bold">Lock Goal</button>
      </form>

      {/* File upload */}
      <div className="mb-8">
        <input type="file" multiple accept="image/*" onChange={handleFileUpload} />
        {uploading && <p className="text-sm mt-2">Uploading…</p>}
      </div>

      {/* Calendar */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Calendar</h2>
        <div className="bg-gray-800 p-4 rounded max-w-md">
          {events.map((e) => (
            <div key={e.id} className="flex justify-between mb-2">
              <span>{new Date(e.date).toLocaleDateString()}</span>
              <span>${e.amount} from {e.source}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Goals history */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Goal History</h2>
        <ul>
          {goals.map((g) => (
            <li key={g.id} className="mb-2">
              {g.text} — {g.screenshots.length} attachments
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
