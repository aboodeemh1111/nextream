/**
 * Numerical checks for the on-device recommender.
 *
 * This directory is several hundred lines of linear algebra and three trained
 * models, and almost none of it fails loudly. A truncated SVD with a sign error
 * still returns finite numbers in the right shape; a transformer whose weight
 * gradients keep their batch dimension still trains, on the wrong thing. The
 * only way to know any of it works is to build a corpus with an answer and
 * check that the answer comes back.
 *
 * It has already earned its place three times: it caught the batched matmul
 * whose gradient TensorFlow.js silently mis-shapes (see the note in
 * models/sequence.ts), a rank truncation that kept so many dimensions the
 * decomposition stopped denoising, and it is the reason the loss curves below
 * are known to descend rather than assumed to.
 *
 * Nothing imports this, so it is never bundled. It is not wired to a test
 * runner because the client has none; run it directly:
 *
 *   cd nextream-client
 *   npx esbuild src/lib/ml/verify.ts --bundle --platform=node --format=esm  *     --external:@tensorflow/tfjs --outfile=verify.mjs && node verify.mjs
 *
 * It runs on the CPU backend, so it verifies the mathematics rather than the
 * WebGL kernels. Exits non-zero on any failure.
 */
import { loadTf } from "./tf";
import { buildSemanticSpace } from "./semantic";
import { LexicalIndex } from "./bm25";
import { buildFeatureSpace } from "./features";
import { TwoTowerModel } from "./models/tower";
import { SequenceModel, buildSequenceBatch } from "./models/sequence";
import { RankerModel, RANKER_WIDTH } from "./models/ranker";
import { jacobiEigen, symmetricFrom } from "./linalg";
import { parseQuery } from "./query";
import type { CorpusItem } from "./types";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

// --- 1. Jacobi eigensolver against a known matrix ---------------------------
{
  // [[2,1],[1,2]] has eigenvalues 3 and 1.
  const { values, vectors } = jacobiEigen(symmetricFrom([2, 1, 1, 2], 2));
  check("jacobi eigenvalues", Math.abs(values[0] - 3) < 1e-8 && Math.abs(values[1] - 1) < 1e-8,
    `${values[0].toFixed(6)}, ${values[1].toFixed(6)}`);
  // Eigenvector for 3 is [1,1]/sqrt2.
  check("jacobi eigenvectors", Math.abs(Math.abs(vectors[0]) - Math.SQRT1_2) < 1e-8);
}

// --- 2. Synthetic catalogue with three obvious clusters ---------------------
const THEMES = [
  { genre: "horror", words: "haunted ghost curse night terror demon possession ritual" },
  { genre: "comedy", words: "wedding friends office mishap laugh awkward roommate holiday" },
  { genre: "documentary", words: "ocean wildlife migration climate species expedition arctic reef" },
];

const items: CorpusItem[] = [];
THEMES.forEach((theme, t) => {
  const words = theme.words.split(" ");
  for (let i = 0; i < 24; i += 1) {
    const pick = (n: number) => Array.from({ length: n }, (_, k) => words[(i + k * 3) % words.length]);
    items.push({
      uid: `movie:${t}-${i}`,
      id: `${t}-${i}`,
      kind: i % 3 === 0 ? "show" : "movie",
      badge: "Film",
      title: `${pick(2).join(" ")} ${i}`,
      overview: `A story of ${pick(6).join(", ")}.`,
      genres: [theme.genre],
      tags: [],
      year: 1980 + ((i * 3) % 40),
      runtimeMin: 90 + i,
      maturity: 13,
      rating10: 5 + (i % 5),
      votes: 10 + i,
      views: 100 * (i + 1),
      seasons: null, episodes: null, status: null,
      poster: "", backdrop: "",
      addedAt: new Date(2024, 0, 1 + i).toISOString(),
    });
  }
});
// One title with a distinctive name, to test exact lexical retrieval.
items.push({
  uid: "movie:special", id: "special", kind: "movie", badge: "Film",
  title: "The Godfather", overview: "A crime family drama across generations.",
  genres: ["drama"], tags: ["mafia"], year: 1972, runtimeMin: 175, maturity: 18,
  rating10: 9.2, votes: 900, views: 5000, seasons: null, episodes: null, status: null,
  poster: "", backdrop: "", addedAt: new Date(2024, 0, 1).toISOString(),
});

