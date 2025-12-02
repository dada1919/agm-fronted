// src/stores/WebSocketStore.js
import { makeAutoObservable } from 'mobx';
import { io } from 'socket.io-client';

class WebSocketStore {
    // 前端代码中，API请求使用相对路径
    API_BASE = '/api_proxy'; // 不是完整的http地址


// WebSocket连接也通过代理

    socket = null;
    planePosition = [];
    isConnected = false;
    overlap_conflicts = null;
    overlapTaxiways = null; //存储重叠滑行道数据
    overlaps = { nodes: [], taxiways: [] }; // 系统状态中的重叠信息
    
    plannedFlights = {}; // 计划航班数据
    activeFlights = {}; // 活跃航班数据
    pathConflicts = []; // 路径冲突数据
    isDragging = false;// 新增：存储拖拽状态，防止拖拽时数据更新干扰
    draggedFlightId = null;
    conflictResolutions = []; // 冲突解决方案列表
    selectedConflict = null; // 当前选中的冲突
    analysis = null;
    resolutions = []; // 当前冲突的解决方案
    conflictResolutionLoading = false; // 冲突解决加载状态
    lastError = ''; // 最近一次错误信息（用于 UI 提示）

    future_conflicts = [];
    current_conflicts = [];
    
    // 飞机颜色映射状态管理
    aircraftColorMapping = new Map(); // 飞机ID到颜色的映射
    // activeColors = ['#FF6B6B', '#FF8E53', '#FF6B9D', '#C44569', '#F8B500']; // 活跃飞机：暖色调
    // 计划/分配给飞机的颜色调色板（按需循环使用）
    planningColors = [
        '#E61A9C',
        '#FF6600',
 
        '#AA22FF',
        '#FF3366',
        '#99CC00',
        '#CC5500',
        '#CC00CC',
        '#8dd3c7',
        '#984ea3',
        '#a65628',
        '#f781bf',
        '#999999'
    ]; // 用户指定的七色方案
    activeColorIndex = 0;
    planningColorIndex = 0;
    
    // 当前模拟状态存储
    currentSimulation = {
        conflict_id: null,
        solution_id: null,
        simulated_state: null,
        original_state: null,
        solution: null,
        success: false,
        message: '',
        timestamp: null
    };
    
    constructor() {
        makeAutoObservable(this);
        this.connect();
    }
    convertNumpyData(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    // 如果是数组，递归处理每个元素
    if (Array.isArray(obj)) {
        return obj.map(item => this.convertNumpyData(item));
    }
    
    // 如果是对象，递归处理每个属性
    if (typeof obj === 'object') {
        const converted = {};
        for (const [key, value] of Object.entries(obj)) {
            converted[key] = this.convertNumpyData(value);
        }
        return converted;
    }
    
    // 检查是否是numpy数据类型（通过字符串表示判断）
    if (typeof obj === 'object' && obj.toString && 
        (obj.toString().includes('np.float') || 
         obj.toString().includes('np.int') ||
         obj.toString().includes('numpy.'))) {
        // 尝试转换为JavaScript数字
        const numValue = Number(obj);
        return isNaN(numValue) ? obj : numValue;
    }
    
    return obj;
}

