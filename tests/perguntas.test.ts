import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalogo.json';
import { emptyStats, favorite, firstNode, recordAccepted, recordFav, step, TREE, type Node } from '../src/engine/perguntas';
import { emptyProfile, prepare, recommend } from '../src/engine/recommend';
import type { Catalog, Mood } from '../src/engine/types';

const p = prepare(catalogJson as Catalog);

// todos os caminhos de sim e não a partir de "leve"
function paths(node: Exclude<Node, 'fav'> = 'leve', depth = 1): { depth: number; mood: Mood | undefined }[] {
  return (['sim', 'nao'] as const).flatMap((a) => {
    const n = step(node, a);
    return 'node' in n ? paths(n.node as Exclude<Node, 'fav'>, depth + 1) : [{ depth, mood: n.mood }];
  });
}

describe('perguntas de sim ou não', () => {
  it('nunca passam de 3 e cada fim tem um gênero que dá resultado', () => {
    const ends = paths();
    expect(ends.length).toBe(7);
    for (const e of ends) {
      expect(e.depth).toBeLessThanOrEqual(3);
      const r = recommend(p, emptyProfile(), { mood: e.mood, company: 'sozinha', time: 'medio', shown: [], rejections: [] }, []);
      expect(r).not.toBeNull();
    }
  });

  it('nome de pergunta não coincide com gênero final', () => {
    const leaves = Object.values(TREE).flatMap((t) => [t.sim, t.nao]).filter((x) => x && !(x in TREE));
    for (const l of leaves) expect(Object.keys(TREE)).not.toContain(l);
  });

  it('sem saber nada dela, começa pelo "leve"', () => {
    expect(firstNode(emptyStats())).toBe('leve');
  });

  it('começa pelo que ela marcou e passa a seguir o que ela aceita', () => {
    let s = emptyStats();
    expect(favorite(s, ['novela'])).toBe('novela');
    s = recordAccepted(recordAccepted(s, 'comedia'), 'comedia');
    expect(favorite(s, ['novela'])).toBe('comedia');
  });

  it('depois de alguns Não, troca o favorito ou desiste dele', () => {
    let s = emptyStats();
    s = recordFav(s, 'novela', 'nao');
    expect(favorite(s, ['novela', 'drama'])).toBe('drama');
    s = recordFav(s, 'novela', 'nao');
    expect(favorite(s, ['novela'])).toBeNull();
  });
});
