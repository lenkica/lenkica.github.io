"""Build the research map shown on the homepage.

Steps (each cached in data/cache, delete a cache file to redo that step):
  1. Fetch abstracts for my DOIs from OpenAlex.
  2. Fetch a background corpus of papers from three fields
     (cell biology, data visualization, AI) from OpenAlex.
  3. Embed every paper (title + abstract) with a sentence-transformer.
  4. UMAP -> 2D for display, UMAP -> 10D + HDBSCAN for topic clusters.
  5. Label clusters with their most distinctive words (c-TF-IDF).
  6. Write site/data/map.json.

Run:  python scripts/build_map.py
"""
import json
import re
import time
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = DATA / "cache"
OUT = ROOT / "site" / "data" / "map.json"
CACHE.mkdir(parents=True, exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)

API = "https://api.openalex.org"
HEADERS = {"User-Agent": "research-map-builder/1.0"}
PER_FIELD = 1500
SEED = 42
MODEL = "BAAI/bge-small-en-v1.5"

FIELDS = {
    # name: OpenAlex filter selecting that field
    "cell": "primary_topic.subfield.id:1307|2804",  # Cell Biology | Cellular & Molecular Neuroscience
    "ai": "primary_topic.subfield.id:1702",  # Artificial Intelligence
    "viz": None,  # filled in from topic search (see viz_filter)
}


def get(url, params=None, tries=4):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=60)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
        except requests.RequestException:
            pass
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed: {url} {params}")


def uninvert(inv):
    if not inv:
        return ""
    pos = {}
    for word, idxs in inv.items():
        for i in idxs:
            pos[i] = word
    return " ".join(pos[i] for i in sorted(pos))


def cached(name, fn):
    path = CACHE / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    val = fn()
    path.write_text(json.dumps(val, ensure_ascii=False), encoding="utf-8")
    return val


# ---------- 1. my abstracts ----------
def fetch_my_abstracts():
    pubs = json.loads((DATA / "publications.json").read_text(encoding="utf-8"))
    out = {}
    for p in pubs:
        if not p.get("doi"):
            continue
        w = get(f"{API}/works/doi:{p['doi']}")
        if w:
            out[p["id"]] = {
                "abstract": uninvert(w.get("abstract_inverted_index")),
                "cited": w.get("cited_by_count", 0),
            }
        print("  abstract", p["id"], "ok" if w and out[p["id"]]["abstract"] else "-")
    return out


# ---------- 2. background corpus ----------
def viz_filter():
    res = get(f"{API}/topics", {"search": "visualization", "per_page": 25})
    keep = [
        t["id"].rsplit("/", 1)[-1]
        for t in res["results"]
        if re.search(r"visuali[sz]", t["display_name"], re.I)
        and not re.search(r"medical|imaging|flow|molecular|graphics", t["display_name"], re.I)
    ]
    print("  viz topics:", [t["display_name"] for t in res["results"] if t["id"].rsplit("/", 1)[-1] in keep])
    return "primary_topic.id:" + "|".join(keep)


def fetch_field(name, flt):
    works, page = [], 1
    while len(works) < PER_FIELD:
        res = get(
            f"{API}/works",
            {
                "filter": f"{flt},has_abstract:true,language:en,publication_year:2012-2026,type:article",
                "sample": PER_FIELD,
                "seed": SEED,
                "per_page": 200,
                "page": page,
                "select": "id,title,publication_year,abstract_inverted_index",
            },
        )
        batch = res["results"]
        if not batch:
            break
        for w in batch:
            ab = uninvert(w.get("abstract_inverted_index"))
            if w.get("title") and len(ab) > 200:
                works.append({"t": w["title"], "a": ab[:1500], "y": w.get("publication_year"), "f": name})
        page += 1
    print(f"  {name}: {len(works)} papers")
    return works[:PER_FIELD]


def fetch_background():
    FIELDS["viz"] = viz_filter()
    out = []
    for name, flt in FIELDS.items():
        out += fetch_field(name, flt)
    return out


# ---------- 5. cluster labels ----------
STOP = set(
    """a an the of and or in on for to with by from at as is are was were be been this that these those we our
    it its which using use used based study studies new results show shows paper approach method methods data
    can also between into than both such two three one has have had not their they more most other via
    proposed propose novel however while during through well may each different within high low when where
    analysis information system systems model models learning algorithm algorithms cell cells research article
    findings important role provide provides present presents performance significant significantly""".split()
)


def label_clusters(texts, labels, topn=3):
    from sklearn.feature_extraction.text import CountVectorizer

    ids = sorted(set(labels) - {-1})
    docs = [" ".join(t for t, l in zip(texts, labels) if l == c) for c in ids]
    cv = CountVectorizer(stop_words=list(STOP), ngram_range=(1, 2), min_df=2, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]{2,}\b")
    X = cv.fit_transform(docs).toarray().astype(float)
    tf = X / X.sum(1, keepdims=True)
    idf = np.log(1 + X.sum() / (X.sum(0) + 1))
    score = tf * idf
    vocab = np.array(cv.get_feature_names_out())
    out = {}
    for row, c in zip(score, ids):
        words = []
        for w in vocab[np.argsort(-row)]:
            if any(w in x or x in w for x in words):
                continue
            words.append(w)
            if len(words) == topn:
                break
        out[c] = words
    return out


