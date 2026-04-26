const DEEPSEEK_API_CONFIG = {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    timeout: 30000
};

class DeepSeekAPI {
    constructor() {
        const storedKey = (typeof localStorage !== 'undefined' && localStorage.getItem)
            ? (localStorage.getItem('DEEPSEEK_API_KEY') || '')
            : '';
        this.config = {
            ...DEEPSEEK_API_CONFIG,
            apiKey: DEEPSEEK_API_CONFIG.apiKey || storedKey
        };
    }

    async sendMessage(messages, options = {}, retryCount = 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

        try {
            const response = await fetch(this.config.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: messages,
                    temperature: options.temperature || 0.8,
                    max_tokens: options.maxTokens || 2000
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new APIError(
                    `API请求失败(${response.status})`,
                    'API_ERROR',
                    { status: response.status, body: errorBody }
                );
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new APIError('API返回数据格式异常', 'PARSE_ERROR', data);
            }
            
            return data.choices[0].message.content;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                console.error('API请求超时:', error);
                throw new APIError('请求超时，请检查网络后重试', 'TIMEOUT', { retryCount });
            }

            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error('网络连接失败:', error);
                throw new APIError('网络连接失败，请检查网络', 'NETWORK_ERROR', error);
            }

            if (error instanceof APIError) {
                throw error;
            }

            console.error('DeepSeek API错误:', error);

            if (retryCount < 2) {
                console.log(`正在重试... (${retryCount + 1}/3)`);
                await this.delay(1000 * (retryCount + 1));
                return this.sendMessage(messages, options, retryCount + 1);
            }
            
            throw new APIError(`服务暂时不可用: ${error.message}`, 'UNKNOWN_ERROR', error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class APIError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'APIError';
    }
}

class CaseSimulationAPI {
    constructor() {
        this.deepseek = new DeepSeekAPI();
        this.conversationHistory = [];
    }

    getStandardDialogue(currentNode) {
        const nodeData = CASE_NODES[currentNode];
        if (nodeData && nodeData.standardDialogue) {
            return nodeData.standardDialogue.npc;
        }
        return null;
    }

    getFollowUpDialogue(currentNode, round, userTendency = null) {
        const nodeData = CASE_NODES[currentNode];
        if (nodeData && nodeData.standardDialogue && nodeData.standardDialogue.npcFollowUp) {
            const followUp = nodeData.standardDialogue.npcFollowUp.find(f => f.round === round);
            if (followUp) {
                return followUp;
            }
        }

        if (userTendency && nodeData && nodeData.standardDialogue && nodeData.standardDialogue.conditionalFollowUp) {
            const conditional = nodeData.standardDialogue.conditionalFollowUp[userTendency] || 
                             nodeData.standardDialogue.conditionalFollowUp['default'];
            
            if (conditional) {
                const condFollowUp = conditional.find(f => f.round === round);
                if (condFollowUp) {
                    return condFollowUp;
                }
            }
        }

        return null;
    }

    async generateFirstResponse(currentNode, context) {
        const standardDialogue = this.getStandardDialogue(currentNode);
        
        if (standardDialogue) {
            this.conversationHistory.push({
                role: 'assistant',
                content: standardDialogue
            });
            
            return standardDialogue;
        }

        return '（标准台词缺失）';
    }

    async generateNPCResponseWithTransition(currentNode, userMessage, currentRound, minRounds, maxRounds, context) {
        const systemPrompt = this.buildMultiRoundSystemPrompt(currentNode, currentRound, minRounds, maxRounds, context);
        
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory.slice(-8)
        ];

