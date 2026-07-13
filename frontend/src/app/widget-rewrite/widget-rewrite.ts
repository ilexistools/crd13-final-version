import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AttestationSectionReference,
  AttestationRewriteChange,
  AttestationRewritePlanResult,
  Crd13ApiService
} from '../crd13-api.service';

export interface RewriteResult {
  original: string;
  text: string;
  modality: string;
  communicative_function: string;
  template: string;
  commodity?: string | string[];
}

export interface Provision {
  rank: number;
  similarity: number;
  doc: {
    text: string;
    metadata: {
      commodities?: string[];
      process?: string;
      subject?: string;
      sentence?: string;
      section?: string;
      section_title?: string;
      page?: number;
      doc_id?: string;
      total_pages?: number;
      type: string;
      doc_title: string;
    };
  };
}

@Component({
  selector: 'app-widget-rewrite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './widget-rewrite.html',
  styleUrls: ['./widget-rewrite.css']
})
export class WidgetRewrite implements OnChanges {
  /* =========================
   * INPUTS / OUTPUTS
   * ========================= */

  /** Whether the modal is open */
  @Input() visible = false;

  /** The original sentence to be rewritten */
  @Input() sentence = '';

  /** Previously detected or saved commodities for this requirement */
  @Input() commodities: string[] = [];
  @Input() modalityOptions: string[] = [];
  @Input() communicativeFunctionOptions: string[] = [];
  @Input() communicativeFunctionOptionsByModality: Record<string, string[]> = {};

  /** Emits when modal should close without applying */
  @Output() closed = new EventEmitter<void>();

  /** Emits the rewritten text when user clicks Apply */
  @Output() applied = new EventEmitter<RewriteResult>();

  /** Emits whenever the active commodities change */
  @Output() commodityChanged = new EventEmitter<string[]>();

  /* =========================
   * INTERNAL STATE
   * ========================= */
  loading = false;
  error: string | null = null;
  result: RewriteResult | null = null;
  rewriteTextDraft = '';
  modalityDraft = '';
  communicativeFunctionDraft = '';

  // Section-guided rewrite state
  identifyingCommodity = false;
  loadingSections = false;
  commodityError: string | null = null;
  searchError: string | null = null;
  sections: AttestationSectionReference[] = [];
  selectedSections: AttestationSectionReference[] = [];
  plan: AttestationRewritePlanResult | null = null;
  selectedChanges: AttestationRewriteChange[] = [];
  private openSessionId = 0;
  private manualCommodityOverride = false;
  commodityInput = '';

  constructor(private crd13Api: Crd13ApiService) {}

  /* =========================
   * COMPUTED
   * ========================= */

  /** True if there is at least one selected provision */
  get hasReference(): boolean {
    return this.selectedSections.length > 0;
  }

  /** Number of distinct references that will be sent */
  get effectiveReferenceCount(): number {
    return this.selectedSections.length;
  }

  get canApply(): boolean {
    return (
      !!this.result &&
      this.hasReference &&
      !!this.rewriteTextDraft.trim() &&
      !!this.modalityDraft.trim() &&
      !!this.communicativeFunctionDraft.trim()
    );
  }

  get modalitySelectOptions(): string[] {
    return this.buildNormalizedOptions(this.modalityOptions, this.modalityDraft);
  }

  get communicativeFunctionSelectOptions(): string[] {
    const byModality = this.communicativeFunctionOptionsByModality?.[this.modalityDraft] ?? [];
    return this.buildNormalizedOptions(byModality, this.communicativeFunctionDraft);
  }

  /* =========================
   * LIFECYCLE
   * ========================= */
  ngOnChanges(changes: SimpleChanges): void {
    // Reset state and auto-search whenever modal is opened
    if (changes['visible'] && this.visible) {
      const sessionId = ++this.openSessionId;
      this.reset();
      this.manualCommodityOverride = false;
      this.commodities = this.normalizeCommodities(this.commodities);
      this.initializeCommodityAndSearch(sessionId);
    }
  }

  /* =========================
   * ACTIONS
   * ========================= */

  async initializeCommodityAndSearch(sessionId: number): Promise<void> {
    if (this.commodities.length) {
      await this.analyzeSections(sessionId);
      return;
    }

    await this.identifyCommodity(sessionId);
    if (this.commodities.length) {
      await this.analyzeSections(sessionId);
    }
  }

