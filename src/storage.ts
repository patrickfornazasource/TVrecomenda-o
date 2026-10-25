// Dados da usuária, salvos só no aparelho (localStorage). Sem login, sem servidor.
import type { MoodStats } from './engine/perguntas';
import type { Profile, UserEvent } from './engine/types';

const KEY = 'escolhe-pra-mim:v1';

export interface Stored {
  onboarded: boolean;
  profile: Profile | null;
  events: UserEvent[];
  decided?: { titleId: number; at: number };
  lastCompany?: string;
  moodStats?: MoodStats; // o que ela costuma aceitar, para a primeira pergunta
}

const EMPTY: Stored = { onboarded: false, profile: null, events: [] };

export function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

export function save(s: Stored) {
  try {
    // guarda no máximo 2000 eventos, os mais recentes
    const events = s.events.length > 2000 ? s.events.slice(-2000) : s.events;
    localStorage.setItem(KEY, JSON.stringify({ ...s, events }));
  } catch {
    // sem armazenamento (modo privado): o app continua funcionando nesta sessão
  }
}

/** "Hoje à noite": a decisão vale até as 5h da manhã seguinte. */
export function decidedTonight(s: Stored, now = Date.now()): number | null {
  if (!s.decided) return null;
  const cut = new Date(now);
  if (cut.getHours() < 5) cut.setDate(cut.getDate() - 1);
  cut.setHours(5, 0, 0, 0);
  return s.decided.at >= cut.getTime() ? s.decided.titleId : null;
}

export function savedIds(events: UserEvent[]): number[] {
  const set = new Map<number, number>();
  for (const e of events) {
    if (e.action === 'saved') set.set(e.titleId, e.timestamp);
    else if (e.action === 'unsaved' || e.action === 'accepted' || e.action === 'seen') set.delete(e.titleId);
  }
  return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
