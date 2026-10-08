'use client'

import { FormEvent, useState } from 'react'
import { DemoApproval, initialDemoResponse, respondToMessage, resolveApproval } from '../../lib/demo-agent'

type DemoMessage = { id: number; role: 'human' | 'assistant'; content: string }

export default function SupportAgentChat() {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<DemoMessage[]>([{ id: 0, role: 'assistant', content: initialDemoResponse() }])
  const [approval, setApproval] = useState<DemoApproval | null>(null)

  function resetDemo() {
    setMessages([{ id: 0, role: 'assistant', content: initialDemoResponse() }])
    setApproval(null)
    setDraft('')
  }

  function appendMessage(role: DemoMessage['role'], content: string) {
    setMessages((current) => [...current, { id: Date.now() + Math.random(), role, content }])
  }

  function sendText(text: string) {
    if (!text) return
    const response = respondToMessage(text)
    setMessages((current) => [
      ...current,
      { id: Date.now() + Math.random(), role: 'human', content: text },
      { id: Date.now() + Math.random(), role: 'assistant', content: response.answer },
    ])
    setApproval(response.approval)
    setDraft('')
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    sendText(draft.trim())
  }

  function decide(decision: 'approve' | 'edit' | 'reject') {
    appendMessage('assistant', resolveApproval(decision))
    setApproval(null)
  }

  return (
    <main className="mg-agent-page">
      <header className="mg-topbar mg-agent-topbar">
        <div className="mg-brand">
          <span className="mg-wordmark">MEMGUARD</span>
          <span className="mg-product-label">SUPPORT AGENT DEMO</span>
        </div>
        <div className="mg-topbar__actions">
          <a className="mg-button" href="/evidence">Evidence console</a>
          <button type="button" className="mg-button" onClick={resetDemo}>New conversation</button>
        </div>
      </header>

      <section className="mg-agent-shell" aria-label="Synthetic customer support agent demo">
        <aside className="mg-agent-context">
          <p className="mg-eyebrow">Offline simulated workflow</p>
          <h1>Customer support with accountable actions.</h1>
          <p>Fixed answers use the same synthetic order and policy facts as the live agent. The approval workflow is simulated; no API or external service is called.</p>
          <dl>
            <div><dt>Order</dt><dd><code>ORD-4821</code></dd></div>
            <div><dt>Customer</dt><dd>Alex Chen · VIP (synthetic)</dd></div>
            <div><dt>Policy</dt><dd>Refund policy v2 (synthetic)</dd></div>
          </dl>
          <button type="button" className="mg-agent-starter" onClick={() => sendText('I need a refund for ORD-4821 because the item is defective.')}>Try the policy scenario</button>
        </aside>

        <section className="mg-agent-chat">
          <header className="mg-agent-chat__header">
            <div>
              <p className="mg-eyebrow">Fixed example conversation</p>
              <h2>Support desk</h2>
            </div>
            <span className="mg-connection is-connected">Demo ready</span>
          </header>

          <div className="mg-agent-messages" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`mg-agent-message ${message.role === 'human' ? 'mg-agent-message--user' : 'mg-agent-message--assistant'}`}>
                <span className="mg-agent-message__label">{message.role === 'human' ? 'You' : 'Support agent demo'}</span>
                <p>{message.content}</p>
              </article>
            ))}
          </div>

          {approval && (
            <section className="mg-agent-approval" aria-label="Human approval required">
              <p className="mg-eyebrow">Human approval required · simulated</p>
              <h3>{approval.action.replaceAll('_', ' ')}</h3>
              <p>This action is <strong>{approval.policyDecision.replaceAll('_', ' ')}</strong> under {approval.policyVersion}. No business record has been written.</p>
              <div className="mg-agent-approval__details">
                {Object.entries(approval.arguments).map(([key, value]) => <span key={key}><b>{key.replaceAll('_', ' ')}</b> {String(value)}</span>)}
              </div>
              <div className="mg-agent-approval__actions">
                {approval.allowedDecisions.map((decision) => <button key={decision} type="button" className={`mg-button ${decision === 'approve' ? 'mg-button--primary' : decision === 'reject' ? 'mg-button--warning' : ''}`} onClick={() => decide(decision)}>{decision === 'edit' ? 'Edit request' : decision}</button>)}
              </div>
            </section>
          )}

          <form className="mg-agent-composer" onSubmit={submitMessage}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about an order or make a support request…" rows={3} />
            <button type="submit" className="mg-button mg-button--primary" disabled={!draft.trim()}>Send</button>
          </form>
        </section>
      </section>
    </main>
  )
}
