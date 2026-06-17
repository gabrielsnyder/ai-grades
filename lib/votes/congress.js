/**
 * Congress.gov API + House Clerk / Senate LIS vote data.
 *
 * Env:
 *   CONGRESS_API_KEY  — free key from api.data.gov (falls back to DEMO_KEY)
 */

const CONGRESS_BASE = 'https://api.congress.gov/v3'
const apiKey = () => process.env.CONGRESS_API_KEY ?? 'DEMO_KEY'

// ── Bill ID parsing ───────────────────────────────────────────────────────────

const BILL_TYPE_MAP = {
  'H.R.': 'hr', 'HR': 'hr',
  'S.':   's',  'S':  's',
  'H.J.Res.': 'hjres', 'H.J.RES.': 'hjres',
  'S.J.Res.': 'sjres', 'S.J.RES.': 'sjres',
  'H.Con.Res.': 'hconres', 'S.Con.Res.': 'sconres',
  'H.Res.': 'hres', 'S.Res.': 'sres',
}

/**
 * Parse a human-readable bill ID into congress.gov API components.
 * parseBillId('H.R. 7103') → { type: 'hr', number: '7103', chamber: 'HOUSE' }
 * parseBillId('S. 1234')   → { type: 's',  number: '1234', chamber: 'SENATE' }
 */
export function parseBillId(billIdStr) {
  const s = billIdStr.trim().replace(/\s+/g, ' ')
  for (const [prefix, type] of Object.entries(BILL_TYPE_MAP)) {
    const re = new RegExp(`^${prefix.replace('.', '\\.').replace('*', '.*')}\\s*(\\d+)`, 'i')
    const m = s.match(re)
    if (m) {
      const chamber = type.startsWith('s') ? 'SENATE' : 'HOUSE'
      return { type, number: m[1], chamber }
    }
  }
  // Fallback: bare number treated as H.R.
  const bare = s.match(/^(\d+)$/)
  if (bare) return { type: 'hr', number: bare[1], chamber: 'HOUSE' }
  return null
}

/** Normalized bill number for DB storage, e.g. "hr7103", "s1234" */
export function normalizeBillNumber(type, number) {
  return `${type}${number}`
}

// ── Congress.gov API ──────────────────────────────────────────────────────────

async function congressGet(path) {
  const url = `${CONGRESS_BASE}${path}?api_key=${apiKey()}&format=json&limit=50`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Congress.gov ${res.status} ${path}`)
  return res.json()
}

/** Fetch bill metadata from Congress.gov. */
export async function fetchBillInfo(congress, type, number) {
  const data = await congressGet(`/bill/${congress}/${type}/${number}`)
  const bill = data.bill
  return {
    title:   bill.title ?? bill.shortTitle ?? `${type.toUpperCase()} ${number}`,
    summary: bill.summary?.text ?? null,
    chamber: type.startsWith('s') ? 'SENATE' : 'HOUSE',
  }
}

/**
 * Find the roll-call vote number(s) for a bill from its actions.
 * Returns an array of { rollNumber, sessionNumber, year } for passage votes.
 */
export async function findRollCalls(congress, type, number) {
  const data = await congressGet(`/bill/${congress}/${type}/${number}/actions`)
  const actions = data.actions ?? []
  const results = []
  for (const action of actions) {
    for (const rv of action.recordedVotes ?? []) {
      results.push({
        rollNumber:    rv.rollNumber,
        sessionNumber: rv.sessionNumber ?? 1,
        chamber:       rv.chamber?.toUpperCase() === 'SENATE' ? 'SENATE' : 'HOUSE',
        date:          rv.date ? new Date(rv.date) : null,
        url:           rv.url ?? null,
      })
    }
  }
  return results
}

// ── House Clerk XML ───────────────────────────────────────────────────────────

/**
 * Fetch member votes from the House Clerk.
 * Returns [{ bioguideId, position }] where position is 'YES'|'NO'|'PRESENT'|'NOT_VOTING'
 */
export async function fetchHouseMemberVotes(year, rollNumber) {
  const padded = String(rollNumber).padStart(3, '0')
  const url = `https://clerk.house.gov/evs/${year}/roll${padded}.xml`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`House Clerk ${res.status}: roll ${rollNumber} (${year})`)
  const xml = await res.text()
  return parseHouseXml(xml)
}

function parseHouseXml(xml) {
  const votes = []
  const voteRe = /<recorded-vote>[\s\S]*?<legislator[^>]*bioguide-id="([^"]+)"[^>]*>[\s\S]*?<vote>([^<]+)<\/vote>[\s\S]*?<\/recorded-vote>/g
  let m
  while ((m = voteRe.exec(xml)) !== null) {
    votes.push({ bioguideId: m[1], position: normalizePosition(m[2]) })
  }
  return votes
}

// ── Senate LIS XML ────────────────────────────────────────────────────────────

/**
 * Fetch member votes from the Senate LIS XML feed.
 * URL pattern: https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{number:05d}.xml
 */
export async function fetchSenateMemberVotes(congress, session, rollNumber) {
  const padded = String(rollNumber).padStart(5, '0')
  const dir = `vote${congress}${session}`
  const file = `vote_${congress}_${session}_${padded}.xml`
  const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/${dir}/${file}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Senate LIS ${res.status}: vote ${rollNumber}`)
  const xml = await res.text()
  return parseSenateXml(xml)
}

function parseSenateXml(xml) {
  const votes = []
  // Senate XML: <member><bioguide_id>B001288</bioguide_id><vote_cast>Yea</vote_cast></member>
  const memberRe = /<member>[\s\S]*?<bioguide_id>([^<]+)<\/bioguide_id>[\s\S]*?<vote_cast>([^<]+)<\/vote_cast>[\s\S]*?<\/member>/g
  let m
  while ((m = memberRe.exec(xml)) !== null) {
    votes.push({ bioguideId: m[1].trim(), position: normalizePosition(m[2]) })
  }
  return votes
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePosition(raw) {
  const s = raw.trim().toLowerCase()
  if (s === 'yea' || s === 'yes' || s === 'aye') return 'YES'
  if (s === 'nay' || s === 'no')                  return 'NO'
  if (s === 'present')                             return 'PRESENT'
  return 'NOT_VOTING'
}
