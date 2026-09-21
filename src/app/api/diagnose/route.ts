import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { aiVision } from '@/lib/ai'
import type { DiagnosisReport } from '@/types/diagnose'

const SYSTEM_PROMPT = `You are an expert agricultural pathologist. Analyze the crop image and return ONLY valid JSON with no markdown, no code fences, no explanation — just raw JSON.

The JSON must follow this exact schema:
{
  "disease_name": string,
  "is_diseased": boolean,
  "confidence_pct": number,
  "affected_part": "leaf" | "stem" | "fruit" | "root",
  "severity": "low" | "medium" | "high" | "critical",
  "cause": string,
  "symptoms": string[],
  "organic_treatment": string[],
  "chemical_treatment": [{"product": string, "dosage": string, "frequency": string}],
  "prevention_tips": string[],
  "estimated_yield_loss_pct_if_untreated": number,
  "urgency_days": number
}`

function normalizeSeverity(raw: unknown): 'low' | 'medium' | 'high' | 'critical' {
  const s = String(raw ?? '').toLowerCase().trim()
  if (s === 'low' || s === 'mild' || s === 'none') return 'low'
  if (s === 'high' || s === 'severe') return 'high'
  if (s === 'critical') return 'critical'
  return 'medium'
}

function normalizeConfidence(raw: unknown): number {
  if (typeof raw === 'number' && !isNaN(raw)) {
    const val = raw <= 1 && raw > 0 ? Math.round(raw * 100) : Math.round(raw)
    return Math.min(100, Math.max(0, val))
  }
  const cleaned = parseFloat(String(raw ?? '').replace(/[^0-9.]/g, ''))
  if (!isNaN(cleaned)) {
    const val = cleaned <= 1 && cleaned > 0 ? Math.round(cleaned * 100) : Math.round(cleaned)
    return Math.min(100, Math.max(0, val))
  }
  return 85
}

function parseReport(rawContent: string): DiagnosisReport {
  const cleaned = rawContent.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim()
  // Extract JSON object if any prose leaked in
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned
  const parsed = JSON.parse(jsonStr) as DiagnosisReport

  const required = ['disease_name', 'is_diseased', 'confidence_pct', 'severity']
  for (const field of required) {
    if (parsed[field as keyof DiagnosisReport] === undefined) {
      throw new Error(`AI response missing required field: ${field}`)
    }
  }

  // Normalize fields to ensure database constraint compatibility
  parsed.severity = normalizeSeverity(parsed.severity)
  parsed.confidence_pct = normalizeConfidence(parsed.confidence_pct)
  parsed.is_diseased = Boolean(parsed.is_diseased)
  parsed.symptoms = Array.isArray(parsed.symptoms) ? parsed.symptoms : []
  parsed.organic_treatment = Array.isArray(parsed.organic_treatment) ? parsed.organic_treatment : []
  parsed.chemical_treatment = Array.isArray(parsed.chemical_treatment) ? parsed.chemical_treatment : []
  parsed.prevention_tips = Array.isArray(parsed.prevention_tips) ? parsed.prevention_tips : []

  return parsed
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { imageBase64Array, cropType } = body as { imageBase64Array: string[]; cropType: string }

    if (!imageBase64Array?.length || !cropType) {
      return NextResponse.json({ error: 'imageBase64Array and cropType are required' }, { status: 400 })
    }
    if (imageBase64Array.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 images allowed' }, { status: 400 })
    }

    const userText = `Analyze this ${cropType} crop image for diseases. Return only the JSON object, nothing else.`
    let rawContent: string
    try {
      rawContent = await aiVision(imageBase64Array, userText, SYSTEM_PROMPT, { maxTokens: 1500, temperature: 0.1 })
    } catch (err) {
      return NextResponse.json(
        { error: `AI providers all failed: ${err instanceof Error ? err.message : 'unknown'}` },
        { status: 502 }
      )
    }

    let report: DiagnosisReport
    try {
      report = parseReport(rawContent)
    } catch {
      // retry once
      try {
        rawContent = await aiVision(imageBase64Array, userText, SYSTEM_PROMPT, { maxTokens: 1500, temperature: 0.1 })
        report = parseReport(rawContent)
      } catch {
        return NextResponse.json(
          { error: 'AI returned invalid JSON after retry', raw: rawContent.slice(0, 500) },
          { status: 502 }
        )
      }
    }

    // Ensure user profile exists in public.users to satisfy the foreign key constraint
    try {
      await supabase.from('users').upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Farmer',
        },
        { onConflict: 'id' }
      )
    } catch (userUpsertErr) {
      console.warn('[/api/diagnose] Note: user profile upsert warning:', userUpsertErr)
    }

    const imageUrls: string[] = body.imageUrls ?? []
    const { data: diagnosis, error: dbError } = await supabase
      .from('diagnoses')
      .insert({
        user_id: user.id,
        crop_type: cropType,
        image_urls: imageUrls,
        disease_name: report.disease_name,
        confidence_pct: report.confidence_pct,
        severity: report.severity,
        full_report_json: report,
        status: 'open',
      })
      .select('id')
      .single()

    if (dbError || !diagnosis?.id) {
      console.error('[/api/diagnose] DB insert error:', dbError)
      return NextResponse.json(
        {
          error: `Database save failed: ${dbError?.message || 'Unable to record diagnosis in database'}`,
          report,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ report, diagnosisId: diagnosis.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/diagnose] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
