import templatesRoot from '../../assets/templates/templates.json'
import type { TemplateComponent, TemplateItem, TemplatesRoot } from './types'

const undefinedTemplateId = 'UND-8f2c3a1b-5d7e-4d2b-9f6a-0b7f3d2b1a9c'

export function getTemplates(): TemplatesRoot {
  const root = templatesRoot as TemplatesRoot
  const items = (root.items || []).map(normalizeTemplate)

  if (!items.some(isUndefinedTemplate)) {
    items.unshift(createUndefinedTemplate())
  }

  return {
    version: root.version || 'attestation-2.0',
    items,
  }
}

function isUndefinedTemplate(item: TemplateItem) {
  return (
    item.id === undefinedTemplateId ||
    item.id === 'ATT-UND-000' ||
    (
      item.category.toLowerCase() === 'undefined' &&
      item.modality.toLowerCase() === 'undefined' &&
      item.communicative_function.toLowerCase() === 'undefined'
    )
  )
}

export function normalizeTemplate(item: Partial<TemplateItem> & Record<string, unknown>): TemplateItem {
  const components: Record<string, TemplateComponent> = {}

  Object.entries((item.components || {}) as Record<string, Partial<TemplateComponent>>).forEach(([key, raw], index) => {
    const label = String(raw?.label || key).trim()
    components[String(index + 1)] = {
      label,
      text: String(raw?.text || ''),
      required: Boolean(raw?.required),
      description: String(raw?.description || ''),
      examples: Array.isArray(raw?.examples) ? raw.examples.map((example) => String(example)) : [],
      allow_custom: raw?.allow_custom !== false,
    }
  })

  return {
    id: String(item.id || `TPL-${Date.now()}`),
    type: String(item.type || 'default'),
    category: String(item.category || ''),
    commodities: Array.isArray(item.commodities) ? item.commodities.map((commodity) => String(commodity)) : undefined,
    modality: String(item.modality || ''),
    communicative_function: String(item.communicative_function || ''),
    representative_example: String(item.representative_example || ''),
    structural_template: normalizeTemplateChoices(String(item.structural_template || '*<sentence>')),
    components,
  }
}

function normalizeTemplateChoices(template: string) {
  return template.replace(/(^|[\s,{])([A-Za-z]+(?:\/[A-Za-z]+)+)(?=($|[\s,}.]))/g, '$1[$2]')
}

function createUndefinedTemplate(): TemplateItem {
  return {
    id: undefinedTemplateId,
    type: 'default',
    category: 'undefined',
    modality: 'undefined',
    communicative_function: 'undefined',
    representative_example: 'This sentence has not been processed yet.',
    structural_template: '*<sentence>',
    components: {
      '1': {
        label: 'sentence',
        text: 'This sentence has not been processed yet.',
        required: true,
        description: 'Fallback component for sentences that do not match any defined template.',
        examples: ['This sentence has not been processed yet.'],
        allow_custom: true,
      },
    },
  }
}
