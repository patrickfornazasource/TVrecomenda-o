#!/usr/bin/env python3
"""Gera src/data/catalogo.json (enxuto) a partir de data/filmes_series.sqlite.

Camadas (briefing, seção 7):
  A = tmdb_dataset com nota >= 6.5 e >= 200 votos
  B = web_source lançado (+ alguns clássicos conhecidos de model_knowledge, lista abaixo)
  C = resto aproveitável (netflix_dataset e tmdb com nota mais baixa), só para completar

Uso: python3 scripts/build_catalog.py
"""
import json
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "filmes_series.sqlite")
PT_DIR = os.path.join(ROOT, "data", "pt")  # títulos/sinopses em português (id<TAB>título<TAB>sinopse)
ENREDOS_DIR = os.path.join(ROOT, "data", "enredos")  # mini-enredos por título, ver data/enredos/LEIA.txt
TEMAS_DIR = os.path.join(ROOT, "data", "temas")  # temas por título (id<espaço>códigos), ver data/temas/LEIA.txt
OUT = os.path.join(ROOT, "src", "data", "catalogo.json")

# model_knowledge que entram mesmo assim: títulos muito conhecidos, conferidos à mão
WHITELIST = {666, 7660, 5711, 9734, 9989, 9104, 2358}

# Grade do onboarding (ordem de exibição): filmes populares, brasileiros, séries e novelas
ONBOARDING = [
    8656, 3349, 5089, 2320, 3111, 5407, 2299, 6276,
    2758, 7165, 6914, 8985, 6802, 6753, 7871, 5305,
    3548, 1612, 1761, 666, 5711, 286, 2418, 8870,
    10413, 10521, 10237, 9907, 10838, 10503, 10045, 9734,
    11334, 9989, 11547, 10452,
]

GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
    "Family", "Fantasy", "History", "Horror", "Kids", "Music", "Mystery", "Reality",
    "Romance", "Science Fiction", "Soap", "Thriller", "War", "Western",
]
GIDX = {g: i for i, g in enumerate(GENRES)}


def jl(v):
    if not v:
        return []
    try:
        return json.loads(v)
    except ValueError:
        return []


def codigos(pasta):
    """Lê arquivos 'id código código...' (data/temas, data/enredos)."""
    out = {}
    for name in sorted(os.listdir(pasta)) if os.path.isdir(pasta) else []:
        if not name[0].isdigit():
            continue
        with open(os.path.join(pasta, name), encoding="utf-8") as f:
            for line in f:
                parts = line.split()
                if len(parts) > 1 and parts[0].isdigit():
                    out[int(parts[0])] = parts[1:]
    return out


def tier(r):
    v = r["verification"]
    if r["id"] in WHITELIST:
        return "B"
    if v == "tmdb_dataset" and (r["rating"] or 0) >= 6.5 and (r["vote_count"] or 0) >= 200:
        return "A"
    if v == "web_source":
        return "B"
    if v == "netflix_dataset":
        return "C"
    if v == "tmdb_dataset" and (r["rating"] or 0) >= 5.8 and (r["vote_count"] or 0) >= 50:
        return "C"
    return None


def main():
    pt = {}
    for name in sorted(os.listdir(PT_DIR)) if os.path.isdir(PT_DIR) else []:
        with open(os.path.join(PT_DIR, name), encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) == 3 and parts[0].isdigit():
                    pt[int(parts[0])] = {"t": parts[1].strip(), "s": parts[2].strip()}
    print("traduções:", len(pt))

    temas = codigos(TEMAS_DIR)
    enredos = codigos(ENREDOS_DIR)
    print("temas:", len(temas), "enredos:", len(enredos))

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    items = []
    for r in con.execute("SELECT * FROM titles WHERE released = 1"):
        t = tier(r)
        if t is None and r["id"] not in ONBOARDING:
            continue
        genres = [GIDX[g] for g in jl(r["genres"]) if g in GIDX]
        if not genres:
            continue
        over = pt.get(r["id"], {})
        title = over.get("t") or r["title"]
        synopsis = over.get("s") or r["synopsis_pt"]
        # Títulos em alfabeto não latino (coreano, árabe...) sem tradução não servem para ela
        if not over.get("t") and any(ord(ch) > 0x2FF for ch in title):
            continue
        it = {
            "i": r["id"],
            "t": title,
            "y": r["year"],
            "k": "s" if r["type"] == "series" else "m",
            "g": genres,
        }
        orig = r["original_title"]
        if orig and orig != title:
            it["o"] = orig
        if r["runtime_min"]:
            it["r"] = r["runtime_min"]
        if r["seasons"]:
            it["e"] = r["seasons"]
        if r["rating"] is not None:
            it["n"] = round(r["rating"], 1)
            it["v"] = r["vote_count"] or 0
        kw = jl(r["keywords"])[:8]
        if kw:
            it["w"] = kw
        countries = jl(r["countries"])
        if "Brazil" in countries:
            it["br"] = 1
        if synopsis:
            it["s"] = synopsis
        if r["id"] in temas:
            it["th"] = temas[r["id"]]
        if r["id"] in enredos:
            it["en"] = enredos[r["id"]]
        streaming = jl(r["streaming_br"])
        if streaming:
            it["st"] = streaming
        it["q"] = t or "X"  # X = só aparece no onboarding
        items.append(it)

    items.sort(key=lambda x: x["i"])
    out = {"genres": GENRES, "onboarding": [i for i in ONBOARDING if any(x["i"] == i for x in items)], "items": items}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    from collections import Counter
    c = Counter((x["q"], x["k"]) for x in items)
    print("itens:", len(items), dict(sorted(c.items())))
    print("com sinopse PT:", Counter(x["q"] for x in items if "s" in x))
    print("tamanho:", os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
