class CaseSimulator {
    constructor() {
        this.currentNode = 'node1';
        this.currentNodeRounds = 0;
        this.userMessages = [];
        this.decisions = [];
        this.ethicsScore = 0;
        this.completedNodes = 0;
        this.isProcessing = false;
        this.isTyping = false;
        this.api = api;
        this.userInfo = null;
        this.nodeResults = [];
        this.overallAssessment = null;
        this.isOverallAssessmentGenerating = false;
        this.hasUploadedToAirtable = false;
        this.endingSummaryText = '';
        
        this.nodeDataForUpload = {
            n1: '', n2: '', n3: '', n4: '', n5: ''
        };
        
        this.redLineViolated = false;
        this.redLineViolationDetails = null;
        this.ethicalDecisionsCount = 0;
        
        this.nodeDialoguePool = '';
        this.currentNodeStartTime = null;
        
        this.init();
    }

    init() {
        console.log('🚀 CaseSimulator 初始化开始...');
        
        if (typeof CASE_NODES === 'undefined' || !CASE_NODES || typeof CASE_NODES !== 'object') {
            console.error('❌ 数据源 CASE_NODES 未定义或格式错误！');
            this.showInitError('数据加载失败：案例节点数据未找到。请确保 nodes.js 文件已正确加载。<br><br>建议操作：<br>1. 刷新页面（Ctrl+F5）<br>2. 检查浏览器控制台是否有文件加载错误<br>3. 确认 nodes.js 文件存在于项目目录');
            return;
        }

        const nodeIds = Object.keys(CASE_NODES);
        console.log(`✅ CASE_NODES 加载成功，共 ${nodeIds.length} 个节点:`, nodeIds.join(', '));

        if (!CASE_NODES['node1']) {
            console.error("❌ 找不到起始节点 'node1'");
            this.showInitError('数据结构错误：缺少必要的起始节点（node1）。<br><br>请检查 nodes.js 文件是否完整。');
            return;
        }
        
        this.bindEvents();
        this.updateUI();
        this.initMobileSidebar();
        this.initInfoForm();
        
        this.checkForSavedProgress();
        
        console.log('✅ CaseSimulator 初始化完成');
    }

