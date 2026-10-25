// Perguntas sobre a história. Cada título tem temas (data/temas/) e 1 ou 2 mini-enredos (data/enredos/),
// marcados a partir das sinopses. Depois da companhia: no máximo um filtro ("Tudo bem se for triste?")
// e mini-enredos ("Uma mulher que dá a volta por cima?") até o primeiro Sim.
// No contexto, os enredos ficam em ctx.themes com o prefixo "e:" (ex.: "e:vol").
import type { Context, Item } from './types';

export interface Tema {
  q: string; // pergunta
  icon: string;
  why: string; // frase do "por que este" quando ela disse Sim
  filtro?: true; // Não tira esses títulos de vez (triste, cenas fortes)
  peso?: number; // temas genéricos perguntam menos, para sobrar espaço para os da história
  quando?: (d: Date) => boolean;
}

export const TEMAS: Record<string, Tema> = {
  re: { q: 'Quer uma história que aconteceu de verdade?', icon: '📰', why: 'Aconteceu de verdade' },
  fa: { q: 'Quer uma história de família?', icon: '👨‍👩‍👧', why: 'Uma história de família' },
  am: { q: 'Quer uma história de amizade?', icon: '🤝', why: 'Uma história de amizade' },
  ro: { q: 'Quer que tenha romance no meio?', icon: '💕', why: 'Tem romance no meio', peso: 0.85 },
  ca: { q: 'Quer uma história sobre casamento, vida a dois?', icon: '💍', why: 'Fala de vida a dois' },
  ep: { q: 'Quer algo que se passa antigamente, em outra época?', icon: '🕰️', why: 'Se passa em outra época' },
  gu: { q: 'Topa um filme que se passa numa guerra?', icon: '🎖️', why: 'Se passa numa guerra' },
  an: { q: 'Quer um filme com bichos?', icon: '🐶', why: 'Tem bichos' },
  mc: { q: 'Quer um filme com música e dança?', icon: '🎶', why: 'Tem música' },
  su: { q: 'Quer uma história de superação?', icon: '💪', why: 'Uma história de superação' },
  in: { q: 'Quer um mistério para ir descobrindo?', icon: '🔎', why: 'Tem um mistério para desvendar' },
  vi: { q: 'Quer uma história com viagem?', icon: '🧳', why: 'Tem viagem' },
  jo: { q: 'Quer que crianças ou jovens sejam os personagens principais?', icon: '🧒', why: 'Com crianças e jovens' },
  ma: { q: 'Pode ter magia ou coisas sobrenaturais?', icon: '✨', why: 'Tem magia' },
  fu: { q: 'Quer algo que se passa no futuro ou no espaço?', icon: '🚀', why: 'Se passa no futuro' },
  es: { q: 'Quer uma história de esporte?', icon: '⚽', why: 'Tem esporte' },
  rc: { q: 'Quer algo que se passa no interior, no campo?', icon: '🌾', why: 'Se passa no interior' },
  id: { q: 'Quer personagens mais maduros, gente mais velha?', icon: '👵', why: 'Com personagens mais maduros' },
  fe: { q: 'Quer uma história que fala de fé?', icon: '🙏', why: 'Fala de fé' },
  na: { q: 'Quer um filme de Natal?', icon: '🎄', why: 'Filme de Natal', quando: (d) => d.getMonth() >= 10 || d.getMonth() === 0 },
  co: { q: 'Quer um filme com comida e cozinha?', icon: '🍝', why: 'Tem muita comida' },
  mh: { q: 'Quer uma mulher como personagem principal?', icon: '👩', why: 'Com uma mulher no centro da história', peso: 0.7 },
  fm: { q: 'Quer um filme famoso, daqueles que todo mundo conhece?', icon: '🏆', why: 'Um clássico que todo mundo conhece', peso: 0.6 },
  fl: { q: 'Quer terminar de bem com a vida, com algo leve?', icon: '😊', why: 'Leve, para terminar de bem com a vida', peso: 0.7 },
  br: { q: 'Quer uma produção brasileira?', icon: '🇧🇷', why: 'Produção brasileira' },
  tr: { q: 'Tudo bem se for uma história triste?', icon: '😢', why: '', filtro: true },
  fo: { q: 'Tudo bem ter cenas fortes, com violência?', icon: '🩸', why: '', filtro: true },
};

