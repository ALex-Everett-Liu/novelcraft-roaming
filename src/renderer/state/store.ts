import { signal } from "@preact/signals";
import type { Fragment, Chapter, Project, LLMConfig, AgentMode, WorkshopState, ProtagonistProfile, WorldOntology, NovelProfile } from "../../shared/types";
import { api } from "../rpc/api";

export interface ExtractionState {
  type: string;
  streamText: string;
  complete: boolean;
  result: any | null;
  statusMessage: string;
  error: string;
  batch: number;
  totalBatches: number;
  characterName?: string;
  diff?: any | null;
  previousProfile?: any | null;
  snapshotPath?: string | null;
}

export interface AppState {
  project: Project | null;
  fragments: Fragment[];
  chapters: Chapter[];
  selectedFragmentIds: string[];
  focusedFragmentId: string | null;
  agentMode: AgentMode | null;
  streamText: string;
  streamComplete: boolean;
  workshopState: WorkshopState | null;
  extraction: ExtractionState | null;
  protagonistProfile: Record<string, ProtagonistProfile> | null;
  worldOntology: WorldOntology | null;
  activeCharacter: string | null;
  llmConfig: LLMConfig | null;
  loading: boolean;
  unsavedCount: number;
}

function createDefaultState(): AppState {
  return {
    project: null,
    fragments: [],
    chapters: [],
    selectedFragmentIds: [],
    focusedFragmentId: null,
    agentMode: null,
    streamText: "",
    streamComplete: false,
    workshopState: null,
    extraction: null,
    protagonistProfile: null,
    worldOntology: null,
    activeCharacter: null,
    llmConfig: null,
    loading: true,
    unsavedCount: 0,
  };
}

class Store {
  state = signal<AppState>(createDefaultState());

  async initialLoad(): Promise<void> {
    this.update({ loading: true });

    try {
      let project: Project | null = null;

      const listRes = await api.projectsList();
      if (listRes.success && listRes.data && listRes.data.length > 0) {
        project = listRes.data[0];
      } else {
        const res = await api.projectCreate({ name: "Untitled Project" });
        if (res.success && res.data) project = res.data;
      }

      if (project) {
        this.update({ project });
        await this.loadFragments();
        await this.loadChapters();
        await this.loadProfiles();
      }

      // Load LLM config
      const configRes = await api.configGet();
      if (configRes.success && configRes.data) {
        this.update({ llmConfig: configRes.data });
      }
    } catch (e) {
      console.error("[store] initialLoad failed:", e);
    }

    this.update({ loading: false });
  }

  async loadFragments(): Promise<void> {
    const project = this.state.value.project;
    if (!project) return;
    const res = await api.fragmentsList(project.id);
    if (res.success && res.data) {
      this.update({ fragments: res.data });
    }
  }

  async loadChapters(): Promise<void> {
    const project = this.state.value.project;
    if (!project) return;
    const res = await api.chaptersList(project.id);
    if (res.success && res.data) {
      this.update({ chapters: res.data });
    }
  }

  async switchProject(project: Project): Promise<void> {
    this.update({
      project,
      fragments: [],
      chapters: [],
      selectedFragmentIds: [],
      focusedFragmentId: null,
      agentMode: null,
      streamText: "",
      streamComplete: false,
      workshopState: null,
      extraction: null,
      protagonistProfile: null,
      worldOntology: null,
      activeCharacter: null,
    });
    await this.loadFragments();
    await this.loadChapters();
    await this.loadProfiles();
  }

  async createFragment(content?: string): Promise<Fragment | null> {
    const project = this.state.value.project;
    if (!project) {
      console.error("[store] createFragment: no project loaded");
      return null;
    }

    const res = await api.fragmentsCreate({
      projectId: project.id,
      content: content ?? "",
    });

    console.log("[store] fragmentsCreate response:", res);

    if (res.success && res.data) {
      const fragment = res.data;
      this.update({
        fragments: [...this.state.value.fragments, fragment],
        focusedFragmentId: fragment.id,
      });
      this.markModified();
      return fragment;
    }
    return null;
  }

  async updateFragment(id: string, updates: Record<string, any>): Promise<void> {
    console.log("[store] updateFragment called:", id, updates);
    const res = await api.fragmentsUpdate({ id, ...updates });
    console.log("[store] fragmentsUpdate response:", res);
    if (res.success && res.data) {
      const fragments = this.state.value.fragments.map((f) =>
        f.id === id ? res.data! : f
      );
      this.update({ fragments });
      this.markModified();
    }
  }

  async deleteFragment(id: string): Promise<void> {
    const res = await api.fragmentsDelete(id);
    if (res.success) {
      const fragments = this.state.value.fragments.filter((f) => f.id !== id);
      const selectedFragmentIds = this.state.value.selectedFragmentIds.filter(
        (sid) => sid !== id
      );
      this.update({
        fragments,
        selectedFragmentIds,
        focusedFragmentId:
          this.state.value.focusedFragmentId === id
            ? null
            : this.state.value.focusedFragmentId,
      });
      this.markModified();
    }
  }

