import { describe, expect, it } from 'vitest'
import { initialDemoResponse, respondToMessage, resolveApproval } from '../lib/demo-agent'

describe('synthetic customer-support demo', () => {
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
