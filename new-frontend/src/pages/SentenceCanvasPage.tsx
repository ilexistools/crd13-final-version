import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined'
import RadioButtonCheckedOutlinedIcon from '@mui/icons-material/RadioButtonCheckedOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  IconButton,
  MenuItem,
  Stack,
  TextareaAutosize,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { ComplianceReport, ComplianceReportRow, adaptA3ToTemplate, analyzeA2KeyElements, analyzeA3ModalityAndFunction, analyzeWorkflowPrinciple, apiBaseUrl, validateA2Correction, validateA3Correction, validateWorkflowPrincipleCorrection, type A2AnalysisResult, type A2ValidationResult, type A3AnalysisResult, type A3TemplateAdaptationResult, type A3ValidationResult, type AttestationSectionReference, type ComplianceStatus, type KeyElements, type PrincipleCode, type ProvisionReference, type ReferenceDocument, type UnitComplianceAnalysis, type UnitComplianceStatus, type UnitPrincipleAnalysis, type UnitTriples, type WorkflowPrincipleAnalysisResult, type WorkflowPrincipleCode, type WorkflowPrincipleValidationResult } from '../lib/api'
import type { AttestationUnit } from '../lib/editorUnits'
import { getTemplates } from '../lib/templates/catalog'

export type EditorView = 'units' | 'compliance' | 'references'
type UnitDataView = 'attestation' | 'triples' | 'key-elements' | 'original-text'

const unitDataViews: Array<{ id: UnitDataView; label: string }> = [
  { id: 'attestation', label: 'Attestation' },
  { id: 'triples', label: 'Triples' },
  { id: 'key-elements', label: 'Key elements' },
  { id: 'original-text', label: 'Original text' },
]

const principleCodes = ['A1', 'A2', 'A3', 'B1', 'B2', 'C', 'D', 'E'] as const
const attestationTemplates = getTemplates().items.filter((template) => template.modality && template.modality !== 'undefined')
const attestationModalities = [...new Set(attestationTemplates.map((template) => template.modality))].sort()

function getProtectedPrinciples(
  unit: AttestationUnit,
  analyses: UnitPrincipleAnalysis[],
  target: WorkflowPrincipleCode,
): PrincipleCode[] {
  const targetIndex = principleCodes.indexOf(target)
  return principleCodes.slice(0, targetIndex).filter((principle) => {
    if (principle === 'A1') return unit.unitizationReviewed
    const analysis = analyses.find((item) => item.principle === principle)
    const assessment = isRecord(analysis?.assessment) ? analysis.assessment : {}
    const decision = unit.principleDecisions?.[principle]
    return assessment.compliance === 'Compliant' || decision?.revision === unit.revision
  })
}

type SentenceCanvasPageProps = {
  activeView: EditorView
  commodities: string[]
  complianceReport: ComplianceReport | null
  generatingTripleUnitNumbers: number[]
  isAnalyzingCompliance: boolean
  isLoadingReferenceDocuments: boolean
  isSearchingReferences: boolean
  referenceQuery: string
  referenceDocuments: ReferenceDocument[]
  referenceDocumentsError: string
  referenceProvisionResults: ProvisionReference[]
  referenceResults: AttestationSectionReference[]
  referenceSearchError: string
  unitizingIndexes: Set<number>
  units: AttestationUnit[]
  selectedIndexes: Set<number>
  lockedIndexes: Set<number>
  unitAnalyses: UnitComplianceAnalysis[]
  unitPrincipleAnalyses: UnitPrincipleAnalysis[]
  unitComplianceStatuses: UnitComplianceStatus[]
  unitTriples: UnitTriples[]
  onAddSentence: () => void
  onClearSelection: () => void
  onRemoveSelected: () => void
  onRemoveSentence: (index: number) => void
  onSelectAll: () => void
  onSelectSentence: (index: number, event: MouseEvent<HTMLElement>) => void
  onSentenceChange: (index: number, value: string) => void
  onApplyA2Correction: (index: number, candidate: string, validation: A2ValidationResult) => void
  onApplyA3Correction: (index: number, candidate: string, validation: A3ValidationResult, templateId: string) => void
  onApplyWorkflowCorrection: (index: number, principle: WorkflowPrincipleCode, candidates: string[], validation: WorkflowPrincipleValidationResult) => void
  onAnalyzeSentence: (index: number) => void
  onApproveSentence: (index: number) => void
  onGenerateTriplesSentence: (index: number) => void
  onOpenReferencesForSentence: (index: number) => void
  onOpenRewriteForSentence: (index: number) => void
  onKeepA2AsIs: (index: number, reason: string, status: ComplianceStatus) => void
  onKeepA3AsIs: (index: number, status: ComplianceStatus, modality: string, communicativeFunction: string, templateId: string) => void
  onKeepWorkflowAsIs: (index: number, principle: WorkflowPrincipleCode, status: ComplianceStatus) => void
  onRecordA2Analysis: (index: number, analysis: A2AnalysisResult) => void
  onRecordA3Analysis: (index: number, analysis: A3AnalysisResult) => void
  onRecordWorkflowAnalysis: (index: number, analysis: WorkflowPrincipleAnalysisResult) => void
  onReferenceQueryChange: (value: string) => void
  onSearchReferences: () => void
  onToggleLockSentence: (index: number) => void
  onUnitizeSentence: (index: number) => void
}

export function SentenceCanvasPage({
  activeView,
  commodities,
  complianceReport,
  generatingTripleUnitNumbers,
  isAnalyzingCompliance,
  isLoadingReferenceDocuments,
  isSearchingReferences,
  unitizingIndexes,
  referenceQuery,
  referenceDocuments,
  referenceDocumentsError,
  referenceProvisionResults,
  referenceResults,
  referenceSearchError,
  units,
  selectedIndexes,
  lockedIndexes,
  unitAnalyses,
  unitPrincipleAnalyses,
  unitComplianceStatuses,
  unitTriples,
  onAddSentence,
  onClearSelection,
  onRemoveSelected,
  onRemoveSentence,
  onSelectAll,
  onSelectSentence,
  onSentenceChange,
  onApplyA2Correction,
  onApplyA3Correction,
  onApplyWorkflowCorrection,
  onAnalyzeSentence,
  onApproveSentence,
  onGenerateTriplesSentence,
  onOpenReferencesForSentence,
  onOpenRewriteForSentence,
  onKeepA2AsIs,
  onKeepA3AsIs,
  onKeepWorkflowAsIs,
  onRecordA2Analysis,
  onRecordA3Analysis,
  onRecordWorkflowAnalysis,
  onReferenceQueryChange,
  onSearchReferences,
  onToggleLockSentence,
  onUnitizeSentence,
}: SentenceCanvasPageProps) {
  const selectedCount = selectedIndexes.size
  const [selectedUnitAnalysis, setSelectedUnitAnalysis] = useState<UnitComplianceAnalysis | null>(null)
  const [a2UnitIndex, setA2UnitIndex] = useState<number | null>(null)
  const [a3UnitIndex, setA3UnitIndex] = useState<number | null>(null)
  const [workflowDialog, setWorkflowDialog] = useState<{ index: number; principle: WorkflowPrincipleCode } | null>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const isEditingText = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT'

    if (event.key === 'Escape' && selectedCount > 0) {
      event.preventDefault()
      onClearSelection()
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedCount > 0 && !isEditingText) {
      event.preventDefault()
      onRemoveSelected()
    }
  }

  return (
    <Box
      onKeyDown={activeView === 'units' ? handleKeyDown : undefined}
      sx={{
        height: 'calc(100vh - 58px)',
        overflowY: 'auto',
        px: { xs: 2, md: 5 },
        pb: 12,
        pt: { xs: 3, md: 5 },
      }}
      tabIndex={0}
    >
      {activeView === 'units' ? (
        <Stack alignItems="center" spacing={3}>
          {units.map((unit, index) => (
            <SentenceContainer
              index={index}
              isLocked={lockedIndexes.has(index)}
              isSelected={selectedIndexes.has(index)}
              key={unit.id}
              complianceStatus={unitComplianceStatuses[index] ?? null}
              isGeneratingTriples={generatingTripleUnitNumbers.includes(index + 1)}
              isUnitizationBusy={unitizingIndexes.size > 0}
              isUnitizing={unitizingIndexes.has(index)}
              originalText={unit.originalText}
              triples={unitTriples.find((unitTriple) => unitTriple.unit === index + 1)?.triples}
              unitAnalysis={unitAnalyses.find((unitAnalysis) => unitAnalysis.unit === index + 1)}
              principleAnalyses={unitPrincipleAnalyses.filter((analysis) => analysis.unit === index + 1)}
              onChange={onSentenceChange}
              onAnalyzeA2={setA2UnitIndex}
              onAnalyzeA3={setA3UnitIndex}
              onAnalyzeWorkflow={(index, principle) => setWorkflowDialog({ index, principle })}
              onAnalyze={onAnalyzeSentence}
              onApprove={onApproveSentence}
              onGenerateTriples={onGenerateTriplesSentence}
              onOpenUnitAnalysis={setSelectedUnitAnalysis}
              onOpenReferences={onOpenReferencesForSentence}
              onOpenRewrite={onOpenRewriteForSentence}
              onRemove={onRemoveSentence}
              onSelect={onSelectSentence}
              onToggleLock={onToggleLockSentence}
              onUnitize={onUnitizeSentence}
              unit={unit}
            />
          ))}
          <Tooltip title="Add sentence">
            <IconButton
            aria-label="Add sentence"
              onClick={onAddSentence}
              sx={{
                bgcolor: '#e6eaf2',
                borderRadius: 1.5,
                height: 52,
                mb: 4,
                width: 92,
                '&:hover': {
                  bgcolor: '#dbe1ec',
                },
              }}
            >
              <AddOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : activeView === 'compliance' ? (
        <ComplianceReportPanel
          isLoading={isAnalyzingCompliance}
          report={complianceReport}
          unitAnalyses={unitAnalyses}
        />
      ) : (
        <ReferencesPanel
          commodities={commodities}
          documents={referenceDocuments}
          documentsError={referenceDocumentsError}
          error={referenceSearchError}
          isLoadingDocuments={isLoadingReferenceDocuments}
          isSearching={isSearchingReferences}
          onQueryChange={onReferenceQueryChange}
          onSearch={onSearchReferences}
          query={referenceQuery}
          provisionResults={referenceProvisionResults}
          results={referenceResults}
        />
      )}
      <CanvasFooter
        commodities={commodities}
        onClearSelection={onClearSelection}
        onRemoveSelected={onRemoveSelected}
        onSelectAll={onSelectAll}
        selectedCount={selectedCount}
        totalCount={units.length}
      />
      <UnitAnalysisDialog
        onClose={() => setSelectedUnitAnalysis(null)}
        unitAnalysis={selectedUnitAnalysis}
      />
      <A2AnalysisDialog
        onApply={(candidate, validation) => {
          if (a2UnitIndex === null) return
          onApplyA2Correction(a2UnitIndex, candidate, validation)
          setA2UnitIndex(null)
        }}
        onClose={() => setA2UnitIndex(null)}
        onKeep={(reason, status) => {
          if (a2UnitIndex === null) return
          onKeepA2AsIs(a2UnitIndex, reason, status)
          setA2UnitIndex(null)
        }}
        onRecordAnalysis={(analysis) => {
          if (a2UnitIndex !== null) onRecordA2Analysis(a2UnitIndex, analysis)
        }}
        open={a2UnitIndex !== null}
        unit={a2UnitIndex !== null ? units[a2UnitIndex] : undefined}
      />
      <A3AnalysisDialog
        onApply={(candidate, validation, templateId) => {
          if (a3UnitIndex === null) return
          onApplyA3Correction(a3UnitIndex, candidate, validation, templateId)
          setA3UnitIndex(null)
        }}
        onClose={() => setA3UnitIndex(null)}
        onKeep={(status, modality, communicativeFunction, templateId) => {
          if (a3UnitIndex === null) return
          onKeepA3AsIs(a3UnitIndex, status, modality, communicativeFunction, templateId)
          setA3UnitIndex(null)
        }}
        onRecordAnalysis={(analysis) => {
          if (a3UnitIndex !== null) onRecordA3Analysis(a3UnitIndex, analysis)
        }}
        open={a3UnitIndex !== null}
        unit={a3UnitIndex !== null ? units[a3UnitIndex] : undefined}
      />
      <WorkflowPrincipleDialog
        onApply={(candidates, validation) => {
          if (!workflowDialog) return
          onApplyWorkflowCorrection(workflowDialog.index, workflowDialog.principle, candidates, validation)
          setWorkflowDialog(null)
        }}
        onClose={() => setWorkflowDialog(null)}
        onKeep={(status) => {
          if (!workflowDialog) return
          onKeepWorkflowAsIs(workflowDialog.index, workflowDialog.principle, status)
          setWorkflowDialog(null)
        }}
        onRecordAnalysis={(analysis) => {
          if (workflowDialog) onRecordWorkflowAnalysis(workflowDialog.index, analysis)
        }}
        open={workflowDialog !== null}
        principle={workflowDialog?.principle ?? 'B1'}
        protectedPrinciples={workflowDialog ? getProtectedPrinciples(
          units[workflowDialog.index],
          unitPrincipleAnalyses.filter((item) => item.unit === workflowDialog.index + 1),
          workflowDialog.principle,
        ) : []}
        unit={workflowDialog ? units[workflowDialog.index] : undefined}
      />
    </Box>
  )
}

type ComplianceReportPanelProps = {
  isLoading: boolean
  report: ComplianceReport | null
  unitAnalyses: UnitComplianceAnalysis[]
}

