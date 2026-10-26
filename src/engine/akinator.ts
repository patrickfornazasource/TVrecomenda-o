// Perguntas no estilo Akinator: cada filme tem traços de Sim ou Não (data/tracos, marcados a partir
// das sinopses) e o app pergunta sempre o traço que melhor divide os filmes que ainda estão no páreo.
import type { Context, Item } from './types';

export interface Traco {
  q: string; // a pergunta, do jeito que ela entende
  why: string; // frase do "por que este" quando ela disse Sim
}

export const TRACOS: Record<string, Traco> = {
  // lugar
  cgr: { q: 'Quer que se passe numa cidade grande?', why: 'Na cidade grande' },
  cpq: { q: 'Quer que se passe no interior, no campo ou numa cidade pequena?', why: 'No interior' },
  mar: { q: 'Quer que se passe no mar, na praia ou numa ilha?', why: 'Tem mar e praia' },
  nev: { q: 'Quer um filme com neve, num lugar gelado?', why: 'Com neve' },
  esp: { q: 'Quer que se passe no espaço ou em outro planeta?', why: 'No espaço' },
  eur: { q: 'Quer que se passe na Europa?', why: 'Se passa na Europa' },
  bra: { q: 'Quer que se passe no Brasil?', why: 'Se passa no Brasil' },
  nat: { q: 'Quer um filme de Natal?', why: 'Um filme de Natal' },
  esc: { q: 'Quer que se passe numa escola ou faculdade?', why: 'Na escola' },
  // época
  pas: { q: 'Quer uma história de antigamente, de outra época?', why: 'De outra época' },
  fut: { q: 'Quer uma história que se passa no futuro?', why: 'No futuro' },
  // personagens
  cri: { q: 'Quer que uma criança seja a personagem principal?', why: 'Uma criança no centro' },
  ado: { q: 'Quer uma história de adolescentes?', why: 'Uma história de adolescentes' },
  ido: { q: 'Quer que tenha alguém mais velho como personagem importante?', why: 'Com alguém mais velho' },
  mul: { q: 'Quer que uma mulher seja a personagem principal?', why: 'Uma mulher no centro' },
  cas: { q: 'Quer a história de um casal?', why: 'A história de um casal' },
  ami: { q: 'Quer a história de um grupo de amigos?', why: 'Um grupo de amigos' },
  fam: { q: 'Quer a história de uma família?', why: 'Uma história de família' },
  bic: { q: 'Quer um filme com um bicho importante na história?', why: 'Tem bicho' },
  fal: { q: 'Quer que tenha bichos ou brinquedos que falam?', why: 'Bichos que falam' },
  her: { q: 'Quer super-heróis, gente com superpoderes?', why: 'Super-heróis' },
  rei: { q: 'Quer reis, rainhas, príncipes ou princesas?', why: 'Reis e princesas' },
  pol: { q: 'Quer polícia, detetive ou investigação?', why: 'Tem investigação' },
  sol: { q: 'Topa um filme de guerra, com soldados?', why: 'Filme de guerra' },
  mus: { q: 'Quer um filme sobre músicos, cantores ou dançarinos?', why: 'Tem música' },
  atl: { q: 'Quer um filme de esporte?', why: 'Filme de esporte' },
  med: { q: 'Topa um filme com médico e hospital?', why: 'Tem hospital' },
  lad: { q: 'Quer ladrões, golpistas ou um assalto?', why: 'Tem um golpe' },
  agt: { q: 'Quer espiões e agentes secretos?', why: 'Espiões' },
  mag: { q: 'Quer magia, bruxas ou magos?', why: 'Tem magia' },
  mon: { q: 'Quer monstros, dinossauros ou criaturas?', why: 'Tem criaturas' },
  fan: { q: 'Quer fantasmas ou espíritos?', why: 'Tem fantasma' },
  ali: { q: 'Quer extraterrestres?', why: 'Tem extraterrestre' },
  rob: { q: 'Quer robôs ou máquinas que pensam?', why: 'Tem robô' },
  // acontecimentos
  via: { q: 'Quer uma viagem, uma aventura longe de casa?', why: 'Uma viagem' },
  cam: { q: 'Quer que tenha um casamento?', why: 'Tem casamento' },
  gra: { q: 'Quer uma história com gravidez ou bebê?', why: 'Tem bebê' },
  mor: { q: 'Tudo bem se alguém querido morrer na história?', why: '' },
  doe: { q: 'Tudo bem se alguém enfrentar uma doença?', why: '' },
  jul: { q: 'Quer um julgamento no tribunal?', why: 'Tem tribunal' },
  per: { q: 'Quer perseguição ou fuga?', why: 'Tem perseguição' },
  lut: { q: 'Quer muita luta e briga?', why: 'Muita luta' },
  exp: { q: 'Quer tiros e explosões?', why: 'Tiros e explosões' },
  tem: { q: 'Quer viagem no tempo?', why: 'Viagem no tempo' },
  seg: { q: 'Quer um segredo ou mistério para ir descobrindo?', why: 'Um mistério para descobrir' },
  ass: { q: 'Topa um crime ou assassinato na história?', why: 'Tem um crime para desvendar' },
  can: { q: 'Quer que os personagens cantem, um musical?', why: 'Um musical' },
  des: { q: 'Quer um desastre, gente lutando para sobreviver?', why: 'Luta para sobreviver' },
  ver: { q: 'Quer uma história que aconteceu de verdade?', why: 'Aconteceu de verdade' },
  // tom
  fel: { q: 'Quer final feliz?', why: 'Tem final feliz' },
  cho: { q: 'Tudo bem se fizer chorar?', why: 'Para se emocionar' },
  ris: { q: 'Quer dar muita risada?', why: 'Para dar risada' },
  mdo: { q: 'Tudo bem se der medo?', why: '' },
  ten: { q: 'Quer algo tenso, de roer as unhas?', why: 'De roer as unhas' },
  rom: { q: 'Quer romance forte?', why: 'Tem romance' },
  lev: { q: 'Quer algo leve, sem violência?', why: 'Leve, sem violência' },
  pen: { q: 'Quer uma história que faz pensar?', why: 'Faz pensar' },
  vio: { q: 'Tudo bem ter cenas fortes, com violência?', why: '' },
  sex: { q: 'Tudo bem ter cenas de sexo?', why: '' },
  kid: { q: 'Quer algo bom para ver com criança?', why: 'Bom para ver com criança' },
  // forma
  cla: { q: 'Quer um clássico, daqueles que todo mundo conhece?', why: 'Um clássico' },
  ani: { q: 'Quer um desenho animado?', why: 'Um desenho' },
  pb: { q: 'Topa um filme em preto e branco?', why: '' },
};

