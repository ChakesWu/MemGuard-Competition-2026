import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { demoHandoverReport } from '../lib/demo-handover'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('competition demo routes', () => {
  it('uses the evidence console as the home route and keeps the agent entry point', () => {
    expect(read('../app/page.tsx')).toMatch(/EvidenceConsole/)
    expect(read('../app/agent/page.tsx')).toMatch(/SupportAgentChat/)
    expect(read('../components/EvidenceConsole.tsx')).toMatch(/Agent outputs/)
    expect(read('../components/EvidenceConsole.tsx')).toMatch(/What the agent actually remembers/)
    expect(read('../components/EvidenceConsole.tsx')).toMatch(/Related memory events/)
  })

  it('provides a fixed enterprise handover scenario with consistent counts', () => {
    const outcomes = demoHandoverReport.items.map(item => item.outcome)
    expect(demoHandoverReport.summary.transferred).toBe(outcomes.filter(value => value === 'transferred').length)
    expect(demoHandoverReport.summary.protected).toBe(outcomes.filter(value => value === 'protected').length)
    expect(demoHandoverReport.summary.redacted_for_review).toBe(outcomes.filter(value => value === 'redacted_for_review').length)
    expect(demoHandoverReport.summary.archived).toBe(outcomes.filter(value => value === 'archived').length)
    expect(demoHandoverReport.successor_memory_ids).toEqual(demoHandoverReport.items.filter(item => item.eligible_for_successor).map(item => item.memory_id))
    expect(read('../app/handover/page.tsx')).toMatch(/EnterpriseHandoverDemo/)
  })

  it('links answer evidence to the root console route', () => {
    expect(read('../components/agent/SupportAgentChat.tsx')).toMatch(/href="\/"/)
  })
})