type ReferencesPanelProps = {
  commodities: string[]
  documents: ReferenceDocument[]
  documentsError: string
  error: string
  isLoadingDocuments: boolean
  isSearching: boolean
  onQueryChange: (value: string) => void
  onSearch: () => void
  provisionResults: ProvisionReference[]
  query: string
  results: AttestationSectionReference[]
}

function ReferencesPanel({
  commodities,
  documents,
  documentsError,
  error,
  isLoadingDocuments,
  isSearching,
  onQueryChange,
  onSearch,
  provisionResults,
  query,
  results,
}: ReferencesPanelProps) {
  const canSearch = query.trim().length > 0 && commodities.length > 0 && !isSearching
  const hasResults = results.length > 0 || provisionResults.length > 0
  const [selectedSection, setSelectedSection] = useState<AttestationSectionReference | null>(null)
  const [isDocumentsPanelCollapsed, setIsDocumentsPanelCollapsed] = useState(false)

  useEffect(() => {
    if (results[0]) {
      setSelectedSection(results[0])
    }
  }, [results])

  return (
    <Box
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid #dde3ee',
        boxShadow: '0 12px 30px rgba(33, 42, 66, 0.06)',
        mx: 'auto',
        overflow: 'hidden',
        width: 'min(100%, 1220px)',
      }}
    >
      <Stack
        alignItems={{ xs: 'stretch', md: 'center' }}
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ borderBottom: '1px solid #e5eaf2', p: 3 }}
      >
        <Box>
          <Typography component="h2" sx={{ fontSize: 22, fontWeight: 900 }}>
            References
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Search the documents connected to the selected commodities.
          </Typography>
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          {commodities.length === 0 ? (
            <Chip label="No commodities selected" size="small" sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', fontWeight: 800 }} />
          ) : commodities.map((commodity) => (
            <Chip
              key={commodity}
              label={commodity}
              size="small"
              sx={{ bgcolor: '#eef2f8', border: '1px solid #d9e1ef', fontWeight: 800 }}
              variant="outlined"
            />
          ))}
        </Stack>
      </Stack>

      <Box sx={{ p: 3 }}>
        <Stack
          component="form"
          direction={{ xs: 'column', md: 'row' }}
          onSubmit={(event) => {
            event.preventDefault()
            if (canSearch) {
              onSearch()
            }
          }}
          spacing={1.25}
        >
          <TextField
            fullWidth
            label="Search reference sections"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="e.g. inspection, certification, maximum residue limits"
            size="small"
            value={query}
          />
          <Button
            disabled={!canSearch}
            startIcon={isSearching ? <CircularProgress color="inherit" size={16} /> : <SearchOutlinedIcon />}
            type="submit"
            variant="contained"
            sx={{ minWidth: 132 }}
          >
            Search
          </Button>
        </Stack>

        {error && (
          <Box sx={{ bgcolor: '#fff1f3', border: '1px solid #fecdd6', color: '#b42318', fontSize: 13, fontWeight: 700, mt: 2, p: 1.5 }}>
            {error}
          </Box>
        )}

        {!error && commodities.length === 0 && (
          <EmptyReferenceState text="Select at least one commodity to limit searches to the relevant document set." />
        )}

        {commodities.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                xl: isDocumentsPanelCollapsed ? 'minmax(0, 1fr) 54px' : 'minmax(0, 1fr) 340px',
              },
              mt: 2.5,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', lg: hasResults ? 'minmax(280px, 0.38fr) minmax(0, 0.62fr)' : '1fr' },
                minWidth: 0,
              }}
            >
              <Stack spacing={1.25}>
                {results.length > 0 && (
                  <Box>
                    <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900, mb: 1 }}>
                      Sections ({results.length})
                    </Typography>
                    <Stack spacing={1.25}>
                      {results.map((section, index) => {
                        const isSelected = selectedSection === section

                        return (
                          <ReferenceResultCard
                            isSelected={isSelected}
                            key={`${section.doc_id ?? 'doc'}-${section.section_id ?? index}-${index}`}
                            onSelect={() => setSelectedSection(section)}
                            rank={index + 1}
                            section={section}
                          />
                        )
                      })}
                    </Stack>
                  </Box>
                )}

                {provisionResults.length > 0 && (
                  <Box>
                    <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900, mb: 1, mt: results.length > 0 ? 1 : 0 }}>
                      Provisions ({provisionResults.length})
                    </Typography>
                    <Stack spacing={1.25}>
                      {provisionResults.map((provision, index) => (
                        <ReferenceProvisionCard
                          key={`${provision.id ?? 'provision'}-${index}`}
                          provision={provision}
                          rank={index + 1}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                {!error && !isSearching && query.trim() && !hasResults && (
                  <EmptyReferenceState text="No related sections or provisions were found for this search." />
                )}

                {!error && !query.trim() && !hasResults && (
                  <EmptyReferenceState text="Enter a term or sentence to find the most related sections and provisions." />
                )}
              </Stack>

              <ReferenceDocumentViewer section={selectedSection} />
            </Box>

            <ReferenceDocumentsSidebar
              documents={documents}
              error={documentsError}
              isCollapsed={isDocumentsPanelCollapsed}
              isLoading={isLoadingDocuments}
              onSelectDocument={(document) => setSelectedSection(referenceSectionFromDocument(document))}
              onToggleCollapsed={() => setIsDocumentsPanelCollapsed((current) => !current)}
              selectedSection={selectedSection}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

function ReferenceDocumentsSidebar({
  documents,
  error,
  isCollapsed,
  isLoading,
  onSelectDocument,
  onToggleCollapsed,
  selectedSection,
}: {
  documents: ReferenceDocument[]
  error: string
  isCollapsed: boolean
  isLoading: boolean
  onSelectDocument: (document: ReferenceDocument) => void
  onToggleCollapsed: () => void
  selectedSection: AttestationSectionReference | null
}) {
  if (isCollapsed) {
    return (
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: '#ffffff',
          border: '1px solid #dfe6f2',
          display: { xs: 'none', xl: 'flex' },
          flexDirection: 'column',
          gap: 1,
          minHeight: 620,
          py: 1,
        }}
      >
        <Tooltip title="Expand documents">
          <IconButton aria-label="Expand available documents" onClick={onToggleCollapsed} size="small">
            <ChevronLeftOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Chip
          label={documents.length}
          size="small"
          sx={{ bgcolor: '#eef2f8', border: '1px solid #d9e1ef', fontWeight: 900 }}
          variant="outlined"
        />
        <Typography
          sx={{
            color: '#5f6675',
            fontSize: 11,
            fontWeight: 900,
            mt: 1,
            textOrientation: 'mixed',
            writingMode: 'vertical-rl',
          }}
        >
          Documents
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      component="aside"
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid #dfe6f2',
        maxHeight: { xs: 'none', xl: 'calc(100vh - 230px)' },
        minHeight: { xs: 0, xl: 620 },
        overflowY: 'auto',
        position: { xs: 'static', xl: 'sticky' },
        top: 86,
      }}
    >
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        spacing={1}
        sx={{
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e5eaf2',
          p: 1.5,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <Box>
          <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900 }}>
            Available documents
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11, mt: 0.25 }}>
            {documents.length} document{documents.length === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Stack alignItems="center" direction="row" spacing={0.5}>
          {isLoading && <CircularProgress size={14} />}
          <Tooltip title="Collapse documents">
            <IconButton aria-label="Collapse available documents" onClick={onToggleCollapsed} size="small">
              <ChevronRightOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box sx={{ p: 1.25 }}>
        <ReferenceDocumentsList
          documents={documents}
          error={error}
          isLoading={isLoading}
          onSelectDocument={onSelectDocument}
          selectedSection={selectedSection}
        />
      </Box>
    </Box>
  )
}

