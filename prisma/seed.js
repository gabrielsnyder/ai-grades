'use strict'

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const QUESTIONS = [
  {
    text: 'Safety Oversight & Liability',
    description:
      'Should the federal government require independent safety testing, red-teaming, or licensing for the most advanced ("frontier") AI models before they are publicly released — and should AI developers face new legal liability for harms their systems cause?',
    order: 0,
  },
  {
    text: 'Federal vs. State Authority',
    description:
      'States including California and Colorado have enacted their own AI laws, and Congress has not passed a national framework. Should Congress preempt state AI laws with a single national standard, or should states retain primary authority to regulate AI?',
    order: 1,
  },
  {
    text: 'Jobs, Workers & Economic Security',
    description:
      'What role should the federal government play in response to AI-driven job displacement — new dedicated programs, reliance on existing safety-net programs, or minimal new intervention?',
    order: 2,
  },
  {
    text: 'Industry Structure & Public Investment',
    description:
      'Should government use antitrust enforcement to scrutinize or restrict the small number of companies dominating frontier AI and compute infrastructure, and/or provide direct subsidies or compute infrastructure to accelerate domestic AI development?',
    order: 3,
  },
  {
    text: "Privacy, Civil Liberties & Kids' Safety",
    description:
      'Should there be binding federal rules on AI-related data privacy, government use of AI, synthetic media ("deepfakes"), and AI chatbots accessible to minors — or should this be left to existing law, platform self-regulation, and parental controls?',
    order: 4,
  },
]

// Rubric text per question (brief, 2-3 sentences each)
const RUBRICS = [
  'Score 1 if the senator actively supports mandatory pre-deployment safety testing, red-teaming, or licensing requirements for frontier AI and/or new AI liability rules. Score 3 for voluntary frameworks or industry guidance only. Score 5 if the senator opposes new safety requirements and frames them as obstacles to innovation.',
  'Score 1 if the senator strongly supports state authority to regulate AI and opposes federal preemption. Score 3 for moderate positions that accept a limited federal floor while preserving some state flexibility. Score 5 if the senator advocates broad federal preemption that would override all state AI laws.',
  'Score 1 if the senator champions robust new dedicated federal programs for AI-displaced workers (retraining, income support, new agencies). Score 3 for study commissions, bipartisan task forces, or reliance on existing programs with modest enhancements. Score 5 if the senator opposes new government intervention and relies on market adjustment.',
  'Score 1 if the senator supports antitrust scrutiny of AI market concentration and prioritizes public research infrastructure over private dominance. Score 3 for mixed positions (some public investment alongside market-friendly policies). Score 5 if the senator prioritizes unrestricted private-sector AI dominance and opposes government intervention.',
  'Score 1 if the senator supports binding federal rules on AI privacy, government AI use, deepfakes, and kid-safety guardrails. Score 3 for voluntary or sector-specific measures without a comprehensive framework. Score 5 if the senator leaves these issues to existing law, platform self-regulation, and parental controls.',
]

// Short labels derived from question text
const SHORT_LABELS = [
  'Safety & Liability',
  'Federal vs. State',
  'Jobs & Workers',
  'Industry & Investment',
  "Privacy & Kids' Safety",
]

