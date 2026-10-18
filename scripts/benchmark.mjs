#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  buildEvidenceBundle,
  analyzeRepository,
} from '../lib/analyze.js';

const TYPESAFE_URL = process.env.TYPESAFE_API_URL || 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_KEY = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY;
const JEV_MODEL = process.env.JEV_MODEL || 'jev-latest';
const SUPPORT_THRESHOLD = Number(process.env.REPO_STATE_SUPPORT_THRESHOLD || 0.8);

if (!TYPESAFE_KEY) {
  console.error('Missing TYPESAFE_API_KEY (or JEV_API_KEY)');
  process.exit(1);
}

const casesPath = path.resolve(process.argv[2] || 'benchmarks/cases.json');
if (!fs.existsSync(casesPath)) {
  console.error(`Cases file not found: ${casesPath}`);
  process.exit(1);
}

const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
if (!Array.isArray(cases) || !cases.length) {
  console.error('cases.json must contain a non-empty JSON array');
  process.exit(1);
}

function stableClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeQuestions(testCase) {
  return Object.fromEntries(Object.entries(testCase.questions).map(([id, q]) => [id, {
    type: 'noul',
    instructions: q.instructions,
    criteria: q.criteria || {
      true: 'The statement is supported by the supplied repository context and requested change.',
      false: 'The statement is not supported, is contradicted, or there is insufficient evidence.',
    },
  }]));
}

function projectIndex(analysis) {
  const supported = item =>
    item?.validation?.support_probability != null &&
    item.validation.support_probability >= SUPPORT_THRESHOLD;

  return {
    schema_version: analysis.schema_version,
    facts: stableClone(analysis.facts),
    semantic: {
      summary: analysis.semantic?.summary || '',
      architecture: (analysis.semantic?.architecture || [])
        .filter(supported)
        .map(({ validation, ...item }) => ({
          ...item,
          support_probability: validation.support_probability,
        })),
      capabilities: (analysis.semantic?.capabilities || [])
        .filter(supported)
        .map(({ validation, ...item }) => ({
          ...item,
          support_probability: validation.support_probability,
        })),
      invariants: (analysis.semantic?.invariants || [])
        .filter(supported)
        .map(({ validation, ...item }) => ({
          ...item,
          support_probability: validation.support_probability,
        })),
      data_flows: (analysis.semantic?.data_flows || [])
        .filter(supported)
        .map(({ validation, ...item }) => ({
          ...item,
          support_probability: validation.support_probability,
        })),
    },
  };
}

async function askJev(state, questions) {
  const body = { model: JEV_MODEL, state, questions };
  const bodyText = JSON.stringify(body);
  const started = performance.now();

  const response = await fetch(TYPESAFE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TYPESAFE_KEY}`,
    },
    body: bodyText,
  });

  const latencyMs = performance.now() - started;
  if (!response.ok) {
    throw new Error(`TypeSafe API ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const probabilities = {};
  for (const id of Object.keys(questions)) {
    probabilities[id] = payload.answers?.[id]?.noul ?? null;
  }

  return {
    probabilities,
    payloadBytes: Buffer.byteLength(bodyText),
    latencyMs,
    usage: payload.usage,
  };
}

function score(testCase, result) {
  let correct = 0;
  let total = 0;
  let brier = 0;
  const detail = {};

  for (const [id, q] of Object.entries(testCase.questions)) {
    const expected = q.expected === true ? 1 : 0;
    const p = result.probabilities[id];

    if (typeof p !== 'number') {
      detail[id] = { expected: Boolean(expected), probability: null, correct: false };
      total += 1;
      brier += 1;
      continue;
    }

    const predicted = p >= 0.5 ? 1 : 0;
    const isCorrect = predicted === expected;
    if (isCorrect) correct += 1;
    total += 1;
    brier += (p - expected) ** 2;

    detail[id] = {
      expected: Boolean(expected),
      probability: p,
      predicted: Boolean(predicted),
      correct: isCorrect,
    };
  }

  return {
    correct,
    total,
    accuracy: total ? correct / total : 0,
    brier: total ? brier / total : 1,
    detail,
  };
}

