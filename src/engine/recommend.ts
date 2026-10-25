// Motor de decisão (briefing, seção 5): pontuação por conteúdo, sem machine learning.
// Módulo puro: não depende da interface nem do armazenamento.
import { temaAdjust, temaWhy } from './temas';
import type { Catalog, Context, Item, Mood, Pick, Profile, Reason, Result, TimeBudget, UserEvent } from './types';

const DAY = 24 * 60 * 60 * 1000;
export const REJECT_BLOCK_DAYS = 14; // recusado há menos que isso: nunca aparece
export const REJECT_PENALTY_DAYS = 60; // até isso: penalidade forte

const W = { perfil: 0.35, clima: 0.3, qualidade: 0.15, tempo: 0.1, companhia: 0.1 };

// Clima -> gêneros que pontuam (peso 0..1)
const MOOD_GENRES: Record<Exclude<Mood, 'nostalgia'>, Record<string, number>> = {
  rir: { Comedy: 1, Family: 0.6 },
  relaxar: { Comedy: 1, Animation: 0.8, Family: 0.8, Romance: 0.8 },
  emocionar: { Drama: 1, Romance: 0.8, History: 0.7, Soap: 0.6 },
  adrenalina: { Action: 1, Thriller: 0.9, Adventure: 0.8 },
  misterio: { Mystery: 1, Crime: 0.8, Thriller: 0.8 },
  romance: { Romance: 0.8 },
  familia: { Family: 1, Animation: 0.9, Kids: 0.8 },
  terror: { Horror: 1 },
  comedia: { Comedy: 1 },
  drama: { Drama: 1, History: 0.6 },
  acao: { Action: 1, Adventure: 0.9, War: 0.6, Western: 0.6 },
  suspense: { Thriller: 1, Mystery: 1, Crime: 0.9 },
  desenho: { Animation: 1, Family: 0.8, Kids: 0.8 },
  novela: { Soap: 1 },
  ficcao: { 'Science Fiction': 1, Fantasy: 1 },
};
const MOOD_AVOID: Partial<Record<Mood, string[]>> = {
  relaxar: ['Horror', 'War', 'Crime', 'Thriller'],
  rir: ['War'],
  familia: ['Horror', 'Crime', 'War', 'Thriller'],
  comedia: ['War'],
  desenho: ['Horror', 'Crime', 'War', 'Thriller'],
};
const PICK_NAME: Record<string, string> = {
  comedia: 'comédia',
  romance: 'romance',
  drama: 'drama',
  acao: 'ação',
  suspense: 'suspense',
  desenho: 'desenho',
  novela: 'novela',
  ficcao: 'fantasia',
};
const FAMILY_BLOCK = ['Horror', 'Crime', 'War', 'Thriller'];
const KID_SAFE = ['Family', 'Kids']; // Animation sozinha não basta (ex.: Anomalisa)

export interface Prepared {
  catalog: Catalog;
  byId: Map<number, Item>;
  idfGenre: number[];
  idfKw: Map<string, number>;
}

export function prepare(catalog: Catalog): Prepared {
  const n = catalog.items.length;
  const dfG = new Array(catalog.genres.length).fill(0);
  const dfK = new Map<string, number>();
  for (const it of catalog.items) {
    for (const g of it.g) dfG[g]++;
    for (const w of it.w ?? []) dfK.set(w, (dfK.get(w) ?? 0) + 1);
  }
  const idfGenre = dfG.map((d) => Math.log((n + 1) / (d + 1)) + 1);
  const idfKw = new Map<string, number>();
  for (const [w, d] of dfK) idfKw.set(w, Math.log((n + 1) / (d + 1)) + 1);
  return { catalog, byId: new Map(catalog.items.map((it) => [it.i, it])), idfGenre, idfKw };
}

const genreNames = (p: Prepared, it: Item) => it.g.map((g) => p.catalog.genres[g]);

// ---------- Perfil ----------

export function emptyProfile(): Profile {
  return { genres: {}, keywords: {}, brazil: 0, liked: [] };
}

