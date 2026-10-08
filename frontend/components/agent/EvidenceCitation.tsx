'use client'

import { useState } from 'react'
import { DemoScenario } from '../../lib/demo-agent'
import { AnswerEvidencePart, DemoInlineEvidence, evidenceUrl } from '../../lib/demo-evidence'

function EvidencePopover({ citation, scenario, traceId }: { citation: DemoInlineEvidence; scenario: DemoScenario; traceId: string }) {
  return (
    <span className="mg-evidence-popover" role="dialog" aria-label="Memory evidence">
      <strong className="mg-evidence-popover__title">Memory evidence</strong>
      <dl>
        <div><dt>Role in output</dt><dd>{citation.role}</dd></div>
        <div><dt>Trust</dt><dd>{citation.trustScore === null ? citation.trustLevel : `${citation.trustScore} · ${citation.trustLevel}`}</dd></div>
        <div><dt>Policy</dt><dd>{citation.policy}</dd></div>
        <div><dt>Source</dt><dd>{citation.sourceId}</dd></div>
        <div><dt>Included in prompt</dt><dd>{citation.includedInPrompt ? 'Yes' : 'No'}</dd></div>
      </dl>
      <p className="mg-evidence-popover__quote">“{citation.evidenceQuote}”</p>
      <a href={evidenceUrl(scenario, traceId, 'lineage')} target="_blank" rel="noopener noreferrer">Open full evidence ↗</a>
    </span>
  )
}

function EvidenceChip({ citation, scenario, traceId }: { citation: DemoInlineEvidence; scenario: DemoScenario; traceId: string }) {
  const [open, setOpen] = useState(false)
  const panelId = `mg-evidence-${citation.id}`
  return (
    <span className="mg-evidence-citation">
      <button type="button" className="mg-evidence-citation__chip" aria-label={`Show memory evidence from ${citation.sourceLabel}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true">▤</span> {citation.sourceLabel}
      </button>
      {open && <span id={panelId} className="mg-evidence-citation__panel"><EvidencePopover citation={citation} scenario={scenario} traceId={traceId} /></span>}
    </span>
  )
}

export default function EvidenceCitation({ parts, scenario, traceId }: { parts: AnswerEvidencePart[]; scenario: DemoScenario; traceId: string }) {
  return (
    <p className="mg-agent-answer-body">
      {parts.map((part, index) => <span key={`${index}-${part.text}`}>{part.text}{part.citation && <EvidenceChip citation={part.citation} scenario={scenario} traceId={traceId} />}</span>)}
    </p>
  )
}
