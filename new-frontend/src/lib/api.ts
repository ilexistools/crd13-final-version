import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: apiBaseUrl,
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

export type PrincipleCode = 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C' | 'D' | 'E'
export type WorkflowPrincipleCode = Exclude<PrincipleCode, 'A1' | 'A2' | 'A3'>

export type UnitPrincipleAnalysis = {
  assessment: unknown
  communicative_function?: string
  modality?: string
  principle: PrincipleCode
  unit: number
  text: string
}

export type KeyElements = {
  products: string[]
  animals: string[]
  establishments: string[]
  authorities: string[]
  countries: string[]
  zones: string[]
  diseases: string[]
  activities: string[]
  conditions: string[]
  regulatory_assurances: string[]
}

export type PrincipleAssessment = {
  compliance?: ComplianceStatus
  explanation?: string
  issue_identified?: string
  principle?: PrincipleCode
  principle_name?: string
  relevant_text_fragment?: string
}

export type A2AnalysisResult = {
  assessment: PrincipleAssessment
  attestation: string
  can_suggest_correction: boolean
  guidance: string
  identified_elements: KeyElements
  missing_information: string[]
  principle: 'A2'
  status: ComplianceStatus
  suggestions: Array<{
    id: string
    notes: string[]
    rationale: string
    text: string
  }>
}

export type A2ValidationResult = {
  a2_improved_or_preserved: boolean
  can_apply: boolean
  candidate_assessments: Partial<Record<PrincipleCode, PrincipleAssessment>>
  candidate_attestation: string
  candidate_a2_status: ComplianceStatus
  candidate_identified_elements: KeyElements
  candidate_missing_information: string[]
  original_a2_status: ComplianceStatus
  original_attestation: string
  preserved_principles: PrincipleCode[]
  principle: 'A2'
  regressions: Array<{ after: ComplianceStatus; before: ComplianceStatus; principle: PrincipleCode }>
  warnings: string[]
}

export type A3AnalysisResult = {
  assessment: PrincipleAssessment
  attestation: string
  can_suggest_correction: boolean
  communicative_function: string
  guidance: string
  modality: string
  principle: 'A3'
  recommended_template?: {
    id?: string
    category?: string
    communicative_function?: string
    modality?: string
    representative_example?: string
    structural_template?: string
  }
  status: ComplianceStatus
  suggestions: Array<{
    id: string
    notes: string[]
    rationale: string
    text: string
  }>
  supporting_text: string
  template_confidence?: number
  template_selection_rationale?: string
}

export type A3TemplateAdaptationResult = {
  adapted_attestation?: string | null
  confidence?: number
  final_assessment?: string
  input_attestation: string
  selected_template: {
    id?: string
    category?: string
    communicative_function?: string
    modality?: string
    representative_example?: string
    structural_template?: string
  }
  template_adaptation_decision: 'adapted' | 'not_adapted_review_required'
  template_selection_rationale: string
  unresolved_risks: string[]
}

export type A3ValidationResult = {
  a3_improved_or_preserved: boolean
  can_apply: boolean
  candidate_a3_status: ComplianceStatus
  candidate_assessments: Partial<Record<PrincipleCode, PrincipleAssessment>>
  candidate_attestation: string
  candidate_communicative_function: string
  candidate_modality: string
  classification_consistent: boolean
  confirmed_communicative_function: string
  confirmed_modality: string
  original_a3_status: ComplianceStatus
  original_attestation: string
  preserved_principles: PrincipleCode[]
  principle: 'A3'
  regressions: Array<{ after: ComplianceStatus; before: ComplianceStatus; principle: PrincipleCode }>
  warnings: string[]
}

export type WorkflowPrincipleAnalysisResult = {
  action_title: string
  assessment: PrincipleAssessment
  attestation: string
  can_suggest_correction: boolean
  checks: Array<{ evidence: string; label: string; passed: boolean }>
  correction_goal: string
  findings: Array<{ category: string; explanation: string; text: string }>
  guidance: string
  metrics: Array<{ label: string; value: string }>
  principle: WorkflowPrincipleCode
  status: ComplianceStatus
  suggestions: Array<{
    id: string
    notes: string[]
    rationale: string
    replacement_units: string[]
    text: string
  }>
  summary: string
}