export const ENREDOS: Record<string, Tema> = {
  vol: { q: 'Que tal a história de alguém que dá a volta por cima depois de perder tudo?', icon: '🌅', why: 'Alguém que dá a volta por cima' },
  son: { q: 'Que tal alguém correndo atrás de um sonho?', icon: '🌟', why: 'Alguém correndo atrás de um sonho' },
  amp: { q: 'Que tal uma bela história de amor?', icon: '💞', why: 'Uma bela história de amor' },
  ree: { q: 'Que tal um amor que se reencontra depois de muitos anos?', icon: '💌', why: 'Um amor que se reencontra' },
  bri: { q: 'Que tal um casal que vive brigando até se apaixonar?', icon: '😤', why: 'Brigam até se apaixonar' },
  fam: { q: 'Que tal uma família que se reúne e acerta as contas do passado?', icon: '🏡', why: 'Uma família acertando as contas' },
  pai: { q: 'Que tal pais e filhos aprendendo a se entender?', icon: '👨‍👧', why: 'Pais e filhos se entendendo' },
  mae: { q: 'Que tal uma mãe que faz de tudo pelos filhos?', icon: '🤱', why: 'Uma mãe que faz tudo pelos filhos' },
  ami: { q: 'Que tal um grupo de amigos vivendo uma aventura juntos?', icon: '👯', why: 'Amigos numa aventura' },
  imp: { q: 'Que tal uma amizade entre duas pessoas bem diferentes?', icon: '🤝', why: 'Uma amizade improvável' },
  inj: { q: 'Que tal alguém lutando contra uma injustiça?', icon: '⚖️', why: 'Alguém contra uma injustiça' },
  tri: { q: 'Que tal um julgamento, com um advogado defendendo um inocente?', icon: '👨‍⚖️', why: 'Um julgamento' },
  gol: { q: 'Que tal um golpe ou um assalto muito bem planejado?', icon: '💰', why: 'Um golpe bem planejado' },
  det: { q: 'Que tal um detetive tentando descobrir quem é o culpado?', icon: '🕵️', why: 'Um mistério para desvendar' },
  vin: { q: 'Que tal alguém buscando vingança?', icon: '🔥', why: 'Uma história de vingança' },
  sob: { q: 'Que tal pessoas lutando para sobreviver?', icon: '🏔️', why: 'Uma luta para sobreviver' },
  fug: { q: 'Que tal uma fuga ou uma perseguição de tirar o fôlego?', icon: '🏃', why: 'Uma fuga de tirar o fôlego' },
  sal: { q: 'Que tal heróis que precisam salvar o mundo?', icon: '🦸', why: 'Heróis salvando o mundo' },
  tem: { q: 'Que tal alguém que viaja no tempo?', icon: '⏳', why: 'Viagem no tempo' },
  mag: { q: 'Que tal alguém que vai parar num mundo mágico?', icon: '🪄', why: 'Um mundo mágico' },
  tro: { q: 'Que tal pessoas que trocam de corpo ou de vida?', icon: '🔄', why: 'Uma troca de vidas' },
  nov: { q: 'Que tal alguém tentando se encaixar num lugar novo?', icon: '🧳', why: 'Alguém num lugar novo' },
  esc: { q: 'Que tal a vida de jovens na escola?', icon: '🎒', why: 'Jovens na escola' },
  bic: { q: 'Que tal a amizade entre uma pessoa e um bicho?', icon: '🐾', why: 'Amizade com um bicho' },
  bio: { q: 'Que tal a vida de uma pessoa famosa que existiu de verdade?', icon: '📖', why: 'A vida de alguém que existiu' },
  gue: { q: 'Que tal gente comum tentando sobreviver a uma guerra?', icon: '🎖️', why: 'Gente comum na guerra' },
  cor: { q: 'Que tal reis, rainhas e as intrigas da corte?', icon: '👑', why: 'Reis, rainhas e intrigas' },
  car: { q: 'Que tal a carreira de um cantor ou de uma banda?', icon: '🎤', why: 'A carreira de um artista' },
  tim: { q: 'Que tal um time em que ninguém botava fé e que começa a vencer?', icon: '🏅', why: 'Um time que ninguém botava fé' },
  doe: { q: 'Que tal alguém enfrentando uma doença com coragem?', icon: '🎗️', why: 'Coragem diante de uma doença' },
  cri: { q: 'Que tal um casal em crise tentando se acertar?', icon: '💔', why: 'Um casal tentando se acertar' },
  seg: { q: 'Que tal um segredo que vem à tona e muda tudo?', icon: '🤫', why: 'Um segredo que vem à tona' },
  ass: { q: 'Que tal uma casa assombrada?', icon: '🏚️', why: 'Uma casa assombrada' },
  mon: { q: 'Que tal um monstro ou uma criatura atacando?', icon: '🦖', why: 'Monstros e criaturas' },
  esp: { q: 'Que tal espiões e missões secretas?', icon: '🕶️', why: 'Espiões e missões secretas' },
  maf: { q: 'Que tal a vida de uma família da máfia?', icon: '🎩', why: 'O mundo do crime' },
  oes: { q: 'Que tal pistoleiros no Velho Oeste?', icon: '🤠', why: 'Velho Oeste' },
  pov: { q: 'Que tal uma história do povo brasileiro, do sertão ou da cidade?', icon: '🇧🇷', why: 'Uma história do povo brasileiro' },
  tra: { q: 'Que tal gente atrapalhada se metendo em confusão?', icon: '🤪', why: 'Muita trapalhada' },
  fad: { q: 'Que tal um conto de fadas, com princesa e encanto?', icon: '🏰', why: 'Um conto de fadas' },
  rob: { q: 'Que tal robôs ou máquinas que pensam?', icon: '🤖', why: 'Robôs e máquinas' },
  ido: { q: 'Que tal alguém mais velho que redescobre a vida?', icon: '👵', why: 'Alguém que redescobre a vida' },
  pro: { q: 'Que tal um professor que muda a vida dos alunos?', icon: '🍎', why: 'Um professor marcante' },
  pol: { q: 'Que tal os bastidores da política e do poder?', icon: '🏛️', why: 'Os bastidores do poder' },
  mul: { q: 'Que tal uma mulher enfrentando todo mundo pelo que acredita?', icon: '💪', why: 'Uma mulher de fibra' },
  cas: { q: 'Que tal os preparativos e as confusões de um casamento?', icon: '💒', why: 'Confusões de casamento' },
  ext: { q: 'Que tal um encontro com extraterrestres?', icon: '👽', why: 'Extraterrestres' },
  apo: { q: 'Que tal o fim do mundo, com sobreviventes tentando recomeçar?', icon: '🌋', why: 'Depois do fim do mundo' },
};

