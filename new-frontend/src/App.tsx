import { CssBaseline, ThemeProvider } from '@mui/material'
import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { theme } from './app/theme'
import { HomePage } from './pages/HomePage'
import { PrepareProjectPage } from './pages/PrepareProjectPage'
import { splitIntoSentences } from './lib/sentences'
import {
  ComplianceReport,
  UnitComplianceAnalysis,
  UnitTriples,
  analyzeCompliance,
  consolidateComplianceReport,
  extractPdfText,
  generateTriples,
  identifyCommodities,
} from './lib/api'

const defaultEditorUnits = [
  'The consignment was inspected and found to comply with the sanitary requirements agreed by the importing country.',
]

export type ToolProgress = {
  completed: number
  total: number
}

function AppRoutes() {
  const [initialUnits, setInitialUnits] = useState(defaultEditorUnits)
  const [editorCommodities, setEditorCommodities] = useState<string[]>([])
  const [editorComplianceReport, setEditorComplianceReport] = useState<ComplianceReport | null>(null)
  const [editorUnitAnalyses, setEditorUnitAnalyses] = useState<UnitComplianceAnalysis[]>([])
  const [editorUnitTriples, setEditorUnitTriples] = useState<UnitTriples[]>([])
  const [analyzingUnitNumbers, setAnalyzingUnitNumbers] = useState<number[]>([])
  const [generatingTripleUnitNumbers, setGeneratingTripleUnitNumbers] = useState<number[]>([])
  const [analysisProgress, setAnalysisProgress] = useState<ToolProgress | null>(null)
  const [triplesProgress, setTriplesProgress] = useState<ToolProgress | null>(null)
  const [isAnalyzingCompliance, setIsAnalyzingCompliance] = useState(false)
  const [isGeneratingTriples, setIsGeneratingTriples] = useState(false)
  const [prepareText, setPrepareText] = useState('')
  const [prepareCommodities, setPrepareCommodities] = useState<string[]>([])
  const [prepareSourceLabel, setPrepareSourceLabel] = useState('Imported source')
  const [isPreparing, setIsPreparing] = useState(false)
  const navigate = useNavigate()

  const openEditor = (units: string[], commodities: string[] = [], report: ComplianceReport | null = null) => {
    setInitialUnits(units)
    setEditorCommodities(commodities)
    setEditorComplianceReport(report)
    setEditorUnitAnalyses([])
    setEditorUnitTriples([])
    setAnalyzingUnitNumbers([])
    setGeneratingTripleUnitNumbers([])
    setAnalysisProgress(null)
    setTriplesProgress(null)
    navigate('/editor')
  }

  const handleCreateBlankProject = () => {
    openEditor([''])
  }

  const handlePasteTextProject = async () => {
    setIsPreparing(true)
    setPrepareSourceLabel('Clipboard text')
    navigate('/prepare')

    try {
      const text = await navigator.clipboard.readText()
      setPrepareText(text)
      setPrepareCommodities(await identifyCommodities(text))
    } finally {
      setIsPreparing(false)
    }
  }

  const handleIdentifyCommodities = async () => {
    setIsPreparing(true)

    try {
      setPrepareCommodities(await identifyCommodities(prepareText))
    } finally {
      setIsPreparing(false)
    }
  }

  const handleContinueFromPrepare = () => {
    const units = splitIntoSentences(prepareText)

    openEditor(units.length > 0 ? units : [''], prepareCommodities)
    void analyzePreparedUnits(units.length > 0 ? units : [''])
  }

  const analyzePreparedUnits = async (units: string[]) => {
    const validUnits = units
      .map((text, index) => ({ text, unit: index + 1 }))
      .filter(({ text }) => text.trim())

    if (validUnits.length === 0) {
      return
    }

    setIsAnalyzingCompliance(true)
    setEditorUnitAnalyses([])
    setEditorUnitTriples([])
    setAnalyzingUnitNumbers(validUnits.map(({ unit }) => unit))
    setAnalysisProgress({ completed: 0, total: validUnits.length })

    try {
      const unitPayloads = (
        await Promise.all(
          validUnits.map(async ({ text, unit }) => {
            try {
              const [analysis, triples] = await Promise.all([
                analyzeCompliance(text),
                generateTriples(text),
              ])

              return {
                analysis,
                text,
                triples,
                unit,
              }
            } finally {
              setAnalysisProgress((currentProgress) => currentProgress
                ? { ...currentProgress, completed: Math.min(currentProgress.completed + 1, currentProgress.total) }
                : currentProgress)
            }
          }),
        )
      ).filter((unitPayload): unitPayload is UnitComplianceAnalysis & { triples: unknown } => unitPayload !== null)

      const analyses = unitPayloads.map(({ analysis, text, unit }) => ({ analysis, text, unit }))
      const triples = unitPayloads.map(({ triples: unitTriples, unit }) => ({ triples: unitTriples, unit }))

      setEditorUnitAnalyses(analyses)
      setEditorUnitTriples(triples)
      setEditorComplianceReport(await consolidateComplianceReport(analyses))
    } finally {
      setIsAnalyzingCompliance(false)
      setAnalyzingUnitNumbers([])
      setAnalysisProgress(null)
    }
  }

  const handleAnalyzeUnits = async (unitsToAnalyze: Array<{ text: string; unit: number }>) => {
    const validUnits = unitsToAnalyze.filter(({ text }) => text.trim())

    if (validUnits.length === 0) {
      return
    }

    setIsAnalyzingCompliance(true)
    setAnalyzingUnitNumbers(validUnits.map(({ unit }) => unit))
    setAnalysisProgress({ completed: 0, total: validUnits.length })

    try {
      const nextUnitAnalyses = await Promise.all(
        validUnits.map(async ({ text, unit }) => {
          try {
            return {
              analysis: await analyzeCompliance(text),
              text,
              unit,
            }
          } finally {
            setAnalysisProgress((currentProgress) => currentProgress
              ? { ...currentProgress, completed: Math.min(currentProgress.completed + 1, currentProgress.total) }
              : currentProgress)
          }
        }),
      )
      const analyzedUnits = new Set(nextUnitAnalyses.map(({ unit }) => unit))

      const nextAnalyses = [
        ...editorUnitAnalyses.filter((analysis) => !analyzedUnits.has(analysis.unit)),
        ...nextUnitAnalyses,
      ].sort((left, right) => left.unit - right.unit)

      setEditorUnitAnalyses(nextAnalyses)
      setEditorComplianceReport(await consolidateComplianceReport(nextAnalyses))
    } finally {
      setIsAnalyzingCompliance(false)
      setAnalyzingUnitNumbers([])
      setAnalysisProgress(null)
    }
  }

  const handleGenerateTriplesForUnits = async (unitsToGenerate: Array<{ text: string; unit: number }>) => {
    const validUnits = unitsToGenerate.filter(({ text }) => text.trim())

    if (validUnits.length === 0) {
      return
    }

    setIsGeneratingTriples(true)
    setGeneratingTripleUnitNumbers(validUnits.map(({ unit }) => unit))
    setTriplesProgress({ completed: 0, total: validUnits.length })

    try {
      const nextUnitTriples = await Promise.all(
        validUnits.map(async ({ text, unit }) => {
          try {
            return {
              triples: await generateTriples(text),
              unit,
            }
          } finally {
            setTriplesProgress((currentProgress) => currentProgress
              ? { ...currentProgress, completed: Math.min(currentProgress.completed + 1, currentProgress.total) }
              : currentProgress)
          }
        }),
      )
      const generatedUnits = new Set(nextUnitTriples.map(({ unit }) => unit))

      setEditorUnitTriples((currentTriples) => [
        ...currentTriples.filter((unitTriples) => !generatedUnits.has(unitTriples.unit)),
        ...nextUnitTriples,
      ].sort((left, right) => left.unit - right.unit))
    } finally {
      setIsGeneratingTriples(false)
      setGeneratingTripleUnitNumbers([])
      setTriplesProgress(null)
    }
  }

  const handleUnitsStructureChange = () => {
    setEditorComplianceReport(null)
    setEditorUnitAnalyses([])
    setEditorUnitTriples([])
    setAnalyzingUnitNumbers([])
    setGeneratingTripleUnitNumbers([])
    setAnalysisProgress(null)
    setTriplesProgress(null)
  }

  const handleUploadPdfProject = async (file: File) => {
    setIsPreparing(true)
    setPrepareSourceLabel(file.name)
    setPrepareText('')
    setPrepareCommodities([])
    navigate('/prepare')

    try {
      const text = await extractPdfText(file)
      setPrepareText(text)
      setPrepareCommodities(await identifyCommodities(text))
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <Routes>
      <Route
        element={
          <HomePage
            onCreateBlankProject={handleCreateBlankProject}
            onPasteTextProject={handlePasteTextProject}
            onUploadPdfProject={handleUploadPdfProject}
          />
        }
        path="/"
      />
      <Route
        element={
          <PrepareProjectPage
            commodities={prepareCommodities}
            isLoading={isPreparing}
            onBack={() => navigate('/')}
            onCommoditiesChange={setPrepareCommodities}
            onContinue={handleContinueFromPrepare}
            onIdentifyCommodities={handleIdentifyCommodities}
            onTextChange={setPrepareText}
            sourceLabel={prepareSourceLabel}
            text={prepareText}
          />
        }
        path="/prepare"
      />
      <Route
        element={
          <AppShell
            analysisProgress={analysisProgress}
            analyzingUnitNumbers={analyzingUnitNumbers}
            commodities={editorCommodities}
            complianceReport={editorComplianceReport}
            generatingTripleUnitNumbers={generatingTripleUnitNumbers}
            initialSentences={initialUnits}
            isAnalyzingCompliance={isAnalyzingCompliance}
            isGeneratingTriples={isGeneratingTriples}
            onAnalyzeUnits={handleAnalyzeUnits}
            onCommoditiesChange={setEditorCommodities}
            onGenerateTriplesForUnits={handleGenerateTriplesForUnits}
            onUnitsStructureChange={handleUnitsStructureChange}
            triplesProgress={triplesProgress}
            unitAnalyses={editorUnitAnalyses}
            unitTriples={editorUnitTriples}
          />
        }
        path="/editor"
      />
      <Route element={<Navigate to="/" replace />} path="*" />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
