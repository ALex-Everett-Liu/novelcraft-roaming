export const PROTAGONIST_DIMENSIONS = [
  "basicAnchors",
  "personalitySystem",
  "motivationSystem",
  "emotionDefense",
  "behaviorFingerprint",
  "relationshipCoordinate",
  "growthArc",
  "oocRedlines",
  "epistemicState",
  "narrativeVoice",
  "worldInteraction",
  "culturalScripts",
  "selfContradictions",
  "embodiedExperience",
] as const;

export const ONTOLOGY_DIMENSIONS = [
  "existentialTopology",
  "causalArchitecture",
  "spatioTemporalOntology",
  "informationEpistemology",
  "axiologicalFoundation",
  "becomingDynamics",
  "narrativeOntology",
] as const;

export const PROTAGONIST_DIMENSION_LABELS: Record<string, string> = {
  basicAnchors: "基础锚点",
  personalitySystem: "人格操作系统",
  motivationSystem: "动力与动机系统",
  emotionDefense: "情感与防御机制",
  behaviorFingerprint: "行为指纹与身体语言",
  relationshipCoordinate: "关系坐标系",
  growthArc: "变化轨迹与弧光",
  oocRedlines: "OOC红线与强制约束",
  epistemicState: "认知不对等模型",
  narrativeVoice: "内在叙事声音",
  worldInteraction: "主角-世界交互层",
  culturalScripts: "文化-意识形态层",
  selfContradictions: "矛盾与多重自我",
  embodiedExperience: "身体现象学",
};

export const ONTOLOGY_DIMENSION_LABELS: Record<string, string> = {
  existentialTopology: "存在拓扑",
  causalArchitecture: "因果架构",
  spatioTemporalOntology: "时空本体论",
  informationEpistemology: "信息与认识论",
  axiologicalFoundation: "价值论基础",
  becomingDynamics: "生成动力学",
  narrativeOntology: "叙事本体论",
};

export const OVERWRITE_DIMENSIONS = new Set([
  "basicAnchors",
  "growthArc",
  "oocRedlines",
  "worldInteraction",
  "selfContradictions",
]);

export const PARSE_MAX_TOKENS = 16000;
export const EXTRACT_TEMPERATURE = 0.3;
export const EXTRACT_TEMPERATURE_RETRY = 0.0;
export const BRIDGE_TEMPERATURE = 0.3;
