import assert from 'node:assert/strict'

/**
 * Reproduces the two entity-map lookup patterns from PR #1120 without importing
 * product code, so both variants can be measured side by side.
 *
 * Benchmark: node scripts/benchmark-entity-map-lookup.mjs
 * Trace: node --trace-opt --trace-deopt scripts/benchmark-entity-map-lookup.mjs --trace-only
 */
const ENTITY_MAP = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'"
}

const MAPPED_KEYS = Object.keys(ENTITY_MAP)
const UNKNOWN_KEYS = ['&copy;', '&reg;', '&trade;', '&unknown;']
const MIXED_KEYS = [
  '&nbsp;',
  '&amp;',
  '&lt;',
  '&gt;',
  '&quot;',
  '&#39;',
  '&apos;',
  '&amp;',
  '&nbsp;',
  ...UNKNOWN_KEYS.slice(0, 3)
]

function readPositiveInteger(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback

  const value = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(value) || value <= 0 || String(value) !== raw) {
    throw new Error(`${name} must be a positive integer, received ${raw}`)
  }
  return value
}

function membershipThenLookup(key) {
  if (key in ENTITY_MAP) return ENTITY_MAP[key]
  return key
}

function cachedValueLookup(key) {
  const mapped = ENTITY_MAP[key]
  if (mapped !== undefined) return mapped
  return key
}

function runMembershipThenLookup(keys, lookups) {
  let checksum = 0
  for (let index = 0; index < lookups; index += 1) {
    const value = membershipThenLookup(keys[index % keys.length])
    checksum = (checksum + value.length + value.charCodeAt(0)) >>> 0
  }
  return checksum
}

function runCachedValueLookup(keys, lookups) {
  let checksum = 0
  for (let index = 0; index < lookups; index += 1) {
    const value = cachedValueLookup(keys[index % keys.length])
    checksum = (checksum + value.length + value.charCodeAt(0)) >>> 0
  }
  return checksum
}

function verifyCorrectness() {
  for (const key of [...MAPPED_KEYS, ...UNKNOWN_KEYS]) {
    assert.equal(cachedValueLookup(key), membershipThenLookup(key), key)
  }

  assert.equal(
    Object.values(ENTITY_MAP).some((value) => value === undefined),
    false,
    'The cached lookup requires all mapped values to be defined'
  )

  const inherited = Object.create({ inheritedValue: 'from prototype' })
  assert.equal(inherited.inheritedValue, 'from prototype')
  assert.equal('inheritedValue' in inherited, true)
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

function summarize(samples, lookups) {
  const nanosecondsPerLookup = samples.map((duration) => Number(duration) / lookups)
  return {
    medianNanosecondsPerLookup: median(nanosecondsPerLookup),
    minNanosecondsPerLookup: Math.min(...nanosecondsPerLookup),
    maxNanosecondsPerLookup: Math.max(...nanosecondsPerLookup),
    samplesNanosecondsPerLookup: nanosecondsPerLookup
  }
}

function measure(runner, keys, lookups) {
  const startedAt = process.hrtime.bigint()
  const checksum = runner(keys, lookups)
  return {
    checksum,
    duration: process.hrtime.bigint() - startedAt
  }
}

function benchmarkScenario(name, keys, lookups, samples) {
  const durations = {
    membershipThenLookup: [],
    cachedValueLookup: []
  }

  for (let sample = 0; sample < samples; sample += 1) {
    const orderedVariants =
      sample % 2 === 0
        ? [
            ['membershipThenLookup', runMembershipThenLookup],
            ['cachedValueLookup', runCachedValueLookup]
          ]
        : [
            ['cachedValueLookup', runCachedValueLookup],
            ['membershipThenLookup', runMembershipThenLookup]
          ]

    let expectedChecksum
    for (const [variantName, runner] of orderedVariants) {
      const result = measure(runner, keys, lookups)
      expectedChecksum ??= result.checksum
      assert.equal(result.checksum, expectedChecksum, `${name}: checksum mismatch`)
      durations[variantName].push(result.duration)
    }
  }

  const membership = summarize(durations.membershipThenLookup, lookups)
  const cached = summarize(durations.cachedValueLookup, lookups)
  return {
    name,
    keys: keys.length,
    membershipThenLookup: membership,
    cachedValueLookup: cached,
    cachedLookupSpeedupFactor: membership.medianNanosecondsPerLookup / cached.medianNanosecondsPerLookup
  }
}

verifyCorrectness()

const traceOnly = process.argv.includes('--trace-only')
const warmupLookups = readPositiveInteger('BENCH_WARMUP_LOOKUPS', 1_000_000)
const lookups = readPositiveInteger('BENCH_LOOKUPS', 5_000_000)
const samples = readPositiveInteger('BENCH_SAMPLES', 9)

if (traceOnly) {
  const traceRounds = readPositiveInteger('BENCH_TRACE_ROUNDS', 20_000)
  const rounds = Array.from({ length: traceRounds })
  const membershipChecksum = rounds.reduce(
    (checksum) => (checksum + runMembershipThenLookup(MIXED_KEYS, MIXED_KEYS.length)) >>> 0,
    0
  )
  const cachedChecksum = rounds.reduce(
    (checksum) => (checksum + runCachedValueLookup(MIXED_KEYS, MIXED_KEYS.length)) >>> 0,
    0
  )
  assert.equal(cachedChecksum, membershipChecksum)
  console.log(
    JSON.stringify(
      {
        mode: 'trace-only',
        node: process.version,
        v8: process.versions.v8,
        executable: process.execPath,
        roundsPerVariant: traceRounds,
        lookupsPerRound: MIXED_KEYS.length,
        lookupsPerVariant: traceRounds * MIXED_KEYS.length,
        correctness: 'passed',
        prototypeTraversalCheck: 'direct read reached inherited value',
        checksum: cachedChecksum
      },
      null,
      2
    )
  )
} else {
  for (const keys of [MAPPED_KEYS, MIXED_KEYS]) {
    const expected = runMembershipThenLookup(keys, warmupLookups)
    assert.equal(runCachedValueLookup(keys, warmupLookups), expected)
  }

  const results = [
    benchmarkScenario('mapped-hits', MAPPED_KEYS, lookups, samples),
    benchmarkScenario('mixed-75-percent-mapped', MIXED_KEYS, lookups, samples)
  ]

  console.log(
    JSON.stringify(
      {
        node: process.version,
        v8: process.versions.v8,
        executable: process.execPath,
        platform: `${process.platform}-${process.arch}`,
        config: {
          warmupLookupsPerVariantAndScenario: warmupLookups,
          measuredLookupsPerSample: lookups,
          samplesPerVariantAndScenario: samples,
          alternatingVariantOrder: true
        },
        correctness: 'passed',
        prototypeTraversalCheck: 'direct read reached inherited value',
        results
      },
      null,
      2
    )
  )
}
