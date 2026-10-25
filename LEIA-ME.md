# Escolhe pra Mim (TV Box)

App que decide o filme ou a série da noite em poucos cliques do controle remoto:
perguntas de sim ou não, depois tempo e companhia, uma sugestão principal e no máximo duas alternativas.
Tudo offline, sem login, com os dados salvos só no aparelho.

## Instalar na TV Box

1. Copie `escolhe-pra-mim.apk` para a TV Box. Os jeitos mais fáceis:
   - **Pendrive**: copie o arquivo, espete na TV Box e abra com o gerenciador de arquivos.
   - **App "Downloader"** (na Play Store da TV) ou **"Send Files to TV"**, se for Android TV/Google TV.
2. Na primeira vez, o Android pede para **permitir instalar apps de fontes desconhecidas**
   para o app que você usou (gerenciador de arquivos ou Downloader). Permita e toque em Instalar.
3. O app aparece na tela inicial como **Escolhe pra Mim**, com o banner amarelo de pipoca.

Requisitos: Android 5 ou mais novo, com o WebView do sistema atualizado (vem nas TV Boxes comuns).

## Como ela usa

- Na primeira vez, marca os tipos de que costuma gostar (comédia, romance, novela, coisas brasileiras...). Pode pular.
- Depois: **"O que vamos assistir hoje?"** → perguntas de **Sim ou Não**, sem precisar saber o gênero:
  - A primeira é o tipo que ela mais gosta ("Hoje é dia de novela?"). O app aprende com o que ela aceita;
    se ela disser Não algumas vezes seguidas, passa a começar por outro tipo.
  - Se disser Não, o app afunila em até 3 perguntas: "Quer algo leve?" → "Quer dar risada?" / "Que tal um romance?",
    ou "Quer algo de prender a atenção?" → "Quer levar um susto?", ou "Quer uma história que emociona?".
  - **Tanto faz** em qualquer pergunta deixa o app escolher o tipo.
  - Depois vêm quanto tempo ela tem e com quem vai assistir.
  - Por fim, a **história**. Se fizer sentido, vem antes um aviso de Sim ou Não ("Tudo bem se for triste?" ou
    "Tudo bem ter cenas fortes?"). Depois aparece a lista de **mini-enredos** que existem entre os filmes que
    sobraram, 8 por página, do mais comum para o menos comum: "Uma mulher que dá a volta por cima",
    "Uma família que se reencontra", "Heróis que precisam salvar o mundo"... São 48 enredos ao todo.
    Ela escolhe um, ou "Tanto faz, pode escolher".
  - A sugestão diz por que foi escolhida ("Tem bichos", "Aconteceu de verdade"...).
- **Vamos nessa!** fecha a decisão ("Decidido!") e o app não oferece mais nada naquela noite, a não ser que ela peça.
- **Outra** pergunta o motivo (um clique, ou Pular) e ajusta as próximas sugestões.
- **Já vi** tira o título para sempre e pergunta se ela gostou.
- Depois de 3 recusas, o app faz uma pergunta só ("Filme ou série?" ou "Mais antigo ou mais novo?").
  Se ela recusar de novo, mostra "Essa é a escolha de hoje" e oferece o **Sortear**.
- **Sortear** faz uma roleta entre as 3 opções. **Ver depois** guarda na lista "Quero ver depois".
- **Decidir por mim** (na tela inicial) pula as perguntas.
- O botão **Voltar** do controle volta uma tela; na tela inicial, sai do app.

## Para desenvolver

```bash
npm install
npm run catalogo   # gera src/data/catalogo.json a partir de data/filmes_series.sqlite
npm run dev        # abre no navegador (use as setas e Enter como controle)
npm test           # testes do motor de recomendação
```

Gerar o APK (sem Android Studio): `SDK=/pasta/com/ferramentas ./android/build_apk.sh`.
A pasta precisa de `android.jar` (API 30), `r8.jar` (d8) e, em `build-tools/`, `aapt2`, `zipalign`
e `apksigner.jar`. O APK sai em `android/build/escolhe-pra-mim.apk`.

**Guarde o arquivo `android/escolhe.p12`** (senha `escolhe`): é a assinatura do app. Ele fica fora do
repositório Git (que é público) e está no `codigo-fonte.zip`; coloque-o em `android/` antes de gerar o APK.
Uma versão nova só instala por cima da antiga (mantendo o histórico dela) se for assinada com ele.

## Onde está cada coisa

| Arquivo | O que faz |
|---|---|
| `scripts/build_catalog.py` | Monta o catálogo enxuto (camadas A, B e C do briefing) |
| `data/pt/*.tsv` | Títulos brasileiros e sinopses curtas em português dos filmes do TMDB (escritos à mão, conferir) |
| `src/engine/perguntas.ts` | Árvore das perguntas de sim ou não e o "favorito" que aprende com ela |
| `data/enredos/*.txt` | Os 1 ou 2 mini-enredos de cada título (lista dos códigos em `LEIA.txt`), marcados à mão a partir das sinopses |
| `data/temas/*.txt` | Temas de cada título (bichos, história real, época, triste, cenas fortes...), marcados à mão a partir das sinopses |
| `src/engine/temas.ts` | Perguntas sobre a história e a escolha da próxima pergunta |
| `src/engine/recommend.ts` | Motor de decisão (pesos da seção 5 do briefing), módulo puro |
| `tests/recommend.test.ts` | Testes dos critérios 3, 4 e 5 e outros |
| `src/textos.ts` | Todos os textos da interface |
| `src/nav.ts` | Navegação pelas setas do controle remoto |
| `src/App.tsx` | Telas |
| `android/` | Casca Android TV (WebView em tela cheia, funciona offline) |

## Limitações conhecidas

- Os títulos e sinopses em português dos filmes do TMDB foram escritos por mim (Claude) e
  podem diferir um pouco do nome oficial no Brasil; o título original aparece logo abaixo.
- Não há pôsteres nem "onde assistir" atualizado (só 118 títulos da base têm esse dado).
  Isso entra na versão 2 com a API do TMDB.
- Os temas e enredos foram marcados por mim (Claude) só nos 2.419 títulos principais (camadas A e B); os da camada C ficam sem tema.
- Filmes de 2018 em diante e séries não têm nota; pesam um pouco menos, como pede o briefing.
