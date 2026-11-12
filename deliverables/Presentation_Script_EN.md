# CDS528 Presentation Script

Main slides: 12 minutes; appendix excluded. Q&A: 3 minutes.

Assign actual speakers before rehearsal. For four speakers, suggested split: slides 1–3 / 4–6 / 7–9 / 10–12. For 3 or 5 members, redistribute so everybody speaks.

## Slide 1: Flight delay insurance (45s)

Introduce the team and the question: how can a traveller inspect payment rules and beneficiary rights? Explain that this is a classroom prototype with mock assets. It is not a deployed commercial insurance service.

## Slide 2: A precise problem (50s)

Define the users and distinguish the application from a conventional database. A database can implement the interface, but on-chain custody makes the implemented transfer conditions independently inspectable. Do not claim that an oracle makes external data automatically true.

## Slide 3: Six contracts, one workflow (60s)

Walk through the architecture diagram. LPs supply capital. Travellers buy an NFT benefit. Insurance coordinates a pool and NFT. The Oracle reports a delay, while the marketplace changes the holder before departure. Frontend forms and date labels remain off-chain. Cite ERC-20, ERC-721 and OpenZeppelin.

## Slide 4: A policy has two different clocks (60s)

Explain that raw Active does not change merely because time passed. The UI derives phases from latest chain time. A report or expiry transaction changes the final policy state and burns the NFT. At the final grace second reports are still accepted; refunds begin only after that instant.

## Slide 5: LP shares are not dollars (70s)

Describe the difference between ownership value and funds that may leave today. Unearned premiums do not count as LP profit. Locked coverage constrains withdrawals without mechanically repricing shares. Exact code uses integer arithmetic and one raw virtual unit in numerator and denominator.

## Slide 6: Why 3,941.7476 shares can be worth 2,030 (70s)

Explain the arithmetic: two no-claim policies contribute 10; two claimed policies each lose 490 net, leaving 1,030. At about 0.515 per share, a 1,000 deposit buys 1,941.747571 shares. The original account totals 3,941.747571 shares worth 2,030. A later second-account deposit adds capital without creating a windfall for the first.

## Slide 7: Premium income does not guarantee profit (55s)

New LP deposits provide capital, not revenue. At this tariff and ignoring costs, break-even claim probability is about 1.01 percent. We have not estimated that probability. This is an economic limitation and a reason not to use real assets. Full reserves limit exposure but do not validate pricing.

## Slide 8: Security is layered (60s)

Discuss three threats: false or unauthorised reports, reentrant/token callbacks, and economic or stale-market abuse. State what the controls prevent and what they cannot prevent. The authorised oracle can still lie; privileged administration is a trust dependency.

## Slide 9: Evidence, with boundaries (60s)

These are recorded runs from 11 November. They are not 42 browser tests or an independent audit. Slither retained two high, four medium, four low and one informational finding; six high/medium results were reviewed in context. Deterministic multi-policy tests are not exhaustive fuzzing. Cite the saved logs and security review.

## Slide 10: Demonstrate the complete lifecycle (75s)

Use the local launcher and pre-funded test wallets. In operations query a policy and verify its beneficiary before signing. Advance local debug time only as required, noting all policies are affected. Submit a qualifying report. For a second policy, cross the full grace window and trigger refund. If the live wallet or chain fails, show previously captured evidence honestly instead of pretending a transaction succeeded.

## Slide 11: Deployment status is part of the result (60s)

Be candid about the R5 gap. Do not show local addresses as Sepolia addresses. Explain the immutable-contract rationale: pause new purchases, preserve existing exits, and deploy a replacement if needed. The teacher requires a public repository, so current access settings must be checked before submission.

## Slide 12: What we learned (55s)

Conclude with the strongest supported contribution and the most important unresolved risks. Mention upstream adaptation and AI assistance. Ask each group member to speak during the presentation. Invite questions on oracle truth, LP losses, direct NFT transfer versus market rules, and why expiry still requires a transaction.

## Slide 13: References & review checklist (0s)

Official URLs and APA-style references appear in the report. Before submission add real names and student IDs, verify upstream licensing, make the repository public, and review the AI disclosure. Do not claim Sepolia success until deployment and verification links exist.

# Q&A preparation

Q: Does the system know whether a flight really departed?
A: No. Time phases use scheduled departure; delay reports are authorised manual input.

Q: Can LPs lose money?
A: Yes. Claims can exceed premium revenue; the tariff is not empirically calibrated.

Q: Does the marketplace stop every possible NFT transfer?
A: No. Marketplace trading is restricted before departure; the report does not claim a global direct-transfer lock.

Q: Why is there still a refund transaction?
A: Time alone does not execute contract code. Someone must trigger expiry after the grace window.

Q: Has Sepolia deployment been completed?
A: No verified deployment or explorer links are currently evidenced.

Q: Is Slither clean?
A: No. Eleven findings were retained and reviewed; passing tests are not an audit.