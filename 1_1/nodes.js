const CASE_NODES = {
    'node1': {
        id: 'node1',
        name: '节点1：情绪崩溃',
        description: '刘雪梅激烈情绪反应',
        minRounds: 3,
        maxRounds: 5,
        scenario: `病房内，小明在睡觉。他已经停止化疗，医生表示没有救治的可能了，预计存活期1-3个月。刘雪梅坐在床边，眼睛红肿。`,
        task: '应对情绪崩溃：如何安抚激烈的情绪反应？',
        keyIssue: '接纳与专业界限 - 同理心应用 vs 防止过度共情',
        evaluationCriteria: {
            supportResponse: '是否应用"同理心"，在情感上接纳刘雪梅的崩溃，同时维持专业身份',
            valueNeutrality: '是否对刘雪梅"视回家为放弃"的价值观保持中立，不进行道德说教',
            reflectivePractice: '通过反思性实践防止过度共情导致的替代性创伤或判断力丧失'
        },
        standardDialogue: {
            npc: `李社工，你来了...（勉强挤出一个笑容）小明刚睡着，他这两天睡得多...`,
            npcFollowUp: [
                { round: 1, text: `（眼眶泛红，声音有些发抖）你说什么？你是不是也觉得...觉得我们该放弃了？`, action: '眼神慌乱，紧紧盯着你' },
                { round: 2, text: `（先是一愣，随即长舒一口气，用手抹了抹眼角）对不起对不起，我这几天太敏感了...李社工，您别介意。我就是这样，一听到什么不好的字眼就害怕。这孩子才11岁啊...`, action: '声音发颤，眼泪又涌上来' },
                { round: 3, text: `"你们都要放弃他了对不对？我知道！我都看到了！回家？回家就是等死！你们想让我亲手送走自己的孩子吗？"`, action: '也许是看到了小明苍白的脸，也许是想起了什么，她猛地站起来' },
                { round: 4, text: `"他才11岁啊！他昨天还跟我说想回家看看...他怎么会知道..."`, action: '眼泪止不住地往下掉' },
                { round: 5, text: `"你们怎么能...怎么可以...我不能接受！绝对不能！"`, action: '剧烈颤抖，双手紧紧抓着衣角' }
            ]
        },
        characters: ['system', 'liuxuemei'],
        choices: {
            A: {
                label: '情感安抚型（回避）',
                tendency: 'emotional_avoidance',
                description: '"一定会好起来的"、"我们再想想办法"等过度承诺或转移话题',
                ethicsImpact: -10,
                consequence: '形成依赖，后续无法兑现，错失建立信任的机会'
            },
            B: {
                label: '专业边界型（认可+引导）',
                tendency: 'professional_boundary',
                description: '用同理心接纳崩溃情绪，对"回家=放弃"价值观保持中立，同时维持专业身份',
                ethicsImpact: +15,
                consequence: '建立健康信任基础，为后续沟通铺路'
            }
        },
        nextNode: 'node2'
    },

    'node2': {
        id: 'node2',
        name: '节点2：基金会请求',
        description: '刘雪梅请求社工联系慈善基金继续化疗',
        minRounds: 2,
        maxRounds: 4,
        scenario: `她坐回椅子上擦了擦脸。小明又睡着了，房间里安静得只能听到仪器的滴答声。她抬起头看着你，眼神里带着一丝恳求：`,
        task: '面对筹款请求：化疗已无效且加重痛苦，是否协助联系慈善基金？',
        keyIssue: '诚实告知与最小伤害 - 案主需求 vs 案主最大利益',
        evaluationCriteria: {
            honestDisclosure: '诚实告知：社工是否有勇气与刘雪梅讨论医学团队的真实评估（预计存活期1-3个月，现有治疗无法治愈），而非盲目链接资源',
            minimalHarm: '最小伤害：直接帮助链接资源可能导致无效医疗（化疗已无效且加重痛苦）和案主家庭财务崩溃'
        },
        standardDialogue: {
            npc: `"李社工..."她的声音很轻，"我听说有一些慈善基金可以帮助像我们这样的家庭..."`,
            npcFollowUp: [
                { round: 1, text: `"你能不能帮我联系一下？我想再试试化疗。只要有一线希望..."`, action: '眼神恳求，手指无意识地摩挲床单' },
                { round: 2, text: `"也许这次会有用呢？我不能就这么看着他...我求你了..."`, action: '声音颤抖' }
            ]
        },
        characters: ['system', 'liuxuemei'],
        choices: {
            A: {
                label: '满足需求型（协助筹款）',
                tendency: 'need_satisfaction',
                description: '立即帮助联系慈善基金，不讨论医学评估',
                ethicsImpact: -20,
                consequence: '违背最小伤害原则：延长孩子痛苦、导致家庭财务崩溃、错过临终关怀最佳时机'
            },
            B: {
                label: '诚实面对型（聚焦评估）',
                tendency: 'honest_confrontation',
                description: '先有勇气讨论医学团队的真实评估，再共同决策是否符合案主最大利益',
                ethicsImpact: +20,
                consequence: '引导面对现实，为后续安宁疗护决策铺路'
            }
        },
        nextNode: 'node3'
    },

    'node3': {
        id: 'node3',
        name: '节点3：小明的疑问',
        description: '小明敏锐察觉病情变化，询问真相',
        minRounds: 2,
        maxRounds: 4,
        scenario: `她看了眼屏幕——是亲戚打来的。她起身走到病房外接电话，门轻轻关上了。

房间里只剩下你和小明。小明醒了，安静地在床上画画。你凑过去看——画纸上是一只狗、一个房子、三个火柴人。

过了一会儿，小明放下笔，转过头看着你。他的眼神很认真，像是已经想了很久：`,
        task: '儿童知情权与渐进式告知：11岁患儿已察觉异常，如何回应？',
        keyIssue: '知情权、案主自决与家长式作风 - 尊重儿童心理主体地位',
        evaluationCriteria: {
            respectRecognition: '尊重：社工是否能识别小明的敏感与需求？直接告诉或彻底隐瞒都是极端的',
            progressiveDisclosure: '渐进式告知：标准做法应确认小明的已知程度，并评估刘雪梅的接受力，采用"情感回应"方式',
            emotionalResponse: '情感回应：是否通过共情和倾听确认小明的心理主体地位，而非简单回避或一次性告知'
        },
        standardDialogue: {
            npc: `"姐姐..."他的声音很轻，"我是不是快死了？"`,
            npcFollowUp: [
                { round: 1, text: `"我看到妈妈有时候偷偷哭，当着我面又不哭。她以为我不知道..."`, action: '眼神认真' },
                { round: 2, text: `"还有爸爸，他最近都不怎么说话。还有你们突然就不给我做化疗了..."`, action: '声音更轻了' },
                { round: 3, text: `"你们是不是在瞒着我什么？"`, action: '放下画笔，看着你' }
            ],
            conditionalFollowUp: {
                'emotional_response': [
                    { round: 4, text: `"（沉默片刻）姐姐...我想跟你说个秘密..."`, action: '声音更轻了，眼神信任地看着你' },
                    { round: 5, text: `"我想回家...想在家里睡觉...不想让妈妈再哭了...你能不能帮帮我？"` , action: '把那幅画递给你', specialAction: 'givePainting' }
                ],
                'default': [
                    { round: 4, text: `"（低下头，不再说话）"`, action: '转身假装看窗外' }
                ]
            }
        },
        characters: ['system', 'xiaoming'],
        choices: {
            A: {
                label: '保密协定型（转移话题）',
                tendency: 'confidentiality',
                description: '"问爸爸妈妈去"、"你还小，别想这些"',
                ethicsImpact: -5,
                consequence: '小明封闭，拒绝互动，失去信任'
            },
            B: {
                label: '感受回应型（关注情绪+渐进式告知）',
                tendency: 'emotional_response',
                description: '不直接回答也不完全回避，先确认他的已知程度，用情感回应确认其心理主体地位',
                ethicsImpact: +25,
                consequence: '获得信任，得到画作，为后续家庭会议铺路'
            },
            C: {
                label: '直接告知型（说明实情）',
                tendency: 'direct_disclosure',
                description: '直接告诉真实情况，不考虑母亲接受度和孩子心理承受能力',
                ethicsImpact: -30,
                consequence: '被母亲发现，关系破裂，违背家长意愿'
            }
        },
        nextNode: 'node4'
    },

    'node4': {
        id: 'node4',
        name: '节点4：父亲的请求',
        description: '陈国强想让社工帮忙转达安宁疗护想法',
        minRounds: 2,
        maxRounds: 4,
        scenario: `这时，病房的门被推开了。陈国强走了进来，眉头紧锁，脸上写满了疲惫。他在门口站了一会儿，然后走过来低声说："李社工，能出来一下吗？"

你跟着他走到走廊尽头。那里比较安静。陈国强点了一支烟，手有些抖，声音沙哑：`,
        task: '沟通媒介角色 vs 增能促进者：父亲无法对妻子开口，是否替他传话？',
        keyIssue: '替代沟通 vs 促进自主 - 识破逃避并搭建共同交流平台',
        evaluationCriteria: {
            identifyAvoidance: '学生是否能识破爸爸的逃避心理（不敢面对妻子的情绪反应）？',
            empowerCommunication: '引导学生而非代劳：支持父亲自己开口，而非成为传声筒',
            buildPlatform: '能否有意识地搭建一个家庭共同交流的平台（如提议召开家庭会议）？',
            supervisorIntervention: '如果学生选择"答应传话"或"继续逃避"，AI应以督导反馈形式介入，引导召开家庭会议'
        },
        standardDialogue: {
            npc: `"我知道...孩子撑不住了。但是我跟他妈...我说不出口。"`,
            npcFollowUp: [
                { round: 1, text: `"她一听就要哭，一哭就什么都听不进去了。我真的...真的说不出口。"`, action: '避开你的目光，深吸一口烟' },
                { round: 2, text: `"你能帮我问问孩子他妈吗？就说...就说我觉得我们应该考虑..."`, action: '把烟头掐灭，声音更低了' },
                { round: 3, text: `"考虑让孩子少受点罪，回家...我知道这很残忍，但我真的没办法..."`, action: '看着你，眼眶微红' }
            ]
        },
        supervisorFeedback: `小李，我注意到你陷入了父亲和母亲的情绪拉锯中。作为医务社工，你觉得目前这种"背对背"的沟通能解决小明的出院问题吗？来，我们开个家庭会议吧！`,
        characters: ['system', 'chenguoqiang'],
        choices: {
            A: {
                label: '代劳传话型（替父亲沟通）',
                tendency: 'mediation',
                description: '答应帮陈国强转达，成为夫妻间的传声筒',
                ethicsImpact: -25,
                consequence: '夫妻关系破裂，协商失败，社工陷入情绪拉锯'
            },
            B: {
                label: '增能支持型（鼓励自主+搭建平台）',
                tendency: 'empowerment',
                description: '识破父亲逃避心理，支持他自己开口，并提议召开家庭会议搭建交流平台',
                ethicsImpact: +30,
                consequence: '促进夫妻直接沟通，为家庭会议铺路'
            }
        },
        nextNode: 'node5'
    },

    'node5': {
        id: 'node5',
        name: '节点5：家庭会议',
        description: '关键转折点 - 四人家庭协商会议',
        isEnding: true,
        endingType: 'best',
        minRounds: 3,
        maxRounds: 6,
        scenario: `几天后，在你的办公室里。

在场的人：你（社工小李）、刘雪梅、陈国强、小明。

小明坐在轮椅上，看起来有些虚弱但精神尚可。他安静地听着大人们的对话，偶尔看看桌上的画。

陈国强先开口了，声音僵硬但努力平和："我们...商量了一下。觉得应该听听专业的意见。"

房间里安静了几秒钟。刘雪梅没有说话，一只手轻轻抚摸着小明的头。陈国强低着头。小明看着大家，小声说："我不怕痛...我只是不想看到妈妈哭..."

然后，刘雪梅抬起头，声音颤抖但平静：`,
        task: '临终决策与共识达成：如何引导这个四口之家达成关于安宁疗护的共识？',
        keyIssue: '权利分配与共识达成 - 每个家庭成员的意愿表达空间',
        evaluationCriteria: {
            equalExpression: '是否给每个角色表达自己意愿的空间？如果母亲一直说话，社工是否能适时打断并询问父亲和小明的意见？',
            clientVoice: '案主参与：小明作为11岁的患儿，是否有机会直接表达自己的愿望？社工会如何平衡家长权威与儿童权利？',
            consensusBuilding: '共识达成：学生能否将"放弃治疗"重新定义为"换一种方式爱小明"？能否引导家庭看到安宁疗护的价值？'
        },
        standardDialogue: {
            npc: `"回家的话......他会痛吗？"`,
            npcFollowUp: [
                { round: 1, text: `"我是说...如果回家的话，会不会很痛？有没有办法让他不那么痛？"`, action: '声音颤抖但平静，看着小明' },
                { round: 2, text: `"我不想让他受罪...但是我又不敢做决定...我怕..."`, action: '手指在纸巾上捏得更紧' },
                { round: 3, text: `"我怕一旦回家了，就真的...就没有希望了..."`, action: '眼泪掉下来，小明握住妈妈的手' }
            ],
            xiaomingFollowUp: [
                { round: 2, text: `（小明小声地）"妈妈，我想回家...家里的狗还在等我..."`, action: '眼神恳求地看着母亲' },
                { round: 4, text: `（小明转向你）"姐姐，你说...如果我回家了，是不是就代表我放弃了？"`, action: '认真地问' }
            ]
        },
        characters: ['system', 'liuxuemei', 'chenguoqiang', 'xiaoming'],
        choices: {
            A: {
                label: '专业引导型（疼痛管理+意义重构+儿童参与）',
                tendency: 'professional_care',
                description: '详细解释临终关怀和疼痛管理方案，将"放弃治疗"重构为"换一种方式爱孩子"，并确保小明有发言空间',
                ethicsImpact: +35,
                consequence: '达成良好结局，全家获得共识，小明的心愿被尊重'
            }
        }
    }
};

