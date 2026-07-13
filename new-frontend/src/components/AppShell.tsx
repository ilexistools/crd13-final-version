import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined'
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import ContentPasteOutlinedIcon from '@mui/icons-material/ContentPasteOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import RedoOutlinedIcon from '@mui/icons-material/RedoOutlined'
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined'
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import {
  Alert,
  AppBar,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { ChangeEvent, MouseEvent, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SentenceCanvasPage, type EditorView } from '../pages/SentenceCanvasPage'
import { splitIntoSentences } from '../lib/sentences'
import {
  ComplianceReport,
  type AttestationCorrectionResult,
  type AttestationChangeApplicationResult,
  type AttestationRewritePlanResult,
  type AttestationSectionReference,
  type ComplianceStatus,
  type UnitComplianceAnalysis,
  type UnitComplianceStatus,
  type UnitTriples,
  analyzeAttestationSections,
  applyAttestationChanges,
  extractPdfText,
  planAttestationRewriteChanges,
  suggestAttestationCorrection,
  unitizeText,
} from '../lib/api'
import { commodityOptions } from '../assets/commodities'
import { adaptAttestationTemplate } from '../lib/templates/api'
import { getTemplates } from '../lib/templates/catalog'
import { createAttestationUnit, createTemplateGuidedUnit, cloneUnits, type AttestationUnit } from '../lib/editorUnits'
import { createInitialTemplateState, parseTemplate, renderTemplateItem } from '../lib/templates/parser'
import type { TemplateEditorState, TemplateItem, TemplateToken } from '../lib/templates/types'

const topBarHeight = 58
const sideBarWidth = 96
const secondarySideBarWidth = 340

type AppShellProps = {
  analysisProgress: null | {
    completed: number
    total: number
  }
  analyzingUnitNumbers: number[]
  commodities: string[]
  complianceReport: ComplianceReport | null
  generatingTripleUnitNumbers: number[]
  initialSentences: string[]
  isAnalyzingCompliance: boolean
  isGeneratingTriples: boolean
  onAnalyzeUnits: (units: Array<{ text: string; unit: number }>) => Promise<void>
  onCommoditiesChange: (commodities: string[]) => void
  onGenerateTriplesForUnits: (units: Array<{ text: string; unit: number }>) => Promise<void>
  onUnitsStructureChange: () => void
  triplesProgress: null | {
    completed: number
    total: number
  }
  unitAnalyses: UnitComplianceAnalysis[]
  unitTriples: UnitTriples[]
}

type EditorSnapshot = {
  lockedIndexes: number[]
  units: AttestationUnit[]
}

type EditorViewDefinition = {
  id: EditorView
  label: string
  isLoading?: boolean
}

type TemplateFeedback = {
  severity: 'error' | 'info' | 'success' | 'warning'
  message: string
} | null

type RewriteUnitDraft = {
  application?: AttestationChangeApplicationResult
  index: number
  original: string
  plan?: AttestationRewritePlanResult
  rewritten?: string
  sections: AttestationSectionReference[]
  selectedChangeKeys: string[]
  selectedSectionKeys: string[]
}

type AdjustFeedback = {
  severity: 'error' | 'info' | 'success' | 'warning'
  message: string
} | null

export function AppShell({
  analysisProgress,
  analyzingUnitNumbers,
  commodities,
  complianceReport,
  generatingTripleUnitNumbers,
  initialSentences,
  isAnalyzingCompliance,
  isGeneratingTriples,
  onAnalyzeUnits,
  onCommoditiesChange,
  onGenerateTriplesForUnits,
  onUnitsStructureChange,
  triplesProgress,
  unitAnalyses,
  unitTriples,
}: AppShellProps) {
  const [fileMenuAnchor, setFileMenuAnchor] = useState<null | HTMLElement>(null)
  const [units, setUnits] = useState<AttestationUnit[]>(() => initialSentences.map((sentence) => createAttestationUnit(sentence)))
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [lockedIndexes, setLockedIndexes] = useState<Set<number>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([])
  const [pendingRemoval, setPendingRemoval] = useState<null | { type: 'single'; index: number } | { type: 'selected' }>(null)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [activeToolPanel, setActiveToolPanel] = useState<null | 'adjust' | 'commodities' | 'templates' | 'rewrite'>(null)
  const [activeView, setActiveView] = useState<EditorView>('units')
  const [commodityInput, setCommodityInput] = useState('')
  const [templates, setTemplates] = useState<TemplateItem[]>(() => getTemplates().items)
  const [templateBusyIndexes, setTemplateBusyIndexes] = useState<Set<number>>(new Set())
  const [templateEditorUnitIndex, setTemplateEditorUnitIndex] = useState<number | null>(null)
  const [templateFeedback, setTemplateFeedback] = useState<TemplateFeedback>(null)
  const [unitizingIndexes, setUnitizingIndexes] = useState<Set<number>>(new Set())
  const [unitizationProgress, setUnitizationProgress] = useState<null | { completed: number; total: number }>(null)
  const [rewriteBusyIndexes, setRewriteBusyIndexes] = useState<Set<number>>(new Set())
  const [rewriteBusyLabel, setRewriteBusyLabel] = useState('Rewriting')
  const [rewriteFeedback, setRewriteFeedback] = useState<TemplateFeedback>(null)
  const [rewriteDrafts, setRewriteDrafts] = useState<RewriteUnitDraft[]>([])
  const [adjustBusyIndex, setAdjustBusyIndex] = useState<number | null>(null)
  const [adjustFeedback, setAdjustFeedback] = useState<AdjustFeedback>(null)
  const [adjustResult, setAdjustResult] = useState<null | { index: number; original: string; result: AttestationCorrectionResult }>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const sentences = useMemo(() => units.map((unit) => unit.text), [units])
  const selectedIndexList = useMemo(() => [...selectedIndexes].sort((left, right) => left - right), [selectedIndexes])
  const activeTemplateEditIndex = selectedIndexList.length === 1 ? selectedIndexList[0] : null
  const activeTemplateEditUnit = activeTemplateEditIndex !== null ? units[activeTemplateEditIndex] ?? null : null
  const activeAdjustIndex = selectedIndexList.length === 1 && !lockedIndexes.has(selectedIndexList[0])
    ? selectedIndexList[0]
    : null
  const activeAdjustUnit = activeAdjustIndex !== null ? units[activeAdjustIndex] ?? null : null
  const activeAdjustAnalysis = activeAdjustIndex !== null
    ? unitAnalyses.find((unitAnalysis) => unitAnalysis.unit === activeAdjustIndex + 1)?.analysis
    : undefined
  const templateEditorUnit = templateEditorUnitIndex !== null ? units[templateEditorUnitIndex] ?? null : null

  const fileMenuOpen = Boolean(fileMenuAnchor)
  const activeToolProgress = unitizationProgress
    ? { ...unitizationProgress, color: '#11b6c8', label: 'Unitizing' }
    : rewriteBusyIndexes.size > 0
      ? { completed: 0, total: rewriteBusyIndexes.size, color: '#16a34a', label: rewriteBusyLabel }
    : triplesProgress
      ? { ...triplesProgress, color: '#6b5cff', label: 'Generating triples' }
    : analysisProgress
      ? { ...analysisProgress, color: '#4353ff', label: 'Analyzing' }
      : null
  const activeToolProgressValue = activeToolProgress
    ? Math.round((activeToolProgress.completed / activeToolProgress.total) * 100)
    : 0

  useEffect(() => {
    setUnits(initialSentences.map((sentence) => createAttestationUnit(sentence)))
    setSelectedIndexes(new Set())
    setLockedIndexes(new Set())
    setLastSelectedIndex(null)
    setUndoStack([])
    setRedoStack([])
    setActiveView('units')
  }, [initialSentences])

  useEffect(() => {
    if (isAnalyzingCompliance && analyzingUnitNumbers.length !== 1) {
      setActiveView('compliance')
    }
  }, [analyzingUnitNumbers.length, isAnalyzingCompliance])

  const editorViews: EditorViewDefinition[] = [
    { id: 'units', label: 'Units' },
    { id: 'compliance', label: 'Compliance', isLoading: isAnalyzingCompliance },
  ]

  const unitComplianceStatuses = useMemo<UnitComplianceStatus[]>(() => {
    if (!complianceReport) {
      return sentences.map((_, index) => analyzingUnitNumbers.includes(index + 1) ? 'Analyzing' : null)
    }

    const statusesByUnit = new Map<number, ComplianceStatus>()

    complianceReport.unit_summaries?.forEach((unitSummary) => {
      statusesByUnit.set(unitSummary.unit, unitSummary.status)
    })

    complianceReport.rows.forEach((row) => {
      row.affected_units.forEach((unit) => {
        const currentStatus = statusesByUnit.get(unit)

        if (row.status === 'Non-Compliant' || currentStatus !== 'Non-Compliant') {
          statusesByUnit.set(unit, row.status)
        }
      })
    })

    return sentences.map((_, index) => {
      const unit = index + 1

      if (analyzingUnitNumbers.includes(unit)) {
        return 'Analyzing'
      }

      return statusesByUnit.get(unit) ?? 'Compliant'
    })
  }, [analyzingUnitNumbers, complianceReport, sentences])

  const createSnapshot = useCallback((): EditorSnapshot => ({
    lockedIndexes: [...lockedIndexes],
    units: cloneUnits(units),
  }), [lockedIndexes, units])

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setUnits(cloneUnits(snapshot.units))
    setLockedIndexes(new Set(snapshot.lockedIndexes))
    setSelectedIndexes(new Set())
    setLastSelectedIndex(null)
  }, [])

  const recordHistory = () => {
    setUndoStack((currentUndoStack) => [...currentUndoStack, createSnapshot()])
    setRedoStack([])
  }

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) {
      return
    }

    const previousSnapshot = undoStack[undoStack.length - 1]

    setUndoStack((currentUndoStack) => currentUndoStack.slice(0, -1))
    setRedoStack((currentRedoStack) => [...currentRedoStack, createSnapshot()])
    restoreSnapshot(previousSnapshot)
  }, [createSnapshot, restoreSnapshot, undoStack])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) {
      return
    }

    const nextSnapshot = redoStack[redoStack.length - 1]

    setRedoStack((currentRedoStack) => currentRedoStack.slice(0, -1))
    setUndoStack((currentUndoStack) => [...currentUndoStack, createSnapshot()])
    restoreSnapshot(nextSnapshot)
  }, [createSnapshot, redoStack, restoreSnapshot])

  useEffect(() => {
    const handleKeyboardUndoRedo = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey

      if (!isModifierPressed || event.key.toLowerCase() !== 'z') {
        if (isModifierPressed && event.key.toLowerCase() === 'y') {
          event.preventDefault()
          handleRedo()
        }

        return
      }

      event.preventDefault()

      if (event.shiftKey) {
        handleRedo()
      } else {
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyboardUndoRedo)

    return () => {
      window.removeEventListener('keydown', handleKeyboardUndoRedo)
    }
  }, [handleRedo, handleUndo])

  const closeFileMenu = () => {
    setFileMenuAnchor(null)
  }

  const appendTextAsUnits = (text: string) => {
    const nextSentences = splitIntoSentences(text)

    if (nextSentences.length > 0) {
      const insertionStart = units.length
      const insertedIndexes = nextSentences.map((_, offset) => insertionStart + offset)

      recordHistory()
      setUnits((currentUnits) => [
        ...currentUnits,
        ...nextSentences.map((sentence) => createAttestationUnit(sentence)),
      ])
      setSelectedIndexes(new Set(insertedIndexes))
      setLastSelectedIndex(insertedIndexes[insertedIndexes.length - 1] ?? null)
      setActiveView('units')
      onUnitsStructureChange()
    }
  }

  const handleImportClick = () => {
    closeFileMenu()
    fileInputRef.current?.click()
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      window.alert('Import accepts PDF files only.')
      return
    }

    appendTextAsUnits(await extractPdfText(file))
  }

  const handlePaste = async () => {
    closeFileMenu()

    const clipboardText = await navigator.clipboard.readText()
    appendTextAsUnits(clipboardText)
  }

  const handleExport = () => {
    closeFileMenu()

    const exportedAt = new Date()
    const exportText = formatAttestationsExport({
      commodities,
      exportedAt,
      triples: unitTriples,
      units,
    })
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `requirements_full_processing_${exportedAt.getTime()}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleSentenceChange = (index: number, value: string) => {
    if (lockedIndexes.has(index)) {
      return
    }

    if (sentences[index] === value) {
      return
    }

    recordHistory()
    setUnits((currentUnits) =>
      currentUnits.map((unit, unitIndex) =>
        unitIndex === index
          ? { ...unit, templateMode: 'free_text', templateId: undefined, templateSnapshot: undefined, templateState: undefined, text: value }
          : unit,
      ),
    )
  }

  const handleAddSentence = () => {
    recordHistory()
    setUnits((currentUnits) => [...currentUnits, createAttestationUnit('')])
  }

  const handleSelectSentence = (index: number, event: MouseEvent<HTMLElement>) => {
    setSelectedIndexes((currentSelection) => {
      const nextSelection = new Set(currentSelection)

      if (event.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)

        for (let sentenceIndex = start; sentenceIndex <= end; sentenceIndex += 1) {
          nextSelection.add(sentenceIndex)
        }

        return nextSelection
      }

      if (event.metaKey || event.ctrlKey) {
        if (nextSelection.has(index)) {
          nextSelection.delete(index)
        } else {
          nextSelection.add(index)
        }

        setLastSelectedIndex(index)
        return nextSelection
      }

      setLastSelectedIndex(index)
      return new Set([index])
    })
  }

  const handleClearSelection = () => {
    setSelectedIndexes(new Set())
    setLastSelectedIndex(null)
  }

  const handleSelectAll = () => {
    setSelectedIndexes(new Set(sentences.map((_, index) => index)))
    setLastSelectedIndex(sentences.length > 0 ? sentences.length - 1 : null)
  }

  const removeSentence = (index: number) => {
    if (lockedIndexes.has(index)) {
      return
    }

    setUnits((currentUnits) =>
      currentUnits.filter((_, unitIndex) => unitIndex !== index),
    )
    setSelectedIndexes((currentSelection) => {
      const nextSelection = new Set<number>()

      currentSelection.forEach((selectedIndex) => {
        if (selectedIndex < index) {
          nextSelection.add(selectedIndex)
        }

        if (selectedIndex > index) {
          nextSelection.add(selectedIndex - 1)
        }
      })

      return nextSelection
    })
    setLockedIndexes((currentLockedIndexes) => {
      const nextLockedIndexes = new Set<number>()

      currentLockedIndexes.forEach((lockedIndex) => {
        if (lockedIndex < index) {
          nextLockedIndexes.add(lockedIndex)
        }

        if (lockedIndex > index) {
          nextLockedIndexes.add(lockedIndex - 1)
        }
      })

      return nextLockedIndexes
    })
    setLastSelectedIndex(null)
  }

  const removeSelected = () => {
    setUnits((currentUnits) =>
      currentUnits.filter(
        (_, unitIndex) =>
          !selectedIndexes.has(unitIndex) || lockedIndexes.has(unitIndex),
      ),
    )
    setLockedIndexes((currentLockedIndexes) => {
      const nextLockedIndexes = new Set<number>()
      let removedBefore = 0

      sentences.forEach((_, sentenceIndex) => {
        const shouldRemove = selectedIndexes.has(sentenceIndex) && !lockedIndexes.has(sentenceIndex)

        if (shouldRemove) {
          removedBefore += 1
          return
        }

        if (currentLockedIndexes.has(sentenceIndex)) {
          nextLockedIndexes.add(sentenceIndex - removedBefore)
        }
      })

      return nextLockedIndexes
    })
    handleClearSelection()
  }

  const handleRequestRemoveSentence = (index: number) => {
    if (lockedIndexes.has(index)) {
      return
    }

    setPendingRemoval({ type: 'single', index })
  }

  const handleRequestRemoveSelected = () => {
    const removableSelectedCount = [...selectedIndexes].filter((index) => !lockedIndexes.has(index)).length

    if (removableSelectedCount === 0) {
      return
    }

    setPendingRemoval({ type: 'selected' })
  }

  const handleConfirmRemoval = () => {
    if (!pendingRemoval) {
      return
    }

    recordHistory()

    if (pendingRemoval.type === 'single') {
      removeSentence(pendingRemoval.index)
    } else {
      removeSelected()
    }

    setPendingRemoval(null)
  }

  const handleCancelRemoval = () => {
    setPendingRemoval(null)
  }

  const handleRequestExitEditor = () => {
    setIsExitDialogOpen(true)
  }

  const handleConfirmExitEditor = () => {
    setIsExitDialogOpen(false)
    navigate('/')
  }

  const handleToggleLockSentence = (index: number) => {
    recordHistory()
    setLockedIndexes((currentLockedIndexes) => {
      const nextLockedIndexes = new Set(currentLockedIndexes)

      if (nextLockedIndexes.has(index)) {
        nextLockedIndexes.delete(index)
      } else {
        nextLockedIndexes.add(index)
      }

      return nextLockedIndexes
    })
  }

  const handleFileMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    setFileMenuAnchor(event.currentTarget)
  }

  const addCommodity = (value = commodityInput) => {
    const nextCommodity = value.trim()

    if (!nextCommodity || commodities.includes(nextCommodity)) {
      setCommodityInput('')
      return
    }

    onCommoditiesChange([...commodities, nextCommodity])
    setCommodityInput('')
  }

  const handleCommodityKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addCommodity()
    }
  }

  const removeCommodity = (commodity: string) => {
    onCommoditiesChange(commodities.filter((item) => item !== commodity))
  }

  const applyTemplateToUnit = (unit: AttestationUnit, template: TemplateItem): AttestationUnit => {
    const state = createInitialTemplateState(template)
    if (template.structural_template.trim() === '*<sentence>' && unit.text.trim()) {
      state.values.sentence = unit.text
    }

    return {
      ...unit,
      originalText: unit.originalText || unit.text,
      templateId: template.id,
      templateMode: 'template_guided',
      templateSnapshot: template,
      templateState: state,
      text: renderTemplateItem(template, state) || unit.text,
    }
  }

  const handleApplyTemplateToSelected = (template: TemplateItem) => {
    const selectedEditableIndexes = [...selectedIndexes].filter((index) => !lockedIndexes.has(index))
    if (selectedEditableIndexes.length === 0) {
      return
    }

    recordHistory()
    setUnits((currentUnits) =>
      currentUnits.map((unit, index) =>
        selectedEditableIndexes.includes(index) ? applyTemplateToUnit(unit, template) : unit,
      ),
    )
    onUnitsStructureChange()
  }

  const handleAddTemplateUnit = (template: TemplateItem) => {
    recordHistory()
    setUnits((currentUnits) => [...currentUnits, createTemplateGuidedUnit(template)])
    setSelectedIndexes(new Set([units.length]))
    setLastSelectedIndex(units.length)
    onUnitsStructureChange()
  }

  const handleSuggestTemplatesForSelected = async () => {
    const selectedEditableIndexes = [...selectedIndexes]
      .filter((index) => !lockedIndexes.has(index) && units[index]?.text.trim())
      .sort((left, right) => left - right)

    if (templateBusyIndexes.size > 0) {
      return
    }

    if (selectedEditableIndexes.length === 0) {
      setTemplateFeedback({
        severity: 'warning',
        message: 'Select at least one unlocked unit with attestation text before suggesting a template.',
      })
      return
    }

    setTemplateFeedback(null)
    setTemplateBusyIndexes(new Set(selectedEditableIndexes))

    try {
      const adaptations = await Promise.all(
        selectedEditableIndexes.map(async (index) => ({
          adaptation: await adaptAttestationTemplate(units[index]?.text ?? ''),
          index,
        })),
      )

      recordHistory()
      setUnits((currentUnits) => {
        const nextUnits = [...currentUnits]

        adaptations.forEach(({ adaptation, index }) => {
          const currentUnit = nextUnits[index]
          if (!currentUnit) {
            return
          }

          const template = adaptation.template
          const state = createInitialTemplateState(template)
          nextUnits[index] = {
            ...currentUnit,
            originalText: currentUnit.originalText || adaptation.sentence || currentUnit.text,
            templateId: template.id,
            templateMode: 'template_guided',
            templateSnapshot: template,
            templateState: state,
            text: renderTemplateItem(template, state) || currentUnit.text,
          }
        })

        return nextUnits
      })

      setTemplates((currentTemplates) => {
        const byId = new Map(currentTemplates.map((template) => [template.id, template]))
        adaptations.forEach(({ adaptation }) => {
          byId.set(adaptation.template.id, adaptation.template)
        })
        return [...byId.values()]
      })
      setTemplateFeedback({
        severity: 'success',
        message: selectedEditableIndexes.length === 1
          ? 'Template suggestion applied to the selected unit.'
          : `Template suggestions applied to ${selectedEditableIndexes.length} units.`,
      })
      onUnitsStructureChange()
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'The template suggestion request failed.'
      setTemplateFeedback({
        severity: 'error',
        message: `Could not suggest a template. ${message}`,
      })
    } finally {
      setTemplateBusyIndexes(new Set())
    }
  }

  const handleUnitTemplateStateChange = (index: number, state: TemplateEditorState) => {
    const unit = units[index]
    if (!unit?.templateSnapshot || lockedIndexes.has(index)) {
      return
    }

    recordHistory()
    setUnits((currentUnits) =>
      currentUnits.map((currentUnit, unitIndex) =>
        unitIndex === index && currentUnit.templateSnapshot
          ? {
              ...currentUnit,
              templateState: state,
              text: renderTemplateItem(currentUnit.templateSnapshot, state),
            }
          : currentUnit,
      ),
    )
    onUnitsStructureChange()
  }

  const handleAnalyzeSelectedUnits = () => {
    if (selectedIndexes.size === 0 || isAnalyzingCompliance) {
      return
    }

    const unitsToAnalyze = [...selectedIndexes]
      .sort((left, right) => left - right)
      .map((selectedIndex) => ({
        text: sentences[selectedIndex] ?? '',
        unit: selectedIndex + 1,
      }))

    void onAnalyzeUnits(unitsToAnalyze)
  }

  const handleGenerateTriplesForSelectedUnits = () => {
    if (selectedIndexes.size === 0 || isGeneratingTriples) {
      return
    }

    const unitsToGenerate = [...selectedIndexes]
      .sort((left, right) => left - right)
      .map((selectedIndex) => ({
        text: sentences[selectedIndex] ?? '',
        unit: selectedIndex + 1,
      }))

    void onGenerateTriplesForUnits(unitsToGenerate)
    setActiveView('units')
  }

  const handleUnitizeSelectedUnits = async () => {
    if (selectedIndexes.size === 0 || unitizingIndexes.size > 0) {
      return
    }

    const selectedIndexesToUnitize = [...selectedIndexes]
      .filter((selectedIndex) => !lockedIndexes.has(selectedIndex) && (sentences[selectedIndex] ?? '').trim())
      .sort((left, right) => left - right)

    if (selectedIndexesToUnitize.length === 0) {
      return
    }

    setUnitizingIndexes(new Set(selectedIndexesToUnitize))
    setUnitizationProgress({ completed: 0, total: selectedIndexesToUnitize.length })

    try {
      const unitizationResults = await Promise.all(
        selectedIndexesToUnitize.map(async (selectedIndex) => {
          try {
            return {
              selectedIndex,
              units: (await unitizeText(sentences[selectedIndex] ?? '')).filter((unit) => unit.trim()),
            }
          } finally {
            setUnitizationProgress((currentProgress) => currentProgress
              ? { ...currentProgress, completed: Math.min(currentProgress.completed + 1, currentProgress.total) }
              : currentProgress)
          }
        }),
      )
      const replacements = new Map(
        unitizationResults
          .filter(({ units }) => units.length > 0)
          .map(({ selectedIndex, units }) => [selectedIndex, units]),
      )

      if (replacements.size === 0) {
        return
      }

      recordHistory()

      const replaceUnits = (currentUnits: AttestationUnit[]) =>
        currentUnits.flatMap((unit, unitIndex) =>
          replacements.get(unitIndex)?.map((text) => createAttestationUnit(text)) ?? [unit],
        )

      setUnits(replaceUnits)
      setLockedIndexes((currentLockedIndexes) => {
        const nextLockedIndexes = new Set<number>()
        let offset = 0

        units.forEach((_, unitIndex) => {
          const replacementUnits = replacements.get(unitIndex)

          if (currentLockedIndexes.has(unitIndex) && !replacementUnits) {
            nextLockedIndexes.add(unitIndex + offset)
          }

          if (replacementUnits) {
            offset += replacementUnits.length - 1
          }
        })

        return nextLockedIndexes
      })

      const nextSelectedIndexes = new Set<number>()
      let offset = 0

      units.forEach((_, unitIndex) => {
        const replacementUnits = replacements.get(unitIndex)

        if (replacementUnits) {
          replacementUnits.forEach((__, replacementIndex) => {
            nextSelectedIndexes.add(unitIndex + offset + replacementIndex)
          })
          offset += replacementUnits.length - 1
          return
        }

        if (selectedIndexes.has(unitIndex)) {
          nextSelectedIndexes.add(unitIndex + offset)
        }
      })

      setSelectedIndexes(nextSelectedIndexes)
      setLastSelectedIndex(nextSelectedIndexes.size > 0 ? Math.max(...nextSelectedIndexes) : null)
      setActiveView('units')
      onUnitsStructureChange()
    } finally {
      setUnitizingIndexes(new Set())
      setUnitizationProgress(null)
    }
  }

  const selectedRewriteIndexes = useMemo(
    () => selectedIndexList.filter((index) => !lockedIndexes.has(index) && (sentences[index] ?? '').trim()),
    [lockedIndexes, selectedIndexList, sentences],
  )

  const sectionKey = (section: AttestationSectionReference) =>
    `${section.doc_id ?? 'doc'}:${section.section_id ?? 'section'}:${section.section ?? ''}`

  const changeKey = (unitIndex: number, changeIndex: number) => `${unitIndex}:${changeIndex}`

  const handleSuggestRewriteSections = async () => {
    if (rewriteBusyIndexes.size > 0) {
      return
    }

    if (selectedRewriteIndexes.length === 0) {
      setRewriteFeedback({
        severity: 'warning',
        message: 'Select at least one unlocked unit with attestation text.',
      })
      return
    }

    if (commodities.length === 0) {
      setRewriteFeedback({
        severity: 'warning',
        message: 'Add at least one commodity before rewriting.',
      })
      return
    }

    setRewriteBusyIndexes(new Set(selectedRewriteIndexes))
    setRewriteBusyLabel('Finding sections')
    setRewriteFeedback(null)
    setRewriteDrafts([])

    try {
      const drafts = await Promise.all(
        selectedRewriteIndexes.map(async (index) => {
          const original = sentences[index] ?? ''
          const sections = await analyzeAttestationSections(original, commodities)
          return {
            index,
            original,
            sections,
            selectedChangeKeys: [],
            selectedSectionKeys: sections.map(sectionKey),
          }
        }),
      )

      setRewriteDrafts(drafts)
      setRewriteFeedback({
        severity: 'success',
        message: drafts.length === 1
          ? 'Reference sections are ready for review.'
          : `Reference sections are ready for ${drafts.length} units.`,
      })
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'The rewrite request failed.'
      setRewriteFeedback({
        severity: 'error',
        message: `Could not suggest sections. ${message}`,
      })
    } finally {
      setRewriteBusyIndexes(new Set())
    }
  }

  const handleToggleRewriteSection = (unitIndex: number, key: string) => {
    setRewriteDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.index !== unitIndex) {
          return draft
        }

        const selectedKeys = new Set(draft.selectedSectionKeys)
        if (selectedKeys.has(key)) {
          selectedKeys.delete(key)
        } else {
          selectedKeys.add(key)
        }

        return {
          ...draft,
          application: undefined,
          plan: undefined,
          rewritten: undefined,
          selectedChangeKeys: [],
          selectedSectionKeys: [...selectedKeys],
        }
      }),
    )
  }

  const handlePlanRewriteChanges = async () => {
    const draftsToPlan = rewriteDrafts.filter((draft) => draft.selectedSectionKeys.length > 0)

    if (rewriteBusyIndexes.size > 0 || draftsToPlan.length === 0) {
      setRewriteFeedback({
        severity: 'warning',
        message: 'Select at least one reference section before planning changes.',
      })
      return
    }

    setRewriteBusyIndexes(new Set(draftsToPlan.map((draft) => draft.index)))
    setRewriteBusyLabel('Planning changes')
    setRewriteFeedback(null)

    try {
      const plannedDrafts = await Promise.all(
        draftsToPlan.map(async (draft) => {
          const selectedSections = draft.sections.filter((section) => draft.selectedSectionKeys.includes(sectionKey(section)))
          const plan = await planAttestationRewriteChanges(draft.original, selectedSections)
          const changes = Array.isArray(plan.changes) ? plan.changes : []

          return {
            ...draft,
            application: undefined,
            plan,
            rewritten: undefined,
            selectedChangeKeys: changes.map((_, changeIndex) => changeKey(draft.index, changeIndex)),
          }
        }),
      )
      const byIndex = new Map(plannedDrafts.map((draft) => [draft.index, draft]))

      setRewriteDrafts((currentDrafts) => currentDrafts.map((draft) => byIndex.get(draft.index) ?? draft))
      setRewriteFeedback({
        severity: 'success',
        message: plannedDrafts.length === 1
          ? 'Change plan is ready for review.'
          : `Change plans are ready for ${plannedDrafts.length} units.`,
      })
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'The change planning request failed.'
      setRewriteFeedback({
        severity: 'error',
        message: `Could not plan changes. ${message}`,
      })
    } finally {
      setRewriteBusyIndexes(new Set())
    }
  }

  const handleToggleRewriteChange = (unitIndex: number, key: string) => {
    setRewriteDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.index !== unitIndex) {
          return draft
        }

        const selectedKeys = new Set(draft.selectedChangeKeys)
        if (selectedKeys.has(key)) {
          selectedKeys.delete(key)
        } else {
          selectedKeys.add(key)
        }

        return {
          ...draft,
          application: undefined,
          rewritten: undefined,
          selectedChangeKeys: [...selectedKeys],
        }
      }),
    )
  }

  const handleApplySelectedRewriteChanges = async () => {
    const draftsToApply = rewriteDrafts.filter((draft) => draft.plan)

    if (rewriteBusyIndexes.size > 0 || draftsToApply.length === 0) {
      setRewriteFeedback({
        severity: 'warning',
        message: 'Plan changes before applying them.',
      })
      return
    }

    setRewriteBusyIndexes(new Set(draftsToApply.map((draft) => draft.index)))
    setRewriteBusyLabel('Applying changes')
    setRewriteFeedback(null)

    try {
      const appliedDrafts = await Promise.all(
        draftsToApply.map(async (draft) => {
          const changes = draft.plan?.changes ?? []
          const selectedChanges = changes.filter((_, changeIndex) =>
            draft.selectedChangeKeys.includes(changeKey(draft.index, changeIndex)),
          )
          const application = selectedChanges.length > 0
            ? await applyAttestationChanges(draft.original, selectedChanges)
            : {
                decision: draft.plan?.decision === 'insufficient_basis' ? 'insufficient_basis' : 'unchanged',
                rewritten_attestation: draft.original,
                applied_changes: [],
                notes: ['No planned changes were selected.'],
              }

          return {
            ...draft,
            application,
            rewritten: String(application.rewritten_attestation || draft.original).trim(),
          }
        }),
      )
      const byIndex = new Map(appliedDrafts.map((draft) => [draft.index, draft]))

      setRewriteDrafts((currentDrafts) => currentDrafts.map((draft) => byIndex.get(draft.index) ?? draft))
      setRewriteFeedback({
        severity: 'success',
        message: appliedDrafts.length === 1
          ? 'Applied changes are ready for final review.'
          : `Applied changes are ready for ${appliedDrafts.length} units.`,
      })
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'The change application request failed.'
      setRewriteFeedback({
        severity: 'error',
        message: `Could not apply changes. ${message}`,
      })
    } finally {
      setRewriteBusyIndexes(new Set())
    }
  }

  const handleApplyRewriteResults = () => {
    const rewritesByIndex = new Map(
      rewriteDrafts
        .filter((draft) => draft.rewritten && draft.rewritten !== draft.original && !lockedIndexes.has(draft.index))
        .map((draft) => [draft.index, draft.rewritten as string]),
    )

    if (rewritesByIndex.size === 0) {
      setRewriteFeedback({
        severity: 'info',
        message: 'There are no changed rewrite results to apply.',
      })
      return
    }

    recordHistory()
    setUnits((currentUnits) =>
      currentUnits.map((unit, index) => {
        const rewritten = rewritesByIndex.get(index)

        if (!rewritten) {
          return unit
        }

        return {
          ...unit,
          originalText: unit.originalText || unit.text,
          templateId: undefined,
          templateMode: 'free_text',
          templateSnapshot: undefined,
          templateState: undefined,
          text: rewritten,
        }
      }),
    )
    setRewriteFeedback({
      severity: 'success',
      message: rewritesByIndex.size === 1 ? 'Rewrite applied to the selected unit.' : `Rewrites applied to ${rewritesByIndex.size} units.`,
    })
    onUnitsStructureChange()
  }

  const handleSuggestAdjustment = async () => {
    if (activeAdjustIndex === null || !activeAdjustUnit?.text.trim() || adjustBusyIndex !== null) {
      setAdjustFeedback({
        severity: 'warning',
        message: 'Select one unlocked unit with attestation text before adjusting.',
      })
      return
    }

    setAdjustBusyIndex(activeAdjustIndex)
    setAdjustFeedback(null)
    setAdjustResult(null)

    try {
      const result = await suggestAttestationCorrection(
        activeAdjustUnit.text,
        activeAdjustAnalysis,
      )
      setAdjustResult({
        index: activeAdjustIndex,
        original: activeAdjustUnit.text,
        result,
      })
      setAdjustFeedback({
        severity: result.decision === 'corrected' ? 'success' : 'info',
        message: result.decision === 'corrected'
          ? 'Adjustment suggestion is ready for review.'
          : 'No safe adjustment was suggested for this unit.',
      })
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'The adjustment request failed.'
      setAdjustFeedback({
        severity: 'error',
        message: `Could not suggest adjustment. ${message}`,
      })
    } finally {
      setAdjustBusyIndex(null)
    }
  }

  const handleApplyAdjustment = () => {
    if (!adjustResult || adjustResult.result.decision !== 'corrected') {
      setAdjustFeedback({
        severity: 'info',
        message: 'There is no corrected text to apply.',
      })
      return
    }

    const correctedUnits = adjustResult.result.correction_mode === 'unitized_attestations'
      ? (adjustResult.result.corrected_units || []).map((unit) => String(unit).trim()).filter(Boolean)
      : []
    const correctedText = correctedUnits.length > 0
      ? correctedUnits.join('\n')
      : String(adjustResult.result.corrected_attestation || '').trim()

    if (!correctedText || correctedText === adjustResult.original || lockedIndexes.has(adjustResult.index)) {
      setAdjustFeedback({
        severity: 'info',
        message: 'There is no changed adjustment to apply.',
      })
      return
    }

    recordHistory()
    if (correctedUnits.length > 0) {
      setUnits((currentUnits) =>
        currentUnits.flatMap((unit, index) =>
          index === adjustResult.index
            ? correctedUnits.map((text, unitOffset) =>
                createAttestationUnit(text, {
                  originalText: unitOffset === 0 ? unit.originalText || unit.text : unit.text,
                }),
              )
            : [unit],
        ),
      )
      setSelectedIndexes(new Set(correctedUnits.map((_, offset) => adjustResult.index + offset)))
      setLastSelectedIndex(adjustResult.index + correctedUnits.length - 1)
      setLockedIndexes((currentLockedIndexes) => {
        const nextLockedIndexes = new Set<number>()
        currentLockedIndexes.forEach((lockedIndex) => {
          if (lockedIndex < adjustResult.index) {
            nextLockedIndexes.add(lockedIndex)
          } else if (lockedIndex > adjustResult.index) {
            nextLockedIndexes.add(lockedIndex + correctedUnits.length - 1)
          }
        })
        return nextLockedIndexes
      })
    } else {
      setUnits((currentUnits) =>
        currentUnits.map((unit, index) =>
          index === adjustResult.index
            ? {
                ...unit,
                originalText: unit.originalText || unit.text,
                templateId: undefined,
                templateMode: 'free_text',
                templateSnapshot: undefined,
                templateState: undefined,
                text: correctedText,
              }
            : unit,
        ),
      )
    }
    setAdjustFeedback({
      severity: 'success',
      message: correctedUnits.length > 0
        ? `Adjustment applied as ${correctedUnits.length} unitized units.`
        : 'Adjustment applied to the selected unit.',
    })
    onUnitsStructureChange()
  }

  const sidebarItems = [
    {
      icon: <CloudUploadOutlinedIcon />,
      label: 'Import',
      onClick: handleImportClick,
    },
    {
      icon: <ContentPasteOutlinedIcon />,
      label: 'Paste',
      onClick: handlePaste,
    },
    {
      disabled: units.length === 0,
      icon: <FileDownloadOutlinedIcon />,
      label: 'Export',
      onClick: handleExport,
    },
    {
      icon: <CategoryOutlinedIcon />,
      label: 'Commodities',
      onClick: () => setActiveToolPanel((currentPanel) => currentPanel === 'commodities' ? null : 'commodities'),
      selected: activeToolPanel === 'commodities',
    },
    {
      disabled: selectedIndexes.size === 0 || isAnalyzingCompliance,
      icon: <FactCheckOutlinedIcon />,
      label: 'Analysis',
      onClick: handleAnalyzeSelectedUnits,
    },
    {
      disabled: activeAdjustIndex === null || adjustBusyIndex !== null,
      icon: <AutoFixHighOutlinedIcon />,
      label: 'Adjust',
      onClick: () => setActiveToolPanel((currentPanel) => currentPanel === 'adjust' ? null : 'adjust'),
      selected: activeToolPanel === 'adjust',
    },
    {
      disabled: selectedIndexes.size === 0 || unitizingIndexes.size > 0,
      icon: <CallSplitOutlinedIcon />,
      label: 'Unitization',
      onClick: handleUnitizeSelectedUnits,
      selected: activeView === 'units',
    },
    {
      icon: <TextSnippetOutlinedIcon />,
      label: 'Templates',
      onClick: () => setActiveToolPanel((currentPanel) => currentPanel === 'templates' ? null : 'templates'),
      selected: activeToolPanel === 'templates',
    },
    {
      disabled: selectedIndexes.size === 0 || rewriteBusyIndexes.size > 0,
      icon: <EditNoteOutlinedIcon />,
      label: 'Rewrite',
      onClick: () => setActiveToolPanel((currentPanel) => currentPanel === 'rewrite' ? null : 'rewrite'),
      selected: activeToolPanel === 'rewrite',
    },
    {
      disabled: selectedIndexes.size === 0 || isGeneratingTriples,
      icon: <SchemaOutlinedIcon />,
      label: 'Triples',
      onClick: handleGenerateTriplesForSelectedUnits,
    },
  ]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f1f3f8' }}>
      <AppBar
        elevation={0}
        position="fixed"
        sx={{
          bgcolor: '#ffffff',
          borderBottom: '1px solid #dde2ea',
          color: '#172033',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: topBarHeight, px: 2 }}>
          <Box
            aria-label="CRD13 Studio"
            onClick={handleRequestExitEditor}
            sx={{
              alignItems: 'center',
              bgcolor: '#11b6c8',
              borderRadius: 1.5,
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              height: 34,
              justifyContent: 'center',
              width: 34,
            }}
          >
            <HomeOutlinedIcon fontSize="small" />
          </Box>
          <Button
            aria-controls={fileMenuOpen ? 'file-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={fileMenuOpen ? 'true' : undefined}
            color="inherit"
            onClick={handleFileMenuClick}
            sx={{ fontWeight: 700, minWidth: 0, px: 1.5 }}
          >
            File
          </Button>
          <Menu
            anchorEl={fileMenuAnchor}
            id="file-menu"
            onClose={closeFileMenu}
            open={fileMenuOpen}
          >
            <MenuItem onClick={handleImportClick}>Import</MenuItem>
            <MenuItem onClick={handlePaste}>Paste</MenuItem>
            <MenuItem disabled={units.length === 0} onClick={handleExport}>Export</MenuItem>
          </Menu>
          <Tooltip title="Undo">
            <span>
              <IconButton
                aria-label="Undo"
                disabled={undoStack.length === 0}
                onClick={handleUndo}
                size="small"
              >
                <UndoOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                aria-label="Redo"
                disabled={redoStack.length === 0}
                onClick={handleRedo}
                size="small"
              >
                <RedoOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <input
            accept=".pdf,application/pdf"
            hidden
            onChange={handleImport}
            ref={fileInputRef}
            type="file"
          />
          <EditorViewTabs
            activeView={activeView}
            onChange={setActiveView}
            views={editorViews}
          />
        </Toolbar>
      </AppBar>

      {activeToolProgress && (
        <Box
          aria-live="polite"
          sx={{
            bgcolor: '#ffffff',
            borderBottom: '1px solid #dde2ea',
            left: activeToolPanel
              ? `${sideBarWidth + secondarySideBarWidth}px`
              : `${sideBarWidth}px`,
            position: 'fixed',
            right: 0,
            top: `${topBarHeight}px`,
            transition: 'left 160ms ease',
            zIndex: (theme) => theme.zIndex.drawer,
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 3, py: 1 }}>
            <Box sx={{ flex: 1, minWidth: 120 }}>
              <LinearProgress
                aria-label={`${activeToolProgress.label} progress`}
                value={activeToolProgressValue}
                variant="determinate"
                sx={{
                  bgcolor: '#e4e9f2',
                  borderRadius: 999,
                  height: 6,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: activeToolProgress.color,
                    borderRadius: 999,
                  },
                }}
              />
            </Box>
            <Typography sx={{ color: '#5f6675', fontSize: 13, fontWeight: 800, minWidth: 104, textAlign: 'right' }}>
              {activeToolProgress.label} {activeToolProgress.completed}/{activeToolProgress.total}
            </Typography>
          </Stack>
        </Box>
      )}

      <Box
        component="aside"
        sx={{
          bgcolor: '#f7f8fb',
          borderRight: '1px solid #dde2ea',
          bottom: 0,
          left: 0,
          overflowY: 'auto',
          position: 'fixed',
          pt: `${topBarHeight}px`,
          top: 0,
          width: sideBarWidth,
        }}
      >
        <List disablePadding sx={{ py: 1 }}>
          {sidebarItems.map((item) => (
            <ListItemButton
              disabled={item.disabled ?? false}
              key={item.label}
              onClick={item.onClick}
              selected={item.selected ?? false}
              sx={{
                alignItems: 'center',
                borderRadius: 1,
                color: '#5f6675',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                justifyContent: 'center',
                mx: 1,
                my: 0.5,
                minHeight: 74,
                px: 0.75,
                textAlign: 'center',
                '&.Mui-selected': {
                  bgcolor: '#e9edf5',
                  color: '#172033',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', justifyContent: 'center', minWidth: 0 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
                sx={{ m: 0 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {activeToolPanel === 'commodities' && (
        <CommoditiesSidePanel
          commodities={commodities}
          commodityInput={commodityInput}
          onAddCommodity={addCommodity}
          onClose={() => setActiveToolPanel(null)}
          onCommodityInputChange={setCommodityInput}
          onCommodityKeyDown={handleCommodityKeyDown}
          onRemoveCommodity={removeCommodity}
        />
      )}

      {activeToolPanel === 'templates' && (
        <TemplatesSidePanel
          isSuggesting={templateBusyIndexes.size > 0}
          activeTemplateEditIndex={activeTemplateEditIndex}
          activeTemplateEditUnit={activeTemplateEditUnit}
          onClose={() => setActiveToolPanel(null)}
          onAddTemplateUnit={handleAddTemplateUnit}
          onApplyTemplateToSelected={handleApplyTemplateToSelected}
          onOpenTemplateEditor={setTemplateEditorUnitIndex}
          onSuggestTemplatesForSelected={handleSuggestTemplatesForSelected}
          selectedCount={[...selectedIndexes].filter((index) => !lockedIndexes.has(index)).length}
          templateFeedback={templateFeedback}
          templates={templates}
        />
      )}

      {activeToolPanel === 'adjust' && (
        <AdjustSidePanel
          activeIndex={activeAdjustIndex}
          analysis={activeAdjustAnalysis}
          feedback={adjustFeedback}
          isAdjusting={adjustBusyIndex !== null}
          onApply={handleApplyAdjustment}
          onClose={() => setActiveToolPanel(null)}
          onSuggest={handleSuggestAdjustment}
          result={adjustResult}
          unit={activeAdjustUnit}
        />
      )}

      {activeToolPanel === 'rewrite' && (
        <RewriteSidePanel
          commodities={commodities}
          isRewriting={rewriteBusyIndexes.size > 0}
          onClose={() => setActiveToolPanel(null)}
          onApplySelectedChanges={handleApplySelectedRewriteChanges}
          onApplyResults={handleApplyRewriteResults}
          onPlanChanges={handlePlanRewriteChanges}
          onSuggestSections={handleSuggestRewriteSections}
          onToggleChange={handleToggleRewriteChange}
          onToggleSection={handleToggleRewriteSection}
          drafts={rewriteDrafts}
          rewriteFeedback={rewriteFeedback}
          selectedCount={selectedRewriteIndexes.length}
        />
      )}

      <Box
        component="main"
        sx={{
          ml: activeToolPanel
            ? `${sideBarWidth + secondarySideBarWidth}px`
            : `${sideBarWidth}px`,
          minHeight: '100vh',
          pt: `${topBarHeight}px`,
          transition: 'margin-left 160ms ease',
        }}
      >
        <SentenceCanvasPage
          activeView={activeView}
          commodities={commodities}
          complianceReport={complianceReport}
          isAnalyzingCompliance={isAnalyzingCompliance}
          onAddSentence={handleAddSentence}
          onClearSelection={handleClearSelection}
          onRemoveSelected={handleRequestRemoveSelected}
          onRemoveSentence={handleRequestRemoveSentence}
          onSelectAll={handleSelectAll}
          onSelectSentence={handleSelectSentence}
          onSentenceChange={handleSentenceChange}
          onToggleLockSentence={handleToggleLockSentence}
          lockedIndexes={lockedIndexes}
          selectedIndexes={selectedIndexes}
          units={units}
          generatingTripleUnitNumbers={generatingTripleUnitNumbers}
          unitAnalyses={unitAnalyses}
          unitComplianceStatuses={unitComplianceStatuses}
          unitTriples={unitTriples}
        />
      </Box>
      <Dialog
        aria-describedby="remove-unit-dialog-description"
        aria-labelledby="remove-unit-dialog-title"
        onClose={handleCancelRemoval}
        open={pendingRemoval !== null}
      >
        <DialogTitle id="remove-unit-dialog-title">
          Remove {pendingRemoval?.type === 'selected' ? 'selected units' : 'unit'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="remove-unit-dialog-description">
            This action cannot be undone. Locked units will be preserved.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRemoval}>Cancel</Button>
          <Button color="error" onClick={handleConfirmRemoval} variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        fullWidth
        maxWidth="lg"
        onClose={() => setTemplateEditorUnitIndex(null)}
        open={Boolean(templateEditorUnit?.templateSnapshot && templateEditorUnit.templateState)}
      >
        <DialogTitle>
          Edit template fields
          {templateEditorUnitIndex !== null ? ` · Unit ${templateEditorUnitIndex + 1}` : ''}
        </DialogTitle>
        <DialogContent>
          {templateEditorUnitIndex !== null && templateEditorUnit?.templateSnapshot && templateEditorUnit.templateState && (
            <TemplateUnitEditor
              layout="modal"
              onChange={(state) => handleUnitTemplateStateChange(templateEditorUnitIndex, state)}
              state={templateEditorUnit.templateState}
              template={templateEditorUnit.templateSnapshot}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateEditorUnitIndex(null)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        aria-describedby="exit-editor-dialog-description"
        aria-labelledby="exit-editor-dialog-title"
        onClose={() => setIsExitDialogOpen(false)}
        open={isExitDialogOpen}
      >
        <DialogTitle id="exit-editor-dialog-title">Leave editor?</DialogTitle>
        <DialogContent>
          <DialogContentText id="exit-editor-dialog-description">
            You will return to the start screen. Unsaved edits in this editor session may be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsExitDialogOpen(false)}>Stay</Button>
          <Button color="primary" onClick={handleConfirmExitEditor} variant="contained">
            Leave editor
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

type TemplatesSidePanelProps = {
  activeTemplateEditIndex: number | null
  activeTemplateEditUnit: AttestationUnit | null
  isSuggesting: boolean
  selectedCount: number
  templateFeedback: TemplateFeedback
  templates: TemplateItem[]
  onAddTemplateUnit: (template: TemplateItem) => void
  onApplyTemplateToSelected: (template: TemplateItem) => void
  onClose: () => void
  onOpenTemplateEditor: (index: number) => void
  onSuggestTemplatesForSelected: () => void
}

type AdjustSidePanelProps = {
  activeIndex: number | null
  analysis: unknown
  feedback: AdjustFeedback
  isAdjusting: boolean
  result: null | { index: number; original: string; result: AttestationCorrectionResult }
  unit: AttestationUnit | null
  onApply: () => void
  onClose: () => void
  onSuggest: () => void
}

function AdjustSidePanel({
  activeIndex,
  analysis,
  feedback,
  isAdjusting,
  result,
  unit,
  onApply,
  onClose,
  onSuggest,
}: AdjustSidePanelProps) {
  const principleIssues = extractPrincipleIssues(analysis)
  const correctedUnits = result?.result.correction_mode === 'unitized_attestations'
    ? (result.result.corrected_units || []).map((unit) => String(unit).trim()).filter(Boolean)
    : []
  const correctedText = correctedUnits.length > 0
    ? correctedUnits.join('\n')
    : result?.result.corrected_attestation?.trim() || ''
  const canApply = result?.result.decision === 'corrected' && correctedText && correctedText !== result.original

  return (
    <Box
      component="aside"
      sx={{
        bgcolor: '#ffffff',
        borderRight: '1px solid #dde2ea',
        bottom: 0,
        boxShadow: '18px 0 32px rgba(33, 42, 66, 0.06)',
        left: `${sideBarWidth}px`,
        overflowY: 'auto',
        position: 'fixed',
        pt: `${topBarHeight}px`,
        scrollPaddingBottom: '88px',
        top: 0,
        width: secondarySideBarWidth,
        zIndex: 2,
      }}
    >
      <Stack spacing={2} sx={{ p: 2, pb: '88px' }}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 900 }}>
              Adjust
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.25 }}>
              Suggest a compliance-focused correction.
            </Typography>
          </Box>
          <Tooltip title="Close panel">
            <IconButton aria-label="Close adjust panel" onClick={onClose} size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {feedback && (
          <Alert severity={feedback.severity} sx={{ fontSize: 12 }}>
            {feedback.message}
          </Alert>
        )}

        <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e3e9f2', p: 1.5 }}>
          <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900, mb: 0.75 }}>
            Selected unit
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
            {activeIndex === null ? 'Select one unlocked unit.' : `Unit ${activeIndex + 1}`}
          </Typography>
          <Typography sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.4, mt: 0.75 }}>
            {unit?.text || 'No attestation text available.'}
          </Typography>
        </Box>

        <Box>
          <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900, mb: 1 }}>
            Principles needing attention
          </Typography>
          {principleIssues.length === 0 ? (
            <Typography sx={{ color: '#64748b', fontSize: 12 }}>
              No analyzed non-compliant principles found. The API will analyze the unit if needed.
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {principleIssues.map((issue) => (
                <Box key={issue.principle} sx={{ border: '1px solid #e3e9f2', p: 1 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 900 }}>
                    {issue.principle} · {issue.compliance}
                  </Typography>
                  <Typography sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.35, mt: 0.25 }}>
                    {issue.issue_identified || issue.explanation || 'Issue identified.'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Button
          disabled={isAdjusting || activeIndex === null || !unit?.text.trim()}
          onClick={onSuggest}
          startIcon={isAdjusting ? <CircularProgress size={16} /> : <AutoFixHighOutlinedIcon />}
          variant="contained"
        >
          {isAdjusting ? 'Adjusting...' : 'Suggest adjustment'}
        </Button>

        {result && (
          <Box sx={{ border: '1px solid #dfe6f2', p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography sx={{ fontSize: 12, fontWeight: 900 }}>
                {correctedUnits.length > 0 ? 'Suggested unitization' : 'Suggested text'}
              </Typography>
              <Chip label={result.result.correction_mode || result.result.decision || 'review'} size="small" />
            </Stack>
            {correctedUnits.length > 0 ? (
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {correctedUnits.map((unitText, unitIndex) => (
                  <Box key={`${unitText}-${unitIndex}`} sx={{ bgcolor: '#f8fafc', border: '1px solid #e3e9f2', p: 1 }}>
                    <Typography sx={{ color: '#5f6675', fontSize: 11, fontWeight: 900 }}>
                      Unit {unitIndex + 1}
                    </Typography>
                    <Typography sx={{ color: '#172033', fontSize: 13, fontWeight: 800, lineHeight: 1.45, mt: 0.25 }}>
                      {unitText}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ color: '#172033', fontSize: 13, fontWeight: 800, lineHeight: 1.45, mt: 1 }}>
                {correctedText || result.original}
              </Typography>
            )}
            {(result.result.applied_principles?.length ?? 0) > 0 && (
              <Typography sx={{ color: '#5f6675', fontSize: 12, mt: 1 }}>
                Principles: {result.result.applied_principles?.join(', ')}
              </Typography>
            )}
            {(result.result.correction_notes?.length ?? 0) > 0 && (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {result.result.correction_notes?.map((note, index) => (
                  <Typography key={`${note}-${index}`} sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.35 }}>
                    {note}
                  </Typography>
                ))}
              </Stack>
            )}
          </Box>
        )}

        <Button
          disabled={!canApply}
          onClick={onApply}
          variant="outlined"
        >
          Apply adjustment
        </Button>
      </Stack>
    </Box>
  )
}

function extractPrincipleIssues(analysis: unknown): Array<{
  compliance?: string
  explanation?: string
  issue_identified?: string
  principle?: string
}> {
  const payload = analysis && typeof analysis === 'object' ? analysis as any : {}
  const results = payload?.results ?? payload?.output?.results ?? payload
  const assessments = Array.isArray(results?.principle_assessments) ? results.principle_assessments : []
  return assessments.filter((item: any) =>
    item && ['Partially Compliant', 'Non-Compliant'].includes(String(item.compliance || '')),
  )
}

function TemplatesSidePanel({
  activeTemplateEditIndex,
  activeTemplateEditUnit,
  isSuggesting,
  selectedCount,
  templateFeedback,
  templates,
  onAddTemplateUnit,
  onApplyTemplateToSelected,
  onClose,
  onOpenTemplateEditor,
  onSuggestTemplatesForSelected,
}: TemplatesSidePanelProps) {
  const [query, setQuery] = useState('')
  const [activeTemplatePanelTab, setActiveTemplatePanelTab] = useState<'current' | 'catalog'>('current')
  const [selectedModality, setSelectedModality] = useState('all')
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '')

  const modalities = useMemo(() => {
    const values = templates
      .map((template) => template.modality)
      .filter((value) => value && value !== 'undefined')
    return ['all', ...Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))]
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return templates.filter((template) => {
      const modalityMatches = selectedModality === 'all' || template.modality === selectedModality
      const queryMatches = !normalizedQuery || [
        template.id,
        template.category,
        template.modality,
        template.communicative_function,
        template.representative_example,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))

      return modalityMatches && queryMatches
    })
  }, [query, selectedModality, templates])

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || filteredTemplates[0] || templates[0]

  useEffect(() => {
    if (!selectedTemplateId && templates[0]) {
      setSelectedTemplateId(templates[0].id)
      return
    }

    if (selectedTemplateId && !templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0]?.id || '')
    }
  }, [selectedTemplateId, templates])

  const hasCurrentUnit = activeTemplateEditIndex !== null && Boolean(activeTemplateEditUnit)
  const currentUnitHasTemplate = Boolean(activeTemplateEditUnit?.templateSnapshot && activeTemplateEditUnit.templateState)

  return (
    <Box
      component="aside"
      sx={{
        bgcolor: '#ffffff',
        borderRight: '1px solid #dde2ea',
        bottom: 0,
        boxShadow: '18px 0 32px rgba(33, 42, 66, 0.06)',
        left: `${sideBarWidth}px`,
        overflowY: 'auto',
        position: 'fixed',
        pt: `${topBarHeight}px`,
        scrollPaddingBottom: '88px',
        top: 0,
        width: secondarySideBarWidth,
        zIndex: 2,
      }}
    >
      <Stack spacing={2} sx={{ p: 2, pb: '88px' }}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 900 }}>
              Templates
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.25 }}>
              Structure selected units or create a guided unit.
            </Typography>
          </Box>
          <Tooltip title="Close panel">
            <IconButton aria-label="Close templates panel" onClick={onClose} size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Tabs
          onChange={(_, value: 'current' | 'catalog') => setActiveTemplatePanelTab(value)}
          value={activeTemplatePanelTab}
          variant="fullWidth"
          sx={{
            minHeight: 38,
            '& .MuiTab-root': {
              fontSize: 12,
              fontWeight: 900,
              minHeight: 38,
              textTransform: 'none',
            },
          }}
        >
          <Tab label="Current unit" value="current" />
          <Tab label="Catalog" value="catalog" />
        </Tabs>

        {templateFeedback && (
          <Alert severity={templateFeedback.severity} sx={{ fontSize: 12 }}>
            {templateFeedback.message}
          </Alert>
        )}

        {activeTemplatePanelTab === 'current' ? (
          <Stack spacing={1.5}>
            {!hasCurrentUnit && (
              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid #e3e9f2',
                  color: '#64748b',
                  fontSize: 13,
                  lineHeight: 1.45,
                  p: 1.5,
                }}
              >
                Select one unit to edit its template fields.
              </Box>
            )}

            {hasCurrentUnit && activeTemplateEditIndex !== null && (
              <Box
                sx={{
                  bgcolor: '#ffffff',
                  border: '1px solid #dfe6f2',
                  p: 1.5,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 900 }}>
                  Unit {activeTemplateEditIndex + 1}
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12, lineHeight: 1.4, mt: 0.5 }}>
                  {currentUnitHasTemplate
                    ? activeTemplateEditUnit?.templateSnapshot?.communicative_function || activeTemplateEditUnit?.templateSnapshot?.id
                    : 'No template is assigned to this unit.'}
                </Typography>

                {currentUnitHasTemplate ? (
                  <Button
                    fullWidth
                    onClick={() => onOpenTemplateEditor(activeTemplateEditIndex)}
                    size="small"
                    sx={{ mt: 1.25 }}
                    startIcon={<EditNoteOutlinedIcon />}
                    variant="contained"
                  >
                    Edit fields
                  </Button>
                ) : (
                  <Stack spacing={1} sx={{ mt: 1.25 }}>
                    <Button
                      disabled={isSuggesting}
                      fullWidth
                      onClick={onSuggestTemplatesForSelected}
                      size="small"
                      startIcon={isSuggesting ? <CircularProgress size={16} /> : <TextSnippetOutlinedIcon />}
                      variant="contained"
                    >
                      {isSuggesting ? 'Suggesting...' : 'Suggest template'}
                    </Button>
                    <Button
                      fullWidth
                      onClick={() => setActiveTemplatePanelTab('catalog')}
                      size="small"
                      variant="outlined"
                    >
                      Choose manually
                    </Button>
                  </Stack>
                )}
              </Box>
            )}

            <Button
              disabled={isSuggesting}
              onClick={onSuggestTemplatesForSelected}
              startIcon={isSuggesting ? <CircularProgress size={16} /> : <TextSnippetOutlinedIcon />}
              variant="outlined"
            >
              {isSuggesting ? 'Suggesting...' : `Suggest for selected (${selectedCount})`}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="Search templates"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Modality, function, example"
              size="small"
              value={query}
            />

            <TextField
              label="Modality"
              onChange={(event) => setSelectedModality(event.target.value)}
              select
              size="small"
              value={selectedModality}
            >
              {modalities.map((modality) => (
                <MenuItem key={modality} value={modality}>
                  {modality === 'all' ? 'All modalities' : modality}
                </MenuItem>
              ))}
            </TextField>

            {selectedTemplate && (
              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid #e3e9f2',
                  p: 1.5,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 900, mb: 0.75 }}>
                  Selected template
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                  {selectedTemplate.communicative_function || selectedTemplate.id}
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
                  {selectedTemplate.representative_example}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Button
                    disabled={selectedCount === 0}
                    fullWidth
                    onClick={() => onApplyTemplateToSelected(selectedTemplate)}
                    size="small"
                    variant="outlined"
                  >
                    Apply
                  </Button>
                  <Button
                    fullWidth
                    onClick={() => onAddTemplateUnit(selectedTemplate)}
                    size="small"
                    startIcon={<AddOutlinedIcon />}
                    variant="contained"
                  >
                    Add
                  </Button>
                </Stack>
              </Box>
            )}

            <Box>
              <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900, mb: 1 }}>
                Catalog
              </Typography>
              <Stack spacing={1}>
                {filteredTemplates.slice(0, 36).map((template) => {
                  const isSelected = template.id === selectedTemplate?.id

                  return (
                    <Button
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      sx={{
                        alignItems: 'flex-start',
                        border: '1px solid',
                        borderColor: isSelected ? '#2457c5' : '#e1e6ef',
                        bgcolor: isSelected ? '#f1f5ff' : '#ffffff',
                        color: '#172033',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        p: 1.25,
                        textAlign: 'left',
                        textTransform: 'none',
                      }}
                      variant="outlined"
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 900 }}>
                        {template.modality || 'Unclassified'}
                      </Typography>
                      <Typography sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.35 }}>
                        {template.communicative_function || template.category || template.id}
                      </Typography>
                      <Typography sx={{ color: '#7c8494', fontSize: 11, lineHeight: 1.35 }}>
                        {template.structural_template}
                      </Typography>
                    </Button>
                  )
                })}
              </Stack>
            </Box>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}

function TemplateUnitEditor({
  layout = 'side',
  state,
  template,
  onChange,
}: {
  layout?: 'side' | 'modal'
  state: TemplateEditorState
  template: TemplateItem
  onChange: (state: TemplateEditorState) => void
}) {
  const tokens = parseTemplate(template.structural_template)
  const rendered = renderTemplateItem(template, state)
  const renderedComponents = new Set<string>()

  const updateComponent = (name: string, value: string) => {
    onChange({
      ...state,
      values: {
        ...state.values,
        [name]: value,
      },
    })
  }

  const updateChoice = (id: string, value: string) => {
    onChange({
      ...state,
      choices: {
        ...state.choices,
        [id]: value,
      },
    })
  }

  const renderControlsInReadingOrder = (items: TemplateToken[]): JSX.Element[] => {
    return items.flatMap((token) => {
      if (token.type === 'component') {
        if (renderedComponents.has(token.name)) {
          return []
        }
        renderedComponents.add(token.name)
        const metadata = Object.values(template.components).find((item) => item.label === token.name)

        return [
          <TextField
            helperText={metadata?.description || (token.required ? 'Required component' : 'Optional component')}
            key={`component-${token.name}`}
            label={token.name}
            multiline
            onChange={(event) => updateComponent(token.name, event.target.value)}
            size="small"
            value={state.values[token.name] || ''}
          />,
        ]
      }

      if (token.type === 'choice') {
        return [
          <TextField
            key={`choice-${token.id}`}
            label="Choice"
            onChange={(event) => updateChoice(token.id, event.target.value)}
            select
            size="small"
            value={state.choices[token.id] || token.options[0] || ''}
          >
            {token.options.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>,
        ]
      }

      if (token.type === 'optional') {
        return renderControlsInReadingOrder(token.children)
      }

      return []
    })
  }

  return (
    <Box
      sx={{
        bgcolor: '#ffffff',
        border: layout === 'modal' ? 0 : '1px solid #dfe6f2',
        p: layout === 'modal' ? 0 : 1.5,
      }}
    >
      <Typography sx={{ color: '#64748b', fontSize: 13, fontWeight: 800, lineHeight: 1.35, mb: 2 }}>
        {template.structural_template}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: layout === 'modal' ? { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } : '1fr',
        }}
      >
        {renderControlsInReadingOrder(tokens)}
      </Box>

      <Box
        sx={{
          bgcolor: '#f8fafc',
          border: '1px solid #e3e9f2',
          color: '#172033',
          fontSize: layout === 'modal' ? 17 : 13,
          fontWeight: 800,
          lineHeight: 1.45,
          mt: 2,
          p: layout === 'modal' ? 2 : 1.25,
        }}
      >
        {rendered || 'Fill template components to render the attestation.'}
      </Box>
    </Box>
  )
}

type RewriteSidePanelProps = {
  commodities: string[]
  drafts: RewriteUnitDraft[]
  isRewriting: boolean
  rewriteFeedback: TemplateFeedback
  selectedCount: number
  onApplySelectedChanges: () => void
  onApplyResults: () => void
  onClose: () => void
  onPlanChanges: () => void
  onSuggestSections: () => void
  onToggleChange: (unitIndex: number, key: string) => void
  onToggleSection: (unitIndex: number, key: string) => void
}

function RewriteSidePanel({
  commodities,
  drafts,
  isRewriting,
  rewriteFeedback,
  selectedCount,
  onApplySelectedChanges,
  onApplyResults,
  onClose,
  onPlanChanges,
  onSuggestSections,
  onToggleChange,
  onToggleSection,
}: RewriteSidePanelProps) {
  const changedResults = drafts.filter((draft) => draft.rewritten && draft.rewritten !== draft.original)
  const hasSections = drafts.some((draft) => draft.sections.length > 0)
  const hasPlans = drafts.some((draft) => draft.plan)
  const hasApplications = drafts.some((draft) => draft.application)
  const selectedSectionCount = drafts.reduce((sum, draft) => sum + draft.selectedSectionKeys.length, 0)

  const formatCategories = (categories: AttestationSectionReference['categories']) => {
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

  const formatPageRange = (section: AttestationSectionReference) => {
    if (!section.start_page && !section.end_page) {
      return 'Pages not available'
    }

    if (section.start_page && section.end_page && section.start_page !== section.end_page) {
      return `Pages ${section.start_page}-${section.end_page}`
    }

    return `Page ${section.start_page || section.end_page}`
  }

  const pdfHref = (section: AttestationSectionReference) => {
    const docId = section.document?.doc_id || section.doc_id
    if (!docId) {
      return ''
    }

    const page = section.start_page || section.end_page
    return `/assets/files/${encodeURIComponent(docId)}.pdf${page ? `#page=${page}` : ''}`
  }

  return (
    <Box
      component="aside"
      sx={{
        bgcolor: '#ffffff',
        borderRight: '1px solid #dde2ea',
        bottom: 0,
        boxShadow: '18px 0 32px rgba(33, 42, 66, 0.06)',
        left: `${sideBarWidth}px`,
        overflowY: 'auto',
        position: 'fixed',
        pt: `${topBarHeight}px`,
        scrollPaddingBottom: '88px',
        top: 0,
        width: secondarySideBarWidth,
        zIndex: 2,
      }}
    >
      <Stack spacing={2} sx={{ p: 2, pb: '88px' }}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 900 }}>
              Rewrite
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.25 }}>
              Section-guided changes for selected units.
            </Typography>
          </Box>
          <Tooltip title="Close panel">
            <IconButton aria-label="Close rewrite panel" onClick={onClose} size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {rewriteFeedback && (
          <Alert severity={rewriteFeedback.severity} sx={{ fontSize: 12 }}>
            {rewriteFeedback.message}
          </Alert>
        )}

        <Box
          sx={{
            bgcolor: '#f8fafc',
            border: '1px solid #e3e9f2',
            p: 1.5,
          }}
        >
          <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900, mb: 1 }}>
            Scope
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
            {selectedCount} selected editable unit{selectedCount === 1 ? '' : 's'}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
            {commodities.length === 0 ? (
              <Typography sx={{ color: '#64748b', fontSize: 12 }}>
                No commodities selected.
              </Typography>
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
        </Box>

        <Button
          disabled={isRewriting || selectedCount === 0 || commodities.length === 0}
          onClick={onSuggestSections}
          startIcon={isRewriting ? <CircularProgress size={16} /> : <EditNoteOutlinedIcon />}
          variant="contained"
        >
          {isRewriting ? 'Working...' : 'Suggest reference sections'}
        </Button>

        <Stack direction="row" spacing={1}>
          <Button
            disabled={isRewriting || !hasSections || selectedSectionCount === 0}
            fullWidth
            onClick={onPlanChanges}
            size="small"
            variant="outlined"
          >
            Plan changes
          </Button>
          <Button
            disabled={isRewriting || !hasPlans}
            fullWidth
            onClick={onApplySelectedChanges}
            size="small"
            variant="outlined"
          >
            Apply selected
          </Button>
        </Stack>

        <Button
          disabled={isRewriting || !hasApplications || changedResults.length === 0}
          onClick={onApplyResults}
          variant="contained"
        >
          Apply to editor ({changedResults.length})
        </Button>

        <Stack spacing={1.25}>
          {drafts.map((draft) => (
            <Box
              key={`${draft.index}-${draft.original}`}
              sx={{
                bgcolor: '#ffffff',
                border: '1px solid #dfe6f2',
                p: 1.5,
              }}
            >
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontSize: 12, fontWeight: 900 }}>
                  Unit {draft.index + 1}
                </Typography>
                <Chip
                  label={draft.application?.decision || draft.plan?.decision || 'sections'}
                  size="small"
                  sx={{ fontSize: 11, fontWeight: 800, height: 22 }}
                />
              </Stack>

              <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, mt: 1.25 }}>
                Original
              </Typography>
              <Typography sx={{ color: '#172033', fontSize: 12, lineHeight: 1.45, mt: 0.25 }}>
                {draft.original}
              </Typography>

              {draft.application && (
                <>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, mt: 1.25 }}>
                    {draft.application.decision === 'rejected_due_to_regression' ? 'Rejected candidate' : 'Applied result'}
                  </Typography>
                  {draft.application.decision === 'rejected_due_to_regression' && (
                    <Alert severity="warning" sx={{ fontSize: 12, my: 1 }}>
                      Rewrite rejected
                      {draft.application.regression_check?.regressed_principles?.length
                        ? `: would regress ${draft.application.regression_check.regressed_principles.join(', ')}.`
                        : ': would regress one or more CRD13 principles.'}
                    </Alert>
                  )}
                  <Typography sx={{ color: '#172033', fontSize: 13, fontWeight: 800, lineHeight: 1.45, mt: 0.25 }}>
                    {draft.application.decision === 'rejected_due_to_regression'
                      ? draft.application.candidate_attestation || draft.rewritten || draft.original
                      : draft.rewritten || draft.original}
                  </Typography>
                </>
              )}

              <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }}>
                <Chip label={`${draft.selectedSectionKeys.length}/${draft.sections.length} sections`} size="small" variant="outlined" />
                <Chip label={`${draft.selectedChangeKeys.length}/${draft.plan?.changes?.length ?? 0} changes`} size="small" variant="outlined" />
              </Stack>

              {draft.sections.length > 0 && (
                <Box sx={{ mt: 1.25 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, mb: 0.5 }}>
                    Reference sections
                  </Typography>
                  <Stack spacing={0.75}>
                    {draft.sections.map((section, sectionIndex) => {
                      const key = `${section.doc_id ?? 'doc'}:${section.section_id ?? 'section'}:${section.section ?? ''}`
                      const selected = draft.selectedSectionKeys.includes(key)
                      const document = section.document
                      const href = pdfHref(section)
                      return (
                        <Box
                          key={`${key}-${sectionIndex}`}
                          sx={{ bgcolor: selected ? '#f1f5ff' : '#f8fafc', border: '1px solid #e8edf5', p: 1 }}
                        >
                          <Stack alignItems="flex-start" direction="row" spacing={0.75}>
                            <Checkbox
                              checked={selected}
                              onChange={() => onToggleSection(draft.index, key)}
                              size="small"
                              sx={{ p: 0.25 }}
                            />
                            <Box>
                              <Typography sx={{ color: '#2457c5', fontSize: 11, fontWeight: 900, lineHeight: 1.35 }}>
                                {document?.reference || 'Document'} · {document?.year || 'year n/a'}
                              </Typography>
                              <Typography sx={{ fontSize: 12, fontWeight: 900, lineHeight: 1.35 }}>
                                {document?.title || 'Untitled document'}
                              </Typography>
                              <Box
                                sx={{
                                  bgcolor: '#ffffff',
                                  border: '1px solid #e8edf5',
                                  color: '#5f6675',
                                  fontSize: 11,
                                  lineHeight: 1.35,
                                  mt: 0.75,
                                  p: 0.75,
                                }}
                              >
                                <div><strong>title:</strong> {document?.title || 'n/a'}</div>
                                <div><strong>type:</strong> {document?.type || 'n/a'}</div>
                                <div><strong>document_type:</strong> {document?.document_type || 'n/a'}</div>
                                <div><strong>reference:</strong> {document?.reference || 'n/a'}</div>
                                <div><strong>year:</strong> {document?.year || 'n/a'}</div>
                              </Box>
                              <Typography sx={{ color: '#172033', fontSize: 12, fontWeight: 900, lineHeight: 1.35, mt: 1 }}>
                                {section.section || `Section ${section.section_id}`}
                              </Typography>
                              <Typography sx={{ color: '#64748b', fontSize: 11, lineHeight: 1.35, mt: 0.25 }}>
                                {formatCategories(section.categories)} · {formatPageRange(section)}
                              </Typography>
                              <Typography sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.35, mt: 0.25 }}>
                                {section.justification || section.summary}
                              </Typography>
                              {href && (
                                <Button
                                  component="a"
                                  href={href}
                                  rel="noreferrer"
                                  size="small"
                                  sx={{ mt: 0.75, px: 0.75 }}
                                  target="_blank"
                                  variant="text"
                                >
                                  Open PDF at {formatPageRange(section).toLowerCase()}
                                </Button>
                              )}
                            </Box>
                          </Stack>
                        </Box>
                      )
                    })}
                  </Stack>
                </Box>
              )}

              {draft.plan && (
                <Box sx={{ mt: 1.25 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, mb: 0.5 }}>
                    Planned changes
                  </Typography>
                  {(draft.plan.changes?.length ?? 0) === 0 ? (
                    <Typography sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.35 }}>
                      {draft.plan.notes?.join(' ') || 'No changes were recommended.'}
                    </Typography>
                  ) : (
                    <Stack spacing={0.75}>
                      {draft.plan.changes?.map((change, changeIndex) => {
                        const key = `${draft.index}:${changeIndex}`
                        const selected = draft.selectedChangeKeys.includes(key)
                        return (
                      <Box
                        key={`${change.change_type}-${changeIndex}`}
                        sx={{ bgcolor: selected ? '#f1f5ff' : '#f8fafc', border: '1px solid #e8edf5', p: 1 }}
                      >
                        <Stack alignItems="flex-start" direction="row" spacing={0.75}>
                          <Checkbox
                            checked={selected}
                            onChange={() => onToggleChange(draft.index, key)}
                            size="small"
                            sx={{ p: 0.25 }}
                          />
                          <Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 900 }}>
                              {change.change_type || 'change'}
                            </Typography>
                            <Typography sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.35, mt: 0.25 }}>
                              {change.suggested_change || change.rationale || change.target_fragment}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                        )
                      })}
                    </Stack>
                  )}
                </Box>
              )}

              {draft.application && (draft.application.applied_changes?.length ?? 0) > 0 && (
                <Box sx={{ mt: 1.25 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, mb: 0.5 }}>
                    Applied changes
                  </Typography>
                  <Stack spacing={0.75}>
                    {draft.application.applied_changes?.map((change, changeIndex) => (
                      <Typography
                        key={`${change.change_type}-${changeIndex}`}
                        sx={{ color: '#5f6675', fontSize: 12, lineHeight: 1.35 }}
                      >
                        {change.applied_change || change.target_fragment}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}

              {draft.application?.regression_check?.notes?.length ? (
                <Box sx={{ mt: 1.25 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, mb: 0.5 }}>
                    Regression check
                  </Typography>
                  <Stack spacing={0.5}>
                    {draft.application.regression_check.notes.map((note, noteIndex) => (
                      <Typography
                        key={`${note}-${noteIndex}`}
                        sx={{ color: '#9a3412', fontSize: 12, lineHeight: 1.35 }}
                      >
                        {note}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Box>
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}

type CommoditiesSidePanelProps = {
  commodities: string[]
  commodityInput: string
  onAddCommodity: (commodity?: string) => void
  onClose: () => void
  onCommodityInputChange: (value: string) => void
  onCommodityKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  onRemoveCommodity: (commodity: string) => void
}

function CommoditiesSidePanel({
  commodities,
  commodityInput,
  onAddCommodity,
  onClose,
  onCommodityInputChange,
  onCommodityKeyDown,
  onRemoveCommodity,
}: CommoditiesSidePanelProps) {
  return (
    <Box
      component="aside"
      sx={{
        bgcolor: '#ffffff',
        borderRight: '1px solid #dde2ea',
        bottom: 0,
        boxShadow: '18px 0 32px rgba(33, 42, 66, 0.06)',
        left: `${sideBarWidth}px`,
        overflowY: 'auto',
        position: 'fixed',
        pt: `${topBarHeight}px`,
        top: 0,
        width: secondarySideBarWidth,
        zIndex: 2,
      }}
    >
      <Stack spacing={2.25} sx={{ p: 2 }}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 900 }}>
              Commodities
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.25 }}>
              Edit the project scope.
            </Typography>
          </Box>
          <Tooltip title="Close panel">
            <IconButton aria-label="Close commodities panel" onClick={onClose} size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Autocomplete
          freeSolo
          inputValue={commodityInput}
          onChange={(_, value) => {
            if (typeof value === 'string') {
              onAddCommodity(value)
            }
          }}
          onInputChange={(_, value) => onCommodityInputChange(value)}
          options={commodityOptions.filter((commodity) => !commodities.includes(commodity))}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Add commodity"
              onKeyDown={onCommodityKeyDown}
              placeholder="Search commodities"
              size="small"
            />
          )}
          size="small"
        />

        <Button
          disabled={!commodityInput.trim()}
          onClick={() => onAddCommodity()}
          startIcon={<AddOutlinedIcon />}
          variant="outlined"
        >
          Add commodity
        </Button>

        <Box>
          <Typography sx={{ color: '#5f6675', fontSize: 12, fontWeight: 900, mb: 1 }}>
            Selected
          </Typography>
          {commodities.length === 0 ? (
            <Box
              sx={{
                bgcolor: '#f8fafc',
                border: '1px solid #e5eaf2',
                color: '#64748b',
                fontSize: 13,
                lineHeight: 1.45,
                p: 1.5,
              }}
            >
              No commodities selected yet.
            </Box>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {commodities.map((commodity) => (
                <Chip
                  key={commodity}
                  label={commodity}
                  onDelete={() => onRemoveCommodity(commodity)}
                  sx={{
                    bgcolor: '#eef2f8',
                    border: '1px solid #d9e1ef',
                    fontWeight: 700,
                  }}
                  variant="outlined"
                />
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  )
}

type AttestationsExportPayload = {
  commodities: string[]
  exportedAt: Date
  triples: UnitTriples[]
  units: AttestationUnit[]
}

function formatAttestationsExport({
  commodities,
  exportedAt,
  triples,
  units,
}: AttestationsExportPayload) {
  const exportedAtIso = exportedAt.toISOString()

  return units.map((unit, index) => {
    const template = unit.templateSnapshot
    const unitTriples = triples.find((triplePayload) => triplePayload.unit === index + 1)?.triples
    const lines = [
      `Requirement ${index + 1}`,
      `ID: ${unit.id}`,
      `Template ID: ${unit.templateId ?? template?.id ?? 'UND-8f2c3a1b-5d7e-4d2b-9f6a-0b7f3d2b1a9c'}`,
      `Template Type: ${template?.type ?? 'default'}`,
      `Modality: ${formatExportValue(template?.modality)}`,
      `Communicative Function: ${formatExportValue(template?.communicative_function)}`,
      `Structural Template: ${template?.structural_template ?? '*<sentence>'}`,
      `Original Sentence: ${formatExportValue(unit.originalText || unit.text)}`,
      `Generated Sentence: ${formatExportValue(unit.text)}`,
      `Commodity: ${formatExportValue(commodities[0])}`,
      `Commodities: ${commodities.length > 0 ? commodities.join(', ') : 'undefined'}`,
      `Created At: ${exportedAtIso}`,
      `Last Modified: ${exportedAtIso}`,
      'Triples:',
      ...formatExportTriples(unitTriples),
    ]

    return lines.join('\n')
  }).join('\n\n')
}

function formatExportValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (value === null || value === undefined) {
    return 'undefined'
  }

  return String(value)
}

function formatExportTriples(triples: unknown) {
  const results = getExportTriplesResults(triples)

  if (!Array.isArray(results) || results.length === 0) {
    return ['  - (none)']
  }

  return results.flatMap((triple) => {
    const parts = getExportTripleParts(triple)

    if (parts) {
      return [`  - (${parts.subject}, ${parts.predicate}, ${parts.object})`]
    }

    return JSON.stringify(triple, null, 2)
      .split('\n')
      .map((line, lineIndex) => lineIndex === 0 ? `  - ${line}` : `    ${line}`)
  })
}

function getExportTriplesResults(triples: unknown) {
  if (isRecord(triples) && 'results' in triples) {
    return triples.results
  }

  return triples
}

function getExportTripleParts(triple: unknown) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type EditorViewTabsProps = {
  activeView: EditorView
  views: EditorViewDefinition[]
  onChange: (view: EditorView) => void
}

function EditorViewTabs({ activeView, views, onChange }: EditorViewTabsProps) {
  return (
    <Tabs
      onChange={(_, value: EditorView) => onChange(value)}
      value={activeView}
      sx={{
        ml: 1,
        minHeight: 38,
        '& .MuiTab-root': {
          borderRadius: 1,
          color: '#5f6675',
          fontSize: 13,
          fontWeight: 800,
          minHeight: 34,
          minWidth: 0,
          px: 1.5,
          textTransform: 'none',
        },
        '& .Mui-selected': {
          bgcolor: '#eef2f8',
          color: '#172033',
        },
        '& .MuiTabs-indicator': {
          display: 'none',
        },
      }}
    >
      {views.map((view) => (
        <Tab
          key={view.id}
          label={(
            <Stack alignItems="center" direction="row" spacing={0.75}>
              <span>{view.label}</span>
              {view.isLoading && <CircularProgress size={12} />}
            </Stack>
          )}
          value={view.id}
        />
      ))}
    </Tabs>
  )
}
