import catalogJson from '../src/data/catalogo.json';
import { buildProfile, buildProfileFromPicks, emptyProfile, prepare, recommend, REJECT_BLOCK_DAYS } from '../src/engine/recommend';
import type { Catalog, Context, Mood, Company, TimeBudget, UserEvent } from '../src/engine/types';

const p = prepare(catalogJson as Catalog);
const names = (id: number) => p.byId.get(id)!.g.map((g) => p.catalog.genres[g]);
const NOW = Date.UTC(2026, 9, 25, 22);

// gerador determinístico para os testes
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const MOODS: (Mood | undefined)[] = ['rir', 'relaxar', 'emocionar', 'adrenalina', 'misterio', 'romance', 'nostalgia', 'familia', 'comedia', 'drama', 'acao', 'suspense', 'desenho', 'novela', 'ficcao', undefined];
const COMPANIES: Company[] = ['sozinha', 'alguem', 'familia', 'amigos'];
const TIMES: TimeBudget[] = ['curto', 'medio', 'maratona'];
const profiles = [emptyProfile(), buildProfile(p, p.catalog.onboarding.slice(0, 8)), buildProfile(p, p.catalog.onboarding.slice(20, 30)), buildProfileFromPicks(p, ['comedia', 'novela', 'brasil'])];

function allResults(fn: (ids: number[], ctx: Context) => void) {
  let seed = 1;
  for (const profile of profiles)
    for (const mood of MOODS)
      for (const company of COMPANIES)
        for (const time of TIMES) {
          const ctx: Context = { mood, company, time, shown: [], rejections: [], now: NOW };
          const r = recommend(p, profile, ctx, [], seeded(seed++));
          if (!r) continue;
          fn([r.main.item.i, ...r.alternatives.map((a) => a.item.i)], ctx);
        }
}