const CHARACTER_PROFILES = {
    liuxuemei: {
        name: '刘雪梅',
        role: '母亲',
        avatar: '👩',
        
        coreIdentity: {
            personality: ['高度焦虑', '情绪不稳定', '深爱孩子', '无法接受死亡', '保护欲强'],
            currentState: '处于崩溃边缘，在孩子病情和医疗决策之间挣扎',
            motivation: '不想失去孩子，害怕"回家=放弃"，寻求任何可能的治疗机会'
        },
        
        languagePatterns: {
            firstPerson: '必须使用"我"表达自己的感受',
            thirdPersonForChild: '指代小明时必须使用："孩子"、"他"、"小明"、"我儿子"、"这孩子"',
            thirdPersonForHusband: '指代丈夫时使用："国强"、"他爸爸"',
            typicalPhrases: [
                "我不能接受",
                "他才11岁啊",
                "你们要放弃他吗",
                "我的孩子",
                "我怎么办",
                "回家就是等死"
            ],
            forbiddenPhrases: [
                "我很痛",  // 这是小明的话
                "我想回家",  // 这是小明的话
                "姐姐你知道吗",  // 这是小明对社工说的话
                "我不怕痛"  // 这是小明的话
            ],
            emotionalMarkers: ['哭泣', '颤抖', '崩溃', '哽咽', '擦眼泪', '声音发抖']
        },
        
        behaviorPatterns: {
            actions: ['擦眼泪', '握住孩子的手', '站起来', '声音提高', '身体颤抖'],
            avoidActions: ['沉默不语', '冷静分析', '抽烟']  // 这些是父亲的特征
        },
        
        traits: ['高度焦虑', '情绪不稳定', '深爱孩子', '无法接受死亡'],
        speakingStyle: '情绪化，经常哭泣，语速快时焦虑',
        context: '孩子11岁，非霍奇金淋巴瘤晚期，已停止化疗，预计存活期1-3个月',
        addressUserAs: '李社工'
    },
    
    xiaoming: {
        name: '小明',
        role: '患儿',
        avatar: '👦',
        
        coreIdentity: {
            personality: ['懂事', '隐忍', '渴望回家', '敏感', '超越年龄的成熟'],
            currentState: '虽然病痛但表现得比实际年龄成熟，察觉到家人隐瞒病情',
            motivation: '想回家，想见家里的狗，想知道真相但不想让妈妈难过'
        },
        
        languagePatterns: {
            firstPerson: '必须始终使用"我"： "我很痛"、"我想回家"、"我怕..."',
            thirdPersonForMom: '指代妈妈时使用："妈妈"、"她"',
            typicalPhrases: [
                "我想回家",
                "姐姐你知道吗",
                "我不怕痛",
                "我只是不想...",
                "妈妈哭了",
                "家里的狗还在等我",
                "我想画画"
            ],
            forbiddenPhrases: [
                "我的孩子",  // 这是母亲的话
                "他才11岁",  // 这是母亲的话
                "我不能接受",  // 这是母亲的话
                "你们要放弃吗"  // 这是母亲的话
            ],
            emotionalMarkers: ['轻声说', '低下头', '小声', '看着画', '安静']
        },
        
        behaviorPatterns: {
            actions: ['低头看画', '轻声说', '握着笔', '看向窗外', '摸摸狗（如果在家）'],
            avoidActions: ['大声喊叫', '情绪崩溃', '拍桌子']  // 这些是母亲的特征
        },
        
        traits: ['聪明敏感', '压抑情绪', '察觉异常', '想回家'],
        speakingStyle: '声音轻柔，观察力强，说出超出年龄的成熟话语',
        context: '11岁男孩，非霍奇金淋巴瘤晚期，已停止化疗，大部分时间睡觉或画画',
        addressUserAs: '姐姐'
    },
    
    chenguoqiang: {
        name: '陈国强',
        role: '父亲',
        avatar: '👨',
        
        coreIdentity: {
            personality: ['外表强硬', '沉默寡言', '独自承担', '内心痛苦', '不善表达情感'],
            currentState: '承受巨大的经济压力和心理痛苦，但选择独自承担不让妻子知道',
            motivation: '想让孩子少受罪，但又不知道如何表达，回避直接沟通'
        },
        
        languagePatterns: {
            firstPerson: '使用"我"但表达简短压抑',
            thirdPersonForWife: '指代妻子时使用："雪梅"、"孩子他妈"',
            thirdPersonForChild: '指代儿子时使用："孩子"、"小子"',
            typicalPhrases: [
                "让我想想",
                "这事真的...",
                "我是做爸爸的",
                "孩子他妈你..."
            ],
            forbiddenPhrases: [
                "我不能接受！",  // 情绪化崩溃是母亲的特征
                "绝对不行！",  // 太激烈
                "我的孩子啊！"  // 过于情绪化
            ],
            emotionalMarkers: ['沉默', '叹气', '声音沙哑', '低声', '慢慢地说']
        },
        
        behaviorPatterns: {
            actions: ['沉默很久', '叹气', '抽烟', '低头', '背过身去', '声音沙哑'],
            avoidActions: ['大哭', '尖叫', '颤抖', '崩溃']  // 这些是母亲的特征
        },
        
        traits: ['外表强硬', '沉默寡言', '独自承担经济压力', '坚决','不善表达'],
        speakingStyle: '简短有力，语速慢，避免眼神接触，声音低沉',
        context: '孩子的父亲，经济压力大，内心痛苦但不善表达',
        addressUserAs: '李社工'
    },
    
    system: {
        name: '环境',
        role: '旁白',
        avatar: '📋',
        traits: [],
        speakingStyle: '客观简短的环境描写'
    }
};
