import { api } from '../api'
import { normalizeTemplate } from './catalog'
import type { TemplateAdaptation, TemplateItem } from './types'

type TemplateAdaptationResult = {
  input_attestation?: string
  selected_template?: Partial<TemplateItem>
  adapted_attestation?: string | null
  component_mapping?: Array<{
    component_name: string
    value?: string
    source_text?: string
    status?: string
    preservation_note?: string
  }>
}

type TemplateAdaptationResponse = {
  output?: TemplateAdaptationResult
}

export async function adaptAttestationTemplate(attestation: string): Promise<TemplateAdaptation> {
  const response = await api.post<TemplateAdaptationResponse>('/adapt_attestation_template', {
    input: { attestation },
  })
  const adaptation = unwrapAdaptation(response.data.output) || {}

  return {
    sentence: adaptation.input_attestation || attestation,
    template: templateFromAdaptation(adaptation, attestation),
    created_new: false,
  }
}

function unwrapAdaptation(output: TemplateAdaptationResponse['output']): TemplateAdaptationResult | undefined {
  if (!output) return undefined

  const nested = output as TemplateAdaptationResult & {
    results?: TemplateAdaptationResult
    output?: { results?: TemplateAdaptationResult }
  }

  return nested.results || nested.output?.results || nested
}

function templateFromAdaptation(adaptation: TemplateAdaptationResult, attestation: string): TemplateItem {
  const selected = normalizeTemplate({
    ...adaptation.selected_template,
    representative_example: adaptation.adapted_attestation || attestation,
  })

  ;(adaptation.component_mapping || []).forEach((mapping) => {
    const component = Object.values(selected.components).find((item) => item.label === mapping.component_name)
    if (component) {
      component.text = String(mapping.value || mapping.source_text || '')
      return
    }

    const nextKey = String(Object.keys(selected.components).length + 1)
    selected.components[nextKey] = {
      label: mapping.component_name,
      text: String(mapping.value || mapping.source_text || ''),
      required: mapping.status !== 'omitted_optional' && mapping.status !== 'not_applicable',
      description: String(mapping.preservation_note || ''),
      examples: [],
      allow_custom: true,
    }
  })

  if (Object.keys(selected.components).length === 0) {
    selected.structural_template = '*<sentence>'
    selected.components = {
      '1': {
        label: 'sentence',
        text: adaptation.adapted_attestation || attestation,
        required: true,
        description: 'Fallback sentence from template adaptation.',
        examples: [attestation],
        allow_custom: true,
      },
    }
  }

  return selected
}
