import { DemoScenario, answerForScenario } from './demo-agent'

export type DemoSource = {
  id: string
  label: string
  kind: 'business_record' | 'policy' | 'memory' | 'human_decision'
  version: string
  status: 'active' | 'expired' | 'simulated'
  observed: string
  detail: string
  role: string
}

export type DemoTrace = {
  id: string
  scenario: DemoScenario
  output: string
  sources: DemoSource[]
  trust: { state: 'traceable' | 'review_required' | 'simulated'; label: string; explanation: string }
  evidenceComplete: boolean
  missingEvidence: string[]
  resultingWrites: string[]
}

const scenarios: DemoScenario[] = ['overview', 'greeting', 'order', 'policy', 'refund', 'ordinary_refund', 'approved', 'edited', 'rejected']

const order: DemoSource = {
  id: 'ORD-4821', label: 'Current order record', kind: 'business_record', version: 'seed-2026-07-05',
  status: 'active', observed: '5 July 2026',
  detail: 'Noise-cancelling headphones · delivered · paid · customer Alex Chen',
  role: 'Supports the order status, product, payment and delivery facts.',
}
const policy: DemoSource = {
  id: 'refund-policy', label: 'Active refund policy', kind: 'policy', version: 'v2',
  status: 'active', observed: '1 July 2026',
  detail: 'Standard window: 14 days. Defective items after the window require manual review.',
  role: 'Determines the applicable refund rule; replaces older policy versions.',
}
const exception: DemoSource = {
  id: 'MEM-EXCEPTION-77', label: 'Historical refund exception', kind: 'memory', version: 'v1',
  status: 'expired', observed: 'Expired 20 July 2026',
  detail: 'A 30-day exception appears in historical memory but is expired and cannot extend the active window.',
  role: 'Shown for provenance and conflict review; excluded from the current policy decision.',
}
const reviewer: DemoSource = {
  id: 'demo-reviewer-decision', label: 'Local approval choice', kind: 'human_decision', version: 'demo-only',
  status: 'simulated', observed: 'This browser session',
  detail: 'The reviewer choice updates the scripted conversation only; no external action is recorded.',
  role: 'Explains the displayed approval outcome, not a live business transaction.',
}

export const demoTraceChoices: Array<{ scenario: DemoScenario; label: string; description: string }> = [
  { scenario: 'overview', label: 'Evidence overview', description: 'Order, policy and expired memory' },
  { scenario: 'order', label: 'Order answer', description: 'Recorded order facts' },
  { scenario: 'refund', label: 'Defective refund answer', description: 'Manual-review decision' },
  { scenario: 'policy', label: 'Policy answer', description: 'Active versus expired source' },
  { scenario: 'approved', label: 'Approval outcome', description: 'Local simulated decision' },
]

export function normalizeDemoScenario(value: string | undefined): DemoScenario {
  return scenarios.includes(value as DemoScenario) ? value as DemoScenario : 'overview'
}

export function evidenceUrl(scenario: DemoScenario, traceId: string, section: 'lineage' | 'trust' = 'lineage'): string {
  return `/?scenario=${encodeURIComponent(scenario)}&trace=${encodeURIComponent(traceId)}#${section}`
}

export function getDemoTrace(inputScenario: string | undefined, inputId?: string): DemoTrace {
  const scenario = normalizeDemoScenario(inputScenario)
  const id = inputId && /^demo-[a-z_]+-[0-9]{1,5}$/.test(inputId) && inputId.startsWith(`demo-${scenario}-`)
    ? inputId : `demo-${scenario}-1`
  const isDecision = scenario === 'approved' || scenario === 'edited' || scenario === 'rejected'
  const isOrder = scenario === 'order'
  const sources = isDecision ? [order, policy, exception, reviewer]
    : isOrder ? [order]
      : scenario === 'policy' ? [policy, exception]
        : [order, policy, exception]
  const trust: DemoTrace['trust'] = isDecision
    ? { state: 'simulated', label: 'Simulated outcome', explanation: 'The reviewer decision is visible in this local demo. A real request or refund was not written.' }
    : isOrder
      ? { state: 'traceable', label: 'Traceable sample facts', explanation: 'This answer is linked to the seeded order record. Traceability is not a probability that a model is correct.' }
      : { state: 'review_required', label: 'Review required', explanation: 'The current policy is active, but the 30-day memory exception expired. It cannot justify an automatic refund; a defective-item claim needs human review.' }
  return {
    id, scenario, output: answerForScenario(scenario), sources, trust,
    evidenceComplete: true,
    missingEvidence: [],
    resultingWrites: [],
  }
}