  async identifyCommodity(sessionId?: number): Promise<void> {
    if (this.identifyingCommodity) return;

    this.identifyingCommodity = true;
    this.commodityError = null;

    try {
      const response = await firstValueFrom(this.crd13Api.identifyCommodities(this.sentence));

      if (sessionId != null && sessionId !== this.openSessionId) {
        return;
      }

      const detectedCommodities = this.normalizeCommodities(response);
      if (!detectedCommodities.length) {
        this.commodityError = 'No commodities were identified for this sentence.';
        return;
      }

      if (!this.manualCommodityOverride || !this.commodities.length) {
        this.setCommodities(detectedCommodities);
      }
    } catch (e: any) {
      this.commodityError = e?.error?.message || e?.message || 'Failed to identify commodity. Please try again.';
    } finally {
      this.identifyingCommodity = false;
    }
  }

  /** Searches and analyzes section summaries related to the sentence. */
  async analyzeSections(sessionId?: number): Promise<void> {
    if (this.loadingSections) return;

    const commodities = this.normalizeCommodities(this.commodities);
    if (!commodities.length) {
      this.clearSections();
      this.searchError = 'Please provide at least one commodity before analyzing sections.';
      return;
    }

    this.loadingSections = true;
    this.searchError = null;
    this.commodityError = null;
    this.sections = [];
    this.selectedSections = [];
    this.plan = null;
    this.selectedChanges = [];
    this.result = null;

    try {
      const response = await firstValueFrom(
        this.crd13Api.analyzeAttestationSections(this.sentence, commodities)
      );
      if (sessionId != null && sessionId !== this.openSessionId) {
        return;
      }

      this.sections = this.mergeSections(response);
      this.selectedSections = [...this.sections];

      if (this.sections.length === 0) {
        this.searchError = 'No relevant sections found for this sentence.';
      }
    } catch (e: any) {
      this.searchError = e?.error?.detail || e?.error?.message || e?.message || 'Failed to analyze sections. Please try again.';
    } finally {
      this.loadingSections = false;
    }
  }

  toggleSection(section: AttestationSectionReference): void {
    const idx = this.selectedSections.findIndex(item => this.getSectionKey(item) === this.getSectionKey(section));
    if (idx >= 0) {
      this.selectedSections.splice(idx, 1);
    } else {
      this.selectedSections.push(section);
    }
    this.plan = null;
    this.selectedChanges = [];
    this.result = null;
  }

  isSectionSelected(section: AttestationSectionReference): boolean {
    return this.selectedSections.some(item => this.getSectionKey(item) === this.getSectionKey(section));
  }

  clearSections(): void {
    this.sections = [];
    this.selectedSections = [];
    this.plan = null;
    this.selectedChanges = [];
    this.result = null;
    this.searchError = null;
  }

  onCommodityInput(value: string): void {
    this.manualCommodityOverride = true;
    this.commodityInput = String(value ?? '');
    this.commodityError = null;
  }

  onCommodityInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    this.addCommodityFromInput();
  }

  addCommodityFromInput(): void {
    const next = this.normalizeCommodity(this.commodityInput);
    if (!next) return;

    this.manualCommodityOverride = true;
    const exists = this.commodities.some(item => item.toLowerCase() === next.toLowerCase());
    if (!exists) {
      this.setCommodities([...this.commodities, next]);
    }
    this.commodityInput = '';
  }

  removeCommodity(index: number): void {
    if (index < 0 || index >= this.commodities.length) return;
    this.manualCommodityOverride = true;
    const next = this.commodities.filter((_, i) => i !== index);
    this.setCommodities(next);
  }

  async refreshCommodityAndSearch(): Promise<void> {
    const sessionId = this.openSessionId;
    this.clearSections();

    this.addCommodityFromInput();
    if (this.commodities.length) {
      await this.analyzeSections(sessionId);
      return;
    }

    this.manualCommodityOverride = false;
    await this.identifyCommodity(sessionId);
    if (this.commodities.length) {
      await this.analyzeSections(sessionId);
    }
  }

  /** Plans and applies section-supported rewrite changes. */
  async generate(): Promise<void> {
    if (!this.hasReference || this.loading) return;

    this.loading = true;
    this.error = null;
    this.result = null;
    this.plan = null;
    this.selectedChanges = [];

    try {
      const plan = await firstValueFrom(
        this.crd13Api.planAttestationRewriteChanges(this.sentence, this.selectedSections)
      );
      this.plan = plan || {};
      this.selectedChanges = Array.isArray(plan?.changes) ? plan.changes : [];

      if (!this.selectedChanges.length) {
        const notes = Array.isArray(plan?.notes) && plan.notes.length ? ` ${plan.notes.join(' ')}` : '';
        this.result = {
          original: this.sentence,
          text: this.sentence,
          modality: this.defaultModality(),
          communicative_function: this.defaultCommunicativeFunction(),
          template: `Change plan: ${plan?.decision || 'unchanged'}.${notes}`,
          commodity: this.commodities,
        };
        this.rewriteTextDraft = this.sentence;
        this.modalityDraft = this.result.modality;
        this.communicativeFunctionDraft = this.result.communicative_function;
        return;
      }

      const application = await firstValueFrom(
        this.crd13Api.applyAttestationChanges(this.sentence, this.selectedChanges)
      );
      const rewritten = String(application?.rewritten_attestation || this.sentence).trim();
      this.result = {
        original: this.sentence,
        text: rewritten,
        modality: this.defaultModality(),
        communicative_function: this.defaultCommunicativeFunction(),
        template: `Section-guided rewrite: ${application?.decision || plan?.decision || 'rewritten'}`,
        commodity: this.commodities
      };
      this.rewriteTextDraft = rewritten;
      this.modalityDraft = this.result.modality;
      this.communicativeFunctionDraft = this.result.communicative_function;
    } catch (e: any) {
      this.error = e?.error?.detail || e?.error?.message || e?.message || 'Failed to rewrite. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  /** Applies the result to the parent and closes the modal */
  apply(): void {
    if (!this.result || !this.canApply) return;

    this.applied.emit({
      ...this.result,
      text: this.rewriteTextDraft.trim(),
      modality: this.modalityDraft.trim(),
      communicative_function: this.communicativeFunctionDraft.trim()
    });
    this.reset();
  }

  onRewriteTextInput(value: string): void {
    this.rewriteTextDraft = String(value ?? '');
  }

  onModalityInput(value: string): void {
    this.modalityDraft = String(value ?? '');

    const allowedFunctions = this.communicativeFunctionSelectOptions;
    if (!allowedFunctions.includes(this.communicativeFunctionDraft)) {
      this.communicativeFunctionDraft = '';
    }
  }

  onCommunicativeFunctionInput(value: string): void {
    this.communicativeFunctionDraft = String(value ?? '');
  }

  /** Closes the modal without applying */
  close(): void {
    this.closed.emit();
    this.reset();
  }

  /** Handles clicks on the dark overlay — closes modal */
  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close();
    }
  }

  /* =========================
   * HELPERS
   * ========================= */
  private reset(): void {
    this.loading = false;
    this.error = null;
    this.result = null;
    this.rewriteTextDraft = '';
    this.modalityDraft = '';
    this.communicativeFunctionDraft = '';
    this.identifyingCommodity = false;
    this.loadingSections = false;
    this.commodityError = null;
    this.searchError = null;
    this.sections = [];
    this.selectedSections = [];
    this.plan = null;
    this.selectedChanges = [];
    this.commodityInput = '';
  }

  private setCommodities(values: string[] | null | undefined): void {
    const normalized = this.normalizeCommodities(values);
    this.commodities = normalized;
    this.commodityChanged.emit(normalized);
  }

  private normalizeCommodity(value: string | null | undefined): string {
    return String(value ?? '').trim();
  }

  private normalizeCommodities(values: string[] | null | undefined): string[] {
    const list = Array.isArray(values) ? values : [];
    const normalized = list
      .map(value => this.normalizeCommodity(value))
      .filter(Boolean);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const item of normalized) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return unique;
  }

  private mergeSections(sections: AttestationSectionReference[]): AttestationSectionReference[] {
    const dedup = new Map<string, AttestationSectionReference>();

    for (const section of sections || []) {
      const key = this.getSectionKey(section);
      const current = dedup.get(key);
      if (!current) {
        dedup.set(key, section);
      }
    }

    return Array.from(dedup.values());
  }

  private getSectionKey(section: AttestationSectionReference): string {
    const docId = String(section?.doc_id ?? '').trim();
    const sectionId = String(section?.section_id ?? '').trim();
    const sectionTitle = String(section?.section ?? '').trim();
    return `${docId}::${sectionId}::${sectionTitle}`;
  }

  private buildNormalizedOptions(options: string[] | null | undefined, currentValue: string): string[] {
    const list = Array.isArray(options) ? options : [];
    const current = String(currentValue ?? '').trim();
    const normalized = list
      .map(x => String(x ?? '').trim())
      .filter(Boolean)
      .filter(x => x.toLowerCase() !== 'any');

    if (current && !normalized.includes(current)) {
      normalized.push(current);
    }

    return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
  }

  private defaultModality(): string {
    return this.buildNormalizedOptions(this.modalityOptions, '')[0] || 'undefined';
  }

  private defaultCommunicativeFunction(): string {
    const byModality = this.communicativeFunctionOptionsByModality?.[this.defaultModality()] ?? [];
    return this.buildNormalizedOptions(byModality.length ? byModality : this.communicativeFunctionOptions, '')[0] || 'undefined';
  }
}