/** Soma (ou subtrai, com sign < 0) o vetor de um título ao perfil. */
export function addToProfile(p: Prepared, profile: Profile, it: Item, sign = 1): Profile {
  const genres = { ...profile.genres };
  const keywords = { ...profile.keywords };
  const names = genreNames(p, it);
  it.g.forEach((g, idx) => {
    const name = p.catalog.genres[g];
    const w = (p.idfGenre[g] * sign) / Math.sqrt(names.length) * (idx === 0 ? 1.2 : 1);
    genres[name] = (genres[name] ?? 0) + w;
  });
  for (const k of it.w ?? []) keywords[k] = (keywords[k] ?? 0) + (p.idfKw.get(k) ?? 1) * sign * 0.5;
  let brazil = profile.brazil;
  if (sign > 0) brazil = Math.min(1, brazil + (it.br ? 0.2 : -0.03));
  return { ...profile, genres, keywords, brazil: Math.max(0, brazil) };
}

/** Perfil a partir dos tipos que ela marcou em "Meu gosto" (sem precisar conhecer títulos). */
export function buildProfileFromPicks(p: Prepared, picks: string[]): Profile {
  const genres: Record<string, number> = {};
  for (const pick of picks) {
    const table = (MOOD_GENRES as Record<string, Record<string, number>>)[pick];
    if (!table) continue;
    for (const [g, w] of Object.entries(table)) {
      const idx = p.catalog.genres.indexOf(g);
      genres[g] = (genres[g] ?? 0) + w * (idx >= 0 ? p.idfGenre[idx] : 1);
    }
  }
  return { genres, keywords: {}, brazil: picks.includes('brasil') ? 0.7 : 0, liked: [], picks: [...picks] };
}

export function buildProfile(p: Prepared, likedIds: number[]): Profile {
  let profile = emptyProfile();
  for (const id of likedIds) {
    const it = p.byId.get(id);
    if (it) profile = addToProfile(p, profile, it);
  }
  return { ...profile, liked: [...likedIds] };
}

function norm(v: Record<string, number>): number {
  let s = 0;
  for (const k in v) s += v[k] * v[k];
  return Math.sqrt(s);
}

/** 0..1: quanto o título se parece com o que ela gosta. Perfil vazio = 0.5 (neutro). */
export function affinity(p: Prepared, profile: Profile, it: Item, pnorm = norm(profile.genres)): number {
  if (pnorm === 0) return 0.5;
  let dot = 0;
  let inorm = 0;
  for (const g of it.g) {
    const w = p.idfGenre[g];
    dot += w * (profile.genres[p.catalog.genres[g]] ?? 0);
    inorm += w * w;
  }
  let a = dot / (pnorm * Math.sqrt(inorm)); // cosseno, -1..1
  a = (a + 0.2) / 1.2; // leva para ~0..1 sem castigar demais quem não tem gênero em comum
  if (it.w?.length) {
    let kw = 0;
    for (const k of it.w) kw += profile.keywords[k] ?? 0;
    a += Math.max(-0.2, Math.min(0.25, kw / 20));
  }
  if (it.br && profile.brazil > 0) a += 0.15 * profile.brazil;
  return clamp01(a);
}

// ---------- Componentes da pontuação ----------

export function moodFit(names: string[], it: Item, mood?: Mood): number {
  if (!mood) return 0.5;
  if (mood === 'nostalgia') {
    if (it.y <= 1995) return 1;
    if (it.y <= 2005) return 0.45;
    return 0;
  }
  const table = MOOD_GENRES[mood];
  const ws = names.map((n) => table[n] ?? 0).filter((w) => w > 0);
  if (!ws.length) return 0;
  // o gênero principal pesa mais: "O Lado Bom da Vida" é mais "Rir" do que "Emocionar"
  let fit = 0.7 * Math.max(...ws) + 0.3 * (table[names[0]] ?? 0) + 0.15 * (ws.length - 1);
  if (mood === 'romance' && (names.includes('Comedy') || names.includes('Drama'))) fit += 0.2;
  return clamp01(fit);
}

