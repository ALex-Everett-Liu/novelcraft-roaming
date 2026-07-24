import type {
  RpcResult,
  Fragment,
  Chapter,
  Project,
  LLMConfig,
  AgentMode,
  WorkshopState,
  ProtagonistProfile,
  WorldOntology,
  NovelProfile,
  CreateFragmentParams,
  UpdateFragmentParams,
  DeleteFragmentParams,
  ReorderFragmentsParams,
  CreateChapterParams,
  CreateProjectParams,
  AgentRunParams,
  WorkshopStartParams,
  WorkshopAnswerParams,
  WorkshopReviseParams,
  ImportTxtParams,
  SaveLLMConfigParams,
  ProtagonistExtractParams,
  WorldOntologyExtractParams,
  BridgeExtractParams,
  ContextExtractParams,
  NovelProfileSaveParams,
  PluginInfo,
} from "./types";

export type NovelCraftRPCType = {
  bun: {
    requests: {
      // Project
      projectCreate: { params: CreateProjectParams; response: RpcResult<Project> };
      projectGet: { params: { id: string }; response: RpcResult<Project> };
      projectsList: { params: {}; response: RpcResult<Project[]> };

      // Fragments
      fragmentsList: { params: { projectId: string }; response: RpcResult<Fragment[]> };
      fragmentsGet: { params: { id: string }; response: RpcResult<Fragment> };
      fragmentsCreate: { params: CreateFragmentParams; response: RpcResult<Fragment> };
      fragmentsUpdate: { params: UpdateFragmentParams; response: RpcResult<Fragment> };
      fragmentsDelete: { params: DeleteFragmentParams; response: RpcResult<void> };
      fragmentsReorder: { params: ReorderFragmentsParams; response: RpcResult<void> };

      // Chapters
      chaptersList: { params: { projectId: string }; response: RpcResult<Chapter[]> };
      chaptersCreate: { params: CreateChapterParams; response: RpcResult<Chapter> };

      // Import / Export
      importTxt: { params: ImportTxtParams; response: RpcResult<Fragment[]> };

      // Config
      configGet: { params: {}; response: RpcResult<LLMConfig> };
      configSave: { params: SaveLLMConfigParams; response: RpcResult<void> };

      // Agent
      agentRun: { params: AgentRunParams; response: RpcResult<void> };
      agentCancel: { params: {}; response: RpcResult<void> };

      // Workshop
      workshopStart: { params: WorkshopStartParams; response: RpcResult<WorkshopState> };
      workshopAnswer: { params: WorkshopAnswerParams; response: RpcResult<void> };
      workshopRevise: { params: WorkshopReviseParams; response: RpcResult<void> };
      workshopAccept: { params: WorkshopReviseParams; response: RpcResult<Fragment> };

      // Plugin management
      listPlugins: { params: {}; response: RpcResult<PluginInfo[]> };
      getLlmLogs: { params: {}; response: RpcResult<any[]> };
      enablePlugin: { params: { id: string }; response: RpcResult<void> };
      disablePlugin: { params: { id: string }; response: RpcResult<void> };

      // Save / Discard
      commitSave: { params: {}; response: RpcResult<void> };
      restoreFromBackup: { params: {}; response: RpcResult<void> };
      hasBackup: { params: {}; response: RpcResult<boolean> };
      reportUnsavedState: { params: { hasUnsaved: boolean }; response: void };

      // Context Extraction
      protagonistExtract: { params: ProtagonistExtractParams; response: RpcResult<void> };
      worldOntologyExtract: { params: WorldOntologyExtractParams; response: RpcResult<void> };
      bridgeExtract: { params: BridgeExtractParams; response: RpcResult<void> };
      extractionCancel: { params: {}; response: RpcResult<void> };
      protagonistGet: { params: { projectId: string }; response: RpcResult<ProtagonistProfile | null> };
      worldOntologyGet: { params: { projectId: string }; response: RpcResult<WorldOntology | null> };
      contextExtract: { params: ContextExtractParams; response: RpcResult<void> };
      contextGet: { params: { projectId: string }; response: RpcResult<any[] | null> };
      novelProfileSave: { params: NovelProfileSaveParams; response: RpcResult<void> };
    };
    messages: {
      streamChunk: { content: string };
      streamDone: { fullText: string };
      streamError: { message: string; code?: string };
      workshopStateChanged: WorkshopState;
      extractionChunk: { type: string; content: string; phase: string };
      extractionDone: { type: string; result: any; statusMessage: string };
      extractionError: { type: string; message: string; code?: string };
      extractionProgress: { type: string; batch: number; totalBatches: number };
    };
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};
