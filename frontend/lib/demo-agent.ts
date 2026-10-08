// Fixed, synthetic snapshot of the support-agent seed and policy. No network calls.
const ORDER_ID = 'ORD-4821'
const ORDER_FACTS = 'ORD-4821 (Noise-cancelling headphones) was delivered on 5 July 2026 and paid.'
const POLICY_FACTS = 'Refund policy v2 has a 14-day standard window. The 30-day exception expired on 20 July 2026 and cannot extend that window.'

export type DemoApproval = {
  action: 'request_refund'
  arguments: { order_id: string; reason: string; defective_item: boolean }
  policyDecision: 'manual_review'
  policyVersion: 'v2'
  allowedDecisions: Array<'approve' | 'edit' | 'reject'>
}

export type DemoResponse = { answer: string; approval: DemoApproval | null }

export function initialDemoResponse(): string {
  return `Order: ${ORDER_FACTS}\nPolicy: ${POLICY_FACTS}\nDecision: A defective-item claim requires manual review and human approval. No refund has been issued.`
}

export function respondToMessage(message: string): DemoResponse {
  const request = message.trim().toLowerCase()
  const asksRefund = /refund|return|退款|退货/.test(request)
  const reportsDefect = /defective|broken|damaged|faulty|瑕疵|故障|损坏|損壞/.test(request)

  if (asksRefund && reportsDefect) {
    return {
      answer: `Order: ${ORDER_FACTS}\nPolicy: ${POLICY_FACTS}\nDecision: The standard refund window has passed. Because you reported a defective item, the policy outcome is manual review. This request is paused for human approval; the refund has not been issued.`,
      approval: {
        action: 'request_refund',
        arguments: { order_id: ORDER_ID, reason: 'defective item', defective_item: true },
        policyDecision: 'manual_review',
        policyVersion: 'v2',
        allowedDecisions: ['approve', 'edit', 'reject'],
      },
    }
  }
  if (asksRefund) {
    return {
      answer: `Order: ${ORDER_FACTS}\nPolicy: ${POLICY_FACTS}\nDecision: An ordinary refund is outside the 14-day window. If the item is defective, describe the defect so a human can review the claim. No refund has been issued.`,
      approval: null,
    }
  }
  if (/policy|exception|window|政策|例外|期限/.test(request)) {
    return {
      answer: `Policy: ${POLICY_FACTS}\nDecision: The expired exception is not valid evidence for an automatic refund. A defective-item claim requires manual review.`,
      approval: null,
    }
  }
  if (/ord-4821|order|where|status|订单|訂單|物流|状态|狀態/.test(request)) {
    return { answer: `Order: ${ORDER_FACTS}\nCustomer: Alex Chen (VIP, synthetic).\nRefund: No refund has been issued in this fixed demo snapshot.`, approval: null }
  }
  if (/^(hi|hello|hey|你好|您好)[!！.。\s]*$/.test(request)) {
    return { answer: `Hello. ${ORDER_FACTS} ${POLICY_FACTS} A defective-item refund claim requires manual review.`, approval: null }
  }
  return { answer: initialDemoResponse(), approval: null }
}

export function resolveApproval(decision: 'approve' | 'edit' | 'reject'): string {
  if (decision === 'approve') return 'Decision: Approved by the human reviewer. Simulated status: manual_review_requested. No refund was issued, and no external business record was written.'
  if (decision === 'edit') return 'Decision: The reviewer requested changes. Simulated status: needs_revision. No refund was issued.'
  return 'Decision: The reviewer rejected the request. Simulated status: rejected. No refund was issued.'
}