def main():
    pubs = json.loads((DATA / "publications.json").read_text(encoding="utf-8"))
    print("1. abstracts")
    abstracts = cached("my_abstracts.json", fetch_my_abstracts)
    print("2. background corpus")
    bg = cached("background.json", fetch_background)

    def my_text(p):
        ab = abstracts.get(p["id"], {}).get("abstract", "")
        return f"{p.get('text') or p['title']}. {ab[:1500]}".strip()

    texts = [my_text(p) for p in pubs] + [f"{b['t']}. {b['a']}" for b in bg]
    n_me = len(pubs)

    print("3. embeddings")
    # per-text cache: only new/changed texts get embedded
    import hashlib

    emb_path = CACHE / "embeddings.npz"
    keys = [hashlib.sha1(t.encode("utf-8")).hexdigest() for t in texts]
    store = dict(np.load(emb_path)) if emb_path.exists() else {}
    todo = [i for i, k in enumerate(keys) if k not in store]
    if todo:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(MODEL)
        print(f"  embedding {len(todo)} new texts")
        new = model.encode([texts[i] for i in todo], batch_size=64, show_progress_bar=True, normalize_embeddings=True)
        for i, v in zip(todo, new):
            store[keys[i]] = v
        np.savez(emb_path, **{k: store[k] for k in set(keys)})
    E = np.stack([store[k] for k in keys])

    print("4. UMAP + HDBSCAN")
    import umap
    import hdbscan

    xy = umap.UMAP(n_components=2, n_neighbors=30, min_dist=0.15, metric="cosine", random_state=SEED).fit_transform(E)
    z = umap.UMAP(n_components=10, n_neighbors=30, min_dist=0.0, metric="cosine", random_state=SEED).fit_transform(E)
    labels = hdbscan.HDBSCAN(min_cluster_size=35, min_samples=8, cluster_selection_method="leaf").fit_predict(z)
    print(f"  clusters: {labels.max() + 1}, noise: {(labels == -1).mean():.0%}")

    print("5. labels")
    names = label_clusters(texts, labels)

    # UMAP layouts have no meaningful orientation, so rotate the map so that time runs
    # left -> right: regress my outputs' years on (x, y) and turn that direction to +x.
    years = np.array([p["year"] for p in pubs], dtype=float)
    P = xy[:n_me] - xy[:n_me].mean(0)
    beta, *_ = np.linalg.lstsq(P, years - years.mean(), rcond=None)
    d = beta / np.linalg.norm(beta)
    rot = np.array([[d[0], d[1]], [-d[1], d[0]]])  # proper rotation (no mirroring)
    xy = (xy - xy.mean(0)) @ rot.T
    # mirroring is also free: flip y so the path rises (later work sits higher)
    if np.corrcoef(xy[:n_me, 1], years)[0, 1] < 0:
        xy[:, 1] *= -1
    r = np.corrcoef(xy[:n_me, 0], years)[0, 1]
    print(f"  rotated {np.degrees(np.arctan2(d[1], d[0])):.0f}°; corr(x, year) = {r:.2f}")

    # normalise to [0,1] with ONE scale for both axes (keeps distances honest), robust to outliers
    lo, hi = np.percentile(xy, 0.5, axis=0), np.percentile(xy, 99.5, axis=0)
    span = (hi - lo).max()
    xy = (xy - lo) / span
    xy = np.clip(xy, -0.02, (hi - lo) / span + 0.02)

    field_of = ["me"] * n_me + [b["f"] for b in bg]
    clusters = []
    for c, words in names.items():
        m = labels == c
        fields = [f for f, k in zip(field_of, m) if k and f != "me"]
        dom = max(set(fields), key=fields.count) if fields else "me"
        cx, cy = np.median(xy[m], axis=0)
        clusters.append({"id": int(c), "label": " · ".join(words), "x": round(float(cx), 4), "y": round(float(cy), 4),
                         "n": int(m.sum()), "field": dom})

    mine = []
    for i, p in enumerate(pubs):
        mine.append({
            **{k: p.get(k) for k in ("id", "year", "kind", "title", "authors", "venue", "doi", "url", "theme")},
            "x": round(float(xy[i, 0]), 4), "y": round(float(xy[i, 1]), 4),
            "cluster": int(labels[i]),
            "has_abstract": bool(abstracts.get(p["id"], {}).get("abstract")),
        })

    background = [[round(float(xy[i, 0]), 4), round(float(xy[i, 1]), 4), bg[i - n_me]["f"], int(labels[i])]
                  for i in range(n_me, len(texts))]

    OUT.write_text(json.dumps({
        "generated": time.strftime("%Y-%m-%d"),
        "model": MODEL,
        "fields": {"cell": "Cell biology", "viz": "Data visualization", "ai": "Artificial intelligence"},
        "clusters": clusters,
        "mine": mine,
        "background": background,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("6. wrote", OUT, f"({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