  selectFragment(id: string, multi: boolean = false): void {
    const current = this.state.value.selectedFragmentIds;
    if (multi) {
      const next = current.includes(id)
        ? current.filter((sid) => sid !== id)
        : [...current, id];
      this.update({ selectedFragmentIds: next, focusedFragmentId: id });
    } else {
      this.update({ selectedFragmentIds: [id], focusedFragmentId: id });
    }
  }

  setAgentMode(mode: AgentMode | null): void {
    this.update({ agentMode: mode, streamText: "", streamComplete: false, workshopState: null });
  }

  appendStreamChunk(chunk: string): void {
    this.update({ streamText: this.state.value.streamText + chunk });
  }

  markStreamComplete(): void {
    this.update({ streamComplete: true });
  }

  clearStream(): void {
    this.update({ streamText: "", streamComplete: false });
  }

  setWorkshopState(state: WorkshopState): void {
    this.update({ workshopState: state });
  }

  setActiveCharacter(name: string): void {
    this.update({ activeCharacter: name });
  }

  // ===== Extraction =====
  async startExtraction(type: string, projectId: string, fragmentIds?: string[], characterName?: string): Promise<void> {
    this.update({
      extraction: { type, streamText: "", complete: false, result: null, statusMessage: "", error: "", batch: 0, totalBatches: 0, characterName },
    });
    if (type === "protagonist") {
      await api.protagonistExtract({ projectId, fragmentIds, characterName });
    } else if (type === "worldview") {
      await api.worldOntologyExtract({ projectId, fragmentIds });
    } else if (type === "bridge") {
      await api.bridgeExtract({ projectId });
    }
  }

  appendExtractionChunk(type: string, chunk: string): void {
    const e = this.state.value.extraction;
    if (!e || e.type !== type) return;
    this.update({ extraction: { ...e, streamText: e.streamText + chunk } });
  }

  updateExtractionProgress(type: string, batch: number, totalBatches: number): void {
    const e = this.state.value.extraction;
    if (!e || e.type !== type) return;
    this.update({ extraction: { ...e, batch, totalBatches } });
  }

  completeExtraction(type: string, result: any, statusMessage: string, diff?: any, previousProfile?: any, snapshotPath?: string, characterName?: string): void {
    const e = this.state.value.extraction;
    if (!e || e.type !== type) return;
    const updates: any = {
      extraction: { ...e, complete: true, result, statusMessage, diff, previousProfile, snapshotPath },
    };
    if (type === "protagonist" && typeof result === "object" && result !== null) {
      updates.protagonistProfile = result;
      if (characterName) updates.activeCharacter = characterName;
    }
    if (type === "worldview") {
      updates.worldOntology = result;
    }
    this.update(updates);
    this.markModified();
  }

  errorExtraction(type: string, message: string): void {
    const e = this.state.value.extraction;
    if (!e || e.type !== type) return;
    this.update({ extraction: { ...e, complete: true, error: message } });
  }

  cancelExtraction(): void {
    api.extractionCancel();
    this.update({ extraction: null });
  }

  async saveProtagonistProfile(name: string, profile: any): Promise<boolean> {
    const project = this.state.value.project;
    if (!project) return false;
    const map = { ...(this.state.value.protagonistProfile || {}) };
    map[name] = profile;
    const res = await api.protagonistProfileSave({ projectId: project.id, profile: map });
    if (res.success) {
      this.update({ protagonistProfile: map, activeCharacter: name });
      this.markModified();
      return true;
    }
    return false;
  }

  async saveWorldOntology(profile: any): Promise<boolean> {
    const project = this.state.value.project;
    if (!project) return false;
    const res = await api.worldOntologySave({ projectId: project.id, profile });
    if (res.success) {
      this.update({ worldOntology: profile });
      this.markModified();
      return true;
    }
    return false;
  }

  async loadProfiles(): Promise<void> {
    const project = this.state.value.project;
    if (!project) return;
    const pRes = await api.protagonistGet(project.id);
    if (pRes.success && pRes.data) {
      const map = pRes.data;
      this.update({
        protagonistProfile: map,
        activeCharacter: this.state.value.activeCharacter || Object.keys(map)[0] || null,
      });
    }
    const wRes = await api.worldOntologyGet(project.id);
    if (wRes.success && wRes.data) {
      this.update({ worldOntology: wRes.data });
    }
  }

  async saveLLMConfig(config: LLMConfig): Promise<void> {
    const res = await api.configSave(config);
    if (res.success) {
      this.update({ llmConfig: config });
    }
  }

  async saveAll(): Promise<void> {
    await api.commitSave();
    this.update({ unsavedCount: 0 });
  }

  async discardAll(): Promise<void> {
    await api.restoreFromBackup();
    this.update({ unsavedCount: 0 });
    await this.initialLoad();
  }

  markModified(): void {
    this.update({ unsavedCount: this.state.value.unsavedCount + 1 });
    api.reportUnsavedState(true);
  }

  hasUnsavedChanges(): boolean {
    return this.state.value.unsavedCount > 0;
  }

  private update(partial: Partial<AppState>): void {
    this.state.value = { ...this.state.value, ...partial };
  }
}

export const store = new Store();
