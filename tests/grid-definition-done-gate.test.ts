import { describe, expect, it } from 'vitest'

import {
  evaluateDefinitionDoneGate,
  type DefinitionDoneGateInput,
} from '../lib/grid/ops/definition-done-gate'

const base = (overrides: Partial<DefinitionDoneGateInput> = {}): DefinitionDoneGateInput => ({
  branch: 'grid-definition-done-gate-20260919',
  lane: 'grid-definition',
  integrationRef: 'refs/heads/grid-integration',
  scope: { clean: true, outOfScope: false },
  verification: { present: true, passed: true },
  branchState: { pushed: true, claimed: true, released: false },
  sourceCommit: 'source-commit',
  integrationCommit: 'integration-commit',
  sourceIsAncestorOfIntegration: false,
  ...overrides,
})

describe('definition done gate', () => {
  it('returns NOT_READY for dirty or out-of-scope work', () => {
    expect(evaluateDefinitionDoneGate(base({ scope: { clean: false, outOfScope: false } })).status).toBe('NOT_READY')
    expect(evaluateDefinitionDoneGate(base({ scope: { clean: true, outOfScope: true } })).status).toBe('NOT_READY')
  })

  it('returns NOT_READY when verification is missing', () => {
    expect(evaluateDefinitionDoneGate(base({ verification: { present: false, passed: false } })).status).toBe('NOT_READY')
  })

  it('returns WORKER_READY for an active claimed clean pushed verified branch', () => {
    expect(evaluateDefinitionDoneGate(base()).status).toBe('WORKER_READY')
  })

  it('returns INTEGRATION_READY for a released clean pushed verified branch not yet merged', () => {
    expect(evaluateDefinitionDoneGate(base({ branchState: { pushed: true, claimed: false, released: true } })).status).toBe('INTEGRATION_READY')
  })

  it('returns INTEGRATED when the source commit is an ancestor of the dedicated integration ref', () => {
    expect(evaluateDefinitionDoneGate(base({ sourceIsAncestorOfIntegration: true })).status).toBe('INTEGRATED')
  })

  it('returns NOT_READY after failed verification', () => {
    expect(evaluateDefinitionDoneGate(base({ verification: { present: true, passed: false } })).status).toBe('NOT_READY')
  })

  it('orders blockers deterministically', () => {
    const input = base({
      scope: { clean: false, outOfScope: true },
      verification: { present: false, passed: false },
      branchState: { pushed: false, claimed: false, released: false },
    })
    const first = evaluateDefinitionDoneGate(input)
    const second = evaluateDefinitionDoneGate(input)

    expect(first).toEqual(second)
    expect(first.status).toBe('NOT_READY')
    expect(first.blockers).toEqual([
      'OUT_OF_SCOPE',
      'DIRTY_WORKTREE',
      'VERIFICATION_MISSING',
      'BRANCH_NOT_PUSHED',
      'CLAIM_NOT_ACTIVE_OR_RELEASED',
    ])
  })
})