async function main() {
  const tf = await loadTf();
  console.log(`\nbackend: ${tf.getBackend()}   items: ${items.length}\n`);

  // --- 3. Semantic space clusters by theme ---------------------------------
  const t0 = Date.now();
  const space = buildSemanticSpace(tf, items);
  const buildMs = Date.now() - t0;

  const rank = space.rank;
  const cos = (a: number, b: number) => {
    let s = 0;
    for (let d = 0; d < rank; d += 1) s += space.embeddings[a * rank + d] * space.embeddings[b * rank + d];
    return s;
  };

  let within = 0, withinN = 0, across = 0, acrossN = 0;
  for (let a = 0; a < 72; a += 1) {
    for (let b = a + 1; b < 72; b += 1) {
      const same = Math.floor(a / 24) === Math.floor(b / 24);
      if (same) { within += cos(a, b); withinN += 1; } else { across += cos(a, b); acrossN += 1; }
    }
  }
  const w = within / withinN, x = across / acrossN;
  check("semantic: same-theme similarity beats cross-theme", w > x + 0.15,
    `within=${w.toFixed(3)} across=${x.toFixed(3)} rank=${rank} in ${buildMs}ms`);

  let finite = true;
  for (const v of space.embeddings) if (!Number.isFinite(v)) { finite = false; break; }
  check("semantic: no NaN in embeddings", finite);

  // A query encoded into the same space should land near its theme.
  const q = space.encode("haunted ghost ritual");
  const qcos = (i: number) => { let s = 0; for (let d = 0; d < rank; d += 1) s += q[d] * space.embeddings[i * rank + d]; return s; };
  const ranked = items.map((_, i) => i).sort((a, b) => qcos(b) - qcos(a)).slice(0, 10);
  const horrorHits = ranked.filter((i) => i < 24).length;
  check("semantic: query encoder lands in the right cluster", horrorHits >= 7, `${horrorHits}/10 horror in top 10`);

  // --- 4. Lexical index ----------------------------------------------------
  const lex = new LexicalIndex(items);
  const exact = lex.search("godfather");
  check("lexical: exact title is rank 1", items[exact[0]?.doc]?.title === "The Godfather",
    items[exact[0]?.doc]?.title);

  const typo = lex.search("godfathr");
  check("lexical: one typo still finds it", items[typo[0]?.doc]?.title === "The Godfather",
    items[typo[0]?.doc]?.title || "nothing");

  const prefix = lex.search("godfa");
  check("lexical: prefix finds it as-you-type", items[prefix[0]?.doc]?.title === "The Godfather",
    items[prefix[0]?.doc]?.title || "nothing");

  const hl = lex.highlight("The Godfather", exact[0]?.terms || []);
  check("lexical: highlight covers the matched word", hl.length > 0 && hl[0][1] > hl[0][0], JSON.stringify(hl));

  check("lexical: did-you-mean corrects", lex.suggest("godfathr") !== null, String(lex.suggest("godfathr")));

  // --- 5. Query parser -----------------------------------------------------
  const parsed = parseQuery("top rated horror series from the 90s", ["horror", "comedy", "documentary", "drama"]);
  check("query: kind, sort, decade and genre all lifted out",
    parsed.kind === "show" && parsed.sort === "rating" && parsed.decade === 1990 && parsed.genres[0] === "horror",
    JSON.stringify({ kind: parsed.kind, sort: parsed.sort, decade: parsed.decade, genres: parsed.genres, text: parsed.text }));

  const bare = parseQuery("horror", ["horror"]);
  check("query: a bare genre stays a search", bare.genres.length === 0 && bare.text === "horror");

  // --- 6. Two-tower trains and separates -----------------------------------
  const features = buildFeatureSpace(items);
  const width = rank + features.width;
  const itemInput = new Float32Array(items.length * width);
  for (let i = 0; i < items.length; i += 1) {
    itemInput.set(space.embeddings.subarray(i * rank, (i + 1) * rank), i * width);
    itemInput.set(features.matrix.subarray(i * features.width, (i + 1) * features.width), i * width + rank);
  }

  const userExtra = features.genres.length + 5;
  const tower = new TwoTowerModel(tf, { semantic: rank, features: features.width, userExtra });

  // A synthetic viewer who only ever engages with horror.
  const userWidth = rank + userExtra;
  const batchSize = 16;
  const users = new Float32Array(batchSize * userWidth);
  const positives = new Int32Array(batchSize);
  const horrorTaste = new Float32Array(rank);
  for (let i = 0; i < 24; i += 1) for (let d = 0; d < rank; d += 1) horrorTaste[d] += space.embeddings[i * rank + d];
  const norm = Math.hypot(...horrorTaste); for (let d = 0; d < rank; d += 1) horrorTaste[d] /= norm;

  for (let b = 0; b < batchSize; b += 1) {
    users.set(horrorTaste, b * userWidth);
    users[b * userWidth + rank + features.genres.length] = 0.8;
    positives[b] = b % 24;
  }
  const sampling = new Float32Array(items.length).fill(1 / items.length);
  const negatives = new Int32Array(24);
  for (let i = 0; i < 24; i += 1) negatives[i] = 24 + i;

  const first = tower.train({ users, positives, negatives, sampling }, itemInput, items.length);
  let last = first;
  for (let step = 0; step < 40; step += 1) {
    last = tower.train({ users, positives, negatives, sampling }, itemInput, items.length);
  }
  check("tower: loss decreases", last < first && Number.isFinite(last), `${first.toFixed(3)} → ${last.toFixed(3)}`);

  const userRow = new Float32Array(userWidth);
  userRow.set(horrorTaste, 0);
  userRow[rank + features.genres.length] = 0.8;
  const scores = tower.score(userRow, itemInput, items.length);
  const topTower = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, 10);
  check("tower: ranks the trained cluster first", topTower.filter((i) => i < 24).length >= 8,
    `${topTower.filter((i) => i < 24).length}/10 horror`);

  // --- 7. Sequence model ---------------------------------------------------
  const sequence = new SequenceModel(tf, rank);
  // Alternating pattern the model can actually learn: within-cluster walk.
  const history = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const seqBatch = buildSequenceBatch(history, (count) => {
    const out = new Int32Array(count);
    for (let i = 0; i < count; i += 1) out[i] = 24 + (i % 48);
    return out;
  });
  check("sequence: batch built", seqBatch !== null && seqBatch.batch > 5, `${seqBatch?.batch} windows`);

  if (seqBatch) {
    const s0 = sequence.train(seqBatch, space.embeddings, items.length);
    let sN = s0;
    for (let step = 0; step < 30; step += 1) sN = sequence.train(seqBatch, space.embeddings, items.length);
    check("sequence: loss decreases", sN < s0 && Number.isFinite(sN), `${s0.toFixed(3)} → ${sN.toFixed(3)}`);

    const next = sequence.predict(history, space.embeddings, items.length);
    const topSeq = Array.from(next.keys()).sort((a, b) => next[b] - next[a]).slice(0, 10);
    check("sequence: predicts within the watched cluster", topSeq.filter((i) => i < 24).length >= 7,
      `${topSeq.filter((i) => i < 24).length}/10`);
  }

  // --- 8. Listwise ranker --------------------------------------------------
  const ranker = new RankerModel(tf);
  const SLATE = 12, B = 8;
  const rf = new Float32Array(B * SLATE * RANKER_WIDTH);
  const mask = new Float32Array(B * SLATE).fill(1);
  const chosen = new Int32Array(B);
  // Feature 3 (sequential) is made the only thing that predicts the click.
  for (let b = 0; b < B; b += 1) {
    const winner = b % SLATE;
    chosen[b] = winner;
    for (let s = 0; s < SLATE; s += 1) {
      const base = (b * SLATE + s) * RANKER_WIDTH;
      for (let f = 0; f < RANKER_WIDTH; f += 1) rf[base + f] = Math.random() * 0.3;
      rf[base + 3] = s === winner ? 1 : 0.05;
    }
  }
  const r0 = ranker.train({ features: rf, mask, chosen, batch: B });
  let rN = r0;
  for (let step = 0; step < 60; step += 1) rN = ranker.train({ features: rf, mask, chosen, batch: B });
  check("ranker: loss decreases", rN < r0 && Number.isFinite(rN), `${r0.toFixed(3)} → ${rN.toFixed(3)}`);

  const importances = ranker.importances();
  check("ranker: learns which feature predicts the click",
    importances[0].feature === "sequential",
    importances.slice(0, 3).map((i) => `${i.feature}=${i.weight.toFixed(3)}`).join(" "));

  console.log(`\ntensors still allocated: ${tf.memory().numTensors}`);
  console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nall checks passed\n");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
