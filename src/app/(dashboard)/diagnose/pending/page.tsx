'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { DiagnosisReport } from '@/types/diagnose'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Leaf,
  FlaskConical,
  Sprout,
  Shield,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const SEVERITY_CONFIG = {
  low: { label: 'Low', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  medium: { label: 'Medium', classes: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle },
  high: { label: 'High', classes: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
  critical: { label: 'Critical', classes: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Confidence</span>
        <span className="font-semibold">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center">
          <Icon className="w-4 h-4 mr-2 text-emerald-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function DiagnosePendingPage() {
  const router = useRouter()
  const [data, setData] = useState<{ report: DiagnosisReport; cropType: string } | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pending_diagnosis')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.report) {
          setData(parsed)
        }
      }
    } catch {
      // Ignore parse error
    } finally {
      setChecked(true)
    }
  }, [])

  if (!checked) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center text-slate-500">
        <p>Loading diagnosis details…</p>
      </div>
    )
  }

  if (!data?.report) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <Sprout className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">No Pending Diagnosis</h2>
        <p className="text-sm text-slate-500">
          We couldn&apos;t find an active diagnosis report in this session. Start a new diagnosis to analyze your crop.
        </p>
        <div className="pt-2">
          <Link href="/diagnose">
            <Button className="bg-emerald-600 hover:bg-emerald-700">Go to Diagnose</Button>
          </Link>
        </div>
      </div>
    )
  }

  const { report, cropType } = data
  const severity = report.severity ?? 'low'
  const severityConf = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low
  const SeverityIcon = severityConf.icon

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-slate-500 space-x-1">
        <Link href="/diagnose" className="hover:text-emerald-600 transition-colors">
          Diagnose
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-700 font-medium">Session Result</span>
      </nav>

      {/* Info notice */}
      <div className="flex items-start space-x-3 p-4 rounded-xl border border-blue-200 bg-blue-50">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Session Analysis Result</p>
          <p className="text-xs text-blue-700 mt-0.5">
            This diagnosis is displayed from your current browser session.
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <Card
        className={`border-2 ${
          report.severity === 'critical'
            ? 'border-red-200'
            : report.severity === 'high'
            ? 'border-orange-200'
            : 'border-slate-200'
        }`}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${severityConf.classes}`}
                >
                  <SeverityIcon className="w-3.5 h-3.5" />
                  {severityConf.label} Severity
                </span>
                <span className="text-xs text-slate-400 uppercase tracking-wide">
                  {cropType || 'Crop'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">
                {report.disease_name || 'Unknown Condition'}
              </h1>
              {report.affected_part && (
                <p className="text-sm text-slate-500 mt-1">
                  Affected part:{' '}
                  <span className="capitalize font-medium text-slate-700">
                    {report.affected_part}
                  </span>
                </p>
              )}
              {report.confidence_pct !== undefined && (
                <ConfidenceBar value={report.confidence_pct} />
              )}
            </div>
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                report.severity === 'critical' || report.severity === 'high'
                  ? 'bg-red-50'
                  : 'bg-emerald-50'
              }`}
            >
              {report.is_diseased ? (
                <AlertTriangle
                  className={`w-8 h-8 ${
                    report.severity === 'critical' || report.severity === 'high'
                      ? 'text-red-500'
                      : 'text-amber-500'
                  }`}
                />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400">Est. Yield Loss</p>
              <p className="text-lg font-bold text-red-600 mt-0.5">
                {report.estimated_yield_loss_pct_if_untreated ?? '—'}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Act Within</p>
              <p className="text-lg font-bold text-amber-600 mt-0.5">
                {report.urgency_days ?? '—'} days
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm font-semibold text-emerald-700 mt-0.5">Analyzed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Details */}
      <div className="space-y-4">
        {/* Cause */}
        {report.cause && (
          <Section title="Root Cause" icon={Leaf}>
            <p className="text-sm text-slate-700 leading-relaxed">{report.cause}</p>
          </Section>
        )}

        {/* Symptoms */}
        {report.symptoms?.length > 0 && (
          <Section title="Observed Symptoms" icon={AlertTriangle}>
            <ul className="space-y-2">
              {report.symptoms.map((s, i) => (
                <li key={i} className="flex items-start text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2.5 mt-1.5 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Organic Treatment */}
        {report.organic_treatment?.length > 0 && (
          <Section title="Organic Treatment" icon={Sprout} className="border-emerald-100">
            <ul className="space-y-2">
              {report.organic_treatment.map((t, i) => (
                <li key={i} className="flex items-start text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2.5 mt-1.5 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Chemical Treatment */}
        {report.chemical_treatment?.length > 0 && (
          <Section title="Chemical Treatment" icon={FlaskConical} className="border-blue-100">
            <div className="space-y-3">
              {report.chemical_treatment.map((c, i) => (
                <div key={i} className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <p className="text-sm font-semibold text-blue-900">{c.product}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-blue-400">Dosage</p>
                      <p className="text-xs text-blue-800 font-medium">{c.dosage}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-blue-400">Frequency</p>
                      <p className="text-xs text-blue-800 font-medium">{c.frequency}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Prevention */}
        {report.prevention_tips?.length > 0 && (
          <Section title="Prevention Tips" icon={Shield}>
            <ul className="space-y-2">
              {report.prevention_tips.map((t, i) => (
                <li key={i} className="flex items-start text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2.5 mt-1.5 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Urgency Warning */}
        {report.urgency_days <= 3 && (
          <div className="flex items-start space-x-3 p-4 rounded-xl border border-red-200 bg-red-50">
            <Clock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">⚠️ Urgent Action Required</p>
              <p className="text-sm text-red-700 mt-0.5">
                Treat within <strong>{report.urgency_days} day{report.urgency_days !== 1 ? 's' : ''}</strong> to prevent further damage. Untreated, this may cause up to <strong>{report.estimated_yield_loss_pct_if_untreated}% yield loss</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Link href="/diagnose" className="flex-1">
          <Button variant="outline" className="w-full h-11">
            New Diagnosis
          </Button>
        </Link>
        <Link href="/diagnose/history" className="flex-1">
          <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-700">
            View History
          </Button>
        </Link>
      </div>
    </div>
  )
}
