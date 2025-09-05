// src/stores/WebSocketStore.js
import { makeAutoObservable } from 'mobx';
import { io } from 'socket.io-client';

class WebSocketStore {
    socket = null;
    planePosition = [];
    isConnected = false;
    conflicts = null;
    overlapTaxiways = null; //存储重叠滑行道数据
    plannedPath = {}; // 新增 plannedPath 属性
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
        this.socket = io('http://127.0.0.1:5000', {
            transports: ['websocket'], // 如果所需，指定传输协议
        });
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
        });
        //3. 航班管理
        //调整航班滑行时间
       
        this.socket.on('flight_adjustment_result', (data) => {
            console.log('Flight adjustment result:', data);
            if (data.success) {
                console.log(`航班 ${data.flight_id} 时间调整成功`);
                 //规划树图返回的结果
               
                // this.socket.on('simulation_adjustment_info', (data) => {
                //     console.log('simulation_adjustment_info', data);
                //     this.updatePlannedPath(data);
                // });
            } else {
                console.error(`航班时间调整失败: ${data.message}`);
                // 可以在这里添加错误提示
            }
        });

        //4. 实时数据推送
         //飞机状态实时更新,约每秒一次
        this.socket.on('aircraft_status_update',(data)=>{
            console.log('aircraft_status_update:',data);
            this.updatePlanePosition(data.aircraft_positions);
            
        })
        //规划结果更新,在规划变更时触发
         this.socket.on('planning_update', (data) => {
            console.log('planning_update',data);
            // console.log('Received planning update:', data);
            this.updatePlannedFlightsTime(data);
        })

        //5. 冲突检测与解决，需要解决5
        //冲突的数据
        this.socket.on('conflicts_update', (data) => {
            console.log("conflicts_update:", data);
            this.updateOverlapTaxiways(data);
        });

      

        // 连接成功和断开连接事件
        this.socket.on('connect', () => console.log('Connected to WebSocket server'));
        this.socket.on('disconnect', () => console.log('Disconnected from WebSocket server'));
        this.socket.on('connect_error', (error) => {
            console.error('Connection Error:', error); // 打印连接错误
        });
    }


          //---------------------以下为未处理的函数--------------
        // 所有的冲突
    //     this.socket.on('conflict_resolutions_update', (data) => {
    //         console.log('收到冲突解决方案推荐:', data);
    //         this.updateConflictResolutions(data);
            
    //     });

    //     // 冲突解决方案推荐
    //     this.socket.on('conflict_resolutions_result', (response) => {
           
    //         this.conflictResolutionLoading = false;
    //         if (response.success) {
                
    //             this.selectedConflict = response.data.data.conflict;
    //             this.resolution_analysis = response.data.data.analysis;
    //             this.resolutions = response.data.data.recommendations;
                 
    //         } else {
    //             console.error('获取解决方案失败:', response.message);
    //         }
    //     });

    //     // 处理冲突解决方案应用结果
    //     this.socket.on('conflict_resolution_applied', (result) => {
    //         console.log('这是解决方案:', result);
    //         this.conflictResolutionLoading = false;
    //         if (result.status === 'applied') {
    //            console.log('冲突已解决:', );
    //             this.updateConflictStatus(result.conflict_id, 'resolved');
                
    //             console.log('解决方案应用成功:', result.message);
    //             // 更新冲突状态
    //         } else {
    //             console.error('解决方案应用失败:', result.message);
    //         }
    //     });
    // }
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
    updatePlannedFlightsTime(planned_results) {
        if(planned_results.planned_flights){
            this.plannedFlights = planned_results.planned_flights;
        }
        if(planned_results.active_flights){
            this.activeFlights = planned_results.active_flights;
        }
        if(planned_results.conflicts){
            this.conflicts = planned_results.conflicts;
        }
       

    }




    //----------------需要确定----------------------------
    //规划视图返回结果
    // adjustFlightTimeResult(planned_results) { 
    //     this.
    // }
    setDraggingState(isDragging, flightId = null) {
        this.isDragging = isDragging;
        this.draggedFlightId = flightId;
    }
    //  this.socket.on('system_state_update', (data) => {暂时不用
    updateConflicts(newConflicts) {
        this.conflicts = newConflicts;
         
    }

    // 冲突数据：更新重叠滑行道数据的方法
    updateOverlapTaxiways(newOverlapTaxiways) {
        this.overlapTaxiways = newOverlapTaxiways;
    }
    //规划数据更新
    
  
    // 更新冲突解决方案数据
    updateConflictResolutions(raw) {
  try {
    console.log('📊 处理冲突解决方案数据:', raw);

    // 1) 允许传入 JSON 字符串
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    let items = [];

    // 2) 各种输入格式归一化为 items 数组
    if (Array.isArray(data)) {
      // 直接数组
      items = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.resolutions)) {
        // 旧格式：{ resolutions: [...] }
        items = data.resolutions;
      } else if (data.conflict && data.analysis && data.recommendations) {
        // 单条新格式
        items = [data];
      } else {
        // 多条字典：{ conflict_xxx: { conflict, analysis, recommendations }, ... }
        items = Object.values(data).filter(
          v => v && v.conflict && v.analysis && v.recommendations
        );
      }
    } else {
      console.warn('⚠️ 未知的数据类型:', typeof data);
      items = [];
    }

    if (!items.length) {
      console.warn('⚠️ 未从数据中解析到任何冲突项。');
    }

    // 3) 统一映射成内部结构
    this.conflictResolutions = items.map((x, idx) => {
      const id =
        x?.analysis?.conflict_id ??
        `${x?.conflict?.flight1_id || 'F1'}_${x?.conflict?.flight2_id || 'F2'}_${x?.conflict?.conflict_time ?? idx}`;

      return {
        id,
        conflict: x.conflict ?? null,
        analysis: x.analysis ?? null,
        recommendations: Array.isArray(x.recommendations) ? x.recommendations : [],
      };
    });

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
            console.log("获取特定冲突的解决方案")
            this.socket.emit('get_conflict_resolutions', {
                conflict_id: conflictId
            });
        } else {
            console.error('WebSocket未连接，无法获取冲突解决方案');
            this.conflictResolutionLoading = false;
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
}
const websocketStore = new WebSocketStore();
export default websocketStore;