function ReferenceDocumentsList({
  documents,
  error,
  isLoading,
  onSelectDocument,
  selectedSection,
}: {
  documents: ReferenceDocument[]
  error: string
  isLoading: boolean
  onSelectDocument: (document: ReferenceDocument) => void
  selectedSection: AttestationSectionReference | null
}) {
  return (
    <Box>
      {error && (
        <Box sx={{ bgcolor: '#fff1f3', border: '1px solid #fecdd6', color: '#b42318', fontSize: 12, fontWeight: 700, p: 1.25 }}>
          {error}
        </Box>
      )}

      {!error && !isLoading && documents.length === 0 && (
        <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', color: '#64748b', fontSize: 13, lineHeight: 1.45, p: 1.5 }}>
          No documents are available for the selected commodities.
        </Box>
      )}

      {documents.length > 0 && (
        <Stack spacing={0.75}>
          {documents.map((document) => {
            const isSelected = Boolean(document.doc_id && document.doc_id === selectedSection?.doc_id && !selectedSection?.section_id)

            return (
              <Box
                component="button"
                key={document.doc_id || document.label || document.title}
                onClick={() => onSelectDocument(document)}
                type="button"
                sx={{
                  bgcolor: isSelected ? '#f1f5ff' : '#ffffff',
                  border: '1px solid',
                  borderColor: isSelected ? '#b9c4ff' : '#dfe6f2',
                  color: 'inherit',
                  font: 'inherit',
                  p: 1.25,
                  textAlign: 'left',
                  width: '100%',
                  '&:hover': {
                    borderColor: '#b9c4ff',
                    cursor: 'pointer',
                  },
                }}
              >
                <Typography sx={{ color: '#2457c5', fontSize: 12, fontWeight: 900 }}>
                  {document.reference || 'Reference'} · {document.year || 'year n/a'}
                </Typography>
                <Typography sx={{ color: '#172033', fontSize: 13, fontWeight: 850, lineHeight: 1.35, mt: 0.35 }}>
                  {document.title || document.label || 'Untitled document'}
                </Typography>
                {Array.isArray(document.commodities) && document.commodities.length > 0 && (
                  <Typography sx={{ color: '#64748b', fontSize: 11, lineHeight: 1.35, mt: 0.5 }}>
                    {document.commodities.slice(0, 4).join(', ')}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

function EmptyReferenceState({ text }: { text: string }) {
  return (
    <Box
      sx={{
        bgcolor: '#f8fafc',
        border: '1px solid #e5eaf2',
        color: '#64748b',
        fontSize: 14,
        lineHeight: 1.5,
        mt: 2,
        p: 2,
      }}
    >
      {text}
    </Box>
  )
}

function ReferenceResultCard({
  isSelected,
  onSelect,
  rank,
  section,
}: {
  isSelected: boolean
  onSelect: () => void
  rank: number
  section: AttestationSectionReference
}) {
  const document = section.document
  const href = referencePdfHref(section)
  const documentTitle = referenceDocumentTitle(document)

  return (
    <Box
      component="button"
      onClick={onSelect}
      type="button"
      sx={{
        bgcolor: isSelected ? '#f1f5ff' : '#ffffff',
        border: '1px solid',
        borderColor: isSelected ? '#b9c4ff' : '#dfe6f2',
        color: 'inherit',
        display: 'block',
        font: 'inherit',
        p: 2,
        textAlign: 'left',
        transition: 'border-color 140ms ease, box-shadow 140ms ease',
        width: '100%',
        '&:hover': {
          borderColor: '#b9c4ff',
          boxShadow: '0 10px 22px rgba(33, 42, 66, 0.08)',
          cursor: 'pointer',
        },
      }}
    >
      <Stack alignItems="flex-start" direction="row" spacing={1.5}>
        <Box
          sx={{
            alignItems: 'center',
            bgcolor: '#eef2f8',
            border: '1px solid #d9e1ef',
            color: '#172033',
            display: 'flex',
            fontSize: 12,
            fontWeight: 900,
            height: 28,
            justifyContent: 'center',
            minWidth: 28,
          }}
        >
          {rank}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack alignItems="center" direction="row" flexWrap="wrap" gap={0.75}>
            <Typography sx={{ color: '#2457c5', fontSize: 12, fontWeight: 900 }}>
              {document?.reference || 'Reference'}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>
              {document?.year || 'year n/a'}
            </Typography>
            <Chip
              label={formatReferencePageRange(section)}
              size="small"
              sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', color: '#475569', fontSize: 11, fontWeight: 800, height: 22 }}
              variant="outlined"
            />
          </Stack>
          <Typography sx={{ color: '#172033', fontSize: 15, fontWeight: 900, lineHeight: 1.35, mt: 0.75 }}>
            {section.section || `Section ${section.section_id ?? rank}`}
          </Typography>
          <DocumentTitleLine title={documentTitle} />
          <Typography sx={{ color: '#64748b', fontSize: 12, lineHeight: 1.4, mt: 0.75 }}>
            {formatReferenceCategories(section.categories)}
          </Typography>
        </Box>
        {href && (
          <Tooltip title="View document here">
            <OpenInNewOutlinedIcon sx={{ color: '#64748b', fontSize: 19, mt: 0.25 }} />
          </Tooltip>
        )}
      </Stack>
    </Box>
  )
}

function ReferenceProvisionCard({
  provision,
  rank,
}: {
  provision: ProvisionReference
  rank: number
}) {
  const document = provision.document
  const href = provisionPdfHref(provision)
  const documentTitle = provisionDocumentTitle(provision)

  return (
    <Box
      sx={{
        bgcolor: '#fffdf7',
        border: '1px solid #eadfbd',
        p: 2,
        transition: 'border-color 140ms ease, box-shadow 140ms ease',
        '&:hover': {
          borderColor: '#d9c37c',
          boxShadow: '0 10px 22px rgba(83, 63, 19, 0.08)',
        },
      }}
    >
      <Stack alignItems="flex-start" direction="row" spacing={1.5}>
        <Box
          sx={{
            alignItems: 'center',
            bgcolor: '#fff7dc',
            border: '1px solid #eadfbd',
            color: '#6f4d00',
            display: 'flex',
            fontSize: 12,
            fontWeight: 900,
            height: 28,
            justifyContent: 'center',
            minWidth: 28,
          }}
        >
          {provision.rank ?? rank}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack alignItems="center" direction="row" flexWrap="wrap" gap={0.75}>
            <Typography sx={{ color: '#8a5a00', fontSize: 12, fontWeight: 900 }}>
              {document?.reference || provision.document_id || 'Provision'}
            </Typography>
            {provision.relevance !== null && provision.relevance !== undefined && (
              <Chip
                label={`${provision.relevance}% relevance`}
                size="small"
                sx={{ bgcolor: '#ffffff', border: '1px solid #eadfbd', color: '#6f4d00', fontSize: 11, fontWeight: 800, height: 22 }}
                variant="outlined"
              />
            )}
            <Chip
              label={formatProvisionPageRange(provision)}
              size="small"
              sx={{ bgcolor: '#ffffff', border: '1px solid #eadfbd', color: '#6f4d00', fontSize: 11, fontWeight: 800, height: 22 }}
              variant="outlined"
            />
          </Stack>
          <DocumentTitleLine title={documentTitle} />
          <Typography sx={{ color: '#172033', fontSize: 14, fontWeight: 850, lineHeight: 1.45, mt: 0.75 }}>
            {provision.sentence || 'No provision text is available.'}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
            {[provision.category, provision.modality, provision.function, provision.type]
              .filter(Boolean)
              .map((value) => (
                <Chip
                  key={String(value)}
                  label={String(value)}
                  size="small"
                  sx={{ bgcolor: '#ffffff', border: '1px solid #eadfbd', color: '#6f4d00', fontSize: 11, fontWeight: 800, height: 22 }}
                  variant="outlined"
                />
              ))}
          </Stack>
          {provision.section_title && provision.section_title !== documentTitle && (
            <Typography sx={{ color: '#64748b', fontSize: 12, lineHeight: 1.4, mt: 0.75 }}>
              Section: {provision.section_title}
            </Typography>
          )}
        </Box>
        {href && (
          <Tooltip title="Open provision document">
            <IconButton
              aria-label="Open provision document"
              component="a"
              href={href}
              rel="noreferrer"
              size="small"
              target="_blank"
            >
              <OpenInNewOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  )
}

function DocumentTitleLine({ title }: { title: string }) {
  return (
    <Typography sx={{ color: '#334155', fontSize: 13, fontWeight: 750, lineHeight: 1.45, mt: 0.55 }}>
      <Box component="span" sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, mr: 0.6, textTransform: 'uppercase' }}>
        Document title
      </Box>
      {title}
    </Typography>
  )
}

function ReferenceDocumentViewer({ section }: { section: AttestationSectionReference | null }) {
  if (!section) {
    return (
      <Box
        sx={{
          bgcolor: '#f8fafc',
          border: '1px solid #e5eaf2',
          color: '#64748b',
          minHeight: 520,
          p: 2,
        }}
      >
        Select a section to preview its document.
      </Box>
    )
  }

  const href = referencePdfHref(section)
  const viewerSrc = referencePdfViewerSrc(section)
  const document = section.document

  return (
    <Box
      sx={{
        bgcolor: '#f8fafc',
        border: '1px solid #dfe6f2',
        minHeight: 620,
        overflow: 'hidden',
      }}
    >
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ bgcolor: '#ffffff', borderBottom: '1px solid #dfe6f2', p: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: '#2457c5', fontSize: 12, fontWeight: 900 }}>
            {document?.reference || 'Reference'} · {formatReferencePageRange(section)}
          </Typography>
          <Typography noWrap sx={{ color: '#172033', fontSize: 14, fontWeight: 900, mt: 0.25 }}>
            {section.section || document?.title || 'Selected section'}
          </Typography>
        </Box>
        {href && (
          <Tooltip title="Open externally">
            <IconButton
              aria-label="Open document externally"
              component="a"
              href={href}
              rel="noreferrer"
              size="small"
              target="_blank"
            >
              <OpenInNewOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {href ? (
        <Box
          component="iframe"
          key={viewerSrc}
          src={viewerSrc}
          title={document?.title || section.section || 'Reference document'}
          sx={{
            border: 0,
            display: 'block',
            height: { xs: 560, lg: 720 },
            width: '100%',
          }}
        />
      ) : (
        <Box sx={{ color: '#64748b', fontSize: 14, lineHeight: 1.5, p: 2 }}>
          This section does not include a document URL.
        </Box>
      )}
    </Box>
  )
}

function referenceSectionFromDocument(document: ReferenceDocument): AttestationSectionReference {
  return {
    doc_id: document.doc_id,
    document,
    section: document.title || document.label || document.reference || 'Document',
  }
}

function referenceDocumentTitle(document?: ReferenceDocument | null) {
  return document?.title || document?.label || document?.reference || 'Untitled document'
}

function provisionDocumentTitle(provision: ProvisionReference) {
  return provision.document?.title
    || provision.document?.label
    || provision.document_title
    || provision.doc_title
    || provision.title
    || provision.section_title
    || provision.document?.reference
    || provision.document_id
    || 'Untitled document'
}

function formatReferenceCategories(categories: AttestationSectionReference['categories']) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return 'Uncategorized'
  }

  return categories
    .map((category) => {
      if (typeof category === 'string') {
        return category
      }

      return [category.category, category.subcategory].filter(Boolean).join(' / ')
    })
    .filter(Boolean)
    .join(', ')
}

function formatReferencePageRange(section: AttestationSectionReference) {
  const startPage = referencePageNumber(section.start_page)
  const endPage = referencePageNumber(section.end_page)

  if (!startPage && !endPage) {
    return 'Pages not available'
  }

  if (startPage && endPage && startPage !== endPage) {
    return `Pages ${startPage}-${endPage}`
  }

  return `Page ${startPage || endPage}`
}

function formatProvisionPageRange(provision: ProvisionReference) {
  const startPage = referencePageNumber(provision.page_start)
  const endPage = referencePageNumber(provision.page_end)

  if (!startPage && !endPage) {
    return 'Pages not available'
  }

  if (startPage && endPage && startPage !== endPage) {
    return `Pages ${startPage}-${endPage}`
  }

  return `Page ${startPage || endPage}`
}

function referencePdfHref(section: AttestationSectionReference) {
  const page = referencePageNumber(section.start_page) || referencePageNumber(section.end_page)
  const docId = section.document?.doc_id || section.doc_id

  if (!docId) {
    return ''
  }

  const baseUrl = apiBaseUrl.replace(/\/$/, '')
  return `${baseUrl}/assets/files/${encodeURIComponent(docId)}.pdf${page ? `#page=${page}` : ''}`
}

function provisionPdfHref(provision: ProvisionReference) {
  const page = referencePageNumber(provision.page_start) || referencePageNumber(provision.page_end)
  const docId = provision.document?.doc_id || provision.document_id

  if (!docId) {
    return ''
  }

  const baseUrl = apiBaseUrl.replace(/\/$/, '')
  return `${baseUrl}/assets/files/${encodeURIComponent(docId)}.pdf${page ? `#page=${page}` : ''}`
}

function referencePdfViewerSrc(section: AttestationSectionReference) {
  const page = referencePageNumber(section.start_page) || referencePageNumber(section.end_page)
  const docId = section.document?.doc_id || section.doc_id

  if (!docId) {
    return ''
  }

  const baseUrl = apiBaseUrl.replace(/\/$/, '')
  const sectionId = section.section_id !== undefined ? String(section.section_id) : 'section'
  const cacheKey = encodeURIComponent(`${sectionId}:${page || 1}`)

  return `${baseUrl}/assets/files/${encodeURIComponent(docId)}.pdf?viewer=${cacheKey}${page ? `#page=${page}` : ''}`
}

function referencePageNumber(value: unknown) {
  const number = Number(value)

  if (!Number.isFinite(number) || number < 1) {
    return null
  }

  return Math.floor(number)
}

const statusColor = {
  Compliant: {
    bg: '#ecfdf3',
    border: '#abefc6',
    color: '#067647',
  },
  'Partially Compliant': {
    bg: '#fff7ed',
    border: '#fed7aa',
    color: '#c2410c',
  },
  'Non-Compliant': {
    bg: '#fff1f3',
    border: '#fecdd6',
    color: '#e11d48',
  },
} as const

const analyzingStatusColor = {
  bg: '#f1f5f9',
  border: '#cbd5e1',
  color: '#475569',
} as const

const unavailableStatusColor = {
  bg: '#f8fafc',
  border: '#e2e8f0',
  color: '#94a3b8',
} as const

function ComplianceReportPanel({ isLoading, report, unitAnalyses }: ComplianceReportPanelProps) {
  const [selectedUnitAnalysis, setSelectedUnitAnalysis] = useState<UnitComplianceAnalysis | null>(null)

  if (isLoading) {
    return (
      <Box
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #dde3ee',
          boxShadow: '0 12px 30px rgba(33, 42, 66, 0.06)',
          mb: 3,
          mx: 'auto',
          p: 3,
          width: 'min(100%, 1220px)',
        }}
      >
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Box>
            <Typography sx={{ fontWeight: 800 }}>Analyzing compliance</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              Each sentence is being evaluated and a consolidated report will appear here.
            </Typography>
          </Box>
        </Stack>
      </Box>
    )
  }

  if (!report) {
    return (
      <Box
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #dde3ee',
          boxShadow: '0 12px 30px rgba(33, 42, 66, 0.06)',
          mx: 'auto',
          p: 3,
          width: 'min(100%, 1220px)',
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
          Compliance report
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          No compliance report is available for this project yet.
        </Typography>
      </Box>
    )
  }

  const status = statusColor[report.overall_status]
  const synthesis = buildComplianceSynthesis(report)

  return (
    <>
      <Box
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #dde3ee',
          boxShadow: '0 12px 30px rgba(33, 42, 66, 0.06)',
          mb: 3,
          mx: 'auto',
          overflow: 'hidden',
          width: 'min(100%, 1220px)',
        }}
      >
        <Stack
          alignItems={{ xs: 'flex-start', md: 'center' }}
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          spacing={2}
          sx={{ borderBottom: '1px solid #e5eaf2', p: 3 }}
        >
          <Box>
            <Typography component="h2" sx={{ fontSize: 22, fontWeight: 900 }}>
              Compliance report
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Consolidated view across {report.summary.total_units} analyzed unit{report.summary.total_units !== 1 ? 's' : ''}.
            </Typography>
          </Box>
          <Chip
            label={report.overall_status}
            sx={{
              bgcolor: status.bg,
              border: `1px solid ${status.border}`,
              color: status.color,
              fontWeight: 800,
            }}
          />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
            p: 3,
          }}
        >
          <MetricCard label="Sentences" value={report.summary.total_units} />
          <MetricCard label="Compliant" tone="Compliant" value={report.summary.compliant_units} />
          <MetricCard label="Partial" tone="Partially Compliant" value={report.summary.partially_compliant_units} />
          <MetricCard label="Non-compliant" tone="Non-Compliant" value={report.summary.non_compliant_units} />
        </Box>

        <Box sx={{ borderTop: '1px solid #e5eaf2', px: 3, py: 2.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 900, mb: 0.75 }}>
            Synthesis
          </Typography>
          <Typography sx={{ color: '#334155', lineHeight: 1.55 }}>
            {synthesis}
          </Typography>
        </Box>

        {unitAnalyses.length > 0 && (
          <Box sx={{ borderTop: '1px solid #e5eaf2', px: 3, py: 2 }}>
            <Stack alignItems={{ xs: 'flex-start', md: 'center' }} direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
              <Typography sx={{ color: '#5f6675', fontSize: 13, fontWeight: 800 }}>
                Sentence analysis
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {unitAnalyses.map((unitAnalysis) => {
                  const unitStatus = getUnitAnalysisStatus(unitAnalysis.analysis)
                  const colors = statusColor[unitStatus]

                  return (
                    <Chip
                      key={unitAnalysis.unit}
                      label={`Sentence ${unitAnalysis.unit}`}
                      onClick={() => setSelectedUnitAnalysis(unitAnalysis)}
                      size="small"
                      sx={{
                        bgcolor: colors.bg,
                        border: `1px solid ${colors.border}`,
                        color: colors.color,
                        cursor: 'pointer',
                        fontWeight: 800,
                      }}
                    />
                  )
                })}
              </Stack>
            </Stack>
          </Box>
        )}

        <Box sx={{ overflowX: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '96px minmax(220px, 1fr) 180px minmax(320px, 1.4fr)',
              minWidth: 900,
            }}
          >
            {['Code', 'Principle', 'Status', 'Problem summary'].map((header) => (
              <Box
                key={header}
                sx={{
                  bgcolor: '#f8fafc',
                  borderTop: '1px solid #e5eaf2',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 900,
                  px: 2,
                  py: 1.5,
                }}
              >
                {header}
              </Box>
            ))}
            {report.rows.map((row) => (
              <ComplianceReportTableRow key={row.code} row={row} />
            ))}
          </Box>
        </Box>
      </Box>
      <UnitAnalysisDialog
        onClose={() => setSelectedUnitAnalysis(null)}
        unitAnalysis={selectedUnitAnalysis}
      />
    </>
  )
}

function buildComplianceSynthesis(report: ComplianceReport) {
  const { compliant_units, non_compliant_units, partially_compliant_units, total_units } = report.summary
  const issueRows = report.rows.filter((row) => row.status !== 'Compliant')
  const primaryIssue = issueRows[0]
  const affectedUnits = [...new Set(issueRows.flatMap((row) => row.affected_units))].sort((a, b) => a - b)

  if (report.overall_status === 'Compliant') {
    return `All ${total_units} analyzed unit${totalUnitsSuffix(total_units)} meet the compliance principles with no material issues detected in the consolidated assessment.`
  }

  const distribution = `${non_compliant_units} non-compliant, ${partially_compliant_units} partially compliant, and ${compliant_units} compliant unit${totalUnitsSuffix(total_units)}`
  const affected = affectedUnits.length > 0
    ? ` The affected units are ${affectedUnits.join(', ')}.`
    : ''
  const issue = primaryIssue
    ? ` The most significant finding is ${primaryIssue.code} (${primaryIssue.principle}): ${primaryIssue.problem_summary}`
    : ''

  return `The overall result is ${report.overall_status}: ${distribution}.${affected}${issue}`
}

function totalUnitsSuffix(total: number) {
  return total === 1 ? '' : 's'
}

function UnitAnalysisDialog({
  onClose,
  unitAnalysis,
}: {
  onClose: () => void
  unitAnalysis: UnitComplianceAnalysis | null
}) {
  if (!unitAnalysis) {
    return null
  }

  const overall = getUnitAnalysisOverall(unitAnalysis.analysis)
  const assessments = getUnitPrincipleAssessments(unitAnalysis.analysis)
  const status = getUnitAnalysisStatus(unitAnalysis.analysis)
  const colors = statusColor[status]

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
              Sentence {unitAnalysis.unit} analysis
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Individual compliance assessment
            </Typography>
          </Box>
          <Chip
            label={status}
            sx={{
              bgcolor: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.color,
              fontWeight: 800,
            }}
          />
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', mb: 2, p: 2 }}>
          <Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 800, mb: 0.75 }}>
              Sentence text
          </Typography>
          <Typography sx={{ lineHeight: 1.55 }}>
            {unitAnalysis.text}
          </Typography>
        </Box>

        {overall.summary && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 0.5 }}>
              Summary
            </Typography>
            <Typography sx={{ color: '#334155', lineHeight: 1.55 }}>
              {overall.summary}
            </Typography>
          </Box>
        )}

        <Stack spacing={1}>
          {assessments.map((assessment, index) => {
            const assessmentStatus = normalizeComplianceStatus(assessment.compliance)
            const assessmentColors = statusColor[assessmentStatus]

            return (
              <Box
                key={`${assessment.principle}-${index}`}
                sx={{
                  border: '1px solid #e5eaf2',
                  p: 1.5,
                }}
              >
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1.5}>
                  <Typography sx={{ fontWeight: 900 }}>
                    {assessment.principle} {assessment.principle_name ? `- ${assessment.principle_name}` : ''}
                  </Typography>
                  <Chip
                    label={assessmentStatus}
                    size="small"
                    sx={{
                      bgcolor: assessmentColors.bg,
                      border: `1px solid ${assessmentColors.border}`,
                      color: assessmentColors.color,
                      fontWeight: 800,
                    }}
                  />
                </Stack>
                <Typography sx={{ color: '#334155', lineHeight: 1.5, mt: 1 }}>
                  {assessment.issue_identified || assessment.explanation || 'No material issue detected.'}
                </Typography>
              </Box>
            )
          })}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