describe('motor de recomendação', () => {
  it('sempre devolve no máximo 3 opções, sem repetir', () => {
    allResults((ids) => {
      expect(ids.length).toBeLessThanOrEqual(3);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('sempre tem resposta para todas as combinações de perguntas', () => {
    let missing = 0;
    for (const mood of MOODS) for (const company of COMPANIES) for (const time of TIMES) {
      const r = recommend(p, profiles[1], { mood, company, time, shown: [], rejections: [], now: NOW }, [], seeded(7));
      if (!r || r.alternatives.length < 2) missing++;
    }
    expect(missing).toBe(0);
  });

  // Critério 4
  it('nunca mostra terror sem ter sido pedido', () => {
    allResults((ids) => ids.forEach((id) => expect(names(id)).not.toContain('Horror')));
  });

  it('mostra terror quando ela pede', () => {
    const r = recommend(p, emptyProfile(), { mood: 'terror', company: 'sozinha', time: 'medio', shown: [], rejections: [], now: NOW }, [], seeded(3))!;
    expect(names(r.main.item.i)).toContain('Horror');
  });

  // Critério 5
  it('"Rir" + "Em família": só Comedy/Family/Animation, nunca Horror/Crime/War', () => {
    for (const profile of profiles)
      for (const time of TIMES)
        for (let s = 1; s <= 20; s++) {
          const r = recommend(p, profile, { mood: 'rir', company: 'familia', time, shown: [], rejections: [], now: NOW }, [], seeded(s))!;
          for (const id of [r.main.item.i, ...r.alternatives.map((a) => a.item.i)]) {
            const g = names(id);
            expect(g.some((x) => ['Comedy', 'Family', 'Animation'].includes(x))).toBe(true);
            for (const bad of ['Horror', 'Crime', 'War']) expect(g).not.toContain(bad);
          }
        }
  });

  // Critério 3
  it('nunca recomenda "Já vi", assistido ou recusado há pouco tempo', () => {
    const ctx: Context = { mood: 'rir', company: 'sozinha', time: 'medio', shown: [], rejections: [], now: NOW };
    const events: UserEvent[] = [];
    // recusa tudo o que aparece por 15 rodadas, com ações diferentes
    for (let round = 0; round < 15; round++) {
      const r = recommend(p, profiles[1], ctx, events, seeded(round + 1))!;
      const ids = [r.main.item.i, ...r.alternatives.map((a) => a.item.i)];
      for (const e of events) expect(ids).not.toContain(e.titleId);
      const action = (['seen', 'accepted', 'rejected'] as const)[round % 3];
      events.push({ titleId: r.main.item.i, action, reason: action === 'rejected' ? 'nao_e_clima' : undefined, timestamp: NOW - (round % 5) * 24 * 3600e3 });
    }
  });

  it('recusa antiga volta a aparecer, mas "Já vi" nunca', () => {
    const ctx: Context = { mood: 'rir', company: 'sozinha', time: 'medio', shown: [], rejections: [], now: NOW };
    const first = recommend(p, profiles[1], ctx, [], () => 0)!.main.item.i;
    const old = NOW - (REJECT_BLOCK_DAYS + 100) * 24 * 3600e3;
    const ids = (ev: UserEvent[]) => {
      const r = recommend(p, profiles[1], ctx, ev, () => 0)!;
      return [r.main.item.i, ...r.alternatives.map((a) => a.item.i)];
    };
    expect(ids([{ titleId: first, action: 'rejected', reason: 'nao_e_clima', timestamp: old }])).toContain(first);
    expect(ids([{ titleId: first, action: 'rejected', reason: 'ja_vi', timestamp: old }])).not.toContain(first);
  });

  it('respeita o tempo: "menos de 1h30" não traz filme com mais de 95 min', () => {
    allResults((ids, ctx) => {
      if (ctx.time !== 'curto') return;
      for (const id of ids) {
        const it = p.byId.get(id)!;
        if (it.k === 'm' && it.r != null) expect(it.r).toBeLessThanOrEqual(95);
      }
    });
  });

  it('"muito longo" encurta as próximas opções', () => {
    const base: Context = { mood: 'emocionar', company: 'sozinha', time: 'medio', type: 'm', shown: [], rejections: [], now: NOW };
    const r1 = recommend(p, profiles[1], base, [], () => 0)!;
    const long = r1.main.item;
    const r2 = recommend(p, profiles[1], { ...base, shown: [long.i], rejections: [{ titleId: long.i, reason: 'muito_longo' }] }, [], () => 0)!;
    for (const pick of [r2.main, ...r2.alternatives]) if (pick.item.r && long.r) expect(pick.item.r).toBeLessThan(long.r);
  });

  it('"Filme ou série?" filtra o tipo', () => {
    const r = recommend(p, profiles[0], { mood: 'emocionar', company: 'sozinha', time: 'medio', type: 's', shown: [], rejections: [], now: NOW }, [], seeded(2))!;
    for (const pick of [r.main, ...r.alternatives]) expect(pick.item.k).toBe('s');
  });

  it('diversifica: as 3 opções não são todas do mesmo gênero principal e década', () => {
    allResults((ids) => {
      if (ids.length < 3) return;
      const items = ids.map((id) => p.byId.get(id)!);
      const sameGenre = new Set(items.map((i) => i.g[0])).size === 1;
      const sameDecade = new Set(items.map((i) => Math.floor(i.y / 10))).size === 1;
      expect(sameGenre && sameDecade).toBe(false);
    });
  });

  it('não repete o que já foi mostrado na sessão', () => {
    const shown: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = recommend(p, profiles[2], { mood: 'romance', company: 'alguem', time: 'medio', shown, rejections: [], now: NOW }, [], seeded(i))!;
      const ids = [r.main.item.i, ...r.alternatives.map((a) => a.item.i)];
      for (const id of ids) expect(shown).not.toContain(id);
      shown.push(...ids);
    }
  });
});

describe('sempre existe um padrão', () => {
  it('mesmo recusando tudo com "muito antigo" e "não curto", continua sugerindo', () => {
    const ctx: Context = { mood: 'relaxar', company: 'sozinha', time: 'medio', type: 'm', shown: [], rejections: [], now: NOW };
    for (let round = 0; round < 8; round++) {
      const r = recommend(p, profiles[1], ctx, [], seeded(round + 3));
      expect(r).not.toBeNull();
      ctx.shown.push(r!.main.item.i, ...r!.alternatives.map((a) => a.item.i));
      ctx.rejections.push({ titleId: r!.main.item.i, reason: round % 2 ? 'nao_curto' : 'muito_antigo' });
    }
  });
});

describe('perguntas por gênero', () => {
  const G: Record<string, string[]> = {
    comedia: ['Comedy'],
    drama: ['Drama', 'History'],
    acao: ['Action', 'Adventure', 'War', 'Western'],
    suspense: ['Thriller', 'Mystery', 'Crime'],
    desenho: ['Animation', 'Family', 'Kids'],
    novela: ['Soap'],
    ficcao: ['Science Fiction', 'Fantasy'],
    romance: ['Romance'],
  };
  it('todas as opções são do gênero pedido', () => {
    let seed = 1;
    for (const [mood, gs] of Object.entries(G))
      for (const company of COMPANIES)
        for (const time of TIMES) {
          const r = recommend(p, profiles[3], { mood: mood as Mood, company, time, shown: [], rejections: [], now: NOW }, [], seeded(seed++));
          if (!r) continue;
          for (const pick of [r.main, ...r.alternatives]) expect(names(pick.item.i).some((g) => gs.includes(g))).toBe(true);
        }
  });
  it('"Desenho e família" nunca traz Horror/Crime/War e sempre é para a família', () => {
    for (let s = 1; s <= 20; s++) {
      const r = recommend(p, profiles[0], { mood: 'desenho', company: 'sozinha', time: 'medio', shown: [], rejections: [], now: NOW }, [], seeded(s))!;
      for (const pick of [r.main, ...r.alternatives]) {
        const g = names(pick.item.i);
        expect(g.some((x) => ['Family', 'Kids'].includes(x))).toBe(true);
        for (const bad of ['Horror', 'Crime', 'War']) expect(g).not.toContain(bad);
      }
    }
  });
});