export type WorkflowPrincipleValidationResult = {
  can_apply: boolean
  candidate_assessments: Partial<Record<PrincipleCode, PrincipleAssessment>>
  candidate_attestations: string[]
  candidate_status: ComplianceStatus
  candidate_target_assessment: PrincipleAssessment
  candidate_unit_assessments: Array<Partial<Record<PrincipleCode, PrincipleAssessment>>>
  candidate_unit_metadata: Array<{ communicative_function: string; modality: string }>
  meaning_preserved: boolean
  original_attestation: string
  original_status: ComplianceStatus
  preserved_principles: PrincipleCode[]
  principle: WorkflowPrincipleCode
  regressions: Array<{ after: ComplianceStatus; before: ComplianceStatus; principle: PrincipleCode }>
  target_improved_or_preserved: boolean
  warnings: string[]
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

export type A1UnitizationResult = {
  assessment?: unknown
  assurance_count: number
  context_preservation: {
    passed: boolean
    warnings: string[]
  }
  explanation: string
  identified_assurances: Array<{ index: number; text: string }>
  original_attestation: string
  principle: 'A1'
  requires_split: boolean
  status: ComplianceStatus
  suggested_unit_assessments: Array<{ assessment?: unknown; index: number; status: ComplianceStatus; text: string }>
  suggested_units: string[]
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
    commodities?: string[]
    processes?: string[]
  } | null
  section_id?: string | number
  section?: string
  summary?: string
  categories?: Array<string | { category?: string; subcategory?: string }>
  start_page?: number
  end_page?: number
  justification?: string
}

export type ReferenceDocument = NonNullable<AttestationSectionReference['document']>

export type AttestationSectionSearchResponse = {
  documents: ReferenceDocument[]
  results: AttestationSectionReference[]
}