export function quality(it: Item): number {
  if (it.n != null) {
    const base = clamp01((it.n - 5) / 3.5);
    const votes = Math.min(1, Math.log10((it.v ?? 0) + 1) / 4); // 10 mil votos = 1
    return clamp01(0.85 * base + 0.15 * votes);
  }
  if (it.q === 'B') return it.k === 's' ? 0.7 : 0.6; // listas curadas
  return 0.4; // sem nota: neutro para baixo
}

export function timeFit(it: Item, time?: TimeBudget, maxRuntime?: number): number | null {
  const limit = Math.min(maxRuntime ?? Infinity, time === 'curto' ? 95 : time === 'medio' ? 130 : Infinity);
  if (it.k === 'm') {
    if (it.r != null && it.r > limit) return null; // não cabe: elimina
    if (time === 'maratona') return it.r != null && it.r >= 130 ? 0.4 : 0.2;
    return it.r == null ? 0.6 : 1; // sem duração: penalidade leve
  }
  if (time === 'maratona') return 1;
  return 0.3; // dá para ver um episódio, mas filme encaixa melhor
}

export function companyFit(names: string[], company?: Context['company']): number | null {
  const has = (gs: string[]) => names.some((n) => gs.includes(n));
  switch (company) {
    case 'familia':
      // com crianças: só o que é feito para a família
      if (has(FAMILY_BLOCK) || !has(KID_SAFE)) return null;
      return has(['Animation']) ? 1 : 0.85;
    case 'alguem':
      return has(['Romance', 'Comedy', 'Drama']) ? 1 : 0.7;
    case 'amigos':
      return has(['Comedy', 'Action', 'Adventure', 'Thriller', 'Mystery']) ? 1 : 0.6;
    default:
      return 1;
  }
}

// ---------- Recomendação ----------

interface SessionAdjust {
  maxRuntime?: number;
  minYear?: number;
  avoidSeries: boolean;
  genrePenalty: Record<string, number>;
}

function sessionAdjust(p: Prepared, ctx: Context): SessionAdjust {
  const adj: SessionAdjust = { avoidSeries: false, genrePenalty: {} };
  for (const r of ctx.rejections) {
    const it = p.byId.get(r.titleId);
    if (!it) continue;
    const names = genreNames(p, it);
    switch (r.reason) {
      case 'muito_longo':
        if (it.k === 's') adj.avoidSeries = true;
        else if (it.r) adj.maxRuntime = Math.min(adj.maxRuntime ?? Infinity, it.r - 10);
        else adj.maxRuntime = Math.min(adj.maxRuntime ?? Infinity, 110);
        break;
      case 'muito_antigo':
        adj.minYear = Math.max(adj.minYear ?? 0, Math.min(it.y + 8, 2018));
        break;
      case 'nao_curto':
        adj.genrePenalty[names[0]] = (adj.genrePenalty[names[0]] ?? 0) + 0.25;
        for (const n of names.slice(1)) adj.genrePenalty[n] = (adj.genrePenalty[n] ?? 0) + 0.05;
        break;
      case 'nao_e_clima':
        for (const n of names) adj.genrePenalty[n] = (adj.genrePenalty[n] ?? 0) + 0.08;
        break;
    }
  }
  return adj;
}

/** Ids que nunca podem aparecer, e penalidades por recusas antigas. */
export function historyFilter(events: UserEvent[], now: number) {
  const blocked = new Set<number>();
  const penalty = new Map<number, number>();
  const saved = new Set<number>();
  for (const e of events) {
    if (e.action === 'accepted' || e.action === 'seen') blocked.add(e.titleId);
    else if (e.action === 'rejected') {
      const age = now - e.timestamp;
      if (e.reason === 'ja_vi') blocked.add(e.titleId);
      else if (age < REJECT_BLOCK_DAYS * DAY) blocked.add(e.titleId);
      else if (age < REJECT_PENALTY_DAYS * DAY) penalty.set(e.titleId, 0.3);
    } else if (e.action === 'saved') saved.add(e.titleId);
    else if (e.action === 'unsaved') saved.delete(e.titleId);
  }
  return { blocked, penalty, saved };
}