    connect() {
//         const { protocol, host } = window.location;
// // 协议转换：http → ws，https → wss
//         const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
//         this.socket = io(`${wsProtocol}//${host}`, {
//             path: '/socket_proxy', // 和 Vite 代理的路径匹配
//             autoConnect: true,
//             reconnection: true
//         });
        // this.socket = io('', {
        //     path: '/socket.io', // 确保使用 /socket.io
        //     transports: ['websocket', 'polling']
        // });
        // this.socket = io();

        this.socket = io('', {
      transports: ['polling', 'websocket'], // 优先 polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000
    });
        // this.socket = io('./socket.io', {
        //     transports: ['websocket'], // 如果所需，指定传输协议
        // });
        //1.系统状态控制OK
        this.socket.on('simulation_status', (data) => { 
            console.log(`模拟状态: ${data.status} - ${data.message}`);
        });
        //2.系统状态查询

        //系统状态数据推送 OK
        this.socket.on('system_state_update', (data) => {
            console.log('System state updated:', data);
            
            // 如果正在拖拽，则不更新被拖拽航班的数据
            // if (!this.isDragging) {
            //     this.updatePlanePosition(data.aircraft_positions);
            //     this.updateFlightPlans({
            //         planned_flights: data.planned_flights || {},
            //         active_flights: data.active_flights || {},
            //         conflicts: data.conflicts || []
            //     });
            //     this.updateConflicts(data.conflicts);
            // }
            //活跃飞机的轨迹数据
            this.updatePlanePosition(data.aircraft_positions);
            this.updateFlightPlans({
            planned_flights: data.planned_flights || {},
            active_flights: data.active_flights || {},
            
            });

            // 更新系统状态中的 overlaps（节点与滑行道重叠）
            if (data && data.overlaps) {
                this.updateOverlaps(data.overlaps);
            }
        });
        //3. 航班管理
        //调整航班滑行时间
       
        this.socket.on('flight_adjustment_result', (data) => {
            console.log('Flight adjustment result:', data);
            // 收到后端响应后，清除拖拽状态
            this.setDraggingState(false, null);
            if (data.success) {
                console.log(`航班 ${data.flight_id} 时间调整成功`);
                // 更新对应航班的start_time
                this.updateFlightStartTime(data.flight_id, parseFloat(data.adjust_time));
            } else {
                console.error(`航班时间调整失败: ${data.message}`);
                // 可以在这里添加错误提示
            }
        });

        //4. 实时数据推送
         //飞机状态实时更新,约每秒一次
        // this.socket.on('aircraft_status_update',(data)=>{
        //     console.log('aircraft_status_update:',data);
        //     // this.updatePlanePosition(data.aircraft_positions);
            
        // })
        //规划结果更新,在规划变更时触发
        //  this.socket.on('planning_update', (data) => {
        //     console.log('planning_update',data);
        //     // console.log('Received planning update:', data);
        //     this.updatePlannedFlightsTime(data);
        // })

        //5. 冲突检测与解决，需要解决5
        //冲突的数据
        this.socket.on('conflicts_update', (data) => {
            // 后端推送最新冲突数据
            // 1) 更新重叠滑行道
            this.updateOverlapTaxiways(data);
            // 2) 更新面板展示的冲突列表（当前冲突）
            this.updateConflictResolutions(data.current);
            // 3) 更新当前/未来冲突集合
            this.updateConflicts(data);

            // 4) 如果已展开的冲突在新消息中不存在，则清空选中并回到列表视图
            try {
                this.pruneSelectionOnConflictUpdate(data);
            } catch (e) {
                console.error('Prune selection on conflicts_update failed:', e);
            }
        });

      

        // 连接成功和断开连接事件
        this.socket.on('connect', () => console.log('Connected to WebSocket server'));
        this.socket.on('disconnect', () => console.log('Disconnected from WebSocket server'));
        this.socket.on('connect_error', (error) => {
            console.error('Connection Error:', error); // 打印连接错误
        });


    


          //---------------------以下为未处理的函数--------------

        // 冲突解决方案推荐
        this.socket.on('conflict_resolutions_result', (response) => {
            console.log(response)
           
            this.conflictResolutionLoading = false;
            if (response.success) {
                console.log('获取解决方案成功:', response.data);
                this.selectedConflict = response.data.conflict;
                this.resolution_analysis = response.data.analysis;
                this.resolutions = response.data.recommendations;
                this.lastError = '';
                 
            } else {
                console.error('获取解决方案失败:', response.message);
                // 失败时清空当前分析与方案，并记录错误供 UI 展示
                this.resolution_analysis = null;
                this.resolutions = [];
                this.lastError = response.message || '未找到解决方案';
            }
        });

        // 处理冲突解决方案应用结果
        this.socket.on('conflict_resolution_applied', (result) => {
            console.log('这是解决方案:', result);
            this.conflictResolutionLoading = false;
            if (result.status === 'applied') {
               console.log('冲突已解决:', );
                this.updateConflictStatus(result.conflict_id, 'resolved');
                
                console.log('解决方案应用成功:', result.message);
                // 更新冲突状态
                this.lastError = '';
            } else {
                console.error('解决方案应用失败:', result.message);
                this.lastError = result.message || '解决方案应用失败';
            }
        });

        // 处理冲突解决方案模拟结果
        this.socket.on('conflict_resolution_simulated', (result) => {
            console.log('冲突解决方案模拟结果:', result);
            
            // 更新当前模拟状态
            this.currentSimulation = {
                conflict_id: result.conflict_id,
                solution_id: result.solution_id,
                success: result.success,
                message: result.message,
                simulated_state: result.simulated_state,
                original_state: result.original_state,
                solution: result.solution,
                timestamp: new Date().toISOString()
            };

            console.log('当前模拟状态:', this.currentSimulation.simulated_state);
            
            if (result.success) {
                console.log(`当前模拟 - 冲突ID: ${result.conflict_id}, 方案ID: ${result.solution_id}`);
                console.log('模拟状态:', result.simulated_state);
                this.lastError = '';
            } else {
                console.error('冲突解决方案模拟失败:', result.message);
                this.lastError = result.message || '解决方案模拟失败';
            }
        });
    }
    
