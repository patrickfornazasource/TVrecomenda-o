// Onde assistir: a TV Box pergunta ao TMDB (dados da JustWatch) em quais plataformas do Brasil
// o título está agora, e guarda a resposta por uma semana. Sem chave ou sem internet, usa o que
// veio na base (campo st), quando tem.
import { useEffect, useState } from 'react';
import type { Item } from './engine/types';

// A chave fica fora do Git: arquivo .env.local com VITE_TMDB_KEY=... (ver LEIA-ME)
const KEY = (import.meta.env.VITE_TMDB_KEY as string | undefined)?.trim();
const API = 'https://api.themoviedb.org/3';
const SEMANA = 7 * 24 * 3600 * 1000;

export interface Onde {
  assinatura: string[]; // está no plano (ou grátis)
  aluguel: string[]; // dá para alugar ou comprar
}

type Provider = { provider_name: string };

/** "Amazon Prime Video" vira "Prime Video"; some com as versões "com anúncios" e os "Channel". */
function limpa(list: Provider[] | undefined): string[] {
  const out: string[] = [];
  for (const p of list ?? []) {
    let n = p.provider_name
      .replace(/^Amazon Prime Video$/, 'Prime Video')
      .replace(/^Amazon Video$/, 'Prime Video')
      .replace(/^Google Play Movies$/, 'Google Play')
      .replace(/\s+(Standard|Basic)?\s*with Ads$/i, '')
      .replace(/^Max Amazon Channel$/, 'Max');
    if (/Channel$/i.test(n)) continue;
    n = n.trim();
    if (!out.includes(n)) out.push(n);
  }
  return out.slice(0, 4);
}

async function get(path: string, params: Record<string, string> = {}) {
  const v4 = KEY!.length > 40; // token de leitura (v4) ou chave curta (v3)
  const q = new URLSearchParams(v4 ? params : { ...params, api_key: KEY! });
  const r = await fetch(`${API}${path}?${q}`, v4 ? { headers: { Authorization: `Bearer ${KEY}` } } : undefined);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function busca(it: Item): Promise<Onde> {
  const tipo = it.k === 's' ? 'tv' : 'movie';
  const ano = it.k === 's' ? 'first_air_date_year' : 'year';
  const achados: { id: number }[] = (await get(`/search/${tipo}`, { query: it.o ?? it.t, [ano]: String(it.y), language: 'pt-BR' })).results ?? [];
  if (!achados.length) return { assinatura: [], aluguel: [] };
  const br = (await get(`/${tipo}/${achados[0].id}/watch/providers`)).results?.BR ?? {};
  const assinatura = limpa([...(br.flatrate ?? []), ...(br.free ?? []), ...(br.ads ?? [])]);
  const aluguel = limpa([...(br.rent ?? []), ...(br.buy ?? [])]).filter((n) => !assinatura.includes(n));
  return { assinatura, aluguel };
}

function lerCache(id: number): Onde | null {
  try {
    const c = JSON.parse(localStorage.getItem('onde:' + id) ?? 'null');
    return c && Date.now() - c.t < SEMANA ? c.v : null;
  } catch {
    return null;
  }
}

/** undefined = procurando; null = não deu para saber. */
export function useOnde(it: Item): Onde | null | undefined {
  const base: Onde | null = it.st?.length ? { assinatura: it.st, aluguel: [] } : null;
  const [onde, setOnde] = useState<Onde | null | undefined>(() => (KEY ? (lerCache(it.i) ?? undefined) : base));
  useEffect(() => {
    if (!KEY) return setOnde(base);
    const cached = lerCache(it.i);
    if (cached) return setOnde(cached);
    setOnde(undefined);
    let vivo = true;
    busca(it)
      .then((v) => {
        try {
          localStorage.setItem('onde:' + it.i, JSON.stringify({ t: Date.now(), v }));
        } catch {
          /* sem espaço: tudo bem */
        }
        if (vivo) setOnde(v);
      })
      .catch(() => vivo && setOnde(base));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it.i]);
  return onde;
}
