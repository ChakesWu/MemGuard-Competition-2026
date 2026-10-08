import EvidenceConsole from '../../components/EvidenceConsole'

type EvidenceQuery = { scenario?: string; trace?: string }

export default async function EvidencePage({ searchParams }: { searchParams: Promise<EvidenceQuery> }) {
  const { scenario, trace } = await searchParams
  return <EvidenceConsole scenario={scenario} traceId={trace} />
}
