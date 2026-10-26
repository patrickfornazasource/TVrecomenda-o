import { useCallback, useEffect, useRef, useState } from 'react';
import catalogJson from './data/catalogo.json';
import { emptyStats, favorite, firstNode, recordAccepted, recordFav, step, type Node } from './engine/perguntas';
import { temaInfo } from './engine/temas';
import { MAX_AKIN, nextAkinator } from './engine/akinator';
import { buildProfileFromPicks, candidatePool, emptyProfile, learn, prepare, recommend } from './engine/recommend';
import type { Catalog, Context, Item, Pick, Profile, Reason, UserEvent } from './engine/types';
import { focusFirst, useRemote } from './nav';
import { decidedTonight, load, save, savedIds, type Stored } from './storage';
import { COMPANIES, FAV_Q, GENRE_PT, PICKS, REASONS, T, TIMES, YES_NO } from './textos';
import { Ico } from './icones';
import { useOnde } from './onde';

const P = prepare(catalogJson as Catalog);

type Screen =
  | { name: 'gosto' }
  | { name: 'home' }
  | { name: 'yn'; node: Node; path: Node[] } // path = perguntas anteriores, para o Voltar
  | { name: 'company' }
  | { name: 'akin'; t: string; asked: string[] } // perguntas no estilo Akinator; asked = as anteriores
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