    // 归一化冲突ID：字符串按下划线分割取最后一段，否则转为字符串
    _normalizeConflictId(id) {
        if (!id) return null;
        if (typeof id === 'string') {
            const parts = id.split('_');
            return parts[parts.length - 1];
        }
        return String(id);
    }

    // 冲突更新后，如果当前选中的冲突不在新数据中，则清空选中（返回冲突列表）
    pruneSelectionOnConflictUpdate(payload) {
        const selected = this.selectedConflict;
        if (!selected) return;

        const selectedIdNorm = this._normalizeConflictId(selected.conflict_id ?? selected.id);
        if (!selectedIdNorm) return;

        const set = new Set();
        const addFromList = (list) => {
            if (!Array.isArray(list)) return;
            list.forEach(c => {
                const rawId = c?.conflict_id ?? c?.id ?? c?.analysis?.conflict_id;
                const norm = this._normalizeConflictId(rawId);
                if (norm) set.add(norm);
            });
        };

        addFromList(payload?.current);
        addFromList(payload?.future);

        console.log('当前冲突ID集合:', set);
        console.log('当前选中的冲突ID:', selectedIdNorm);

        // 若选中的冲突ID不在新的集合中，清空选中并重置详情
        if (!set.has(selectedIdNorm)) {
            this.selectedConflict = null;
            this.resolution_analysis = null;
            this.resolutions = [];
            this.conflictResolutionLoading = false;
        }
    }
    //-----------------------接口函数---------------------------
    //1.系统控制
    startSimulate () {
        console.log('Starting simulation...');
        if (this.socket) {
            this.socket.emit('simulate_start');
        }
    }

    stoptSimulate () {
        console.log('Stop simulation...');
        if (this.socket) {
            this.socket.emit('simulate_stop');
        }
    }

    //2. 系统状态查询
    //获取系统状态
    getSystemState () {
        console.log('获取系统状态...');
        if (this.socket) {
            this.socket.emit('get_system_state');
        }
    }
    //3. 航班管理
     //拖拽规划轴视图
    adjustFlightTime(flightId, adjustTime) {
        if (this.socket && this.socket.connected) {
            // 设置拖拽状态，防止在等待后端确认时发生数据冲突
            this.setDraggingState(true, flightId);
            console.log(`发送航班时间调整请求: ${flightId}, 调整时间: ${adjustTime} 分钟`);
            this.socket.emit('adjust_flight_time', {
                flight_id: flightId,
                adjust_time: adjustTime.toString()
            });
        } else {
            console.error('WebSocket未连接，无法发送航班时间调整请求');
        }
    }
    

    //----------------------------------功能函数--------------------------
    //    // System state updated:活跃飞机的轨迹数据
    updatePlanePosition(newPosition) {
        // 将新的对象格式转换为数组格式以兼容现有绘制逻辑
        // 实际格式: { [aircraft_id]: { coords: [lng, lat], speed, state, path_progress, position, departure_time, remaining_taxi_time, time_to_takeoff } }
        // 转换为: [{ id: aircraft_id, coords: [lng, lat], cur_path, trajectory, speed, state, path_progress, position, departure_time, remaining_taxi_time, time_to_takeoff }]
        if (newPosition && typeof newPosition === 'object') {
            this.planePosition = Object.entries(newPosition).map(([aircraftId, aircraftData]) => ({
                id: aircraftId,
                coords: aircraftData.coords,             // 直接使用 coords 字段
                cur_path: [],                            // 暂时设为空数组，如果后续有路径数据可以更新
                trajectory: aircraftData.trajectory,                          // 暂时设为空数组，如果后续有轨迹数据可以更新
                speed: aircraftData.speed,
                state: aircraftData.state,
                path_progress: aircraftData.path_progress,
                position: aircraftData.position,
                departure_time: aircraftData.departure_time,
                remaining_taxi_time: aircraftData.remaining_taxi_time,
                time_to_takeoff: aircraftData.time_to_takeoff
            }));
        } else {
            this.planePosition = [];
        }
        // console.log('planePosition', this.planePosition);
    }
    //规划数据更新
    //System state updated:
    updateFlightPlans(flightData) {
       
        if (flightData) {
            // 在存储数据前先转换numpy数据类型
            const convertedData = this.convertNumpyData(flightData);
            // console.log('转换前的数据:', flightData);
            // console.log('转换后的数据:', convertedData);
            console.log('更新规划数据:', convertedData);
            // 直接使用包含planned_flights、active_flights和conflicts的完整数据
            this.plannedFlights = convertedData.planned_flights;
            this.activeFlights = convertedData.active_flights;
        }
    }
    // updatePlannedFlightsTime(planned_results) {
    //     if(planned_results.planned_flights){
    //         this.plannedFlights = planned_results.planned_flights;
    //     }
    //     if(planned_results.active_flights){
    //         this.activeFlights = planned_results.active_flights;
    //     }
    //     if(planned_results.conflicts){
    //         this.conflicts = planned_results.conflicts;
    //     }
       

