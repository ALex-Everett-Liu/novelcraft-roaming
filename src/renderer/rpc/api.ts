import type { NovelCraftRPCType } from "../../shared/rpc-schema";
import type { RpcResult, Fragment, Chapter, Project, LLMConfig, WorkshopState, ProtagonistProfile, WorldOntology, NovelProfile, PluginInfo } from "../../shared/types";

type RequestFn = (method: string, params?: any) => Promise<any>;

let rpcRequest: RequestFn | null = null;

export function initApi(request: RequestFn): void {
  rpcRequest = request;
}

function req<T>(method: string, params?: any): Promise<T> {
  if (!rpcRequest) throw new Error("API not initialized");
  console.log("[api] RPC ->", method, params);
  return rpcRequest(method, params ?? {}).then((result: any) => {
    const summary = result === undefined ? "(void)" : JSON.stringify(result).slice(0, 120);
    console.log("[api] RPC <-", method, summary);
    return result;
  }).catch((err: any) => {
    console.error("[api] RPC ERR", method, err);
    throw err;
  });
}

export const api = {
  // Project
  projectCreate: (params: { name: string }) =>
    req<RpcResult<Project>>("projectCreate", params),
  projectGet: (id: string) =>
    req<RpcResult<Project>>("projectGet", { id }),
  projectsList: () =>
    req<RpcResult<Project[]>>("projectsList", {}),

  // Fragments
  fragmentsList: (projectId: string) =>
    req<RpcResult<Fragment[]>>("fragmentsList", { projectId }),
  fragmentsGet: (id: string) =>
    req<RpcResult<Fragment>>("fragmentsGet", { id }),
  fragmentsCreate: (params: any) =>
    req<RpcResult<Fragment>>("fragmentsCreate", params),
  fragmentsUpdate: (params: any) =>
    req<RpcResult<Fragment>>("fragmentsUpdate", params),
  fragmentsDelete: (id: string) =>
    req<RpcResult<void>>("fragmentsDelete", { id }),
  fragmentsReorder: (orderedIds: string[]) =>
    req<RpcResult<void>>("fragmentsReorder", { orderedIds }),

  // Chapters
  chaptersList: (projectId: string) =>
    req<RpcResult<Chapter[]>>("chaptersList", { projectId }),
  chaptersCreate: (params: any) =>
    req<RpcResult<Chapter>>("chaptersCreate", params),

  // Import
  importTxt: (params: { projectId: string; content: string; delimiter?: string }) =>
    req<RpcResult<Fragment[]>>("importTxt", params),

  // Config
  configGet: () =>
    req<RpcResult<LLMConfig>>("configGet", {}),
  configSave: (config: LLMConfig) =>
    req<RpcResult<void>>("configSave", { config }),

  // Agent
  agentRun: (params: { mode: string; fragmentIds: string[]; contextFragmentIds?: string[]; characterName?: string }) =>
    req<RpcResult<void>>("agentRun", params),
  agentCancel: () =>
    req<RpcResult<void>>("agentCancel", {}),

  // Workshop
  workshopStart: (fragmentId: string, extra?: { segmentText?: string }) =>
    req<RpcResult<WorkshopState>>("workshopStart", { fragmentId, ...extra }),
  workshopAnswer: (params: {
    fragmentId: string;
    answers: { questionId: string; answer: string }[];
    questions: { id: string; question: string }[];
    history: { role: string; content: string }[];
  }) =>
    req<RpcResult<void>>("workshopAnswer", params),
  workshopRevise: (params: { fragmentId: string; discussion: string }) =>
    req<RpcResult<void>>("workshopRevise", params),
  workshopAccept: (fragmentId: string) =>
    req<RpcResult<Fragment>>("workshopAccept", { fragmentId }),

  // Plugin management
  listPlugins: () =>
    req<RpcResult<PluginInfo[]>>("listPlugins", {}),
  enablePlugin: (pluginId: string) =>
    req<RpcResult<void>>("enablePlugin", { pluginId }),
  disablePlugin: (pluginId: string) =>
    req<RpcResult<void>>("disablePlugin", { pluginId }),

  // Save / Discard
  commitSave: () =>
    req<RpcResult<void>>("commitSave", {}),
  restoreFromBackup: () =>
    req<RpcResult<void>>("restoreFromBackup", {}),
  hasBackup: () =>
    req<RpcResult<boolean>>("hasBackup", {}),
  reportUnsavedState: (hasUnsaved: boolean) =>
    req<void>("reportUnsavedState", { hasUnsaved }),

  // LLM Logs
  getLlmLogs: () =>
    req<RpcResult<any[]>>("getLlmLogs", {}),

  // Context Extraction
  protagonistExtract: (params: { projectId: string; fragmentIds?: string[]; characterName?: string }) =>
    req<RpcResult<void>>("protagonistExtract", params),
  worldOntologyExtract: (params: { projectId: string; fragmentIds?: string[] }) =>
    req<RpcResult<void>>("worldOntologyExtract", params),
  bridgeExtract: (params: { projectId: string }) =>
    req<RpcResult<void>>("bridgeExtract", params),
  contextExtract: (params: { projectId: string; fragmentIds?: string[] }) =>
    req<RpcResult<void>>("contextExtract", params),
  extractionCancel: () =>
    req<RpcResult<void>>("extractionCancel", {}),
  protagonistGet: (projectId: string) =>
    req<RpcResult<ProtagonistProfile | null>>("protagonistGet", { projectId }),
  worldOntologyGet: (projectId: string) =>
    req<RpcResult<WorldOntology | null>>("worldOntologyGet", { projectId }),
  contextGet: (projectId: string) =>
    req<RpcResult<any[] | null>>("contextGet", { projectId }),
  novelProfileSave: (params: { projectId: string; novelProfile: NovelProfile }) =>
    req<RpcResult<void>>("novelProfileSave", params),
  protagonistProfileSave: (params: { projectId: string; profile: ProtagonistProfile }) =>
    req<RpcResult<void>>("protagonistProfileSave", params),
  worldOntologySave: (params: { projectId: string; profile: WorldOntology }) =>
    req<RpcResult<void>>("worldOntologySave", params),
  profileSnapshotSave: (params: { projectId: string; type: string; profile: any }) =>
    req<RpcResult<{ snapshotPath: string | null }>>("profileSnapshotSave", params),
};
