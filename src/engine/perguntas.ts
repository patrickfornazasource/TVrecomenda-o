// Perguntas de sim ou não: ela só reage, não precisa saber o gênero que quer.
// A primeira pergunta é o tipo que ela mais aceita; se disser Não, afunila em até 3 perguntas.
import type { Mood } from './types';

export type Node = 'fav' | 'leve' | 'rir' | 'amor' | 'tensa' | 'susto' | 'emocionar';

/** Os nomes das perguntas não podem coincidir com nomes de gênero (Mood). Para onde vai cada resposta: outra pergunta, ou o gênero escolhido (null = o app escolhe). */
export const TREE: Record<Exclude<Node, 'fav'>, { sim: Node | Mood; nao: Node | Mood | null }> = {
  leve: { sim: 'rir', nao: 'tensa' },
  rir: { sim: 'comedia', nao: 'amor' },
  amor: { sim: 'romance', nao: 'relaxar' },
  tensa: { sim: 'susto', nao: 'emocionar' },
  susto: { sim: 'terror', nao: 'adrenalina' }, // ação e suspense juntos
  emocionar: { sim: 'drama', nao: null },
};

/** Gêneros que podem ser o "favorito" da primeira pergunta. */
export const FAV_MOODS: Mood[] = ['comedia', 'romance', 'drama', 'acao', 'suspense', 'desenho', 'novela', 'ficcao'];

/** O que ela já mostrou que gosta: tipos marcados em "Meu gosto" e gêneros das escolhas aceitas. */
export interface MoodStats {
  accepted: Partial<Record<Mood, number>>; // noites em que aceitou um título desse gênero
  refused: Partial<Record<Mood, number>>; // vezes que disse Não à pergunta do favorito
}

export const emptyStats = (): MoodStats => ({ accepted: {}, refused: {} });

/** O gênero da primeira pergunta, ou null quando ainda não sabemos nada dela. */
export function favorite(stats: MoodStats, picks: string[] = []): Mood | null {
  let best: Mood | null = null;
  let bestScore = 0;
  for (const m of FAV_MOODS) {
    const score = (picks.includes(m) ? 1 : 0) + (stats.accepted[m] ?? 0) - 0.5 * (stats.refused[m] ?? 0);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}

export function firstNode(stats: MoodStats, picks?: string[]): Node {
  return favorite(stats, picks) ? 'fav' : 'leve';
}

/** Cada Não ao favorito tira meio ponto dele, e a próxima noite pode começar por outro gênero. */
export function recordFav(stats: MoodStats, mood: Mood, answer: 'sim' | 'nao'): MoodStats {
  if (answer === 'sim') return stats;
  return { ...stats, refused: { ...stats.refused, [mood]: (stats.refused[mood] ?? 0) + 1 } };
}

export function recordAccepted(stats: MoodStats, mood: Mood | undefined): MoodStats {
  if (!mood || !FAV_MOODS.includes(mood)) return stats;
  // um aceite também zera metade das recusas daquele gênero
  const refused = { ...stats.refused, [mood]: Math.floor((stats.refused[mood] ?? 0) / 2) };
  return { accepted: { ...stats.accepted, [mood]: (stats.accepted[mood] ?? 0) + 1 }, refused };
}

/** Próximo passo depois de uma resposta: outra pergunta ou o gênero final. */
export function step(node: Exclude<Node, 'fav'>, a: 'sim' | 'nao'): { node: Node } | { mood: Mood | undefined } {
  const next = TREE[node][a];
  if (next && next in TREE) return { node: next as Node };
  return { mood: (next ?? undefined) as Mood | undefined };
}
