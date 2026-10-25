import { useCallback, useEffect, useRef, useState } from 'react';
import catalogJson from './data/catalogo.json';
import { emptyStats, favorite, firstNode, recordAccepted, recordFav, step, type Node } from './engine/perguntas';
import { enredoLabel, enredoOpcoes, nextFiltro, temaInfo } from './engine/temas';
import { buildProfileFromPicks, candidatePool, emptyProfile, learn, prepare, recommend } from './engine/recommend';
import type { Catalog, Context, Item, Pick, Profile, Reason, UserEvent } from './engine/types';
import { focusFirst, useRemote } from './nav';
import { decidedTonight, load, save, savedIds, type Stored } from './storage';
import { COMPANIES, FAV_Q, GENRE_ICON, GENRE_PT, GENRES_Q, PICKS, REASONS, T, TIMES, YES_NO } from './textos';

const P = prepare(catalogJson as Catalog);

type Screen =
  | { name: 'gosto' }
  | { name: 'home' }
  | { name: 'yn'; node: Node; path: Node[] } // path = perguntas anteriores, para o Voltar
  | { name: 'company' }
  | { name: 'tema'; t: string } // aviso antes dos enredos (triste / cenas fortes)
  | { name: 'enredos'; opts: string[]; page: number; filtro?: string } // filtro = aviso perguntado antes
  | { name: 'time' }
  | { name: 'result' }
  | { name: 'why' }
  | { name: 'seen' }
  | { name: 'extra'; ask: 'type' | 'era' }
  | { name: 'final' }
  | { name: 'decided'; id: number }
  | { name: 'empty' }
  | { name: 'later' }
  | { name: 'laterItem'; id: number }
  | { name: 'history' };

interface Session {
  ctx: Context;
  rejects: number; // recusas seguidas
  askedExtra: boolean;
  favCounted?: boolean; // o Não ao favorito já foi contado nesta noite
  round?: { main: Pick; alternatives: Pick[] };
}

const newSession = (): Session => ({ ctx: { shown: [], rejections: [] }, rejects: 0, askedExtra: false });

const ENREDOS_POR_PAGINA = 8;