export function scoreAll(p: Prepared, profile: Profile, ctx: Context, events: UserEvent[]) {
  const now = ctx.now ?? Date.now();
  const hist = historyFilter(events, now);
  const adj = sessionAdjust(p, ctx);
  const shown = new Set(ctx.shown);
  const liked = new Set(profile.liked);
  const pnorm = norm(profile.genres);
  const wantsKids = ctx.company === 'familia' || ctx.mood === 'familia' || ctx.mood === 'desenho';
  const out: { item: Item; score: number; names: string[]; m: number }[] = [];

  for (const it of p.catalog.items) {
    if (it.q === 'X') continue;
    if (hist.blocked.has(it.i) || shown.has(it.i) || liked.has(it.i)) continue;
    const names = genreNames(p, it);
    // Terror só se ela pedir
    if (ctx.mood !== 'terror' && names.includes('Horror')) continue;
    if (names.includes('Reality')) continue;
    if (!wantsKids && names.includes('Kids') && !names.some((n) => n !== 'Kids' && n !== 'Animation' && n !== 'Family')) continue;
    const avoid = ctx.mood ? MOOD_AVOID[ctx.mood] : undefined;
    if (avoid && names.some((n) => avoid.includes(n))) continue;
    if (ctx.type && it.k !== ctx.type) continue;
    if (adj.avoidSeries && it.k === 's') continue;
    if (adj.minYear && it.y < adj.minYear) continue;
    if (ctx.era === 'antigo' && it.y > 2005) continue;
    if (ctx.era === 'novo' && it.y < 2010) continue;

    const m = moodFit(names, it, ctx.mood);
    if (m === 0) continue;
    if ((ctx.mood === 'familia' || ctx.mood === 'desenho') && !names.some((n) => KID_SAFE.includes(n))) continue;
    const t = timeFit(it, ctx.time, adj.maxRuntime);
    if (t === null) continue;
    const c = companyFit(names, ctx.company);
    if (c === null) continue;
    const th = temaAdjust(it, ctx.themes);
    if (th === null) continue;

    let score =
      W.perfil * affinity(p, profile, it, pnorm) +
      W.clima * m +
      W.qualidade * quality(it) +
      W.tempo * t +
      W.companhia * c;
    // maratona puxa para séries; nos outros tempos, filmes
    if (ctx.time && (ctx.time === 'maratona') !== (it.k === 's')) score -= 0.15;
    score -= hist.penalty.get(it.i) ?? 0;
    for (const n of names) score -= adj.genrePenalty[n] ?? 0;
    if (hist.saved.has(it.i)) score += 0.08;
    if (!ctx.mood && (names.includes('Documentary') || names.includes('Music'))) score -= 0.1;
    score += th;
    if (!it.s) score -= 0.04; // sem sinopse em português: pesa um pouco menos
    out.push({ item: it, score, names, m });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

const decade = (y: number) => Math.floor(y / 10);

/**
 * Escolhe 1 principal (sorteio ponderado entre os 5 melhores) + até 2 alternativas,
 * diferentes da principal em gênero principal e década sempre que possível.
 */
/** Candidatos para as respostas dadas, afrouxando aos poucos quando não sobra quase nada. */
export function candidatePool(p: Prepared, profile: Profile, ctx: Context, events: UserEvent[]) {
  // Sempre existe uma resposta: se as respostas apertarem demais, afrouxa aos poucos
  // (primeiro os ajustes de recusa da sessão, depois a pergunta extra, por fim o clima)
  const attempts: Context[] = [
    ctx,
    { ...ctx, rejections: ctx.rejections.map((r) => ({ titleId: r.titleId })) },
    { ...ctx, rejections: [], era: undefined, type: undefined },
    { ...ctx, rejections: [], era: undefined, type: undefined, themes: undefined },
    { ...ctx, rejections: [], era: undefined, type: undefined, themes: undefined, time: undefined },
    // o gênero que ela pediu é a última coisa a ceder (com crianças, nunca cede a companhia
    // para terror, suspense ou ação: aí troca o gênero)
    ...(ctx.company === 'familia' && ['terror', 'suspense', 'acao'].includes(ctx.mood ?? '')
      ? []
      : [{ ...ctx, rejections: [], era: undefined, type: undefined, themes: undefined, time: undefined, company: ctx.company === 'familia' ? ('sozinha' as const) : ctx.company }]),
    { ...ctx, rejections: [], era: undefined, type: undefined, themes: undefined, mood: undefined },
    { ...ctx, rejections: [], era: undefined, type: undefined, themes: undefined, time: undefined, mood: undefined },
  ];
  let scored: ReturnType<typeof scoreAll> = [];
  let pool: typeof scored = [];
  for (const attempt of attempts) {
    scored = scoreAll(p, profile, attempt, events);
    // Primeiro as camadas A e B; C só para completar
    pool = scored.filter((s) => s.item.q !== 'C');
    if (pool.length < 3) pool = scored;
    if (pool.length >= 3) break;
  }
  return pool;
}

export function recommend(
  p: Prepared,
  profile: Profile,
  ctx: Context,
  events: UserEvent[],
  rng: () => number = Math.random,
): Result | null {
  const pool = candidatePool(p, profile, ctx, events);
  if (!pool.length) return null;

  const top = pool.slice(0, 5);
  const total = top.reduce((s, x) => s + Math.max(0.01, x.score) ** 3, 0);
  let r = rng() * total;
  let main = top[0];
  for (const x of top) {
    r -= Math.max(0.01, x.score) ** 3;
    if (r <= 0) {
      main = x;
      break;
    }
  }

  const chosen = [main];
  const rest = pool.filter((x) => x !== main);
  const differs = (x: (typeof pool)[0], strict: boolean) =>
    chosen.every((c) =>
      strict
        ? c.names[0] !== x.names[0] && decade(c.item.y) !== decade(x.item.y)
        : c.names[0] !== x.names[0] || decade(c.item.y) !== decade(x.item.y),
    );
  for (const strict of [true, false]) {
    for (const x of rest) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(x) && differs(x, strict)) chosen.push(x);
    }
  }
  for (const x of rest) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(x)) chosen.push(x);
  }

  const toPick = (x: (typeof pool)[0]): Pick => ({ item: x.item, score: x.score, why: explain(p, profile, x.item, ctx) });
  return { main: toPick(chosen[0]), alternatives: chosen.slice(1).map(toPick) };
}

