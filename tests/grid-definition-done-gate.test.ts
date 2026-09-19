import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import {
  evaluateDefinitionDoneGate,
  inspectDefinitionDoneGate,
  type DefinitionDoneGateInput,
} from '../lib/grid/ops/definition-done-gate'
import { createClaim, releaseClaim } from '../lib/agent-control'

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

  it('collects real branch, push, claim, release, and integration ancestry evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-done-gate-'))
    const integration = root + '-integration'
    const source = root + '-source'
    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

    try {
      git(root, 'init', '-q')
      git(root, 'config', 'user.email', 'done-gate@example.com')
      git(root, 'config', 'user.name', 'Done Gate Test')
      fs.writeFileSync(path.join(root, 'README.md'), 'base\n')
      git(root, 'add', 'README.md')
      git(root, 'commit', '-q', '-m', 'base')
      git(root, 'branch', 'grid-canonical-integration-20260919')
      git(root, 'worktree', 'add', '-q', integration, 'grid-canonical-integration-20260919')
      git(root, 'worktree', 'add', '-q', '-b', 'feature-ready', source, 'HEAD')

      fs.mkdirSync(path.join(source, 'lib/grid'), { recursive: true })
      fs.writeFileSync(path.join(source, 'lib/grid/feature.ts'), 'export const ready = true\n')
      git(source, 'add', 'lib/grid/feature.ts')
      git(source, 'commit', '-q', '-m', 'feature ready')
      git(root, 'update-ref', 'refs/remotes/origin/feature-ready', git(source, 'rev-parse', 'HEAD'))

      createClaim({
        lane: 'feature-ready',
        owner: 'test-agent',
        goal: 'finish feature',
        scope: ['lib/grid/**'],
        worktree: source,
        branch: 'feature-ready',
      }, root)

      const verification = { focusedTests: true, diffCheck: true }
      expect(inspectDefinitionDoneGate({
        cwd: root,
        branch: 'feature-ready',
        lane: 'feature-ready',
        integrationRef: 'grid-canonical-integration-20260919',
        verification,
      }).status).toBe('WORKER_READY')

      releaseClaim('feature-ready', root)
      expect(inspectDefinitionDoneGate({
        cwd: root,
        branch: 'feature-ready',
        integrationRef: 'grid-canonical-integration-20260919',
        verification,
      }).status).toBe('INTEGRATION_READY')

      git(integration, 'merge', '--no-ff', '-m', 'merge feature', 'feature-ready')
      expect(inspectDefinitionDoneGate({
        cwd: root,
        branch: 'feature-ready',
        integrationRef: 'grid-canonical-integration-20260919',
        verification,
      }).status).toBe('INTEGRATED')
    } finally {
      fs.rmSync(source, { recursive: true, force: true })
      fs.rmSync(integration, { recursive: true, force: true })
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

})
