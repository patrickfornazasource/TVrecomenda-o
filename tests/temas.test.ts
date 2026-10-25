import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalogo.json';
import { candidatePool, emptyProfile, prepare, recommend } from '../src/engine/recommend';
import { ENREDOS, hasTema, MAX_ENREDOS, nextPergunta, temaInfo, TEMAS } from '../src/engine/temas';
import type { Catalog, Context, Mood } from '../src/engine/types';

const p = prepare(catalogJson as Catalog);
const NOW = Date.UTC(2026, 9, 25, 22);
const base = (mood?: Mood, extra: Partial<Context> = {}): Context => ({ mood, company: 'sozinha', time: 'medio', shown: [], rejections: [], now: NOW, ...extra });
let seed = 7;
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe('perguntas sobre a história', () => {
  it('todo código de tema e de enredo no catálogo tem pergunta', () => {
    for (const c of new Set(p.catalog.items.flatMap((x) => x.th ?? []))) expect(TEMAS[c], c).toBeDefined();
    for (const c of new Set(p.catalog.items.flatMap((x) => x.en ?? []))) expect(ENREDOS[c], c).toBeDefined();
  });

  it('Sim num enredo traz títulos com esse enredo', () => {
    for (const t of ['e:bic', 'e:bio', 'e:vol', 'e:fam', 'e:det', 'e:mag']) {
      const r = recommend(p, emptyProfile(), base(undefined, { themes: { [t]: true } }), [], rng)!;
      expect(hasTema(r.main.item, t), `${t}: ${r.main.item.t}`).toBe(true);
    }
  });

  it('Não para triste ou cenas fortes tira esses títulos', () => {
    for (const mood of ['drama', 'suspense', 'acao', undefined] as (Mood | undefined)[]) {
      const pool = candidatePool(p, emptyProfile(), base(mood, { themes: { tr: false, fo: false } }), []);
      for (const x of pool.slice(0, 30)) {
        expect(hasTema(x.item, 'tr'), x.item.t).toBe(false);
        expect(hasTema(x.item, 'fo'), x.item.t).toBe(false);
      }
    }
  });

  it('para no primeiro Sim, no máximo 4 enredos e 1 filtro, sem repetir', () => {
    for (const mood of ['comedia', 'drama', 'romance', 'acao', 'suspense', 'desenho', 'terror', undefined] as (Mood | undefined)[]) {
      for (const simNa of [1, 3, 99]) {
        const asked: string[] = [];
        const ctx = base(mood, { themes: {} });
        for (;;) {
          const pool = candidatePool(p, emptyProfile(), ctx, []);
          const t = nextPergunta(pool, ctx, asked, rng);
          if (!t) break;
          expect(asked).not.toContain(t);
          expect(temaInfo(t), t).toBeDefined();
          const enredo = t.startsWith('e:');
          ctx.themes![t] = enredo && asked.filter((x) => x.startsWith('e:')).length + 1 === simNa;
          asked.push(t);
        }
        const enredos = asked.filter((x) => x.startsWith('e:'));
        expect(enredos.length, `${mood}`).toBeGreaterThan(0);
        expect(enredos.length).toBeLessThanOrEqual(Math.min(simNa, MAX_ENREDOS));
        expect(asked.length - enredos.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('com crianças não pergunta de cenas fortes', () => {
    const ctx = base('acao', { company: 'familia', themes: {} });
    const pool = candidatePool(p, emptyProfile(), ctx, []);
    for (let i = 0; i < 20; i++) expect(nextPergunta(pool, ctx, [], rng)).not.toBe('fo');
  });
});