/** Frase curta "por que este": usa um título que ela marcou, se houver um parecido. */
export function explain(p: Prepared, profile: Profile, it: Item, ctx: Context): string {
  let best: Item | undefined;
  let bestShared = 0;
  for (const id of profile.liked) {
    const l = p.byId.get(id);
    if (!l) continue;
    const shared = l.g.filter((g) => it.g.includes(g)).length + (l.g[0] === it.g[0] ? 1 : 0);
    if (shared > bestShared) {
      best = l;
      bestShared = shared;
    }
  }
  if (best && bestShared >= 2) return `Parecido com “${best.t}”, que você curtiu`;
  const tw = temaWhy(it, ctx.themes);
  if (tw) return tw;
  const picked = (profile.picks ?? []).find((pk) => {
    const table = (MOOD_GENRES as Record<string, Record<string, number>>)[pk];
    return pk !== ctx.mood && table && it.g.some((g) => (table[p.catalog.genres[g]] ?? 0) >= 1);
  });
  if (picked) return `Tem ${PICK_NAME[picked] ?? 'o que você gosta'}, que você disse que gosta`;
  if (it.br) return 'Produção brasileira';
  if (it.n != null && it.n >= 7.5) return 'Muito bem avaliado';
  if (ctx.mood === 'nostalgia') return 'Um clássico para matar a saudade';
  return '';
}

/** Ajuste do perfil depois de uma resposta (Vamos nessa = +, recusa por gosto = −). */
export function learn(p: Prepared, profile: Profile, titleId: number, action: 'accepted' | 'liked' | 'disliked'): Profile {
  const it = p.byId.get(titleId);
  if (!it) return profile;
  if (action === 'disliked') return addToProfile(p, profile, it, -0.5);
  return addToProfile(p, profile, it, action === 'accepted' ? 0.7 : 0.5);
}

export function reasonIsTaste(r?: Reason) {
  return r === 'nao_curto';
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
