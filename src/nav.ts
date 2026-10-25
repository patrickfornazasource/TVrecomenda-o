// Navegação pelo controle remoto: setas movem o foco para o botão mais próximo
// naquela direção, OK clica, Voltar chama o handler da tela atual.
import { useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), [data-focus]';

type Dir = 'up' | 'down' | 'left' | 'right';

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
};
const CODE_DIR: Record<number, Dir> = { 19: 'up', 20: 'down', 21: 'left', 22: 'right', 38: 'up', 40: 'down', 37: 'left', 39: 'right' };

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function focusables(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
}

export function focusFirst(root: ParentNode = document) {
  const el = root.querySelector<HTMLElement>('[data-autofocus]:not([disabled])') ?? focusables(root)[0];
  el?.focus({ preventScroll: false });
}

function move(dir: Dir) {
  const cur = document.activeElement as HTMLElement | null;
  const all = focusables();
  if (!cur || !all.includes(cur)) {
    focusFirst();
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestD = Infinity;
  for (const el of all) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    let main: number;
    let cross: number;
    switch (dir) {
      case 'right':
        if (b.left < a.right - 4 && bx <= ax + 4) continue;
        // para os lados, só dentro da mesma linha (como nos apps de TV)
        if (!overlap(a.top, a.bottom, b.top, b.bottom)) continue;
        main = Math.max(0, b.left - a.right);
        cross = Math.abs(by - ay);
        break;
      case 'left':
        if (b.right > a.left + 4 && bx >= ax - 4) continue;
        // para os lados, só dentro da mesma linha (como nos apps de TV)
        if (!overlap(a.top, a.bottom, b.top, b.bottom)) continue;
        main = Math.max(0, a.left - b.right);
        cross = Math.abs(by - ay);
        break;
      case 'down':
        if (b.top < a.bottom - 4 && by <= ay + 4) continue;
        main = Math.max(0, b.top - a.bottom);
        cross = overlap(a.left, a.right, b.left, b.right) ? Math.abs(bx - ax) * 0.1 : Math.abs(bx - ax);
        break;
      default:
        if (b.bottom > a.top + 4 && by >= ay - 4) continue;
        main = Math.max(0, a.top - b.bottom);
        cross = overlap(a.left, a.right, b.left, b.right) ? Math.abs(bx - ax) * 0.1 : Math.abs(bx - ax);
    }
    const d = main + cross * 2;
    if (d < bestD) {
      bestD = d;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
}

function overlap(a1: number, a2: number, b1: number, b2: number) {
  return Math.min(a2, b2) - Math.max(a1, b1) > 4;
}

/** Instala o controle remoto. onBack devolve false quando não há para onde voltar. */
export function useRemote(onBack: () => boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key] ?? CODE_DIR[e.keyCode];
      if (dir) {
        e.preventDefault();
        move(dir);
        return;
      }
      // OK do controle: Enter, ou DPAD_CENTER (23) em alguns aparelhos
      if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23) {
        const el = document.activeElement as HTMLElement | null;
        if (el && el.matches(FOCUSABLE)) {
          e.preventDefault();
          if (!e.repeat) el.click();
        } else {
          focusFirst();
        }
        return;
      }
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 4) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    // Ponte com o APK: o botão Voltar do Android chama window.tvBack()
    (window as unknown as { tvBack: () => boolean }).tvBack = onBack;
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
}