function average(rows, key) {
  const values = rows.map(r => r[key]);
  return values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function ms(n) {
  return `${Math.round(n)}ms`;
}

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

// Resolve cases first, then build each repo's raw context and repo-state index ONCE.
const resolvedCases = cases.map(testCase => ({
  ...testCase,
  resolvedRepo: path.resolve(path.dirname(casesPath), testCase.repo),
}));

for (const testCase of resolvedCases) {
  if (!fs.existsSync(testCase.resolvedRepo)) {
    throw new Error(`Repo does not exist for ${testCase.id}: ${testCase.resolvedRepo}`);
  }
}

const uniqueRepos = [...new Set(resolvedCases.map(c => c.resolvedRepo))];
const repoContexts = new Map();

console.log(`Preparing ${uniqueRepos.length} repo index${uniqueRepos.length === 1 ? '' : 'es'}...`);

for (const repo of uniqueRepos) {
  const repoCases = resolvedCases.filter(c => c.resolvedRepo === repo);
  const maxFiles = Math.max(...repoCases.map(c => c.max_files ?? 24));
  const maxCharsPerFile = Math.max(...repoCases.map(c => c.max_chars_per_file ?? 6000));

  const raw = buildEvidenceBundle(repo, { maxFiles, maxCharsPerFile });

  const indexStarted = performance.now();
  const analysis = await analyzeRepository(repo, {
    maxFiles,
    maxCharsPerFile,
    supportThreshold: SUPPORT_THRESHOLD,
  });
  const indexBuildLatencyMs = performance.now() - indexStarted;
  const index = projectIndex(analysis);

  const rawBytes = Buffer.byteLength(JSON.stringify({
    deterministic_facts: raw.facts,
    file_excerpts: raw.excerpts,
  }));
  const indexBytes = Buffer.byteLength(JSON.stringify(index));

  repoContexts.set(repo, {
    raw,
    index,
    indexBuildLatencyMs,
    rawBytes,
    indexBytes,
  });

  console.log(`  ${repo}`);
  console.log(`    raw evidence ${kb(rawBytes)} -> index ${kb(indexBytes)} (${pct((indexBytes - rawBytes) / Math.max(rawBytes, 1))})`);
  console.log(`    one-time index build ${ms(indexBuildLatencyMs)}`);
}

const rows = [];

for (const testCase of resolvedCases) {
  const ctx = repoContexts.get(testCase.resolvedRepo);
  const questions = makeQuestions(testCase);

  process.stdout.write(`\n[${testCase.id}] ${testCase.intent}\n`);

  // Control: Jev gets raw repo evidence directly.
  const rawState = {
    intent: testCase.intent,
    deterministic_facts: stableClone(ctx.raw.facts),
    file_excerpts: stableClone(ctx.raw.excerpts),
  };

  const rawResult = await askJev(rawState, questions);
  const rawScore = score(testCase, rawResult);

  // Treatment: Jev gets only the reusable repo-state index + the same intent.
  // No generative interpretation happens here; the index was already built above.
  const indexedState = {
    intent: testCase.intent,
    repo_index: stableClone(ctx.index),
  };

  const indexedResult = await askJev(indexedState, questions);
  const indexedScore = score(testCase, indexedResult);

  rows.push({
    id: testCase.id,
    repo: testCase.resolvedRepo,
    rawAccuracy: rawScore.accuracy,
    indexedAccuracy: indexedScore.accuracy,
    rawBrier: rawScore.brier,
    indexedBrier: indexedScore.brier,
    rawPayloadBytes: rawResult.payloadBytes,
    indexedPayloadBytes: indexedResult.payloadBytes,
    rawJevLatency: rawResult.latencyMs,
    indexedJevLatency: indexedResult.latencyMs,
    rawDetail: rawScore.detail,
    indexedDetail: indexedScore.detail,
  });

  console.log(`  raw repo   accuracy=${pct(rawScore.accuracy)}  brier=${rawScore.brier.toFixed(3)}  input=${kb(rawResult.payloadBytes)}  jev=${ms(rawResult.latencyMs)}`);
  console.log(`  indexed    accuracy=${pct(indexedScore.accuracy)}  brier=${indexedScore.brier.toFixed(3)}  input=${kb(indexedResult.payloadBytes)}  jev=${ms(indexedResult.latencyMs)}`);
}

const avg = {
  rawAccuracy: average(rows, 'rawAccuracy'),
  indexedAccuracy: average(rows, 'indexedAccuracy'),
  rawBrier: average(rows, 'rawBrier'),
  indexedBrier: average(rows, 'indexedBrier'),
  rawPayloadBytes: average(rows, 'rawPayloadBytes'),
  indexedPayloadBytes: average(rows, 'indexedPayloadBytes'),
  rawJevLatency: average(rows, 'rawJevLatency'),
  indexedJevLatency: average(rows, 'indexedJevLatency'),
};

const totalIndexBuildMs = [...repoContexts.values()]
  .reduce((sum, ctx) => sum + ctx.indexBuildLatencyMs, 0);
const amortizedIndexBuildMs = totalIndexBuildMs / Math.max(rows.length, 1);

console.log('\n========================================');
console.log('REPO-STATE INDEX BENCHMARK');
console.log('========================================');
console.log(`cases                  ${rows.length}`);
console.log(`unique repos           ${uniqueRepos.length}`);
console.log('');
console.log('                        RAW REPO      INDEXED        DELTA');
console.log(`accuracy                ${pct(avg.rawAccuracy).padEnd(13)} ${pct(avg.indexedAccuracy).padEnd(14)} ${pct(avg.indexedAccuracy - avg.rawAccuracy)}`);
console.log(`brier (lower=better)    ${avg.rawBrier.toFixed(3).padEnd(13)} ${avg.indexedBrier.toFixed(3).padEnd(14)} ${(avg.indexedBrier - avg.rawBrier).toFixed(3)}`);
console.log(`avg decision payload    ${kb(avg.rawPayloadBytes).padEnd(13)} ${kb(avg.indexedPayloadBytes).padEnd(14)} ${pct((avg.indexedPayloadBytes - avg.rawPayloadBytes) / Math.max(avg.rawPayloadBytes, 1))}`);
console.log(`avg Jev latency         ${ms(avg.rawJevLatency).padEnd(13)} ${ms(avg.indexedJevLatency).padEnd(14)} ${ms(avg.indexedJevLatency - avg.rawJevLatency)}`);
console.log('');
console.log(`one-time index build    ${ms(totalIndexBuildMs)} total across ${uniqueRepos.length} repo(s)`);
console.log(`amortized over cases    ${ms(amortizedIndexBuildMs)} per decision in this run`);
console.log('');
console.log('Interpretation: repo-state wins if indexed Jev preserves decision quality');
console.log('while reducing repeated context size and/or decision latency. Index build');
console.log('is a one-time/update-time cost, not a per-question cost.');

const repoSummary = Object.fromEntries([...repoContexts.entries()].map(([repo, ctx]) => [repo, {
  raw_context_bytes: ctx.rawBytes,
  index_bytes: ctx.indexBytes,
  compression_ratio: ctx.indexBytes / Math.max(ctx.rawBytes, 1),
  index_build_latency_ms: ctx.indexBuildLatencyMs,
  case_count: rows.filter(r => r.repo === repo).length,
}]));

const output = {
  generated_at: new Date().toISOString(),
  benchmark: 'repo-state-index-v1',
  config: {
    jev_model: JEV_MODEL,
    support_threshold: SUPPORT_THRESHOLD,
    cases_file: casesPath,
  },
  summary: {
    ...avg,
    uniqueRepos: uniqueRepos.length,
    totalIndexBuildLatency: totalIndexBuildMs,
    amortizedIndexBuildLatency: amortizedIndexBuildMs,
  },
  repos: repoSummary,
  cases: rows,
};

fs.mkdirSync('.repo-state', { recursive: true });
fs.writeFileSync('.repo-state/benchmark-index.json', JSON.stringify(output, null, 2));
console.log('\nFull results: .repo-state/benchmark-index.json');
