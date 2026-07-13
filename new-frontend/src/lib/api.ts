import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
})

type ExtractPdfTextResponse = {
  full_text: string
  pages: Array<{
    page: number
    text: string
  }>
}

type IdentifyCommoditiesResponse = {
  output: {
    results?: string[]
  }
}

export type ComplianceReportRow = {
  code: string
  principle: string
  status: 'Compliant' | 'Partially Compliant' | 'Non-Compliant'
  problem_summary: string
  affected_units: number[]
}

export type ComplianceStatus = 'Compliant' | 'Partially Compliant' | 'Non-Compliant'

export type UnitComplianceStatus = ComplianceStatus | 'Analyzing' | null

export type UnitComplianceAnalysis = {
  analysis: unknown
  text: string
  unit: number
}

export type UnitTriples = {
  triples: unknown
  unit: number
}

export type ComplianceReport = {
  overall_status: ComplianceStatus
  summary: {
    total_units: number
    compliant_units: number
    partially_compliant_units: number
    non_compliant_units: number
  }
  rows: ComplianceReportRow[]
  unit_summaries?: Array<{
    unit: number
    status: ComplianceStatus
    summary: string
  }>
}

type ConsolidateComplianceReportResponse = {
  output: ComplianceReport
}

type UnitizeTextResponse = {
  output: {
    results?: string[]
  }
}

export type AttestationSectionReference = {
  doc_id?: string
  document?: {
    doc_id?: string
    type?: string
    document_type?: string
    reference?: string
    year?: string
    title?: string
    label?: string
    committee?: string
    last_modified?: string
    url?: string
  } | null
  section_id?: string | number
  section?: string
  summary?: string
  categories?: Array<string | { category?: string; subcategory?: string }>
  start_page?: number
  end_page?: number
  justification?: string
}

export type AttestationRewriteChange = {
  change_type?: string
  target_fragment?: string
  suggested_change?: string
  rationale?: string
  guideline_principles?: string[]
  supporting_sections?: Array<{
    doc_id?: string
    section_id?: string | number
    section?: string
  }>
}

export type AttestationRewritePlanResult = {
  decision?: 'changes_recommended' | 'unchanged' | 'insufficient_basis' | string
  principle_assessments?: Array<{
    principle?: string
    principle_name?: string
    current_compliance?: string
    issue_identified?: string
    rewrite_attention?: 'preserve' | 'address' | 'monitor' | string
    rationale?: string
  }>
  changes?: AttestationRewriteChange[]
  notes?: string[]
}

export type AttestationChangeApplicationResult = {
  decision?: 'rewritten' | 'unchanged' | 'insufficient_basis' | 'rejected_due_to_regression' | string
  rewritten_attestation?: string
  candidate_attestation?: string | null
  applied_changes?: Array<{
    change_type?: string
    target_fragment?: string
    applied_change?: string
  }>
  post_rewrite_compliance?: unknown
  regression_check?: {
    passed?: boolean
    regressed_principles?: string[]
    notes?: string[]
  } | null
  notes?: string[]
}

export type AttestationCorrectionResult = {
  decision?: 'corrected' | 'unchanged' | 'insufficient_basis' | string
  corrected_attestation?: string
  correction_mode?: 'single_attestation' | 'unitized_attestations' | string
  corrected_units?: string[]
  applied_principles?: string[]
  correction_notes?: string[]
}

export async function extractPdfText(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post<ExtractPdfTextResponse>('/extract_pdf_text', formData)
  return response.data.full_text
}

export async function identifyCommodities(text: string) {
  const response = await api.post<IdentifyCommoditiesResponse>('/identify_commodities', {
    input: { text },
  })

  return response.data.output.results ?? []
}

export async function analyzeCompliance(attestation: string) {
  const response = await api.post('/analyze_compliance', {
    input: { attestation },
  })

  return response.data.output
}

export async function generateTriples(text: string) {
  const response = await api.post('/generate_triples', {
    input: { text },
  })

  return response.data.output
}

export async function unitizeText(text: string) {
  const response = await api.post<UnitizeTextResponse>('/unitize', {
    input: { text },
  })

  return response.data.output.results ?? []
}

export async function consolidateComplianceReport(unitAnalyses: unknown[]) {
  const response = await api.post<ConsolidateComplianceReportResponse>('/consolidate_compliance_report', {
    input: { unit_analyses: unitAnalyses },
  })

  return response.data.output
}

export async function analyzeAttestationSections(attestation: string, commodities: string[]) {
  const response = await api.post('/analyze_attestation_sections', {
    input: { attestation, commodities },
  })

  const results = unwrapToolResults<AttestationSectionReference[]>(response.data.output)
  return Array.isArray(results) ? results : []
}

export async function planAttestationRewriteChanges(
  attestation: string,
  sections: AttestationSectionReference[],
) {
  const response = await api.post('/plan_attestation_rewrite_changes', {
    input: { attestation, sections },
  })

  return (unwrapToolResults<AttestationRewritePlanResult>(response.data.output) ?? {}) as AttestationRewritePlanResult
}

export async function applyAttestationChanges(
  attestation: string,
  changes: AttestationRewriteChange[],
) {
  const response = await api.post('/apply_attestation_changes', {
    input: { attestation, changes },
  })

  return (unwrapToolResults<AttestationChangeApplicationResult>(response.data.output) ?? {}) as AttestationChangeApplicationResult
}

export async function suggestAttestationCorrection(
  attestation: string,
  complianceAnalysis?: unknown,
  allowedPrinciples?: string[],
) {
  const response = await api.post('/suggest_attestation_correction', {
    input: {
      attestation,
      compliance_analysis: complianceAnalysis,
      allowed_principles: allowedPrinciples,
    },
  })

  return (unwrapToolResults<AttestationCorrectionResult>(response.data.output) ?? {}) as AttestationCorrectionResult
}

function unwrapToolResults<T>(value: any): T | undefined {
  if (value?.results !== undefined) return value.results as T
  if (value?.output?.results !== undefined) return value.output.results as T
  if (value?.output?.output?.results !== undefined) return value.output.output.results as T
  return value as T
}
