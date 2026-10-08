import { demoTraceChoices, evidenceUrl, getDemoTrace } from '../lib/demo-evidence'

const memoryCards = [
  { id: 'ORD-4821', title: 'Noise-cancelling headphones order', status: 'used', score: '95% trust', detail: 'Delivered 5 July 2026 · Payment paid · Customer Alex Chen', source: 'support_order_db · ORD-4821', writer: 'support-order-sync', reason: 'Current order facts support the answer claims.' },
  { id: 'refund-policy', title: 'Refund policy v2', status: 'available', score: '93% trust', detail: '14-day standard window · Defective items outside the window require manual review', source: 'support_policy_db · refund-policy', writer: 'policy-administration', reason: 'Active policy is available for the decision.' },
  { id: 'MEM-EXCEPTION-77', title: 'One-time customer refund exception', status: 'rejected', score: 'Not scored', detail: 'One future order had a 30-day exception · Expired 20 July 2026', source: 'support_agent_note · TICKET-8842', writer: 'System record', reason: 'Expired memory was rejected by policy.' },
  { id: 'MEM-SUMMARY-31', title: 'Support Summary', status: 'rejected', score: 'Not scored', detail: 'Agent-generated summary mentions an old refund exception.', source: 'agent_generated_summary · TICKET-8842', writer: 'System record', reason: 'Required governance metadata is missing.' },
]

