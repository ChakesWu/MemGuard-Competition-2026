import { describe, expect, it } from 'vitest'
import { initialDemoResponse, respondToMessage, resolveApproval } from '../lib/demo-agent'
import { evidenceUrl, getDemoTrace } from '../lib/demo-evidence'

describe('synthetic customer-support demo', () => {
  it('links each fixed answer to its own trace and section', () => {
    expect(evidenceUrl('refund', 'demo-refund-2', 'lineage')).toBe('/evidence?scenario=refund&trace=demo-refund-2#lineage')
    expect(evidenceUrl('refund', 'demo-refund-2', 'trust')).toBe('/evidence?scenario=refund&trace=demo-refund-2#trust')
  })

  it('shows the exact refund answer with active and expired sources in the console', () => {
    const response = respondToMessage('I need a refund for ORD-4821 because the item is defective.')
    const trace = getDemoTrace(response.scenario, 'demo-refund-2')
    expect(response.scenario).toBe('refund')
    expect(trace.id).toBe('demo-refund-2')
    expect(trace.output).toBe(response.answer)
    expect(trace.sources.some(source => source.id === 'refund-policy' && source.version === 'v2' && source.status === 'active')).toBe(true)
    expect(trace.sources.some(source => source.id === 'MEM-EXCEPTION-77' && source.status === 'expired')).toBe(true)
    expect(trace.trust.state).toBe('review_required')
  })

  it('marks an order answer as traceable without claiming model certainty', () => {
    const response = respondToMessage('Where is ORD-4821?')
    const trace = getDemoTrace(response.scenario, 'demo-order-1')
    expect(trace.output).toBe(response.answer)
    expect(trace.trust.state).toBe('traceable')
    expect(trace.trust.explanation).not.toMatch(/\d+%/)
  })

  it('shows a complete answer before the visitor types', () => {
    expect(initialDemoResponse()).toContain('ORD-4821')
    expect(initialDemoResponse()).toContain('14-day')
    expect(initialDemoResponse()).toContain('manual review')
  })

  it('answers a greeting instead of repeating usage instructions', () => {
    const result = respondToMessage('hi')
    expect(result.answer).toContain('Hello')
    expect(result.answer).toContain('ORD-4821')
    expect(result.answer).not.toContain('Ask about')
  })

  it('answers order questions from the same fixed facts as the live agent seed', () => {
    const result = respondToMessage('Where is ORD-4821?')
    expect(result.answer).toContain('delivered')
    expect(result.answer).toContain('5 July 2026')
    expect(result.answer).toContain('Noise-cancelling headphones')
    expect(result.approval).toBeNull()
  })

  it('pauses a refund request for human approval without executing it', () => {
    const result = respondToMessage('I need a refund for ORD-4821 because the item is defective.')
    expect(result.approval?.action).toBe('request_refund')
    expect(result.answer).toContain('14-day')
    expect(result.answer).toContain('expired')
    expect(result.answer).toContain('manual review')
    expect(result.answer).toContain('not been issued')
    expect(result.approval?.arguments.defective_item).toBe(true)
    expect(result.approval?.policyDecision).toBe('manual_review')
  })

  it('does not offer approval for an ordinary out-of-window refund', () => {
    const result = respondToMessage('I want a refund for ORD-4821')
    expect(result.answer).toContain('14-day')
    expect(result.answer).toContain('defective')
    expect(result.approval).toBeNull()
  })

  it('records a simulated approval decision without making an API call', () => {
    expect(resolveApproval('approve')).toContain('manual_review_requested')
    expect(resolveApproval('approve')).toContain('No refund')
    expect(resolveApproval('edit')).toContain('needs_revision')
    expect(resolveApproval('reject')).toContain('rejected')
  })
})
