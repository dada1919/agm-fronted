# 冲突解决模块前端接口文档

本文档详细说明了冲突解决模块与前端的连接接口，包括Socket.IO事件、数据格式和使用示例。

## 概述

冲突解决模块通过Socket.IO与前端进行实时通信，提供以下主要功能：
1. 实时接收冲突解决方案推荐
2. 获取特定冲突的详细解决方案
3. 应用选定的冲突解决方案
4. 接收解决方案应用结果反馈

## Socket.IO 连接设置

### 基础连接
```javascript
// 建立Socket.IO连接
// const socket = io('http://localhost:5000');
const socket = io('https://nonpenetrating-holly-unmathematically.ngrok-free.dev');

// 连接成功处理
socket.on('connect', () => {
    console.log('已连接到服务器');
});

// 连接断开处理
socket.on('disconnect', () => {
    console.log('与服务器断开连接');
});
```

## 冲突解决相关事件

### 1. 接收冲突解决方案推荐

#### 事件名称: `conflict_resolutions`
系统会自动推送检测到的冲突及其解决方案推荐。

```javascript
// 监听冲突解决方案推荐
socket.on('conflict_resolutions', (data) => {
    console.log('收到冲突解决方案推荐:', data);
    
    // 数据结构示例
    /*
    {
        "timestamp": "2023-11-02T10:30:00Z",
        "resolutions": {
            "conflict_001": {
                "conflict": {
                    "conflict_id": "conflict_001",
                    "flights": ["CZ3101", "MU5735"],
                    "node": "T1",
                    "severity": "HIGH"
                },
                "analysis": {
                    "conflict_id": "conflict_001",
                    "severity": "HIGH",
                    "involved_flights": ["CZ3101", "MU5735"],
                    "conflict_node": "T1",
                    "estimated_delay": 120
                },
                "recommendations": [
                    {
                        "option_id": "delay_first",
                        "description": "延迟第一架航班2分钟",
                        "strategy": "TIME_ADJUSTMENT",
                        "estimated_delay_reduction": 90,
                        "confidence": 0.85,
                        "affected_flights": ["CZ3101"]
                    },
                    {
                        "option_id": "reroute_second",
                        "description": "重新规划第二架航班路径",
                        "strategy": "PATH_REROUTING",
                        "estimated_delay_reduction": 100,
                        "confidence": 0.75,
                        "affected_flights": ["MU5735"]
                    }
                ]
            }
        }
    }
    */
    
    // 处理推荐方案
    Object.keys(data.resolutions).forEach(conflictId => {
        const resolution = data.resolutions[conflictId];
        displayConflictResolution(conflictId, resolution);
    });
});

// 显示冲突解决方案的函数示例
function displayConflictResolution(conflictId, resolution) {
    const conflictInfo = resolution.conflict;
    const analysis = resolution.analysis;
    const recommendations = resolution.recommendations;
    
    console.log(`冲突 ${conflictId}:`);
    console.log(`- 涉及航班: ${conflictInfo.flights.join(', ')}`);
    console.log(`- 冲突节点: ${conflictInfo.node}`);
    console.log(`- 严重程度: ${analysis.severity}`);
    console.log(`- 预计延误: ${analysis.estimated_delay}秒`);
    console.log('推荐解决方案:');
    
    recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.description}`);
        console.log(`     策略: ${rec.strategy}`);
        console.log(`     延误减少: ${rec.estimated_delay_reduction}秒`);
        console.log(`     置信度: ${(rec.confidence * 100).toFixed(1)}%`);
    });
}
```

### 2. 获取特定冲突的解决方案

#### 发送事件: `get_conflict_resolutions`
#### 接收事件: `conflict_resolutions_response`

```javascript
// 请求特定冲突的解决方案
function getConflictResolutions(conflictId) {
    socket.emit('get_conflict_resolutions', {
        conflict_id: conflictId
    });
}

