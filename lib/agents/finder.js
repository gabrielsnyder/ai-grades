import { prisma } from '../db.js'

const FEC_BASE = 'https://api.open.fec.gov/v1'

// FEC party codes → our single-char party
const PARTY_MAP = { DEM: 'D', REP: 'R', IND: 'I', LIB: 'L', GRE: 'G', NNE: 'I' }
// Format office label: Senate uses "ST Sen" (e.g. "NJ Sen"); House uses "ST-N" (e.g. "NM-3", "AK-AL")
function officeLabel(fecOffice, state, district) {
  if (fecOffice === 'S') return `${state} Sen`
  const d = parseInt(district ?? '0', 10)
  return `${state}-${d === 0 ? 'AL' : d}`
}

async function fetchFECPage(office, cycle, page = 1) {
  // election_year targets the specific election year (vs cycle which spans 2 years
  // and matches incumbents from prior cycles). candidate_status=C = currently active.
  const params = new URLSearchParams({
    api_key: process.env.FEC_API_KEY ?? 'DEMO_KEY',
    election_year: String(cycle),
    office,
    incumbent_challenge: 'I',
    candidate_status: 'C',
    per_page: '100',
    page: String(page),
    sort: 'name',
  })
  const resp = await fetch(`${FEC_BASE}/candidates/?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`FEC API ${resp.status}: ${body.slice(0, 200)}`)
  }
  return resp.json()
}

async function fetchAllFECCandidates(office, cycle) {
  const all = []
  let page = 1
  while (true) {
    const data = await fetchFECPage(office, cycle, page)
    const results = data.results ?? []
    all.push(...results)
    const total = data.pagination?.count ?? 0
    if (all.length >= total || results.length < 100) break
    page++
  }
  return all
}

// FEC stores names as "LAST, FIRST M." — convert to "First Last"
function formatName(fecName) {
  if (!fecName) return ''
  const [last, rest = ''] = fecName.split(', ')
  // Take first token from the given-name portion (drops middle initial)
  const first = rest.split(/\s+/)[0] ?? ''
  const combined = first ? `${first} ${last}` : last
  return combined
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

/**
 * Runs the Candidate Finder against the FEC API for the given offices + cycle.
 * Deduplicates by externalId (FEC candidate_id). New candidates are created;
 * existing ones (matched by externalId) are skipped.
 *
 * @param {{ offices?, cycle?, dryRun? }} opts
 */
export async function runFinder({ offices = ['S', 'H'], cycle = 2026, dryRun = false }) {
  const agentRun = dryRun
    ? null
    : await prisma.agentRun.create({
        data: {
          type: 'CANDIDATE_FINDER',
          status: 'RUNNING',
          scope: { offices, cycle },
          provider: 'fec',
        },
      })

  const created = []
  const skipped = []
  const errors = []

  try {
    for (const office of offices) {
      let fecCandidates
      try {
        fecCandidates = await fetchAllFECCandidates(office, cycle)
      } catch (err) {
        errors.push({ office, error: err.message })
        continue
      }

      for (const fc of fecCandidates) {
        const externalId = fc.candidate_id
        const name = formatName(fc.name)
        const state = fc.state ?? ''
        const party = PARTY_MAP[fc.party] ?? 'I'
        const ol = officeLabel(office, state, fc.district)

        if (!externalId || !name || !state) continue
        if (fc.incumbent_challenge !== 'I') continue
        // election_years lists the specific years the candidate is on the ballot.
        // Senators with active committees but not running in this cycle won't have
        // the target year here (e.g. Bennet running for governor, Blackburn retiring).
        if (!fc.election_years?.includes(cycle)) continue

        // Dedup by externalId first; fall back to name+state for manually-added records
        // that predate the Finder (externalId=null).
        const existing = await prisma.candidate.findFirst({
          where: { OR: [{ externalId }, { name, state }] },
        })
        if (existing) {
          skipped.push({ name, externalId, reason: 'already exists' })
          continue
        }

        if (dryRun) {
          created.push({ name, state, party, office: ol, externalId })
          continue
        }

        try {
          const candidate = await prisma.candidate.create({
            data: {
              name,
              state,
              party,
              office: ol,
              electionYear: cycle,
              externalId,
            },
          })
          created.push({ id: candidate.id, name, state, party, office: ol })
        } catch (err) {
          errors.push({ name, externalId, error: err.message })
        }
      }
    }

    if (agentRun) {
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'DONE', finishedAt: new Date() },
      })
    }

    return { dryRun, created, skipped, errors, agentRunId: agentRun?.id ?? null }
  } catch (err) {
    if (agentRun) {
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'FAILED', error: err.message, finishedAt: new Date() },
      })
    }
    throw err
  }
}
