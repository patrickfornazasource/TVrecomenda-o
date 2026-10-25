// Formato compacto gerado por scripts/build_catalog.py
export interface Item {
  i: number; // id
  t: string; // título (português quando conhecido)
  o?: string; // título original
  y: number; // ano
  k: 'm' | 's'; // filme ou série
  g: number[]; // índices em Catalog.genres; o primeiro é o gênero principal
  r?: number; // duração em minutos
  e?: number; // temporadas
  n?: number; // nota 0-10
  v?: number; // votos
  w?: string[]; // palavras-chave
  br?: 1; // produção brasileira
  s?: string; // sinopse em português
  st?: string[]; // onde assistir no Brasil
  th?: string[]; // temas da história (ver engine/temas.ts)
  en?: string[]; // mini-enredos (ver engine/temas.ts)
  q: 'A' | 'B' | 'C' | 'X'; // camada de qualidade (X = só no onboarding)
}

export interface Catalog {
  genres: string[];
  onboarding: number[];
  items: Item[];
}

export type Mood =
  | 'rir'
  | 'relaxar'
  | 'emocionar'
  | 'adrenalina'
  | 'misterio'
  | 'romance'
  | 'nostalgia'
  | 'familia'
  | 'terror'
  // perguntas diretas por gênero
  | 'comedia'
  | 'drama'
  | 'acao'
  | 'suspense'
  | 'desenho'
  | 'novela'
  | 'ficcao';

export type Company = 'sozinha' | 'alguem' | 'familia' | 'amigos';
export type TimeBudget = 'curto' | 'medio' | 'maratona';

export type Reason = 'ja_vi' | 'nao_curto' | 'muito_longo' | 'muito_antigo' | 'nao_e_clima';

export type Action = 'accepted' | 'rejected' | 'seen' | 'saved' | 'unsaved';

export interface UserEvent {
  titleId: number;
  action: Action;
  reason?: Reason;
  liked?: boolean; // para "Já vi": gostou ou não
  timestamp: number;
}

export interface Profile {
  genres: Record<string, number>; // nome do gênero (inglês) -> peso
  keywords: Record<string, number>;
  brazil: number; // 0..1, preferência por conteúdo nacional
  liked: number[]; // ids marcados no onboarding (versão antiga)
  picks?: string[]; // tipos que ela disse que gosta (tela "Meu gosto")
}

export interface SessionRejection {
  titleId: number;
  reason?: Reason;
}

export interface Context {
  mood?: Mood; // ausente = "Decidir por mim"
  company?: Company;
  time?: TimeBudget;
  type?: 'm' | 's'; // resposta de "Filme ou série?"
  era?: 'antigo' | 'novo'; // resposta de "Mais antigo ou mais novo?"
  themes?: Record<string, boolean>; // perguntas sobre a história: tema ou "e:enredo" -> Sim/Não
  shown: number[]; // já mostrados nesta sessão
  rejections: SessionRejection[];
  now?: number;
}

export interface Pick {
  item: Item;
  score: number;
  why: string;
}

export interface Result {
  main: Pick;
  alternatives: Pick[];
}