// 监听解决方案查询响应
socket.on('conflict_resolutions_response', (response) => {
    if (response.success) {
        console.log('获取解决方案成功:', response.data);
        
        const conflict = response.data.conflict;
        const analysis = response.data.analysis;
        const recommendations = response.data.recommendations;
        
        // 显示解决方案选择界面
        showResolutionOptions(conflict.conflict_id, recommendations);
    } else {
        console.error('获取解决方案失败:', response.message);
        alert(`获取解决方案失败: ${response.message}`);
    }
});

// 显示解决方案选择界面的函数示例
function showResolutionOptions(conflictId, recommendations) {
    const container = document.getElementById('resolution-options');
    container.innerHTML = `<h3>冲突 ${conflictId} 的解决方案:</h3>`;
    
    recommendations.forEach(rec => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'resolution-option';
        optionDiv.innerHTML = `
            <div class="option-header">
                <h4>${rec.description}</h4>
                <span class="confidence">置信度: ${(rec.confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="option-details">
                <p>策略: ${rec.strategy}</p>
                <p>延误减少: ${rec.estimated_delay_reduction}秒</p>
                <p>影响航班: ${rec.affected_flights.join(', ')}</p>
            </div>
            <button onclick="applyResolution('${conflictId}', '${rec.option_id}')">
                应用此方案
            </button>
        `;
        container.appendChild(optionDiv);
    });
}
```

### 3. 应用冲突解决方案

#### 发送事件: `apply_conflict_resolution`
#### 接收事件: `conflict_resolution_applied`

```javascript
// 应用选定的解决方案
function applyResolution(conflictId, solutionId) {
    // 显示加载状态
    showLoadingState(`正在应用解决方案...`);
    
    socket.emit('apply_conflict_resolution', {
        conflict_id: conflictId,
        solution_id: solutionId
    });
}

// 监听解决方案应用结果
socket.on('conflict_resolution_applied', (result) => {
    // 隐藏加载状态
    hideLoadingState();
    
    console.log('解决方案应用结果:', result);
    
    if (result.status === 'applied') {
        // 应用成功
        showSuccessMessage(`解决方案已成功应用: ${result.message}`);
        
        // 更新UI状态
        updateConflictStatus(result.conflict_id, 'resolved');
        
        // 记录应用的解决方案
        logAppliedSolution(result);
    } else {
        // 应用失败
        showErrorMessage(`解决方案应用失败: ${result.message}`);
    }
});

// 辅助函数
function showLoadingState(message) {
    const loader = document.getElementById('loading-indicator');
    loader.textContent = message;
    loader.style.display = 'block';
}

function hideLoadingState() {
    const loader = document.getElementById('loading-indicator');
    loader.style.display = 'none';
}

function showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 5000);
}

function showErrorMessage(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 5000);
}

function updateConflictStatus(conflictId, status) {
    const conflictElement = document.getElementById(`conflict-${conflictId}`);
    if (conflictElement) {
        conflictElement.classList.add(`status-${status}`);
    }
}

function logAppliedSolution(result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        conflictId: result.conflict_id,
        solutionId: result.solution_id,
        solution: result.solution,
        status: result.status
    };
    
    // 存储到本地存储或发送到日志服务
    const appliedSolutions = JSON.parse(localStorage.getItem('appliedSolutions') || '[]');
    appliedSolutions.push(logEntry);
    localStorage.setItem('appliedSolutions', JSON.stringify(appliedSolutions));
}
```

## 完整的前端集成示例

### HTML 结构
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>机场冲突解决系统</title>
    <style>
        .conflict-panel {
            border: 1px solid #ddd;
            margin: 10px;
            padding: 15px;
            border-radius: 5px;
        }
        .conflict-high { border-left: 5px solid #ff4444; }
        .conflict-medium { border-left: 5px solid #ffaa00; }
        .conflict-low { border-left: 5px solid #44ff44; }
        .resolution-option {
            background: #f9f9f9;
            margin: 10px 0;
            padding: 10px;
            border-radius: 3px;
        }
        .option-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .confidence {
            font-size: 0.9em;
            color: #666;
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
        }
        .notification.success { background: #4CAF50; }
        .notification.error { background: #f44336; }
        #loading-indicator {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 20px;
            border-radius: 5px;
            display: none;
        }
    </style>
</head>
<body>
    <div id="app">
        <h1>机场冲突解决系统</h1>
        <div id="connection-status">连接状态: 断开</div>
        <div id="conflicts-container">
            <h2>当前冲突</h2>
            <div id="conflicts-list"></div>
        </div>
        <div id="resolution-options"></div>
        <div id="loading-indicator">处理中...</div>
    </div>

    <script src="https://cdn.socket.io/4.0.0/socket.io.min.js"></script>
    <script src="conflict-resolution-client.js"></script>
</body>
</html>
```