    showInitError(message) {
        const scenarioBox = document.getElementById('scenario-box');
        if (scenarioBox) {
            scenarioBox.innerHTML = `<div class="init-error" style="color: #dc2626; padding: 20px; background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; margin: 20px;">
                <h3 style="color: #dc2626; margin-bottom: 10px;">⚠️ 系统初始化错误</h3>
                <p style="line-height: 1.6;">${message}</p>
            </div>`;
        }
        
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '❌ 系统异常';
            startBtn.style.opacity = '0.5';
        }
    }

    checkForSavedProgress() {
        try {
            const saved = localStorage.getItem('sw_sim_backup');
            if (saved) {
                const data = JSON.parse(saved);
                const saveTime = new Date(data.timestamp);
                const timeDiff = (Date.now() - saveTime.getTime()) / 1000 / 60;
                
                console.log(`📦 发现已保存的进度 (${timeDiff.toFixed(1)} 分钟前):`, {
                    currentNode: data.currentNode,
                    messagesCount: data.userMessages?.length || 0,
                    completedNodes: data.completedNodes || 0
                });
                
                if (timeDiff < 1440 && data.currentNode && data.currentNode !== 'node1' && (data.userMessages?.length > 0 || data.completedNodes > 0)) {
                    const timeStr = this.formatSaveTime(saveTime);
                    
                    setTimeout(() => {
                        if (confirm(`💾 检测到未完成的模拟记录\n\n保存时间：${timeStr}\n当前进度：${data.nodeName || data.currentNode}\n已完成节点：${data.completedNodes || 0}/5\n\n是否继续上次的进度？\n\n（点击"取消"将开始新模拟）`)) {
                            this.resumeFromBackup(data);
                        } else {
                            console.log('🗑️ 用户选择开始新模拟，清除旧备份');
                            this.clearSavedProgress();
                        }
                    }, 500);
                } else if (timeDiff >= 1440) {
                    console.log('⏰ 备份数据超过24小时，自动清除');
                    this.clearSavedProgress();
                }
            }
        } catch (e) {
            console.warn('⚠️ 检查保存进度时出错:', e);
        }
    }

    saveProgress(reason = 'auto') {
        try {
            if (!this.currentNode || this.currentNode === 'node1') {
                return;
            }

            const backup = {
                version: '202604191730',
                timestamp: new Date().toISOString(),
                currentNode: this.currentNode,
                nodeName: CASE_NODES[this.currentNode]?.name || '',
                currentNodeRounds: this.currentNodeRounds,
                userMessages: this.userMessages.slice(-50),
                decisions: this.decisions,
                nodeResults: this.nodeResults,
                completedNodes: this.completedNodes,
                ethicsScore: this.ethicsScore,
                userInfo: this.userInfo,
                overallAssessment: this.overallAssessment
            };

            const backupStr = JSON.stringify(backup);
            
            if (backupStr.length > 4 * 1024 * 1024) {
                console.warn('⚠️ 备份数据过大 (>4MB)，跳过保存');
                return;
            }

            localStorage.setItem('sw_sim_backup', backupStr);
            
            console.log(`💾 进度已保存 [${reason}]:`, {
                currentNode: backup.currentNode,
                messagesCount: backup.userMessages.length,
                size: `${(backupStr.length / 1024).toFixed(1)}KB`
            });
        } catch (e) {
            console.error('❌ 保存进度失败:', e);
        }
    }

    resumeFromBackup(data) {
        console.log('🔄 从备份恢复进度...');

        try {
            this.currentNode = data.currentNode || 'node1';
            this.currentNodeRounds = data.currentNodeRounds || 0;
            this.userMessages = Array.isArray(data.userMessages) ? data.userMessages : [];
            this.decisions = Array.isArray(data.decisions) ? data.decisions : [];
            this.nodeResults = Array.isArray(data.nodeResults) ? data.nodeResults : [];
            this.completedNodes = data.completedNodes || 0;
            this.ethicsScore = data.ethicsScore || 0;
            this.userInfo = data.userInfo || null;
            this.overallAssessment = data.overallAssessment || null;

            const simulationPage = document.getElementById('simulation-page');
            if (!simulationPage) {
                throw new Error('模拟页面元素未找到，DOM可能未完全加载');
            }

            this.showPage('simulation-page');

            const nodeData = CASE_NODES[this.currentNode];
            if (nodeData) {
                this.updateScenarioDisplay(nodeData);
                this.updateProgressInfo(nodeData);
                this.updateDecisionStats();
                this.updateNodeIndicator(nodeData.name);

                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages && this.userMessages.length > 0) {
                    chatMessages.innerHTML = '';
                    this.userMessages.forEach(msg => {
                        try {
                            this.addMessageToDOM(msg);
                        } catch (msgError) {
                            console.warn('⚠️ 恢复消息失败:', msgError);
                        }
                    });
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

                this.enableInput();

                alert(`✅ 进度恢复成功！\n\n当前位置：${nodeData.name}\n已完成：${this.completedNodes}/5 个节点\n\n您可以继续对话或点击"结束模拟"查看评估。`);
            } else {
                throw new Error('备份数据中的节点不存在');
            }
        } catch (e) {
            console.error('❌ 恢复进度失败:', e);
            alert('恢复失败，将开始新模拟。错误：' + e.message);
            this.clearSavedProgress();
            this.restart();
        }
    }

    clearSavedProgress() {
        try {
            localStorage.removeItem('sw_sim_backup');
            console.log('🗑️ 已清除保存的进度');
        } catch (e) {
            console.warn('⚠️ 清除进度失败:', e);
        }
    }

    formatSaveTime(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        let timeAgo = '';
        if (diffMins < 1) {
            timeAgo = '刚刚';
        } else if (diffMins < 60) {
            timeAgo = `${diffMins} 分钟前`;
        } else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) {
                timeAgo = `${diffHours} 小时前`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                timeAgo = `${diffDays} 天前`;
            }
        }
        
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }) + ` (${timeAgo})`;
    }

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startSimulation();
        });

        document.getElementById('send-btn').addEventListener('click', () => {
            this.handleUserInput();
        });

        document.getElementById('user-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserInput();
            }
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restart();
        });
    }

    initInfoForm() {
        const form = document.getElementById('info-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleInfoSubmit();
            });
        }
        
        const studentTypeSelect = document.getElementById('student-type');
        if (studentTypeSelect) {
            studentTypeSelect.addEventListener('change', (e) => {
                this.updateGradeOptions(e.target.value);
            });
        }
    }

    updateGradeOptions(studentType) {
        const gradeSelect = document.getElementById('grade');
        if (!gradeSelect) return;
        
        const gradeOptions = {
            '本科': [
                { value: '大一', text: '大一' },
                { value: '大二', text: '大二' },
                { value: '大三', text: '大三' },
                { value: '大四', text: '大四' }
            ],
            '研究生': [
                { value: '研一', text: '研一' },
                { value: '研二', text: '研二' },
                { value: '研三及以上', text: '研三及以上' }
            ],
            '在职': [
                { value: '在职1年以下', text: '在职1年以下' },
                { value: '在职1-3年', text: '在职1-3年' },
                { value: '在职3-5年', text: '在职3-5年' },
                { value: '在职5年以上', text: '在职5年以上' }
            ],
            '其他': [
                { value: '其他', text: '其他' }
            ]
        };

        gradeSelect.innerHTML = '<option value="">请选择</option>';
        
        const options = gradeOptions[studentType] || [];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            gradeSelect.appendChild(option);
        });
    }

    handleInfoSubmit() {
        console.log('📝 handleInfoSubmit() 开始执行');
        
        const name = document.getElementById('name').value.trim();
        const gender = document.getElementById('gender').value;
        const major = document.getElementById('major').value.trim();
        const studentType = document.getElementById('student-type').value;
        const grade = document.getElementById('grade').value;
        const school = document.getElementById('school').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();

        console.log('📋 获取到的表单数据:', { name, gender, major, studentType, grade, school });

        if (!name || !gender || !major || !studentType || !grade || !school) {
            console.warn('⚠️ 表单验证失败：缺少必填项');
            alert('请填写所有必填项（带 * 号的字段）:\n\n' +
                  (!name ? '❌ 姓名\n' : '') +
                  (!gender ? '❌ 性别\n' : '') +
                  (!major ? '❌ 专业\n' : '') +
                  (!studentType ? '❌ 学生类型\n' : '') +
                  (!grade ? '❌ 年级\n' : '') +
                  (!school ? '❌ 学校/单位\n' : ''));
            return false;
        }

        this.userInfo = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            name,
            gender,
            major,
            studentType,
            grade,
            school,
            phone,
            email,
            submitTime: new Date().toISOString(),
            status: 'in-progress',
            ethicsScore: 0,
            completedNodes: 0,
            decisions: [],
            messages: []
        };

        console.log('💾 用户信息对象已创建:', this.userInfo);

        localStorage.setItem('currentUserInfo', JSON.stringify(this.userInfo));
        this.saveUserInfo();
        
        console.log(`✅ 用户信息已保存: ${name} (${studentType} - ${grade})`);
        console.log('🔄 准备跳转到首页...');
        
        showPage('home-page');
        console.log('✅ 页面跳转完成');
        
        return true;
    }

    handleInfoFormSubmit() {
        console.log('🔘 handleInfoFormSubmit() 被调用');
        console.log('📍 this对象:', this);
        console.log('📍 simulator全局变量:', window.simulator);
        
        try {
            const result = this.handleInfoSubmit();
            console.log('✅ handleInfoSubmit() 返回:', result);
            return result;
        } catch (error) {
            console.error('❌ handleInfoFormSubmit() 执行出错:', error);
            alert('提交失败：' + error.message + '\n\n请按F12查看控制台获取详细错误信息。');
            return false;
        }
    }

    saveUserInfo() {
        if (!this.userInfo) return;
        
        let users = JSON.parse(localStorage.getItem('simulatorUsers') || '[]');
        const existingIndex = users.findIndex(u => u.id === this.userInfo.id);
        
        this.userInfo.status = this.completedNodes >= 5 ? 'completed' : 'in-progress';
        this.userInfo.ethicsScore = this.ethicsScore;
        this.userInfo.completedNodes = this.completedNodes;
        this.userInfo.decisions = this.decisions;
        this.userInfo.messages = this.userMessages;
        this.userInfo.endTime = new Date().toISOString();

        if (existingIndex >= 0) {
            users[existingIndex] = this.userInfo;
        } else {
            users.push(this.userInfo);
        }

        localStorage.setItem('simulatorUsers', JSON.stringify(users));
    }

    startSimulation() {
        this.showPage('simulation-page');
        this.loadNode('node1');
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
    }

    async loadNode(nodeId) {
        this.currentNode = nodeId;
        this.currentNodeRounds = 0;
        const nodeData = CASE_NODES[nodeId];
        
        if (!nodeData) {
            console.error('节点不存在:', nodeId);
            return;
        }

        this.updateScenarioDisplay(nodeData);
        this.updateNodeIndicator(nodeData.name);
        this.updateProgressInfo(nodeData);
        
        if (!nodeData.isEnding) {
            await this.showNodeScenario(nodeData);
        }

        if (nodeData.isEnding) {
            await this.handleEnding(nodeData);
        }
    }

    async showNodeScenario(nodeData) {
        await this.typeMessageWithPreload({
            type: 'system',
            sender: '环境',
            content: nodeData.scenario,
            timestamp: new Date()
        }, null);

        const primaryCharacter = nodeData.characters && Array.isArray(nodeData.characters) ? nodeData.characters.find(c => c !== 'system') : null;
        if (primaryCharacter && CHARACTER_PROFILES[primaryCharacter]) {
            const characterName = CHARACTER_PROFILES[primaryCharacter].name;
            
            try {
                await this.addTypingIndicator();
                
                const firstResponse = await this.api.generateFirstResponse(
                    this.currentNode,
                    { userMessages: this.userMessages, decisions: this.decisions }
                );
                
                this.removeTypingIndicator();
                
                await this.typeMessageWithPreload({
                    type: 'npc',
                    sender: characterName,
                    content: firstResponse,
                    timestamp: new Date()
                }, null);
            } catch (error) {
                this.removeTypingIndicator();
                await this.addMessage({
                    type: 'system',
                    sender: '系统',
                    content: `⚠️ ${characterName}加载失败，请重试`,
                    timestamp: new Date()
                });
            }
        }

        this.enableInput();
    }

    async handleUserInput() {
        const input = document.getElementById('user-input');
        const message = input.value.trim();

        if (!message) return;

        if (this.isTyping) {
            this.skipTyping();
            await this.delay(50);
        }

        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.disableInput();

        await this.addMessage({
            type: 'user',
            sender: '社工小李',
            content: message,
            timestamp: new Date()
        });

        this.userMessages.push({
            nodeId: this.currentNode,
            round: this.currentNodeRounds + 1,
            content: message,
            timestamp: new Date()
        });

        input.value = '';

        await this.processUserResponse(message);
    }

    async processUserResponse(message) {
        const nodeData = CASE_NODES[this.currentNode];
        this.currentNodeRounds++;
        
        if (!this.currentNodeStartTime) {
            this.currentNodeStartTime = new Date();
            console.log(`📝 开始记录节点 ${this.currentNode} 的对话`);
        }
        
        this.addToDialoguePool('用户（社工小李）', message);
        
        const redLineCheck = this.checkRedLineViolation(message);
        
        if (redLineCheck.isViolation) {
            console.error('🚨🚨🚨 红线违规！一票否决触发 🚨🚨🚨');
            console.error('   违规类别:', redLineCheck.category);
            console.error('   违规详情:', redLineCheck.description);
            
            this.redLineViolated = true;
            this.redLineViolationDetails = redLineCheck;
            this.ethicsScore = 0;
            
            this.userMessages.push({
                type: 'user',
                content: message,
                timestamp: new Date(),
                isRedLineViolation: true
            });
            
            await this.addTypingIndicator();
            
            const warningMessage = {
                type: 'system',
                sender: '系统警告',
                content: `⛔ <strong>【红线违规警告】</strong><br><br>
                         <span style="color: #dc2626; font-weight: bold;">${redLineCheck.category}</span><br>
                         ${redLineCheck.description}<br><br>
                         ⚠️ 根据伦理评估规则，您的行为已触碰红线。<br>
                         <strong>本次模拟总成绩将被清零。</strong><br><br>
                         系统将记录此违规行为，您可以继续完成模拟以查看详细反馈。`,
                timestamp: new Date(),
                isWarning: true
            };
            
            this.removeTypingIndicator();
            await this.addMessage(warningMessage);
            
            setTimeout(() => {
                if (confirm('您已触发红线违规，当前成绩已清零。\n\n是否继续完成模拟？\n\n（选择"确定"继续，选择"取消"结束模拟）')) {
                    this.saveProgress('红线违规后继续');
                } else {
                    this.endSimulationDueToRedLine();
                }
            }, 500);
            
            return;
        }
        
        await this.addTypingIndicator();
        
        try {
            const result = await this.api.generateNPCResponseWithTransition(
                this.currentNode,
                message,
                this.currentNodeRounds,
                nodeData.minRounds || 2,
                nodeData.maxRounds || 4,
                {
                    userMessages: this.userMessages,
                    decisions: this.decisions,
                    currentNodeRounds: this.currentNodeRounds,
                    currentUserTendency: this.getLastTendency(this.currentNode)
                }
            );

            this.removeTypingIndicator();

            const maxRounds = nodeData.maxRounds || 4;
            const minRounds = nodeData.minRounds || 2;
            const forceTransition = this.currentNodeRounds >= maxRounds;
            
            let shouldTransition = false;

            const isCriticalQuestion = this.detectCriticalEthicalQuestion(message);
            
            if (isCriticalQuestion) {
                shouldTransition = false;
                console.log('🚨 检测到关键伦理问题，暂停过渡:', message.substring(0, 50));
            } else if (forceTransition) {
                shouldTransition = true;
            } else if (result.shouldTransition && this.currentNodeRounds >= minRounds && nodeData.nextNode && !nodeData.isEnding) {
                shouldTransition = true;
            }

            const isMultiCharacterMeeting = nodeData.characters && 
                                           nodeData.characters.length > 3 && 
                                           nodeData.characters.includes('xiaoming');
            
            let messagesToShow = [];
            
            if (isMultiCharacterMeeting) {
                messagesToShow = this.splitMultiCharacterMessage(result.response, nodeData);
            } else {
                messagesToShow = [{
                    type: 'npc',
                    sender: this.getNPCName(nodeData),
                    content: result.response,
                    timestamp: new Date()
                }];
            }

            if (shouldTransition && nodeData.nextNode && !nodeData.isEnding) {
                for (let i = 0; i < messagesToShow.length; i++) {
                    const msg = messagesToShow[i];
                    if (i === messagesToShow.length - 1) {
                        const preloaded = await this.typeMessageWithPreload(msg, () => {
                            return this.preloadTransitionData(nodeData, nodeData.nextNode, message);
                        });
                        
                        await this.executeTransition(nodeData, nodeData.nextNode, message, preloaded);
                    } else {
                        await this.typeMessageWithPreload(msg, null);
                        await this.delay(300);
                    }
                }
            } else if (nodeData.isEnding && this.currentNodeRounds >= (nodeData.minRounds || 2)) {
                for (let i = 0; i < messagesToShow.length; i++) {
                    const msg = messagesToShow[i];
                    if (i === messagesToShow.length - 1) {
                        const preloaded = await this.typeMessageWithPreload(msg, () => {
                            return this.preloadEndingData(nodeData);
                        });
                        
                        await this.executeEnding(nodeData, preloaded);
                    } else {
                        await this.typeMessageWithPreload(msg, null);
                        await this.delay(300);
                    }
                }
            } else {
                for (const msg of messagesToShow) {
                    await this.typeMessageWithPreload(msg, null);
                    await this.delay(200);
                }
            }

        this.saveProgress('对话完成');
        this.isProcessing = false;
        this.enableInput();
        } catch (error) {
            this.skipTyping();
            this.removeTypingIndicator();
            console.error('处理响应时出错:', error);
            
            const errorMsg = error.code === 'TIMEOUT' ? '⏰ 请求超时，请检查网络后重试' :
                              error.code === 'NETWORK_ERROR' ? '🌐 网络连接失败，请检查网络' :
                              error.code === 'API_ERROR' ? `❌ API错误: ${error.message}` :
                              `⚠️ 出现异常: ${error.message}`;
            
            await this.addMessage({
                type: 'system',
                sender: '系统',
                content: errorMsg + '（对话可继续，部分功能可能受限）',
                timestamp: new Date()
            });

            const currentNodeDataForEnd = CASE_NODES[this.currentNode];
            const isNearEnding = currentNodeDataForEnd && 
                               (currentNodeDataForEnd.isEnding || 
                                this.currentNodeRounds >= (currentNodeDataForEnd.maxRounds || 4) - 1 ||
                                this.completedNodes >= 4);
            
            if (isNearEnding) {
                await this.addMessage({
                    type: 'system',
                    sender: '🎭',
                    content: '\n\n📌 **案例模拟即将结束**\n\n您已完成大部分关键节点的讨论。您可以：\n• 继续输入进行更多对话\n• 点击下方按钮直接查看评估总结',
                    timestamp: new Date()
                });

                const endBtnContainer = document.createElement('div');
                endBtnContainer.className = 'end-simulation-prompt';
                endBtnContainer.innerHTML = `
                    <button id="end-simulation-now-btn" class="primary-btn">
                        🎬 结束模拟 & 查看评估总结 →
                    </button>
                `;
                
                const chatMessages = document.getElementById('chat-messages');
                chatMessages.appendChild(endBtnContainer);
                chatMessages.scrollTop = chatMessages.scrollHeight;

                document.getElementById('end-simulation-now-btn').addEventListener('click', async () => {
                    endBtnContainer.remove();
                    
                    const endingNodeData = CASE_NODES['node5'] || { isEnding: true, endingType: 'best', name: '结局' };
                    await this.handleEnding(endingNodeData);
                });
            }
            
            this.isProcessing = false;
            this.enableInput();
        }
    }

    async smoothTransition(currentNodeData, nextNodeId, lastMessage) {
        await this.addTypingIndicator();

        const transitionText = this.api.getScenarioTransitionDirect(
            this.currentNode, nextNodeId
        );

        this.removeTypingIndicator();
        
        await this.typeMessageWithPreload({
            type: 'system',
            sender: '场景过渡',
            content: transitionText,
            timestamp: new Date()
        }, null);

        const nextNodeData = CASE_NODES[nextNodeId];
        if (!nextNodeData) return;

        await this.typeMessageWithPreload({
            type: 'system',
            sender: '环境',
            content: nextNodeData.scenario,
            timestamp: new Date()
        }, null);

        this.currentNode = nextNodeId;
        this.currentNodeRounds = 0;

        const analysisPromise = this.api.analyzeUserTendency(
            this.getNodeMessages(currentNodeData.id),
            this.currentNode,
            currentNodeData.choices
        ).catch(err => {
            console.warn('后台伦理分析失败:', err);
            return null;
        });

        const primaryCharacter = nextNodeData.characters && Array.isArray(nextNodeData.characters) ? nextNodeData.characters.find(c => c !== 'system') : null;

        if (primaryCharacter && CHARACTER_PROFILES[primaryCharacter]) {
            const characterName = CHARACTER_PROFILES[primaryCharacter].name;
            
            await this.addTypingIndicator();

            try {
                const [firstResponse, analysis] = await Promise.all([
                    this.api.generateFirstResponse(nextNodeId, {
                        userMessages: this.userMessages,
                        decisions: this.decisions
                    }),
                    analysisPromise
                ]);

                this.removeTypingIndicator();

                if (analysis) {
                    this.recordDecision(currentNodeData.id, currentNodeData, lastMessage, analysis);
                }
                
                await this.addMessage({
                    type: 'npc',
                    sender: characterName,
                    content: firstResponse,
                    timestamp: new Date()
                });
            } catch (error) {
                this.removeTypingIndicator();
                
                const analysis = await analysisPromise;
                if (analysis) {
                    this.recordDecision(currentNodeData.id, currentNodeData, lastMessage, analysis);
                }
                
                await this.addMessage({
                    type: 'system',
                    sender: '系统',
                    content: `⚠️ ${characterName}加载失败，请重试`,
                    timestamp: new Date()
                });
            }
        } else {
            const analysis = await analysisPromise;
            if (analysis) {
                this.recordDecision(currentNodeData.id, currentNodeData, lastMessage, analysis);
            }
        }
    }

    async smoothEnding(nodeData) {
        await this.addTypingIndicator();

        const [summary, analysis] = await Promise.all([
            this.api.generateEndingSummary(this.decisions, this.ethicsScore, nodeData.endingType),
            this.api.analyzeUserTendency(
                this.getNodeMessages(this.currentNode),
                this.currentNode,
                nodeData.choices
            ).catch(err => {
                console.warn('结束节点伦理分析失败:', err);
                return null;
            })
        ]);

        this.removeTypingIndicator();

        if (analysis) {
            this.recordDecision(this.currentNode, nodeData, '', analysis);
        }

        this.showEndPage(summary);
    }

    async preloadTransitionData(currentNodeData, nextNodeId, lastMessage) {
        const analysisPromise = this.api.analyzeUserTendency(
            this.getNodeMessages(currentNodeData.id),
            currentNodeData.id,
            currentNodeData.choices
        ).catch(err => {
            console.warn('预加载伦理分析失败:', err);
            return null;
        });

        const nextNodeData = CASE_NODES[nextNodeId];
        let firstResponsePromise = Promise.resolve(null);

        if (nextNodeData && nextNodeData.characters && Array.isArray(nextNodeData.characters)) {
            const primaryCharacter = nextNodeData.characters.find(c => c !== 'system');
            if (primaryCharacter && CHARACTER_PROFILES[primaryCharacter]) {
                firstResponsePromise = this.api.generateFirstResponse(nextNodeId, {
                    userMessages: this.userMessages,
                    decisions: this.decisions
                }).catch(err => {
                    console.warn('预加载下一节点首响失败:', err);
                    return null;
                });
            }
        }

        const [analysis, firstResponse] = await Promise.all([analysisPromise, firstResponsePromise]);

        return { analysis, firstResponse, nextNodeId, nextNodeData };
    }

    async preloadEndingData(nodeData) {
        const [summary, analysis] = await Promise.all([
            this.api.generateEndingSummary(this.decisions, this.ethicsScore, nodeData.endingType),
            this.api.analyzeUserTendency(
                this.getNodeMessages(this.currentNode),
                this.currentNode,
                nodeData.choices
            ).catch(err => {
                console.warn('预加载结束分析失败:', err);
                return null;
            })
        ]);

        return { summary, analysis };
    }

    async executeTransition(currentNodeData, nextNodeId, lastMessage, preloaded) {
        const preloadedPromise = preloaded && preloaded.preloadPromise
            ? preloaded.preloadPromise
            : (preloaded ? Promise.resolve(preloaded) : this.preloadTransitionData(currentNodeData, nextNodeId, lastMessage));

        const transitionText = this.api.getScenarioTransitionDirect(
            currentNodeData.id, nextNodeId
        );

        await this.addMessage({
            type: 'system',
            sender: '场景过渡',
            content: transitionText,
            timestamp: new Date()
        });

        const nextNodeData = CASE_NODES[nextNodeId];
        if (!nextNodeData) return;

        await this.addMessage({
            type: 'system',
            sender: '环境',
            content: nextNodeData.scenario,
            timestamp: new Date()
        });

        if (this.nodeDialoguePool && this.nodeDialoguePool.trim().length > 0) {
            console.log(`🔄 节点切换：保存 ${currentNodeData.id} 的对话日志`);
            this.saveNodeDialogueLog(currentNodeData.id);
        }
        
        this.currentNode = nextNodeId;
        this.currentNodeRounds = 0;

        this.updateNodeIndicator(nextNodeData.name);
        this.updateScenarioDisplay(nextNodeData);
        this.updateProgressInfo(nextNodeData);

        let resolvedPreloaded = null;
        try {
            resolvedPreloaded = await preloadedPromise;
        } catch (err) {
            console.warn('预加载过渡数据失败:', err);
            resolvedPreloaded = null;
        }

        if (resolvedPreloaded && resolvedPreloaded.analysis) {
            this.recordDecision(currentNodeData.id, currentNodeData, lastMessage, resolvedPreloaded.analysis);
        }

        if (currentNodeData.id === 'node4' && nextNodeId === 'node5') {
            const lastDecision = this.decisions && this.decisions.length > 0 ? this.decisions.find(d => d.nodeId === 'node4') : null;
            
            if (lastDecision && lastDecision.tendency === 'mediation') {
                const supervisorFeedback = currentNodeData.supervisorFeedback || 
                    `小李，我注意到你选择了帮陈国强传话。作为医务社工，你觉得目前这种"背对背"的沟通模式能真正解决小明的出院问题吗？来，我们召开一个家庭会议吧！`;
                
                await this.addTypingIndicator();
                await this.delay(800);
                this.removeTypingIndicator();
                
                await this.typeMessageWithPreload({
                    type: 'system',
                    sender: '🎓 督导反馈',
                    content: supervisorFeedback,
                    timestamp: new Date()
                }, null);
                
                await this.delay(1000);
            }
        }

        const isImmediateEnding = nextNodeData.isEnding &&
            (nextNodeData.minRounds || 0) === 0 &&
            (nextNodeData.maxRounds || 0) === 0;

        if (isImmediateEnding) {
            await this.handleEnding(nextNodeData);
            return;
        }

        const primaryCharacter = nextNodeData.characters && Array.isArray(nextNodeData.characters) ? nextNodeData.characters.find(c => c !== 'system') : null;
        
        if (primaryCharacter && CHARACTER_PROFILES[primaryCharacter]) {
            const characterName = CHARACTER_PROFILES[primaryCharacter].name;
            
            if (resolvedPreloaded && resolvedPreloaded.firstResponse) {
                await this.typeMessageWithPreload({
                    type: 'npc',
                    sender: characterName,
                    content: resolvedPreloaded.firstResponse,
                    timestamp: new Date()
                }, null);
            } else {
                await this.addTypingIndicator();
                
                try {
                    const firstResponse = await this.api.generateFirstResponse(nextNodeId, {
                        userMessages: this.userMessages,
                        decisions: this.decisions
                    });
                    
                    this.removeTypingIndicator();
                    
                    await this.typeMessageWithPreload({
                        type: 'npc',
                        sender: characterName,
                        content: firstResponse,
                        timestamp: new Date()
                    }, null);
                } catch (error) {
                    this.removeTypingIndicator();
                    
                    await this.addMessage({
                        type: 'system',
                        sender: '系统',
                        content: `⚠️ ${characterName}加载失败，请重试`,
                        timestamp: new Date()
                    });
                }
            }
        }
    }

    async executeEnding(nodeData, preloaded) {
        if (!preloaded) {
            preloaded = await this.preloadEndingData(nodeData);
        }
        if (preloaded && preloaded.preloadPromise) {
            preloaded = await preloaded.preloadPromise;
        }

        if (preloaded.analysis) {
            this.recordDecision(this.currentNode, nodeData, '', preloaded.analysis);
        }
        
        let summaryText = '';
        try {
            this.showGeneratingOverlay();
            await this.ensureOverallAssessmentReady();
            summaryText = preloaded && typeof preloaded.summary === 'string' ? preloaded.summary : '';
            if (!summaryText) {
                summaryText = await this.api.generateEndingSummary(this.decisions, this.ethicsScore, nodeData.endingType);
            }
        } catch (e) {
            console.warn('⚠️ 结束评估生成失败:', e);
            summaryText = '总结生成失败。请检查网络后刷新页面重试。';
        } finally {
            this.hideGeneratingOverlay();
        }

        this.endingSummaryText = summaryText;
        await this.showEndPage(summaryText, { showOverlay: false });
    }

    async ensureOverallAssessmentReady() {
        if (this.redLineViolated) return;
        if (this.overallAssessment) return;
        if (this.nodeResults.length < 5) return;
        if (this.isOverallAssessmentGenerating) return;

        this.isOverallAssessmentGenerating = true;
        try {
            this.overallAssessment = await this.api.generateOverallAssessment(this.nodeResults);
        } catch (e) {
            console.error('❌ 总评生成失败:', e);
            const total = this.nodeResults.reduce((sum, nr) => sum + (typeof nr.nodeSubtotal === 'number' ? nr.nodeSubtotal : 0), 0);
            this.overallAssessment = {
                studentId: '小李',
                totalScore: total,
                nodeScoreSummary: this.nodeResults.map(nr => ({
                    nodeId: nr.nodeId,
                    nodeTitle: nr.nodeTitle,
                    score: typeof nr.nodeSubtotal === 'number' ? nr.nodeSubtotal : 0
                })),
                criteriaFrequency: {},
                strengthCriteria: [],
                blindSpotCriteria: [],
                narrativeSummary: {
                    basicEthics: '总评生成失败',
                    healthcareEthics: '总评生成失败',
                    crossNodePattern: '总评生成遇到技术问题'
                },
                developmentSuggestion: '请稍后重试或刷新页面'
            };
        } finally {
            this.isOverallAssessmentGenerating = false;
        }
    }

    recordQuickDecision(nodeId, nodeData, lastMessage) {
        if (!nodeData.choices) return;

        const userMessages = this.getNodeMessages(nodeId);
        const choiceKey = Object.keys(nodeData.choices)[0];
        const choice = nodeData.choices[choiceKey];
        
        if (choice) {
            this.decisions.push({
                nodeId: nodeId,
                nodeName: nodeData.name,
                userMessages: userMessages,
                rounds: this.currentNodeRounds,
                tendency: 'auto_transition',
                tendencyName: '达到最大轮次自动过渡',
                ethicsScore: 0,
                consequence: '完成必要对话轮次',
                analysis: { primaryTendency: choiceKey }
            });

            this.completedNodes++;
            this.updateDecisionStats();
            this.saveProgress('节点完成');
        }
    }

    getNodeMessages(nodeId) {
        if (!this.userMessages || !Array.isArray(this.userMessages)) {
            console.warn('⚠️ getNodeMessages: userMessages 未定义或不是数组');
            return '';
        }

        return this.userMessages
            .filter(msg => msg.nodeId === nodeId)
            .map(msg => msg.content)
            .join('\n');
    }

    getNPCName(nodeData) {
        if (!nodeData || !nodeData.characters || !Array.isArray(nodeData.characters)) return '角色';
        const characterId = nodeData.characters.find(c => c !== 'system');
        return characterId && CHARACTER_PROFILES[characterId] ? CHARACTER_PROFILES[characterId].name : '角色';
    }

    checkRedLineViolation(text) {
        if (!text || typeof text !== 'string' || this.redLineViolated) {
            return { isViolation: false };
        }

        const lowerText = text.toLowerCase();
        const compactText = lowerText.replace(/\s+/g, '');

        const matchFirst = (patterns, target) => {
            for (const pattern of patterns) {
                const m = target.match(pattern);
                if (m) return { pattern, match: m[0] };
            }
            return null;
        };

        const isWhitelisted = (whitelist, target) => {
            if (!whitelist || whitelist.length === 0) return false;
            return whitelist.some(p => p.test(target));
        };

        const violationPatterns = {
            languageViolence: {
                category: '语言暴力',
                description: '对模拟角色进行辱骂、恶意嘲讽、歧视性言论',
                patterns: [
                    /笨蛋|蠢货|白痴|傻[逼叉屄Bb]|脑残|弱智|废物|垃圾|畜生|人渣|贱[货人]|婊子|滚蛋|杀千刀|不得好死/,
                    /操你|草泥马|尼玛|SB|sb|CNM|NMSL/,
                    /歧视|低等|劣等|下等人|不配活|灭绝吧/,
                    /种族|性别|宗教.*?歧视|男权|女权.*?攻击/
                ],
                contextWhitelist: [
                    /情感.*?(?:交流|沟通|倾诉|表达)/,
                    /模拟.*?(?:场景|情境|案例)/,
                    /深度.*?(?:对话|交谈|沟通)/
                ]
            },
            harmfulIntent: {
                category: '伤害意图',
                description: '在非必要场景下选择暴力手段，或刻意诱导自残、自杀',
                patterns: [
                    /诱导.*?(?:自杀|自残)|鼓励.*?(?:自杀|自残|去死|结束生命)/,
                    /让(?:他|她|你|孩子|患者).*?(?:去死|自杀|自残|结束生命)/,
                    /(?:你|您).{0,6}(?:去死|自杀|自残|结束生命)/,
                    /(?:我要|我想|我准备|我决定).{0,10}(?:自杀|自残|跳楼|割腕|上吊|喝药|结束生命)/,
                    /(?:我要|我想|我准备|我决定).{0,10}(?:弄死|杀死|干掉|灭口|打死|捅死).{0,6}(?:他|她|你|孩子|患者)/,
                    /(?:私自|强行|偷偷).*?(?:拔管|停药|停氧|断氧)/
                ],
                contextWhitelist: [
                    /讨论.*?(?:伦理|道德|困境)/,
                    /分析.*?(?:风险|后果)/,
                    /评估.*?(?:方案|选择)/,
                    /防止.*?(?:自杀|自残)|避免.*?(?:自杀|自残)|预防.*?(?:自杀|自残)/,
                    /他(?:说|提到)|她(?:说|提到)|孩子(?:说|提到)|患者(?:说|提到)/,
                    /安宁疗护|临终关怀|姑息|舒缓治疗|疼痛管理|减轻痛苦|陪伴.*?(?:最后|离开)|好好走完|最后一程/
                ]
            },
            unreasonableBehavior: {
                category: '违背常理',
                description: '违反基本社会契约或职业道德底线',
                patterns: [
                    /(?:我要|我想|我准备|我决定).{0,10}(?:故意误诊|乱开药|开假证明|伪造病历)/,
                    /收受回扣|索要红包|贪污|挪用|侵占|骗保/,
                    /泄露隐私|传播病历|拍照外传/
                ],
                contextWhitelist: [
                    /讨论.*?(?:伦理|道德|困境)/,
                    /分析.*?(?:风险|后果)/,
                    /评估.*?(?:方案|选择)/
                ]
            },
            maliciousDeception: {
                category: '恶意欺骗',
                description: '出于恶意玩弄目的进行大规模造谣或欺诈',
                patterns: [
                    /(?:我要|我想|我准备|我决定).{0,10}(?:诈骗|欺诈|骗局|敲诈|勒索|做假账|造假|伪造证据|作伪证)/,
                    /(?:我要|我想|我准备|我决定).{0,10}(?:编造谣言|散布虚假)/,
                    /恶意隐瞒.*(?!保护性医疗信息)/,
                    /根本没.*?(?:病|事)/
                ],
                contextWhitelist: [
                    /保护性.*?(?:医疗|告知)/,
                    /渐进式.*?(?:告知|披露)/,
                    /善意.*?(?:欺骗|隐瞒|谎言)/,
                    /温柔.*?(?:谎言|隐瞒)/,
                    /安宁疗护|临终关怀|姑息|舒缓治疗|疼痛管理|减轻痛苦|最后一程/,
                    /治疗.*?(?:需要|方案)/
                ]
            }
        };

        for (const [key, config] of Object.entries(violationPatterns)) {
            const hit =
                matchFirst(config.patterns, compactText) ||
                matchFirst(config.patterns, lowerText);

            if (!hit) continue;

            const whitelisted =
                isWhitelisted(config.contextWhitelist, compactText) ||
                isWhitelisted(config.contextWhitelist, lowerText);

            if (whitelisted) {
                console.log(`ℹ️ 红线检测：${config.category} - 已通过上下文白名单豁免`);
                continue;
            }

            console.warn(`🚨 红线违规检测：${config.category}`);
            console.warn(`   违规内容：${text.substring(0, 100)}...`);

            return {
                isViolation: true,
                category: config.category,
                description: config.description,
                violatedText: text.substring(0, 200),
                detectionTime: new Date().toISOString(),
                patternKey: key,
                matched: hit.match,
                matchedPattern: String(hit.pattern)
            };
        }

        return { isViolation: false };
    }

    endSimulationDueToRedLine() {
        console.log('⛔ 因红线违规提前结束模拟');
        
        this.userMessages.push({
            type: 'system',
            sender: '系统通知',
            content: '<strong>🚨 模拟已因红线违规而终止</strong><br><br>您的最终评分为：<span style="color: #dc2626; font-size: 24px; font-weight: bold;">0 分</span>',
            timestamp: new Date(),
            isTermination: true
        });
        
        this.saveProgress('红线违规终止');
        this.showEndPage({
            isRedLineTermination: true,
            violationDetails: this.redLineViolationDetails,
            totalDecisions: this.decisions.length
        });
    }

    recordDecision(nodeId, nodeData, lastMessage, analysis) {
        console.log(`📝 recordDecision called: nodeId=${nodeId}, hasAnalysis=${!!analysis}, redLineViolated=${this.redLineViolated}`);
        
        this.saveNodeConversation(nodeId);
        
        if (this.redLineViolated) {
            console.warn('⚠️ recordDecision: 红线已触发，跳过评分累加');
            
            const zeroScoreEntry = {
                nodeId: nodeId,
                nodeName: nodeData?.name || `节点${nodeId}`,
                userMessages: this.getNodeMessages(nodeId),
                rounds: this.currentNodeRounds,
                nodeSubtotal: 0,
                scoringDetails: [],
                notScoredRemarks: [],
                nodeScoringNote: '红线违规（成绩无效）',
                isRedLineInvalidated: true
            };
            
            this.decisions.push(zeroScoreEntry);
            this.completedNodes++;
            this.updateDecisionStats();
            return;
        }
        
        if (!analysis) {
            console.warn('⚠️ recordDecision: analysis is null/undefined, skipping');
            return;
        }

        const nodeTitle = (analysis && typeof analysis.nodeTitle === 'string' && analysis.nodeTitle.trim())
            ? analysis.nodeTitle.trim()
            : (nodeData?.name || `节点${nodeId}`);

        const scoringDetails = Array.isArray(analysis.scoringDetails) ? analysis.scoringDetails : [];
        const notScoredRemarks = Array.isArray(analysis.notScoredRemarks) ? analysis.notScoredRemarks : [];

        const normalizedScoringDetails = scoringDetails
            .filter(d => d && typeof d === 'object' && typeof d.quote === 'string' && d.quote.trim())
            .map(d => ({
                quote: d.quote.trim(),
                matchedCriteria: Array.isArray(d.matchedCriteria) ? d.matchedCriteria.filter(c => typeof c === 'string') : [],
                criteriaExplanation: typeof d.criteriaExplanation === 'string' ? d.criteriaExplanation : '',
                score: typeof d.score === 'number' ? d.score : 1
            }));

        const normalizedNotScored = notScoredRemarks
            .filter(r => r && typeof r === 'object' && typeof r.quote === 'string' && r.quote.trim())
            .map(r => ({
                quote: r.quote.trim(),
                reason: typeof r.reason === 'string' ? r.reason : ''
            }));

        const computedSubtotal = normalizedScoringDetails.reduce((sum, d) => sum + (typeof d.score === 'number' ? d.score : 0), 0);
        const nodeSubtotalRaw = typeof analysis.nodeSubtotal === 'number' ? analysis.nodeSubtotal : computedSubtotal;
        const nodeSubtotal = Math.max(0, Math.round(nodeSubtotalRaw));

        const nodeScoringNote = typeof analysis.nodeScoringNote === 'string' ? analysis.nodeScoringNote : '';

        const existingIdx = this.nodeResults.findIndex(nr => nr && nr.nodeId === nodeId);
        if (existingIdx >= 0) {
            const prev = this.nodeResults[existingIdx];
            const prevSubtotal = prev && typeof prev.nodeSubtotal === 'number' ? prev.nodeSubtotal : 0;
            this.ethicsScore = Math.max(0, this.ethicsScore - prevSubtotal);
            this.nodeResults.splice(existingIdx, 1);
        }

        const nodeScoreEntry = {
            nodeId,
            nodeTitle,
            scoringDetails: normalizedScoringDetails,
            notScoredRemarks: normalizedNotScored,
            nodeSubtotal,
            nodeScoringNote,
            studentDialogue: this.getNodeMessages(nodeId)
        };

        const decisionRecord = {
            nodeId,
            nodeName: nodeTitle,
            userMessages: this.getNodeMessages(nodeId),
            rounds: this.currentNodeRounds,
            nodeSubtotal,
            scoringDetails: normalizedScoringDetails,
            notScoredRemarks: normalizedNotScored,
            nodeScoringNote
        };

        this.decisions.push(decisionRecord);
        this.nodeResults.push(nodeScoreEntry);

        this.ethicsScore += nodeSubtotal;
        this.completedNodes++;
        this.updateDecisionStats();
    }

    getDefaultAssessmentData(analysis) {
        console.warn('⚠️ 使用默认评估数据');
        return {
            ethicsAnalysis: typeof analysis === 'string' ? analysis : (analysis?.ethicsAnalysis || '评估数据异常'),
            goodPractices: [],
            badPractices: [],
            recommendations: ['请重新进行模拟以获取完整评估'],
            reflectionQuestions: [],
            dimensionScores: [],
            strengths: [],
            concerns: [{
                quote: '数据获取失败',
                violatedPrinciple: 'N/A',
                consequence: '无法完成自动评估',
                betterResponse: '请查看原始分析文本'
            }],
            nodeId: analysis?.nodeId || analysis?.currentNode || 'unknown',
            nodeTitle: analysis?.nodeName || '未知节点',
            primaryTendency: 'unknown',
            tendencyName: '无法判断',
            confidence: 50,
            nodeRawScore: 0,
            nodeRiskLevel: 'medium',
            nodeRiskReason: ''
        };
    }

    cleanAssessmentData(analysis) {
        if (!analysis || typeof analysis !== 'object') return analysis;

        console.log('🧹 开始清理评估数据:', Object.keys(analysis));

        const placeholderPatterns = [
            /此处应插入[^。]*?[。]?/g,
            /请在此处插入[^。]*?[。]?/g,
            /\[此处[^\]]*\]/g,
            /（此处[^\)]*）/g,
            /TODO[^\n]*/gi,
            /待补充[^\n]*/g,
            /^>\s*（[^）]+?引用[^）]*?）[\s\S]*?你[^\n]*?引用[^\n]*?\./gm
        ];

        const cleanText = (text) => {
            if (typeof text !== 'string') return text;
            
            let cleaned = text;
            for (const pattern of placeholderPatterns) {
                cleaned = cleaned.replace(pattern, '');
            }
            
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
            cleaned = cleaned.trim();
            
            return cleaned || '（评估内容生成中，请稍后查看完整报告）';
        };

        const result = { ...analysis };

        if (!result || typeof result !== 'object') {
            console.warn('⚠️ cleanAssessmentData: analysis 无效或不是对象');
            return this.getDefaultAssessmentData(analysis);
        }

        if (result.ethicsAnalysis) {
            result.ethicsAnalysis = cleanText(result.ethicsAnalysis);
        }

        if (Array.isArray(result.goodPractices)) {
            result.goodPractices = result.goodPractices.map(p => cleanText(p)).filter(p => p && !p.includes('（评估内容'));
        } else {
            result.goodPractices = [];
        }

        if (Array.isArray(result.badPractices)) {
            result.badPractices = result.badPractices.map(p => cleanText(p)).filter(p => p && !p.includes('（评估内容'));
        } else {
            result.badPractices = [];
        }

        if (Array.isArray(result.recommendations)) {
            result.recommendations = result.recommendations.map(r => cleanText(r)).filter(r => r && !r.includes('（评估内容'));
        } else {
            result.recommendations = [];
        }

        if (Array.isArray(result.reflectionQuestions)) {
            result.reflectionQuestions = result.reflectionQuestions.map(q => cleanText(q)).filter(q => q && !q.includes('（评估内容'));
        } else {
            result.reflectionQuestions = [];
        }

        result.nodeId = result.nodeId || analysis.currentNode || 'unknown';
        result.nodeTitle = result.nodeTitle || analysis.nodeName || '未知节点';
        
        if (!Array.isArray(result.dimensionScores)) {
            console.warn('⚠️ dimensionScores 不是数组或不存在，初始化为空数组');
            result.dimensionScores = [];
        } else {
            result.dimensionScores = result.dimensionScores.filter(ds => 
                ds && typeof ds === 'object' && ds.dimension && typeof ds.score === 'number'
            ).map(ds => ({
                dimension: ds.dimension || 'D1',
                dimensionName: ds.dimensionName || '未知维度',
                score: Math.min(4, Math.max(1, ds.score)),
                behaviorEvidence: cleanText(ds.behaviorEvidence || ''),
                reasoning: cleanText(ds.reasoning || '')
            }));
        }

        if (!Array.isArray(result.strengths)) {
            console.warn('⚠️ strengths 不是数组或不存在，初始化为空数组');
            result.strengths = [];
        } else {
            result.strengths = result.strengths.filter(s => s && typeof s === 'object' && s.quote).map(s => ({
                quote: cleanText(s.quote),
                principle: s.principle || '伦理原则',
                explanation: cleanText(s.explanation || '')
            }));
        }

        if (!Array.isArray(result.concerns)) {
            console.warn('⚠️ concerns 不是数组或不存在，初始化为默认值');
            result.concerns = [{
                quote: '数据异常',
                violatedPrinciple: 'N/A',
                consequence: '无法完成自动评估',
                betterResponse: '请查看原始分析文本'
            }];
        } else {
            result.concerns = result.concerns.filter(c => c && typeof c === 'object' && c.quote).map(c => ({
                quote: cleanText(c.quote),
                violatedPrinciple: c.violatedPrinciple || '待确认',
                consequence: cleanText(c.consequence || ''),
                betterResponse: cleanText(c.betterResponse || '')
            }));
        }

        result.primaryTendency = result.primaryTendency || 'unknown';
        result.tendencyName = result.tendencyName || '无法判断';
        result.confidence = typeof result.confidence === 'number' ? result.confidence : 50;
        result.nodeRawScore = typeof result.nodeRawScore === 'number' ? result.nodeRawScore : 0;
        result.nodeRiskLevel = result.nodeRiskLevel || 'medium';
        result.nodeRiskReason = result.nodeRiskReason || '';

        console.log('✅ 评估数据清理完成:', {
            nodeId: result.nodeId,
            dimensionScores: result.dimensionScores.length,
            strengths: result.strengths.length,
            concerns: result.concerns.length,
            primaryTendency: result.primaryTendency
        });

        return result;
    }

    async transitionToNextNode(nextNodeId, userChoice) {
        const transition = await this.api.generateScenarioTransition(
            this.currentNode,
            nextNodeId,
            userChoice,
            {
                userMessages: this.userMessages,
                decisions: this.decisions,
                roundsCompleted: this.currentNodeRounds
            }
        );

        await this.addMessage({
            type: 'system',
            sender: '场景过渡',
            content: transition,
            timestamp: new Date()
        });

        await this.delay(400);

        await this.loadNode(nextNodeId);
    }

    async handleEnding(nodeData) {
        this.disableInput();

        await this.delay(400);
        
        if (this.nodeDialoguePool && this.nodeDialoguePool.trim().length > 0) {
            console.log(`🏁 模拟结束：保存最后一个节点 ${this.currentNode} 的对话日志`);
            this.saveNodeDialogueLog(this.currentNode);
        }

        await this.delay(200);
        
        let summaryText = '';
        try {
            this.showGeneratingOverlay();

            await this.ensureOverallAssessmentReady();
            summaryText = await this.api.generateEndingSummary(
                this.decisions,
                this.ethicsScore,
                nodeData.endingType
            );
        } catch (e) {
            console.warn('⚠️ 结束评估生成失败:', e);
            summaryText = '总结生成失败。请检查网络后刷新页面重试。';
        } finally {
            this.hideGeneratingOverlay();
        }

        this.endingSummaryText = summaryText;
        await this.showEndPage(summaryText, { showOverlay: false });
    }

    async showEndPage(summary, options = {}) {
        const showOverlay = options.showOverlay !== false;
        if (showOverlay) {
            this.showGeneratingOverlay();
        }
        
        console.log(`🎬 showEndPage called: nodeResults.length=${this.nodeResults.length}, decisions.length=${this.decisions.length}, redLineViolated=${this.redLineViolated}`);
        
        if (this.redLineViolated || (summary && summary.isRedLineTermination)) {
            console.log('⛔ 显示红线违规结束页面');
            
            const violation = this.redLineViolationDetails || (summary && summary.violationDetails) || {};
            
            if (showOverlay) {
                this.hideGeneratingOverlay();
            }
            
            const summaryDiv = document.getElementById('final-summary');
            summaryDiv.innerHTML = `
                <div class="ending-hero" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
                    <div class="ending-icon">⛔</div>
                    <h1>模拟终止 - 红线违规</h1>
                    <p class="ending-subtitle">您的行为已触碰伦理底线</p>
                </div>
                
                <div class="ending-section" style="border: 2px solid #dc2626; background: #fef2f2;">
                    <h2 style="color: #dc2626;">🚨 红线违规详情</h2>
                    <div class="red-line-violation-details">
                        <div class="violation-category">
                            <strong>违规类别：</strong>
                            <span style="color: #dc2626; font-size: 18px; font-weight: bold;">${violation.category || '未知'}</span>
                        </div>
                        <div class="violation-description">
                            <strong>违规描述：</strong>${violation.description || '严重违反伦理规范'}
                        </div>
                        ${violation.violatedText ? `
                        <div class="violated-text">
                            <strong>违规内容摘要：</strong>
                            <div style="background: white; padding: 10px; border-radius: 5px; margin-top: 5px; border-left: 3px solid #dc2626;">
                                <em>"${this.escapeHtml(violation.violatedText)}"</em>
                            </div>
                        </div>` : ''}
                        <div class="consequence">
                            <strong>⚠️ 处理结果：</strong>
                            <ul style="color: #dc2626; font-weight: bold;">
                                <li>本次模拟总成绩：<span style="font-size: 28px;">0 分</span></li>
                                <li>所有伦理决策评分无效</li>
                                <li>违规记录已保存</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="ending-section">
                    <h2>📋 红线规则说明</h2>
                    <div style="line-height: 1.8;">
                        <p><strong>一票否决机制：</strong>在医务社工伦理模拟中，以下行为将直接导致总成绩清零：</p>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <tr style="background: #fee2e2;">
                                <th style="padding: 8px; border: 1px solid #fecaca; text-align: left;">违规类别</th>
                                <th style="padding: 8px; border: 1px solid #fecaca; text-align: left;">具体表现</th>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #fecaca;"><strong>语言暴力</strong></td>
                                <td style="padding: 8px; border: 1px solid #fecaca;">辱骂、嘲讽、歧视性言论（种族、性别、宗教等）</td>
                            </tr>
                            <tr style="background: #fff7ed;">
                                <td style="padding: 8px; border: 1px solid #fed7aa;"><strong>伤害意图</strong></td>
                                <td style="padding: 8px; border: 1px solid #fed7aa;">暴力手段、诱导自残/自杀等行为</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #fecaca;"><strong>违背常理</strong></td>
                                <td style="padding: 8px; border: 1px solid #fecaca;">违反社会契约或职业道德底线</td>
                            </tr>
                            <tr style="background: #fff7ed;">
                                <td style="padding: 8px; border: 1px solid #fed7aa;"><strong>恶意欺骗</strong></td>
                                <td style="padding: 8px; border: 1px solid #fed7aa;">大规模造谣或恶意欺诈行为</td>
                            </tr>
                        </table>
                        
                        <p style="margin-top: 15px; color: #666; font-style: italic;">
                            💡 <strong>提示：</strong>作为医务社工，您需要始终坚守职业伦理底线。语言和行为不仅影响治疗效果，更关乎患者及其家庭的尊严与信任。
                        </p>
                    </div>
                </div>
                
                <div class="ending-section">
                    <h2>📊 已完成的节点记录</h2>
                    <p style="color: #666;">您已完成 <strong>${this.completedNodes}</strong> 个节点的交互（共${this.decisions.length}条决策记录）</p>
                    <div class="node-details-accordion">
                        ${this.buildNodeDetailsAccordion()}
                    </div>
                </div>
                
                <div class="ending-actions">
                    <button onclick="simulator.restart()" class="secondary-btn" style="background: #dc2626; color: white;">🔄 重新开始测试</button>
                </div>
            `;
            
            this.showPage('end-page');
            window.scrollTo(0, 0);
            
            if (this.userInfo) {
                const body = {
                    records: [{
                        fields: {
                            "Name": this.userInfo.name || '',
                            "Gender": this.userInfo.gender || '',
                            "Major": this.userInfo.major || '',
                            "Student": this.userInfo.studentType || '',
                            "Grade": this.userInfo.grade || '',
                            "School": this.userInfo.school || '',
                            
                            "Node1": this.nodeDataForUpload.n1 || '',
                            "Node2": this.nodeDataForUpload.n2 || '',
                            "Node3": this.nodeDataForUpload.n3 || '',
                            "Node4": this.nodeDataForUpload.n4 || '',
                            "Node5": this.nodeDataForUpload.n5 || '',
                            
                            "Summary": `⛔ 红线违规 - ${violation.category}: ${violation.description}`,
                            "Points": 0
                        }
                    }]
                };
                
                try {
                    const { token: AIRTABLE_TOKEN, baseId: BASE_ID, tableName: TABLE_NAME } = this.getAirtableConfig();
                    if (!AIRTABLE_TOKEN || !BASE_ID || !TABLE_NAME) return;
                    
                    await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`, {
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(body)
                    });
                    
                    console.log('✅ 红线违规数据已上传至Airtable');
                } catch (e) {
                    console.error('❌ 红线违规数据上传失败:', e);
                }
            }
            
            return;
        }
        
        if (this.nodeResults.length >= 5) {
            await this.ensureOverallAssessmentReady();
        } else if (this.nodeResults.length > 0 && this.nodeResults.length < 5 && !this.overallAssessment) {
            const total = this.nodeResults.reduce((sum, nr) => sum + (typeof nr.nodeSubtotal === 'number' ? nr.nodeSubtotal : 0), 0);
            this.overallAssessment = {
                studentId: '小李',
                totalScore: total,
                nodeScoreSummary: this.nodeResults.map(nr => ({
                    nodeId: nr.nodeId,
                    nodeTitle: nr.nodeTitle,
                    score: typeof nr.nodeSubtotal === 'number' ? nr.nodeSubtotal : 0
                })),
                criteriaFrequency: {},
                strengthCriteria: [],
                blindSpotCriteria: [],
                narrativeSummary: {
                    basicEthics: '',
                    healthcareEthics: '',
                    crossNodePattern: `已完成${this.nodeResults.length}/5个节点的评分`
                },
                developmentSuggestion: '请完成全部节点以生成完整总评'
            };
        }
        
        if (showOverlay) {
            this.hideGeneratingOverlay();
        }
        
        const summaryDiv = document.getElementById('final-summary');
        
        const overallEvalHTML = this.buildOverallEvaluationHTML();
        const overallStatsHTML = this.buildOverallStatsHTML();
        const aiSummaryHTML = summary && typeof summary === 'string'
            ? this.formatMarkdown(summary)
            : '<p>总结生成失败或不可用。</p>';
        
        summaryDiv.innerHTML = `
            <div class="ending-hero">
                <div class="ending-icon">🎭</div>
                <h1>模拟完成</h1>
                <p class="ending-subtitle">感谢你完成这次医务社工伦理决策实践</p>
            </div>
            
            <div class="ending-section">
                <h2>📖 故事结局</h2>
                <div class="story-content">
                    <p><strong>一周后，小明回到了家。</strong></p>
                    <p>家里的那只狗高兴地围着他转。妈妈把他画的画贴在了床头。小明表示"很开心能回家"。</p>
                    <p class="story-highlight">在这个案例中，你作为社工小李，陪伴这个家庭走过了最艰难的决策时刻。每一个选择都体现了你对伦理原则的理解和运用。</p>
                </div>
            </div>
            
            ${overallStatsHTML}
            
            <div id="overall-eval-container">${overallEvalHTML}</div>
            
            <div class="ending-section">
                <h2>🧾 AI总结</h2>
                <div id="ai-ending-summary" class="ai-ending-summary">
                    ${aiSummaryHTML}
                </div>
            </div>
            
            <div class="ending-section">
                <h2>📊 节点明细（点击展开）</h2>
                <div class="node-details-accordion">
                    ${this.buildNodeDetailsAccordion()}
                </div>
            </div>
            
            <div class="ending-actions">
                <button onclick="simulator.restart()" class="secondary-btn">🔄 重新开始测试</button>
            </div>
        `;
        
        this.showPage('end-page');
        window.scrollTo(0, 0);
        
        this.tryUploadToAirtable();
    }

    tryUploadToAirtable() {
        if (this.hasUploadedToAirtable) return;
        if (!this.userInfo) return;
        if (this.redLineViolated) return;
        if (this.nodeResults.length >= 5 && !this.overallAssessment) return;
        
        this.hasUploadedToAirtable = true;
        this.uploadToAirtable();
    }

    buildAirtableSummaryReport() {
        const oa = this.overallAssessment && typeof this.overallAssessment === 'object' ? this.overallAssessment : null;
        const totalScore = this.redLineViolated ? 0 : (typeof oa?.totalScore === 'number' ? oa.totalScore : this.ethicsScore);
        const nodeScoreSummary = Array.isArray(oa?.nodeScoreSummary) ? oa.nodeScoreSummary : [];
        const strengthCriteria = Array.isArray(oa?.strengthCriteria) ? oa.strengthCriteria : [];
        const blindSpotCriteria = Array.isArray(oa?.blindSpotCriteria) ? oa.blindSpotCriteria : [];
        const narrativeSummary = oa?.narrativeSummary && typeof oa.narrativeSummary === 'object' ? oa.narrativeSummary : {};
        const developmentSuggestion = typeof oa?.developmentSuggestion === 'string' ? oa.developmentSuggestion : '';

        const lines = [];
        lines.push('【医务社工伦理测评报告】');
        if (this.userInfo && this.userInfo.name) {
            lines.push(`学生：${this.userInfo.name}`);
        } else {
            lines.push('学生：小李');
        }
        lines.push(`总分：${totalScore}`);
        lines.push('');

        if (nodeScoreSummary.length > 0) {
            lines.push('【节点小计】');
            nodeScoreSummary.forEach(n => {
                const id = n && n.nodeId ? String(n.nodeId) : '';
                const title = n && n.nodeTitle ? String(n.nodeTitle) : '';
                const score = n && typeof n.score === 'number' ? n.score : 0;
                lines.push(`${id} ${title}：${score}`);
            });
            lines.push('');
        }

        if (strengthCriteria.length > 0 || blindSpotCriteria.length > 0) {
            lines.push('【优势与盲点】');
            if (strengthCriteria.length > 0) lines.push(`优势标准：${strengthCriteria.join('、')}`);
            if (blindSpotCriteria.length > 0) lines.push(`盲点标准：${blindSpotCriteria.join('、')}`);
            lines.push('');
        }

        const basicEthics = typeof narrativeSummary.basicEthics === 'string' ? narrativeSummary.basicEthics : '';
        const healthcareEthics = typeof narrativeSummary.healthcareEthics === 'string' ? narrativeSummary.healthcareEthics : '';
        const crossNodePattern = typeof narrativeSummary.crossNodePattern === 'string' ? narrativeSummary.crossNodePattern : '';
        if (basicEthics || healthcareEthics || crossNodePattern) {
            lines.push('【叙述性总评】');
            if (basicEthics) lines.push(`基本伦理：${basicEthics}`);
            if (healthcareEthics) lines.push(`医务专项：${healthcareEthics}`);
            if (crossNodePattern) lines.push(`跨节点模式：${crossNodePattern}`);
            lines.push('');
        }

        if (developmentSuggestion) {
            lines.push('【改进建议】');
            lines.push(developmentSuggestion);
            lines.push('');
        }

        const order = ['node1', 'node2', 'node3', 'node4', 'node5'];
        const sortedNodes = Array.isArray(this.nodeResults)
            ? [...this.nodeResults].sort((a, b) => {
                const ai = order.indexOf(a.nodeId);
                const bi = order.indexOf(b.nodeId);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            })
            : [];

        if (sortedNodes.length > 0) {
            lines.push('【节点得分明细】');
            sortedNodes.forEach(nr => {
                const nodeId = nr && nr.nodeId ? String(nr.nodeId) : '';
                const nodeTitle = nr && nr.nodeTitle ? String(nr.nodeTitle) : '';
                const nodeSubtotal = nr && typeof nr.nodeSubtotal === 'number' ? nr.nodeSubtotal : 0;
                lines.push('');
                lines.push(`${nodeId} ${nodeTitle}（小计：${nodeSubtotal}）`);

                const scoringDetails = Array.isArray(nr?.scoringDetails) ? nr.scoringDetails : [];
                if (scoringDetails.length > 0) {
                    scoringDetails.forEach((d, idx) => {
                        const quote = d && typeof d.quote === 'string' ? d.quote : '';
                        const matched = Array.isArray(d?.matchedCriteria) ? d.matchedCriteria.filter(x => typeof x === 'string') : [];
                        const score = d && typeof d.score === 'number' ? d.score : 1;
                        const criteriaText = matched.length > 0 ? `（${matched.join('、')}）` : '';
                        lines.push(`${idx + 1}. +${score}${criteriaText} ${quote}`);
                    });
                } else {
                    lines.push('（本节点暂无可计分语句或评分生成失败）');
                }

                const notScored = Array.isArray(nr?.notScoredRemarks) ? nr.notScoredRemarks : [];
                if (notScored.length > 0) {
                    lines.push('不计分备注：');
                    notScored.forEach(r => {
                        const quote = r && typeof r.quote === 'string' ? r.quote : '';
                        const reason = r && typeof r.reason === 'string' ? r.reason : '';
                        lines.push(`- ${quote}${reason ? `（${reason}）` : ''}`);
                    });
                }
            });
            lines.push('');
        }

        const endingSummary = typeof this.endingSummaryText === 'string' ? this.endingSummaryText.trim() : '';
        if (endingSummary) {
            lines.push('【AI总结】');
            lines.push(endingSummary);
        }

        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    getAirtableConfig() {
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem)
            ? (localStorage.getItem('AIRTABLE_TOKEN') || '')
            : '';
        const baseId = (typeof localStorage !== 'undefined' && localStorage.getItem)
            ? (localStorage.getItem('AIRTABLE_BASE_ID') || '')
            : '';
        const tableName = (typeof localStorage !== 'undefined' && localStorage.getItem)
            ? (localStorage.getItem('AIRTABLE_TABLE_NAME') || 'Table 1')
            : 'Table 1';
        return { token, baseId, tableName };
    }

    async uploadToAirtable() {
        const { token: AIRTABLE_TOKEN, baseId: BASE_ID, tableName: TABLE_NAME } = this.getAirtableConfig();
        if (!AIRTABLE_TOKEN || !BASE_ID || !TABLE_NAME) {
            console.warn('⚠️ Airtable未配置：跳过上传（请在localStorage设置 AIRTABLE_TOKEN / AIRTABLE_BASE_ID / AIRTABLE_TABLE_NAME）');
            const uploadStatus = document.getElementById('airtable-status');
            if (uploadStatus) {
                uploadStatus.innerHTML = '<span style="color: #9ca3af;">ℹ️ 未配置云端同步</span>';
            }
            return;
        }

        if (!this.userInfo) {
            console.warn('⚠️ 无法上传Airtable：用户信息缺失');
            return;
        }

        const finalScore = typeof this.overallAssessment?.totalScore === 'number'
            ? this.overallAssessment.totalScore
            : this.ethicsScore;
        const finalSummary = typeof this.overallAssessment?.developmentSuggestion === 'string'
            ? this.overallAssessment.developmentSuggestion
            : '';
        const reportSummary = this.buildAirtableSummaryReport();

        const body = {
            records: [{
                fields: {
                    "Name": this.userInfo.name || '',
                    "Gender": this.userInfo.gender || '',
                    "Major": this.userInfo.major || '',
                    "Student": this.userInfo.studentType || '',
                    "Grade": this.userInfo.grade || '',
                    "School": this.userInfo.school || '',
                    "Phone": this.userInfo.phone || '',
                    "Email": this.userInfo.email || '',

                    "Node1": (this.nodeDataForUpload.n1 || '').substring(0, 10000),
                    "Node2": (this.nodeDataForUpload.n2 || '').substring(0, 10000),
                    "Node3": (this.nodeDataForUpload.n3 || '').substring(0, 10000),
                    "Node4": (this.nodeDataForUpload.n4 || '').substring(0, 10000),
                    "Node5": (this.nodeDataForUpload.n5 || '').substring(0, 10000),

                    "Summary": (reportSummary || finalSummary || '').substring(0, 10000),
                    "Points": parseInt(finalScore) || 0,

                    "Decisions Count": this.decisions.length,
                    "Ethics Score": this.ethicsScore
                }
            }]
        };
        
        console.log('📊 Airtable上传数据统计：');
        console.log(`   Node1: ${(this.nodeDataForUpload.n1 || '').length} 字符`);
        console.log(`   Node2: ${(this.nodeDataForUpload.n2 || '').length} 字符`);
        console.log(`   Node3: ${(this.nodeDataForUpload.n3 || '').length} 字符`);
        console.log(`   Node4: ${(this.nodeDataForUpload.n4 || '').length} 字符`);
        console.log(`   Node5: ${(this.nodeDataForUpload.n5 || '').length} 字符`);

        try {
            console.log('📤 正在上传数据到Airtable...');
            
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ 伦理模拟测评数据已成功存入 Airtable', result);

                const uploadStatus = document.getElementById('airtable-status');
                if (uploadStatus) {
                    uploadStatus.innerHTML = '<span style="color: #16a34a;">✅ 数据已同步至云端</span>';
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: { message: '无法解析错误信息' } }));
                console.error('❌ 上传失败:', errorData);
                console.error('   HTTP状态码:', response.status);
                console.error('   响应文本:', await response.text().catch(() => '无法读取响应'));

                const errorMessage = errorData?.error?.message ||
                                   errorData?.error?.type ||
                                   `HTTP ${response.status}: ${response.statusText}`;

                const uploadStatus = document.getElementById('airtable-status');
                if (uploadStatus) {
                    uploadStatus.innerHTML = `<span style="color: #dc2626;">⚠️ 同步失败：${errorMessage}</span>`;
                }
            }
        } catch (err) {
            console.error('❌ 网络异常:', err);
            
            const uploadStatus = document.getElementById('airtable-status');
            if (uploadStatus) {
                uploadStatus.innerHTML = '<span style="color: #f59e0b;">⚠️ 网络异常，数据已本地保存</span>';
            }
        }
    }

    saveNodeConversation(nodeId) {
        const nodeIdMap = {
            'node1': 'n1',
            'node2': 'n2',
            'node3': 'n3',
            'node4': 'n4',
            'node5': 'n5'
        };

        const fieldKey = nodeIdMap[nodeId];
        if (!fieldKey) return;

        const existing = this.nodeDataForUpload && this.nodeDataForUpload[fieldKey] ? String(this.nodeDataForUpload[fieldKey]) : '';
        if (existing && existing.includes('完整对话记录')) {
            return;
        }

        const saved = this.saveNodeDialogueLog(nodeId);
        if (saved) {
            return;
        }

        const nodeMessages = this.getNodeMessages(nodeId);
        
        this.nodeDataForUpload[fieldKey] = nodeMessages.substring(0, 2000);
        console.log(`💾 已保存节点 ${nodeId} 的对话记录（仅用户发言，${nodeMessages.length} 字符）`);
    }
    
    saveNodeDialogueLog(nodeId) {
        if (!this.nodeDialoguePool || this.nodeDialoguePool.trim().length === 0) {
            console.log(`⚠️ 节点 ${nodeId} 对话池为空，跳过保存`);
            return false;
        }
        
        const nodeIdMap = {
            'node1': 'n1',
            'node2': 'n2',
            'node3': 'n3',
            'node4': 'n4',
            'node5': 'n5'
        };
        
        const fieldKey = nodeIdMap[nodeId];
        
        if (fieldKey) {
            const dialogueHeader = this.generateDialogueHeader(nodeId);
            const fullDialogueLog = dialogueHeader + this.nodeDialoguePool;
            
            this.nodeDataForUpload[fieldKey] = fullDialogueLog;
            
            const duration = this.currentNodeStartTime ? 
                Math.round((new Date() - this.currentNodeStartTime) / 1000 / 60) : 0;
            
            console.log(`\n📊 节点对话日志保存成功：`);
            console.log(`   节点ID：${nodeId}`);
            console.log(`   对话轮次：${this.currentNodeRounds}`);
            console.log(`   持续时间：${duration} 分钟`);
            console.log(`   对话长度：${this.nodeDialoguePool.length} 字符`);
            console.log(`   前200字预览：${fullDialogueLog.substring(0, 200)}...\n`);
        }
        
        this.nodeDialoguePool = '';
        this.currentNodeStartTime = null;
        return true;
    }
    
    generateDialogueHeader(nodeId) {
        const nodeNames = {
            'node1': '节点1：情绪崩溃',
            'node2': '节点2：基金会请求',
            'node3': '节点3：儿童知情权',
            'node4': '节点4：父亲沟通',
            'node5': '节点5：家庭会议'
        };
        
        const nodeName = nodeNames[nodeId] || `节点${nodeId}`;
        const timestamp = new Date().toLocaleString('zh-CN');
        const separator = '='.repeat(50);
        
        return `${separator}\n【${nodeName}】完整对话记录\n开始时间：${timestamp}\n对话轮次：${this.currentNodeRounds}\n${separator}\n\n`;
    }

    buildOverallEvaluationHTML() {
        if (!this.overallAssessment || typeof this.overallAssessment.totalScore !== 'number') {
            return `
                <div class="overall-eval-section">
                    <h2>⚖️ 综合伦理得分报告</h2>
                    <div class="eval-loading">
                        <p>总评数据生成中或不可用...</p>
                        <p class="eval-note">已基于各节点独立评估结果展示</p>
                    </div>
                </div>
            `;
        }
        
        const oa = this.overallAssessment;

        const totalScore = this.redLineViolated ? 0 : (typeof oa.totalScore === 'number' ? oa.totalScore : this.ethicsScore);
        const nodeScoreSummary = Array.isArray(oa.nodeScoreSummary) ? oa.nodeScoreSummary : [];
        const strengthCriteria = Array.isArray(oa.strengthCriteria) ? oa.strengthCriteria : [];
        const blindSpotCriteria = Array.isArray(oa.blindSpotCriteria) ? oa.blindSpotCriteria : [];
        const narrativeSummary = oa.narrativeSummary && typeof oa.narrativeSummary === 'object' ? oa.narrativeSummary : {};
        const developmentSuggestion = typeof oa.developmentSuggestion === 'string' ? oa.developmentSuggestion : '';
        
        return `
            <div class="overall-eval-section">
                <h2>⚖️ 伦理评分总览（逐句计分）</h2>
                
                <div class="overall-score-banner" style="background: ${this.redLineViolated ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; padding: 30px; border-radius: 12px; text-align: center; color: white;">
                    <div style="font-size: 48px; font-weight: bold; margin-bottom: 10px;">
                        ${totalScore}
                    </div>
                    <div style="font-size: 18px; opacity: 0.9; margin-bottom: 20px;">
                        ${this.redLineViolated ? '红线违规（成绩无效）' : '五节点总累计分'}
                    </div>
                    
                    ${!this.redLineViolated ? `
                    <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 14px; margin-bottom: 10px;">✨ 节点小计</div>
                        <div style="display: flex; justify-content: center; gap: 30px; font-size: 13px;">
                            ${nodeScoreSummary.map(n => `<span>${this.escapeHtml(n.nodeId)}：<strong>${typeof n.score === 'number' ? n.score : 0}</strong></span>`).join('')}
                        </div>
                    </div>` : `
                    <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <div style="font-size: 14px;">⛔ 触碰红线，成绩清零</div>
                        <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
                            请重新进行模拟，坚守职业伦理底线
                        </div>
                    </div>`}
                </div>
                
                <div class="detail-section">
                    <h3>⭐ 优势与盲点</h3>
                    <div class="evidence-cards">
                        <div class="evidence-card best">
                            <span class="card-label">✅ 优势标准</span>
                            <p>${this.escapeHtml(strengthCriteria.join('、') || '暂无')}</p>
                        </div>
                        <div class="evidence-card needs-work">
                            <span class="card-label">⚠️ 盲点标准</span>
                            <p>${this.escapeHtml(blindSpotCriteria.join('、') || '暂无')}</p>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>🧾 叙述性总评</h3>
                    ${narrativeSummary.basicEthics ? `<p><strong>基本伦理：</strong>${this.escapeHtml(narrativeSummary.basicEthics)}</p>` : ''}
                    ${narrativeSummary.healthcareEthics ? `<p><strong>医务专项：</strong>${this.escapeHtml(narrativeSummary.healthcareEthics)}</p>` : ''}
                    ${narrativeSummary.crossNodePattern ? `<p><strong>跨节点模式：</strong>${this.escapeHtml(narrativeSummary.crossNodePattern)}</p>` : ''}
                </div>

                ${developmentSuggestion ? `
                <div class="detail-section">
                    <h3>🛠️ 改进建议</h3>
                    <p>${this.escapeHtml(developmentSuggestion)}</p>
                </div>` : ''}
            </div>
        `;
    }

    buildNodeDetailsAccordion() {
        if (!this.nodeResults || this.nodeResults.length === 0) {
            console.warn('⚠️ buildNodeDetailsAccordion: nodeResults is empty');
            return `
                <div class="no-data-warning">
                    <p>⚠️ 暂无完整的节点评估数据</p>
                    <p class="no-data-hint">可能原因：</p>
                    <ul>
                        <li>部分节点的评估数据正在生成中</li>
                        <li>网络连接可能影响了数据收集</li>
                        <li>请刷新页面重试，或查看上方统计信息</li>
                    </ul>
                    <p class="debug-info">调试信息：已记录 ${this.completedNodes} 个完成节点，${this.decisions.length} 条决策</p>
                </div>
            `;
        }

        const order = ['node1', 'node2', 'node3', 'node4', 'node5'];
        const sorted = [...this.nodeResults].sort((a, b) => {
            const ai = order.indexOf(a.nodeId);
            const bi = order.indexOf(b.nodeId);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });

        return sorted.map((nr, idx) => {
            const nodeId = nr.nodeId || `unknown-${idx}`;
            const nodeTitle = nr.nodeTitle || `节点${idx + 1}`;
            const nodeSubtotal = typeof nr.nodeSubtotal === 'number' ? nr.nodeSubtotal : 0;
            const scoringDetails = Array.isArray(nr.scoringDetails) ? nr.scoringDetails : [];
            const notScoredRemarks = Array.isArray(nr.notScoredRemarks) ? nr.notScoredRemarks : [];
            const nodeScoringNote = typeof nr.nodeScoringNote === 'string' ? nr.nodeScoringNote : '';

            return `
                <details class="node-detail-item">
                    <summary class="node-detail-summary">
                        <span class="node-num">${idx + 1}</span>
                        <span class="node-title">${this.escapeHtml(nodeTitle)}</span>
                        <span class="node-score">+${nodeSubtotal}分</span>
                    </summary>

                    <div class="node-detail-content">
                        ${nodeScoringNote ? `
                        <div class="detail-section">
                            <h4>📝 本节点说明</h4>
                            <p class="analysis-text">${this.escapeHtml(nodeScoringNote)}</p>
                        </div>` : ''}

                        <div class="detail-section">
                            <h4>✅ 得分句明细</h4>
                            ${scoringDetails.length > 0 ? `
                            <ol class="reflection-list">
                                ${scoringDetails.map(d => `
                                    <li>
                                        <div><strong>"${this.escapeHtml(d.quote || '')}"</strong></div>
                                        <div style="margin-top: 6px; color: #555;">
                                            <span style="margin-right: 10px;">标准：${this.escapeHtml((d.matchedCriteria || []).join('、'))}</span>
                                            <span>+${typeof d.score === 'number' ? d.score : 1}</span>
                                        </div>
                                        ${d.criteriaExplanation ? `<div style="margin-top: 6px; color: #666;"><em>${this.escapeHtml(d.criteriaExplanation)}</em></div>` : ''}
                                    </li>
                                `).join('')}
                            </ol>` : '<p class="no-data">暂无可计分语句（或评分生成失败）</p>'}
                        </div>

                        ${notScoredRemarks.length > 0 ? `
                        <div class="detail-section concerns">
                            <h4>🧩 不计分备注（典型）</h4>
                            <ul class="reflection-list">
                                ${notScoredRemarks.map(r => `<li>"${this.escapeHtml(r.quote || '')}"（${this.escapeHtml(r.reason || '')}）</li>`).join('')}
                            </ul>
                        </div>` : ''}
                    </div>
                </details>
            `;
        }).join('');
    }

    buildOverallStatsHTML() {
        return '';
    }

    getScoreInterpretation(score) {
        if (score >= 80) {
            return '🌟 <strong>卓越表现！</strong>你在本次模拟中展现了出色的伦理敏感性和专业判断力。你的回应充分体现了对案主权益的尊重、对专业界限的把握，以及在复杂情境下的决策能力。继续保持这种反思性实践的习惯！';
        } else if (score >= 50) {
            return '👍 <strong>良好表现！</strong>你在大多数情况下做出了符合伦理规范的决策。你在共情能力、专业边界、诚实告知等方面都有不错的表现。建议在个别环节进一步加强反思，特别是在处理情绪强烈的情况时保持专业判断。';
        } else if (score >= 20) {
            return '✅ <strong>合格水平。</strong>你已经掌握了基本的伦理原则，但在实际应用中还有提升空间。特别需要注意：避免过度承诺、保持价值中立、在情感支持与专业判断之间找到平衡。多练习反思性实践会让你进步更快！';
        } else if (score >= 0) {
            return '⚠️ <strong>需要加强。</strong>你在本次模拟中遇到了一些伦理困境，这是学习的好机会。建议重点关注：如何在不伤害案主的前提下传递真实信息、如何在支持与引导之间找到平衡、以及如何管理自己的情绪以维持专业判断。';
        } else {
            return '❗ <strong>重要提醒。</strong>本次模拟中存在一些可能违背伦理原则的决策。请不要气馓——这正是模拟训练的价值所在！请仔细阅读下方的详细评估报告，理解每个决策的潜在影响。社会工作是一个需要持续学习和反思的职业。';
        }
    }

    buildEthicsEvaluationHTML() {
        if (this.decisions.length === 0) {
            return '';
        }

        let html = `
            <div class="ethics-evaluation-section">
                <h2>⚖️ 详细伦理评估报告</h2>
                <p class="ethics-intro">以下是对你在每个节点中具体话语的专业评价，请仔细阅读并进行反思。</p>
        `;

        this.decisions.forEach((decision, index) => {
            const analysis = decision.analysis;
            if (!analysis || analysis.primaryTendency === 'unknown' || analysis.primaryTendency === 'error') {
                return;
            }

            const hasGood = analysis.goodPractices && analysis.goodPractices.length > 0;
            const hasBad = analysis.badPractices && analysis.badPractices.length > 0;
            const hasReflection = analysis.reflectionQuestions && analysis.reflectionQuestions.length > 0;
            const riskLevel = analysis.riskLevel || 'medium';

            html += `
                <div class="ethics-node-card">
                    <div class="ethics-node-header">
                        <h3>📍 节点${index + 1}：${decision.nodeName}</h3>
                        <span class="ethics-tendency-tag ${this.getTendencyClass(decision.tendency)}">
                            倾向：${decision.tendencyName || '未识别'}
                        </span>
                        <span class="ethics-score-tag ${decision.ethicsScore >= 0 ? 'positive' : 'negative'}">
                            伦理评分：${decision.ethicsScore > 0 ? '+' : ''}${decision.ethicsScore}${decision.ethicsScoreBonus > 0 ? `（AI+${decision.ethicsScoreBonus}）` : ''}
                        </span>
                        <span class="risk-level-tag ${riskLevel}">
                            ${this.getRiskLevelTag(riskLevel)}
                        </span>
                    </div>

                    ${analysis.ethicsAnalysis ? `
                    <div class="ethics-overview">
                        <h4>📝 整体分析</h4>
                        <p>${analysis.ethicsAnalysis}</p>
                    </div>
                    ` : ''}

                    ${hasGood ? `
                    <div class="ethics-good">
                        <h4>✅ 做得好的地方</h4>
                        <ul>
                            ${analysis.goodPractices.map(practice => `<li>${practice}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}

                    ${hasBad ? `
                    <div class="ethics-bad">
                        <h4>⚠️ 需要反思的地方</h4>
                        <ul>
                            ${analysis.badPractices.map(practice => `<li>${practice}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}

                    ${analysis.recommendations && analysis.recommendations.length > 0 ? `
                    <div class="ethics-recommendations">
                        <h4>💡 专业建议</h4>
                        <ol>
                            ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ol>
                    </div>
                    ` : ''}

                    ${hasReflection ? `
                    <div class="ethics-reflection">
                        <h4>🤔 请思考以下问题</h4>
                        <div class="reflection-questions">
                            ${analysis.reflectionQuestions.map(q => `<div class="reflection-q">• ${q}</div>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        });

        html += `
            </div>
            <div class="ethics-final-note">
                <p><strong>💭 教学提示：</strong>社会工作没有标准答案，但每一次对话都是学习的机会。以上评价旨在帮助你反思自己的专业实践，而非对你的人格评判。请在未来的工作中持续学习和成长！</p>
            </div>
        `;

        return html;
    }

    getTendencyClass(tendency) {
        const map = {
            'emotional_response': 'tendency-emotional',
            'professional_boundary': 'tendency-professional',
            'honest_communication': 'tendency-honest',
            'client_self_determination': 'tendency-self-determination',
            'mediation': 'tendency-mediation',
            'empowerment': 'tendency-empowerment'
        };
        return map[tendency] || 'tendency-default';
    }

    getRiskLevelTag(level) {
        const map = {
            'low': '🟢 低风险',
            'medium': '🟡 中等风险',
            'high': '🔴 高风险'
        };
        return map[level] || '🟡 中等风险';
    }

    formatMarkdown(text) {
        if (!text || typeof text !== 'string') return '';

        const normalizeNewlines = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const isSafeHref = (href) => {
            if (!href || typeof href !== 'string') return false;
            const h = href.trim().toLowerCase();
            return h.startsWith('https://') || h.startsWith('http://') || h.startsWith('mailto:');
        };

        const applyInline = (s) => {
            let out = s;
            out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, href) => {
                if (!isSafeHref(href)) return label;
                const safeHref = href.replace(/"/g, '&quot;');
                return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
            });
            out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
            out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
            return out;
        };

        const source = normalizeNewlines(text);

        const codeBlocks = [];
        const withCodeTokens = source.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
            const idx = codeBlocks.length;
            const escapedCode = this.escapeHtml(normalizeNewlines(code));
            const safeLang = (lang || '').replace(/[^a-z0-9_-]/gi, '');
            const langClass = safeLang ? ` class="language-${safeLang}"` : '';
            codeBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`);
            return `@@CODEBLOCK_${idx}@@`;
        });

        const escaped = this.escapeHtml(withCodeTokens);
        const lines = normalizeNewlines(escaped).split('\n');

        const out = [];
        let paragraph = [];
        let listType = null;
        let listItems = [];
        let inBlockquote = false;
        let blockquoteLines = [];

        const flushParagraph = () => {
            if (paragraph.length === 0) return;
            out.push(`<p>${applyInline(paragraph.join('<br>'))}</p>`);
            paragraph = [];
        };

        const flushList = () => {
            if (!listType || listItems.length === 0) {
                listType = null;
                listItems = [];
                return;
            }
            const tag = listType === 'ol' ? 'ol' : 'ul';
            out.push(`<${tag}>${listItems.map(i => `<li>${applyInline(i)}</li>`).join('')}</${tag}>`);
            listType = null;
            listItems = [];
        };

        const flushBlockquote = () => {
            if (!inBlockquote) return;
            const content = blockquoteLines.length > 0 ? blockquoteLines.join('<br>') : '';
            out.push(`<blockquote>${applyInline(content)}</blockquote>`);
            inBlockquote = false;
            blockquoteLines = [];
        };

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            const trimmed = line.trim();

            if (trimmed.startsWith('@@CODEBLOCK_') && trimmed.endsWith('@@')) {
                flushParagraph();
                flushList();
                flushBlockquote();
                out.push(trimmed);
                continue;
            }

            if (trimmed === '') {
                flushParagraph();
                flushList();
                flushBlockquote();
                continue;
            }

            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (headingMatch) {
                flushParagraph();
                flushList();
                flushBlockquote();
                const level = headingMatch[1].length;
                out.push(`<h${level}>${applyInline(headingMatch[2].trim())}</h${level}>`);
                continue;
            }

            const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);
            if (blockquoteMatch) {
                flushParagraph();
                flushList();
                inBlockquote = true;
                blockquoteLines.push(blockquoteMatch[1]);
                continue;
            }

            if (inBlockquote) {
                flushBlockquote();
            }

            const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            if (olMatch) {
                flushParagraph();
                if (listType && listType !== 'ol') flushList();
                listType = 'ol';
                listItems.push(olMatch[1]);
                continue;
            }

            const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
            if (ulMatch) {
                flushParagraph();
                if (listType && listType !== 'ul') flushList();
                listType = 'ul';
                listItems.push(ulMatch[1]);
                continue;
            }

            if (listType) {
                flushList();
            }

            paragraph.push(trimmed);
        }

        flushParagraph();
        flushList();
        flushBlockquote();

        let html = out.join('');
        for (let i = 0; i < codeBlocks.length; i++) {
            const token = `@@CODEBLOCK_${i}@@`;
            html = html.split(token).join(codeBlocks[i]);
        }
        return html;
    }

    restart() {
        this.saveUserInfo();
        this.clearSavedProgress();
        
        this.currentNode = 'node1';
        this.currentNodeRounds = 0;
        this.userMessages = [];
        this.decisions = [];
        this.ethicsScore = 0;
        this.completedNodes = 0;
        this.isProcessing = false;
        this.nodeResults = [];
        this.overallAssessment = null;
        this.isOverallAssessmentGenerating = false;
        this.hasUploadedToAirtable = false;
        this.api.resetConversation();

        document.getElementById('chat-messages').innerHTML = '';
        document.getElementById('message-log').innerHTML = '<p class="empty-log">暂无消息</p>';
        const completedNodesEl = document.getElementById('completed-nodes');
        if (completedNodesEl) {
            completedNodesEl.textContent = '0/5';
        }

        showPage('info-page');
        
        const form = document.getElementById('info-form');
        if (form) form.reset();
        this.userInfo = null;
        localStorage.removeItem('currentUserInfo');
    }

    async addMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = this.createMessageElement(message);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        this.updateMessageLog(message);
    }

    async typeMessageWithPreload(message, preloadFn, options = {}) {
        this.isTyping = true;
        
        const messagesContainer = document.getElementById('chat-messages');
        
        const div = document.createElement('div');
        div.className = `message ${message.type} message-typing`;
        
        const avatar = this.getAvatar(message.type, message.sender);
        const time = this.formatTime(message.timestamp);
        
        div.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-sender">${message.sender}</div>
                <div class="message-text"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.updateMessageLog(message);

        const textSpan = div.querySelector('.typewriter-text');
        const cursorSpan = div.querySelector('.typewriter-cursor');
        const fullText = message.content;
        
        const preloadPromise = preloadFn ? preloadFn() : Promise.resolve(null);
        
        let i = 0;
        const isSystem = message.type === 'system';
        const isEnvironmentNarration = isSystem && message.sender === '环境';
        const baseSpeed = options.speed || (isSystem ? 18 : 35);
        const punctuationPause = isSystem ? 60 : 120;
        const endPause = isSystem ? 80 : 200;

        if (options.instant || isEnvironmentNarration) {
            textSpan.textContent = fullText;
            cursorSpan.style.display = 'none';
            div.classList.remove('message-typing');
            this.isTyping = false;

            if ((message.type === 'npc' || message.type === 'npc-character') && !message.loggedToPool) {
                const roleName = this.extractRoleName(message.sender) || message.sender;
                this.addToDialoguePool(roleName, fullText);
                message.loggedToPool = true;
            }
            return { preloadPromise };
        }
        
        let lastScrollAt = 0;
        while (i < fullText.length) {
            if (!this.isTyping) {
                textSpan.textContent = fullText;
                break;
            }
            
            const char = fullText[i];
            textSpan.textContent += char;
            
            let wait = baseSpeed;
            if ('，。！？；：、…—》」』'.includes(char)) {
                wait = punctuationPause;
            } else if (char === '\n') {
                wait = endPause;
            }
            
            i++;
            const now = performance.now();
            if (now - lastScrollAt > 80 || char === '\n') {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                lastScrollAt = now;
            }
            
            await new Promise(r => setTimeout(r, wait));
        }

        cursorSpan.style.display = 'none';
        div.classList.remove('message-typing');
        this.isTyping = false;

        if ((message.type === 'npc' || message.type === 'npc-character') && !message.loggedToPool) {
            const roleName = this.extractRoleName(message.sender) || message.sender;
            this.addToDialoguePool(roleName, fullText);
            message.loggedToPool = true;
        }
        return { preloadPromise };
    }

    skipTyping() {
        this.isTyping = false;
    }

    toggleSidebar() {
        const panel = document.querySelector('.status-panel');
        const toggle = document.getElementById('sidebar-toggle');
        const overlay = document.getElementById('sidebar-overlay');

        if (!panel) return;

        const isVisible = panel.classList.contains('sidebar-visible');

        if (isVisible) {
            panel.classList.remove('sidebar-visible');
            toggle?.classList.remove('hidden');
            overlay?.classList.remove('visible');
        } else {
            panel.classList.add('sidebar-visible');
            toggle?.classList.add('hidden');
            overlay?.classList.add('visible');
        }
    }

    initMobileSidebar() {
        if (window.innerWidth > 768) return;

        const toggle = document.getElementById('sidebar-toggle');
        toggle?.classList.remove('hidden');

        const chatArea = document.querySelector('.chat-area');
        if (!chatArea) return;

        chatArea.classList.add('swipe-hint');

        let touchStartX = 0;
        let touchStartY = 0;
        let isSwiping = false;

        chatArea.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = true;
        }, { passive: true });

        chatArea.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;

            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = Math.abs(e.touches[0].clientY - touchStartY);

            if (deltaX > 50 && deltaY < 30) {
                this.toggleSidebar();
                chatArea.classList.add('swipe-dismissed');
                isSwiping = false;
            }
        }, { passive: true });

        chatArea.addEventListener('touchend', () => {
            isSwiping = false;
        }, { passive: true });
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        div.className = `message ${message.type}`;

        const avatar = this.getAvatar(message.type, message.sender);
        const time = this.formatTime(message.timestamp);
        const displayContent = (message.type === 'npc' || message.type === 'npc-character') ? this.removeActionPrompts(message.content) : message.content;

        div.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-sender">${message.sender}</div>
                <div class="message-text">${displayContent}</div>
                <div class="message-time">${time}</div>
            </div>
        `;

        return div;
    }

    getAvatar(type, sender) {
        if (type === 'system') return '📋';
        if (type === 'user') return '👩‍💼';
        
        const character = Object.values(CHARACTER_PROFILES).find(c => c.name === sender);
        return character ? character.avatar : '👤';
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateMessageLog(message) {
        const logContainer = document.getElementById('message-log');
        const emptyLog = logContainer.querySelector('.empty-log');
        if (emptyLog) {
            emptyLog.remove();
        }

        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        logItem.innerHTML = `
            <span class="log-sender">${message.sender}:</span>
            <span class="log-content">${this.truncateText(message.content, 50)}</span>
        `;
        logContainer.appendChild(logItem);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    removeActionPrompts(text) {
        if (!text || typeof text !== 'string') return text;

        let cleaned = text;

        cleaned = cleaned.replace(/[（(][^）)]*动作提示[：:][^）)]*[）)]/g, '');
        cleaned = cleaned.replace(/[（(][^）)]*[动作|神态|表情|语气|姿态][^）)]*[）)]/g, '');

        const actionPatterns = [
            /[（(][^）]{0,30}(?:沉默|颤抖|低头|叹气|擦泪|握住|转身|点头|摇头|停顿|深呼吸|犹豫|紧握|松开|移开|看向|注视|微笑|皱眉|咬唇)[^）]{0,20}[）)]/g,
            /(?:长久地|轻轻地|慢慢地|突然|猛地|缓缓|微微|轻轻)[^。]{0,40}(?:沉默|颤抖|低头|叹气|擦泪|转身|点头|摇头)/g
        ];

        for (const pattern of actionPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        cleaned = cleaned.replace(/\s*[（(]\s*[）)]\s*/g, '');
        cleaned = cleaned.replace(/["""]([^"""]*)["""]/g, '$1');
        cleaned = cleaned.replace(/\s{2,}/g, ' ');
        cleaned = cleaned.trim();

        return cleaned || text;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateScenarioDisplay(nodeData) {
        const scenarioBox = document.getElementById('scenario-box');
        scenarioBox.innerHTML = `
            <h4>${nodeData.name}</h4>
            <p class="description">${nodeData.description}</p>
        `;
    }

    updateNodeIndicator(nodeName) {
        document.getElementById('current-node-name').textContent = nodeName;
    }

    updateProgressInfo(nodeData) {
        const minRounds = nodeData.minRounds || 2;
        const maxRounds = nodeData.maxRounds || 4;
        
        const progressBox = document.getElementById('progress-info');
        progressBox.innerHTML = `
            <div class="rounds-info">
                <strong>当前轮次：</strong>0 / ${minRounds}-${maxRounds}
            </div>
            <div class="progress-hint">
                请与角色进行自然对话...
            </div>
        `;
    }

    updateRoundDisplay() {
        const nodeData = CASE_NODES[this.currentNode];
        const minRounds = nodeData.minRounds || 2;
        const maxRounds = nodeData.maxRounds || 4;
        
        const progressBox = document.getElementById('progress-info');
        if (progressBox) {
            progressBox.innerHTML = `
                <div class="rounds-info">
                    <strong>当前轮次：</strong>${this.currentNodeRounds} / ${minRounds}-${maxRounds}
                </div>
                <div class="progress-hint">
                    ${this.currentNodeRounds < minRounds ? 
                        '继续深入对话...' : 
                        this.currentNodeRounds >= maxRounds ?
                            '即将进入下一阶段...' :
                            '可以尝试引导话题...'}
                </div>
            `;
        }
    }

    updateDecisionStats() {
        const el = document.getElementById('completed-nodes');
        if (el) {
            el.textContent = `${this.completedNodes}/5`;
        }
    }

    updateUI() {
        this.updateDecisionStats();
    }

    enableInput() {
        document.getElementById('user-input').disabled = false;
        document.getElementById('send-btn').disabled = false;
        document.getElementById('user-input').focus();
        this.updateRoundDisplay();
    }

    disableInput() {
        document.getElementById('user-input').disabled = true;
        document.getElementById('send-btn').disabled = true;
    }

    async addTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message npc typing-message';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">👤</div>
            <div class="message-content">
                <div class="message-sender">正在输入...</div>
                <div class="message-text">
                    <span class="loading"></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getLastTendency(nodeId) {
        const decision = this.decisions.find(d => d.nodeId === nodeId);
        return decision ? decision.tendency : null;
    }

    detectCriticalEthicalQuestion(userMessage) {
        const criticalPatterns = [
            /是不是.*(?:死了|治不好|快不行了|没救了|快走了)/,
            /能不能.*(?:告诉我|说|讲).*(?:真相|实话|真实情况)/,
            /我会*(?:怎么样|如何|还有多久|什么时候)/,
            /(?:死|去世|离开|走).*\?/,
            /还能.*(?:活多久|活多长|撑多久)/,
            /是不是.*(?:癌症|肿瘤|病).*(?:严重|晚期|没办法)/,
            /医生.*(?:怎么说|怎么讲|什么意思)/,
            /我不想.*(?:死|走|离开|痛苦)/,
            /怕.*(?:死|痛|离开|看不到)/,
            /回家.*(?:是什么意思|是不是|难道)/,
            /真相|实话|隐瞒|欺骗/
        ];

        const msg = userMessage || '';
        return criticalPatterns.some(pattern => pattern.test(msg));
    }

    splitMultiCharacterMessage(content, nodeData) {
        const messages = [];
        
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return [{
                type: 'npc',
                sender: this.getNPCName(nodeData),
                content: content || '',
                timestamp: new Date()
            }];
        }

        console.log('🔍 开始拆分多角色消息，原始内容前200字:', content.substring(0, 200));

        const switchPattern = /【切换到[：:]\s*([^】]+)】/g;
        const parts = [];
        let lastIndex = 0;
        let match;
        let currentSender = this.getNPCName(nodeData);
        let foundSwitch = false;

        while ((match = switchPattern.exec(content)) !== null) {
            foundSwitch = true;
            
            const beforeText = content.substring(lastIndex, match.index).trim();
            if (beforeText) {
                parts.push({
                    text: beforeText,
                    sender: currentSender
                });
            }
            
            currentSender = this.resolveCharacterName(match[1].trim());
            
            lastIndex = match.index + match[0].length;
        }

        if (foundSwitch) {
            const remainingText = content.substring(lastIndex).trim();
            if (remainingText) {
                parts.push({
                    text: remainingText,
                    sender: currentSender
                });
            }

            parts.forEach(part => {
                if (part.text && part.text.trim()) {
                    messages.push(this.createCharacterMessage(part.sender, part.text.trim()));
                }
            });

            if (messages.length === 0) {
                messages.push(this.createCharacterMessage(this.getNPCName(nodeData), content));
            }

            console.log('✅ 【切换到】标记拆分成功:', messages.map(m => `${m.sender}: ${m.content.substring(0, 30)}...`));
            
            this.validateAndCorrectRoles(messages);
            
            return messages;
        }

        console.log('🔍 未找到【切换到】标记，尝试语义分析...');
        
        const semanticParts = this.detectSemanticSpeakers(content, nodeData);
        
        if (semanticParts.length > 1) {
            semanticParts.forEach(part => {
                messages.push(this.createCharacterMessage(part.sender, part.text.trim()));
            });
            
            console.log('✅ 语义拆分成功，共', messages.length, '个气泡');
            
            this.validateAndCorrectRoles(messages);
            
            return messages;
        }

        console.log('⚠️ 未检测到多角色，返回单一消息（默认角色）');
        return [this.createCharacterMessage(this.getNPCName(nodeData), content)];
    }
    
    validateAndCorrectRoles(messages) {
        if (!messages || messages.length === 0) return;
        
        console.log('\n🔍 开始角色归属后处理校验...');
        
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const detectedSpeaker = this.guessSpeakerFromContent(msg.content, msg.sender);
            
            if (detectedSpeaker && detectedSpeaker !== msg.sender) {
                console.warn(`\n⚠️ 角色归属不一致检测到！`);
                console.warn(`   消息 #${i + 1}:`);
                console.warn(`   原始发送者：${msg.sender}`);
                console.warn(`   检测到的正确角色：${detectedSpeaker}`);
                console.warn(`   内容摘要：${msg.content.substring(0, 80)}...`);
                
                const correction = this.shouldCorrectRoleAssignment(msg.sender, detectedSpeaker, msg.content);
                
                if (correction.shouldCorrect) {
                    console.warn(`🔧 自动修正：${correction.reason}`);
                    msg.sender = detectedSpeaker;
                    msg.type = detectedSpeaker.includes('刘雪梅') ? 'npc' : 'npc-character';
                } else {
                    console.log(`✅ 保持原始分配：${correction.reason}`);
                }
            } else {
                console.log(`✅ 消息 #${i + 1}: 角色归属一致 (${msg.sender})`);
            }
        }
        
        console.log('🎭 角色校验完成\n');
    }
    
    shouldCorrectRoleAssignment(originalSender, detectedSender, content) {
        const xiaomingIndicators = [/我才\d+岁/, /我想回家/, /姐姐你知道吗/, /我不怕痛/, /我很痛/, /旺财/, /面条/, /晒太阳/, /医生叔叔/];
        const motherIndicators = [/我的孩子/, /他才\d+岁/, /我儿子/, /我不能接受/, /你们要.*?放弃/, /会不会很痛/, /不想让他受罪/, /我不敢做决定/, /回家的话/, /没有希望/];
        
        const isStrongXiaoming = xiaomingIndicators.some(p => p.test(content));
        const isStrongMother = motherIndicators.some(p => p.test(content));
        
        if (isStrongXiaoming && detectedSender.includes('小明')) {
            return { shouldCorrect: true, reason: '强烈的小明第一人称特征匹配' };
        }
        
        if (isStrongMother && detectedSender.includes('母亲')) {
            return { shouldCorrect: true, reason: '强烈的母亲第三人称特征匹配' };
        }
        
        if (originalSender === detectedSender) {
            return { shouldCorrect: false, reason: '检测结果与原分配一致' };
        }
        
        return { shouldCorrect: false, reason: '特征不够明确，保持原分配以避免误判' };
    }

    resolveCharacterName(rawName) {
        const name = rawName.trim();
        
        if (name.includes('陈国强') || name.includes('国强') || name.includes('爸爸') || name.includes('父亲')) {
            return '👨 陈国强（父亲）';
        }
        if (name.includes('刘雪梅') || name.includes('雪梅') || name.includes('妈妈') || name.includes('母亲')) {
            return '👩 刘雪梅（母亲）';
        }
        if (name.includes('小明') || name.includes('患儿')) {
            return '👦 小明（患儿）';
        }
        
        return `🎭 ${name}`;
    }

    detectSemanticSpeakers(content, nodeData) {
        const parts = [];
        const defaultSender = this.getNPCName(nodeData);

        const chenguoqiangIndicators = [
            /孩子他妈[^。！？]*[""「]([^""」]{5,})[""」]/gi,
            /(?:陈国强|爸爸|父亲|国强)[：:\s][""「]([^""」]{5,})[""」]/gi,
            /(?:^|\n)[\s]*[（(][^）)]*?(?:陈国强|爸爸|父亲|国强)[^）)]*?[）][\s\S]*?[""「][^""】]*[""」]/gi
        ];

        const xiaomingIndicators = [
            /(?:我才\d+岁|我想回家|姐姐|不想.*妈妈.*哭|旺财|面条|晒太阳|画画)[：:\s][""「]([^""】]{5,})[""」]/gi,
            /(?:^|\n)[\s]*[（(][^）)]*?小明[^）)]*?[）][\s\S]*?[""「][^""】]*[""」]/gi,
            /小明[：:\s][""「]([^""】]{5,})[""」]/gi
        ];

        let lastEndIndex = 0;

        for (const pattern of chenguoqiangIndicators) {
            pattern.lastIndex = 0;
            let match;
            
            while ((match = pattern.exec(content)) !== null) {
                const matchedText = match[0];
                const matchStart = match.index;
                
                if (matchStart > lastEndIndex + 3) {
                    const betweenText = content.substring(lastEndIndex, matchStart).trim();
                    if (betweenText.length > 8) {
                        parts.push({ 
                            text: betweenText, 
                            sender: this.guessSpeakerFromContent(betweenText, defaultSender) 
                        });
                    }
                }

                const cleanText = this.extractQuotedText(matchedText);
                if (cleanText && cleanText.length > 2) {
                    parts.push({ text: cleanText, sender: '👨 陈国强（父亲）' });
                } else if (matchedText.length > 10) {
                    parts.push({ text: matchedText.trim(), sender: '👨 陈国强（父亲）' });
                }
                
                lastEndIndex = Math.max(lastEndIndex, matchStart + matchedText.length);
            }
        }

        for (const pattern of xiaomingIndicators) {
            pattern.lastIndex = 0;
            let match;
            
            while ((match = pattern.exec(content)) !== null) {
                const matchedText = match[0];
                const matchStart = match.index;
                
                if (matchStart >= lastEndIndex && (matchStart - lastEndIndex) > 3) {
                    const betweenText = content.substring(lastEndIndex, matchStart).trim();
                    if (betweenText.length > 8) {
                        const speaker = this.guessSpeakerFromContent(betweenText, defaultSender);
                        if (speaker !== '👦 小明（患儿）') {
                            parts.push({ text: betweenText, sender: speaker });
                        }
                    }
                }

                const cleanText = this.extractQuotedText(matchedText);
                if (cleanText && cleanText.length > 2) {
                    parts.push({ text: cleanText, sender: '👦 小明（患儿）' });
                } else if (matchedText.length > 10) {
                    parts.push({ text: matchedText.trim(), sender: '👦 小明（患儿）' });
                }
                
                lastEndIndex = Math.max(lastEndIndex, matchStart + matchedText.length);
            }
        }

        if (lastEndIndex < content.length - 5) {
            const finalText = content.substring(lastEndIndex).trim();
            if (finalText.length > 5) {
                parts.push({ 
                    text: finalText, 
                    sender: this.guessSpeakerFromContent(finalText, defaultSender) 
                });
            }
        }

        if (parts.length <= 1) {
            return [{ text: content, sender: defaultSender }];
        }

        return parts;
    }

    guessSpeakerFromContent(text, defaultSender) {
        if (!text || text.length < 3) return defaultSender;

        const cleanedText = text.replace(/[（(][^）)]*[）)]/g, '').trim();
        
        const firstPersonPatterns = {
            xiaoming: {
                patterns: [/我才\d+岁/, /我想回家/, /姐姐你知道吗/, /我不怕痛/, /我只是不想/, /我想吃/, /我想画/, /我看出来了/, /我不想治了/, /我很痛/, /我怕/, /妈妈.*?(?:哭|说|想)/, /家里.*?(?:狗|画)/],
                weight: 10,
                description: '小明第一人称特征'
            },
            mother: {
                patterns: [/我的孩子/, /他才\d+岁/, /我儿子/, /我不能接受/, /你们要.*?(?:放弃|怎么)/, /孩子他妈/, /我怎么.*?(?:能|可以)/, /作为母亲/, /我照顾/, /我也好怕/, /我不想让他/],
                weight: 10,
                description: '母亲第一人称特征'
            },
            father: {
                patterns: [/我作为爸爸/, /孩子他妈.*?你/, /让我想想/, /这事真的/, /我是.*?爸爸/],
                weight: 8,
                description: '父亲第一人称特征'
            }
        };

        let scores = { xiaoming: 0, mother: 0, father: 0 };
        
        for (const [role, config] of Object.entries(firstPersonPatterns)) {
            for (const pattern of config.patterns) {
                if (pattern.test(cleanedText)) {
                    scores[role] += config.weight;
                    console.log(`🎭 角色检测：匹配到${config.description} (+${config.weight}分)`);
                }
            }
        }

        const thirdPersonContext = {
            motherReferringToChild: [/他才会/, /这孩子/, /小明他/, /我儿子他/, /小孩子.*?怎么/],
            childReferringToMom: [/妈妈她/, /她说/, /妈妈不让我/],
            fatherReferringToWife: [/雪梅她/, /孩子他妈她/, /你老婆/]
        };

        if (thirdPersonContext.motherReferringToChild.some(p => p.test(cleanedText))) {
            scores.mother += 8;
            console.log('🎭 角色检测：母亲指代孩子（第三人称）(+8分)');
        }

        if (thirdPersonContext.childReferringToMom.some(p => p.test(cleanedText))) {
            scores.xiaoming += 8;
            console.log('🎭 角色检测：孩子指代妈妈（第三人称）(+8分)');
        }

        if (thirdPersonContext.fatherReferringToWife.some(p => p.test(cleanedText))) {
            scores.father += 8;
            console.log('🎭 角色检测：父亲指代妻子（第三人称）(+8分)');
        }

        const actionTagMatch = text.match(/[（(]([^）)]+?)[）)]/);
        let actionSubject = null;
        
        if (actionTagMatch && actionTagMatch[1]) {
            const actionText = actionTagMatch[1];
            
            if (/(?:小明|男孩|弟弟)\s*(?:抬头|低头|看|画|说|想|问|递)/.test(actionText) || /他\s*(?:低头|看|画|说|想|问|抬头)/.test(actionText)) {
                actionSubject = 'xiaoming';
                console.log(`🎭 动作标签检测：动作主体是小明 - "${actionText}"`);
            } else if (/刘雪梅|母亲|雪梅|她\s*(?:擦|哭|握|攥|抚摸|站|说|喊)/.test(actionText)) {
                actionSubject = 'mother';
                console.log(`🎭 动作标签检测：动作主体是母亲 - "${actionText}"`);
            } else if (/陈国强|父亲|国强|他\s*(?:沉默|抽烟|叹气|低|说)/.test(actionText)) {
                actionSubject = 'father';
                console.log(`🎭 动作标签检测：动作主体是父亲 - "${actionText}"`);
            }
            
            if (actionSubject) {
                scores[actionSubject] += 5;
                
                const conflictRoles = Object.keys(scores).filter(r => r !== actionSubject && scores[r] > 5);
                if (conflictRoles.length > 0) {
                    console.warn(`⚠️ 角色冲突检测：动作标签显示${actionSubject}，但文本匹配${conflictRoles.join(',')}`);
                    
                    if (actionSubject === 'xiaoming' && scores.mother > 15) {
                        console.warn('🔧 自动修正：动作标签显示小明，但内容明显是母亲的 → 归属给母亲');
                        scores.mother += 3;
                        scores.xiaoming -= 2;
                    } else if (actionSubject === 'mother' && scores.xiaoming > 15) {
                        console.warn('🔧 自动修正：动作标签显示母亲，但内容明显是小明的 → 归属给小明');
                        scores.xiaoming += 3;
                        scores.mother -= 2;
                    }
                }
            }
        }

        const emotionalMarkers = {
            mother: [/崩溃/, /不能接受/, /绝对不/, /怎么可以/, /放弃.*?不行/, /眼泪/, /颤抖/, /哭/],
            father: [/沉默/, /沙哑/, /叹气/, /抽烟/, /低声/, /慢慢地说/],
            xiaoming: [/轻声/, /小声/, /抬头看/, /低下头/, /画画/]
        };

        for (const [role, markers] of Object.entries(emotionalMarkers)) {
            for (const marker of markers) {
                if (marker.test(text)) {
                    scores[role] += 3;
                    break;
                }
            }
        }

        console.log(`📊 角色评分结果：`, scores);

        const maxScore = Math.max(...Object.values(scores));
        if (maxScore >= 8) {
            const winner = Object.keys(scores).find(role => scores[role] === maxScore);
            
            switch(winner) {
                case 'xiaoming':
                    console.log(`✅ 判定为：小明（得分：${scores.xiaoming}）`);
                    return '👦 小明（患儿）';
                case 'mother':
                    console.log(`✅ 判定为：刘雪梅（得分：${scores.mother}）`);
                    return '👩 刘雪梅（母亲）';
                case 'father':
                    console.log(`✅ 判定为：陈国强（得分：${scores.father}）`);
                    return '👨 陈国强（父亲）';
            }
        }

        console.log(`⚠️ 无法确定角色，使用默认发送者：${defaultSender}`);
        return defaultSender;
    }

    extractQuotedText(rawText) {
        if (!rawText) return '';

        const quoteMatch = rawText.match(/[""「]([^""」]+)[""」]/);
        if (quoteMatch && quoteMatch[1]) {
            return quoteMatch[1].trim();
        }

        const parenMatch = rawText.match(/[）)]\s*[：:?\s]*([^\n（]{5,})/);
        if (parenMatch && parenMatch[1]) {
            return parenMatch[1].trim();
        }

        return rawText.replace(/^[（(][^）)]*?[）)][\s]*/, '').trim();
    }

    createCharacterMessage(sender, content) {
        const normalizedSender = this.normalizeSenderTag(sender, content);
        
        const roleName = this.extractRoleName(normalizedSender);

        let loggedToPool = false;
        if (roleName && content && !content.includes('【切换到') && !content.startsWith('<strong>')) {
            this.addToDialoguePool(roleName, content);
            loggedToPool = true;
        }
        
        return {
            type: normalizedSender === '👩 刘雪梅（母亲）' ? 'npc' : 'npc-character',
            sender: normalizedSender,
            content: content,
            timestamp: new Date(),
            nodeId: this.currentNode,
            loggedToPool
        };
    }
    
    extractRoleName(sender) {
        if (!sender) return null;
        
        if (sender.includes('刘雪梅')) return '刘雪梅（母亲）';
        if (sender.includes('小明')) return '小明（患儿）';
        if (sender.includes('陈国强')) return '陈国强（父亲）';
        if (sender.includes('系统') || sender.includes('环境')) return null;
        
        return sender;
    }
    
    addToDialoguePool(roleName, content) {
        if (!roleName || !content) return;

        if (!this.currentNodeStartTime) {
            this.currentNodeStartTime = new Date();
        }
        
        const cleanContent = this.removeActionPrompts(content).trim();
        
        if (!cleanContent || cleanContent.length < 2) return;

        const timestamp = new Date().toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const dialogueEntry = `[${timestamp}] ${roleName}：${cleanContent}\n`;
        
        this.nodeDialoguePool += dialogueEntry;
        
        console.log(`📝 对话池追加：${dialogueEntry.substring(0, 80)}...`);
    }

    normalizeSenderTag(sender, content) {
        const validSenders = {
            '👩 刘雪梅（母亲）': '👩 刘雪梅（母亲）',
            '👨 陈国强（父亲）': '👨 陈国强（父亲）',
            '👦 小明（患儿）': '👦 小明（患儿）'
        };

        if (validSenders[sender]) {
            return sender;
        }

        if (sender.includes('刘雪梅') || sender.includes('妈妈') || sender.includes('母亲')) {
            return '👩 刘雪梅（母亲）';
        }
        if (sender.includes('陈国强') || sender.includes('爸爸') || sender.includes('父亲')) {
            return '👨 陈国强（父亲）';
        }
        if (sender.includes('小明') || sender.includes('患儿')) {
            return '👦 小明（患儿）';
        }

        if (content && content.length > 3) {
            if (/孩子他妈|雪梅你/.test(content)) return '👨 陈国强（父亲）';
            if (/会不会很痛|不想让他受罪|我不敢做决定|回家的话|没有希望/.test(content)) return '👩 刘雪梅（母亲）';
            if (/我才\d+岁|姐姐|我想回家|旺财|面条|晒太阳|医生叔叔|画画|我不怕痛|我很痛|不想.*妈妈.*哭/.test(content)) return '👦 小明（患儿）';
        }

        return '👩 刘雪梅（母亲）';
    }

    formatDateForFile(date) {
        return date.toISOString().slice(0, 19)
            .replace(/[:-]/g, '')
            .replace('T', '_');
    }

    showGeneratingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'pdf-generating-overlay';
        overlay.id = 'pdf-generating-overlay';
        overlay.innerHTML = `
            <div class="pdf-generating-content">
                <div class="spinner"></div>
                <h3>正在生成总结报告...</h3>
                <p style="color: #666; margin-top: 10px;">请稍候，正在整理评估数据</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    hideGeneratingOverlay() {
        const overlay = document.getElementById('pdf-generating-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    getSenderFromContent(content) {
        if (content.includes('刘雪梅')) return '刘雪梅';
        if (content.includes('小明')) return '小明';
        if (content.includes('陈国强')) return '陈国强';
        if (content.includes('环境') || content.includes('【')) return '环境';
        return '角色';
    }

    detectMessageType(msg) {
        const content = msg.content || '';
        const sender = msg.sender || '';
        const type = msg.type || '';

        if (type === 'system') {
            if (sender === '场景过渡' || sender === '🎓 督导反馈' || sender.includes('督导')) {
                return {
                    name: sender || '系统提示',
                    icon: '📍',
                    textColor: [156, 39, 176],
                    bgColor: [243, 229, 245],
                    contentColor: [106, 27, 154],
                    isSystem: true,
                    isEnvironment: false,
                    isUser: false
                };
            }
            
            if (sender === '环境' || content.includes('【')) {
                return {
                    name: '🎬 场景描述',
                    icon: '🎬',
                    textColor: [0, 105, 92],
                    bgColor: [224, 242, 241],
                    contentColor: [0, 77, 64],
                    isSystem: true,
                    isEnvironment: true,
                    isUser: false
                };
            }
            
            if (sender === '🤖 AI分析' || sender.includes('分析') || sender.includes('评估')) {
                return {
                    name: sender || 'AI分析',
                    icon: '🤖',
                    textColor: [123, 31, 162],
                    bgColor: [237, 231, 246],
                    contentColor: [74, 20, 140],
                    isSystem: true,
                    isEnvironment: false,
                    isUser: false
                };
            }
            
            return {
                name: sender || '系统',
                icon: '⚙️',
                textColor: [100, 100, 100],
                bgColor: [245, 245, 245],
                contentColor: [80, 80, 80],
                isSystem: true,
                isEnvironment: false,
                isUser: false
            };
        }

        if (type === 'user') {
            return {
                name: '👩‍⚕️ 社工小李',
                icon: '👩‍⚕️',
                textColor: [46, 125, 50],
                bgColor: [232, 245, 233],
                contentColor: [27, 94, 32],
                isSystem: false,
                isEnvironment: false,
                isUser: true
            };
        }

        if (content.includes('刘雪梅') || sender === '刘雪梅') {
            return {
                name: '👩 刘雪梅（母亲）',
                icon: '👩',
                textColor: [198, 40, 40],
                bgColor: [255, 235, 238],
                contentColor: [183, 28, 28],
                isSystem: false,
                isEnvironment: false,
                isUser: false
            };
        }

        if (content.includes('小明') || sender === '小明' || sender === '👦 小明（患儿）') {
            return {
                name: '👦 小明（患儿）',
                icon: '👦',
                textColor: [21, 101, 192],
                bgColor: [227, 242, 253],
                contentColor: [13, 71, 161],
                isSystem: false,
                isEnvironment: false,
                isUser: false
            };
        }

        if (content.includes('陈国强') || sender === '陈国强' || sender === '👨 陈国强（父亲）') {
            return {
                name: '👨 陈国强（父亲）',
                icon: '👨',
                textColor: [87, 96, 111],
                bgColor: [236, 239, 241],
                contentColor: [55, 71, 79],
                isSystem: false,
                isEnvironment: false,
                isUser: false
            };
        }

        if (sender === '环境' || content.includes('【') || content.includes('场景')) {
            return {
                name: '🎬 场景环境',
                icon: '🎬',
                textColor: [0, 105, 92],
                bgColor: [224, 242, 241],
                contentColor: [0, 77, 64],
                isSystem: false,
                isEnvironment: true,
                isUser: false
            };
        }

        return {
            name: sender || '🎭 角色',
            icon: sender && sender.includes('🎭') ? '🎭' : '🎭',
            textColor: [100, 100, 100],
            bgColor: [250, 250, 250],
            contentColor: [66, 66, 66],
            isSystem: false,
            isEnvironment: false,
            isUser: false
        };
    }
}

let simulator;

document.addEventListener('DOMContentLoaded', () => {
    simulator = new CaseSimulator();
    window.simulator = simulator;
});

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    if (pages.length === 0) {
        console.warn('⚠️ showPage: 未找到任何 .page 元素');
        return;
    }

    pages.forEach(page => {
        if (page && page.classList) {
            page.classList.remove('active');
        }
    });

    const targetPage = document.getElementById(pageId);
    if (targetPage && targetPage.classList) {
        targetPage.classList.add('active');
        window.scrollTo(0, 0);
    } else {
        console.warn(`⚠️ showPage: 未找到目标页面 #${pageId}`);
    }
}