export const MAX_ENREDOS = 4;

const isEnredo = (t: string) => t.startsWith('e:');
export const temaInfo = (t: string): Tema | undefined => (isEnredo(t) ? ENREDOS[t.slice(2)] : TEMAS[t]);

/** Gêneros que já respondem o tema (não pergunta "romance?" para quem escolheu romance). */
const JA_DITO: Partial<Record<string, string[]>> = {
  ro: ['romance'],
  fu: ['ficcao'],
  in: ['suspense'],
  jo: ['desenho'],
  fl: ['comedia', 'rir', 'relaxar', 'desenho'],
  fo: ['desenho', 'familia', 'relaxar', 'comedia', 'rir', 'terror'],
  tr: ['comedia', 'rir', 'relaxar'],
  'e:amp': ['romance'],
};

export function hasTema(it: Item, t: string): boolean {
  if (isEnredo(t)) return !!it.en?.includes(t.slice(2));
  if (t === 'br') return !!it.br;
  return !!it.th?.includes(t);
}

/** Ajuste de nota por tema: soma ao score, ou null quando o título sai da lista. */
export function temaAdjust(it: Item, themes?: Context['themes']): number | null {
  if (!themes) return 0;
  let adj = 0;
  for (const [t, yes] of Object.entries(themes)) {
    const has = hasTema(it, t);
    const info = temaInfo(t);
    const enredo = isEnredo(t);
    if (yes) {
      if (!info?.filtro) adj += has ? (enredo ? 0.4 : 0.25) : enredo ? -0.15 : -0.12; // filtro com Sim = tanto faz
    } else if (has) {
      if (info?.filtro) return null;
      adj -= enredo ? 0.35 : 0.3;
    }
  }
  return adj;
}

