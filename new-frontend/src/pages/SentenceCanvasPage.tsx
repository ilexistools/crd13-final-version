import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextareaAutosize,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { ComplianceReport, ComplianceReportRow, type ComplianceStatus, type UnitComplianceAnalysis, type UnitComplianceStatus, type UnitTriples } from '../lib/api'
import type { AttestationUnit } from '../lib/editorUnits'

export type EditorView = 'units' | 'compliance'
type UnitDataView = 'attestation' | 'triples' | 'key-elements' | 'original-text'

const unitDataViews: Array<{ id: UnitDataView; label: string }> = [
  { id: 'attestation', label: 'Attestation' },
  { id: 'triples', label: 'Triples' },
  { id: 'key-elements', label: 'Key elements' },
  { id: 'original-text', label: 'Original text' },
]

const principleCodes = ['A1', 'A2', 'A3', 'B1', 'B2', 'C', 'D', 'E'] as const

type SentenceCanvasPageProps = {
  activeView: EditorView
  commodities: string[]
  complianceReport: ComplianceReport | null
  generatingTripleUnitNumbers: number[]
  isAnalyzingCompliance: boolean
  units: AttestationUnit[]
  selectedIndexes: Set<number>
  lockedIndexes: Set<number>
  unitAnalyses: UnitComplianceAnalysis[]
  unitComplianceStatuses: UnitComplianceStatus[]
  unitTriples: UnitTriples[]
  onAddSentence: () => void
  onClearSelection: () => void
  onRemoveSelected: () => void
  onRemoveSentence: (index: number) => void
  onSelectAll: () => void
  onSelectSentence: (index: number, event: MouseEvent<HTMLElement>) => void
  onSentenceChange: (index: number, value: string) => void
  onToggleLockSentence: (index: number) => void
}

export function SentenceCanvasPage({
  activeView,
  commodities,
  complianceReport,
  generatingTripleUnitNumbers,
  isAnalyzingCompliance,
  units,
  selectedIndexes,
  lockedIndexes,
  unitAnalyses,
  unitComplianceStatuses,
  unitTriples,
  onAddSentence,
  onClearSelection,
  onRemoveSelected,
  onRemoveSentence,
  onSelectAll,
  onSelectSentence,
  onSentenceChange,
  onToggleLockSentence,
}: SentenceCanvasPageProps) {
  const selectedCount = selectedIndexes.size
  const [selectedUnitAnalysis, setSelectedUnitAnalysis] = useState<UnitComplianceAnalysis | null>(null)

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
              originalText={unit.originalText}
              triples={unitTriples.find((unitTriple) => unitTriple.unit === index + 1)?.triples}
              unitAnalysis={unitAnalyses.find((unitAnalysis) => unitAnalysis.unit === index + 1)}
              onChange={onSentenceChange}
              onOpenUnitAnalysis={setSelectedUnitAnalysis}
              onRemove={onRemoveSentence}
              onSelect={onSelectSentence}
              onToggleLock={onToggleLockSentence}
              unit={unit}
            />
          ))}
          <Tooltip title="Add unit">
            <IconButton
              aria-label="Add unit"
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
      ) : (
        <ComplianceReportPanel
          isLoading={isAnalyzingCompliance}
          report={complianceReport}
          unitAnalyses={unitAnalyses}
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
    </Box>
  )
}

