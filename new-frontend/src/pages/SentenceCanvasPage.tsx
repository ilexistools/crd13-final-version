import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
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
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { ComplianceReport, ComplianceReportRow, apiBaseUrl, type AttestationSectionReference, type ComplianceStatus, type KeyElements, type ProvisionReference, type ReferenceDocument, type UnitComplianceAnalysis, type UnitComplianceStatus, type UnitTriples } from '../lib/api'
import type { AttestationUnit } from '../lib/editorUnits'

export type EditorView = 'units' | 'compliance' | 'references'
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
  unitComplianceStatuses: UnitComplianceStatus[]
  unitTriples: UnitTriples[]
  onAddSentence: () => void
  onClearSelection: () => void
  onRemoveSelected: () => void
  onRemoveSentence: (index: number) => void
  onSelectAll: () => void
  onSelectSentence: (index: number, event: MouseEvent<HTMLElement>) => void
  onSentenceChange: (index: number, value: string) => void
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
  unitComplianceStatuses,
  unitTriples,
  onAddSentence,
  onClearSelection,
  onRemoveSelected,
  onRemoveSentence,
  onSelectAll,
  onSelectSentence,
  onSentenceChange,
  onReferenceQueryChange,
  onSearchReferences,
  onToggleLockSentence,
  onUnitizeSentence,
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
              isUnitizationBusy={unitizingIndexes.size > 0}
              isUnitizing={unitizingIndexes.has(index)}
              originalText={unit.originalText}
              triples={unitTriples.find((unitTriple) => unitTriple.unit === index + 1)?.triples}
              unitAnalysis={unitAnalyses.find((unitAnalysis) => unitAnalysis.unit === index + 1)}
              onChange={onSentenceChange}
              onOpenUnitAnalysis={setSelectedUnitAnalysis}
              onRemove={onRemoveSentence}
              onSelect={onSelectSentence}
              onToggleLock={onToggleLockSentence}
              onUnitize={onUnitizeSentence}
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
  isUnitizationBusy: boolean
  isUnitizing: boolean
  originalText: string
  triples?: unknown
  unit: AttestationUnit
  unitAnalysis?: UnitComplianceAnalysis
  onChange: (index: number, value: string) => void
  onOpenUnitAnalysis: (unitAnalysis: UnitComplianceAnalysis) => void
  onRemove: (index: number) => void
  onSelect: (index: number, event: MouseEvent<HTMLElement>) => void
  onToggleLock: (index: number) => void
  onUnitize: (index: number) => void
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
  onChange,
  onOpenUnitAnalysis,
  onRemove,
  onSelect,
  onToggleLock,
  onUnitize,
}: SentenceContainerProps) {
  const [activeDataView, setActiveDataView] = useState<UnitDataView>('attestation')
  const [isCopied, setIsCopied] = useState(false)
  const isAttestationView = activeDataView === 'attestation'

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
        <Tooltip title="Unitize unit">
          <IconButton
            aria-label={`Unitize unit ${index + 1}`}
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
