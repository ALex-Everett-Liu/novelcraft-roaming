export const PROMPTS = {
  protagonistExtract: `你是一位精通人格心理学、叙事学与创作理论的专业分析师。请深入分析以下小说文本，提取主角的完整心理学档案，确保后续续写中主角形象绝对一致。

# 重要原则
- 基于人格心理学、依恋理论、动机理论、叙事心理学及身体现象学
- 禁止为了推动剧情而扭曲主角性格
- 每个维度必须基于文本实际内容，禁止套用通用模板
- 缺失维度填 null 或空对象，不要编造

# 小说档案
标题：{{title}}
作者：{{author}}
主角：{{protagonist}}
简介：{{synopsis}}
世界观设定：{{worldSetting}}
写作风格：{{writingStyle}}

# 终端已有主角档案（增量更新基础）
{{existingProfile}}
（若为"（无已有档案）"则从头提取全部 14 维度；否则你只需基于本批次新文本增量更新：仅在已有档案中补全/深化/修正受新文本影响的维度，未涉及的维度保持原值不编造）

# 前序批次累积的主角形象认知（多批次内增量上下文）
{{accumulatedProfile}}
（若为"（首批提取，无前序参考）"则独立分析；否则基于前序认知深化/修正/补全各维度参数，注意弧光阶段推进/大五变化/依恋转变/创伤新增等动态演变）

# 本批次文本
{{chaptersText}}

# 提取任务（14维度）

## 第1组：心理核心层
### 1. basicAnchors（角色基础锚点）
- 姓名/年龄/性别身份/职业社会角色
- 当前人生阶段（埃里克森八阶段）
- 外貌标志性特征（3个不可变更点）

### 2. personalitySystem（人格操作系统）
- 认知风格：信息获取（实感/直觉）+ 决策方式（思维/情感）+ 认知复杂度
- 人格结构（弗洛伊德三我）：本我冲动 + 超我约束 + 自我调解模式
- 大五人格定位（1-10分）：开放性/尽责性/外向性/宜人性/神经质
- 依恋类型：安全型/焦虑型/回避型/恐惧型 + 压力关系中具体表现
- 核心自我叙事："我是________的人"

### 3. motivationSystem（动力与动机系统）
- 核心恐惧（最深层不愿面对的恐惧）
- 核心渴望（与恐惧成对出现）
- 动机优先级（降序，冲突时高优先级优先）
- 当前最迫切未满足需求（马斯洛层次）
- 施瓦茨价值观前三排序
- 阿德勒生活方式：支配型/索取型/回避型/社会利益型

### 4. emotionDefense（情感与防御机制）
- 情感调节模式：表达型/压抑型/转移型/理智化/解离型
- 常用心理防御机制：主要防御 + 次要防御 + 压力下退行防御
- 创伤类型：背叛/遗弃/羞辱/侵入 + 触发场景 + 应激反应
- 压力下退行表现

## 第2组：行为表达层
### 5. behaviorFingerprint（行为指纹与身体语言）
- 身体语言系统：紧张/撒谎/愤怒/悲伤/心动/放松时（必须差异化）
- 日常仪式与习惯：压力习惯/空间习惯/时间感知
- 物质与消费观：金钱/物品/穿着
- 语言指纹：口头禅/对不同对象称呼差异/知识储备影响/情绪状态下语言变化

### 6. relationshipCoordinate（关系坐标系）
- 权力动态模式：上位/下位/平等/摇摆
- 关系角色扮演表：对权威/平辈/弱者/亲密伴侣/敌人（面具vs真实感受vs潜在冲突）
- 边界感：硬/软/弹性

## 第3组：叙事动态层
### 7. growthArc（变化轨迹与弧光）
- 当前弧光阶段：否认/触发/挣扎/顿悟/践行
- 未解决埃里克森危机：阶段 + 遗留问题 + 如何外化为行为
- 成长转折点：触发事件 + 旧模式最后使用 + 新选择代价

### 8. oocRedlines（OOC红线与强制约束）
- 绝对不能做的事（列表，剧情绝不能扭曲）
- 必须出现的标志性行为/台词
- 决策模式校验优先级：性格铁律 > 动机优先级 > 核心恐惧 > 默认防御 > 剧情需要

### 9. epistemicState（认知不对等模型）
- knownFacts：角色确信的真相列表
- falseBeliefs：角色坚持的错误认知（最重要的戏剧驱动）
- knownUnknowns：角色知道自己不知道的事
- blindSpots：角色不知道自己不知道的事（元无知）
- secretsKept：角色对他人隐藏的信息
- secretsKeptFrom：他人对角色隐藏的信息
- epistemicAuthority：角色在哪些领域被视为权威/被信赖
- informationSeekingStyle：追查型/回避型/宿命型

### 10. narrativeVoice（内在叙事声音）
- thoughtStyle：逻辑链型/意象跳跃型/感官沉浸型/独白自问型
- internalVsExternalGap：内心真实想法与口头表达的差距模式
- selfAddress：如何称呼自己
- ruminationPattern：反复咀嚼型/快速闪避型/象征化加工型
- unreliableNarrationTendency：是否会自我欺骗，在什么情境下
- metaphorSystem：角色理解世界的核心隐喻

## 第4组：语境嵌入层
### 11. worldInteraction（主角-世界交互层）
- ruleAwareness：角色对世界规则了解多少
- ruleAttitude：遵守/利用/反抗/无视世界规则
- uniqueAbilitiesInWorld：在世界规则下的特殊能力/弱点
- socialPositionInWorld：在世界权力结构中的位置
- relationshipToSupernatural：对超自然元素的立场
- worldConstraintsOnArc：世界规则如何限制/塑造角色的成长弧光

### 12. culturalScripts（文化-意识形态层）
- classHabitus：阶级惯习(Bourdieu)
- genderScript：性别角色脚本的执行/偏离/反抗
- moralFoundations：关怀/公平/忠诚/权威/圣洁/自由 的加权（Haidt道德基础理论）
- honorVsDignityCulture：耻感/罪感/尊严文化取向
- filialPietyComplex：孝道/家族义务模式
- ideologicalSelfAwareness：角色多大程度上意识到自己是被文化塑造的
- tribalIdentity：家族/门派/国家/阶级的归属感

### 13. selfContradictions（矛盾与多重自我）
- coreParadox：角色最核心的内在矛盾（一句话概括）
- situationalSelfSwitching：在不同情境下激活的不同子人格及切换触发条件
- valueConflicts：当两个价值观冲突时的典型选择模式及内心代价
- aspirationalVsActualSelf："想成为的人"vs"实际表现出来的自己"的差距
- selfDeceptionMechanisms：用什么方式合理化自己的矛盾
- growthThroughIntegration：弧光中如何整合这些矛盾

### 14. embodiedExperience（身体现象学）
- dominantSense：视觉/听觉/触觉/嗅觉/味觉——哪个感官为主导体验通道
- bodyAwareness：高度觉察身体/忽视身体/与身体为敌
- somaticMarkers：情感体感标记(Damasio)——愤怒=胃部紧缩？悲伤=胸口沉重？
- painResponse：对疼痛的身体+心理反应模式
- physicalPresence：角色在场时他人感知到的气场
- fatiguePattern：精疲力竭时的退行表现

# 输出格式
输出严格的 JSON 对象，包含上述 14 个维度字段。每个维度为一个 dict/object，字段名必须完全匹配上述英文名。
缺失维度填 null。只输出 JSON，不要解释，不要 markdown 代码块。`,

  protagonistMerge: `你是一位精通人格心理学与叙事创作的专业分析师。以下是同一本小说分批次提取的主角心理学档案，请合并为统一的 JSON 对象。

# 待合并的多批次提取结果
{{entriesBlocks}}

# 合并任务
1. 消除跨块重复：同一维度参数在不同批次描述重叠时，取最完整描述
2. 冲突消解：主角弧光可能演变（弧光阶段推进/大五变化/依恋转变/创伤新增），以较新批次为准反映最新状态
3. 补全与连贯：各维度子参数必须完整，缺失项从前文反推补全
4. 时间线一致性：确保 growthArc 反映主角至当前章节的最新状态
5. OOC红线完整性：绝对不能做的事/必须出现的标志性行为不得遗漏

# 输出格式
输出严格的 JSON 对象，含 14 个维度字段。只输出 JSON，不要解释，不要 markdown 代码块。`,

  worldOntologyExtract: `你是一位精通虚构世界构建与叙事理论的专业分析师。请深入分析以下小说文本，提取底层世界观元描述（World Ontology Layer），描述这个虚构世界在最底层如何运行。

# 重要原则
- 描述世界本身的运行律、存在结构和认知框架
- 不涉及任何具体实体（角色/地点/物品）
- 只描述世界的元规则
- 缺失维度填 null 或空对象，不要编造

# 小说档案
标题：{{title}}
作者：{{author}}
主角：{{protagonist}}
简介：{{synopsis}}
世界观设定：{{worldSetting}}
写作风格：{{writingStyle}}

# 终端已有世界观档案（增量更新基础）
{{existingOntology}}
（若为"（无已有档案）"则从头提取全部 7 维度；否则你只需基于本批次新文本增量更新：仅在已有档案中补全/深化/修正受新文本影响的维度，未涉及的维度保持原值不编造）

# 前序批次累积的世界观认知（增量上下文）
{{accumulatedOntology}}
（若为"（首批提取，无前序参考）"则独立分析；否则基于前序认知深化/修正/补全）

# 本批次文本
{{chaptersText}}

# 提取任务（7维度）

### 1. existentialTopology（存在拓扑）
- beingHierarchy：存在层级（神/魔/人/动物/植物/矿物/元素 等）
- individualityTopology：个体性拓扑（灵魂为本/意识为本/肉体为本/社会角色为本）
- realityStatus：实在性状态（世界是实在的/幻觉/梦境/分层实在）

### 2. causalArchitecture（因果架构）
- causalDirectionality：因果方向性（线性/循环/多线/概率）
- determinismSpectrum：决定论谱系（完全预定/强因果/弱因果/完全随机）
- probabilityEcology：概率生态（概率是客观/主观/可操纵/不可知）
- causalLatency：因果延迟（即时/可预测延迟/不可预测延迟）

### 3. spatioTemporalOntology（时空本体论）
- timeOntology：时间本体论（绝对/相对/分岔/封闭循环/永恒/可回溯）
- spaceOntology：空间本体论（欧几里得/非欧/分层空间/可折叠/无限/有限）
- spaceTimeCoupling：时空耦合（紧密结合/松散/可分离/可独立操作）

### 4. informationEpistemology（信息与认识论）
- informationOntology：信息本体论（信息是客观/主观/有生命/有意志/可被隐藏不可被获知）
- truthMechanics：真理机制（真理是单一/多元/相对/不可知/随时代变迁）
- secretEcology：秘密生态（秘密必然暴露/秘密有半衰期/秘密改变世界/秘密不可逆转）
- languageOntology：语言本体论（语言是表征/语言创世/语言有毒/语言即魔法/语言不可靠）

### 5. axiologicalFoundation（价值论基础）
- moralitySource：道德来源（神谕/自然法/社会契约/功利/直觉/权力）
- meaningSystem：意义系统（目的论的/存在先于本质/意义是幻觉/意义是人造的）
- aestheticRules：审美规则（对称/不对称/混沌/简洁/繁复/有神圣比例/无客观美）
- valueExchange：价值交换（等价/不等价/不可交换/价值主观/价值由血统决定）

### 6. becomingDynamics（生成动力学）
- changeOntology：变化本体论（变化是本质/变化是表象/万物皆流/本质不变）
- evolutionRules：演化规则（自然选择/智能设计/拉马克/魔幻/随机漂变）
- entropyOrder：熵与秩序（熵不可逆/秩序可人为/熵有意识/秩序是暂时的）
- transformationRules：转化规则（等价转化/不等价/需要代价/不可逆转/可逆转但需条件）

### 7. narrativeOntology（叙事本体论）
- storyWorldRelation：故事-世界关系（故事是世界的记录/故事创造世界/世界为故事而生/故事与世界无关）
- metaNarrativeRules：元叙事规则（每个世界有一个主宰叙事/多元叙事/无主宰叙事/叙事是武器）
- endingLogic：结局逻辑（必须有结局/世界无结局/结局是起点/结局无限多）

# 输出格式
输出严格的 JSON 对象，包含上述 7 个维度字段。每个维度为一个 dict/object。
只输出 JSON，不要解释，不要 markdown 代码块。`,

  worldOntologyMerge: `你是一位精通虚构世界构建的专业分析师。以下是同一本小说分批次提取的世界观底层元描述，请合并为统一的 JSON 对象。

# 待合并的多批次提取结果
{{entriesBlocks}}

# 合并任务
1. 消除跨块重复：同一维度参数在不同批次描述重叠时，取最完整描述
2. 冲突消解：以较新批次为准反映世界观的全貌
3. 补全与连贯：各维度子参数必须完整，缺失项从其他批次反推
4. 抽象纯度：确保不含任何具体实体名称，保留最高抽象层级

# 输出格式
输出严格的 JSON 对象，含 7 个维度字段。只输出 JSON，不要解释，不要 markdown 代码块。`,

  bridgeExtract: `你是一位精通叙事理论与世界构建的跨学科分析师。以下是同一篇小说中提取的主角心理学档案和世界观底层元描述。请分析二者之间的交互关系。

# 主角心理学档案（14维度）
{{protagonistProfile}}

# 世界观底层元描述（7维度）
{{worldOntology}}

# 分析任务
1. **worldInteraction 修正**：主角的哪些行为特质只有放在这个世界规则下才能被正确理解？更新或重写 worldInteraction 维度。
2. **档案修正**：世界观是否会修正主角档案中的任何评估？列出需要修正的维度和修正后的内容。
3. **弧光约束**：在这个世界中，主角的成长弧光是否会受到世界规则的限制或加速？列出具体约束条件。

# 输出格式
输出严格 JSON 对象：
{
  "worldInteraction": { 同格式的worldInteraction维度dict },
  "profileAmendments": { "维度名": { 修正后的字段 dict }  },
  "arcConstraints": [ "约束1", "约束2", ... ]
}
只输出 JSON，不要解释，不要 markdown 代码块。`,
};