const peso = (x: { score: number }) => Math.max(0.05, x.score);

/**
 * Próxima pergunta sobre a história, a partir dos melhores candidatos do momento, ou null para parar.
 * 1) No máximo um filtro (triste / cenas fortes), só quando boa parte da lista é assim.
 * 2) Mini-enredos, começando pelo mais comum entre os candidatos, até ela dizer Sim a um.
 */
export function nextPergunta(
  pool: { item: Item; score: number }[],
  ctx: Context,
  asked: string[],
  rng: () => number = Math.random,
): string | null {
  const themes = ctx.themes ?? {};
  if (Object.entries(themes).some(([t, yes]) => yes && isEnredo(t))) return null;
  if (asked.filter(isEnredo).length >= MAX_ENREDOS) return null;
  const top = pool.slice(0, 60);
  if (top.length < 6) return null;
  const total = top.reduce((s, x) => s + peso(x), 0);
  const share = (t: string) => {
    let w = 0;
    let n = 0;
    for (const x of top)
      if (hasTema(x.item, t)) {
        w += peso(x);
        n++;
      }
    return n < 3 ? 0 : w / total;
  };

  if (!asked.some((t) => TEMAS[t]?.filtro)) {
    let best: string | null = null;
    let bestShare = 0.2;
    for (const t of ['tr', 'fo']) {
      if (t in themes || (ctx.mood && JA_DITO[t]?.includes(ctx.mood))) continue;
      if (t === 'fo' && ctx.company === 'familia') continue;
      const sh = share(t);
      if (sh > bestShare) {
        best = t;
        bestShare = sh;
      }
    }
    if (best && asked.length === 0) return best;
  }

  let best: string | null = null;
  let bestValue = 0.05; // enredo que quase ninguém da lista tem não vale a pergunta
  for (const code of Object.keys(ENREDOS)) {
    const t = 'e:' + code;
    if (asked.includes(t) || t in themes || (ctx.mood && JA_DITO[t]?.includes(ctx.mood))) continue;
    const sh = share(t);
    if (!sh) continue;
    const value = Math.min(sh, 0.5) * (0.85 + rng() * 0.3); // um pouco de variedade entre as noites
    if (value > bestValue) {
      best = t;
      bestValue = value;
    }
  }
  return best;
}

/** Frase do "por que este" a partir dos temas que ela pediu. */
export function temaWhy(it: Item, themes?: Context['themes']): string {
  if (!themes) return '';
  const ordem = Object.entries(themes).sort(([a], [b]) => Number(isEnredo(b)) - Number(isEnredo(a))); // enredo primeiro
  for (const [t, yes] of ordem) {
    const why = temaInfo(t)?.why;
    if (yes && why && hasTema(it, t)) return why;
  }
  return '';
}
