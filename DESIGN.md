# Visual do Escolhe pra Mim

Direção: **revista de programação de TV**. Quem usa é uma senhora vendo TV à noite, na sala,
com o controle remoto a uns 3 metros da tela. Por isso o fundo é escuro (azul-noite, sem
brilho na sala apagada), as letras são grandes e o foco é sempre muito visível.

## Cores (`src/styles.css`, `:root`)

| Papel | Token | Valor |
|---|---|---|
| Fundo | `--night` | `#0b1430` |
| Superfície | `--night-2` / `--night-3` | `#13214b` / `#1d2f63` |
| Texto / secundário | `--text` / `--muted` | `#f7f2e8` / `#b8c0da` |
| Seção "perguntas" | `--tomate` | `#e8452c` |
| Seção "história" e **foco** | `--gema` | `#f5b91e` |
| Seção "sugestão" | `--petroleo` | `#12857f` |
| Seção "listas" | `--rosa` | `#d94479` |

Cada tela tem uma cor de seção (`SCREEN_TONE` em `App.tsx`), que aparece na faixa do
cabeçalho e nos ícones. A capa de cada título usa uma das quatro cores pelo gênero.
O item em foco fica sempre amarelo-gema com letra azul-noite, em qualquer tela.

## Tipos

- Títulos e números: **Bricolage Grotesque** 700/800 (`--display`).
- Texto: **Atkinson Hyperlegible** 400/700 (`--body`), feita para baixa visão.
  O zero dela é cortado, então números usam a fonte de título (classe `.num`).
- As fontes vêm do pacote `@fontsource` e vão dentro do APK (o app funciona sem internet).

## Peças

- Cabeçalho de revista: nome do app, data de hoje e a faixa da cor da seção.
- Início: faixa com as quatro cores, nome grande e o botão principal ocupando a largura.
- Lista de enredos: grade de programação em duas colunas, linhas com fio fino, sem ícones.
- Sugestão: "capa" colorida (rótulo, gênero, ano) + título grande + sinopse.
- Ícones: `lucide-react`, mesmo traço (2,25), via `src/icones.tsx`. Sem emoji.
- Movimento: entrada suave das telas e um único momento marcado, o carimbo "Decidido!".
- Sem rótulos pequenos acima dos títulos: o título fala sozinho.
