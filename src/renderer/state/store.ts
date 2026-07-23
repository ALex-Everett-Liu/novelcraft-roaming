import { signal, computed } from "@preact/signals";
import type { Fragment, Chapter, Project, LLMConfig, AgentMode, WorkshopState } from "../../shared/types";
import { api } from "../rpc/api";

const STORAGE_KEY = "novelcraft_last_project";

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
      // Try to find existing project or create default
      const existingId = localStorage.getItem(STORAGE_KEY);
      let project: Project | null = null;

      if (existingId) {
        const res = await api.projectGet(existingId);
        if (res.success && res.data) project = res.data;
      }

      if (!project) {
        const res = await api.projectCreate({ name: "Untitled Project" });
        if (res.success && res.data) {
          project = res.data;
          localStorage.setItem(STORAGE_KEY, project.id);
        }
      }

      if (project) {
        this.update({ project });
        await this.loadFragments();
        await this.loadChapters();
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
    this.update({ streamText: "", streamComplete: false, workshopState: null });
  }

  setWorkshopState(state: WorkshopState): void {
    this.update({ workshopState: state });
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
