import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalogo.json';
import { candidatePool, emptyProfile, prepare, recommend } from '../src/engine/recommend';
import { enredoLabel, enredoOpcoes, ENREDOS, hasTema, nextFiltro, TEMAS } from '../src/engine/temas';
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

  it('mostra a lista de enredos da noite, e o escolhido vem na sugestão', () => {
    for (const mood of ['comedia', 'drama', 'romance', 'acao', 'suspense', 'desenho', 'terror', 'familia', undefined] as (Mood | undefined)[]) {
      for (const company of ['sozinha', 'familia'] as const) {
        const ctx = base(mood, { company, themes: {} });
        const pool = candidatePool(p, emptyProfile(), ctx, []);
        const opts = enredoOpcoes(pool, ctx);
        if (pool.length >= 100) expect(opts.length, `${mood}/${company}`).toBeGreaterThanOrEqual(15);
        expect(new Set(opts).size).toBe(opts.length);
        for (const t of opts) expect(enredoLabel(t)).toMatch(/^[A-ZÀ-Ú].*[^?]$/);
        for (const t of opts.slice(0, 8)) {
          const r = recommend(p, emptyProfile(), { ...ctx, themes: { [t]: true } }, [], rng)!;
          expect(hasTema(r.main.item, t), `${mood}/${company}/${t}: ${r.main.item.t}`).toBe(true);
        }
      }
    }
  });

  it('romance não oferece "uma história de amor"', () => {
    const ctx = base('romance', { themes: {} });
    expect(enredoOpcoes(candidatePool(p, emptyProfile(), ctx, []), ctx)).not.toContain('e:amp');
  });

  it('com crianças não pergunta de cenas fortes', () => {
    const ctx = base('acao', { company: 'familia', themes: {} });
    const pool = candidatePool(p, emptyProfile(), ctx, []);
    expect(nextFiltro(pool, ctx)).not.toBe('fo');
    expect(nextFiltro(pool, { ...ctx, themes: { tr: false } })).toBeNull();
  });
});
