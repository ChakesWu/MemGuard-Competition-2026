import { NextResponse } from 'next/server'
import { buildPrompt, cleanQuestion, NOT_FOUND, offlineAnswer, parseCitations, preflight, retrieve } from '../../../../lib/daxin/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMIT_PER_MINUTE = 12
const GLOBAL_PER_MINUTE = 120
const LLM_TIMEOUT_MS = 8000
const hits = new Map<string, number[]>()
let globalHits: number[] = []

// 函式實例內的簡易限流：只能擋住單一實例上的連續請求，不是完整的分散式限流。
function allowed(key: string, now: number) {
  const recent = (hits.get(key) ?? []).filter(t => now - t < 60_000)
  globalHits = globalHits.filter(t => now - t < 60_000)
  if (recent.length >= LIMIT_PER_MINUTE || globalHits.length >= GLOBAL_PER_MINUTE) { hits.set(key, recent); return false }
  recent.push(now)
  hits.set(key, recent)
  globalHits.push(now)
  if (hits.size > 5000) hits.clear()
  return true
}

function stripReasoning(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

async function askModel(question: string, retrievedIds: string[]) {
  const apiKey = process.env.GLM_API_KEY
  if (!apiKey) return null
  const base = (process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '')
  const { system, user } = buildPrompt(question, retrievedIds.map(id => ({ id, score: 0 })))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GLM_MODEL || 'glm-5.3-flashx',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.2,
        max_tokens: 500,
        reasoning_effort: 'low',
      }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const data = await response.json()
    const text = stripReasoning(String(data?.choices?.[0]?.message?.content ?? ''))
    return text.length ? text : null // 空回答當失敗，改走離線後備
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }) }
  const rawQuestion = typeof (body as { question?: unknown })?.question === 'string' ? (body as { question: string }).question : ''

  const guard = preflight(rawQuestion)
  if (guard.kind === 'fixed') return NextResponse.json({ mode: 'fixed', reason: guard.reason, answer: guard.message, citedIds: [], retrievedIds: [] })

  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  if (!allowed(ip, Date.now())) {
    return NextResponse.json({ mode: 'fixed', reason: 'rate_limited', answer: '提问太频繁，请稍后再试。', citedIds: [], retrievedIds: [] }, { status: 429 })
  }

  const question = cleanQuestion(rawQuestion)
  const retrieved = retrieve(question)
  const retrievedIds = retrieved.map(r => r.id)
  if (!retrieved.length) return NextResponse.json({ mode: 'not_found', answer: NOT_FOUND, citedIds: [], retrievedIds })

  const live = await askModel(question, retrievedIds)
  if (live) return NextResponse.json({ mode: 'live', answer: live, citedIds: parseCitations(live), retrievedIds })

  const fallback = offlineAnswer(retrieved)
  return NextResponse.json({ mode: 'offline', answer: fallback.answer, citedIds: fallback.citedIds, retrievedIds })
}