// Cor de seção de cada tela, como nas seções de uma revista de programação
const SCREEN_TONE: Record<Screen['name'], string> = {
  gosto: 'tomate',
  home: 'tomate',
  yn: 'tomate',
  time: 'tomate',
  company: 'tomate',
  extra: 'tomate',
  akin: 'gema',
  result: 'petroleo',
  final: 'petroleo',
  why: 'petroleo',
  seen: 'petroleo',
  empty: 'petroleo',
  decided: 'gema',
  later: 'rosa',
  laterItem: 'rosa',
  history: 'rosa',
};

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

  /** Depois da companhia: perguntas no estilo Akinator, só com filmes, até sobrar pouca coisa. */
  const askAkin = (s: Session, asked: string[]) => {
    const ctx = { ...s.ctx, now: Date.now() };
    const t = nextAkinator(candidatePool(P, profile, ctx, store.events), ctx, asked);
    if (!t) return showRound(s);
    setSession(s);
    setScreen({ name: 'akin', t, asked });
  };

  const afterCompany = (s: Session) => {
    // "Bastante tempo" é série ou novela: aí não tem Akinator
    if (s.ctx.time === 'maratona') return showRound(s);
    askAkin({ ...s, ctx: { ...s.ctx, type: 'm', themes: {} } }, []);
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
      case 'akin': {
        const prev = screen.asked[screen.asked.length - 1];
        if (!prev) {
          setScreen({ name: 'company' });
          return true;
        }
        const themes = { ...session.ctx.themes };
        delete themes[prev];
        setSession({ ...session, ctx: { ...session.ctx, themes } });
        setScreen({ name: 'akin', t: prev, asked: screen.asked.slice(0, -1) });
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
          <header className="cover-mast">
            <p className="logo">{T.appName}</p>
            <p className="cover-date">{hoje()}</p>
          </header>
          {it ? (
            <div className="cover-main">
              <p className="lede">{T.inicioJaDecidido}</p>
              <h1 className="display">{it.t}</h1>
              <p className="lede">{T.inicioBomFilme}</p>
              <div className="row">
                <button className="btn primary" data-autofocus onClick={() => setScreen({ name: 'decided', id: it.i })}>
                  <Ico name="Check" /> Ok
                </button>
                <button className="btn" onClick={start}>
                  {T.inicioOutro}
                </button>
              </div>
            </div>
          ) : (
            <div className="cover-main">
              <button className="btn hero" data-autofocus onClick={start}>
                <span>{T.inicioPergunta}</span>
                <Ico name="ChevronRight" className="hero-arrow" />
              </button>
              <button className="btn secondary" onClick={decideForMe}>
                <Ico name="Dices" /> {T.inicioDecidir}
              </button>
            </div>
          )}
          <nav className="row small-row">
            <button className="btn small quiet" onClick={() => setScreen({ name: 'later' })}>
              <Ico name="Bookmark" /> {T.inicioDepois(nSaved)}
            </button>
            <button className="btn small quiet" onClick={() => setScreen({ name: 'history' })}>
              <Ico name="History" /> {T.inicioHistorico}
            </button>
            <button className="btn small quiet" onClick={() => setScreen({ name: 'gosto' })}>
              <Ico name="Heart" /> {T.inicioGosto}
            </button>
          </nav>
        </div>
      );
      break;
    }

    case 'yn': {
      const { node, path } = screen;
      const fav = node === 'fav' ? favorite(stats, profile.picks) : null;
      const q = fav ? { q: `Hoje é dia de ${FAV_Q[fav]}?` } : YES_NO[node as Exclude<Node, 'fav'>];
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
          <div className="yn-q">
            <h1 className="display">{q.q}</h1>
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
          <div className="row foot">
            <button className="btn small quiet" onClick={onBack}>
              <Ico name="ChevronLeft" /> {T.voltar}
            </button>
          </div>
        </div>
      );
      break;
    }

    case 'time':
      body = (
        <Question title={T.qTempo} back={() => setScreen(lastQuestion)} cols={3}>
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
              <Ico name={t.icon} className="choice-ico" />
              {t.label}
            </button>
          ))}
        </Question>
      );
      break;

    case 'company':
      body = (
        <Question title={T.qCompanhia} back={() => setScreen({ name: 'time' })} cols={4}>
          {COMPANIES.map((c, idx) => (
            <button
              key={c.id}
              className="btn choice"
              data-autofocus={idx === 0 || undefined}
              onClick={() => afterCompany({ ...session, ctx: { ...session.ctx, company: c.id } })}
            >
              <Ico name={c.icon} className="choice-ico" />
              {c.label}
            </button>
          ))}
        </Question>
      );
      break;

    case 'akin': {
      const { t, asked } = screen;
      const answer = (a: boolean | null) => {
        const themes = { ...session.ctx.themes };
        if (a !== null) themes[t] = a;
        askAkin({ ...session, ctx: { ...session.ctx, themes } }, [...asked, t]);
      };
      body = (
        <div className="screen ask yn" key={t}>
          <div className="yn-q">
            <h1 className="display">{temaInfo(t)!.q}</h1>
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
          <div className="row foot">
            <button className="btn small quiet" onClick={onBack}>
              <Ico name="ChevronLeft" /> {T.voltar}
            </button>
            <span className="akin-count">{T.perguntaN(asked.length + 1, MAX_AKIN)}</span>
            <button className="btn small quiet" onClick={() => showRound(session)}>
              {T.podeEscolher} <Ico name="ChevronRight" />
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
          <div className="result-grid">
            <div className={'main-card' + (spinning === 0 ? ' spin-hit' : '')}>
              <BigCard pick={r.main} label={final ? T.definitiva : T.resTitulo} />
              <div className="row actions">
                <button className="btn primary" data-autofocus onClick={idle(() => accept(r.main.item))}>
                  <Ico name="Play" /> {T.vamos}
                </button>
                {!final && (
                  <>
                    <button className="btn" onClick={idle(() => setScreen({ name: 'why' }))}>
                      <Ico name="RefreshCw" /> {T.outra}
                    </button>
                    <button className="btn" onClick={idle(() => setScreen({ name: 'seen' }))}>
                      <Ico name="Eye" /> {T.jaVi}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="alts">
              {!final && r.alternatives.length > 0 && <h2 className="alts-head">{T.resAlternativas}</h2>}
              {!final &&
                r.alternatives.map((a, idx) => (
                  <button key={a.item.i} className={'alt-card' + (spinning === idx + 1 ? ' spin-hit' : '')} onClick={idle(() => swapMain(idx))}>
                    <SmallCard item={a.item} />
                  </button>
                ))}
              <div className="alt-actions">
                <button className="btn" onClick={idle(() => saveLater(r.main.item))}>
                  <Ico name="Bookmark" /> {T.depois}
                </button>
                {r.alternatives.length > 0 && (
                  <button className="btn" onClick={idle(spin)}>
                    <Ico name="Dices" /> {spinning !== null ? T.sorteando : T.sortear}
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
          <h1 className="headline">{T.porQue}</h1>
          <p className="lede">{T.porQueSub}</p>
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
          <h1 className="headline">{T.gostou}</h1>
          <p className="lede">{session.round?.main.item.t}</p>
          <div className="grid cols-3">
            <button className="btn choice short" data-autofocus onClick={() => seen(true)}>
              <Ico name="ThumbsUp" /> {T.gostei}
            </button>
            <button className="btn choice short" onClick={() => seen(false)}>
              <Ico name="ThumbsDown" /> {T.naoGostei}
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
          <h1 className="headline">{isType ? T.filmeOuSerie : T.antigoOuNovo}</h1>
          <div className="grid cols-3">
            {isType ? (
              <>
                <button className="btn choice" data-autofocus onClick={() => choose({ type: 'm', time: session.ctx.time === 'maratona' ? 'medio' : session.ctx.time })}>
                  <Ico name="Film" className="choice-ico" />
                  {T.filme}
                </button>
                <button className="btn choice" onClick={() => choose({ type: 's', time: 'maratona' })}>
                  <Ico name="Tv" className="choice-ico" />
                  {T.serie}
                </button>
              </>
            ) : (
              <>
                <button className="btn choice" data-autofocus onClick={() => choose({ era: 'antigo' })}>
                  <Ico name="Radio" className="choice-ico" />
                  {T.antigo}
                </button>
                <button className="btn choice" onClick={() => choose({ era: 'novo' })}>
                  <Ico name="Sparkles" className="choice-ico" />
                  {T.novo}
                </button>
              </>
            )}
            <button className="btn choice ghost" onClick={() => choose({})}>
              <Ico name="Shuffle" className="choice-ico" />
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
          <p className="stamp">{T.decidido}</p>
          <h1 className="display">{it.t}</h1>
          <p className="lede num">{meta(it).join(' · ')}</p>
          <OndeAssistir item={it} />
          <p className="headline">{it.k === 's' ? T.bomSerie : T.bomFilme}</p>
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
          <h1 className="headline">{T.nadaAchado}</h1>
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
          <div className="main-card solo">
            <BigCard pick={{ item: it, score: 0, why: '' }} label={T.depoisTitulo} />
            <div className="row actions">
              <button className="btn primary" data-autofocus onClick={() => accept(it)}>
                <Ico name="Play" /> {T.assistirEste}
              </button>
              <button
                className="btn"
                onClick={() => {
                  addEvent({ titleId: it.i, action: 'unsaved' });
                  setScreen({ name: 'later' });
                }}
              >
                <Ico name="Trash2" /> {T.tirarLista}
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
    <div className={'stage tone-' + SCREEN_TONE[screen.name]} ref={rootRef}>
      {screen.name !== 'home' && (
        <header className="masthead">
          <span className="mast-name">{T.appName}</span>
          <span className="mast-date">{hoje()}</span>
        </header>
      )}
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

// Cada título ganha uma das cores de seção da revista, pelo gênero principal
const TONES = ['tomate', 'petroleo', 'gema', 'rosa'];
function tone(it: Item) {
  return TONES[it.g[0] % TONES.length];
}

function hoje() {
  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function BigCard({ pick, label }: { pick: Pick; label: string }) {
  const it = pick.item;
  return (
    <article className="feature">
      <div className={'cover tone-' + tone(it)}>
        <span className="cover-kind">{label}</span>
        <span className="cover-genre">{genresPt(it)[0]}</span>
        <span className="cover-year">{it.y}</span>
      </div>
      <div className="info">
        <h1 className="feature-title">{it.t}</h1>
        {it.o && it.o !== it.t && <p className="orig">{it.o}</p>}
        <p className="meta">
          {meta(it).join(' · ')}
          {it.n != null && <span className="stars"> · nota {it.n.toFixed(1).replace('.', ',')}</span>}
        </p>
        {it.s && <p className="synopsis">{it.s}</p>}
        {pick.why && <p className="why">{pick.why}</p>}
        <OndeAssistir item={it} />
      </div>
    </article>
  );
}

function OndeAssistir({ item }: { item: Item }) {
  const onde = useOnde(item);
  if (onde === undefined) return <p className="where muted-where">{T.procurandoOnde}</p>;
  if (onde === null) return null;
  if (!onde.assinatura.length && !onde.aluguel.length) return <p className="where muted-where">{T.emNenhuma}</p>;
  return (
    <div className="where">
      <Ico name="Tv" className="where-ico" />
      <div>
        {onde.assinatura.length > 0 && (
          <p>
            {T.naAssinatura} <strong>{onde.assinatura.join(', ')}</strong>
          </p>
        )}
        {onde.aluguel.length > 0 && (
          <p className="where-rent">
            {T.paraAlugar} {onde.aluguel.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

function SmallCard({ item, note }: { item: Item; note?: string }) {
  return (
    <div className="small-card">
      <span className={'swatch tone-' + tone(item)}>{item.y}</span>
      <span className="s-text">
        <span className="s-title">{item.t}</span>
        <span className="s-meta">{note ?? [kindLabel(item), genresPt(item)[0]].join(' · ')}</span>
      </span>
    </div>
  );
}

function Question(props: { title: string; back: () => void; cols: number; children: React.ReactNode }) {
  return (
    <div className="screen ask">
      <h1 className="headline">{props.title}</h1>
      <div className={`grid cols-${props.cols}`}>{props.children}</div>
      <div className="row foot">
        <button className="btn small quiet" onClick={props.back}>
          <Ico name="ChevronLeft" /> {T.voltar}
        </button>
      </div>
    </div>
  );
}

function ListScreen(props: { title: string; empty: string; back: () => void; children: React.ReactNode[] }) {
  return (
    <div className="screen list">
      <h1 className="headline">{props.title}</h1>
      {props.children.length ? <div className="grid cols-3 tiles">{props.children}</div> : <p className="lede">{props.empty}</p>}
      <div className="row foot">
        <button className="btn small quiet" data-autofocus={!props.children.length || undefined} onClick={props.back}>
          <Ico name="ChevronLeft" /> {T.voltar}
        </button>
      </div>
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
          <h1 className="headline">{T.gostoTitulo}</h1>
          <p className="lede">{T.gostoSub}</p>
        </div>
      </div>
      <div className="grid cols-3 tiles onb-grid">
        {PICKS.map((g, idx) => {
          const on = props.picked.includes(g.id);
          return (
            <button key={g.id} className={'tile pick' + (on ? ' on' : '')} data-autofocus={idx === 0 || undefined} onClick={() => toggle(g.id)} aria-pressed={on}>
              <Ico name={on ? 'Check' : g.icon} className="pick-icon" />
              <span className="pick-label">{g.label}</span>
            </button>
          );
        })}
      </div>
      <div className="row onb-actions">
        <button className={'btn' + (props.picked.length ? ' primary' : '')} onClick={props.done}>
          <Ico name="Check" /> {T.gostoPronto}
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
