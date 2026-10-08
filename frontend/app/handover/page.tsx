import EnterpriseHandoverDemo from '../../components/EnterpriseHandoverDemo'
import { demoHandoverReport } from '../../lib/demo-handover'

export default function EnterpriseHandoverPage() {
  return (
    <div className="mg-app">
      <header className="mg-topbar">
        <div className="mg-brand"><span className="mg-wordmark">MEMGUARD</span><span className="mg-product-label">ENTERPRISE HANDOVER</span></div>
        <div className="mg-topbar__actions">
          <span className="mg-connection is-connected">Offline sample</span>
          <a className="mg-button" href="/">Evidence console</a>
          <a className="mg-button" href="/agent">Support agent</a>
        </div>
      </header>
      <EnterpriseHandoverDemo report={demoHandoverReport} />
    </div>
  )
}
