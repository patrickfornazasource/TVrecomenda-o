import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalogo.json';
import { candidatePool, emptyProfile, prepare } from '../src/engine/recommend';
import { hasTraco, MAX_AKIN, nextAkinator, TRACOS } from '../src/engine/akinator';
import type { Catalog, Context, Mood } from '../src/engine/types';

const p = prepare(catalogJson as Catalog);
const NOW = Date.UTC(2026, 9, 25, 22);
const base = (mood?: Mood, extra: Partial<Context> = {}): Context => ({ mood, company: 'sozinha', time: 'medio', type: 'm', shown: [], rejections: [], now: NOW, themes: {}, ...extra });
let seed = 11;
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

/** Ela tem um filme "na cabeça" e responde tudo de acordo com ele. */
function jogar(ctx: Context, alvo: number) {
  const asked: string[] = [];
  for (;;) {
    const t = nextAkinator(candidatePool(p, emptyProfile(), ctx, []), ctx, asked, rng);
    if (!t) break;
    expect(asked).not.toContain(t);
    ctx.themes![t] = hasTraco(p.byId.get(alvo)!, t.slice(2));
    asked.push(t);
  }
  const rank = candidatePool(p, emptyProfile(), ctx, []).findIndex((x) => x.item.i === alvo);
  return { asked, rank };
}

describe('perguntas no estilo Akinator', () => {
  it('todo traço do catálogo tem pergunta, e só filmes têm traços', () => {
    const items = p.catalog.items.filter((x) => x.tr);
    expect(items.length).toBeGreaterThan(2000);
    for (const x of items) {
      expect(x.k).toBe('m');
      for (const c of x.tr!) expect(TRACOS[c], `${x.t}: ${c}`).toBeDefined();
    }
  });

  it('acha o filme que ela tem na cabeça, com no máximo 12 perguntas', () => {
    let achou = 0;
    let total = 0;
    for (const mood of [undefined, 'comedia', 'drama', 'acao', 'romance', 'desenho'] as (Mood | undefined)[]) {
      const pool = candidatePool(p, emptyProfile(), base(mood), []).filter((x) => x.item.tr);
      for (let j = 0; j < 6; j++) {
        const alvo = pool[Math.floor(rng() * Math.min(80, pool.length))].item.i;
        const { asked, rank } = jogar(base(mood), alvo);
        expect(asked.length).toBeLessThanOrEqual(MAX_AKIN);
        expect(asked.length).toBeGreaterThanOrEqual(3);
        total++;
        if (rank >= 0 && rank < 5) achou++;
      }
    }
    expect(achou / total).toBeGreaterThanOrEqual(0.6);
  });

  it('com crianças não pergunta de violência, sexo ou medo', () => {
    for (let j = 0; j < 5; j++) {
      const ctx = base('acao', { company: 'familia' });
      const pool = candidatePool(p, emptyProfile(), ctx, []);
      const { asked } = jogar(ctx, pool[j].item.i);
      for (const t of asked) expect(['t:vio', 't:sex', 't:mdo', 't:kid']).not.toContain(t);
    }
  });

  it('não pergunta o que o gênero já respondeu', () => {
    for (let j = 0; j < 5; j++) {
      const ctx = base('comedia');
      const { asked } = jogar(ctx, candidatePool(p, emptyProfile(), ctx, [])[j].item.i);
      expect(asked).not.toContain('t:ris');
    }
  });
});