    // }
    
    // 更新指定航班的开始时间
    updateFlightStartTime(flightId, adjustTime) {
        console.log("当前航班",this.plannedFlights,this.plannedFlights[flightId].start_time);
        // 更新plannedFlights中的航班时间
        if (this.plannedFlights && this.plannedFlights[flightId]) {
            // start_time = start_time + adjust_time (adjust_time单位为秒)
            this.plannedFlights[flightId].start_time = this.plannedFlights[flightId].start_time + adjustTime;
            if(this.plannedFlights[flightId].start_time<=0)
            {
                this.plannedFlights[flightId].start_time = 0;
            }
            console.log(`航班 ${flightId} 的start_time已更新为: ${this.plannedFlights[flightId].start_time}秒`);
        }
        
    }
    setDraggingState(isDragging, flightId = null) {
        this.isDragging = isDragging;
        this.draggedFlightId = flightId;
    }



    //----------------需要确定----------------------------
    //规划视图返回结果
    // adjustFlightTimeResult(planned_results) { 
    //     this.
    // }
  
    //  this.socket.on('system_state_update', (data) => {暂时不用
    updateConflicts(newConflicts) {
        // this.conflicts = newConflicts;
        console.log('更新冲突数据:', newConflicts);
        console.log('current_conflicts:', newConflicts.current);
        console.log('future_conflicts:', newConflicts.future);
        this.current_conflicts = newConflicts.current;
        this.future_conflicts = newConflicts.future;
         
    }

    // 冲突数据：更新重叠滑行道数据的方法
    updateOverlapTaxiways(newOverlapTaxiways) {
        this.overlapTaxiways = newOverlapTaxiways.current;
        
    }

    // 更新系统状态中的 overlaps 数据（包含 nodes 和 taxiways）
    updateOverlaps(rawOverlaps) {
        try {
            const converted = this.convertNumpyData(rawOverlaps);
            // 兜底结构，防止空值导致绘制报错
            const safe = converted && typeof converted === 'object' ? converted : { nodes: [], taxiways: [] };
            // 规范化字段
            this.overlaps = {
                nodes: Array.isArray(safe.nodes) ? safe.nodes : [],
                taxiways: Array.isArray(safe.taxiways) ? safe.taxiways : []
            };
            // console.log('✅ overlaps 更新:', this.overlaps);
        } catch (e) {
            console.error('❌ 更新 overlaps 失败:', e);
            this.overlaps = { nodes: [], taxiways: [] };
        }
    }
    //规划数据更新
    
  
    // 更新冲突解决方案数据
    updateConflictResolutions(data) {
    try {
        console.log('📊 处理冲突解决方案数据:',data);


    this.conflictResolutions = data;
    console.log('✅ 冲突解决方案数据已更新:', this.conflictResolutions);
  } catch (err) {
    console.error('❌ 解析冲突解决方案数据失败:', err);
    // 视需要把错误状态暴露给 UI
    this.conflictResolutions = [];
  }
}
    // 获取特定冲突的解决方案
    getConflictResolutions(conflictId) {
        this.conflictResolutionLoading = true;
        if (this.socket && this.socket.connected) {
            console.log("获取特定冲突的解决方案：",conflictId)
            this.socket.emit('get_conflict_resolutions', {
                conflict_id: conflictId
            });
        } else {
            console.error('WebSocket未连接，无法获取冲突解决方案');
            this.conflictResolutionLoading = false;
            this.lastError = 'WebSocket未连接，无法获取解决方案';
        }
    }

