// Todos os textos da interface ficam aqui, para ajustar o tom num lugar só.
import type { Node } from './engine/perguntas';
import type { Company, Mood, Reason, TimeBudget } from './engine/types';

export const T = {
  appName: 'Escolhe pra Mim',

  // Meu gosto (primeira vez)
  gostoTitulo: 'Do que você costuma gostar?',
  gostoSub: 'Marque quantos quiser. Isso me ajuda a acertar mais. Dá para mudar depois.',
  gostoPronto: 'Pronto',
  gostoPular: 'Pular',

  // Início
  inicioPergunta: 'O que vamos assistir hoje?',
  inicioDecidir: 'Decidir por mim',
  inicioDepois: (n: number) => `Quero ver depois (${n})`,
  inicioHistorico: 'Já assisti',
  inicioGosto: 'Meu gosto',
  inicioJaDecidido: 'Hoje já está decidido:',
  inicioBomFilme: 'Bom filme! Aproveite.',
  inicioOutro: 'Quero escolher outro',

  // Perguntas
  qGenero: 'Que tipo de filme você quer ver hoje?',
  kickerSimNao: 'Para escolher o filme',
  kickerTempo: 'Sobre o tempo',
  kickerCompanhia: 'Sobre a companhia',
  kickerTema: 'Sobre a história',
  podeEscolher: 'Já está bom, pode escolher',
  qEnredo: 'Que tipo de história?',
  maisEnredos: 'Mais histórias',
  primeirosEnredos: 'Voltar às primeiras',
  tantoFazEnredo: 'Tanto faz, pode escolher',
  sim: 'Sim',
  nao: 'Não',
  qCompanhia: 'Vai assistir com quem?',
  qTempo: 'Quanto tempo você tem para assistir?',
  tantoFazGenero: 'Tanto faz',
  voltar: 'Voltar',

  // Resultado
  resTitulo: 'Minha sugestão para hoje',
  resAlternativas: 'Ou então:',
  vamos: 'Vamos nessa!',
  outra: 'Outra',
  jaVi: 'Já vi',
  depois: 'Ver depois',
  guardado: 'Guardado em “Quero ver depois”',
  sortear: 'Sortear',
  sorteando: 'Sorteando…',
  trocar: 'Escolher este',
  ondeAssistir: 'Onde assistir:',
  nadaAchado: 'Não achei nada com essas respostas.',
  recomecar: 'Recomeçar',

  // Recusa
  porQue: 'Por quê?',
  porQueSub: 'Assim eu acerto mais na próxima.',
  pular: 'Pular',
  gostou: 'E você gostou?',
  gostei: 'Gostei',
  naoGostei: 'Não gostei',

  // Depois de 3 recusas
  faltando: 'O que está faltando?',
  filmeOuSerie: 'Prefere filme ou série?',
  filme: 'Filme',
  serie: 'Série ou novela',
  antigoOuNovo: 'Prefere mais antigo ou mais novo?',
  antigo: 'Mais antigo',
  novo: 'Mais novo',
  tantoFaz: 'Tanto faz',
  definitiva: 'Essa é a escolha de hoje',

  // Decidido
  decidido: 'Decidido!',
  bomFilme: 'Bom filme!',
  bomSerie: 'Boa diversão!',
  inicio: 'Início',

  // Listas
  depoisTitulo: 'Quero ver depois',
  depoisVazio: 'Nada guardado ainda. Na hora da sugestão, use “Ver depois”.',
  assistirEste: 'Assistir este',
  tirarLista: 'Tirar da lista',
  historicoTitulo: 'Já assisti',
  historicoVazio: 'Ainda não tem nada aqui.',
  historicoEscolhido: 'Escolhido aqui',
  historicoJaVi: 'Já tinha visto',
  esquecer: 'Pode sugerir de novo',
} as const;

// Perguntas de sim ou não (ver engine/perguntas.ts)
export const YES_NO: Record<Exclude<Node, 'fav'>, { q: string; icon: string }> = {
  leve: { q: 'Quer algo leve, para relaxar?', icon: '🛋️' },
  rir: { q: 'Quer dar risada?', icon: '😂' },
  amor: { q: 'Que tal um romance?', icon: '❤️' },
  tensa: { q: 'Quer algo de prender a atenção, com suspense ou ação?', icon: '😮' },
  susto: { q: 'Quer levar um susto? (filme de terror)', icon: '👻' },
  emocionar: { q: 'Quer uma história que emociona?', icon: '🥹' },
};