export const MAX_AKIN = 12;

/** Perguntas de "Tudo bem se...?": o Sim só libera, não pede; o Não tira de vez. */
export const PERMISSAO = new Set(['mor', 'doe', 'mdo', 'vio', 'sex', 'cho', 'pb', 'med', 'sol', 'ass']);

/** O gênero que ela escolheu já responde estas perguntas. */
const JA_DITO: Partial<Record<string, string[]>> = {
  ris: ['comedia', 'rir'],
  rom: ['romance', 'amor'],
  mdo: ['terror', 'susto'],
  ani: ['desenho'],
  kid: ['desenho', 'familia'],
  lev: ['relaxar'],
  ten: ['suspense', 'adrenalina'],
  cho: ['drama', 'emocionar'],
};
const COM_CRIANCAS = ['vio', 'sex', 'kid', 'mdo'];

export const hasTraco = (it: Item, c: string) => !!it.tr?.includes(c);

/**
 * Próxima pergunta, ou null quando já dá para escolher.
 * Os pesos vêm da nota de cada filme no momento (que já leva em conta as respostas):
 * o filme na frente pesa mais, e a pergunta escolhida é a que corta esse peso mais perto do meio.
 */
export function nextAkinator(
  pool: { item: Item; score: number }[],
  ctx: Context,
  asked: string[],
  rng: () => number = Math.random,
): string | null {
  if (asked.length >= MAX_AKIN) return null;
  const top = pool.filter((x) => x.item.tr).slice(0, 150);
  if (top.length < 4) return null;
  const best = top[0].score;
  const w = top.map((x) => Math.exp((x.score - best) / 0.12));
  const total = w.reduce((a, b) => a + b, 0);
  const p = w.map((x) => x / total);
  const efetivos = 1 / p.reduce((a, b) => a + b * b, 0);
  if (asked.length >= 4 && (efetivos <= 3 || p[0] >= 0.45)) return null;

  let pick: string | null = null;
  let bestValue = 0.1; // pergunta que quase não divide nada não vale
  for (const c of Object.keys(TRACOS)) {
    const t = 't:' + c;
    if (asked.includes(t)) continue;
    if (ctx.mood && JA_DITO[c]?.includes(ctx.mood)) continue;
    if (ctx.company === 'familia' && COM_CRIANCAS.includes(c)) continue;
    let s = 0;
    for (let i = 0; i < top.length; i++) if (hasTraco(top[i].item, c)) s += p[i];
    const value = Math.min(s, 1 - s) * (0.85 + rng() * 0.3); // um pouco de variedade entre as noites
    if (value > bestValue) {
      pick = t;
      bestValue = value;
    }
  }
  return pick;
}