type ComplianceReportPanelProps = {
  isLoading: boolean
  report: ComplianceReport | null
  unitAnalyses: UnitComplianceAnalysis[]
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
              Each unit is being evaluated and a consolidated report will appear here.
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
          <MetricCard label="Units" value={report.summary.total_units} />
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
                Unit analysis
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {unitAnalyses.map((unitAnalysis) => {
                  const unitStatus = getUnitAnalysisStatus(unitAnalysis.analysis)
                  const colors = statusColor[unitStatus]

                  return (
                    <Chip
                      key={unitAnalysis.unit}
                      label={`Unit ${unitAnalysis.unit}`}
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
              Unit {unitAnalysis.unit} analysis
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
            Unit text
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
  compliance?: string
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
    compliance: typeof overall.compliance === 'string' ? overall.compliance : undefined,
    summary: typeof overall.summary === 'string' ? overall.summary : undefined,
  }
}

function getUnitAnalysisStatus(analysis: unknown): ComplianceStatus {
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
            Affected units: {row.affected_units.join(', ')}
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

type SentenceContainerProps = {
  complianceStatus: UnitComplianceStatus
  index: number
  isGeneratingTriples: boolean
  isLocked: boolean
  isSelected: boolean
  originalText: string
  triples?: unknown
  unit: AttestationUnit
  unitAnalysis?: UnitComplianceAnalysis
  onChange: (index: number, value: string) => void
  onOpenUnitAnalysis: (unitAnalysis: UnitComplianceAnalysis) => void
  onRemove: (index: number) => void
  onSelect: (index: number, event: MouseEvent<HTMLElement>) => void
  onToggleLock: (index: number) => void
}

function SentenceContainer({
  complianceStatus,
  index,
  isGeneratingTriples,
  isLocked,
  isSelected,
  originalText,
  triples,
  unit,
  unitAnalysis,
  onChange,
  onOpenUnitAnalysis,
  onRemove,
  onSelect,
  onToggleLock,
}: SentenceContainerProps) {
  const [activeDataView, setActiveDataView] = useState<UnitDataView>('attestation')
  const isAttestationView = activeDataView === 'attestation'

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
        <Tooltip title={isLocked ? 'Unlock unit' : 'Lock unit'}>
          <IconButton
            aria-label={isLocked ? `Unlock unit ${index + 1}` : `Lock unit ${index + 1}`}
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
        <Tooltip title="Remove unit">
          <IconButton
            aria-label={`Remove unit ${index + 1}`}
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
          aria-label={`Unit ${index + 1}`}
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
  const content = getUnitDataPanelContent(activeView, originalText, unitAnalysis, isGeneratingTriples)

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
      ) : content}
    </Box>
  )
}

function getUnitDataPanelContent(
  activeView: UnitDataView,
  originalText: string,
  unitAnalysis?: UnitComplianceAnalysis,
  isGeneratingTriples = false,
) {
  if (activeView === 'original-text') {
    return originalText || 'No original text was captured for this unit.'
  }

  if (activeView === 'key-elements') {
    const keyElementsAssessment = getUnitPrincipleAssessments(unitAnalysis?.analysis)
      .find((assessment) => assessment.principle === 'A2')

    return keyElementsAssessment?.issue_identified
      || keyElementsAssessment?.explanation
      || 'No key attestation elements analysis is available for this unit yet.'
  }

  if (activeView === 'triples') {
    if (isGeneratingTriples) {
      return 'Generating triples for this unit...'
    }

    return ''
  }

  return ''
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
      <ComplianceStatusBadge
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

function ComplianceStatusBadge({
  onClick,
  status,
}: {
  onClick?: () => void
  status: UnitComplianceStatus
}) {
  if (!status) {
    return null
  }

  const colors = status === 'Analyzing' ? analyzingStatusColor : statusColor[status]
  const label = status === 'Partially Compliant' ? 'Partial' : status

  return (
    <Chip
      label={(
        <Stack alignItems="center" direction="row" spacing={0.75}>
          {status === 'Analyzing' && <CircularProgress size={11} sx={{ color: colors.color }} />}
          <span>{label}</span>
        </Stack>
      )}
      onClick={onClick ? (event) => {
        event.stopPropagation()
        onClick()
      } : undefined}
      size="small"
      sx={{
        bgcolor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        fontSize: 12,
        fontWeight: 800,
        height: 22,
        cursor: onClick ? 'pointer' : 'default',
        '& .MuiChip-label': {
          px: 0.8,
        },
        '&:hover': onClick ? {
          boxShadow: '0 0 0 2px rgba(36, 87, 197, 0.12)',
        } : undefined,
      }}
    />
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