// Senator data: [score|null, evidence, sourceTitle|null, sourceUrl|null] per question (5 entries)
const SENATORS = [
  {
    name: 'John Hickenlooper',
    state: 'CO',
    party: 'D',
    scores: [
      [3, 'Sponsored the bipartisan VET AI Act (2025–26), directing NIST to develop voluntary — not mandatory — third-party AI evaluation guidelines.', 'Hickenlooper press release: VET AI Act passes committee', 'https://www.hickenlooper.senate.gov/press_releases/hickenlooper-ai-bill-six-other-hick-bills-pass-senate-committee-all-bipartisan/'],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium on state regulations from the reconciliation bill, preserving state authority.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [3, 'Sent bipartisan letter to acting Labor Secretary urging the Department to prepare workers for AI — signals concern but no commitment to new dedicated funding.', 'Hickenlooper: charting a path for AI regulation', 'https://www.hickenlooper.senate.gov/press_releases/hickenlooper-charts-path-for-ai-regulation/'],
      [3, 'No publicly stated position on antitrust for AI firms or major AI subsidy bills. General pragmatist/pro-innovation framework.', null, null],
      [3, 'Chaired Senate hearing on AI transparency for consumers. VET AI Act includes transparency provisions but stops short of binding restrictions or opt-in data regimes.', 'Hickenlooper: AI transparency hearing', 'https://www.hickenlooper.senate.gov/press_releases/video-hickenlooper-chairs-senate-hearing-on-artificial-intelligence/'],
    ],
  },
  {
    name: 'Chris Coons',
    state: 'DE',
    party: 'D',
    scores: [
      [null, 'No publicly stated position found on mandatory pre-deployment safety testing or liability for AI harms.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium from the reconciliation bill, preserving state authority.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or automation programs.', null, null],
      [4, "Co-led bipartisan AI dominance resolution with Sen. Cotton (R-AR), stressing the U.S. must prioritize AI leadership, block China access to advanced chips, and support American companies developing next-gen AI systems.", 'WGMD: Coons-Cotton bipartisan AI dominance resolution', 'https://www.wgmd.com/senators-coons-and-cotton-lead-bipartisan-push-to-protect-u-s-dominance-in-artificial-intelligence/'],
      [2, "Introduced legislation to protect artists' rights from AI-generated content without their consent. Co-sponsored bipartisan Protect Elections from Deceptive AI Act with Sen. Collins.", 'collins.senate.gov: Protect Elections from Deceptive AI Act', 'https://www.collins.senate.gov/newsroom/senator-collins-bipartisan-group-introduce-bill-to-ban-deceptive-ai-generated-content-in-elections'],
    ],
  },
  {
    name: 'Jon Ossoff',
    state: 'GA',
    party: 'D',
    scores: [
      [null, 'No publicly stated position found on mandatory pre-deployment safety testing or AI liability.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium on state laws from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement programs.', null, null],
      [2, 'Launched federal probe into whether AI data center expansion is driving up electricity costs for Georgia residents — pressed FERC and utilities for answers on ratepayer impacts.', 'News Channel 9: Ossoff launches probe into AI data centers', 'https://newschannel9.com/news/local/georgia-senator-ossoff-launches-probe-into-ai-data-centers-rising-electricity-bills'],
      [2, 'Convened bipartisan hearing on the implications of AI for human rights. His reelection campaign was personally targeted by an AI-generated deepfake ad by an opponent.', 'ossoff.senate.gov: AI human rights hearing', 'https://www.ossoff.senate.gov/press-releases/watch-sen-ossoff-convenes-hearing-on-implications-of-artificial-intelligence-for-human-rights/'],
    ],
  },
  {
    name: 'Ed Markey',
    state: 'MA',
    party: 'D',
    scores: [
      [1, 'Reintroduced the AI Civil Rights Act (2025–26) mandating civil rights offices in every federal agency that uses or funds AI, and the BIAS Act requiring algorithmic safeguards in high-stakes decisions affecting housing, credit, employment, and health.', 'markey.senate.gov: AI Civil Rights Act', 'https://www.markey.senate.gov/news/press-releases/sen-markey-rep-clarke-reintroduce-ai-civil-rights-act-to-eliminate-ai-discrimination-and-enact-guardrails-on-use-of-algorithms-in-decisions-impacting-peoples-rights-civil-liberties-livelihoods'],
      [1, "Introduced the States' Right to Regulate AI Act (Dec. 2025), co-led the 99–1 Senate amendment to strip the 10-year moratorium, and issued a formal statement opposing Trump's executive order on federal preemption. Most aggressive anti-preemption stance in the Senate.", 'markey.senate.gov: Statement on Trump EO prohibiting states from regulating AI', 'https://www.markey.senate.gov/news/press-releases/senator-markey-statement-on-trump-executive-order-to-prohibit-states-from-regulating-ai'],
      [null, 'No publicly stated position found specifically on AI-driven job displacement or retraining programs.', null, null],
      [2, 'Reintroduced the AI Environmental Impacts Act (2026) requiring AI data centers to report energy and water usage, with fines for non-compliance — signaling support for regulatory obligations on the data center buildout.', 'markey.senate.gov: AI Environmental Impacts Act', 'https://www.markey.senate.gov/news/press-releases/senator-markey-rep-beyer-reintroduce-ai-environmental-impacts-act'],
      [1, 'Introduced the Youth AI Privacy Act (March 2026) mandating that AI companies implement privacy safeguards in chatbots targeting minors. AI Civil Rights Act mandates algorithmic safeguards in government AI systems.', 'markey.senate.gov: Youth AI Privacy Act', 'https://www.markey.senate.gov/news/press-releases/markey-introduces-legislation-to-protect-children-from-privacy-and-safety-risks-posed-by-ai-chatbots'],
    ],
  },
  {
    name: 'Cory Booker',
    state: 'NJ',
    party: 'D',
    scores: [
      [null, 'No publicly stated position found on mandatory pre-deployment safety testing or liability for AI harms.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium from the reconciliation bill, preserving state authority.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found specifically on AI-driven job displacement.', null, null],
      [4, 'Co-introduced the CREATE AI Act (bipartisan) to establish the National Artificial Intelligence Research Resource (NAIRR) as shared national compute and data infrastructure. Co-introduced AI Grand Challenges Act directing NSF to fund AI research via $1M prize competitions.', 'booker.senate.gov: AI Grand Challenges Act', 'https://www.booker.senate.gov/news/press/booker-rounds-heinrich-announce-bipartisan-ai-grand-challenges-act'],
      [3, 'AI Grand Challenges Act includes "bias mitigation" as a named challenge — mild signal of concern about AI harms — but no binding restrictions. No specific legislation found on AI surveillance, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Ben Ray Luján',
    state: 'NM',
    party: 'D',
    scores: [
      [2, 'Co-introduced the bipartisan TEST AI Act (2025) directing federal agencies to ensure AI systems they use are trustworthy, secure, and objective, establishing federal AI evaluation standards. Focuses on government AI, not private-sector pre-release testing.', 'lujan.senate.gov: TEST AI Act', 'https://www.lujan.senate.gov/newsroom/press-releases/lujan-colleagues-introduce-bipartisan-legislation-to-improve-ai-testing-and-evaluation-systems-safeguard-americans-against-risks-2/'],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium from the reconciliation bill, preserving state authority.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [3, 'Co-introduced the CREATE AI Act (bipartisan) to fund the NAIRR public research infrastructure. Also introduced the AI-Ready Bio-Data Standards Act and an AI weather prediction bill — broad public-interest AI investment focus.', 'heinrich.senate.gov: CREATE AI Act', 'https://www.heinrich.senate.gov/newsroom/press-releases/heinrich-young-rounds-booker-reintroduce-bipartisan-legislation-to-expand-access-to-artificial-intelligence-research'],
      [2, 'TEST AI Act is explicitly designed to "safeguard Americans against risks" from AI in federal agency use. Bipartisan approach to ensuring government AI is trustworthy and objective.', 'lujan.senate.gov: TEST AI Act', 'https://www.lujan.senate.gov/newsroom/press-releases/lujan-colleagues-introduce-bipartisan-legislation-to-improve-ai-testing-and-evaluation-systems-safeguard-americans-against-risks-2/'],
    ],
  },
  {
    name: 'Jeff Merkley',
    state: 'OR',
    party: 'D',
    scores: [
      [null, 'No publicly stated position found on mandatory safety testing or liability for AI harms.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip the 10-year AI moratorium on state laws from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or worker programs.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment.', null, null],
      [1, 'Led the FAIR Elections Act (introduced June 2026, with Sen. Padilla) banning AI-generated false content intended to suppress voters, prohibiting federal government from deploying voter-suppression AI tools, and allowing voters to challenge AI-driven erroneous voter-roll removals.', 'merkley.senate.gov: FAIR Elections Act', 'https://www.merkley.senate.gov/merkley-padilla-lead-new-legislation-to-protect-u-s-elections-from-fraudulent-artificial-intelligence/'],
    ],
  },
  {
    name: 'Jack Reed',
    state: 'RI',
    party: 'D',
    scores: [
      [1, 'Co-authored the Romney-Reed-Moran-King Congressional framework calling for federal oversight of frontier model hardware, development, and deployment to mitigate AI-enabled catastrophic risks from bio, chemical, cyber, and nuclear threats. Among the most expansive oversight proposals in the Senate.', 'reed.senate.gov: Framework to mitigate extreme AI risks', 'https://www.reed.senate.gov/news/releases/romney-reed-moran-king-unveil-framework-to-mitigate-extreme-ai-risks'],
      [1, "Actively opposed federal preemption of state AI laws per March 2026 reporting on the White House's AI legislative framework. Voted with 99–1 majority to strip the moratorium.", 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment. Armed Services focus is on national security AI applications.', null, null],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety beyond the frontier risk framework.', null, null],
    ],
  },
  {
    name: 'Mark Warner',
    state: 'VA',
    party: 'D',
    scores: [
      [3, "Led bipartisan AI Security Act (with Sen. Tillis) to advance security of the AI ecosystem via the Intelligence Community's guidelines. As Senate Intelligence Chairman, oversaw IC AI policy. No explicit support for mandatory civilian pre-deployment testing.", 'warner.senate.gov: AI press releases', 'https://www.warner.senate.gov/news/press-releases/?issue=artificial-intelligence'],
      [2, 'Voted with 99–1 majority, July 2025. Issued statement criticizing White House AI legislative framework as lacking "significant substance" — skeptical of the administration\'s light-touch preemption approach.', 'warner.senate.gov: Statement on White House AI framework', 'https://www.warner.senate.gov/public/index.cfm/pressreleases?id=93CDAAB4-8AEE-44DC-AF0E-42CDF7DFAA79'],
      [3, 'Introduced the "Economy of the Future Commission Act" (March 2026, bipartisan, with Sen. Rounds) to develop legislative recommendations for AI-related workforce changes. Also co-led the "Investing in American Workers Act" to fund AI skills training.', 'warner.senate.gov: Economy of the Future Commission Act', 'https://www.warner.senate.gov/newsroom/press-releases/warner-rounds-unveil-bipartisan-plan-to-prepare-american-workers-for-ai-driven-workforce-changes/'],
      [3, 'No specific antitrust or major AI subsidy position found. Broad bipartisan approach across AI security and workforce policy.', null, null],
      [2, "Championed legislation on AI and children's privacy, user-empowering tools, and addressing deepfake non-consensual images as bipartisan Senate priorities.", 'warner.senate.gov: Statement on White House AI framework', 'https://www.warner.senate.gov/public/index.cfm/pressreleases?id=93CDAAB4-8AEE-44DC-AF0E-42CDF7DFAA79'],
    ],
  },
  {
    name: 'Dan Sullivan',
    state: 'AK',
    party: 'R',
    scores: [
      [null, 'No publicly stated position found on safety testing or liability for AI harms.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement.', null, null],
      [null, 'No publicly stated position found on AI antitrust or public investment.', null, null],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Tom Cotton',
    state: 'AR',
    party: 'R',
    scores: [
      [null, 'No publicly stated position found on mandatory pre-deployment safety testing or liability for AI harms. Legislative focus is on national security and China competition.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [5, "Introduced the DATA Act of 2026 to lift regulatory controls allowing data centers to build separate electricity systems, directly accelerating AI infrastructure. Co-led letter urging stronger AI chip export controls against China. Co-led bipartisan AI dominance resolution with Sen. Coons: U.S. must prioritize AI leadership and block China's access to advanced chips.", 'Quiver Quantitative: Cotton-Huizenga letter on AI chip export controls', 'https://www.quiverquant.com/news/Press+Release:+Cotton+and+Huizenga+Urge+Secretary+Lutnick+for+Enhanced+Export+Controls+on+AI+Chips'],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Jim Risch',
    state: 'ID',
    party: 'R',
    scores: [
      [2, 'Co-introduced the bipartisan TEST AI Act (2025) with Sen. Luján (D-NM) to improve AI testing and evaluation for federal agencies, ensuring systems are trustworthy, secure, and objective. Not mandatory pre-release testing for the private sector.', 'risch.senate.gov: TEST AI Act press release', 'https://www.risch.senate.gov/public/index.cfm/pressreleases?ID=3C095F87-9684-4464-9683-CB5BEDCDC2F3'],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment.', null, null],
      [null, "No publicly stated position found on AI privacy, deepfakes, or kids' safety beyond the TEST AI Act's federal agency scope.", null, null],
    ],
  },
  {
    name: 'Roger Marshall',
    state: 'KS',
    party: 'R',
    scores: [
      [null, 'No publicly stated position found on safety testing or liability for AI harms.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment.', null, null],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Susan Collins',
    state: 'ME',
    party: 'R',
    scores: [
      [null, 'No publicly stated position found specifically on mandatory pre-deployment safety testing or liability for AI harms.', null, null],
      [1, 'Co-submitted (with Blackburn, Cantwell, and Markey) the successful amendment that stripped the 10-year AI moratorium from the reconciliation bill in the 99–1 vote, July 2025. Collins actively led the bipartisan effort to preserve state regulatory authority.', 'Reason: Senate votes 99–1 to remove AI moratorium', 'https://reason.com/2025/07/01/senate-votes-99-1-to-remove-ai-moratorium-from-big-beautiful-bill/'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment.', null, null],
      [1, 'Introduced the bipartisan "Protect Elections from Deceptive AI Act" (April 2025) to ban AI-generated materially deceptive content falsely depicting federal candidates in political ads.', 'collins.senate.gov: Protect Elections from Deceptive AI Act', 'https://www.collins.senate.gov/newsroom/senator-collins-bipartisan-group-introduce-bill-to-ban-deceptive-ai-generated-content-in-elections'],
    ],
  },
  {
    name: 'Cindy Hyde-Smith',
    state: 'MS',
    party: 'R',
    scores: [
      [null, 'No publicly stated position found on safety testing or liability for AI harms.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment.', null, null],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Pete Ricketts',
    state: 'NE',
    party: 'R',
    scores: [
      [5, 'At the 2025 AI+ Expo said "Innovation and Adoption is the Key to AI Competition for America" and called for a "stable regulatory environment" — framing new AI regulation as a threat to competitiveness, not a necessary safeguard.', 'ricketts.senate.gov: AI+ Expo remarks', 'https://www.ricketts.senate.gov/news/press-releases/ricketts-at-ai-expo-innovation-and-adoption-is-the-key-to-ai-competition-for-america/'],
      [4, 'Led letter to Commerce Secretary urging a stable federal regulatory framework to make the U.S. "the world capital of artificial intelligence." Favors federal engagement primarily as a competitive tool to prevent a 50-state patchwork, not to impose restrictions on industry.', 'ricketts.senate.gov: Stable regulatory environment for AI', 'https://www.ricketts.senate.gov/news/press-releases/ricketts-colleagues-call-for-a-stable-regulatory-environment-to-win-the-a-i-race/'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [5, "Chaired Senate Foreign Relations subcommittee hearing on American AI leadership vs. China, explicitly framing AI as a race requiring acceleration rather than restriction. Cited AI's 14% productivity increase potential and argued America must win, not regulate its way to safety.", 'Norfolk Daily News: Ricketts chairs AI leadership subcommittee hearing', 'https://www.norfolkneradio.com/news/ricketts-chairs-subcommittee-hearing-on-american-ai-leadership-countering-china/article_12414886-2a23-42ef-9302-54ecf7b17e1b.html'],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Lindsey Graham',
    state: 'SC',
    party: 'R',
    scores: [
      [null, 'No publicly stated position found on mandatory safety testing or liability for AI harms.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment.', null, null],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Mike Rounds',
    state: 'SD',
    party: 'R',
    scores: [
      [null, 'No publicly stated position on mandatory pre-deployment civilian AI safety testing or liability. As Senate AI Caucus co-chair, generally pro-innovation framing.', null, null],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium. Serves as co-chair of the Senate AI Caucus.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [3, 'Co-introduced the "Economy of the Future Commission Act" (March 2026, bipartisan, with Sen. Warner) to develop legislative recommendations for AI-related workforce and economic changes — a study commission, not new dedicated spending.', 'warner.senate.gov: Economy of the Future Commission Act', 'https://www.warner.senate.gov/newsroom/press-releases/warner-rounds-unveil-bipartisan-plan-to-prepare-american-workers-for-ai-driven-workforce-changes/'],
      [4, 'Introduced the "Unleashing AI Innovation in Financial Services Act" (bipartisan, July 2025) to create regulatory sandboxes allowing AI in financial services. Co-introduced CREATE AI Act to fund the NAIRR national research infrastructure.', 'rounds.senate.gov: Unleashing AI Innovation in Financial Services', 'https://www.rounds.senate.gov/newsroom/press-releases/rounds-reintroduces-legislation-supporting-ai-innovation-in-financial-services'],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety.', null, null],
    ],
  },
  {
    name: 'Bill Hagerty',
    state: 'TN',
    party: 'R',
    scores: [
      [4, 'Pro-data center and AI innovation posture evident through energy deregulation agenda, described as making Tennessee "a hub for Bitcoin mining and AI compute." Frames regulatory barriers as obstacles to AI capacity expansion.', "Bitcoin Magazine: Hagerty's vision for Tennessee as AI hub", 'https://bitcoinmagazine.com/politics/senator-hagertys-vision-beyond-the-genius-act-make-tennessee-a-hub-for-bitcoin-mining'],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [4, 'Focused on making Tennessee a hub for AI compute by removing energy regulatory barriers for data centers — framing AI infrastructure expansion as an economic and competitive priority.', "Bitcoin Magazine: Hagerty's vision for Tennessee as AI hub", 'https://bitcoinmagazine.com/politics/senator-hagertys-vision-beyond-the-genius-act-make-tennessee-a-hub-for-bitcoin-mining'],
      [null, 'No publicly stated position found on AI privacy, deepfakes, or kids\' safety at the federal level.', null, null],
    ],
  },
  {
    name: 'Shelley Moore Capito',
    state: 'WV',
    party: 'R',
    scores: [
      [3, 'Co-introduced the bipartisan VET AI Act (with Sen. Hickenlooper, D-CO) directing NIST to develop voluntary guidelines for third-party AI evaluation. Said it is "a commonsense bill that will allow for a voluntary set of guidelines for AI, which will only help the development of systems that choose to adopt them." Explicitly voluntary, not mandatory.', 'capito.senate.gov: VET AI Act press release', 'https://www.capito.senate.gov/news/press-releases/in-case-you-missed-it-capito-hickenlooper-reintroduce-bipartisan-bill-to-boost-ai-standards-create-guidelines'],
      [2, 'Voted with 99–1 Senate majority in July 2025 to strip 10-year AI moratorium from the reconciliation bill.', 'Senate Commerce Committee: 99–1 vote, July 2025', 'https://www.commerce.senate.gov/2025/7/senate-strikes-ai-moratorium-from-budget-reconciliation-bill-in-overwhelming-99-1-vote/8415a728-fd1d-4269-98ac-101d1d0c71e0'],
      [null, 'No publicly stated position found on AI-driven job displacement or new worker programs.', null, null],
      [null, 'No publicly stated position found on AI industry antitrust or public investment.', null, null],
      [3, 'VET AI Act includes transparency and accountability provisions for AI systems. Has previously called for "AI guardrails" in a bipartisan context. Voluntary standards approach, not binding restrictions.', 'capito.senate.gov: AI transparency bill', 'https://www.capito.senate.gov/news/in-the-news/local-senator-shelley-moore-capito-proposes-ai-transparency-and-accountability-bill'],
    ],
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding database...')

  // 1. Delete all data in dependency-safe order
  await prisma.assessmentSource.deleteMany()
  await prisma.assessment.deleteMany()
  await prisma.source.deleteMany()
  await prisma.flag.deleteMany()
  await prisma.correction.deleteMany()
  await prisma.agentRun.deleteMany()
  await prisma.typeWeight.deleteMany()
  await prisma.weightingProfile.deleteMany()
  await prisma.indicator.deleteMany()
  await prisma.candidate.deleteMany()
  await prisma.question.deleteMany()
  await prisma.user.deleteMany()
  console.log('Cleared existing data')

  // 2. Create Questions and their Indicators in one go
  const createdQuestions = []
  const createdIndicators = []

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i]
    const question = await prisma.question.create({
      data: {
        text: q.text,
        description: q.description,
        shortLabel: SHORT_LABELS[i],
        order: q.order,
      },
    })
    createdQuestions.push(question)

    const indicator = await prisma.indicator.create({
      data: {
        questionId: question.id,
        name: `Primary position on ${SHORT_LABELS[i]}`,
        type: 'CUSTOM',
        rubric: RUBRICS[i],
        rubricVersion: 1,
        weight: null,
      },
    })
    createdIndicators.push(indicator)
  }
  console.log(`Created ${createdQuestions.length} questions and ${createdIndicators.length} indicators`)

  // 3. Create default WeightingProfile with TypeWeights
  const profile = await prisma.weightingProfile.create({
    data: {
      name: 'Default',
      isActive: true,
      typeWeights: {
        create: [
          { type: 'BILL_VOTE', weight: 1.5 },
          { type: 'PUBLIC_STATEMENT', weight: 1.0 },
          { type: 'CAMPAIGN_STATEMENT', weight: 0.5 },
          { type: 'CUSTOM', weight: 1.0 },
        ],
      },
    },
  })
  console.log(`Created weighting profile: ${profile.name}`)

  // 4. Create Candidates with Assessments and Sources
  let totalAssessments = 0
  let totalSources = 0

  for (const senator of SENATORS) {
    const candidate = await prisma.candidate.create({
      data: {
        name: senator.name,
        state: senator.state,
        party: senator.party,
        office: senator.state + ' Sen',
      },
    })

    // Build assessment + source records per question using a transaction per senator
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < senator.scores.length; i++) {
        const [score, evidence, sourceTitle, sourceUrl] = senator.scores[i]
        const indicator = createdIndicators[i]

        const assessment = await tx.assessment.create({
          data: {
            candidateId: candidate.id,
            indicatorId: indicator.id,
            value: score,
            rationale: evidence,
            reviewStatus: 'MACHINE_VERIFIED',
            origin: 'AGENT',
            rubricVersion: 1,
          },
        })
        totalAssessments++

        if (sourceUrl) {
          const source = await tx.source.create({
            data: {
              candidateId: candidate.id,
              url: sourceUrl,
              title: sourceTitle,
              status: 'FOUND',
            },
          })
          totalSources++

          await tx.assessmentSource.create({
            data: {
              assessmentId: assessment.id,
              sourceId: source.id,
            },
          })
        }
      }
    })
  }
  console.log(`Created ${SENATORS.length} candidates, ${totalAssessments} assessments, ${totalSources} sources`)

  // 5. Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123'
  const passwordHash = await bcrypt.hash(adminPassword, 10)

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    },
  })
  console.log(`Created admin user: ${adminEmail}`)

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
