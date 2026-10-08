import { describe, expect, it } from 'vitest'
import { respondToMessage, resolveApproval } from '../lib/demo-agent'

describe('synthetic customer-support demo', () => {
  it('answers order questions from fixed sample facts', () => {
    expect(respondToMessage('Where is ORD-4821?').answer).toContain('delivered')
  })

  it('pauses a refund request for human approval without executing it', () => {
    const result = respondToMessage('I need a refund for ORD-4821 because the item is defective.')
    expect(result.approval?.action).toBe('request_refund')
    expect(result.answer).toContain('not been issued')
  })

  it('records a simulated approval decision without making an API call', () => {
    expect(resolveApproval('approve')).toContain('simulated')
    expect(resolveApproval('reject')).toContain('not issued')
  })
})
