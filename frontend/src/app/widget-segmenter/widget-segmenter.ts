import { Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import {
  AttestationRewriteChange,
  AttestationRewritePlanResult,
  AttestationSectionReference,
  ComplianceAnalysisResult,
  Crd13ApiService
} from '../crd13-api.service';

type SegMode = 'ai' | 'semicolon' | 'newline' | 'dot';
type Step = 'upload' | 'text' | 'commodities' | 'compliance' | 'segmentation' | 'segments';
type CompliancePrincipleCode = 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C' | 'D' | 'E' | string;
type ComplianceRemediationMode = 'unitization' | 'rewrite';
type ComplianceUnitStatus = 'pending' | 'analyzing' | 'compliant' | 'needs-adjustment' | 'error';

export interface SegmenterOutput {
  segments: string[];
  commodities: string[];
  source: 'scratch' | 'input';
}

type ComplianceUnit = {
  id: string;
  text: string;
  result: ComplianceAnalysisResult | null;
  status: ComplianceUnitStatus;
  error: string | null;
};

@Component({
  selector: 'widget-segmenter',
  standalone: true,
  templateUrl: './widget-segmenter.html',
  styleUrls: ['./widget-segmenter.css'],
  imports: [CommonModule, FormsModule, MatIconModule],
})
export class WidgetSegmenterComponent implements OnDestroy {
  @Input() initialText: string = '';
  @Output() segmentsReady = new EventEmitter<SegmenterOutput>();

  step: Step = 'upload';
  mode: SegMode = 'ai';

  rawText = '';
  segments: string[] = [];
  commodities: string[] = [];
  commodityInput = '';
  commodityOptions: string[] = [];
  filteredCommodityOptions: string[] = [];
  commodityListError: string | null = null;

  loading = false;
  commodityLoading = false;
  complianceLoading = false;
  error: string | null = null;
  info: string | null = null;
  commodityError: string | null = null;
  complianceError: string | null = null;
  complianceResult: ComplianceAnalysisResult | null = null;
  activeCompliancePrinciple: CompliancePrincipleCode | null = null;
  remediationMode: ComplianceRemediationMode | null = null;
  remediationDraft = '';
  remediationSegments: string[] = [];
  remediationSections: AttestationSectionReference[] = [];
  remediationPlan: AttestationRewritePlanResult | null = null;
  remediationChanges: AttestationRewriteChange[] = [];
  remediationLoading = false;
  remediationError: string | null = null;
  remediationInfo: string | null = null;
  returnToComplianceAfterSegmentation = false;
  complianceUnits: ComplianceUnit[] = [];
  activeComplianceUnitId: string | null = null;
  private segmentationSourceUnitId: string | null = null;
  private autoDetectedCommodities: string[] = [];
  private manualCommodities: string[] = [];
  private lastCommoditySource = '';
  private commodityDetectionTimer: ReturnType<typeof setTimeout> | null = null;
  private commodityDetectionRunId = 0;

  refiningIdx = new Set<number>();

  private readonly nativeAdjustHandler = (event: Event) => this.handleNativeAdjustEvent(event);

  constructor(
    private crd13Api: Crd13ApiService,
    private elementRef: ElementRef<HTMLElement>,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    const element = this.elementRef.nativeElement;
    element.addEventListener('pointerdown', this.nativeAdjustHandler);
    element.addEventListener('click', this.nativeAdjustHandler);

    void this.loadCommodityOptions();

    const init = (this.initialText || '').trim();
    if (init) {
      this.rawText = init;
      this.step = 'text';
      this.scheduleCommodityDetection(init);
    }
  }

  ngOnDestroy(): void {
    const element = this.elementRef.nativeElement;
    element.removeEventListener('pointerdown', this.nativeAdjustHandler);
    element.removeEventListener('click', this.nativeAdjustHandler);
  }

  setMode(mode: SegMode) {
    this.mode = mode;
    this.error = null;
    this.commodityError = null;
    this.complianceError = null;
    this.segments = [];
  }

  goToUpload() {
    this.clearCommodityDetectionTimer();
    this.error = null;
    this.commodityError = null;
    this.loading = false;
    this.commodityLoading = false;
    this.complianceLoading = false;
    this.complianceError = null;
    this.complianceResult = null;
    this.returnToComplianceAfterSegmentation = false;
    this.resetComplianceUnits();
    this.commodityInput = '';
    this.filteredCommodityOptions = [];
    this.lastCommoditySource = '';
    this.step = 'upload';
  }

  goToText() {
    this.error = null;
    this.commodityError = null;
    this.loading = false;
    this.commodityLoading = false;
    this.complianceLoading = false;
    this.complianceError = null;
    this.returnToComplianceAfterSegmentation = false;
    this.resetComplianceUnits();
    this.commodityInput = '';
    this.filteredCommodityOptions = [];
    this.step = 'text';
  }

  async goToCommodities(): Promise<void> {
    const text = (this.rawText || '').trim();
    if (!text) {
      this.error = 'Paste or upload some text first.';
      return;
    }

    this.error = null;
    this.info = null;

    if (this.shouldIdentifyCommodities(text) && !this.commodityLoading) {
      await this.detectCommodityForCurrentContext();
    }

    this.step = 'commodities';
  }

  clearAll() {
    this.clearCommodityDetectionTimer();
    this.rawText = '';
    this.segments = [];
    this.error = null;
    this.info = null;
    this.loading = false;
    this.commodityLoading = false;
    this.complianceLoading = false;
    this.commodityError = null;
    this.complianceError = null;
    this.complianceResult = null;
    this.resetComplianceUnits();
    this.setAutoDetectedCommodities([]);
    this.setManualCommodities([]);
    this.commodityInput = '';
    this.filteredCommodityOptions = [];
    this.lastCommoditySource = '';
    this.refiningIdx.clear();
    this.step = 'upload';
  }

  async pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      const text = (t || '').trim();
      if (!text) return;

      this.rawText = text;
      this.segments = [];
      this.error = null;
      this.info = null;
      this.commodityError = null;
      this.complianceError = null;
      this.complianceResult = null;
      this.resetComplianceUnits();
      this.setAutoDetectedCommodities([]);
      this.setManualCommodities([]);
      this.commodityInput = '';
      this.filteredCommodityOptions = [];
      this.lastCommoditySource = '';
      this.step = 'text';
      this.scheduleCommodityDetection(text);
    } catch {
      // Clipboard API blocked by browser — navigate to text step so the user
      // can paste manually with Ctrl+V directly into the textarea.
      this.rawText = '';
      this.segments = [];
      this.error = null;
      this.info = 'Clipboard access was blocked by the browser. Please paste your text below (Ctrl+V).';
      this.commodityError = null;
      this.complianceError = null;
      this.complianceResult = null;
      this.resetComplianceUnits();
      this.setAutoDetectedCommodities([]);
      this.setManualCommodities([]);
      this.commodityInput = '';
      this.filteredCommodityOptions = [];
      this.lastCommoditySource = '';
      this.step = 'text';
    }
  }

  onRawTextChange(value: string): void {
    this.rawText = value;
    this.error = null;
    this.info = null;
    this.commodityError = null;
    this.complianceError = null;
    this.segments = [];
    this.complianceResult = null;
    this.resetComplianceUnits();

    const normalizedText = String(value || '').trim();
    if (normalizedText !== this.lastCommoditySource) {
      this.setAutoDetectedCommodities([]);
      this.commodityInput = '';
      this.updateFilteredCommodityOptions('');
    }

    this.scheduleCommodityDetection(normalizedText);
  }

  async onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.loading = true;
    this.error = null;

    try {
      const name = (file.name || '').toLowerCase();
      const isPdf =
        name.endsWith('.pdf') ||
        file.type === 'application/pdf' ||
        file.type === 'application/x-pdf';

      if (isPdf) {
        const extracted = await this.extractTextFromPdfBackend(file);
        this.rawText = (extracted || '').trim();
      } else {
        const text = await file.text();
        this.rawText = (text || '').trim();
      }

      this.segments = [];
      this.complianceResult = null;
      this.complianceError = null;
      this.resetComplianceUnits();
      this.setAutoDetectedCommodities([]);
      this.setManualCommodities([]);
      this.commodityInput = '';
      this.filteredCommodityOptions = [];
      this.lastCommoditySource = '';
      this.commodityError = null;
      this.step = 'text';
      this.scheduleCommodityDetection(this.rawText);
    } catch (e: any) {
      this.error = e?.message || 'Failed to read file.';
    } finally {
      this.loading = false;
      input.value = '';
    }
  }

  private extractTextFromPdfBackend(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      this.crd13Api.extractPdfText(file).subscribe({
        next: (res) => {
          const text = String(res || '').trim();
          if (!text || !text.trim()) {
            reject(new Error('Backend returned empty PDF text.'));
            return;
          }

          resolve(text);
        },
        error: (err) => {
          reject(
            new Error(
              err?.error?.detail ||
              err?.error?.message ||
              'PDF extraction failed.'
            )
          );
        },
      });
    });
  }

  segment() {
    const text = (this.rawText || '').trim();
    if (!text) {
      this.error = 'Paste or upload some text first.';
      return;
    }

    this.error = null;
    this.addCommodityFromInput();

    if (!this.getNormalizedCommodityList(this.commodities).length) {
      this.commodityError = 'Identify or add at least one commodity before segmentation.';
      this.step = 'commodities';
      return;
    }

    // 2) Split (;)
    if (this.mode === 'semicolon') {
      this.segments = text.split(';').map(s => s.trim()).filter(Boolean);
      this.step = 'segments';
      return;
    }

    // 3) Split (\n)
    if (this.mode === 'newline') {
      this.segments = text.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
      this.step = 'segments';
      return;
    }

    // 4) Split (.)
    if (this.mode === 'dot') {
      this.segments = text
        .split('.')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => (s.endsWith('.') ? s : s + '.'));
      this.step = 'segments';
      return;
    }

    // 1) Auto (AI) -> API
    this.loading = true;
    this.crd13Api.unitize(text).subscribe({
      next: (res) => {
        const segs = Array.isArray(res) ? res : [];
        this.segments = segs.map((s: string) => (s || '').trim()).filter(Boolean);

        if (!this.segments.length) {
          this.error = 'No segments returned by the API.';
          this.loading = false;
          return;
        }

        this.loading = false;
        this.step = 'segments';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Segmentation failed.';
        this.loading = false;
      },
    });
  }

  skipSegmentation(): void {
    const text = (this.rawText || '').trim();
    if (!text) {
      this.error = 'Paste or upload some text first.';
      return;
    }

    this.error = null;
    this.segments = [text];
    this.step = 'segments';
  }

  async analyzeComplianceAndContinue(): Promise<void> {
    const text = (this.rawText || '').trim();
    if (!text) {
      this.error = 'Paste or upload some text first.';
      return;
    }

    this.addCommodityFromInput();

    if (!this.getNormalizedCommodityList(this.commodities).length) {
      this.commodityError = 'Identify or add at least one commodity before continuing.';
      return;
    }

    this.error = null;
    this.complianceError = null;
    this.complianceLoading = true;

    try {
      const result = await firstValueFrom(this.crd13Api.analyzeCompliance(text));
      this.setComplianceUnits([{ id: this.createComplianceUnitId(0), text, result, status: this.complianceResultStatus(result), error: null }]);
      this.complianceResult = result;
      this.step = 'compliance';
    } catch (e: any) {
      this.complianceResult = null;
      this.resetComplianceUnits();
      this.complianceError = e?.error?.detail || e?.error?.message || e?.message || 'Compliance analysis failed.';
    } finally {
      this.complianceLoading = false;
    }
  }

  async continueAfterCompliance(): Promise<void> {
    this.error = null;
    this.closeComplianceRemediation();
    this.goToSegmentation();
  }

  backToCommodities(): void {
    this.step = 'commodities';
    this.error = null;
    this.complianceError = null;
    this.returnToComplianceAfterSegmentation = false;
    this.closeComplianceRemediation();
  }

  handleComplianceAdjustment(
    event: Event | null,
    item: NonNullable<ComplianceAnalysisResult['principle_assessments']>[number],
    index: number
  ): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.isA1CompliancePrinciple(item, index)) {
      this.goToSegmentationFromCompliance();
      return;
    }

    this.openComplianceRemediation(item, index);
  }

  goToSegmentationFromCompliance(): void {
    this.closeComplianceRemediation();
    this.error = null;
    this.segmentationSourceUnitId = this.activeComplianceUnit()?.id || null;
    this.rawText = this.currentComplianceText();
    this.goToSegmentation(true);
  }

  async returnToComplianceFromSegmentation(): Promise<void> {
    const segments = this.step === 'segments'
      ? this.segments.map(s => (s || '').trim()).filter(Boolean)
      : [];

    if (this.returnToComplianceAfterSegmentation && segments.length) {
      await this.returnToComplianceWithSegments(segments);
      return;
    }

    if (this.returnToComplianceAfterSegmentation) {
      await this.reanalyzeActiveComplianceUnit();
      return;
    }

    this.step = 'compliance';
  }

  private handleNativeAdjustEvent(event: Event): void {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('.ws-adjust-btn');
    if (!button || button.disabled || button.dataset['compliancePrinciple'] !== 'A1') return;

    event.preventDefault();
    event.stopPropagation();
    this.ngZone.run(() => this.goToSegmentationFromCompliance());
  }

  isComplianceAdjustmentDisabled(item: NonNullable<ComplianceAnalysisResult['principle_assessments']>[number], index: number): boolean {
    if (this.isComplianceStatusCompliant(item?.compliance)) return true;
    return this.remediationLoading && !this.isA1CompliancePrinciple(item, index);
  }

  isA1CompliancePrinciple(item: NonNullable<ComplianceAnalysisResult['principle_assessments']>[number], index: number): boolean {
    return this.compliancePrincipleKey(item, index) === 'A1';
  }

  private goToSegmentation(returnToComplianceAfterSegmentation = false): void {
    this.returnToComplianceAfterSegmentation = returnToComplianceAfterSegmentation;
    if (!returnToComplianceAfterSegmentation) {
      this.segmentationSourceUnitId = null;
    }
    this.step = 'segmentation';
    window.setTimeout(() => {
      document.querySelector('.ws-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  openComplianceRemediation(item: NonNullable<ComplianceAnalysisResult['principle_assessments']>[number], index: number): void {
    const code = this.compliancePrincipleKey(item, index);
    if (this.isComplianceStatusCompliant(item?.compliance)) return;

    this.activeCompliancePrinciple = code;
    this.remediationMode = code === 'A1' || code === 'B1' ? 'unitization' : 'rewrite';
    this.remediationDraft = this.currentComplianceText();
    this.remediationSegments = this.remediationMode === 'unitization'
      ? this.seedRemediationSegments(this.remediationDraft)
      : [];
    this.remediationSections = [];
    this.remediationPlan = null;
    this.remediationChanges = [];
    this.remediationError = null;
    this.remediationInfo = this.remediationIntro(code);

    window.setTimeout(() => {
      document.querySelector('.ws-remediation-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  closeComplianceRemediation(): void {
    this.activeCompliancePrinciple = null;
    this.remediationMode = null;
    this.remediationDraft = '';
    this.remediationSegments = [];
    this.remediationSections = [];
    this.remediationPlan = null;
    this.remediationChanges = [];
    this.remediationLoading = false;
    this.remediationError = null;
    this.remediationInfo = null;
  }

  async autoUnitizeForRemediation(): Promise<void> {
    const text = (this.remediationDraft || this.currentComplianceText()).trim();
    if (!text || this.remediationLoading) return;

    this.remediationLoading = true;
    this.remediationError = null;

    try {
      const segments = await firstValueFrom(this.crd13Api.unitize(text));
      const cleaned = (segments || []).map(item => String(item || '').trim()).filter(Boolean);
      if (!cleaned.length) {
        this.remediationError = 'No semantic units were returned.';
        return;
      }
      this.remediationSegments = cleaned;
      this.remediationDraft = cleaned.join('\n');
    } catch (e: any) {
      this.remediationError = e?.error?.detail || e?.error?.message || e?.message || 'Unitization failed.';
    } finally {
      this.remediationLoading = false;
    }
  }

  updateRemediationSegment(index: number, value: string): void {
    if (index < 0 || index >= this.remediationSegments.length) return;
    this.remediationSegments[index] = value;
    this.remediationDraft = this.remediationSegments.map(item => String(item || '').trim()).filter(Boolean).join('\n');
  }

  addRemediationSegment(afterIndex?: number): void {
    const idx = typeof afterIndex === 'number' ? afterIndex + 1 : this.remediationSegments.length;
    this.remediationSegments.splice(idx, 0, '');
  }

  removeRemediationSegment(index: number): void {
    if (index < 0 || index >= this.remediationSegments.length) return;
    this.remediationSegments.splice(index, 1);
    this.remediationDraft = this.remediationSegments.map(item => String(item || '').trim()).filter(Boolean).join('\n');
  }

  async generateRewriteForRemediation(): Promise<void> {
    const text = (this.remediationDraft || this.currentComplianceText()).trim();
    if (!text || this.remediationLoading) return;

    let commodities = this.getNormalizedCommodityList(this.commodities);
    if (!commodities.length) {
      commodities = await this.detectCommodityForCurrentContext();
    }

    if (!commodities.length) {
      this.remediationError = 'Identify or add at least one commodity before rewriting.';
      return;
    }

    this.remediationLoading = true;
    this.remediationError = null;
    this.remediationSections = [];
    this.remediationPlan = null;
    this.remediationChanges = [];

    try {
      const sections = await firstValueFrom(this.crd13Api.analyzeAttestationSections(text, commodities));
      this.remediationSections = sections || [];
      if (!this.remediationSections.length) {
        this.remediationError = 'No relevant sections were found for this attestation.';
        return;
      }

      const plan = await firstValueFrom(this.crd13Api.planAttestationRewriteChanges(text, this.remediationSections));
      this.remediationPlan = plan || {};
      this.remediationChanges = Array.isArray(plan?.changes) ? plan.changes : [];
      if (!this.remediationChanges.length) {
        this.remediationInfo = (plan?.notes || ['No rewrite changes were recommended.']).join(' ');
        return;
      }

      const application = await firstValueFrom(this.crd13Api.applyAttestationChanges(text, this.remediationChanges));
      this.remediationDraft = String(application?.rewritten_attestation || text).trim();
      this.remediationInfo = (application?.notes || [`Rewrite ${application?.decision || 'generated'}.`]).join(' ');
    } catch (e: any) {
      this.remediationError = e?.error?.detail || e?.error?.message || e?.message || 'Rewrite remediation failed.';
    } finally {
      this.remediationLoading = false;
    }
  }

  async applyComplianceRemediation(): Promise<void> {
    const text = this.remediationMode === 'unitization'
      ? this.remediationSegments.map(item => String(item || '').trim()).filter(Boolean).join('\n')
      : String(this.remediationDraft || '').trim();

    if (!text || this.remediationLoading) {
      this.remediationError = 'No adjusted attestation text is available.';
      return;
    }

    const unit = this.activeComplianceUnit();
    if (unit) {
      unit.text = text;
      unit.status = 'analyzing';
      unit.error = null;
    } else {
      this.rawText = text;
    }
    this.remediationDraft = text;
    this.complianceLoading = true;
    this.remediationLoading = true;
    this.remediationError = null;

    try {
      const result = await firstValueFrom(this.crd13Api.analyzeCompliance(text));
      this.complianceResult = result;
      if (unit) {
        unit.result = result;
        unit.status = this.complianceResultStatus(result);
        this.rawText = this.complianceUnits.map(item => item.text).join('\n');
      }
      const stillOpenCode = this.activeCompliancePrinciple;
      const updated = this.compliancePrinciples().find((item, index) => this.compliancePrincipleKey(item, index) === stillOpenCode);
      if (updated && this.isComplianceStatusCompliant(updated.compliance)) {
        this.remediationInfo = `${stillOpenCode} is now Compliant.`;
        this.closeComplianceRemediation();
      } else {
        this.remediationInfo = 'Compliance was re-analyzed. Continue adjusting until the principle is Compliant.';
      }
    } catch (e: any) {
      this.remediationError = e?.error?.detail || e?.error?.message || e?.message || 'Compliance re-analysis failed.';
      if (unit) {
        unit.result = null;
        unit.status = 'error';
        unit.error = this.remediationError;
      } else {
        this.complianceResult = null;
      }
    } finally {
      this.complianceLoading = false;
      this.remediationLoading = false;
    }
  }

  updateSegment(i: number, value: string) {
    this.segments[i] = value;
  }

  addSegment(afterIndex?: number) {
    const idx = typeof afterIndex === 'number' ? afterIndex + 1 : this.segments.length;
    this.segments.splice(idx, 0, '');
  }

  removeSegment(i: number) {
    this.segments.splice(i, 1);
  }

  refineSegment(i: number) {
    const current = (this.segments[i] || '').trim();
    if (!current || this.refiningIdx.has(i)) return;

    this.refiningIdx.add(i);
    this.error = null;

    this.crd13Api.unitize(current).subscribe({
      next: (res) => {
        const segs = Array.isArray(res) ? res : [];
        const cleaned = segs.map((s: string) => (s || '').trim()).filter(Boolean);
        if (!cleaned.length) return;

        this.segments.splice(i, 1, ...cleaned);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Item segmentation failed.';
      },
      complete: () => {
        this.refiningIdx.clear();
      },
    });
  }

  async next() {
    const cleaned = this.segments.map(s => (s || '').trim()).filter(Boolean);
    if (!cleaned.length) {
      this.error = 'No valid segments to send.';
      return;
    }

    this.addCommodityFromInput();
    let commodities = this.getNormalizedCommodityList(this.commodities);
    if (!commodities.length) {
      commodities = await this.detectCommodityForCurrentContext();
    }

    if (!commodities.length) {
      this.error = 'Commodity identification failed. Please identify at least one commodity before continuing.';
      return;
    }

    if (this.returnToComplianceAfterSegmentation) {
      await this.returnToComplianceWithSegments(cleaned);
      return;
    }

    this.segmentsReady.emit({ segments: cleaned, commodities, source: 'input' });
  }

  private async returnToComplianceWithSegments(segments: string[]): Promise<void> {
    const newUnits = segments.map((text, index) => ({
      id: this.createComplianceUnitId(index),
      text,
      result: null,
      status: 'pending' as ComplianceUnitStatus,
      error: null,
    }));
    const sourceIndex = this.segmentationSourceUnitId
      ? this.complianceUnits.findIndex(unit => unit.id === this.segmentationSourceUnitId)
      : -1;

    if (sourceIndex >= 0) {
      this.complianceUnits.splice(sourceIndex, 1, ...newUnits);
      this.activeComplianceUnitId = newUnits[0]?.id || this.complianceUnits[0]?.id || null;
      this.complianceResult = null;
      this.complianceError = null;
    } else {
      this.setComplianceUnits(newUnits);
    }

    this.segmentationSourceUnitId = null;
    this.rawText = this.complianceUnits.map(unit => unit.text).join('\n');
    await this.analyzeComplianceUnits();
  }

  private async reanalyzeActiveComplianceUnit(): Promise<void> {
    const unit = this.activeComplianceUnit();
    const text = (unit?.text || this.rawText || '').trim();
    if (!text) {
      this.complianceError = 'No attestation text is available for compliance analysis.';
      this.step = 'compliance';
      return;
    }

    this.error = null;
    this.complianceError = null;
    this.complianceResult = null;
    this.complianceLoading = true;

    try {
      const result = await firstValueFrom(this.crd13Api.analyzeCompliance(text));
      if (unit) {
        unit.text = text;
        unit.result = result;
        unit.status = this.complianceResultStatus(result);
        unit.error = null;
      } else {
        this.setComplianceUnits([{ id: this.createComplianceUnitId(0), text, result, status: this.complianceResultStatus(result), error: null }]);
      }
      this.complianceResult = result;
      this.returnToComplianceAfterSegmentation = false;
      this.step = 'compliance';
      window.setTimeout(() => {
        document.querySelector('.ws-card')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    } catch (e: any) {
      this.complianceError = e?.error?.detail || e?.error?.message || e?.message || 'Compliance analysis failed.';
      if (unit) {
        unit.result = null;
        unit.status = 'error';
        unit.error = this.complianceError;
      }
      this.step = 'compliance';
    } finally {
      this.complianceLoading = false;
    }
  }

  onCommodityInput(value: string): void {
    this.commodityInput = String(value || '');
    this.commodityError = null;
    this.updateFilteredCommodityOptions(this.commodityInput);
  }

  onCommodityInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCommodityFromInput();
      return;
    }

    if (event.key === ',') {
      event.preventDefault();
    }
  }

  canAddSelectedCommodity(): boolean {
    return !!this.getCommodityOptionFromInput(this.commodityInput);
  }

  addCommodityFromInput(): void {
    const next = this.getCommodityOptionFromInput(this.commodityInput);
    if (!next) return;

    this.addManualCommodity(next);
    this.complianceResult = null;

    this.commodityInput = '';
    this.filteredCommodityOptions = [];
    this.commodityError = null;
  }

  selectCommodityOption(option: string): void {
    const next = this.normalizeCommodity(option);
    if (!next) return;

    this.addManualCommodity(next);
    this.complianceResult = null;
    this.commodityInput = '';
    this.filteredCommodityOptions = [];
    this.commodityError = null;
  }

  removeCommodity(index: number): void {
    if (index < 0 || index >= this.commodities.length) return;
    const removed = this.commodities[index];
    const key = removed.toLowerCase();
    this.manualCommodities = this.manualCommodities.filter(item => item.toLowerCase() !== key);
    this.autoDetectedCommodities = this.autoDetectedCommodities.filter(item => item.toLowerCase() !== key);
    this.syncCommodities();
    this.complianceResult = null;
  }

  async reidentifyCommodity(): Promise<void> {
    await this.detectCommodityForCurrentContext(true);
  }

  private async detectCommodityForCurrentContext(force = false, sourceOverride?: string): Promise<string[]> {
    const sourceText = String(sourceOverride ?? this.currentCommoditySourceText()).trim();
    if (!sourceText) {
      this.setAutoDetectedCommodities([]);
      this.commodityError = 'No text available to identify commodity.';
      return [];
    }

    if (!force && !this.shouldIdentifyCommodities(sourceText)) {
      return this.getNormalizedCommodityList(this.commodities);
    }

    this.commodityLoading = true;
    this.commodityError = null;
    const runId = ++this.commodityDetectionRunId;

    try {
      const commodities = await this.identifyCommodities(sourceText);
      if (runId !== this.commodityDetectionRunId || sourceText !== this.currentCommoditySourceText()) {
        return this.getNormalizedCommodityList(this.commodities);
      }

      this.setAutoDetectedCommodities(commodities);
      this.lastCommoditySource = sourceText;
      return this.getNormalizedCommodityList(this.commodities);
    } catch (e: any) {
      if (runId !== this.commodityDetectionRunId || sourceText !== this.currentCommoditySourceText()) {
        return this.getNormalizedCommodityList(this.commodities);
      }

      this.setAutoDetectedCommodities([]);
      this.commodityError = e?.error?.message || e?.message || 'Failed to identify commodity.';
      return [];
    } finally {
      if (runId === this.commodityDetectionRunId) {
        this.commodityLoading = false;
      }
    }
  }

  private shouldIdentifyCommodities(sourceText: string): boolean {
    const normalizedText = String(sourceText || '').trim();
    return (
      !!normalizedText &&
      (!this.getNormalizedCommodityList(this.commodities).length || normalizedText !== this.lastCommoditySource)
    );
  }

  private scheduleCommodityDetection(sourceText: string): void {
    this.clearCommodityDetectionTimer();

    if (!sourceText) {
      this.commodityDetectionRunId++;
      this.commodityLoading = false;
      return;
    }

    this.commodityDetectionTimer = setTimeout(() => {
      if (this.step === 'text' && this.shouldIdentifyCommodities(sourceText)) {
        void this.detectCommodityForCurrentContext(false, sourceText);
      }
    }, 900);
  }

  private clearCommodityDetectionTimer(): void {
    if (!this.commodityDetectionTimer) return;
    clearTimeout(this.commodityDetectionTimer);
    this.commodityDetectionTimer = null;
  }

  private currentCommoditySourceText(): string {
    return String(this.currentComplianceText() || this.rawText || this.segments.join('\n') || '').trim();
  }

  private async identifyCommodities(text: string): Promise<string[]> {
    const baseText = String(text || '').trim();
    if (!baseText) {
      throw new Error('No text available for commodity identification.');
    }

    const response = await firstValueFrom(this.crd13Api.identifyCommodities(baseText));
    const commodities = this.getNormalizedCommodityList(response);
    if (!commodities.length) {
      throw new Error('No commodities were identified.');
    }

    return commodities;
  }

  createFromScratch() {
    this.error = null;
    this.loading = false;
    this.commodityLoading = false;
    this.complianceLoading = false;
    this.commodityError = null;
    this.complianceError = null;
    this.complianceResult = null;
    this.setAutoDetectedCommodities([]);
    this.setManualCommodities([]);
    this.commodityInput = '';
    this.filteredCommodityOptions = [];
    this.lastCommoditySource = '';
    this.refiningIdx.clear();

    // estado "do zero"
    this.rawText = '';
    this.mode = 'ai';

    // manda direto pro Editor (o pai deve abrir o editor ao receber segmentsReady)
    this.segmentsReady.emit({ segments: [''], commodities: [], source: 'scratch' });
  }

  private normalizeCommodity(value: string | null | undefined): string {
    return String(value ?? '').trim();
  }

  private async loadCommodityOptions(): Promise<void> {
    try {
      const response = await fetch('assets/commodities.json');
      if (!response.ok) {
        throw new Error('Commodity list could not be loaded.');
      }

      const data = await response.json();
      this.commodityOptions = this.getNormalizedCommodityList(Array.isArray(data) ? data : []);
      this.updateFilteredCommodityOptions(this.commodityInput);
    } catch (e: any) {
      this.commodityListError = e?.message || 'Commodity list could not be loaded.';
    }
  }

  private updateFilteredCommodityOptions(query: string): void {
    const normalizedQuery = this.normalizeCommodity(query).toLowerCase();
    const selected = new Set(this.commodities.map(item => item.toLowerCase()));
    const options = this.commodityOptions.filter(item => !selected.has(item.toLowerCase()));

    this.filteredCommodityOptions = (normalizedQuery
      ? options.filter(item => item.toLowerCase().includes(normalizedQuery))
      : options
    ).slice(0, 12);
  }

  private getCommodityOptionFromInput(value: string): string {
    const normalized = this.normalizeCommodity(value);
    if (!normalized) return '';

    const exact = this.commodityOptions.find(item => item.toLowerCase() === normalized.toLowerCase());
    if (exact) return exact;

    return this.filteredCommodityOptions[0] || '';
  }

  private addManualCommodity(value: string): void {
    const commodity = this.normalizeCommodity(value);
    if (!commodity) return;

    this.setManualCommodities([...this.manualCommodities, commodity]);
  }

  private setAutoDetectedCommodities(values: string[]): void {
    this.autoDetectedCommodities = this.getNormalizedCommodityList(values);
    this.syncCommodities();
  }

  private setManualCommodities(values: string[]): void {
    this.manualCommodities = this.getNormalizedCommodityList(values);
    this.syncCommodities();
  }

  private syncCommodities(): void {
    this.commodities = this.getNormalizedCommodityList([
      ...this.autoDetectedCommodities,
      ...this.manualCommodities,
    ]);
    this.updateFilteredCommodityOptions(this.commodityInput);
  }

  hasComplianceUnitSidebar(): boolean {
    return this.complianceUnits.length > 1;
  }

  activeComplianceUnit(): ComplianceUnit | null {
    return this.complianceUnits.find(unit => unit.id === this.activeComplianceUnitId) || this.complianceUnits[0] || null;
  }

  selectComplianceUnit(unit: ComplianceUnit): void {
    if (this.complianceLoading || this.remediationLoading) return;
    this.activeComplianceUnitId = unit.id;
    this.complianceResult = unit.result;
    this.complianceError = unit.error;
    this.closeComplianceRemediation();
  }

  complianceUnitLabel(index: number): string {
    return `Unit ${index + 1}`;
  }

  complianceUnitStatusLabel(unit: ComplianceUnit): string {
    const labels: Record<ComplianceUnitStatus, string> = {
      pending: 'Pending',
      analyzing: 'Analyzing',
      compliant: 'Compliant',
      'needs-adjustment': 'Needs adjustment',
      error: 'Error',
    };
    return labels[unit.status] || 'Pending';
  }

  complianceUnitStatusIcon(unit: ComplianceUnit): string {
    const icons: Record<ComplianceUnitStatus, string> = {
      pending: 'radio_button_unchecked',
      analyzing: 'pending',
      compliant: 'check_circle_outline',
      'needs-adjustment': 'report_problem',
      error: 'error_outline',
    };
    return icons[unit.status] || 'radio_button_unchecked';
  }

  complianceUnitsSummary(): string {
    if (!this.complianceUnits.length) return '';
    const compliant = this.complianceUnits.filter(unit => unit.status === 'compliant').length;
    const needsAdjustment = this.complianceUnits.filter(unit => unit.status === 'needs-adjustment' || unit.status === 'error').length;
    const pending = this.complianceUnits.filter(unit => unit.status === 'pending' || unit.status === 'analyzing').length;
    return `${this.complianceUnits.length} units · ${compliant} compliant · ${needsAdjustment} need adjustment · ${pending} pending`;
  }

  currentComplianceText(): string {
    return String(this.activeComplianceUnit()?.text || this.rawText || '').trim();
  }

  private resetComplianceUnits(): void {
    this.complianceUnits = [];
    this.activeComplianceUnitId = null;
    this.segmentationSourceUnitId = null;
  }

  private setComplianceUnits(units: ComplianceUnit[]): void {
    this.complianceUnits = units;
    this.activeComplianceUnitId = units[0]?.id || null;
    this.complianceResult = units[0]?.result || null;
    this.complianceError = units[0]?.error || null;
  }

  private createComplianceUnitId(index: number): string {
    return `unit-${Date.now()}-${index}`;
  }

  private complianceResultStatus(result: ComplianceAnalysisResult | null): ComplianceUnitStatus {
    if (!result) return 'pending';
    const overall = result.overall_assessment?.compliance;
    if (this.isComplianceStatusCompliant(overall)) return 'compliant';
    return 'needs-adjustment';
  }

  private async analyzeComplianceUnits(): Promise<void> {
    if (!this.complianceUnits.length) return;

    this.error = null;
    this.complianceError = null;
    this.complianceLoading = true;
    this.step = 'compliance';

    for (const unit of this.complianceUnits) {
      unit.status = 'analyzing';
      unit.error = null;
      this.activeComplianceUnitId = unit.id;
      this.complianceResult = unit.result;

      try {
        const result = await firstValueFrom(this.crd13Api.analyzeCompliance(unit.text));
        unit.result = result;
        unit.status = this.complianceResultStatus(result);
        if (this.activeComplianceUnitId === unit.id) {
          this.complianceResult = result;
        }
      } catch (e: any) {
        unit.result = null;
        unit.status = 'error';
        unit.error = e?.error?.detail || e?.error?.message || e?.message || 'Compliance analysis failed.';
        if (this.activeComplianceUnitId === unit.id) {
          this.complianceResult = null;
          this.complianceError = unit.error;
        }
      }
    }

    const firstOpen = this.complianceUnits.find(unit => unit.status !== 'compliant') || this.complianceUnits[0];
    this.activeComplianceUnitId = firstOpen?.id || null;
    this.complianceResult = firstOpen?.result || null;
    this.complianceError = firstOpen?.error || null;
    this.returnToComplianceAfterSegmentation = false;
    this.complianceLoading = false;

    window.setTimeout(() => {
      document.querySelector('.ws-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  compliancePrinciples(): NonNullable<ComplianceAnalysisResult['principle_assessments']> {
    const principles = this.complianceResult?.principle_assessments;
    if (!Array.isArray(principles)) return [];

    return principles.map(item => ({
      ...item,
      principle: this.normalizeCompliancePrinciple(item?.principle),
    }));
  }

  complianceElementGroups(): Array<{ label: string; values: string[] }> {
    const elements = this.complianceResult?.identified_elements || {};
    return Object.entries(elements)
      .map(([key, values]) => ({
        label: key.replace(/_/g, ' '),
        values: Array.isArray(values) ? values.map(value => String(value || '').trim()).filter(Boolean) : [],
      }))
      .filter(group => group.values.length > 0);
  }

  complianceClass(value: string | null | undefined): string {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('non')) return 'is-non-compliant';
    if (normalized.includes('partial')) return 'is-partial';
    if (normalized.includes('compliant')) return 'is-compliant';
    return '';
  }

  complianceIcon(value: string | null | undefined): string {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('non')) return 'error_outline';
    if (normalized.includes('partial')) return 'report_problem';
    if (normalized.includes('compliant')) return 'check_circle_outline';
    return 'radio_button_unchecked';
  }

  compliancePrincipleIcon(value: string | null | undefined): string {
    const code = this.normalizeCompliancePrinciple(value);
    const icons: Record<string, string> = {
      A1: 'extension',
      A2: 'vpn_key',
      A3: 'forum',
      B1: 'call_split',
      B2: 'balance',
      C: 'search',
      D: 'integration_instructions',
      E: 'article',
    };

    return icons[code] || 'article';
  }

  complianceProblemSummary(item: NonNullable<ComplianceAnalysisResult['principle_assessments']>[number]): string {
    const issue = String(item?.issue_identified || '').trim();
    if (issue) return issue;

    const explanation = String(item?.explanation || '').trim();
    if (explanation) return explanation;

    const fragment = String(item?.relevant_text_fragment || '').trim();
    if (fragment) return fragment;

    return 'No issue summary provided.';
  }

  compliancePrincipleKey(item: NonNullable<ComplianceAnalysisResult['principle_assessments']>[number], index: number): string {
    const code = this.normalizeCompliancePrinciple(item?.principle);
    return code || `principle-${index}`;
  }

  isComplianceStatusCompliant(value: string | null | undefined): boolean {
    const normalized = String(value || '').toLowerCase();
    return normalized.includes('compliant') && !normalized.includes('non') && !normalized.includes('partial');
  }

  remediationTitle(code: string | null): string {
    const titles: Record<string, string> = {
      A1: 'Identification of semantic units',
      A2: 'Identification of key attestation elements',
      A3: 'Determination of modality and communicative function',
      B1: 'Break into separate attestations',
      B2: 'Transparency and objectivity',
      C: 'Verifiability and auditability',
      D: 'Interoperability',
      E: 'Preservation of meaning',
    };
    return titles[String(code || '')] || 'Compliance adjustment';
  }

  private normalizeCompliancePrinciple(value: string | null | undefined): string {
    const raw = String(value || '').trim().toUpperCase();
    const code = raw.match(/\b(A[1-3]|B[1-2]|C|D|E)\b/)?.[1] || raw.match(/\b([AB])[\s.-]*([1-3])\b/)?.slice(1).join('') || raw;
    return code === 'B' ? 'B2' : code;
  }

  private seedRemediationSegments(text: string): string[] {
    const byLine = String(text || '')
      .split(/\r?\n+/)
      .map(item => item.trim())
      .filter(Boolean);
    return byLine.length ? byLine : [String(text || '').trim()].filter(Boolean);
  }

  private remediationIntro(code: string): string {
    const intros: Record<string, string> = {
      A1: 'Review the semantic units and apply the adjusted segmentation before re-analysis.',
      B1: 'Separate combined assurances into standalone attestations before re-analysis.',
      A2: 'Use the section-supported rewrite to make missing key elements explicit where there is a basis.',
      A3: 'Use the section-supported rewrite to clarify modality and communicative function.',
      B2: 'Use the section-supported rewrite to replace vague or subjective language.',
      C: 'Use the section-supported rewrite to anchor the attestation in auditable criteria.',
      D: 'Use the section-supported rewrite to make the statement easier to represent structurally.',
      E: 'Use the section-supported rewrite, then review the proposed text against the original meaning.',
    };
    return intros[code] || 'Adjust the attestation and re-run compliance analysis.';
  }

  private getNormalizedCommodityList(values: string[] | null | undefined): string[] {
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

}
