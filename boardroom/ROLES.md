# Boardroom Roles

Role hierarchy encoded as data in `lib/boardroom/routing.ts` (`WorkCategory`,
`defaultAssignment`, `applyBudgetConservation`, `failoverFor`) — this doc is
the human-readable version of exactly that logic.

## Astra (`codex`) — Lead Developer

Astra-worthy categories (`ASTRA_WORTHY` in `routing.ts`):
`EXPERIENTIAL_ARCHITECTURE`, `CINEMATIC_UX_SYSTEM`, `MAJOR_CROSS_COMPONENT`,
`DIFFICULT_BUG`, `FLAGSHIP_MOMENT`, `FINAL_INTEGRATION`, `FINAL_POLISH`,
`HARD_ARCHITECTURAL_DECISION`.

Astra's allowance is self-reported and tiered (`budget.ts`):

| Tier | Range | Astra may do architecture | Astra may do routine implementation | Delegate routine work away |
|---|---|---|---|---|
| NORMAL | >70% | yes | yes | no |
| CONSERVE | 50-70% | yes | yes | yes |
| RESERVE | 30-50% | yes | no | yes |
| CRITICAL | <30% | no | no | yes |

Roughly 25-30% of Astra's allowance is protected for `PHASE_6_ASTRA_FINAL_PASS`
regardless of tier (`applyBudgetConservation`'s `protectedFinalIntegration`).

Astra gets **two** reset credits per the honesty rules in `BOARDROOM.md` —
both require a manual, human-confirmed redemption; neither is ever inferred
or auto-consumed.

## Claude (this CLI) — Senior Engineer / QA

Primary categories (`CLAUDE_PRIMARY`): `REPO_RECON`, `PERFORMANCE_AUDIT`,
`CODE_REVIEW`, `BACKEND_DATABASE`, `ACCESSIBILITY_VALIDATION`,
`MUNDANE_BUILD_FIX`.

Claude has one authority no other agent has: it may issue
`ASTRA IMPLEMENTATION REJECTED` (`routing.ts#rejectAstraImplementation`)
when Astra's approach is materially more expensive (in tokens, complexity,
or bundle size) than a straightforward alternative — most often invoked
under the performance veto.

## Agy (`agy`) — Fast Implementation / Scout

Primary categories (`AGY_PRIMARY`): `ROUTINE_IMPLEMENTATION`,
`REPETITIVE_EDIT`, `BASIC_TEST_WRITING`, `CSS_CLEANUP`,
`SCREENSHOT_OR_INVENTORY`, `COPY_CHANGE`.

## Failover (`routing.ts#failoverFor`)

| Unavailable | Routine work goes to | Astra-worthy/engineering work goes to |
|---|---|---|
| Astra | Claude, else Agy | Waits (queued/blocked) unless no one else is left |
| Claude | Agy, else Astra | Astra, else Agy |
| Agy | Claude, else Astra | Claude, else Astra |

Failover in the running supervisor is driven by an in-run `unavailable` set
(`supervisor.ts`), populated when an agent crashes twice or its output
pattern-matches usage exhaustion — never by silently retrying the same
agent indefinitely.

## Delegation depth

Boardroom owns routing. Agents do not chain work to each other directly —
every handoff goes back through the task ledger and the supervisor's own
next-task selection, so there is always one place (the ledger) that shows
the full history of who worked on what and why.
