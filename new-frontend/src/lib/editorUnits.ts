import { createInitialTemplateState, renderTemplateItem } from './templates/parser'
import type { TemplateEditorState, TemplateItem } from './templates/types'

export type AttestationUnit = {
  id: string
  originalText: string
  templateId?: string
  templateMode: 'free_text' | 'template_guided'
  templateSnapshot?: TemplateItem
  templateState?: TemplateEditorState
  text: string
}

export function createAttestationUnit(text = '', options?: Partial<AttestationUnit>): AttestationUnit {
  return {
    id: createUnitId(),
    originalText: text,
    templateMode: 'free_text',
    text,
    ...options,
  }
}

export function createTemplateGuidedUnit(template: TemplateItem, seedText = ''): AttestationUnit {
  const state = createInitialTemplateState(template)
  const rendered = renderTemplateItem(template, state)
  const text = rendered || seedText

  return createAttestationUnit(text, {
    originalText: seedText,
    templateId: template.id,
    templateMode: 'template_guided',
    templateSnapshot: template,
    templateState: state,
  })
}

export function unitsFromTexts(texts: string[]) {
  return texts.map((text) => createAttestationUnit(text))
}

export function cloneUnits(units: AttestationUnit[]) {
  return units.map((unit) => ({
    ...unit,
    templateSnapshot: unit.templateSnapshot ? structuredClone(unit.templateSnapshot) : undefined,
    templateState: unit.templateState ? structuredClone(unit.templateState) : undefined,
  }))
}

function createUnitId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `unit-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