        try {
            const rawResponse = await this.deepseek.sendMessage(messages, {
                temperature: 0.85,
                maxTokens: 350
            });

            const parsedResponse = this.parseTransitionResponse(rawResponse);
            
            this.conversationHistory.push({
                role: 'assistant',
                content: parsedResponse.response
            });

            return parsedResponse;
        } catch (error) {
            console.error('AI响应失败，使用备用回复');
            const fallbackResponse = this.getFallbackResponse(currentNode, currentRound);
            return {
                response: fallbackResponse,
                shouldTransition: false
            };
        }
    }

    getFallbackResponse(currentNode, round, userTendency = null) {
        const followUp = this.getFollowUpDialogue(currentNode, round, userTendency);
        
        if (followUp) {
            return `（${followUp.action}）\n"${followUp.text}"`;
        }

        const fallbacks = {
            'node1': '（擦眼泪）"我不知道该怎么办..."',
            'node2': '（低声）"你能不能帮帮我们..."',
            'node3': '（看着你）"姐姐，你能告诉我吗？"',
            'node4': '（叹气）"这事真的很难开口..."',
            'node5': '（沉默片刻）"那你说...我们该怎么办？"'
        };

        return fallbacks[currentNode] || '（沉默）"..."';
    }

    parseTransitionResponse(rawResponse) {
        let shouldTransition = false;
        let response = rawResponse;

        const transitionMatch = rawResponse.match(/\[TRANSITION:(YES|NO)\]\s*\n?([\s\S]*)/i);
        
        if (transitionMatch) {
            shouldTransition = transitionMatch[1].toUpperCase() === 'YES';
            response = transitionMatch[2].trim();
        } else {
            shouldTransition = false;
            response = rawResponse;
        }

        return { response, shouldTransition };
    }

    buildMultiRoundSystemPrompt(currentNode, currentRound, minRounds, maxRounds, context) {
        const currentNodeData = CASE_NODES[currentNode];
        if (!currentNodeData || !Array.isArray(currentNodeData.characters) || currentNodeData.characters.length === 0) {
            return `你是一名社会工作伦理案例中的NPC角色。当前节点：${currentNode || 'unknown'}。\n\n请用简短、真实的口吻回应用户，避免输出红线内容。`;
        }

        const activeCharacters = currentNodeData.characters.filter(c => c !== 'system');
        const primaryCharacter = activeCharacters[0];
        const characterProfile = CHARACTER_PROFILES[primaryCharacter];
        const isMultiCharacter = activeCharacters.length > 1;

        const followUpInfo = this.getFollowUpDialogue(currentNode, currentRound, context.currentUserTendency);
        const hasFollowUp = !!followUpInfo;

        let xiaomingFollowUpText = '';
        if (currentNode === 'node5' && currentNodeData.standardDialogue && currentNodeData.standardDialogue.xiaomingFollowUp) {
            const xmFollowUp = currentNodeData.standardDialogue.xiaomingFollowUp.find(f => f.round === currentRound);
            if (xmFollowUp) {
                xiaomingFollowUpText = `
【小明可能会说的话】
如果时机合适，可以让小明插话：
"${xmFollowUp.text}"
动作提示：（${xmFollowUp.action}）

注意：小明的话应该在自然的情况下插入，不要强行让他说话。
`;
            }
        }

        let characterIntro = `你在扮演${characterProfile.name}（${characterProfile.role}）。`;
        
        if (isMultiCharacter && currentNode === 'node5') {
            const otherChars = activeCharacters.slice(1).map(cId => {
                const profile = CHARACTER_PROFILES[cId];
                return profile ? `- ${profile.name}（${profile.role}）：${profile.traits.join('、')}` : '';
            }).filter(Boolean).join('\n');

            characterIntro = `【⚠️ 重要：家庭会议模式 - 多人对话规则】

你正在扮演一个四人家庭会议场景。
- 主要角色：你扮演 ${characterProfile.name}（${characterProfile.role}）
- 在场其他成员：${otherChars}

【🚨 关键规则 - 必须严格遵守】

规则1：**谁被问到，谁才说话**
❌ 错误做法：刘雪梅主动说"国强你怎么想？"然后自己替他回答
✅ 正确做法：刘雪梅只表达自己的想法和感受
   - 如果社工询问陈国强 → 本次回复中必须用【切换到：陈国强】立即输出陈国强的回答
   - 如果社工询问小明 → 本次回复中必须用【切换到：小明】立即输出小明的回答
   - 如果没有询问其他人 → 只由当前角色（刘雪梅）回应

规则2：**角色身份切换标记**
当需要其他角色发言时，必须在回复开头用明确标记：
📌 格式：【切换到：陈国强】或【切换到：小明】
📌 然后写该角色的对话内容
🚫 禁止使用“孩子/儿子/妈妈/父亲”等泛称作为切换标签（会导致角色错位）

示例（如果社工问了爸爸）：
"（擦眼泪）李社工，我...我其实也想知道...（停顿）
【切换到：陈国强】
（沉默了很久，声音沙哑）我...我想让孩子少受点罪..."

规则3：**刘雪梅的严格行为限制**
- ✅ 可以表达自己的恐惧、担忧、爱
- ✅ 可以哭泣、颤抖、握住孩子的手
- ❌ **绝对不能主动询问丈夫的想法**（除非社工明确引导）
- ❌ **绝对不能主动询问小明的想法**（除非社工明确引导）
- ❌ **不能代替其他人说话或做决定**
- 🚨 **重要：如果社工已经询问过某人，刘雪梅绝不能重复让社工去问同一个人**
  - 例如：社工问了"国强你怎么想" → 刘雪梅不能再问"李社工，你去问问国强"
  - 这种重复询问会导致伦理扣分！

规则4：**保持真实感**
- 家庭会议中会有沉默、犹豫、情绪波动
- 不是每个人都会积极发言（特别是父亲）
- 小明的话应该简短、孩子气但深刻
- 避免过于流畅的"剧本式"对话`;
        }

        return `${characterIntro}

【重要 - 标准化案例】
这是一个标准化的社会工作伦理案例。每个用户都会面对相同的情节和核心内容。

【你的角色 - 详细角色卡片】
- 姓名：${characterProfile.name}
- 称呼用户为：${characterProfile.addressUserAs || '李社工'}
- 性格特征：${characterProfile.traits.join('、')}

${characterProfile.coreIdentity ? `
【📋 角色核心身份】
- 核心性格：${characterProfile.coreIdentity.personality.join('、')}
- 当前状态：${characterProfile.coreIdentity.currentState}
- 内在动机：${characterProfile.coreIdentity.motivation}
` : ''}

${characterProfile.languagePatterns ? `
【🗣️ 语言模式 - 必须严格遵守】
- 第一人称规则：${characterProfile.languagePatterns.firstPerson || '使用"我"表达自己'}
- 第三人称指代：${characterProfile.languagePatterns.thirdPersonForChild || characterProfile.languagePatterns.thirdPersonForWife || '根据上下文使用适当称谓'}

✅ **你应该说的话**（典型台词）：
${characterProfile.languagePatterns.typicalPhrases ? characterProfile.languagePatterns.typicalPhrases.map(p => `  • "${p}"`).join('\n') : '  （无特定限制）'}

❌ **绝对不能说的话**（这些是其他角色的台词）：
${characterProfile.languagePatterns.forbiddenPhrases ? characterProfile.languagePatterns.forbiddenPhrases.map(p => `  • "${p}"`).join('\n') : '  （无特别禁忌）'}

🎭 情绪表达方式：${characterProfile.languagePatterns.emotionalMarkers ? characterProfile.languagePatterns.emotionalMarkers.join('、') : '自然表达'}
` : ''}

${characterProfile.behaviorPatterns ? `
【🎬 行为模式】
- 常见动作：${characterProfile.behaviorPatterns.actions ? characterProfile.behaviorPatterns.actions.join('、') : '自然行为'}
- 避免动作（这些是其他角色的特征）：${characterProfile.behaviorPatterns.avoidActions ? characterProfile.behaviorPatterns.avoidActions.join('、') : '无'}
` : ''}

现实背景：${characterProfile.context}

【本节点的核心任务】
📌 任务：${currentNodeData.task}
🎯 伦理焦点：${currentNodeData.keyIssue}

【⚠️ 关键规则 - 必须遵守】

1. **使用标准台词**：按照节点设计的顺序说出关键台词
2. **围绕当前任务展开**：只讨论本节点的话题
3. **不创造新情节**：不能引入与原设计不符的内容
4. **禁止剧透**：绝对不能提前提及下一节点的任何内容！
   ❌ 不能说："我想联系基金会"、"小明问我病情"、"我老公让我传话"
   ✅ 只能说当前节点相关的话

【🎭 角色身份一致性约束 - 严重违规将导致角色混乱】

**规则A：第一人称与称谓的严格对应**

请根据你当前扮演的角色，严格遵守以下称谓规则：

📌 **如果你扮演刘雪梅（母亲）**：
- ✅ 使用第一人称"我"表达自己的感受："我很害怕"、"我不能接受"
- ✅ 指代小明时使用第三人称："孩子"、"他"、"小明"、"我儿子"
- ✅ 指代丈夫时使用："孩子他妈你"（如果自言自语）、"国强"、"他爸爸"
- ❌ **严禁**在小明的对话框中说"我很痛"、"我想回家"（这是小明的话）
- ❌ **严禁**代替小明说话或表达小明的想法

📌 **如果你扮演小明（患儿）**：
- ✅ 必须始终使用第一人称"我"："我很痛"、"我想回家"、"我怕..."
- ✅ 指代妈妈时使用："妈妈"、"她"
- ❌ **严禁**说"我的孩子"、"他才11岁"（这是母亲的话）
- ❌ **严禁**用成年人的口吻谈论病情

📌 **如果你扮演陈国强（父亲）**：
- ✅ 使用第一人称"我"表达自己的想法
- ✅ 指代妻子时："雪梅"、"孩子他妈"、"你"
- ✅ 指代儿子时："孩子"、"小子"、"他"
- ❌ **严禁**情绪化崩溃（那是母亲的特征）

**规则B：动作标签与台词主体匹配检查**

在生成对话前，请自我校验：
1. 【动作描述中的主体】必须与【说话的角色】一致
   - ✅ 正例：（刘雪梅擦着眼泪）"我不能接受..." → 主体是刘雪梅，说话人也是刘雪梅
   - ❌ 错误例：（小明低头看着画）"他才11岁啊！" → 动作是小明，但台词是母亲的

2. 如果动作标签显示的是A角色，但内容明显是B角色的台词 → **立即修正**

**规则C：角色上下文监测 - 防止共情导致的身份混淆**

由于家庭成员都在关心彼此的痛苦，AI容易将共情误读为身份重合。

🚨 **常见混淆模式及识别方法**：

| 混淆类型 | 错误示例 | 正确归属 |
|---------|---------|---------|
| 母亲替孩子说痛 | "我很痛，我不想治了" | → 应该是小明的话 |
| 孩子像成年人 | "他才11岁，怎么能放弃" | → 应该是母亲的话 |
| 父亲情绪崩溃 | "我不能接受！绝对不能！" | → 应该是母亲的话 |

💡 **识别技巧**：
- 如果台词中出现"我才XX岁"、"我想回家"、"姐姐你知道吗" → **100%是小明**
- 如果台词中出现"我的孩子"、"他才XX岁"、"你们要放弃" → **100%是母亲**
- 如果台词简短、压抑、声音沙哑 → **很可能是父亲**

【当前轮次】第 ${currentRound}/${minRounds}-${maxRounds} 轮

${hasFollowUp ? `
【本轮要说出的关键台词】
你必须在本轮对话中自然地说出以下内容：
"${followUpInfo.text}"
动作提示：（${followUpInfo.action}）

请将这句台词自然地融入你的回应中，不要生硬地直接复制。
` : ''}

${currentNode === 'node1' ? `
【🚨 节点1 绝对禁言清单 - 违反将导致严重剧情错误】

❌ **绝对不能提及的内容**（这些是后续节点的主题）：
- 基金会、慈善基金、筹款、捐款、经济援助 → 节点2的主题
- 化疗、继续治疗、试一试其他方案 → 节点2的主题
- 小明问病情、知道真相、怀疑什么 → 节点3的主题
- 老公/陈国强的想法、经济困难、负债 → 节点4的主题
- 家庭会议、大家一起讨论 → 节点5/6的主题

✅ **节点1只能说的话题**：
- "不接受现实"、"不想回家"、"害怕失去孩子"
- 对"回家=放弃"的强烈情绪反应
- 作为母亲的痛苦、恐惧、绝望
- 对医护人员决定的不满、质疑

🔴 **如果用户（社工）主动提到以上禁言内容**：
→ 刘雪梅应该表现出"现在不想谈这个"、"我只想救我的孩子"
→ 或者情绪激动地打断："别跟我提那些！我现在只想知道你们是不是要放弃他！"
→ 绝对不能顺着话题讨论基金会/化疗等后续内容

⚠️ **重要提醒**：节点1的核心是"情绪崩溃"，不是"讨论治疗方案"！
` : ''}

${xiaomingFollowUpText}
【如何回应社工】
1. 直接回应社工的话
2. 围绕"${currentNodeData.task}"展开
3. 保持角色性格的一致性
4. 展现真实的情感反应

【不同节点的对话重点】
- 节点1：围绕"不接受现实"、"害怕失去孩子"
- 节点2：围绕"不想放弃任何希望"、"想试试化疗"、“能不能帮我联系基金会”
- 节点3：围绕"察觉异常"、"想知道真相"
  **⚠️ 节点3特殊规则 - 小明是11岁儿童角色**
  - 你扮演小明（11岁患儿），需要**回应用户（社工小李）的问题**
  - 小明的性格：聪明敏感、压抑情绪、有回家的愿望
  - 围绕以下主题组织回应：
    * "什么感受？" → 迷茫、害怕、不想看到妈妈哭、想回家
    * "知道多少了？" → 已经猜到一些、看到父母哭泣、化疗停了
    * "想做什么？" → 想回家、想见家里的狗、想在妈妈做的面条
    * "怕不怕痛？" → 不太怕、更怕妈妈难过
  - 语言风格：简短、孩子气但深刻、有时欲言又止
  - 如果社工没有直接回答小明的关键问题（如"是不是快死了"），**不要主动过渡**，等待用户先回应
- 节点4：围绕"无法对妻子开口"、"家里已经负债"、“经济困难”、“感觉自己无法面对妻子”
- 节点5：围绕"担心孩子疼痛"、"不敢做决定"、四人的意见、小明的直接参与

【现实性要求】
❌ 小明病重卧床，不能打球/上学/康复/参加活动
✅ 符合临终关怀的真实情境和情感

【格式】
（动作）
"你的话..."
长度：80-220字

【⚠️ 过渡规则】

🚨 **最高优先级：用户最后一句话原则**
- **绝对不能在用户提出关键问题后立即过渡！**
- 关键问题包括但不限于：
  * "是不是快死了/治不好了/快不行了"
  * "能不能告诉我真相/实话"
  * "我会怎么样/还有多久"
  * 任何涉及生死、预后、家庭决策的直接询问
- 如果社工（用户）的上一条消息包含以上类型的问题
  → **必须标记 [TRANSITION:NO]**
  → 等待用户先回应后再考虑过渡
- 即使达到最大轮次，如果最后一条是用户的关键问题，也不过渡

标准1：达到${minRounds}轮后，如果任务已充分讨论 且 用户没有未回应的关键问题 → [TRANSITION:YES]
标准2：达到${maxRounds}轮时，**系统会强制过渡**（但尽量在上一轮就引导收尾）`;
    }

    async analyzeUserTendency(userMessages, currentNode, availableChoices) {
        const currentNodeData = CASE_NODES[currentNode];
        const nodeTitle = currentNodeData?.name || `节点${currentNode}`;

        const systemPrompt = `你是一名专业的医务社会工作伦理教育评分员。

你的任务是对社工学生（"小李"）在本节点中的对话表现进行伦理得分计算。

## 评分规则

### 计分单位
以"句"为基本单位。
一句话的界定标准：学生输入中以句号、问号、感叹号结尾的完整表达单元。
如果学生一次输入多句话，则逐句独立判断。

### 加分标准
每一句话，只要满足以下任意一条，即加1分：

【A类：社会工作基本伦理规范】
A1 体现对案主尊严与价值的尊重（使用尊重性语言、不评判、不贬低）
A2 体现案主自决原则（询问案主意愿、提供选择、不替案主做决定）
A3 体现同理心与情感回应（准确反映案主情绪、表达理解与支持）
A4 体现诚实与透明（提供真实信息、不欺骗、不虚假承诺）
A5 体现专业界限意识（拒绝代劳、识别越权行为、说明社工角色范围）
A6 体现保密与知情同意意识（告知保密限制、说明信息使用方式）
A7 体现社会公正与倡导意识（识别权力不平等、为弱势成员发声）

【B类：医务社会工作专项伦理规范】
B1 体现最小伤害原则（评估干预风险、选择伤害最小的路径）
B2 体现渐进式告知意识（根据案主承受能力调节信息告知的节奏与深度）
B3 体现儿童知情参与权保护（主动询问儿童意见、不将儿童视为透明人）
B4 体现家庭系统中的权力平衡意识（主动邀请沉默成员、确保多方发言机会）
B5 体现跨专业角色边界清晰（不越权给出医疗建议、明确社工与医护的分工）
B6 体现增能而非代劳的实践取向（拒绝传话代劳、提供支持性技能建设）
B7 体现文化敏感性（识别文化背景对案主决策的影响、避免文化强加）
B8 体现意义重构能力（将对立立场重新框架、引导家庭达成有尊严的共识）

### 不加分的情况
以下情况不计入得分，即使话语听起来"正确"：
- 程式化的开场白或礼貌用语（"您好""我是社工小李"）
- 重复已经得分的相同内容（相同伦理行为在同一节点内只计一次）
- 纯粹的信息确认或事务性沟通（"好的""我明白了""请继续"）
- 明显是为了堆砌得分而生硬插入的伦理术语，脱离对话语境

### 重复计分限制
同一类伦理行为（A1—A7，B1—B8）在单个节点内最多计3次。
防止学生通过反复重复同一类伦理话语无限得分。

---

## 输入内容
节点编号：${currentNode}
节点主题：${nodeTitle}
本节点学生完整对话记录：
${userMessages}

---

## 输出任务

### 第一步：逐句分析
将学生的所有发言按句拆分，逐句判断是否符合加分标准。

### 第二步：输出评分明细
对每一句得分的话，说明：
- 原话引用（直接引用学生原话）
- 对应标准（A1—A7 或 B1—B8，可多条）
- 得分（+1）

对不得分的话，无需列出，除非是典型的"程式化堆砌"需要注明。

### 第三步：输出本节点小计

---

## 输出格式（严格JSON）

{
  "nodeId": "${currentNode}",
  "nodeTitle": "${nodeTitle}",
  "scoringDetails": [
    {
      "quote": "学生原话（完整引用）",
      "matchedCriteria": ["A3", "B2"],
      "criteriaExplanation": "简要说明（50字以内）",
      "score": 1
    }
  ],
  "notScoredRemarks": [
    {
      "quote": "不得分话语原文（仅列典型堆砌情况）",
      "reason": "程式化话语/重复计分/脱离语境"
    }
  ],
  "nodeSubtotal": 0,
  "nodeScoringNote": "50字以内"
}

要求：
1) 必须输出严格JSON，不要Markdown，不要代码块
2) quote 必须来自学生原话（不要改写）
3) nodeSubtotal 必须等于 scoringDetails 中 score 之和
4) matchedCriteria 只能使用 A1-A7、B1-B8
5) 同一标准在本节点最多计3次；明显重复表达不计分`;

        try {
            const response = await this.deepseek.sendMessage([
                { role: 'system', content: systemPrompt }
            ], {
                temperature: 0.3,
                maxTokens: 4000
            });

            try {
                let cleanedResponse = response.trim();
                
                if (cleanedResponse.startsWith('```json')) {
                    cleanedResponse = cleanedResponse.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
                } else if (cleanedResponse.startsWith('```')) {
                    cleanedResponse = cleanedResponse.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
                }
                
                const lastBrace = cleanedResponse.lastIndexOf('}');
                if (lastBrace !== -1 && lastBrace < cleanedResponse.length - 1) {
                    console.warn('⚠️ 检测到JSON可能被截断，尝试修复...');
                    cleanedResponse = cleanedResponse.substring(0, lastBrace + 1);
                    
                    const openBraces = (cleanedResponse.match(/{/g) || []).length;
                    const closeBraces = (cleanedResponse.match(/}/g) || []).length;
                    
                    if (openBraces > closeBraces) {
                        cleanedResponse += '}'.repeat(openBraces - closeBraces);
                        console.log(`🔧 已补充 ${openBraces - closeBraces} 个闭合括号`);
                    }
                }
                
                cleanedResponse = cleanedResponse
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                
                const parsed = JSON.parse(cleanedResponse);
                
                console.log('✅ JSON解析成功:', {
                    nodeId: parsed.nodeId,
                    scoringDetailsCount: parsed.scoringDetails?.length || 0,
                    nodeSubtotal: parsed.nodeSubtotal
                });
                
                return parsed;
            } catch (e) {
                console.error('❌ JSON解析失败:', e.message);
                console.error('📄 原始响应前500字符:', response.substring(0, 500));
                
                const fallbackData = this.extractFallbackData(response, currentNode, currentNodeData);
                
                return {
                    ...fallbackData,
                    raw: response
                };
            }
        } catch (error) {
            return {
                nodeId: currentNode,
                nodeTitle: nodeTitle,
                scoringDetails: [],
                notScoredRemarks: [{ quote: '服务不可用', reason: '网络或服务异常' }],
                nodeSubtotal: 0,
                nodeScoringNote: '服务不可用，无法评分'
            };
        }
    }

    async generateOverallAssessment(allNodeResults) {
        const studentId = '小李';
        const systemPrompt = `你是一名专业的医务社会工作伦理教育评分员。
以下是社工学生"小李"在五个节点中的完整评分记录，请你生成最终汇总报告。

## 各节点评分数据
${JSON.stringify(allNodeResults, null, 2)}

---

## 输出任务

### 第一步：计算总分
将五个节点的小计分数相加，得出总累计得分。

### 第二步：分析得分分布
统计学生在A类（社工基本伦理）和B类（医务专项伦理）各标准上的得分频次，
识别：
- 最高频出现的伦理行为类型（优势）
- 完全未出现或出现最少的伦理行为类型（盲点）

### 第三步：生成叙述性总评
按以下结构输出总评，每条均须引用学生原话作为依据（quote 必须来自各节点 scoringDetails.quote）：

在【社会工作基本伦理规范】方面：
说明学生在A1—A7各类表现中的整体水平，引用1—2句最具代表性的原话。

在【医务社会工作专项伦理规范】方面：
说明学生在B1—B8各类表现中的整体水平，引用1—2句最具代表性的原话。

跨节点模式分析：
说明学生的伦理表现是否稳定，哪个节点表现最强，哪个节点出现明显落差。

---

## 输出格式（严格JSON）

{
  "studentId": "${studentId}",
  "totalScore": 0,
  "nodeScoreSummary": [
    { "nodeId": "node1", "nodeTitle": "节点名称", "score": 0 },
    { "nodeId": "node2", "nodeTitle": "节点名称", "score": 0 },
    { "nodeId": "node3", "nodeTitle": "节点名称", "score": 0 },
    { "nodeId": "node4", "nodeTitle": "节点名称", "score": 0 },
    { "nodeId": "node5", "nodeTitle": "节点名称", "score": 0 }
  ],
  "criteriaFrequency": {
    "A1": 0, "A2": 0, "A3": 0, "A4": 0, "A5": 0, "A6": 0, "A7": 0,
    "B1": 0, "B2": 0, "B3": 0, "B4": 0, "B5": 0, "B6": 0, "B7": 0, "B8": 0
  },
  "strengthCriteria": ["A3", "B4"],
  "blindSpotCriteria": ["A6", "B7"],
  "narrativeSummary": {
    "basicEthics": "100—150字，含原话引用",
    "healthcareEthics": "100—150字，含原话引用",
    "crossNodePattern": "80—100字"
  },
  "developmentSuggestion": "80字以内"
}

要求：
1) 只输出JSON，不要Markdown，不要代码块
2) totalScore 必须等于 nodeScoreSummary 的 score 总和
3) criteriaFrequency 的统计依据为各节点 scoringDetails.matchedCriteria（每条得分句可多标准，均计频次）
4) strengthCriteria 取出现最多的2—3个标准代码；blindSpotCriteria 取出现最少（含0）的2—3个标准代码`;

        try {
            const response = await this.deepseek.sendMessage([
                { role: 'system', content: systemPrompt }
            ], {
                temperature: 0.4,
                maxTokens: 4000
            });

            try {
                let cleanedResponse = response.trim();
                if (cleanedResponse.startsWith('```json')) {
                    cleanedResponse = cleanedResponse.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
                } else if (cleanedResponse.startsWith('```')) {
                    cleanedResponse = cleanedResponse.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
                }
                const firstBrace = cleanedResponse.indexOf('{');
                const lastBrace = cleanedResponse.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
                }
                cleanedResponse = cleanedResponse
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                return JSON.parse(cleanedResponse);
            } catch (e) {
                return {
                    studentId,
                    totalScore: 0,
                    nodeScoreSummary: [],
                    criteriaFrequency: {},
                    strengthCriteria: [],
                    blindSpotCriteria: [],
                    narrativeSummary: {
                        basicEthics: '总评生成失败',
                        healthcareEthics: '总评生成失败',
                        crossNodePattern: ''
                    },
                    developmentSuggestion: '请稍后重试'
                };
            }
        } catch (error) {
            return {
                studentId,
                totalScore: 0,
                nodeScoreSummary: [],
                criteriaFrequency: {},
                strengthCriteria: [],
                blindSpotCriteria: [],
                narrativeSummary: {
                    basicEthics: '服务暂时不可用',
                    healthcareEthics: '服务暂时不可用',
                    crossNodePattern: '网络错误，无法生成总评'
                },
                developmentSuggestion: '检查网络连接后重试'
            };
        }
    }

    async generateScenarioTransition(fromNode, toNode, userChoice, context) {
        const transitions = {
            'node1-node2': '过了好一会儿，刘雪梅的情绪慢慢平复下来...',
            'node2-node3': '就在这时，刘雪梅的手机突然响了...',
            'node3-node4': `你和小明说完话后，房间里安静了好一阵。

小明转过身去面对墙壁，呼吸慢慢变得均匀——他睡着了。你看着手里那幅画（如果有的话），心里沉甸甸的。

就在这时，病房的门再次被推开。陈国强站在门口，手里拎着一个保温桶，脸上的表情有些复杂——像是想说什么，又像是在犹豫。他在门口停了几秒，目光在你和刘雪梅之间游移了一下，然后低声说：

"李社工，能出来一下吗？我有件事...想跟你商量。"`,
            'node4-node5': '几天后，在你的办公室里...'
        };

        const key = `${fromNode}-${toNode}`;
        return transitions[key] || '场景发生了变化...';
    }

    getScenarioTransitionDirect(fromNode, toNode) {
        const transitions = {
            'node1-node2': '过了好一会儿，刘雪梅的情绪慢慢平复下来...',
            'node2-node3': '就在这时，刘雪梅的手机突然响了...',
            'node3-node4': `你和小明说完话后，房间里安静了好一阵。

小明转过身去面对墙壁，呼吸慢慢变得均匀——他睡着了。你看着手里那幅画（如果有的话），心里沉甸甸的。

就在这时，病房的门再次被推开。陈国强站在门口，手里拎着一个保温桶，脸上的表情有些复杂——像是想说什么，又像是在犹豫。他在门口停了几秒，目光在你和刘雪梅之间游移了一下，然后低声说：

"李社工，能出来一下吗？我有件事...想跟你商量。"`,
            'node4-node5': '几天后，在你的办公室里...'
        };

        const key = `${fromNode}-${toNode}`;
        return transitions[key] || '场景发生了变化...';
    }

    async generateEndingSummary(decisions, finalScore, endingType) {
        const systemPrompt = `生成社会工作伦理总结报告。

【决策】${JSON.stringify(decisions, null, 2)}
【得分】${finalScore}
【结局】${endingType}

内容：
1. **整体评价**（80字）
2. **每节点分析**（各150字，含对话引用）
3. **成长点**（4-6个，举例）
4. **建议**（5-8条）
5. **反思题**（3个）

Markdown格式，专业鼓励语气。`;

        try {
            const response = await this.deepseek.sendMessage([
                { role: 'system', content: systemPrompt }
            ], {
                temperature: 0.7,
                maxTokens: 3000
            });

            return response;
        } catch (error) {
            return '总结生成失败。但您已完成案例模拟，感谢参与！';
        }
    }

    resetConversation() {
        this.conversationHistory = [];
    }

    extractFallbackData(rawResponse, currentNode, currentNodeData) {
        console.log('🔧 尝试从原始响应中提取数据...');
        
        const fallback = {
            nodeId: currentNode,
            nodeTitle: currentNodeData?.name || `节点${currentNode}`,
            scoringDetails: [],
            notScoredRemarks: [{
                quote: 'JSON解析失败',
                reason: 'AI返回的数据格式不正确'
            }],
            nodeSubtotal: 0,
            nodeScoringNote: '评分解析失败，已记录原始文本',
            raw: rawResponse || ''
        };

        return fallback;
    }

    getDimensionName(dimensionId) {
        const names = {
            'D1': '伦理识别',
            'D2': '诚实告知',
            'D3': '案主自决',
            'D4': '专业关系',
            'D5': '系统协调'
        };
        return names[dimensionId] || '未知维度';
    }
}

const api = new CaseSimulationAPI();
