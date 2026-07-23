import type { NovelCraftRPCType } from "../../shared/rpc-schema";
import type { RpcResult, Fragment, Chapter, Project, LLMConfig, WorkshopState, PluginInfo } from "../../shared/types";

type RequestFn = (method: string, params?: any) => Promise<any>;

let rpcRequest: RequestFn | null = null;

export function initApi(request: RequestFn): void {
  rpcRequest = request;
}

function req<T>(method: string, params?: any): Promise<T> {
  if (!rpcRequest) throw new Error("API not initialized");
  return rpcRequest(method, params ?? {});
}

export const api = {
  // Project
  projectCreate: (params: { name: string }) =>
    req<RpcResult<Project>>("projectCreate", params),
  projectGet: (id: string) =>
    req<RpcResult<Project>>("projectGet", { id }),

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
  agentRun: (params: { mode: string; fragmentIds: string[]; contextFragmentIds?: string[] }) =>
    req<RpcResult<void>>("agentRun", params),
  agentCancel: () =>
    req<RpcResult<void>>("agentCancel", {}),

  // Workshop
  workshopStart: (fragmentId: string) =>
    req<RpcResult<WorkshopState>>("workshopStart", { fragmentId }),
  workshopAnswer: (params: { fragmentId: string; answers: { questionId: string; answer: string }[] }) =>
    req<RpcResult<void>>("workshopAnswer", params),
  workshopRevise: (fragmentId: string) =>
    req<RpcResult<void>>("workshopRevise", { fragmentId }),
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
};
