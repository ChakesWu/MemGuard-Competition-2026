import { demoTraceChoices, evidenceUrl, getDemoTrace } from '../lib/demo-evidence'

export default function EvidenceConsole({ scenario, traceId }: { scenario?: string; traceId?: string }) {
  const trace = getDemoTrace(scenario, traceId)
  const activeSources = trace.sources.filter(source => source.status === 'active').length
  const expiredSources = trace.sources.filter(source => source.status === 'expired').length

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

      <div className="mg-dashboard-shell mg-demo-console">
        <aside className="mg-demo-nav" aria-label="Recorded outputs">
          <p className="mg-eyebrow">Recorded outputs</p>
          <h2>Inspect each answer</h2>
          <p>These are fixed, synthetic traces. Select one to inspect its sources and trust status.</p>
          <nav>
            {demoTraceChoices.map(choice => (
              <a key={choice.scenario} className={choice.scenario === trace.scenario ? 'is-active' : ''}
                href={evidenceUrl(choice.scenario, `demo-${choice.scenario}-1`, 'lineage')}>
                <strong>{choice.label}</strong><span>{choice.description}</span>
              </a>
            ))}
          </nav>
          <div className="mg-demo-nav__note">Selected trace <code>{trace.id}</code></div>
        </aside>

        <main className="mg-demo-workspace">
          <header className="mg-demo-workspace__header">
            <div><p className="mg-eyebrow">Trace / {trace.id}</p><h1>Why did it answer this?</h1></div>
            <span className={`mg-evidence-pill mg-evidence-pill--${trace.trust.state}`}>{trace.trust.label}</span>
          </header>

          <p className="mg-truth-note">This console replays synthetic evidence shaped like the product workflow. Recorded sources explain what the fixed answer used; they do not prove model causality or claim a live API run.</p>

          <section className="mg-demo-output" aria-labelledby="mg-demo-output-title">
            <p className="mg-eyebrow">Selected agent output</p>
            <h2 id="mg-demo-output-title">Answer</h2>
            <p>{trace.output}</p>
          </section>

          <section id="lineage" className="mg-demo-section" aria-labelledby="mg-lineage-title">
            <div className="mg-demo-section__heading"><div><p className="mg-eyebrow">Evidence lineage</p><h2 id="mg-lineage-title">Sources behind this answer</h2></div><span>{trace.sources.length} linked records</span></div>
            <div className="mg-demo-lineage">
              <div className="mg-demo-source-list">
                {trace.sources.map(source => (
                  <article key={source.id} className="mg-demo-source">
                    <div className="mg-demo-source__top"><span>{source.kind.replaceAll('_', ' ')}</span><span className={`mg-demo-source__status is-${source.status}`}>{source.status}</span></div>
                    <h3>{source.label}</h3>
                    <p>{source.detail}</p>
                    <dl><div><dt>Source</dt><dd><code>{source.id}</code></dd></div><div><dt>Version</dt><dd>{source.version}</dd></div><div><dt>Observed</dt><dd>{source.observed}</dd></div></dl>
                    <p className="mg-demo-source__role">{source.role}</p>
                  </article>
                ))}
              </div>
              <article className="mg-demo-result"><p className="mg-eyebrow">Recorded output</p><h3>{trace.id}</h3><p>{trace.output}</p><div>Resulting memory writes: <strong>{trace.resultingWrites.length}</strong></div></article>
            </div>
          </section>

          <section id="trust" className="mg-demo-section mg-demo-trust" aria-labelledby="mg-trust-title">
            <div className="mg-demo-section__heading"><div><p className="mg-eyebrow">Trust &amp; evidence check</p><h2 id="mg-trust-title">{trace.trust.label}</h2></div><span>No model-confidence percentage</span></div>
            <p>{trace.trust.explanation}</p>
            <dl className="mg-demo-metrics">
              <div><dt>Evidence snapshot</dt><dd>{trace.evidenceComplete ? 'Complete' : 'Incomplete'}</dd></div>
              <div><dt>Active sources</dt><dd>{activeSources}</dd></div>
              <div><dt>Expired sources</dt><dd>{expiredSources}</dd></div>
              <div><dt>Missing records</dt><dd>{trace.missingEvidence.length}</dd></div>
            </dl>
            {expiredSources > 0 && <p className="mg-demo-warning">Expired historical memory is displayed for inspection but is not accepted as current policy evidence.</p>}
          </section>

          <section className="mg-demo-section" aria-labelledby="mg-activity-title">
            <div className="mg-demo-section__heading"><div><p className="mg-eyebrow">Memory activity</p><h2 id="mg-activity-title">Recorded source reads</h2></div><span>Frozen sample</span></div>
            <div className="mg-demo-table-wrap"><table><thead><tr><th>Source</th><th>Version</th><th>State</th><th>Evidence role</th></tr></thead><tbody>
              {trace.sources.map(source => <tr key={source.id}><td><code>{source.id}</code></td><td>{source.version}</td><td>{source.status}</td><td>{source.role}</td></tr>)}
            </tbody></table></div>
          </section>

          <section className="mg-demo-section mg-demo-investigation" aria-labelledby="mg-investigation-title">
            <p className="mg-eyebrow">Separate investigation walkthrough</p><h2 id="mg-investigation-title">Stale policy → corrected replay</h2>
            <p>The offline investigation example flags one output that used refund-policy v1, keeps the historical trace unchanged, then replays against v2.</p>
            <div><span>Known affected outputs <strong>1</strong></span><span>Corrected replay <strong>PASS</strong></span><span>Replay origin <strong>external_runner</strong></span></div>
            <p className="mg-demo-investigation__note">This walkthrough is separate from the selected support-answer trace. No model or external business action is executed here.</p>
          </section>
        </main>
      </div>
    </div>
  )
}