// "Hoje é dia de ...?"
export const FAV_Q: Partial<Record<Mood, string>> = {
  comedia: 'comédia',
  romance: 'romance',
  drama: 'drama',
  acao: 'ação e aventura',
  suspense: 'suspense',
  desenho: 'desenho ou filme de família',
  novela: 'novela',
  ficcao: 'ficção e fantasia',
};

// Tipos de filme, do jeito que ela fala (usados na tela "Meu gosto")
export const GENRES_Q: { id: Mood | undefined; label: string; icon: string }[] = [
  { id: 'comedia', label: 'Comédia', icon: '😂' },
  { id: 'romance', label: 'Romance', icon: '❤️' },
  { id: 'drama', label: 'Drama', icon: '🎭' },
  { id: 'acao', label: 'Ação e aventura', icon: '💥' },
  { id: 'suspense', label: 'Suspense e mistério', icon: '🔍' },
  { id: 'desenho', label: 'Desenho e família', icon: '🧸' },
  { id: 'novela', label: 'Novela', icon: '💐' },
  { id: 'ficcao', label: 'Ficção e fantasia', icon: '🚀' },
  { id: 'terror', label: 'Terror', icon: '👻' },
  { id: undefined, label: 'Tanto faz', icon: '🤷' },
];

// Tela "Meu gosto": os mesmos tipos + produções brasileiras
export const PICKS: { id: string; label: string; icon: string }[] = [
  ...GENRES_Q.filter((g) => g.id && g.id !== 'terror').map((g) => ({ id: g.id as string, label: g.label, icon: g.icon })),
  { id: 'brasil', label: 'Coisas brasileiras', icon: '🇧🇷' },
];

export const COMPANIES: { id: Company; label: string; icon: string }[] = [
  { id: 'sozinha', label: 'Sozinha', icon: '🙋' },
  { id: 'alguem', label: 'Com alguém', icon: '👫' },
  { id: 'familia', label: 'Em família, com crianças', icon: '🧒' },
  { id: 'amigos', label: 'Com amigos', icon: '🎉' },
];

export const TIMES: { id: TimeBudget; label: string; icon: string }[] = [
  { id: 'curto', label: 'Até 1 hora e meia', icon: '⏱️' },
  { id: 'medio', label: 'Umas 2 horas', icon: '🕑' },
  { id: 'maratona', label: 'Bastante tempo (série ou novela)', icon: '📺' },
];

export const REASONS: { id: Reason; label: string }[] = [
  { id: 'ja_vi', label: 'Já vi' },
  { id: 'nao_curto', label: 'Não curto esse tipo' },
  { id: 'muito_longo', label: 'Muito longo' },
  { id: 'muito_antigo', label: 'Muito antigo' },
  { id: 'nao_e_clima', label: 'Não era isso que eu queria' },
];

export const GENRE_PT: Record<string, string> = {
  Action: 'Ação',
  Adventure: 'Aventura',
  Animation: 'Animação',
  Comedy: 'Comédia',
  Crime: 'Crime',
  Documentary: 'Documentário',
  Drama: 'Drama',
  Family: 'Família',
  Fantasy: 'Fantasia',
  History: 'História',
  Horror: 'Terror',
  Kids: 'Infantil',
  Music: 'Música',
  Mystery: 'Mistério',
  Reality: 'Reality show',
  Romance: 'Romance',
  'Science Fiction': 'Ficção científica',
  Soap: 'Novela',
  Thriller: 'Suspense',
  War: 'Guerra',
  Western: 'Faroeste',
};

export const GENRE_ICON: Record<string, string> = {
  Action: '💥',
  Adventure: '🧭',
  Animation: '🎨',
  Comedy: '😂',
  Crime: '🕵️',
  Documentary: '🎥',
  Drama: '🎭',
  Family: '🏡',
  Fantasy: '✨',
  History: '🏛️',
  Horror: '👻',
  Kids: '🧸',
  Music: '🎵',
  Mystery: '🔍',
  Reality: '📡',
  Romance: '❤️',
  'Science Fiction': '🚀',
  Soap: '💐',
  Thriller: '😱',
  War: '🎖️',
  Western: '🤠',
};