### JavaScript 客户端完整实现
```javascript
// conflict-resolution-client.js
class ConflictResolutionClient {
    constructor(serverUrl = 'http://localhost:5000') {
        this.socket = io(serverUrl);
        this.conflicts = new Map();
        this.appliedSolutions = new Map();
        
        this.initializeEventListeners();
        this.initializeUI();
    }
    
    initializeEventListeners() {
        // 连接事件
        this.socket.on('connect', () => {
            console.log('已连接到服务器');
            this.updateConnectionStatus('已连接');
        });
        
        this.socket.on('disconnect', () => {
            console.log('与服务器断开连接');
            this.updateConnectionStatus('断开连接');
        });
        
        // 冲突解决相关事件
        this.socket.on('conflict_resolutions', (data) => {
            this.handleConflictResolutions(data);
        });
        
        this.socket.on('conflict_resolutions_response', (response) => {
            this.handleConflictResolutionsResponse(response);
        });
        
        this.socket.on('conflict_resolution_applied', (result) => {
            this.handleResolutionApplied(result);
        });
        
        // 其他系统事件
        this.socket.on('conflicts', (data) => {
            this.handleConflictsUpdate(data);
        });
    }
    
    initializeUI() {
        // 初始化UI组件
        this.conflictsContainer = document.getElementById('conflicts-list');
        this.resolutionOptionsContainer = document.getElementById('resolution-options');
        this.connectionStatus = document.getElementById('connection-status');
    }
    
    updateConnectionStatus(status) {
        this.connectionStatus.textContent = `连接状态: ${status}`;
        this.connectionStatus.className = status === '已连接' ? 'connected' : 'disconnected';
    }
    
    handleConflictResolutions(data) {
        console.log('收到冲突解决方案推荐:', data);
        
        Object.keys(data.resolutions).forEach(conflictId => {
            const resolution = data.resolutions[conflictId];
            this.conflicts.set(conflictId, resolution);
            this.displayConflictWithResolutions(conflictId, resolution);
        });
    }
    
    handleConflictsUpdate(data) {
        console.log('冲突更新:', data);
        // 更新冲突列表显示
        this.updateConflictsList(data.conflicts || []);
    }
    
    handleConflictResolutionsResponse(response) {
        if (response.success) {
            console.log('获取解决方案成功:', response.data);
            this.showResolutionOptions(response.data);
        } else {
            console.error('获取解决方案失败:', response.message);
            this.showErrorMessage(`获取解决方案失败: ${response.message}`);
        }
    }
    
    handleResolutionApplied(result) {
        console.log('解决方案应用结果:', result);
        this.hideLoadingState();
        
        if (result.status === 'applied') {
            this.showSuccessMessage(`解决方案已成功应用: ${result.message}`);
            this.appliedSolutions.set(result.conflict_id, result);
            this.updateConflictStatus(result.conflict_id, 'resolved');
        } else {
            this.showErrorMessage(`解决方案应用失败: ${result.message}`);
        }
    }
    
    displayConflictWithResolutions(conflictId, resolution) {
        const conflictDiv = document.createElement('div');
        conflictDiv.id = `conflict-${conflictId}`;
        conflictDiv.className = `conflict-panel conflict-${resolution.analysis.severity.toLowerCase()}`;
        
        conflictDiv.innerHTML = `
            <div class="conflict-header">
                <h3>冲突 ${conflictId}</h3>
                <span class="severity">${resolution.analysis.severity}</span>
            </div>
            <div class="conflict-details">
                <p><strong>涉及航班:</strong> ${resolution.conflict.flights.join(', ')}</p>
                <p><strong>冲突节点:</strong> ${resolution.conflict.node}</p>
                <p><strong>预计延误:</strong> ${resolution.analysis.estimated_delay}秒</p>
            </div>
            <div class="conflict-actions">
                <button onclick="conflictClient.getConflictResolutions('${conflictId}')">
                    查看解决方案
                </button>
            </div>
            <div class="resolution-preview">
                <h4>推荐方案 (${resolution.recommendations.length}个):</h4>
                ${resolution.recommendations.map(rec => `
                    <div class="resolution-preview-item">
                        <span>${rec.description}</span>
                        <button onclick="conflictClient.applyResolution('${conflictId}', '${rec.option_id}')">
                            应用
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.conflictsContainer.appendChild(conflictDiv);
    }
    
    updateConflictsList(conflicts) {
        // 更新基础冲突列表（不包含解决方案）
        conflicts.forEach(conflict => {
            const existingDiv = document.getElementById(`conflict-${conflict.conflict_id}`);
            if (!existingDiv) {
                // 创建基础冲突显示
                this.displayBasicConflict(conflict);
            }
        });
    }
    
    displayBasicConflict(conflict) {
        const conflictDiv = document.createElement('div');
        conflictDiv.id = `conflict-${conflict.conflict_id}`;
        conflictDiv.className = `conflict-panel conflict-${conflict.severity.toLowerCase()}`;
        
        conflictDiv.innerHTML = `
            <div class="conflict-header">
                <h3>冲突 ${conflict.conflict_id}</h3>
                <span class="severity">${conflict.severity}</span>
            </div>
            <div class="conflict-details">
                <p><strong>涉及航班:</strong> ${conflict.flights.join(', ')}</p>
                <p><strong>冲突节点:</strong> ${conflict.node}</p>
            </div>
            <div class="conflict-actions">
                <button onclick="conflictClient.getConflictResolutions('${conflict.conflict_id}')">
                    获取解决方案
                </button>
            </div>
        `;
        
        this.conflictsContainer.appendChild(conflictDiv);
    }
    
    getConflictResolutions(conflictId) {
        this.socket.emit('get_conflict_resolutions', {
            conflict_id: conflictId
        });
    }
    
    showResolutionOptions(data) {
        const conflict = data.conflict;
        const recommendations = data.recommendations;
        
        this.resolutionOptionsContainer.innerHTML = `
            <h3>冲突 ${conflict.conflict_id} 的详细解决方案</h3>
            <div class="resolution-options-list">
                ${recommendations.map(rec => `
                    <div class="resolution-option">
                        <div class="option-header">
                            <h4>${rec.description}</h4>
                            <span class="confidence">置信度: ${(rec.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div class="option-details">
                            <p><strong>策略:</strong> ${rec.strategy}</p>
                            <p><strong>延误减少:</strong> ${rec.estimated_delay_reduction}秒</p>
                            <p><strong>影响航班:</strong> ${rec.affected_flights.join(', ')}</p>
                        </div>
                        <div class="option-actions">
                            <button onclick="conflictClient.applyResolution('${conflict.conflict_id}', '${rec.option_id}')">
                                应用此方案
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    applyResolution(conflictId, solutionId) {
        this.showLoadingState('正在应用解决方案...');
        
        this.socket.emit('apply_conflict_resolution', {
            conflict_id: conflictId,
            solution_id: solutionId
        });
    }
    
    updateConflictStatus(conflictId, status) {
        const conflictElement = document.getElementById(`conflict-${conflictId}`);
        if (conflictElement) {
            conflictElement.classList.add(`status-${status}`);
            if (status === 'resolved') {
                conflictElement.style.opacity = '0.6';
                const header = conflictElement.querySelector('.conflict-header h3');
                header.innerHTML += ' <span style="color: green;">[已解决]</span>';
            }
        }
    }
    
    showLoadingState(message) {
        const loader = document.getElementById('loading-indicator');
        loader.textContent = message;
        loader.style.display = 'block';
    }
    
    hideLoadingState() {
        const loader = document.getElementById('loading-indicator');
        loader.style.display = 'none';
    }
    
    showSuccessMessage(message) {
        this.showNotification(message, 'success');
    }
    
    showErrorMessage(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 5000);
    }
}

// 初始化客户端
const conflictClient = new ConflictResolutionClient();

// 导出供全局使用
window.conflictClient = conflictClient;
```

## 数据格式说明

### 冲突解决方案数据结构
```typescript
interface ConflictResolutionData {
    timestamp: string;
    resolutions: {
        [conflictId: string]: {
            conflict: {
                conflict_id: string;
                flights: string[];
                node: string;
                severity: 'HIGH' | 'MEDIUM' | 'LOW';
            };
            analysis: {
                conflict_id: string;
                severity: 'HIGH' | 'MEDIUM' | 'LOW';
                involved_flights: string[];
                conflict_node: string;
                estimated_delay: number;
            };
            recommendations: RecommendationOption[];
        };
    };
}

interface RecommendationOption {
    option_id: string;
    description: string;
    strategy: 'TIME_ADJUSTMENT' | 'PATH_REROUTING' | 'PRIORITY_CHANGE' | 'WAITING_STRATEGY';
    estimated_delay_reduction: number;
    confidence: number; // 0-1之间的置信度
    affected_flights: string[];
}
```

### 应用结果数据结构
```typescript
interface ResolutionAppliedResult {
    conflict_id: string;
    solution_id: string;
    solution: RecommendationOption;
    status: 'applied' | 'failed';
    message: string;
}
```

## 错误处理

### 常见错误类型
1. **连接错误**: Socket.IO连接失败
2. **数据错误**: 接收到的数据格式不正确
3. **应用错误**: 解决方案应用失败
4. **权限错误**: 没有权限执行某些操作

### 错误处理示例
```javascript
// 连接错误处理
socket.on('connect_error', (error) => {
    console.error('连接错误:', error);
    conflictClient.showErrorMessage('无法连接到服务器，请检查网络连接');
});

// 数据验证
function validateConflictData(data) {
    if (!data || !data.resolutions) {
        throw new Error('无效的冲突解决方案数据');
    }
    
    Object.keys(data.resolutions).forEach(conflictId => {
        const resolution = data.resolutions[conflictId];
        if (!resolution.conflict || !resolution.analysis || !resolution.recommendations) {
            throw new Error(`冲突 ${conflictId} 的数据不完整`);
        }
    });
}

// 使用验证
socket.on('conflict_resolutions', (data) => {
    try {
        validateConflictData(data);
        conflictClient.handleConflictResolutions(data);
    } catch (error) {
        console.error('数据验证失败:', error);
        conflictClient.showErrorMessage('接收到的数据格式不正确');
    }
});
```

## 性能优化建议

1. **数据缓存**: 缓存已获取的解决方案，避免重复请求
2. **UI更新优化**: 使用虚拟滚动处理大量冲突数据
3. **连接管理**: 实现自动重连机制
4. **内存管理**: 定期清理已解决的冲突数据

```javascript
// 数据缓存示例
class ConflictCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }
    
    get(key) {
        return this.cache.get(key);
    }
    
    has(key) {
        return this.cache.has(key);
    }
}

// 在客户端中使用缓存
const resolutionCache = new ConflictCache();
```

## 总结

本接口文档提供了完整的冲突解决模块前端集成方案，包括：
- Socket.IO事件监听和发送
- 数据格式定义和验证
- UI组件实现示例
- 错误处理机制
- 性能优化建议

通过这些接口，前端可以实现：
- 实时接收和显示冲突解决方案
- 用户交互式选择和应用解决方案
- 完整的状态反馈和错误处理
- 良好的用户体验和系统稳定性