export default function App() {
  const [store, setStore] = useState<Stored>(() => load());
  const [screen, setScreen] = useState<Screen>(() => (load().onboarded ? { name: 'home' } : { name: 'gosto' }));
  const [session, setSession] = useState<Session>(newSession);
  const [toast, setToast] = useState('');
  const [spinning, setSpinning] = useState<number | null>(null); // índice destacado na roleta
  const [lastQuestion, setLastQuestion] = useState<Screen>({ name: 'home' }); // Voltar da pergunta do tempo
  const [picked, setPicked] = useState<string[]>(() => load().profile?.picks ?? []);
  const rootRef = useRef<HTMLDivElement>(null);

  const profile: Profile = store.profile ?? emptyProfile();
  const stats = store.moodStats ?? emptyStats();

  const update = useCallback((fn: (s: Stored) => Stored) => {
    setStore((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const addEvent = (e: Omit<UserEvent, 'timestamp'>, prof?: Profile) =>
    update((s) => ({ ...s, events: [...s.events, { ...e, timestamp: Date.now() }], profile: prof ?? s.profile }));

  // foco inicial a cada troca de tela
  const screenKey = JSON.stringify(screen);
  useEffect(() => {
    const t = setTimeout(() => focusFirst(rootRef.current ?? document), 30);
    return () => clearTimeout(t);
  }, [screenKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- fluxo ----------

  const runRound = (s: Session, events = store.events, prof = profile): Session | null => {
    const r = recommend(P, prof, { ...s.ctx, now: Date.now() }, events);
    if (!r) return null;
    const ids = [r.main.item.i, ...r.alternatives.map((a) => a.item.i)];
    return { ...s, round: r, ctx: { ...s.ctx, shown: [...s.ctx.shown, ...ids] } };
  };

  const showRound = (s: Session, events?: UserEvent[], prof?: Profile, next: Screen = { name: 'result' }) => {
    const r = runRound(s, events, prof);
    if (!r) {
      setSession(s);
      setScreen({ name: 'empty' });
      return;
    }
    setSession(r);
    setScreen(next);
  };

  const start = () => {
    setSession(newSession());
    setScreen({ name: 'yn', node: firstNode(stats, profile.picks), path: [] });
  };

  const decideForMe = () => {
    const s = newSession();
    s.ctx.company = (store.lastCompany as Context['company']) ?? 'sozinha';
    s.ctx.time = 'medio';
    showRound(s);
  };

  const poolOf = (s: Session) => {
    const ctx = { ...s.ctx, now: Date.now() };
    return { ctx, pool: candidatePool(P, profile, ctx, store.events) };
  };

  /** Depois da companhia: um aviso, se fizer sentido, e depois a lista de enredos. */
  const askTema = (s: Session) => {
    const { ctx, pool } = poolOf(s);
    const t = nextFiltro(pool, ctx);
    if (!t) return askEnredos(s);
    setSession(s);
    setScreen({ name: 'tema', t });
  };

  const askEnredos = (s: Session, filtro?: string) => {
    const { ctx, pool } = poolOf(s);
    const opts = enredoOpcoes(pool, ctx);
    if (opts.length < 2) return showRound(s);
    setSession(s);
    setScreen({ name: 'enredos', opts, page: 0, filtro });
  };

  const accept = (it: Item) => {
    const prof = learn(P, profile, it.i, 'accepted');
    update((s) => ({
      ...s,
      profile: prof,
      events: [...s.events, { titleId: it.i, action: 'accepted', timestamp: Date.now() }],
      decided: { titleId: it.i, at: Date.now() },
      lastCompany: session.ctx.company ?? s.lastCompany,
      moodStats: recordAccepted(s.moodStats ?? emptyStats(), session.ctx.mood),
    }));
    setScreen({ name: 'decided', id: it.i });
  };

  /** Depois de uma recusa: decide se pergunta algo, mostra a definitiva ou faz nova rodada. */
  const afterReject = (s: Session, events: UserEvent[], prof: Profile) => {
    const rejects = s.rejects + 1;
    const next = { ...s, rejects };
    if (rejects >= 3 && !s.askedExtra) {
      setSession(next);
      setScreen({ name: 'extra', ask: s.ctx.time === 'maratona' || s.ctx.type || s.ctx.mood === 'novela' ? 'era' : 'type' });
      return;
    }
    if (s.askedExtra && rejects >= 4) {
      showRound(next, events, prof, { name: 'final' });
      return;
    }
    showRound(next, events, prof);
  };

  const reject = (reason?: Reason) => {
    const main = session.round!.main.item;
    let prof = profile;
    const ev: UserEvent[] = [];
    const now = Date.now();
    if (reason === 'ja_vi') ev.push({ titleId: main.i, action: 'seen', timestamp: now });
    else ev.push({ titleId: main.i, action: 'rejected', reason, timestamp: now });
    if (reason === 'nao_curto') prof = learn(P, profile, main.i, 'disliked');
    const events = [...store.events, ...ev];
    update((s) => ({ ...s, events, profile: prof }));
    const s = { ...session, ctx: { ...session.ctx, rejections: [...session.ctx.rejections, { titleId: main.i, reason }] } };
    afterReject(s, events, prof);
  };

  const seen = (liked?: boolean) => {
    const main = session.round!.main.item;
    const prof = liked === undefined ? profile : learn(P, profile, main.i, liked ? 'liked' : 'disliked');
    const events = [...store.events, { titleId: main.i, action: 'seen' as const, liked, timestamp: Date.now() }];
    update((s) => ({ ...s, events, profile: prof }));
    afterReject(session, events, prof);
  };

  const swapMain = (idx: number) => {
    const r = session.round!;
    const alts = [...r.alternatives];
    const chosen = alts[idx];
    alts[idx] = r.main;
    setSession({ ...session, round: { main: chosen, alternatives: alts } });
    setTimeout(() => (document.querySelector('[data-autofocus]') as HTMLElement | null)?.focus(), 40);
  };

  const saveLater = (it: Item) => {
    addEvent({ titleId: it.i, action: 'saved' });
    setToast(T.guardado);
  };

  // durante o sorteio os botões continuam focáveis, mas não fazem nada
  const idle = (fn: () => void) => () => {
    if (spinning === null) fn();
  };

  const spin = () => {
    const r = session.round!;
    const n = 1 + r.alternatives.length;
    const winner = Math.floor(Math.random() * n);
    const steps = 12 + winner + n * 2;
    let k = 0;
    const tick = () => {
      setSpinning(k % n);
      k++;
      if (k <= steps) setTimeout(tick, 80 + k * 12);
      else
        setTimeout(() => {
          setSpinning(null);
          if (winner > 0) swapMain(winner - 1);
          setTimeout(() => (document.querySelector('[data-autofocus]') as HTMLElement | null)?.focus(), 40);
        }, 600);
    };
    tick();
  };

  const finishGosto = (picks: string[]) => {
    // mantém o que o app já aprendeu com as escolhas dela e troca só a parte dos tipos marcados
    update((s) => {
      const base = buildProfileFromPicks(P, picks);
      const old = s.profile;
      const profile = old && !picks.length ? old : { ...base, keywords: old?.keywords ?? {}, liked: old?.liked ?? [] };
      return { ...s, onboarded: true, profile };
    });
    setScreen({ name: 'home' });
  };

  // ---------- Voltar ----------
  const onBack = useCallback((): boolean => {
    if (spinning !== null) return true;
    switch (screen.name) {
      case 'home':
        return false; // sai do app
      case 'gosto':
        if (store.onboarded) setScreen({ name: 'home' });
        else return false;
        return true;
      case 'yn': {
        const prev = screen.path[screen.path.length - 1];
        setScreen(prev ? { name: 'yn', node: prev, path: screen.path.slice(0, -1) } : { name: 'home' });
        return true;
      }
      case 'time':
        setScreen(lastQuestion);
        return true;
      case 'company':
        setScreen({ name: 'time' });
        return true;
      case 'tema':
        setScreen({ name: 'company' });
        return true;
      case 'enredos': {
        if (screen.page > 0) {
          setScreen({ ...screen, page: screen.page - 1 });
          return true;
        }
        const { filtro } = screen;
        if (!filtro) {
          setScreen({ name: 'company' });
          return true;
        }
        const themes = { ...session.ctx.themes };
        delete themes[filtro];
        setSession({ ...session, ctx: { ...session.ctx, themes } });
        setScreen({ name: 'tema', t: filtro });
        return true;
      }
      case 'why':
      case 'seen':
        setScreen({ name: 'result' });
        return true;
      case 'laterItem':
        setScreen({ name: 'later' });
        return true;
      default:
        setScreen({ name: 'home' });
        return true;
    }
  }, [screen, spinning, store.onboarded, lastQuestion, session]);
  useRemote(onBack);

  // ---------- telas ----------
  let body: JSX.Element;
  switch (screen.name) {
    case 'gosto':
      body = (
        <Gosto
          picked={picked}
          setPicked={setPicked}
          done={() => finishGosto(picked)}
          skip={() => finishGosto(store.onboarded ? picked : [])}
        />
      );
      break;

    case 'home': {
      const tonight = decidedTonight(store);
      const it = tonight != null ? P.byId.get(tonight) : undefined;
      const nSaved = savedIds(store.events).length;
      body = (
        <div className="screen home">
          <div className="brand">🍿 {T.appName}</div>
          {it ? (
            <div className="tonight">
              <p className="muted big">{T.inicioJaDecidido}</p>
              <h1 className="title-xl">{it.t}</h1>
              <p className="big">{T.inicioBomFilme}</p>
              <div className="row">
                <button className="btn primary" data-autofocus onClick={() => setScreen({ name: 'decided', id: it.i })}>
                  👍 Ok
                </button>
                <button className="btn" onClick={start}>
                  {T.inicioOutro}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn hero" data-autofocus onClick={start}>
                {T.inicioPergunta}
              </button>
              <button className="btn secondary" onClick={decideForMe}>
                🎯 {T.inicioDecidir}
              </button>
            </>
          )}
          <div className="row small-row">
            <button className="btn small" onClick={() => setScreen({ name: 'later' })}>
              🔖 {T.inicioDepois(nSaved)}
            </button>
            <button className="btn small" onClick={() => setScreen({ name: 'history' })}>
              ✅ {T.inicioHistorico}
            </button>
            <button className="btn small" onClick={() => setScreen({ name: 'gosto' })}>
              ❤️ {T.inicioGosto}
            </button>
          </div>
        </div>
      );
      break;
    }

    case 'yn': {
      const { node, path } = screen;
      const fav = node === 'fav' ? favorite(stats, profile.picks) : null;
      const q = fav ? { q: `Hoje é dia de ${FAV_Q[fav]}?`, icon: GENRES_Q.find((g) => g.id === fav)?.icon ?? '⭐' } : YES_NO[node as Exclude<Node, 'fav'>];
      const choose = (mood: Context['mood']) => {
        // começou pelo favorito e acabou em outro gênero: conta como um Não ao favorito
        const startFav = (path[0] ?? node) === 'fav' ? favorite(stats, profile.picks) : null;
        const countIt = !!startFav && mood !== startFav && !session.favCounted;
        if (countIt) update((s) => ({ ...s, moodStats: recordFav(s.moodStats ?? emptyStats(), startFav!, 'nao') }));
        setSession({ ...session, favCounted: session.favCounted || countIt, ctx: { ...session.ctx, mood } });
        setLastQuestion(screen);
        setScreen({ name: 'time' });
      };
      const answer = (a: 'sim' | 'nao') => {
        const next = fav ? (a === 'sim' ? { mood: fav } : { node: 'leve' as Node }) : step(node as Exclude<Node, 'fav'>, a);
        if ('node' in next) setScreen({ name: 'yn', node: next.node, path: [...path, node] });
        else choose(next.mood);
      };
      body = (
        <div className="screen ask yn" key={node}>
          <p className="kicker">{T.kickerSimNao}</p>
          <div className="yn-q">
            <span className="yn-icon">{q.icon}</span>
            <h1 className="title-xl">{q.q}</h1>
          </div>
          <div className="row yn-row">
            <button className="btn choice yn-btn primary" data-autofocus onClick={() => answer('sim')}>
              {T.sim}
            </button>
            <button className="btn choice yn-btn" onClick={() => answer('nao')}>
              {T.nao}
            </button>
            <button className="btn choice yn-btn ghost" onClick={() => choose(undefined)}>
              {T.tantoFazGenero}
            </button>
          </div>
          <button className="btn small back" onClick={onBack}>
            ◀ {T.voltar}
          </button>
        </div>
      );
      break;
    }

    case 'time':
      body = (
        <Question kicker={T.kickerTempo} title={T.qTempo} back={() => setScreen(lastQuestion)} cols={3}>
          {TIMES.map((t, idx) => (
            <button
              key={t.id}
              className="btn choice"
              data-autofocus={idx === (session.ctx.mood === 'novela' ? 2 : 1) || undefined}
              onClick={() => {
                setSession({ ...session, ctx: { ...session.ctx, time: t.id } });
                setScreen({ name: 'company' });
              }}
            >
              <span className="icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </Question>
      );
      break;

    case 'company':
      body = (
        <Question kicker={T.kickerCompanhia} title={T.qCompanhia} back={() => setScreen({ name: 'time' })} cols={4}>
          {COMPANIES.map((c, idx) => (
            <button
              key={c.id}
              className="btn choice"
              data-autofocus={idx === 0 || undefined}
              onClick={() => askTema({ ...session, ctx: { ...session.ctx, company: c.id, themes: {} } })}
            >
              <span className="icon">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </Question>
      );
      break;

    case 'tema': {
      const { t } = screen;
      const tema = temaInfo(t)!;
      const answer = (a: boolean | null) => {
        const themes = { ...session.ctx.themes };
        if (a !== null) themes[t] = a;
        askEnredos({ ...session, ctx: { ...session.ctx, themes } }, t);
      };
      body = (
        <div className="screen ask yn" key={t}>
          <p className="kicker">{T.kickerTema}</p>
          <div className="yn-q">
            <span className="yn-icon">{tema.icon}</span>
            <h1 className="title-xl">{tema.q}</h1>
          </div>
          <div className="row yn-row">
            <button className="btn choice yn-btn primary" data-autofocus onClick={() => answer(true)}>
              {T.sim}
            </button>
            <button className="btn choice yn-btn" onClick={() => answer(false)}>
              {T.nao}
            </button>
            <button className="btn choice yn-btn ghost" onClick={() => answer(null)}>
              {T.tantoFazGenero}
            </button>
          </div>
          <div className="row yn-foot">
            <button className="btn small" onClick={onBack}>
              ◀ {T.voltar}
            </button>
            <button className="btn small" onClick={() => showRound(session)}>
              {T.podeEscolher} ▶
            </button>
          </div>
        </div>
      );
      break;
    }

    case 'enredos': {
      const { opts, page } = screen;
      const pages = Math.ceil(opts.length / ENREDOS_POR_PAGINA);
      const shown = opts.slice(page * ENREDOS_POR_PAGINA, (page + 1) * ENREDOS_POR_PAGINA);
      const pick = (t: string) => showRound({ ...session, ctx: { ...session.ctx, themes: { ...session.ctx.themes, [t]: true } } });
      body = (
        <div className="screen ask enredos" key={'enredos' + page}>
          <p className="kicker">
            {T.kickerTema}
            {pages > 1 && ` · ${page + 1} de ${pages}`}
          </p>
          <h1 className="title-xl">{T.qEnredo}</h1>
          <div className="grid cols-4 enredo-grid">
            {shown.map((t, idx) => (
              <button key={t} className="btn choice enredo" data-autofocus={idx === 0 || undefined} onClick={() => pick(t)}>
                <span className="icon">{temaInfo(t)!.icon}</span>
                {enredoLabel(t)}
              </button>
            ))}
          </div>
          <div className="row yn-foot">
            <button className="btn small" onClick={onBack}>
              ◀ {T.voltar}
            </button>
            {pages > 1 && (
              <button className="btn small" onClick={() => setScreen({ ...screen, page: (page + 1) % pages })}>
                {page + 1 < pages ? T.maisEnredos : T.primeirosEnredos} ▶
              </button>
            )}
            <button className="btn small" onClick={() => showRound(session)}>
              {T.tantoFazEnredo} ▶
            </button>
          </div>
        </div>
      );
      break;
    }

    case 'result':
    case 'final': {
      const r = session.round!;
      const final = screen.name === 'final';
      body = (
        <div className="screen result">
          <p className="kicker">{final ? T.definitiva : T.resTitulo}</p>
          <div className="result-grid">
            <div className={'main-card' + (spinning === 0 ? ' spin-hit' : '')}>
              <BigCard pick={r.main} />
              <div className="row actions">
                <button className="btn primary" data-autofocus onClick={idle(() => accept(r.main.item))}>
                  ▶ {T.vamos}
                </button>
                {!final && (
                  <>
                    <button className="btn" onClick={idle(() => setScreen({ name: 'why' }))}>
                      🔄 {T.outra}
                    </button>
                    <button className="btn" onClick={idle(() => setScreen({ name: 'seen' }))}>
                      👀 {T.jaVi}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="alts">
              {!final && <p className="muted">{T.resAlternativas}</p>}
              {!final &&
                r.alternatives.map((a, idx) => (
                  <button key={a.item.i} className={'alt-card' + (spinning === idx + 1 ? ' spin-hit' : '')} onClick={idle(() => swapMain(idx))}>
                    <SmallCard item={a.item} />
                  </button>
                ))}
              <div className="alt-actions">
                <button className="btn" onClick={idle(() => saveLater(r.main.item))}>
                  🔖 {T.depois}
                </button>
                {r.alternatives.length > 0 && (
                  <button className="btn" onClick={idle(spin)}>
                    🎲 {spinning !== null ? T.sorteando : T.sortear}
                  </button>
                )}
              </div>
            </div>
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>
      );
      break;
    }

    case 'why':
      body = (
        <div className="screen ask">
          <h1 className="title-l">{T.porQue}</h1>
          <p className="muted big">{T.porQueSub}</p>
          <div className="grid cols-3">
            {REASONS.map((r, idx) => (
              <button key={r.id} className="btn choice short" data-autofocus={idx === 0 || undefined} onClick={() => reject(r.id)}>
                {r.label}
              </button>
            ))}
            <button className="btn choice short ghost" onClick={() => reject(undefined)}>
              {T.pular}
            </button>
          </div>
        </div>
      );
      break;

    case 'seen':
      body = (
        <div className="screen ask">
          <h1 className="title-l">{T.gostou}</h1>
          <p className="muted big">{session.round?.main.item.t}</p>
          <div className="grid cols-3">
            <button className="btn choice short" data-autofocus onClick={() => seen(true)}>
              👍 {T.gostei}
            </button>
            <button className="btn choice short" onClick={() => seen(false)}>
              👎 {T.naoGostei}
            </button>
            <button className="btn choice short ghost" onClick={() => seen(undefined)}>
              {T.pular}
            </button>
          </div>
        </div>
      );
      break;

    case 'extra': {
      const isType = screen.ask === 'type';
      const choose = (patch: Partial<Context>) => showRound({ ...session, askedExtra: true, ctx: { ...session.ctx, ...patch } });
      body = (
        <div className="screen ask">
          <p className="kicker">{T.faltando}</p>
          <h1 className="title-l">{isType ? T.filmeOuSerie : T.antigoOuNovo}</h1>
          <div className="grid cols-3">
            {isType ? (
              <>
                <button className="btn choice" data-autofocus onClick={() => choose({ type: 'm', time: session.ctx.time === 'maratona' ? 'medio' : session.ctx.time })}>
                  <span className="icon">🎬</span>
                  {T.filme}
                </button>
                <button className="btn choice" onClick={() => choose({ type: 's', time: 'maratona' })}>
                  <span className="icon">📺</span>
                  {T.serie}
                </button>
              </>
            ) : (
              <>
                <button className="btn choice" data-autofocus onClick={() => choose({ era: 'antigo' })}>
                  <span className="icon">📻</span>
                  {T.antigo}
                </button>
                <button className="btn choice" onClick={() => choose({ era: 'novo' })}>
                  <span className="icon">✨</span>
                  {T.novo}
                </button>
              </>
            )}
            <button className="btn choice ghost" onClick={() => choose({})}>
              <span className="icon">🤷</span>
              {T.tantoFaz}
            </button>
          </div>
        </div>
      );
      break;
    }

    case 'decided': {
      const it = P.byId.get(screen.id)!;
      body = (
        <div className="screen decided">
          <div className="confetti">🎉</div>
          <h1 className="title-xl accent">{T.decidido}</h1>
          <h2 className="title-l">{it.t}</h2>
          <p className="big muted">{meta(it).join(' · ')}</p>
          {it.st?.length ? (
            <p className="big where">
              📺 {T.ondeAssistir} <strong>{it.st.join(', ')}</strong>
            </p>
          ) : null}
          <p className="title-l">{it.k === 's' ? T.bomSerie : T.bomFilme} 🍿</p>
          <button className="btn primary" data-autofocus onClick={() => setScreen({ name: 'home' })}>
            {T.inicio}
          </button>
        </div>
      );
      break;
    }

    case 'empty':
      body = (
        <div className="screen ask">
          <h1 className="title-l">{T.nadaAchado}</h1>
          <button className="btn primary" data-autofocus onClick={start}>
            {T.recomecar}
          </button>
        </div>
      );
      break;

    case 'later': {
      const ids = savedIds(store.events).slice(0, 12);
      body = (
        <ListScreen title={T.depoisTitulo} empty={T.depoisVazio} back={() => setScreen({ name: 'home' })}>
          {ids.map((id) => (
            <button key={id} className="tile" onClick={() => setScreen({ name: 'laterItem', id })}>
              <SmallCard item={P.byId.get(id)!} />
            </button>
          ))}
        </ListScreen>
      );
      break;
    }

    case 'laterItem': {
      const it = P.byId.get(screen.id)!;
      body = (
        <div className="screen result">
          <p className="kicker">{T.depoisTitulo}</p>
          <div className="main-card solo">
            <BigCard pick={{ item: it, score: 0, why: '' }} />
            <div className="row actions">
              <button className="btn primary" data-autofocus onClick={() => accept(it)}>
                ▶ {T.assistirEste}
              </button>
              <button
                className="btn"
                onClick={() => {
                  addEvent({ titleId: it.i, action: 'unsaved' });
                  setScreen({ name: 'later' });
                }}
              >
                🗑️ {T.tirarLista}
              </button>
              <button className="btn" onClick={() => setScreen({ name: 'later' })}>
                {T.voltar}
              </button>
            </div>
          </div>
        </div>
      );
      break;
    }

    case 'history': {
      const seenList = [...store.events]
        .reverse()
        .filter((e) => e.action === 'accepted' || e.action === 'seen')
        .filter((e, idx, arr) => arr.findIndex((x) => x.titleId === e.titleId) === idx)
        .slice(0, 12);
      body = (
        <ListScreen title={T.historicoTitulo} empty={T.historicoVazio} back={() => setScreen({ name: 'home' })}>
          {seenList.map((e) => (
            <div key={e.titleId} className="tile static" data-focus tabIndex={0}>
              <SmallCard item={P.byId.get(e.titleId)!} note={e.action === 'accepted' ? T.historicoEscolhido : T.historicoJaVi} />
            </div>
          ))}
        </ListScreen>
      );
      break;
    }
  }

  return (
    <div className="stage" ref={rootRef}>
      {body}
    </div>
  );
}

// ---------- componentes ----------

function genresPt(it: Item) {
  return it.g.map((g) => GENRE_PT[P.catalog.genres[g]] ?? P.catalog.genres[g]);
}

function kindLabel(it: Item) {
  if (it.k === 'm') return 'Filme';
  return it.g.some((g) => P.catalog.genres[g] === 'Soap') ? 'Novela' : 'Série';
}

function duration(it: Item) {
  if (it.k === 's') return it.e ? `${it.e} temporada${it.e > 1 ? 's' : ''}` : '';
  if (!it.r) return '';
  const h = Math.floor(it.r / 60);
  const m = it.r % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

function meta(it: Item) {
  return [kindLabel(it), String(it.y), duration(it)].filter(Boolean);
}

function icon(it: Item) {
  return GENRE_ICON[P.catalog.genres[it.g[0]]] ?? '🎬';
}

function hue(it: Item) {
  return (it.g[0] * 47 + 200) % 360;
}

function BigCard({ pick }: { pick: Pick }) {
  const it = pick.item;
  return (
    <div className="big-card" style={{ ['--h' as string]: hue(it) }}>
      <div className="poster">
        <span>{icon(it)}</span>
      </div>
      <div className="info">
        <h1 className="title-l">{it.t}</h1>
        {it.o && <p className="orig">{it.o}</p>}
        <p className="meta">
          {meta(it).join(' · ')}
          {it.n != null && <span className="stars"> · ★ {it.n.toFixed(1).replace('.', ',')}</span>}
        </p>
        <p className="genres">{genresPt(it).slice(0, 3).join(' · ')}</p>
        {it.s && <p className="synopsis">{it.s}</p>}
        {pick.why && <p className="why">💡 {pick.why}</p>}
        {it.st?.length ? (
          <p className="where">
            📺 {T.ondeAssistir} <strong>{it.st.join(', ')}</strong>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SmallCard({ item, note, check }: { item: Item; note?: string; check?: boolean }) {
  return (
    <div className="small-card" style={{ ['--h' as string]: hue(item) }}>
      <span className="s-icon">{check ? '✅' : icon(item)}</span>
      <span className="s-text">
        <span className="s-title">{item.t}</span>
        <span className="s-meta">{note ?? meta(item).slice(0, 2).join(' · ')}</span>
      </span>
    </div>
  );
}

function Question(props: { kicker: string; title: string; back: () => void; cols: number; children: React.ReactNode }) {
  return (
    <div className="screen ask">
      <p className="kicker">{props.kicker}</p>
      <h1 className="title-l">{props.title}</h1>
      <div className={`grid cols-${props.cols}`}>{props.children}</div>
      <button className="btn small back" onClick={props.back}>
        ◀ {T.voltar}
      </button>
    </div>
  );
}

function ListScreen(props: { title: string; empty: string; back: () => void; children: React.ReactNode[] }) {
  return (
    <div className="screen list">
      <h1 className="title-l">{props.title}</h1>
      {props.children.length ? <div className="grid cols-4 tiles">{props.children}</div> : <p className="big muted">{props.empty}</p>}
      <button className="btn small back" data-autofocus={!props.children.length || undefined} onClick={props.back}>
        ◀ {T.voltar}
      </button>
    </div>
  );
}

function Gosto(props: { picked: string[]; setPicked: (ids: string[]) => void; done: () => void; skip: () => void }) {
  const toggle = (id: string) =>
    props.setPicked(props.picked.includes(id) ? props.picked.filter((x) => x !== id) : [...props.picked, id]);
  return (
    <div className="screen onboarding">
      <div className="onb-head">
        <div>
          <h1 className="title-l">{T.gostoTitulo}</h1>
          <p className="muted">{T.gostoSub}</p>
        </div>
      </div>
      <div className="grid cols-3 tiles onb-grid">
        {PICKS.map((g, idx) => {
          const on = props.picked.includes(g.id);
          return (
            <button key={g.id} className={'tile pick' + (on ? ' on' : '')} data-autofocus={idx === 0 || undefined} onClick={() => toggle(g.id)} aria-pressed={on}>
              <span className="pick-icon">{on ? '✅' : g.icon}</span>
              <span className="pick-label">{g.label}</span>
            </button>
          );
        })}
      </div>
      <div className="row onb-actions">
        <button className={'btn' + (props.picked.length ? ' primary' : '')} onClick={props.done}>
          ✔ {T.gostoPronto}
        </button>
        {!props.picked.length && (
          <button className="btn ghost" onClick={props.skip}>
            {T.gostoPular}
          </button>
        )}
      </div>
    </div>
  );
}