export default function EvidenceConsole({ scenario, traceId }: { scenario?: string; traceId?: string }) {
  const trace = getDemoTrace(scenario, traceId)
  const usedSources = trace.sources.filter(source => source.kind === 'business_record' || source.kind === 'policy')
  const rejectedSources = trace.sources.filter(source => source.status === 'expired')

  return (
    <div className="mg-app">
      <header className="mg-topbar">
        <div className="mg-brand"><span className="mg-wordmark">MEMGUARD</span><span className="mg-product-label">EVIDENCE CONSOLE</span></div>
        <div className="mg-topbar__actions">
          <span className="mg-connection is-connected">Offline sample</span>
          <a className="mg-button" href="/agent">Support agent</a>
          <a className="mg-button" href="/handover">Enterprise handover</a>
        </div>
      </header>

      <div className="mg-dashboard-shell mg-console-layout">
        <aside className="mg-output-nav" aria-label="Agent outputs">
          <div className="mg-output-nav__header">
            <p className="mg-eyebrow">Output-first investigation</p>
            <div className="mg-output-nav__title-row"><h2>Agent outputs</h2><span>{demoTraceChoices.length}</span></div>
            <label className="mg-field-label" htmlFor="mg-agent-filter">Agent</label>
            <select id="mg-agent-filter" className="mg-select" defaultValue="customer_support_agent" disabled>
              <option value="customer_support_agent">customer_support_agent</option>
            </select>
          </div>
          <div className="mg-output-list">
            {demoTraceChoices.map(choice => {
              const selected = choice.scenario === trace.scenario
              const output = getDemoTrace(choice.scenario).output
              return <a key={choice.scenario} className={`mg-output-item${selected ? ' is-selected' : ''}`} href={evidenceUrl(choice.scenario, `demo-${choice.scenario}-1`, 'lineage')} aria-current={selected ? 'page' : undefined}>
                <span className="mg-output-item__topline"><span className="mg-output-item__agent">customer_support_agent</span><time>14:21</time></span>
                <span className="mg-output-item__preview">{output}</span>
                <span className="mg-output-item__meta"><span>{choice.scenario === 'refund' ? '2' : '1'} evidence</span><span>0 writes</span><span>0.80 rank</span></span>
              </a>
            })}
          </div>
        </aside>

        <div className="mg-main-column">
          <main className="mg-workspace">
            <header className="mg-workspace__header">
              <div><p className="mg-eyebrow">Governed answer evidence</p><h1>Why did the agent say this?</h1></div>
              <dl className="mg-trace-meta"><div><dt>Agent</dt><dd>customer support agent</dd></div><div><dt>Memory used</dt><dd>{usedSources.length}</dd></div><div><dt>Output</dt><dd>{trace.id}</dd></div></dl>
            </header>
            <p className="mg-truth-note">This offline console presents a fixed, synthetic trace. It shows the evidence and policy state associated with the selected answer; it does not call a model or claim live database access.</p>
            <section className="mg-selected-output" aria-labelledby="mg-selected-output-title"><h2 id="mg-selected-output-title">Agent answer</h2><p>{trace.output}</p></section>

            <div className="mg-section-heading"><h2>Evidence story</h2><p>Claim → memory used → evidence quote → governance decision</p></div>
            <section className="mg-story-list" aria-label="Claim evidence stories">
              {usedSources.map((source, index) => <article className="mg-story-card" key={source.id}>
                <div className="mg-story-card__step"><span>1</span><div><small>Agent said</small><strong>{index === 0 ? 'ORD-4821' : '2026-07-05'}</strong></div></div><div className="mg-story-card__connector" aria-hidden="true" />
                <div className="mg-story-card__step"><span>2</span><div><small>Memory used</small><strong>{source.label}</strong><p>{source.detail}</p></div></div><div className="mg-story-card__connector" aria-hidden="true" />
                <div className="mg-story-card__step"><span>3</span><div><small>Evidence quote</small><blockquote>{source.detail}</blockquote></div></div><div className="mg-story-card__connector" aria-hidden="true" />
                <div className="mg-story-card__step"><span>4</span><div><small>Why MemGuard allowed it</small><strong>{source.kind.replaceAll('_', ' ')}</strong><p>{source.role}</p></div></div>
                <details className="mg-technical-details"><summary>Technical details</summary><dl><div><dt>Record</dt><dd>{source.id}</dd></div><div><dt>Version</dt><dd>{source.version}</dd></div><div><dt>State</dt><dd>{source.status}</dd></div><div><dt>Trace</dt><dd>{trace.id}</dd></div></dl></details>
              </article>)}
            </section>

            <section className="mg-related-memory" aria-labelledby="mg-related-memory-title"><header><div><p className="mg-eyebrow">Decision boundary</p><h2 id="mg-related-memory-title">Other memory the agent could have encountered</h2></div></header>
              <div className="mg-related-memory__columns">
                <article><h3>Rejected by MemGuard <span>{rejectedSources.length || 2}</span></h3>{(rejectedSources.length ? rejectedSources : trace.sources.filter(source => source.status === 'expired')).map(source => <div key={source.id}><strong>{source.label}</strong><p>{source.detail}</p><small>Expired or missing governance metadata; excluded from this answer.</small></div>)}</article>
                <article><h3>Available, not used <span>{trace.sources.some(source => source.kind === 'policy') ? 1 : 0}</span></h3>{trace.sources.filter(source => source.kind === 'policy').map(source => <div key={source.id}><strong>{source.label}</strong><p>{source.detail}</p><small>Eligible policy evidence; no separate claim link in this fixed trace.</small></div>)}</article>
              </div>
            </section>
          </main>

          <section className="mg-inventory" aria-labelledby="mg-inventory-title"><header className="mg-inventory__header"><div><p className="mg-eyebrow">Governed memory inventory</p><h2 id="mg-inventory-title">What the agent actually remembers</h2><p>Synthetic records available to the support agent, shown with their governance state.</p></div><span>{memoryCards.length} memories</span></header>
            <div className="mg-inventory__list">{memoryCards.map(memory => <article className={`mg-memory-card mg-memory-card--${memory.status}`} key={memory.id}>
              <header><div><span className={`mg-memory-status mg-memory-status--${memory.status}`}>{memory.status === 'used' ? 'Used in this answer' : memory.status === 'rejected' ? 'Rejected by policy' : 'Available, not used'}</span><h3>{memory.title}</h3></div><strong className="mg-trust-score">{memory.score}</strong></header>
              <p className="mg-memory-summary">{memory.detail}</p><div className="mg-memory-explanation"><h4>{memory.status === 'used' ? 'Why this memory was used' : 'Why MemGuard made this decision'}</h4><p>{memory.reason}</p></div>
              <dl className="mg-memory-facts"><div><dt>Source</dt><dd>{memory.source}</dd></div><div><dt>Writer</dt><dd>{memory.writer}</dd></div><div><dt>Verified</dt><dd>2026-10-07</dd></div><div><dt>Conflict check</dt><dd>none</dd></div></dl>
            </article>)}</div>
          </section>

          <section className="mg-events" aria-labelledby="mg-events-title"><header className="mg-events__header"><div><p className="mg-eyebrow">Memory activity</p><h2 id="mg-events-title">Related memory events</h2></div><div className="mg-events__counts"><span>{usedSources.length} total events</span><span>{demoTraceChoices.length} visible outputs</span></div></header>
            <div className="mg-operation-filter" aria-label="Filter memory events">{['all', 'create', 'read', 'update', 'delete', 'query'].map((operation, index) => <button key={operation} type="button" aria-pressed={index === 0} className={index === 0 ? 'is-active' : ''}>{operation}</button>)}</div>
            <div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Time</th><th>Operation</th><th>Agent</th><th>Memory key</th><th>Type</th><th>Content hash</th></tr></thead><tbody>{usedSources.map(source => <tr key={source.id}><td>14:21:25</td><td><span className="mg-operation mg-operation--read">READ</span></td><td>customer_support_agent</td><td><code>{source.id}</code></td><td>{source.kind}</td><td><code>e8b5e6040392…</code></td></tr>)}</tbody></table></div>
          </section>
        </div>
      </div>
    </div>
  )
}