type UnitOverall = {
  communicative_function?: string
  compliance?: string
  modality?: string
  summary?: string
}

type UnitPrincipleAssessment = {
  compliance?: string
  explanation?: string
  issue_identified?: string
  principle?: string
  principle_name?: string
}

function getUnitAnalysisResults(analysis: unknown) {
  if (!isRecord(analysis)) {
    return {}
  }

  const output = isRecord(analysis.output) ? analysis.output : undefined
  const outputResults = output && isRecord(output.results) ? output.results : undefined
  const directResults = isRecord(analysis.results) ? analysis.results : undefined

  return outputResults ?? directResults ?? analysis
}

function getUnitAnalysisOverall(analysis: unknown): UnitOverall {
  const results = getUnitAnalysisResults(analysis)
  const overall = isRecord(results.overall_assessment) ? results.overall_assessment : {}

  return {
    communicative_function: typeof results.communicative_function === 'string' ? results.communicative_function : undefined,
    compliance: typeof overall.compliance === 'string' ? overall.compliance : undefined,
    modality: typeof results.modality === 'string' ? results.modality : undefined,
    summary: typeof overall.summary === 'string' ? overall.summary : undefined,
  }
}

function getUnitAttestationMetadata(analysis: unknown) {
  const overall = getUnitAnalysisOverall(analysis)
  return {
    communicativeFunction: overall.communicative_function || 'Uncertain',
    modality: overall.modality || 'Uncertain',
  }
}

// Shared with AppShell to keep compliance-status normalization identical in the card and editor state.
// eslint-disable-next-line react-refresh/only-export-components
export function getUnitAnalysisStatus(analysis: unknown): ComplianceStatus {
  return normalizeComplianceStatus(getUnitAnalysisOverall(analysis).compliance)
}

function getUnitPrincipleAssessments(analysis: unknown): UnitPrincipleAssessment[] {
  const results = getUnitAnalysisResults(analysis)

  if (!Array.isArray(results.principle_assessments)) {
    return []
  }

  return results.principle_assessments.map((assessment) => {
    if (!isRecord(assessment)) {
      return {}
    }

    return {
      compliance: typeof assessment.compliance === 'string' ? assessment.compliance : undefined,
      explanation: typeof assessment.explanation === 'string' ? assessment.explanation : undefined,
      issue_identified: typeof assessment.issue_identified === 'string' ? assessment.issue_identified : undefined,
      principle: typeof assessment.principle === 'string' ? assessment.principle : undefined,
      principle_name: typeof assessment.principle_name === 'string' ? assessment.principle_name : undefined,
    }
  })
}

function normalizeComplianceStatus(status: unknown): ComplianceStatus {
  if (status === 'Non-Compliant' || status === 'Partially Compliant' || status === 'Compliant') {
    return status
  }

  return 'Compliant'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type MetricCardProps = {
  label: string
  value: number
  tone?: keyof typeof statusColor
}

function MetricCard({ label, value, tone }: MetricCardProps) {
  const colors = tone ? statusColor[tone] : undefined

  return (
    <Box
      sx={{
        bgcolor: colors?.bg ?? '#f8fafc',
        border: '1px solid',
        borderColor: colors?.border ?? '#e5eaf2',
        p: 2,
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 800 }}>
        {label}
      </Typography>
      <Typography sx={{ color: colors?.color ?? '#172033', fontSize: 26, fontWeight: 900 }}>
        {value}
      </Typography>
    </Box>
  )
}

function ComplianceReportTableRow({ row }: { row: ComplianceReportRow }) {
  const colors = statusColor[row.status]
  const StatusIcon = row.status === 'Non-Compliant' ? ErrorOutlineOutlinedIcon : ReportProblemOutlinedIcon

  return (
    <>
      <Box sx={{ alignItems: 'center', borderTop: '1px solid #e5eaf2', display: 'flex', gap: 1, px: 2, py: 1.75 }}>
        <StatusIcon sx={{ color: colors.color, fontSize: 18 }} />
        <Typography sx={{ fontWeight: 900 }}>{row.code}</Typography>
      </Box>
      <Box sx={{ borderTop: '1px solid #e5eaf2', px: 2, py: 1.75 }}>
        <Typography sx={{ fontWeight: 800 }}>{row.principle}</Typography>
        {row.affected_units.length > 0 && (
          <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.25 }}>
            Affected sentences: {row.affected_units.join(', ')}
          </Typography>
        )}
      </Box>
      <Box sx={{ alignItems: 'center', borderTop: '1px solid #e5eaf2', display: 'flex', px: 2, py: 1.75 }}>
        <Chip
          label={row.status}
          size="small"
          sx={{
            bgcolor: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.color,
            fontWeight: 800,
          }}
        />
      </Box>
      <Box sx={{ borderTop: '1px solid #e5eaf2', px: 2, py: 1.75 }}>
        <Typography sx={{ lineHeight: 1.45 }}>{row.problem_summary}</Typography>
      </Box>
    </>
  )
}

type CanvasFooterProps = {
  commodities: string[]
  selectedCount: number
  totalCount: number
  onClearSelection: () => void
  onRemoveSelected: () => void
  onSelectAll: () => void
}