export type ProvisionReference = {
  id?: number
  rank?: number
  relevance?: number | null
  sentence?: string
  category?: string
  modality?: string
  function?: string
  type?: string
  title?: string
  document_title?: string
  doc_title?: string
  section_title?: string
  page_start?: number
  page_end?: number
  document_id?: string
  document?: ReferenceDocument & {
    text?: string
  } | null
  commodities?: string[]
  units_json?: unknown
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

export type AgentSelectedUnit = {
  id?: string
  originalText?: string
  text: string
  unit: number
}

export type AgentUnitEditPlan = {
  summary: string
  steps: string[]
  tools: string[]
  expected_result: string
  risks: string[]
  requires_clarification: boolean
}

export type AgentUnitEditUpdate = {
  unit: number
  changed: boolean
  replacement_units: string[]
  notes: string[]
}

export type AgentUnitEditExecution = {
  summary: string
  updates: AgentUnitEditUpdate[]
  notes: string[]
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

const principleEndpoints: Record<PrincipleCode, string> = {
  A1: '/analyze_a1',
  A2: '/analyze_a2',
  A3: '/analyze_a3',
  B1: '/analyze_b1',
  B2: '/analyze_b2',
  C: '/analyze_c',
  D: '/analyze_d',
  E: '/analyze_e',
}

export async function analyzePrinciple(attestation: string, principle: PrincipleCode) {
  const response = await api.post<{ output: Omit<UnitPrincipleAnalysis, 'unit' | 'text'> }>(principleEndpoints[principle], {
    input: { attestation },
  })

  return response.data.output
}

export async function analyzeA2KeyElements(attestation: string) {
  const response = await api.post<{ output: A2AnalysisResult }>('/a2/analyze', {
    input: { attestation },
  })
  return response.data.output
}

export async function validateA2Correction(originalAttestation: string, candidateAttestation: string) {
  const response = await api.post<{ output: A2ValidationResult }>('/a2/validate-correction', {
    input: {
      original_attestation: originalAttestation,
      candidate_attestation: candidateAttestation,
    },
  })
  return response.data.output
}

export async function analyzeA3ModalityAndFunction(attestation: string) {
  const response = await api.post<{ output: A3AnalysisResult }>('/a3/analyze', {
    input: { attestation },
  })
  return response.data.output
}

export async function validateA3Correction(
  originalAttestation: string,
  candidateAttestation: string,
  confirmedModality: string,
  confirmedCommunicativeFunction: string,
  confirmedTemplateId: string,
) {
  const response = await api.post<{ output: A3ValidationResult }>('/a3/validate-correction', {
    input: {
      original_attestation: originalAttestation,
      candidate_attestation: candidateAttestation,
      confirmed_modality: confirmedModality,
      confirmed_communicative_function: confirmedCommunicativeFunction,
      confirmed_template_id: confirmedTemplateId,
    },
  })
  return response.data.output
}

export async function adaptA3ToTemplate(attestation: string, templateId: string) {
  const response = await api.post<{ output: A3TemplateAdaptationResult }>('/a3/adapt-template', {
    input: { attestation, template_id: templateId },
  })
  return response.data.output
}

const workflowPrinciplePaths: Record<WorkflowPrincipleCode, string> = {
  B1: 'b1',
  B2: 'b2',
  C: 'c',
  D: 'd',
  E: 'e',
}

export async function analyzeWorkflowPrinciple(attestation: string, principle: WorkflowPrincipleCode, originalAttestation?: string) {
  const response = await api.post<{ output: WorkflowPrincipleAnalysisResult }>(`/${workflowPrinciplePaths[principle]}/analyze`, {
    input: { attestation, original_attestation: originalAttestation },
  })
  return response.data.output
}

export async function validateWorkflowPrincipleCorrection(
  originalAttestation: string,
  candidateAttestations: string[],
  principle: WorkflowPrincipleCode,
  originalStatus: ComplianceStatus,
  protectedPrinciples: PrincipleCode[],
) {
  const response = await api.post<{ output: WorkflowPrincipleValidationResult }>(`/${workflowPrinciplePaths[principle]}/validate-correction`, {
    input: {
      original_attestation: originalAttestation,
      candidate_attestations: candidateAttestations,
      original_status: originalStatus,
      protected_principles: protectedPrinciples,
    },
  })
  return response.data.output
}

export async function generateTriples(text: string) {
  const response = await api.post('/generate_triples', {
    input: { text },
  })

  return response.data.output
}

export async function extractKeyElements(attestation: string) {
  const response = await api.post('/extract_key_elements', {
    input: { attestation },
  })

  return response.data.output
}

export async function unitizeText(text: string) {
  const response = await api.post<UnitizeTextResponse>('/unitize', {
    input: { text },
  })

  return response.data.output.results ?? []
}

export async function unitizeA1(attestation: string) {
  const response = await api.post<{ output: A1UnitizationResult }>('/a1/unitize', {
    input: { attestation },
  })

  return response.data.output
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

export async function searchAttestationSections(query: string, commodities: string[]) {
  const response = await api.post('/search_attestation_sections', {
    input: { attestation: query, commodities },
  })

  const rawOutput = response.data.output
  const output = (rawOutput?.output ?? rawOutput) as AttestationSectionSearchResponse
  const documents = Array.isArray(output.documents) ? output.documents : []
  const documentsById = new Map(documents.map((document) => [document.doc_id, document]))
  const results = Array.isArray(output.results) ? output.results : []

  return results.map((section) => ({
    ...section,
    document: section.document ?? documentsById.get(section.doc_id),
  }))
}

export async function searchProvisions(query: string, commodities: string[]) {
  const response = await api.post('/search_provisions', {
    input: { text: query, commodities },
  })

  const results = unwrapToolResults<ProvisionReference[]>(response.data.output)
  return Array.isArray(results) ? results : []
}

export async function listReferenceDocuments(commodities: string[]) {
  const response = await api.post('/reference_documents', {
    input: { commodities },
  })

  const results = unwrapToolResults<ReferenceDocument[]>(response.data.output)
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

export async function planAgentUnitEdits(
  request: string,
  units: AgentSelectedUnit[],
  commodities: string[],
  context: Record<string, unknown>,
) {
  const response = await api.post('/agent/plan_unit_edits', {
    input: {
      request,
      units,
      commodities,
      context,
    },
  })

  return (unwrapToolResults<AgentUnitEditPlan>(response.data.output) ?? {}) as AgentUnitEditPlan
}

export async function executeAgentUnitEdits(
  request: string,
  plan: AgentUnitEditPlan,
  units: AgentSelectedUnit[],
  commodities: string[],
  context: Record<string, unknown>,
) {
  const response = await api.post('/agent/execute_unit_edits', {
    input: {
      request,
      plan,
      units,
      commodities,
      context,
    },
  })

  return (unwrapToolResults<AgentUnitEditExecution>(response.data.output) ?? {}) as AgentUnitEditExecution
}

function unwrapToolResults<T>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object') return value as T | undefined
  const payload = value as Record<string, unknown>
  if (payload.results !== undefined) return payload.results as T
  if (payload.output && typeof payload.output === 'object') {
    const output = payload.output as Record<string, unknown>
    if (output.results !== undefined) return output.results as T
    if (output.output && typeof output.output === 'object') {
      const nestedOutput = output.output as Record<string, unknown>
      if (nestedOutput.results !== undefined) return nestedOutput.results as T
    }
  }
  return value as T
}