    // 应用解决方案
    applyConflictResolution(conflictId, solutionId) {
        this.conflictResolutionLoading = true;
        if (this.socket && this.socket.connected) {
            console.log("应用冲突解决方案",conflictId,solutionId)
            this.socket.emit('apply_conflict_resolution', {
                conflict_id: conflictId,
                solution_id: solutionId
            });
        } else {
            console.error('WebSocket未连接，无法应用冲突解决方案');
            this.conflictResolutionLoading = false;
            this.lastError = 'WebSocket未连接，无法应用解决方案';
        }
    }

    // 冲突解决方案应用结果
    updateConflictStatus(conflictId, status) {
       
        
        this.conflictResolutions = this.conflictResolutions.map(c => {
            // 获取当前冲突的ID
            const currentConflictId = c.analysis?.conflict_id ?? c.id;
            
            // 提取ID的最后一位进行匹配（真正的ID）
            const extractLastDigit = (id) => {
                if (typeof id === 'string') {
                    const parts = id.split('_');
                    return parts[parts.length - 1]; // 获取最后一部分
                }
                return id;
            };
            
            const currentLastDigit = extractLastDigit(currentConflictId);
            const targetLastDigit = extractLastDigit(conflictId);
          
            
            // 只匹配ID的最后一位
            if (currentLastDigit === targetLastDigit) {
                
               
                return { ...c, status }; // 直接在冲突对象上添加status
            } else {
                return c; // 不匹配，返回原对象
            }
        });

    }

    // 获取当前模拟结果
    getCurrentSimulation() {
        return this.currentSimulation;
    }

    // 检查是否有当前模拟结果
    hasCurrentSimulation() {
        return this.currentSimulation.conflict_id !== null && 
               this.currentSimulation.solution_id !== null;
    }

    // 清除当前模拟结果
    clearCurrentSimulation() {
        this.currentSimulation = {
            conflict_id: null,
            solution_id: null,
            simulated_state: null,
            original_state: null,
            solution: null,
            success: false,
            message: '',
            timestamp: null
        };
    }

    // 清除最近错误（供 UI 在用户切换或重试时调用）
    clearLastError() {
        this.lastError = '';
    }

    // 获取飞机颜色（同一飞机在active/planning状态保持同色）。
    // 如果不存在则从规划颜色池中分配一个未使用的颜色，保证不与其他飞机重复；颜色唯一性由映射维护。
    getAircraftColor(aircraftId, isActive = false) {
        // 如果已有分配的基础颜色，按状态返回不透明或半透明
        if (this.aircraftColorMapping.has(aircraftId)) {
            const base = this.aircraftColorMapping.get(aircraftId);
            return isActive ? base : this.hexToRgba(base, 0.55);
        }

        // 分配新颜色：优先选择未被使用的颜色，确保不与其他飞机重复
        const used = new Set(this.aircraftColorMapping.values());
        let color = null;
        for (let i = 0; i < this.planningColors.length; i++) {
            const c = this.planningColors[(this.planningColorIndex + i) % this.planningColors.length];
            if (!used.has(c)) {
                color = c;
                this.planningColorIndex = (this.planningColorIndex + i + 1) % this.planningColors.length;
                break;
            }
        }
        // 如果颜色池已用尽（飞机数量超过颜色数量），则回退到循环使用
        if (!color) {
            color = this.planningColors[this.planningColorIndex % this.planningColors.length];
            this.planningColorIndex++;
        }

        // 存储基础颜色（不带透明度），返回根据状态的颜色
        this.aircraftColorMapping.set(aircraftId, color);
        return isActive ? color : this.hexToRgba(color, 0.55);
    }

    // 设置飞机颜色
    setAircraftColor(aircraftId, color) {
        this.aircraftColorMapping.set(aircraftId, color);
    }

    // 将十六进制颜色转换为 rgba 字符串，支持 #rgb 或 #rrggbb
    hexToRgba(hex, alpha = 0.5) {
        if (!hex) return `rgba(0,0,0,${alpha})`;
        let h = hex.replace('#', '').trim();
        if (h.length === 3) {
            h = h.split('').map(ch => ch + ch).join('');
        }
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const a = Math.max(0, Math.min(1, alpha));
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // 获取所有飞机的颜色映射
    getAllAircraftColors() {
        return new Map(this.aircraftColorMapping);
    }

    // 清除颜色映射
    clearAircraftColors() {
        this.aircraftColorMapping.clear();
        this.activeColorIndex = 0;
        this.planningColorIndex = 0;
    }

    // 检查飞机是否为活跃状态
    isAircraftActive(aircraftId) {
        return this.planePosition && this.planePosition.some(plane => plane.id === aircraftId);
    }
}
const websocketStore = new WebSocketStore();
export default websocketStore;
