export const QUESTIONS = [
  'Safety Oversight & Liability',
  'Federal vs. State Authority',
  'Jobs, Workers & Economic Security',
  'Industry Structure & Public Investment',
  'Privacy, Civil Liberties & Kids\' Safety',
]

export const QUESTION_DESCRIPTIONS = [
  'Should the federal government require independent safety testing, red-teaming, or licensing for the most advanced ("frontier") AI models before they are publicly released — and should AI developers face new legal liability for harms their systems cause?',
  'States including California and Colorado have enacted their own AI laws, and Congress has not passed a national framework. Should Congress preempt state AI laws with a single national standard, or should states retain primary authority to regulate AI?',
  'What role should the federal government play in response to AI-driven job displacement — new dedicated programs, reliance on existing safety-net programs, or minimal new intervention?',
  'Should government use antitrust enforcement to scrutinize or restrict the small number of companies dominating frontier AI and compute infrastructure, and/or provide direct subsidies or compute infrastructure to accelerate domestic AI development?',
  'Should there be binding federal rules on AI-related data privacy, government use of AI, synthetic media ("deepfakes"), and AI chatbots accessible to minors — or should this be left to existing law, platform self-regulation, and parental controls?',
]

// ── Score utilities ──────────────────────────────────────────────────────────

export function overallScore(scores) {
  const vals = scores.map(s => s.score).filter(v => v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function scoreLabel(avg) {
  if (avg === null) return 'Insufficient data'
  if (avg < 1.8) return 'AI Skeptic'
  if (avg < 2.6) return 'Lean Skeptic'
  if (avg < 3.4) return 'Mixed'
  if (avg < 4.2) return 'Lean Booster'
  return 'AI Booster'
}

export function scoreClass(s) {
  if (s === null) return 'snull'
  if (s <= 1) return 's1'
  if (s <= 2) return 's2'
  if (s <= 3) return 's3'
  if (s <= 4) return 's4'
  return 's5'
}

export function scoreColor(s) {
  if (s === null) return '#bdc3c7'
  if (s < 1.8) return '#c0392b'
  if (s < 2.6) return '#d4700a'
  if (s < 3.4) return '#b8960a'
  if (s < 4.2) return '#27ae60'
  return '#1a6b3a'
}

// ── Senator data ─────────────────────────────────────────────────────────────
// Each score entry: { score: number|null, evidence: string, source: string|null, url: string|null }

export const SENATORS = [
  // ── DEMOCRATS ──────────────────────────────────────────────────────────────
  {
    name: 'John Hickenlooper',
    state: 'CO',
    party: 'D',
    scores: [
      {
        score: 3,
        evidence: 'Sponsored the bipartisan VET AI Act (2025–26), directing NIST to develop voluntary — not mandatory — third-party AI evaluation guidelines.',
        source: 'Hickenlooper press release: VET AI Act passes committee',
        url: 'https://www.hickenlooper.senate.gov/press_releases/hickenlooper-ai-bill-six-other-hick-bills-pass-senate-committee-all-bipartisan/',
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium on state regulations from the reconciliation bill, preserving state authority.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: 3,
        evidence: 'Sent bipartisan letter to acting Labor Secretary urging the Department to prepare workers for AI — signals concern but no commitment to new dedicated funding.',
        source: 'Hickenlooper: charting a path for AI regulation',
        url: 'https://www.hickenlooper.senate.gov/press_releases/hickenlooper-charts-path-for-ai-regulation/',
      },
      {
        score: 3,
        evidence: 'No publicly stated position on antitrust for AI firms or major AI subsidy bills. General pragmatist/pro-innovation framework.',
        source: null,
        url: null,
      },
      {
        score: 3,
        evidence: 'Chaired Senate hearing on AI transparency for consumers. VET AI Act includes transparency provisions but stops short of binding restrictions or opt-in data regimes.',
        source: 'Hickenlooper: AI transparency hearing',
        url: 'https://www.hickenlooper.senate.gov/press_releases/video-hickenlooper-chairs-senate-hearing-on-artificial-intelligence/',
      },
    ],
  },
  {
    name: 'Chris Coons',
    state: 'DE',
    party: 'D',
    scores: [
      {
        score: null,
        evidence: 'No publicly stated position found on mandatory pre-deployment safety testing or liability for AI harms.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium from the reconciliation bill, preserving state authority.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI-driven job displacement or automation programs.',
        source: null,
        url: null,
      },
      {
        score: 4,
        evidence: 'Co-led bipartisan AI dominance resolution with Sen. Cotton (R-AR), stressing the U.S. must prioritize AI leadership, block China access to advanced chips, and support American companies developing next-gen AI systems.',
        source: 'WGMD: Coons-Cotton bipartisan AI dominance resolution',
        url: 'https://www.wgmd.com/senators-coons-and-cotton-lead-bipartisan-push-to-protect-u-s-dominance-in-artificial-intelligence/',
      },
      {
        score: 2,
        evidence: 'Introduced legislation to protect artists\' rights from AI-generated content without their consent. Co-sponsored bipartisan Protect Elections from Deceptive AI Act with Sen. Collins.',
        source: 'collins.senate.gov: Protect Elections from Deceptive AI Act',
        url: 'https://www.collins.senate.gov/newsroom/senator-collins-bipartisan-group-introduce-bill-to-ban-deceptive-ai-generated-content-in-elections',
      },
    ],
  },
  {
    name: 'Jon Ossoff',
    state: 'GA',
    party: 'D',
    scores: [
      {
        score: null,
        evidence: 'No publicly stated position found on mandatory pre-deployment safety testing or AI liability.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium on state laws from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI-driven job displacement programs.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Launched federal probe into whether AI data center expansion is driving up electricity costs for Georgia residents — pressed FERC and utilities for answers on ratepayer impacts.',
        source: 'News Channel 9: Ossoff launches probe into AI data centers',
        url: 'https://newschannel9.com/news/local/georgia-senator-ossoff-launches-probe-into-ai-data-centers-rising-electricity-bills',
      },
      {
        score: 2,
        evidence: 'Convened bipartisan hearing on the implications of AI for human rights. His reelection campaign was personally targeted by an AI-generated deepfake ad by an opponent.',
        source: 'ossoff.senate.gov: AI human rights hearing',
        url: 'https://www.ossoff.senate.gov/press-releases/watch-sen-ossoff-convenes-hearing-on-implications-of-artificial-intelligence-for-human-rights/',
      },
    ],
  },
  {
    name: 'Ed Markey',
    state: 'MA',
    party: 'D',
    scores: [
      {
        score: 1,
        evidence: 'Reintroduced the AI Civil Rights Act (2025–26) mandating civil rights offices in every federal agency that uses or funds AI, and the BIAS Act requiring algorithmic safeguards in high-stakes decisions affecting housing, credit, employment, and health.',
        source: 'markey.senate.gov: AI Civil Rights Act',
        url: 'https://www.markey.senate.gov/news/press-releases/sen-markey-rep-clarke-reintroduce-ai-civil-rights-act-to-eliminate-ai-discrimination-and-enact-guardrails-on-use-of-algorithms-in-decisions-impacting-peoples-rights-civil-liberties-livelihoods',
      },
      {
        score: 1,
        evidence: 'Introduced the States\' Right to Regulate AI Act (Dec. 2025), co-led the 99–1 Senate amendment to strip the 10-year moratorium, and issued a formal statement opposing Trump\'s executive order on federal preemption. Most aggressive anti-preemption stance in the Senate.',
        source: 'markey.senate.gov: Statement on Trump EO prohibiting states from regulating AI',
        url: 'https://www.markey.senate.gov/news/press-releases/senator-markey-statement-on-trump-executive-order-to-prohibit-states-from-regulating-ai',
      },
      {
        score: null,
        evidence: 'No publicly stated position found specifically on AI-driven job displacement or retraining programs.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Reintroduced the AI Environmental Impacts Act (2026) requiring AI data centers to report energy and water usage, with fines for non-compliance — signaling support for regulatory obligations on the data center buildout.',
        source: 'markey.senate.gov: AI Environmental Impacts Act',
        url: 'https://www.markey.senate.gov/news/press-releases/senator-markey-rep-beyer-reintroduce-ai-environmental-impacts-act',
      },
      {
        score: 1,
        evidence: 'Introduced the Youth AI Privacy Act (March 2026) mandating that AI companies implement privacy safeguards in chatbots targeting minors. AI Civil Rights Act mandates algorithmic safeguards in government AI systems.',
        source: 'markey.senate.gov: Youth AI Privacy Act',
        url: 'https://www.markey.senate.gov/news/press-releases/markey-introduces-legislation-to-protect-children-from-privacy-and-safety-risks-posed-by-ai-chatbots',
      },
    ],
  },
  {
    name: 'Cory Booker',
    state: 'NJ',
    party: 'D',
    scores: [
      {
        score: null,
        evidence: 'No publicly stated position found on mandatory pre-deployment safety testing or liability for AI harms.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium from the reconciliation bill, preserving state authority.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: null,
        evidence: 'No publicly stated position found specifically on AI-driven job displacement.',
        source: null,
        url: null,
      },
      {
        score: 4,
        evidence: 'Co-introduced the CREATE AI Act (bipartisan) to establish the National Artificial Intelligence Research Resource (NAIRR) as shared national compute and data infrastructure. Co-introduced AI Grand Challenges Act directing NSF to fund AI research via $1M prize competitions.',
        source: 'booker.senate.gov: AI Grand Challenges Act',
        url: 'https://www.booker.senate.gov/news/press/booker-rounds-heinrich-announce-bipartisan-ai-grand-challenges-act',
      },
      {
        score: 3,
        evidence: 'AI Grand Challenges Act includes "bias mitigation" as a named challenge — mild signal of concern about AI harms — but no binding restrictions. No specific legislation found on AI surveillance, deepfakes, or kids\' safety.',
        source: null,
        url: null,
      },
    ],
  },
  {
    name: 'Ben Ray Luján',
    state: 'NM',
    party: 'D',
    scores: [
      {
        score: 2,
        evidence: 'Co-introduced the bipartisan TEST AI Act (2025) directing federal agencies to ensure AI systems they use are trustworthy, secure, and objective, establishing federal AI evaluation standards. Focuses on government AI, not private-sector pre-release testing.',
        source: 'lujan.senate.gov: TEST AI Act',
        url: 'https://www.lujan.senate.gov/newsroom/press-releases/lujan-colleagues-introduce-bipartisan-legislation-to-improve-ai-testing-and-evaluation-systems-safeguard-americans-against-risks-2/',
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium from the reconciliation bill, preserving state authority.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.',
        source: null,
        url: null,
      },
      {
        score: 3,
        evidence: 'Co-introduced the CREATE AI Act (bipartisan) to fund the NAIRR public research infrastructure. Also introduced the AI-Ready Bio-Data Standards Act and an AI weather prediction bill — broad public-interest AI investment focus.',
        source: 'heinrich.senate.gov: CREATE AI Act',
        url: 'https://www.heinrich.senate.gov/newsroom/press-releases/heinrich-young-rounds-booker-reintroduce-bipartisan-legislation-to-expand-access-to-artificial-intelligence-research',
      },
      {
        score: 2,
        evidence: 'TEST AI Act is explicitly designed to "safeguard Americans against risks" from AI in federal agency use. Bipartisan approach to ensuring government AI is trustworthy and objective.',
        source: 'lujan.senate.gov: TEST AI Act',
        url: 'https://www.lujan.senate.gov/newsroom/press-releases/lujan-colleagues-introduce-bipartisan-legislation-to-improve-ai-testing-and-evaluation-systems-safeguard-americans-against-risks-2/',
      },
    ],
  },
  {
    name: 'Jeff Merkley',
    state: 'OR',
    party: 'D',
    scores: [
      {
        score: null,
        evidence: 'No publicly stated position found on mandatory safety testing or liability for AI harms.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium on state laws from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI-driven job displacement or worker programs.',
        source: null,
        url: null,
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI industry antitrust or public investment.',
        source: null,
        url: null,
      },
      {
        score: 1,
        evidence: 'Led the FAIR Elections Act (introduced June 2026, with Sen. Padilla) banning AI-generated false content intended to suppress voters, prohibiting federal government from deploying voter-suppression AI tools, and allowing voters to challenge AI-driven erroneous voter-roll removals.',
        source: 'merkley.senate.gov: FAIR Elections Act',
        url: 'https://www.merkley.senate.gov/merkley-padilla-lead-new-legislation-to-protect-u-s-elections-from-fraudulent-artificial-intelligence/',
      },
    ],
  },
  {
    name: 'Jack Reed',
    state: 'RI',
    party: 'D',
    scores: [
      {
        score: 1,
        evidence: 'Co-authored the Romney-Reed-Moran-King Congressional framework calling for federal oversight of frontier model hardware, development, and deployment to mitigate AI-enabled catastrophic risks from bio, chemical, cyber, and nuclear threats. Among the most expansive oversight proposals in the Senate.',
        source: 'reed.senate.gov: Framework to mitigate extreme AI risks',
        url: 'https://www.reed.senate.gov/news/releases/romney-reed-moran-king-unveil-framework-to-mitigate-extreme-ai-risks',
      },
      {
        score: 1,
        evidence: 'Actively opposed federal preemption of state AI laws per March 2026 reporting on the White House\'s AI legislative framework. Voted with 99–1 majority to strip the moratorium.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.',
        source: null,
        url: null,
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI industry antitrust or public investment. Armed Services focus is on national security AI applications.',
        source: null,
        url: null,
      },
      {
        score: null,
        evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety beyond the frontier risk framework.',
        source: null,
        url: null,
      },
    ],
  },
  {
    name: 'Mark Warner',
    state: 'VA',
    party: 'D',
    scores: [
      {
        score: 3,
        evidence: 'Led bipartisan AI Security Act (with Sen. Tillis) to advance security of the AI ecosystem via the Intelligence Community\'s guidelines. As Senate Intelligence Chairman, oversaw IC AI policy. No explicit support for mandatory civilian pre-deployment testing.',
        source: 'warner.senate.gov: AI press releases',
        url: 'https://www.warner.senate.gov/news/press-releases/?issue=artificial-intelligence',
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 majority, July 2025. Issued statement criticizing White House AI legislative framework as lacking "significant substance" — skeptical of the administration\'s light-touch preemption approach.',
        source: 'warner.senate.gov: Statement on White House AI framework',
        url: 'https://www.warner.senate.gov/public/index.cfm/pressreleases?id=93CDAAB4-8AEE-44DC-AF0E-42CDF7DFAA79',
      },
      {
        score: 3,
        evidence: 'Introduced the "Economy of the Future Commission Act" (March 2026, bipartisan, with Sen. Rounds) to develop legislative recommendations for AI-related workforce changes. Also co-led the "Investing in American Workers Act" to fund AI skills training.',
        source: 'warner.senate.gov: Economy of the Future Commission Act',
        url: 'https://www.warner.senate.gov/newsroom/press-releases/warner-rounds-unveil-bipartisan-plan-to-prepare-american-workers-for-ai-driven-workforce-changes/',
      },
      {
        score: 3,
        evidence: 'No specific antitrust or major AI subsidy position found. Broad bipartisan approach across AI security and workforce policy.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Championed legislation on AI and children\'s privacy, user-empowering tools, and addressing deepfake non-consensual images as bipartisan Senate priorities.',
        source: 'warner.senate.gov: Statement on White House AI framework',
        url: 'https://www.warner.senate.gov/public/index.cfm/pressreleases?id=93CDAAB4-8AEE-44DC-AF0E-42CDF7DFAA79',
      },
    ],
  },
  // ── REPUBLICANS ────────────────────────────────────────────────────────────
  {
    name: 'Dan Sullivan',
    state: 'AK',
    party: 'R',
    scores: [
      { score: null, evidence: 'No publicly stated position found on safety testing or liability for AI harms.', source: null, url: null },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI antitrust or public investment.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', source: null, url: null },
    ],
  },
  {
    name: 'Tom Cotton',
    state: 'AR',
    party: 'R',
    scores: [
      {
        score: null,
        evidence: 'No publicly stated position found on mandatory pre-deployment safety testing or liability for AI harms. Legislative focus is on national security and China competition.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.', source: null, url: null },
      {
        score: 5,
        evidence: 'Introduced the DATA Act of 2026 to lift regulatory controls allowing data centers to build separate electricity systems, directly accelerating AI infrastructure. Co-led letter urging stronger AI chip export controls against China. Co-led bipartisan AI dominance resolution with Sen. Coons: U.S. must prioritize AI leadership and block China\'s access to advanced chips.',
        source: 'Quiver Quantitative: Cotton-Huizenga letter on AI chip export controls',
        url: 'https://www.quiverquant.com/news/Press+Release:+Cotton+and+Huizenga+Urge+Secretary+Lutnick+for+Enhanced+Export+Controls+on+AI+Chips',
      },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', source: null, url: null },
    ],
  },
  {
    name: 'Jim Risch',
    state: 'ID',
    party: 'R',
    scores: [
      {
        score: 2,
        evidence: 'Co-introduced the bipartisan TEST AI Act (2025) with Sen. Luján (D-NM) to improve AI testing and evaluation for federal agencies, ensuring systems are trustworthy, secure, and objective. Not mandatory pre-release testing for the private sector.',
        source: 'risch.senate.gov: TEST AI Act press release',
        url: 'https://www.risch.senate.gov/public/index.cfm/pressreleases?ID=3C095F87-9684-4464-9683-CB5BEDCDC2F3',
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI industry antitrust or public investment.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety beyond the TEST AI Act\'s federal agency scope.', source: null, url: null },
    ],
  },
  {
    name: 'Roger Marshall',
    state: 'KS',
    party: 'R',
    scores: [
      { score: null, evidence: 'No publicly stated position found on safety testing or liability for AI harms.', source: null, url: null },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI industry antitrust or public investment.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', source: null, url: null },
    ],
  },
  {
    name: 'Susan Collins',
    state: 'ME',
    party: 'R',
    scores: [
      {
        score: null,
        evidence: 'No publicly stated position found specifically on mandatory pre-deployment safety testing or liability for AI harms.',
        source: null,
        url: null,
      },
      {
        score: 1,
        evidence: 'Co-submitted (with Blackburn, Cantwell, and Markey) the successful amendment that stripped the 10-year AI moratorium from the reconciliation bill in the 99–1 vote, July 2025. Collins actively led the bipartisan effort to preserve state regulatory authority.',
        source: 'Reason: Senate votes 99–1 to remove AI moratorium',
        url: 'https://reason.com/2025/07/01/senate-votes-99-1-to-remove-ai-moratorium-from-big-beautiful-bill/',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI industry antitrust or public investment.', source: null, url: null },
      {
        score: 1,
        evidence: 'Introduced the bipartisan "Protect Elections from Deceptive AI Act" (April 2025) to ban AI-generated materially deceptive content falsely depicting federal candidates in political ads. Said the bill ensures "voters are not manipulated by purposely misleading AI-generated content."',
        source: 'collins.senate.gov: Protect Elections from Deceptive AI Act',
        url: 'https://www.collins.senate.gov/newsroom/senator-collins-bipartisan-group-introduce-bill-to-ban-deceptive-ai-generated-content-in-elections',
      },
    ],
  },
  {
    name: 'Cindy Hyde-Smith',
    state: 'MS',
    party: 'R',
    scores: [
      { score: null, evidence: 'No publicly stated position found on safety testing or liability for AI harms.', source: null, url: null },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI industry antitrust or public investment.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', source: null, url: null },
    ],
  },
  {
    name: 'Pete Ricketts',
    state: 'NE',
    party: 'R',
    scores: [
      {
        score: 5,
        evidence: 'At the 2025 AI+ Expo said "Innovation and Adoption is the Key to AI Competition for America" and called for a "stable regulatory environment" — framing new AI regulation as a threat to competitiveness, not a necessary safeguard.',
        source: 'ricketts.senate.gov: AI+ Expo remarks',
        url: 'https://www.ricketts.senate.gov/news/press-releases/ricketts-at-ai-expo-innovation-and-adoption-is-the-key-to-ai-competition-for-america/',
      },
      {
        score: 4,
        evidence: 'Led letter to Commerce Secretary urging a stable federal regulatory framework to make the U.S. "the world capital of artificial intelligence." Favors federal engagement primarily as a competitive tool to prevent a 50-state patchwork, not to impose restrictions on industry.',
        source: 'ricketts.senate.gov: Stable regulatory environment for AI',
        url: 'https://www.ricketts.senate.gov/news/press-releases/ricketts-colleagues-call-for-a-stable-regulatory-environment-to-win-the-a-i-race/',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.', source: null, url: null },
      {
        score: 5,
        evidence: 'Chaired Senate Foreign Relations subcommittee hearing on American AI leadership vs. China, explicitly framing AI as a race requiring acceleration rather than restriction. Cited AI\'s 14% productivity increase potential and argued America must win, not regulate its way to safety.',
        source: 'Norfolk Daily News: Ricketts chairs AI leadership subcommittee hearing',
        url: 'https://www.norfolkneradio.com/news/ricketts-chairs-subcommittee-hearing-on-american-ai-leadership-countering-china/article_12414886-2a23-42ef-9302-54ecf7b17e1b.html',
      },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', source: null, url: null },
    ],
  },
  {
    name: 'Lindsey Graham',
    state: 'SC',
    party: 'R',
    scores: [
      { score: null, evidence: 'No publicly stated position found on mandatory safety testing or liability for AI harms.', source: null, url: null },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI industry antitrust or public investment.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', source: null, url: null },
    ],
  },
  {
    name: 'Mike Rounds',
    state: 'SD',
    party: 'R',
    scores: [
      {
        score: null,
        evidence: 'No publicly stated position on mandatory pre-deployment civilian AI safety testing or liability. As Senate AI Caucus co-chair, generally pro-innovation framing.',
        source: null,
        url: null,
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium. Serves as co-chair of the Senate AI Caucus.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      {
        score: 3,
        evidence: 'Co-introduced the "Economy of the Future Commission Act" (March 2026, bipartisan, with Sen. Warner) to develop legislative recommendations for AI-related workforce and economic changes — a study commission, not new dedicated spending.',
        source: 'warner.senate.gov: Economy of the Future Commission Act',
        url: 'https://www.warner.senate.gov/newsroom/press-releases/warner-rounds-unveil-bipartisan-plan-to-prepare-american-workers-for-ai-driven-workforce-changes/',
      },
      {
        score: 4,
        evidence: 'Introduced the "Unleashing AI Innovation in Financial Services Act" (bipartisan, July 2025) to create regulatory sandboxes allowing AI in financial services. Co-introduced CREATE AI Act to fund the NAIRR national research infrastructure.',
        source: 'rounds.senate.gov: Unleashing AI Innovation in Financial Services',
        url: 'https://www.rounds.senate.gov/newsroom/press-releases/rounds-reintroduces-legislation-supporting-ai-innovation-in-financial-services',
      },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', source: null, url: null },
    ],
  },
  {
    name: 'Bill Hagerty',
    state: 'TN',
    party: 'R',
    scores: [
      {
        score: 4,
        evidence: 'Pro-data center and AI innovation posture evident through energy deregulation agenda, described as making Tennessee "a hub for Bitcoin mining and AI compute." Frames regulatory barriers as obstacles to AI capacity expansion.',
        source: 'Bitcoin Magazine: Hagerty\'s vision for Tennessee as AI hub',
        url: 'https://bitcoinmagazine.com/politics/senator-hagertys-vision-beyond-the-genius-act-make-tennessee-a-hub-for-bitcoin-mining',
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.', source: null, url: null },
      {
        score: 4,
        evidence: 'Focused on making Tennessee a hub for AI compute by removing energy regulatory barriers for data centers — framing AI infrastructure expansion as an economic and competitive priority. Led GENIUS Act for stablecoin regulation (pro-innovation fintech precedent).',
        source: 'Bitcoin Magazine: Hagerty\'s vision for Tennessee as AI hub',
        url: 'https://bitcoinmagazine.com/politics/senator-hagertys-vision-beyond-the-genius-act-make-tennessee-a-hub-for-bitcoin-mining',
      },
      { score: null, evidence: 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety at the federal level.', source: null, url: null },
    ],
  },
  {
    name: 'Shelley Moore Capito',
    state: 'WV',
    party: 'R',
    scores: [
      {
        score: 3,
        evidence: 'Co-introduced the bipartisan VET AI Act (with Sen. Hickenlooper, D-CO) directing NIST to develop voluntary guidelines for third-party AI evaluation. Said it is "a commonsense bill that will allow for a voluntary set of guidelines for AI, which will only help the development of systems that choose to adopt them." Explicitly voluntary, not mandatory.',
        source: 'capito.senate.gov: VET AI Act press release',
        url: 'https://www.capito.senate.gov/news/press-releases/in-case-you-missed-it-capito-hickenlooper-reintroduce-bipartisan-bill-to-boost-ai-standards-create-guidelines',
      },
      {
        score: 2,
        evidence: 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.',
        source: 'Senate Commerce Committee: 99–1 vote, July 2025',
        url: 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0',
      },
      { score: null, evidence: 'No publicly stated position found on AI-driven job displacement or new worker programs.', source: null, url: null },
      { score: null, evidence: 'No publicly stated position found on AI industry antitrust or public investment.', source: null, url: null },
      {
        score: 3,
        evidence: 'VET AI Act includes transparency and accountability provisions for AI systems. Has previously called for "AI guardrails" in a bipartisan context. Voluntary standards approach, not binding restrictions.',
        source: 'capito.senate.gov: AI transparency bill',
        url: 'https://www.capito.senate.gov/news/in-the-news/local-senator-shelley-moore-capito-proposes-ai-transparency-and-accountability-bill',
      },
    ],
  },
]
