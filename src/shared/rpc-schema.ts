import type {
  RpcResult,
  Fragment,
  Chapter,
  Project,
  LLMConfig,
  AgentMode,
  WorkshopState,
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
    };
    messages: {
      streamChunk: { content: string };
      streamDone: { fullText: string };
      streamError: { message: string; code?: string };
      workshopStateChanged: WorkshopState;
    };
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};
