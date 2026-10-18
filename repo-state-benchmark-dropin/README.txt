Drop into the repo-state repo:

  scripts/benchmark.mjs
  benchmarks/cases.json   (copy/modify cases.example.json)

Run from repo root:

  export TYPESAFE_API_KEY='...'
  export GENERATIVE_API_KEY='...'
  export GENERATIVE_MODEL='...'
  node scripts/benchmark.mjs benchmarks/cases.json

Output:
  .repo-state/benchmark.json
