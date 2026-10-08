export type DemoApproval = {
  action: 'request_refund'
  arguments: { order_id: string; reason: string }
  policyDecision: 'manual_review'
  policyVersion: 'refund policy v2'
  allowedDecisions: Array<'approve' | 'edit' | 'reject'>
}

export type DemoResponse = { answer: string; approval: DemoApproval | null }

export function respondToMessage(message: string): DemoResponse {
  const request = message.trim().toLowerCase()
  if (/refund|return/.test(request)) {
    return {
      answer: 'The refund request for ORD-4821 requires human approval under refund policy v2. The refund has not been issued or recorded.',
      approval: {
        action: 'request_refund',
        arguments: { order_id: 'ORD-4821', reason: 'defective item' },
        policyDecision: 'manual_review',
        policyVersion: 'refund policy v2',
        allowedDecisions: ['approve', 'edit', 'reject'],
      },
    }
  }
  if (/ord-4821|order|where|status/.test(request)) {
    return {
      answer: 'Synthetic order ORD-4821 was delivered. The example customer is Alex Chen, and refund policy v2 applies.',
      approval: null,
    }
  }
  return {
    answer: 'This offline demo uses one synthetic order: ORD-4821. Ask about its status or request a refund to see the human-approval step.',
    approval: null,
  }
}

export function resolveApproval(decision: 'approve' | 'edit' | 'reject'): string {
  if (decision === 'approve') return 'Approval recorded in this simulated conversation. No refund or external business action was executed.'
  if (decision === 'edit') return 'Edit requested in this simulated conversation. No refund has been issued.'
  return 'Request rejected in this simulated conversation. The refund was not issued.'
}