function CanvasFooter({
  commodities,
  selectedCount,
  totalCount,
  onClearSelection,
  onRemoveSelected,
  onSelectAll,
}: CanvasFooterProps) {
  const hasSelection = selectedCount > 0

  return (
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: '#f4f6fa',
        borderTop: '1px solid #dfe4ee',
        bottom: 0,
        display: 'flex',
        gap: 2,
        justifyContent: 'space-between',
        left: 0,
        minHeight: 58,
        px: { xs: 1.5, md: 3 },
        position: 'fixed',
        right: 0,
        zIndex: 3,
      }}
    >
      <Stack
        alignItems="center"
        direction="row"
        spacing={1}
        sx={{
          color: '#5f6675',
          minWidth: 0,
          overflow: 'hidden',
          width: { xs: 160, md: 360 },
        }}
      >
        <Stack alignItems="center" direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <CategoryOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
            Commodities
          </Typography>
        </Stack>
        {commodities.length === 0 ? (
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            None
          </Typography>
        ) : (
          <Stack direction="row" spacing={0.75} sx={{ minWidth: 0, overflow: 'hidden' }}>
            {commodities.slice(0, 3).map((commodity) => (
              <Chip
                key={commodity}
                label={commodity}
                size="small"
                sx={{
                  bgcolor: '#e7ebf3',
                  maxWidth: 140,
                }}
              />
            ))}
            {commodities.length > 3 && (
              <Chip
                label={`+${commodities.length - 3}`}
                size="small"
                sx={{ bgcolor: '#e7ebf3' }}
              />
            )}
          </Stack>
        )}
      </Stack>

      <Stack
        alignItems="center"
        direction="row"
        spacing={0.75}
        sx={{
          bgcolor: hasSelection ? '#172033' : 'transparent',
          border: '1px solid',
          borderColor: hasSelection ? '#172033' : 'transparent',
          borderRadius: 10,
          boxShadow: hasSelection ? '0 12px 30px rgba(23, 32, 51, 0.22)' : 'none',
          color: hasSelection ? '#ffffff' : '#5f6675',
          minHeight: 38,
          opacity: hasSelection ? 1 : 0,
          px: hasSelection ? 2 : 0,
          pointerEvents: hasSelection ? 'auto' : 'none',
          transform: hasSelection ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 140ms ease, transform 140ms ease',
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, minWidth: 92, textAlign: 'center' }}>
          {`${selectedCount} selected`}
        </Typography>
        <Button
          color="inherit"
          onClick={onSelectAll}
          size="small"
          startIcon={<DoneAllOutlinedIcon fontSize="small" />}
          sx={{ px: 1 }}
        >
          Select all
        </Button>
        {hasSelection && (
          <>
            <Button
              color="inherit"
              onClick={onRemoveSelected}
              size="small"
              startIcon={<DeleteOutlineOutlinedIcon fontSize="small" />}
              sx={{ px: 1 }}
            >
              Remove
            </Button>
            <Tooltip title="Clear selection">
              <IconButton
                aria-label="Clear selection"
                color="inherit"
                onClick={onClearSelection}
                size="small"
              >
                <CloseOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      <Stack alignItems="center" direction="row" spacing={1.5} sx={{ color: '#5f6675' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
          {totalCount} unit{totalCount !== 1 ? 's' : ''}
        </Typography>
        <IconButton aria-label="Help" color="inherit" size="small">
          <HelpOutlineOutlinedIcon />
        </IconButton>
      </Stack>
    </Box>
  )
}

type A2AnalysisDialogProps = {
  onApply: (candidate: string, validation: A2ValidationResult) => void
  onClose: () => void
  onKeep: (reason: string, status: ComplianceStatus) => void
  onRecordAnalysis: (analysis: A2AnalysisResult) => void
  open: boolean
  unit?: AttestationUnit
}

function A2AnalysisDialog({ onApply, onClose, onKeep, onRecordAnalysis, open, unit }: A2AnalysisDialogProps) {
  const [analysis, setAnalysis] = useState<A2AnalysisResult | null>(null)
  const [candidate, setCandidate] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isKeepCurrentOpen, setIsKeepCurrentOpen] = useState(false)
  const [validation, setValidation] = useState<A2ValidationResult | null>(null)
  const onRecordAnalysisRef = useRef(onRecordAnalysis)

  useEffect(() => {
    onRecordAnalysisRef.current = onRecordAnalysis
  }, [onRecordAnalysis])

  useEffect(() => {
    let isCurrent = true
    setAnalysis(null)
    setCandidate('')
    setError('')
    setIsKeepCurrentOpen(false)
    setValidation(null)

    if (!open || !unit?.text.trim()) return () => { isCurrent = false }

    setIsLoading(true)
    void analyzeA2KeyElements(unit.text)
      .then((result) => {
        if (!isCurrent) return
        setAnalysis(result)
        setCandidate(result.suggestions[0]?.text ?? '')
        onRecordAnalysisRef.current(result)
      })
      .catch((reason: unknown) => {
        if (isCurrent) setError(reason instanceof Error ? reason.message : 'Could not analyze A2.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => { isCurrent = false }
  }, [open, unit?.id, unit?.text])

  const validateCandidate = async () => {
    if (!unit || !candidate.trim() || candidate.trim() === unit.text.trim()) return
    setIsValidating(true)
    setError('')
    setValidation(null)
    try {
      setValidation(await validateA2Correction(unit.text, candidate.trim()))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not validate the correction.')
    } finally {
      setIsValidating(false)
    }
  }

  const elementGroups = analysis
    ? Object.entries(analysis.identified_elements).filter(([, values]) => Array.isArray(values) && values.length > 0)
    : []

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>Analyse Key Attestation Elements · A2</DialogTitle>
      <DialogContent>
        {isLoading && (
          <Stack alignItems="center" direction="row" spacing={1.25} sx={{ py: 4 }}>
            <CircularProgress size={22} />
            <Typography>Identifying the key elements and safe correction options…</Typography>
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {analysis && (
          <Stack spacing={2.25}>
            <Alert severity={analysis.status === 'Compliant' ? 'success' : analysis.status === 'Non-Compliant' ? 'error' : 'warning'}>
              <Typography sx={{ fontWeight: 900 }}>{analysis.status}</Typography>
              <Typography sx={{ mt: 0.25 }}>
                {analysis.assessment.issue_identified || analysis.assessment.explanation || analysis.guidance}
              </Typography>
            </Alert>

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 1 }}>Identified elements</Typography>
              {elementGroups.length === 0 ? (
                <Typography color="text.secondary">No explicit key elements were identified.</Typography>
              ) : (
                <Stack spacing={1}>
                  {elementGroups.map(([key, values]) => (
                    <Stack alignItems="flex-start" direction={{ xs: 'column', sm: 'row' }} key={key} spacing={1}>
                      <Typography sx={{ fontSize: 12, fontWeight: 900, minWidth: 150, textTransform: 'capitalize' }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {(values as string[]).map((value) => <Chip key={`${key}-${value}`} label={value} size="small" />)}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>

            {analysis.missing_information.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 0.75 }}>Missing or unclear information</Typography>
                {analysis.missing_information.map((item) => (
                  <Typography key={item} sx={{ color: '#9a3412', fontSize: 13, mb: 0.4 }}>• {item}</Typography>
                ))}
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 1 }}>Suggested corrections</Typography>
              {analysis.suggestions.length === 0 ? (
                <Alert severity="info">{analysis.guidance}</Alert>
              ) : analysis.suggestions.map((suggestion) => (
                <Box key={suggestion.id} sx={{ border: '1px solid #dbe3f1', borderRadius: 1.5, mb: 1, p: 1.5 }}>
                  <Typography sx={{ lineHeight: 1.5 }}>{suggestion.text}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.75 }}>{suggestion.rationale}</Typography>
                  <Button onClick={() => { setCandidate(suggestion.text); setValidation(null) }} size="small" sx={{ mt: 0.75 }}>
                    Use this suggestion
                  </Button>
                </Box>
              ))}
            </Box>

            <TextField
              fullWidth
              label="Write your own correction"
              minRows={4}
              multiline
              onChange={(event) => { setCandidate(event.target.value); setValidation(null) }}
              placeholder="Enter an alternative wording using only confirmed information."
              value={candidate}
            />

            {candidate.trim() && candidate.trim() !== unit?.text.trim() && (
              <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', p: 1.5 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900, mb: 0.5 }}>CURRENT</Typography>
                  <Typography>{unit?.text}</Typography>
                </Box>
                <Box sx={{ bgcolor: '#f5f8ff', border: '1px solid #d9e3fb', p: 1.5 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900, mb: 0.5 }}>PROPOSED</Typography>
                  <Typography>{candidate}</Typography>
                </Box>
              </Box>
            )}

            {validation && (
              <Alert severity={validation.can_apply ? 'success' : 'error'}>
                {validation.can_apply
                  ? `Safe to apply. Previously compliant principles preserved: ${validation.preserved_principles.join(', ') || 'none recorded'}.`
                  : `Cannot apply. Regressions: ${validation.regressions.map((item) => `${item.principle} (${item.before} → ${item.after})`).join(', ') || 'A2 was not preserved'}.`}
              </Alert>
            )}
            {isKeepCurrentOpen && (
              <Box sx={{ bgcolor: '#fffaf0', border: '1px solid #fed7aa', borderRadius: 1.5, p: 1.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 0.75 }}>
                  Keep the current wording?
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                  The current attestation will remain unchanged and your decision will be recorded for subsequent analyses.
                </Typography>
                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                  <Button onClick={() => setIsKeepCurrentOpen(false)} size="small">Cancel</Button>
                  <Button
                    onClick={() => onKeep('', analysis.status)}
                    size="small"
                    variant="contained"
                  >
                    {analysis.status === 'Compliant' ? 'Confirm current attestation' : 'Accept as is'}
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button disabled={!analysis} onClick={() => setIsKeepCurrentOpen(true)}>
          Keep current attestation
        </Button>
        <Button
          disabled={!analysis || !candidate.trim() || candidate.trim() === unit?.text.trim() || isValidating}
          onClick={() => void validateCandidate()}
          variant="outlined"
        >
          {isValidating ? 'Validating…' : 'Validate correction'}
        </Button>
        <Button
          disabled={!validation?.can_apply}
          onClick={() => validation && onApply(candidate.trim(), validation)}
          variant="contained"
        >
          Apply correction
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type A3AnalysisDialogProps = {
  onApply: (candidate: string, validation: A3ValidationResult, templateId: string) => void
  onClose: () => void
  onKeep: (status: ComplianceStatus, modality: string, communicativeFunction: string, templateId: string) => void
  onRecordAnalysis: (analysis: A3AnalysisResult) => void
  open: boolean
  unit?: AttestationUnit
}

function A3AnalysisDialog({ onApply, onClose, onKeep, onRecordAnalysis, open, unit }: A3AnalysisDialogProps) {
  const [analysis, setAnalysis] = useState<A3AnalysisResult | null>(null)
  const [adaptation, setAdaptation] = useState<A3TemplateAdaptationResult | null>(null)
  const [candidate, setCandidate] = useState('')
  const [communicativeFunction, setCommunicativeFunction] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAdapting, setIsAdapting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [modality, setModality] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [validation, setValidation] = useState<A3ValidationResult | null>(null)
  const onRecordAnalysisRef = useRef(onRecordAnalysis)
  const adaptationRequestRef = useRef(0)

  useEffect(() => {
    onRecordAnalysisRef.current = onRecordAnalysis
  }, [onRecordAnalysis])

  useEffect(() => {
    let isCurrent = true
    setAnalysis(null)
    setAdaptation(null)
    setCandidate('')
    setCommunicativeFunction('')
    setError('')
    setModality('')
    setSelectedTemplateId('')
    setValidation(null)
    if (!open || !unit?.text.trim()) return () => { isCurrent = false }

    setIsLoading(true)
    void analyzeA3ModalityAndFunction(unit.text)
      .then((result) => {
        if (!isCurrent) return
        setAnalysis(result)
        setCandidate(result.suggestions[0]?.text ?? '')
        setCommunicativeFunction(result.communicative_function)
        setModality(result.modality)
        setSelectedTemplateId(result.recommended_template?.id || (
          attestationTemplates.find((template) => (
            template.modality.toLowerCase() === result.modality.toLowerCase()
            && template.communicative_function.toLowerCase() === result.communicative_function.toLowerCase()
          ))?.id ?? ''
        ))
        onRecordAnalysisRef.current(result)
      })
      .catch((reason: unknown) => {
        if (isCurrent) setError(reason instanceof Error ? reason.message : 'Could not analyze A3.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => { isCurrent = false }
  }, [open, unit?.id, unit?.text])

  const validateCandidate = async () => {
    if (!unit || !candidate.trim() || candidate.trim() === unit.text.trim()) return
    setIsValidating(true)
    setError('')
    setValidation(null)
    try {
      setValidation(await validateA3Correction(
        unit.text,
        candidate.trim(),
        modality.trim(),
        communicativeFunction.trim(),
        selectedTemplateId,
      ))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not validate the correction.')
    } finally {
      setIsValidating(false)
    }
  }

  const filteredTemplates = attestationTemplates.filter((template) => template.modality === modality)
  const selectedTemplate = attestationTemplates.find((template) => template.id === selectedTemplateId)

  const adaptToSelectedTemplate = async (templateId: string) => {
    if (!unit || !templateId) return
    const requestId = adaptationRequestRef.current + 1
    adaptationRequestRef.current = requestId
    setIsAdapting(true)
    setError('')
    setAdaptation(null)
    setValidation(null)
    try {
      const result = await adaptA3ToTemplate(unit.text, templateId)
      if (adaptationRequestRef.current !== requestId) return
      setAdaptation(result)
      if (result.adapted_attestation?.trim()) setCandidate(result.adapted_attestation.trim())
    } catch (reason) {
      if (adaptationRequestRef.current === requestId) {
        setError(reason instanceof Error ? reason.message : 'Could not adapt the attestation to this template.')
      }
    } finally {
      if (adaptationRequestRef.current === requestId) setIsAdapting(false)
    }
  }

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>Identify Modality and Communicative Function · A3</DialogTitle>
      <DialogContent>
        {isLoading && (
          <Stack alignItems="center" direction="row" spacing={1.25} sx={{ py: 4 }}>
            <CircularProgress size={22} />
            <Typography>Identifying modality, communicative function and factual wording…</Typography>
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {analysis && (
          <Stack spacing={2.25}>
            <Alert severity={analysis.status === 'Compliant' ? 'success' : analysis.status === 'Non-Compliant' ? 'error' : 'warning'}>
              <Typography sx={{ fontWeight: 900 }}>{analysis.status}</Typography>
              <Typography sx={{ mt: 0.25 }}>
                {analysis.assessment.issue_identified || analysis.assessment.explanation || analysis.guidance}
              </Typography>
            </Alert>

            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1.3fr' } }}>
              <TextField
                label="Modality"
                onChange={(event) => {
                  setModality(event.target.value)
                  setSelectedTemplateId('')
                  setAdaptation(null)
                  setValidation(null)
                }}
                select
                value={modality}
              >
                {!attestationModalities.includes(modality) && modality && <MenuItem value={modality}>{modality}</MenuItem>}
                {attestationModalities.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
              </TextField>
              <TextField
                disabled={!modality}
                helperText={modality ? `${filteredTemplates.length} template${filteredTemplates.length === 1 ? '' : 's'} available` : 'Select a modality first'}
                label="Template"
                onChange={(event) => {
                  const template = attestationTemplates.find((item) => item.id === event.target.value)
                  setSelectedTemplateId(event.target.value)
                  if (template) {
                    setModality(template.modality)
                    setCommunicativeFunction(template.communicative_function)
                    void adaptToSelectedTemplate(template.id)
                  }
                  if (!template) setAdaptation(null)
                  setValidation(null)
                }}
                select
                value={selectedTemplateId}
              >
                <MenuItem value="">No template selected</MenuItem>
                {filteredTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.communicative_function || template.category || template.id}
                    {template.id === analysis.recommended_template?.id ? ' · Recommended' : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <TextField
              label="Communicative function"
              onChange={(event) => { setCommunicativeFunction(event.target.value); setSelectedTemplateId(''); setAdaptation(null); setValidation(null) }}
              value={communicativeFunction}
            />

            {selectedTemplate && (
              <Box sx={{ bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 1.5, p: 1.5 }}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ color: '#6d28d9', fontSize: 12, fontWeight: 900 }}>SELECTED TEMPLATE</Typography>
                  {selectedTemplate.id === analysis.recommended_template?.id && (
                    <Chip color="secondary" label="Recommended" size="small" variant="outlined" />
                  )}
                </Stack>
                <Typography sx={{ fontWeight: 800, mt: 0.5 }}>{selectedTemplate.communicative_function}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.75 }}>
                  Structure: {selectedTemplate.structural_template}
                </Typography>
                {selectedTemplate.representative_example && (
                  <Typography sx={{ fontSize: 13, fontStyle: 'italic', mt: 0.75 }}>
                    Example: {selectedTemplate.representative_example}
                  </Typography>
                )}
                {(adaptation?.template_selection_rationale || (selectedTemplate.id === analysis.recommended_template?.id && analysis.template_selection_rationale)) && (
                  <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.75 }}>
                    Why this template: {adaptation?.template_selection_rationale || analysis.template_selection_rationale}
                  </Typography>
                )}
              </Box>
            )}

            {isAdapting && (
              <Alert icon={<CircularProgress size={18} />} severity="info">
                Adapting the attestation to the selected template while preserving its meaning…
              </Alert>
            )}
            {adaptation?.template_adaptation_decision === 'not_adapted_review_required' && (
              <Alert severity="warning">{adaptation.final_assessment || 'This template requires manual review before it can be applied safely.'}</Alert>
            )}

            <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', p: 1.5 }}>
              <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900, mb: 0.5 }}>SUPPORTING TEXT</Typography>
              <Typography>{analysis.supporting_text}</Typography>
            </Box>

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 1 }}>Suggested factual wording</Typography>
              {analysis.suggestions.length === 0 ? (
                <Alert severity="info">{analysis.guidance}</Alert>
              ) : analysis.suggestions.map((suggestion) => (
                <Box key={suggestion.id} sx={{ border: '1px solid #dbe3f1', borderRadius: 1.5, mb: 1, p: 1.5 }}>
                  <Typography sx={{ lineHeight: 1.5 }}>{suggestion.text}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.75 }}>{suggestion.rationale}</Typography>
                  <Button onClick={() => { setCandidate(suggestion.text); setValidation(null) }} size="small" sx={{ mt: 0.75 }}>
                    Use this suggestion
                  </Button>
                </Box>
              ))}
            </Box>

            <TextField
              fullWidth
              label="Write your own factual wording"
              minRows={4}
              multiline
              onChange={(event) => { setCandidate(event.target.value); setValidation(null) }}
              placeholder="Enter an alternative wording that preserves the confirmed modality and function."
              value={candidate}
            />

            {candidate.trim() && candidate.trim() !== unit?.text.trim() && (
              <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', p: 1.5 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900, mb: 0.5 }}>CURRENT</Typography>
                  <Typography>{unit?.text}</Typography>
                </Box>
                <Box sx={{ bgcolor: '#f5f8ff', border: '1px solid #d9e3fb', p: 1.5 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900, mb: 0.5 }}>PROPOSED</Typography>
                  <Typography>{candidate}</Typography>
                </Box>
              </Box>
            )}

            {validation && (
              <Alert severity={validation.can_apply ? 'success' : 'error'}>
                {validation.can_apply
                  ? `Safe to apply. Candidate classification: ${validation.candidate_modality} · ${validation.candidate_communicative_function}.`
                  : validation.warnings.join(' ') || 'The correction cannot be applied.'}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          disabled={!analysis || !modality.trim() || !communicativeFunction.trim()}
          onClick={() => analysis && onKeep(analysis.status, modality.trim(), communicativeFunction.trim(), selectedTemplateId)}
        >
          Keep current attestation
        </Button>
        <Button
          disabled={!analysis || !candidate.trim() || candidate.trim() === unit?.text.trim() || !modality.trim() || !communicativeFunction.trim() || isAdapting || isValidating}
          onClick={() => void validateCandidate()}
          variant="outlined"
        >
          {isValidating ? 'Validating…' : 'Validate correction'}
        </Button>
        <Button
          disabled={!validation?.can_apply}
          onClick={() => validation && onApply(candidate.trim(), validation, selectedTemplateId)}
          variant="contained"
        >
          Apply correction
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type WorkflowPrincipleDialogProps = {
  onApply: (candidates: string[], validation: WorkflowPrincipleValidationResult) => void
  onClose: () => void
  onKeep: (status: ComplianceStatus) => void
  onRecordAnalysis: (analysis: WorkflowPrincipleAnalysisResult) => void
  open: boolean
  principle: WorkflowPrincipleCode
  protectedPrinciples: PrincipleCode[]
  unit?: AttestationUnit
}

function WorkflowPrincipleDialog({ onApply, onClose, onKeep, onRecordAnalysis, open, principle, protectedPrinciples, unit }: WorkflowPrincipleDialogProps) {
  const [analysis, setAnalysis] = useState<WorkflowPrincipleAnalysisResult | null>(null)
  const [candidate, setCandidate] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validation, setValidation] = useState<WorkflowPrincipleValidationResult | null>(null)
  const onRecordAnalysisRef = useRef(onRecordAnalysis)

  useEffect(() => {
    onRecordAnalysisRef.current = onRecordAnalysis
  }, [onRecordAnalysis])

  useEffect(() => {
    let isCurrent = true
    setAnalysis(null)
    setCandidate('')
    setError('')
    setValidation(null)
    if (!open || !unit?.text.trim()) return () => { isCurrent = false }

    setIsLoading(true)
    void analyzeWorkflowPrinciple(unit.text, principle, unit.originalText)
      .then((result) => {
        if (!isCurrent) return
        setAnalysis(result)
        const suggestion = result.suggestions[0]
        setCandidate(principle === 'B1' && suggestion?.replacement_units.length
          ? suggestion.replacement_units.join('\n')
          : suggestion?.text ?? '')
        onRecordAnalysisRef.current(result)
      })
      .catch((reason: unknown) => {
        if (isCurrent) setError(reason instanceof Error ? reason.message : `Could not analyze ${principle}.`)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => { isCurrent = false }
  }, [open, principle, unit?.id, unit?.originalText, unit?.text])

  const candidateAttestations = principle === 'B1'
    ? candidate.split(/\n+/).map((item) => item.trim()).filter(Boolean)
    : candidate.trim() ? [candidate.trim()] : []
  const candidateChanged = candidateAttestations.length > 0
    && !(candidateAttestations.length === 1 && candidateAttestations[0] === unit?.text.trim())

  const validateCandidate = async () => {
    if (!unit || !candidateChanged) return
    setIsValidating(true)
    setError('')
    setValidation(null)
    try {
      setValidation(await validateWorkflowPrincipleCorrection(
        unit.text,
        candidateAttestations,
        principle,
        analysis?.status ?? 'Compliant',
        protectedPrinciples,
      ))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not validate the proposal.')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>{analysis?.action_title || `Analyze ${principle}`} · {principle}</DialogTitle>
      <DialogContent>
        {isLoading && (
          <Stack alignItems="center" direction="row" spacing={1.25} sx={{ py: 4 }}>
            <CircularProgress size={22} />
            <Typography>Analyzing the attestation against {principle}…</Typography>
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {analysis && (
          <Stack spacing={2.25}>
            <Alert severity={analysis.status === 'Compliant' ? 'success' : analysis.status === 'Non-Compliant' ? 'error' : 'warning'}>
              <Typography sx={{ fontWeight: 900 }}>{analysis.status}</Typography>
              <Typography sx={{ mt: 0.25 }}>{analysis.summary || analysis.assessment.explanation}</Typography>
            </Alert>

            {analysis.metrics.length > 0 && (
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                {analysis.metrics.map((metric) => (
                  <Box key={metric.label} sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', borderRadius: 1.25, p: 1.25 }}>
                    <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900 }}>{metric.label.toUpperCase()}</Typography>
                    <Typography sx={{ fontWeight: 800, mt: 0.35 }}>{metric.value}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            {analysis.findings.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 1 }}>What the analysis found</Typography>
                <Stack spacing={0.8}>
                  {analysis.findings.map((finding, index) => (
                    <Box key={`${finding.category}-${index}`} sx={{ border: '1px solid #e5eaf2', borderRadius: 1.25, p: 1.25 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 900 }}>{finding.category}</Typography>
                      <Typography sx={{ fontSize: 13, mt: 0.25 }}>{finding.text}</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.4 }}>{finding.explanation}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {analysis.checks.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 1 }}>Criteria checked</Typography>
                <Stack spacing={0.75}>
                  {analysis.checks.map((check) => (
                    <Stack alignItems="flex-start" direction="row" key={check.label} spacing={1}>
                      {check.passed
                        ? <CheckCircleOutlineOutlinedIcon sx={{ color: '#078b57', fontSize: 18, mt: 0.15 }} />
                        : <ErrorOutlineOutlinedIcon sx={{ color: '#c2410c', fontSize: 18, mt: 0.15 }} />}
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{check.label}</Typography>
                        <Typography color="text.secondary" sx={{ fontSize: 12 }}>{check.evidence}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 1 }}>
                {principle === 'B1' ? 'Suggested independent attestations' : 'Suggested correction'}
              </Typography>
              {analysis.suggestions.length === 0 ? (
                <Alert severity="info">{analysis.guidance}</Alert>
              ) : analysis.suggestions.map((suggestion) => {
                const suggestionText = principle === 'B1' && suggestion.replacement_units.length
                  ? suggestion.replacement_units.join('\n')
                  : suggestion.text
                return (
                  <Box key={suggestion.id} sx={{ border: '1px solid #dbe3f1', borderRadius: 1.5, mb: 1, p: 1.5 }}>
                    <Typography sx={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{suggestionText}</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.75 }}>{suggestion.rationale}</Typography>
                    <Button onClick={() => { setCandidate(suggestionText); setValidation(null) }} size="small" sx={{ mt: 0.75 }}>
                      Use this suggestion
                    </Button>
                  </Box>
                )
              })}
            </Box>

            <TextField
              fullWidth
              helperText={principle === 'B1' ? 'Enter one complete independent attestation per line.' : 'You may edit the proposal or provide your own wording.'}
              label={principle === 'B1' ? 'Independent attestations' : 'Your proposed wording'}
              minRows={principle === 'B1' ? 5 : 4}
              multiline
              onChange={(event) => { setCandidate(event.target.value); setValidation(null) }}
              value={candidate}
            />

            {candidateChanged && (
              <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e5eaf2', p: 1.5 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900, mb: 0.5 }}>CURRENT</Typography>
                  <Typography>{unit?.text}</Typography>
                </Box>
                <Box sx={{ bgcolor: '#f5f8ff', border: '1px solid #d9e3fb', p: 1.5 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 900, mb: 0.5 }}>PROPOSED</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{candidateAttestations.join('\n\n')}</Typography>
                </Box>
              </Box>
            )}

            {validation && (
              <Alert severity={validation.can_apply ? 'success' : 'error'}>
                {validation.can_apply
                  ? `${principle} is preserved or improved, and previously completed principles remain protected.`
                  : validation.warnings.join(' ') || 'The proposal cannot be applied safely.'}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button disabled={!analysis} onClick={() => analysis && onKeep(analysis.status)}>Keep current attestation</Button>
        <Button
          disabled={!analysis || !candidateChanged || isValidating || (principle === 'B1' && candidateAttestations.length < 2)}
          onClick={() => void validateCandidate()}
          variant="outlined"
        >
          {isValidating ? 'Validating…' : 'Validate proposal'}
        </Button>
        <Button disabled={!validation?.can_apply} onClick={() => validation && onApply(candidateAttestations, validation)} variant="contained">
          {principle === 'B1' ? 'Apply separation' : 'Apply correction'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type SentenceContainerProps = {
  complianceStatus: UnitComplianceStatus
  index: number
  isGeneratingTriples: boolean
  isLocked: boolean
  isSelected: boolean
  isUnitizationBusy: boolean
  isUnitizing: boolean
  originalText: string
  triples?: unknown
  unit: AttestationUnit
  unitAnalysis?: UnitComplianceAnalysis
  principleAnalyses: UnitPrincipleAnalysis[]
  onChange: (index: number, value: string) => void
  onAnalyze: (index: number) => void
  onAnalyzeA2: (index: number) => void
  onAnalyzeA3: (index: number) => void
  onAnalyzeWorkflow: (index: number, principle: WorkflowPrincipleCode) => void
  onApprove: (index: number) => void
  onGenerateTriples: (index: number) => void
  onOpenUnitAnalysis: (unitAnalysis: UnitComplianceAnalysis) => void
  onOpenReferences: (index: number) => void
  onOpenRewrite: (index: number) => void
  onRemove: (index: number) => void
  onSelect: (index: number, event: MouseEvent<HTMLElement>) => void
  onToggleLock: (index: number) => void
  onUnitize: (index: number) => void
}

function AttestationMetadataBadges({ communicativeFunction, modality }: { communicativeFunction?: string; modality?: string }) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.5 }}>
      <Chip
        label={`Modality: ${modality && modality !== 'undefined' ? modality : 'Uncertain'}`}
        size="small"
        sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 11, fontWeight: 800 }}
        variant="outlined"
      />
      <Chip
        label={`Function: ${communicativeFunction && communicativeFunction !== 'undefined' ? communicativeFunction : 'Uncertain'}`}
        size="small"
        sx={{ bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9', fontSize: 11, fontWeight: 800 }}
        variant="outlined"
      />
    </Stack>
  )
}

type WorkflowStepperProps = {
  isBusy: boolean
  nextStep?: {
    action: () => void
    actionLabel: string
    done: boolean
    id: string
    label: string
  }
  steps: Array<{
    action: () => void
    actionLabel: string
    done: boolean
    id: string
    label: string
  }>
  supportingActions: Array<{ label: string; onClick: () => void }>
  textAvailable: boolean
}

function WorkflowStepper({ isBusy, nextStep, steps, supportingActions, textAvailable }: WorkflowStepperProps) {
  return (
    <Box
      onClick={(event) => event.stopPropagation()}
      sx={{
        bgcolor: '#f8fafc',
        border: '1px solid #e5eaf2',
        borderRadius: 1.5,
        mb: 2,
        p: { xs: 1.25, md: 1.5 },
      }}
    >
      <Stack alignItems={{ xs: 'stretch', md: 'center' }} direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ flex: 1 }}>
          {steps.map((step, stepIndex) => (
            <Stack alignItems="center" direction="row" key={step.id} spacing={0.35}>
              {step.done ? (
                <CheckCircleOutlineOutlinedIcon sx={{ color: '#078b57', fontSize: 16 }} />
              ) : stepIndex === steps.findIndex((candidate) => !candidate.done) ? (
                <RadioButtonCheckedOutlinedIcon sx={{ color: '#2457c5', fontSize: 16 }} />
              ) : (
                <RadioButtonUncheckedOutlinedIcon sx={{ color: '#aab3c2', fontSize: 16 }} />
              )}
              <Typography sx={{ color: step.done ? '#067647' : '#5f6675', fontSize: 11, fontWeight: 800 }}>
                {step.label}
              </Typography>
              {stepIndex < steps.length - 1 && <Typography color="text.disabled" sx={{ fontSize: 12 }}>›</Typography>}
            </Stack>
          ))}
        </Stack>
        {nextStep && (
          <Button
            disabled={!textAvailable || isBusy}
            onClick={nextStep.action}
            size="small"
            sx={{ flexShrink: 0, textTransform: 'none' }}
            variant="contained"
          >
            {nextStep.actionLabel}
          </Button>
        )}
        {!nextStep && (
          <Chip
            color="success"
            label="Ready for approval"
            size="small"
            sx={{ fontWeight: 800 }}
            variant="outlined"
          />
        )}
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
        {supportingActions.map((action) => (
          <Button
            disabled={!textAvailable || isBusy}
            key={action.label}
            onClick={action.onClick}
            size="small"
            sx={{ color: '#5f6675', fontSize: 11, minHeight: 26, px: 1, textTransform: 'none' }}
            variant="text"
          >
            {action.label}
          </Button>
        ))}
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
        {steps
          .filter((step) => !step.done)
          .map((step) => (
            <Button
              disabled={!textAvailable || isBusy}
              key={`quick-${step.id}`}
              onClick={step.action}
              size="small"
              sx={{ color: step.done ? '#067647' : '#4353ff', fontSize: 11, minHeight: 26, px: 1, textTransform: 'none' }}
              variant="text"
            >
              {step.done ? `View ${step.label.toLowerCase()}` : step.actionLabel}
            </Button>
          ))}
      </Stack>
    </Box>
  )
}

function SentenceContainer({
  complianceStatus,
  index,
  isGeneratingTriples,
  isLocked,
  isSelected,
  isUnitizationBusy,
  isUnitizing,
  originalText,
  triples,
  unit,
  unitAnalysis,
  principleAnalyses,
  onChange,
  onAnalyze,
  onAnalyzeA2,
  onAnalyzeA3,
  onAnalyzeWorkflow,
  onApprove,
  onGenerateTriples,
  onOpenUnitAnalysis,
  onOpenReferences,
  onOpenRewrite,
  onRemove,
  onSelect,
  onToggleLock,
  onUnitize,
}: SentenceContainerProps) {
  const [activeDataView, setActiveDataView] = useState<UnitDataView>('attestation')
  const [isCopied, setIsCopied] = useState(false)
  const isAttestationView = activeDataView === 'attestation'
  const a2PrincipleAnalysis = principleAnalyses.find((item) => item.principle === 'A2')
  const a2Assessment = isRecord(a2PrincipleAnalysis?.assessment) ? a2PrincipleAnalysis.assessment : {}
  const a2IsCompliant = a2Assessment.compliance === 'Compliant'
  const a2Decision = unit.principleDecisions?.A2?.revision === unit.revision
    ? unit.principleDecisions.A2
    : undefined
  const a3PrincipleAnalysis = principleAnalyses.find((item) => item.principle === 'A3')
  const a3Assessment = isRecord(a3PrincipleAnalysis?.assessment) ? a3PrincipleAnalysis.assessment : {}
  const a3IsCompliant = a3Assessment.compliance === 'Compliant'
  const a3Decision = unit.principleDecisions?.A3?.revision === unit.revision
    ? unit.principleDecisions.A3
    : undefined
  const workflowStep = (principle: WorkflowPrincipleCode, actionLabel: string) => {
    const analysis = principleAnalyses.find((item) => item.principle === principle)
    const assessment = isRecord(analysis?.assessment) ? analysis.assessment : {}
    const decision = unit.principleDecisions?.[principle]?.revision === unit.revision
      ? unit.principleDecisions[principle]
      : undefined
    return {
      id: principle,
      label: principle,
      done: assessment.compliance === 'Compliant' || Boolean(decision),
      action: () => onAnalyzeWorkflow(index, principle),
      actionLabel,
    }
  }

  const workflowSteps = [
    { id: 'A1', label: 'A1', done: unit.unitizationReviewed, action: () => onUnitize(index), actionLabel: 'Unitize attestation' },
    { id: 'A2', label: 'A2', done: a2IsCompliant || Boolean(a2Decision), action: () => onAnalyzeA2(index), actionLabel: 'Analyse Key Attestation Elements' },
    { id: 'A3', label: 'A3', done: a3IsCompliant || Boolean(a3Decision), action: () => onAnalyzeA3(index), actionLabel: 'Identify Modality and Communicative Function' },
    workflowStep('B1', 'Separate Independent Attestations'),
    workflowStep('B2', 'Clarify Vague or Subjective Language'),
    workflowStep('C', 'Strengthen Verifiability and Auditability'),
    workflowStep('D', 'Improve Machine Readability'),
    workflowStep('E', 'Confirm Preservation of Meaning'),
  ]
  const nextWorkflowStep = workflowSteps.find((step) => !step.done)

  const handleCopyUnit = async () => {
    const text = unit.text
    if (!text.trim()) {
      return
    }

    await navigator.clipboard.writeText(text)
    setIsCopied(true)
    window.setTimeout(() => setIsCopied(false), 1200)
  }

  return (
    <Box
      onClick={(event) => onSelect(index, event)}
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid',
        borderColor: isSelected ? '#2457c5' : '#e2e6ef',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(36, 87, 197, 0.12), 0 16px 40px rgba(33, 42, 66, 0.1)'
          : '0 16px 40px rgba(33, 42, 66, 0.08)',
        cursor: 'text',
        maxWidth: 1220,
        minHeight: 112,
        pb: { xs: 7.5, md: 7 },
        pl: { xs: 2.5, md: 9.5 },
        pr: { xs: 2.5, md: 4 },
        pt: { xs: 8.5, md: 8 },
        position: 'relative',
        transition: 'border-color 140ms ease, box-shadow 140ms ease',
        width: 'min(100%, 1220px)',
        '&:hover .unit-controls': {
          opacity: 1,
        },
      }}
    >
      <UnitStatusBadges
        complianceStatus={complianceStatus}
        onOpenUnitAnalysis={unitAnalysis ? () => onOpenUnitAnalysis(unitAnalysis) : undefined}
        unitAnalysis={unitAnalysis}
      />
      <AttestationMetadataBadges
        communicativeFunction={(unit.analysisMetadata?.revision === unit.revision ? unit.analysisMetadata.communicativeFunction : undefined) || a3Decision?.metadata?.communicativeFunction || (getUnitAttestationMetadata(unitAnalysis?.analysis).communicativeFunction === 'Uncertain'
          ? unit.templateSnapshot?.communicative_function
          : getUnitAttestationMetadata(unitAnalysis?.analysis).communicativeFunction)}
        modality={(unit.analysisMetadata?.revision === unit.revision ? unit.analysisMetadata.modality : undefined) || a3Decision?.metadata?.modality || (getUnitAttestationMetadata(unitAnalysis?.analysis).modality === 'Uncertain'
          ? unit.templateSnapshot?.modality
          : getUnitAttestationMetadata(unitAnalysis?.analysis).modality)}
      />
      {a2Decision && (
        <Tooltip title={a2Decision.reason || 'The current wording was confirmed by the user.'}>
          <Chip
            label={a2Decision.decision === 'confirmed_as_is' ? 'A2 · Current wording confirmed' : 'A2 · Accepted as is'}
            size="small"
            sx={{ bgcolor: a2Decision.decision === 'confirmed_as_is' ? '#ecfdf3' : '#fff7ed', color: a2Decision.decision === 'confirmed_as_is' ? '#067647' : '#9a3412', fontWeight: 800, mb: 1.5 }}
            variant="outlined"
          />
        </Tooltip>
      )}
      {a3Decision && (
        <Tooltip title={`${a3Decision.metadata?.modality || 'Uncertain'} · ${a3Decision.metadata?.communicativeFunction || 'Uncertain'}`}>
          <Chip
            label={a3Decision.decision === 'confirmed_as_is' ? 'A3 · Classification confirmed' : 'A3 · Accepted as is'}
            size="small"
            sx={{ bgcolor: a3Decision.decision === 'confirmed_as_is' ? '#ecfdf3' : '#fff7ed', color: a3Decision.decision === 'confirmed_as_is' ? '#067647' : '#9a3412', fontWeight: 800, mb: 1.5, ml: a2Decision ? 0.75 : 0 }}
            variant="outlined"
          />
        </Tooltip>
      )}
      <WorkflowStepper
        isBusy={isUnitizationBusy || isUnitizing || isGeneratingTriples}
        nextStep={nextWorkflowStep}
        steps={workflowSteps}
        supportingActions={[
          { label: 'Run full analysis', onClick: () => onAnalyze(index) },
          { label: 'Find references', onClick: () => onOpenReferences(index) },
          { label: 'Open rewrite', onClick: () => onOpenRewrite(index) },
          { label: 'Generate triples', onClick: () => onGenerateTriples(index) },
          { label: 'Approve', onClick: () => onApprove(index) },
        ]}
        textAvailable={Boolean(unit.text.trim())}
      />
      <Stack
        className="unit-controls"
        direction="row"
        spacing={0.5}
        sx={{
          left: 12,
          opacity: isSelected ? 1 : 0,
          position: 'absolute',
          top: { xs: 14, md: 18 },
          transition: 'opacity 140ms ease',
        }}
      >
        <Tooltip title={isSelected ? 'Selected' : 'Select'}>
          <IconButton
            aria-label={isSelected ? `Unit ${index + 1} selected` : `Select unit ${index + 1}`}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(index, event)
            }}
            size="small"
            sx={{
              bgcolor: isSelected ? '#2457c5' : 'rgba(255, 255, 255, 0.92)',
              border: '1px solid',
              borderColor: isSelected ? '#2457c5' : '#d8deea',
              color: isSelected ? '#ffffff' : '#6a7282',
              height: 26,
              width: 26,
              '&:hover': {
                bgcolor: isSelected ? '#1f49a6' : '#f4f6fa',
              },
            }}
          >
            {isSelected ? (
              <DoneAllOutlinedIcon sx={{ fontSize: 15 }} />
            ) : (
              <RadioButtonUncheckedOutlinedIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={isCopied ? 'Copied' : 'Copy unit'}>
          <IconButton
            aria-label={`Copy unit ${index + 1}`}
            disabled={!unit.text.trim()}
            onClick={(event) => {
              event.stopPropagation()
              void handleCopyUnit()
            }}
            size="small"
            sx={{
              bgcolor: isCopied ? '#ecfdf3' : 'rgba(255, 255, 255, 0.92)',
              border: '1px solid',
              borderColor: isCopied ? '#abefc6' : '#d8deea',
              color: isCopied ? '#067647' : '#6a7282',
              height: 26,
              width: 26,
              '&:hover': {
                bgcolor: isCopied ? '#dcfae6' : '#f4f6fa',
                borderColor: isCopied ? '#75e0a7' : '#d8deea',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                borderColor: '#e4e8f0',
                color: '#b9c0ce',
              },
            }}
          >
            <ContentCopyOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Split sentence">
          <IconButton
            aria-label={`Split sentence ${index + 1}`}
            disabled={isLocked || isUnitizationBusy || !unit.text.trim()}
            onClick={(event) => {
              event.stopPropagation()
              onUnitize(index)
            }}
            size="small"
            sx={{
              bgcolor: isUnitizing ? '#e9edff' : 'rgba(255, 255, 255, 0.92)',
              border: '1px solid',
              borderColor: isUnitizing ? '#b9c4ff' : '#d8deea',
              color: isUnitizing ? '#4353ff' : '#6a7282',
              height: 26,
              width: 26,
              '&:hover': {
                bgcolor: '#eef2ff',
                borderColor: '#c5cffd',
                color: '#4353ff',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                borderColor: '#e4e8f0',
                color: '#b9c0ce',
              },
            }}
          >
            {isUnitizing ? (
              <CircularProgress size={14} sx={{ color: 'inherit' }} />
            ) : (
              <CallSplitOutlinedIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={isLocked ? 'Unlock sentence' : 'Lock sentence'}>
          <IconButton
            aria-label={isLocked ? `Unlock sentence ${index + 1}` : `Lock sentence ${index + 1}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggleLock(index)
            }}
            size="small"
            sx={{
              bgcolor: isLocked ? '#fff6dc' : 'rgba(255, 255, 255, 0.92)',
              border: '1px solid',
              borderColor: isLocked ? '#e8c56e' : '#d8deea',
              color: isLocked ? '#8a5a00' : '#6a7282',
              height: 26,
              width: 26,
              '&:hover': {
                bgcolor: isLocked ? '#ffefbd' : '#f4f6fa',
              },
            }}
          >
            {isLocked ? (
              <LockOutlinedIcon sx={{ fontSize: 15 }} />
            ) : (
              <LockOpenOutlinedIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Remove sentence">
          <IconButton
            aria-label={`Remove sentence ${index + 1}`}
            disabled={isLocked}
            onClick={(event) => {
              event.stopPropagation()
              onRemove(index)
            }}
            size="small"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid #d8deea',
              color: '#6a7282',
              height: 26,
              width: 26,
              '&:hover': {
                bgcolor: '#fff1f1',
                borderColor: '#f0b6b6',
                color: '#b42318',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                borderColor: '#e4e8f0',
                color: '#b9c0ce',
              },
            }}
          >
            <CloseOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography
        color="text.secondary"
        component="span"
        sx={{
          bottom: 12,
          fontSize: 13,
          fontWeight: 700,
          left: { xs: 16, md: 30 },
          position: 'absolute',
        }}
      >
        {index + 1}
      </Typography>
      {unit.templateSnapshot && (
        <Chip
          label={unit.templateSnapshot.communicative_function || unit.templateSnapshot.modality || 'Template'}
          size="small"
          sx={{
            bgcolor: '#eef4ff',
            border: '1px solid #cddbf7',
            color: '#244a8f',
            fontSize: 11,
            fontWeight: 800,
            maxWidth: { xs: 'calc(100% - 32px)', md: 360 },
            position: 'absolute',
            right: { xs: 16, md: 28 },
            top: { xs: 14, md: 18 },
          }}
          variant="outlined"
        />
      )}
      {isAttestationView ? (
        <TextareaAutosize
          aria-label={`Sentence ${index + 1}`}
          minRows={2}
          onChange={(event) => onChange(index, event.target.value)}
          readOnly={isLocked}
          value={unit.text}
          style={{
            background: isLocked ? 'rgba(255, 246, 220, 0.35)' : 'transparent',
            border: 0,
            color: '#172033',
            cursor: isLocked ? 'default' : 'text',
            font: '500 20px/1.55 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '0',
            outline: 0,
            padding: isLocked ? '2px 4px' : 0,
            resize: 'none',
            width: '100%',
          }}
        />
      ) : (
        <UnitDataPanel
          activeView={activeDataView}
          attestationText={unit.text}
          isGeneratingTriples={isGeneratingTriples}
          originalText={originalText}
          triples={triples}
          unitAnalysis={unitAnalysis}
        />
      )}
      <UnitDataViewTabs
        activeView={activeDataView}
        onChange={setActiveDataView}
      />
    </Box>
  )
}

function UnitDataViewTabs({
  activeView,
  onChange,
}: {
  activeView: UnitDataView
  onChange: (view: UnitDataView) => void
}) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        bottom: 12,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        position: 'absolute',
        right: { xs: 12, md: 18 },
        rowGap: 0.5,
      }}
    >
      {unitDataViews.map((view) => {
        const isActive = view.id === activeView

        return (
          <Button
            key={view.id}
            onClick={(event) => {
              event.stopPropagation()
              onChange(view.id)
            }}
            size="small"
            sx={{
              bgcolor: isActive ? '#eef2f8' : 'transparent',
              border: '1px solid',
              borderColor: isActive ? '#cfd8ea' : 'transparent',
              color: isActive ? '#172033' : '#6a7282',
              fontSize: 11,
              fontWeight: 800,
              minHeight: 24,
              minWidth: 0,
              px: 0.9,
              py: 0.1,
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#eef2f8',
                borderColor: '#cfd8ea',
              },
            }}
          >
            {view.label}
          </Button>
        )
      })}
    </Stack>
  )
}

function UnitDataPanel({
  activeView,
  attestationText,
  isGeneratingTriples,
  originalText,
  triples,
  unitAnalysis,
}: {
  activeView: Exclude<UnitDataView, 'attestation'> | UnitDataView
  attestationText: string
  isGeneratingTriples: boolean
  originalText: string
  triples?: unknown
  unitAnalysis?: UnitComplianceAnalysis
}) {
  const content = getUnitDataPanelContent(activeView, originalText, isGeneratingTriples)

  return (
    <Box
      sx={{
        bgcolor: '#f8fafc',
        border: '1px solid #e5eaf2',
        color: '#334155',
        fontSize: 14,
        lineHeight: 1.55,
        maxHeight: 260,
        overflowY: 'auto',
        p: 1.5,
        whiteSpace: activeView === 'triples' ? 'normal' : 'pre-wrap',
      }}
    >
      {isGeneratingTriples && activeView === 'triples' ? (
        <Stack alignItems="center" direction="row" spacing={1}>
          <CircularProgress size={16} />
          <span>{content}</span>
        </Stack>
      ) : activeView === 'triples' ? (
        <TriplesView attestationText={attestationText} triples={triples} />
      ) : activeView === 'key-elements' ? (
        <KeyElementsView unitAnalysis={unitAnalysis} />
      ) : content}
    </Box>
  )
}

function getUnitDataPanelContent(
  activeView: UnitDataView,
  originalText: string,
  isGeneratingTriples = false,
) {
  if (activeView === 'original-text') {
    return originalText || 'No original text was captured for this unit.'
  }

  if (activeView === 'key-elements') {
    return ''
  }

  if (activeView === 'triples') {
    if (isGeneratingTriples) {
      return 'Generating triples for this unit...'
    }

    return ''
  }

  return ''
}

const keyElementLabels: Array<{ key: keyof KeyElements; label: string }> = [
  { key: 'products', label: 'Products' },
  { key: 'animals', label: 'Animals' },
  { key: 'establishments', label: 'Establishments' },
  { key: 'authorities', label: 'Authorities' },
  { key: 'countries', label: 'Countries' },
  { key: 'zones', label: 'Zones' },
  { key: 'diseases', label: 'Diseases / hazards' },
  { key: 'activities', label: 'Activities' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'regulatory_assurances', label: 'Regulatory assurances' },
]

function KeyElementsView({ unitAnalysis }: { unitAnalysis?: UnitComplianceAnalysis }) {
  const keyElements = getUnitKeyElements(unitAnalysis?.analysis)
  const populatedRows = keyElementLabels
    .map(({ key, label }) => ({ key, label, values: keyElements[key] ?? [] }))
    .filter(({ values }) => values.length > 0)

  if (populatedRows.length === 0) {
    const keyElementsAssessment = getUnitPrincipleAssessments(unitAnalysis?.analysis)
      .find((assessment) => assessment.principle === 'A2')

    return (
      <Box>
        {keyElementsAssessment?.issue_identified
          || keyElementsAssessment?.explanation
          || 'No key attestation elements have been extracted for this unit yet.'}
      </Box>
    )
  }

  return (
    <Stack spacing={1}>
      {populatedRows.map(({ key, label, values }) => (
        <Box key={key}>
          <Typography component="div" sx={{ color: '#172033', fontSize: 12, fontWeight: 900, mb: 0.5 }}>
            {label}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {values.map((value, index) => (
              <Chip
                key={`${key}-${value}-${index}`}
                label={value}
                size="small"
                sx={{
                  bgcolor: '#ffffff',
                  border: '1px solid #d8deea',
                  borderRadius: 1,
                  color: '#334155',
                  fontWeight: 700,
                  maxWidth: '100%',
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}

type TripleParts = {
  subject: string
  predicate: string
  object: string
}

function TriplesView({
  attestationText,
  triples,
}: {
  attestationText: string
  triples?: unknown
}) {
  const formattedTriples = getFormattedTriples(triples)
  const fallbackContent = getTriplesFallbackContent(triples)

  return (
    <Stack spacing={1.25}>
      <Box>
        <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: 0, mb: 0.5, textTransform: 'uppercase' }}>
          Attestation
        </Typography>
        <Typography sx={{ color: '#172033', fontSize: 14, fontWeight: 650, lineHeight: 1.5 }}>
          {attestationText || 'No attestation text is available for this unit.'}
        </Typography>
      </Box>
      {formattedTriples.length > 0 ? (
        <Stack spacing={0.75}>
          {formattedTriples.map((triple, index) => (
            <Stack
              direction="row"
              flexWrap="wrap"
              key={`${triple.subject}-${triple.predicate}-${triple.object}-${index}`}
              sx={{
                alignItems: 'center',
                bgcolor: '#f7fffb',
                border: '1px solid #b8f1d4',
                columnGap: 1,
                px: 1.25,
                py: 0.8,
                rowGap: 0.75,
              }}
            >
              <TripleToken tone="subject">
                <TripleEntityText value={triple.subject} />
              </TripleToken>
              <TripleToken tone="predicate">{triple.predicate}</TripleToken>
              <TripleToken tone="object">
                <TripleEntityText value={triple.object} />
              </TripleToken>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #e5eaf2',
            color: '#475569',
            fontFamily: fallbackContent.isCode ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit',
            fontSize: 13,
            lineHeight: 1.5,
            overflowX: 'auto',
            p: 1.25,
            whiteSpace: 'pre-wrap',
          }}
        >
          {fallbackContent.text}
        </Box>
      )}
    </Stack>
  )
}

function TripleToken({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'subject' | 'predicate' | 'object'
}) {
  const toneStyles = {
    object: {
      bgcolor: '#e8f8f4',
      color: '#11746e',
      fontStyle: 'normal',
      textTransform: 'none',
    },
    predicate: {
      bgcolor: '#f1ecff',
      color: '#7843f5',
      fontStyle: 'italic',
      textTransform: 'none',
    },
    subject: {
      bgcolor: '#eef4ff',
      color: '#2457c5',
      fontStyle: 'normal',
      textTransform: 'none',
    },
  } satisfies Record<string, Record<string, string>>

  return (
    <Box
      component="span"
      sx={{
        borderRadius: 1,
        display: 'inline-flex',
        fontSize: { xs: 15, md: 17 },
        fontWeight: 900,
        lineHeight: 1.15,
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        px: 1.2,
        py: 0.65,
        ...toneStyles[tone],
      }}
    >
      {children}
    </Box>
  )
}

function TripleEntityText({ value }: { value: string }) {
  const typeMarkerIndex = value.indexOf(' #')

  if (typeMarkerIndex === -1) {
    return <>{value.toUpperCase()}</>
  }

  return (
    <>
      {value.slice(0, typeMarkerIndex).toUpperCase()}
      <Box
        component="span"
        sx={{
          color: '#8f4b1f',
          fontWeight: 850,
          ml: 0.45,
          textTransform: 'none',
        }}
      >
        {value.slice(typeMarkerIndex + 1)}
      </Box>
    </>
  )
}

function getFormattedTriples(triples: unknown): TripleParts[] {
  const results = getTriplesResults(triples)

  if (!Array.isArray(results)) {
    return []
  }

  return results.flatMap((triple) => {
    const parts = getTripleParts(triple)
    return parts ? [parts] : []
  })
}

function getTriplesFallbackContent(triples: unknown) {
  if (!triples) {
    return { isCode: false, text: 'No triples have been generated for this unit yet.' }
  }

  const results = getTriplesResults(triples)

  if (Array.isArray(results)) {
    if (results.length === 0) {
      return { isCode: false, text: 'No triples were generated for this unit.' }
    }

    return { isCode: true, text: JSON.stringify(results, null, 2) }
  }

  if (typeof results === 'string') {
    return { isCode: false, text: results }
  }

  return { isCode: true, text: JSON.stringify(results, null, 2) }
}

function getTriplesResults(triples: unknown) {
  return isRecord(triples) && 'results' in triples ? triples.results : triples
}

function getUnitKeyElements(analysis: unknown): KeyElements {
  const results = getUnitAnalysisResults(analysis)
  const rawElements = isRecord(results.identified_elements)
    ? results.identified_elements
    : isRecord(results.key_elements)
      ? results.key_elements
      : {}

  return keyElementLabels.reduce((elements, { key }) => {
    const rawValues = rawElements[key]
    elements[key] = Array.isArray(rawValues)
      ? rawValues.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []
    return elements
  }, {} as KeyElements)
}

function getTripleParts(triple: unknown): TripleParts | null {
  if (!isRecord(triple)) {
    return null
  }

  const subject = triple.subject ?? triple.SUBJECT
  const predicate = triple.predicate ?? triple.PREDICATE
  const object = triple.object ?? triple.OBJECT

  if (subject && predicate && object) {
    return {
      object: String(object),
      predicate: String(predicate),
      subject: String(subject),
    }
  }

  return null
}

function UnitStatusBadges({
  complianceStatus,
  onOpenUnitAnalysis,
  unitAnalysis,
}: {
  complianceStatus: UnitComplianceStatus
  onOpenUnitAnalysis?: () => void
  unitAnalysis?: UnitComplianceAnalysis
}) {
  const assessments = getUnitPrincipleAssessments(unitAnalysis?.analysis)

  return (
    <Stack
      direction="row"
      spacing={0.4}
      sx={{
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: { xs: 'calc(100% - 88px)', md: 'calc(100% - 150px)' },
        position: 'absolute',
        right: { xs: 12, md: 18 },
        top: { xs: 14, md: 18 },
        zIndex: 1,
      }}
    >
      {principleCodes.map((code) => {
        const assessment = assessments.find((item) => item.principle === code)
        const status = assessment ? normalizeComplianceStatus(assessment.compliance) : null

        return (
          <PrincipleStatusBadge
            code={code}
            key={code}
            name={assessment?.principle_name}
            status={status}
          />
        )
      })}
      <UnitAnalysisButton
        hasAnalysis={Boolean(unitAnalysis)}
        onClick={onOpenUnitAnalysis}
        status={complianceStatus}
      />
    </Stack>
  )
}

function PrincipleStatusBadge({
  code,
  name,
  status,
}: {
  code: string
  name?: string
  status: ComplianceStatus | null
}) {
  const colors = status ? statusColor[status] : unavailableStatusColor
  const StatusIcon = getStatusIcon(status)
  const title = `${code}${name ? ` - ${name}` : ''}: ${status ?? 'Not analyzed'}`

  return (
    <Tooltip title={title}>
      <Box
        aria-label={title}
        component="span"
        sx={{
          alignItems: 'center',
          bgcolor: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.color,
          display: 'inline-flex',
          fontSize: 10,
          fontWeight: 900,
          gap: 0.25,
          height: 22,
          lineHeight: 1,
          px: 0.55,
        }}
      >
        <StatusIcon sx={{ fontSize: 12 }} />
        {code}
      </Box>
    </Tooltip>
  )
}

function UnitAnalysisButton({
  hasAnalysis,
  onClick,
  status,
}: {
  hasAnalysis: boolean
  onClick?: () => void
  status: UnitComplianceStatus
}) {
  const isAnalyzing = status === 'Analyzing'
  const colors = isAnalyzing
    ? analyzingStatusColor
    : status
      ? statusColor[status]
      : unavailableStatusColor
  const title = isAnalyzing
    ? 'Compliance analysis is running'
    : hasAnalysis
      ? 'View unit compliance analysis'
      : 'No compliance analysis available'

  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          aria-label={title}
          disabled={!hasAnalysis || isAnalyzing}
          onClick={(event) => {
            event.stopPropagation()
            onClick?.()
          }}
          size="small"
          sx={{
            bgcolor: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.color,
            height: 24,
            width: 24,
            '&:hover': {
              bgcolor: colors.bg,
              boxShadow: '0 0 0 2px rgba(36, 87, 197, 0.12)',
            },
            '&.Mui-disabled': {
              bgcolor: colors.bg,
              borderColor: colors.border,
              color: colors.color,
              opacity: 0.8,
            },
          }}
        >
          {isAnalyzing ? <CircularProgress size={13} sx={{ color: colors.color }} /> : <FactCheckOutlinedIcon sx={{ fontSize: 15 }} />}
        </IconButton>
      </span>
    </Tooltip>
  )
}

function getStatusIcon(status: ComplianceStatus | null) {
  if (status === 'Compliant') {
    return DoneAllOutlinedIcon
  }

  if (status === 'Non-Compliant') {
    return ErrorOutlineOutlinedIcon
  }

  if (status === 'Partially Compliant') {
    return ReportProblemOutlinedIcon
  }

  return RadioButtonUncheckedOutlinedIcon
}
