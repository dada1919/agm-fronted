// src/stores/WebSocketStore.js
import { makeAutoObservable } from 'mobx';
import { io } from 'socket.io-client';

class WebSocketStore {
    socket = null;
    planePosition = [];

    isConnected = false;
    conflicts = null;
    overlapTaxiways = null; // 新增：存储重叠滑行道数据


    
    // plannedPath = null; // 新增 plannedPath 属性
    plannedFlights = {}; // 计划航班数据
    activeFlights = {}; // 活跃航班数据
    pathConflicts = []; // 路径冲突数据

    constructor() {
        makeAutoObservable(this);
        this.connect();
    }

    connect() {
        this.socket = io('http://127.0.0.1:5000', {
            transports: ['websocket'], // 如果所需，指定传输协议
        });

        // 处理接收到的消息
        this.socket.on('system_state_update', (data) => {
            console.log('System state updated:', data);
            // 更新前端显示
            this.updatePlanePosition(data.aircraft_positions);
            // 将完整的数据传递给updateFlightPlans，包含active_flights和planned_flights
            this.updateFlightPlans({
                planned_flights: data.planned_flights || {},
                active_flights: data.active_flights || {},
                conflicts: data.conflicts || []
            });
            this.updateConflicts(data.conflicts);
        });
        this.socket.on('conflict_alert', (data) => {
            console.log("Received conflict update:", data);
            this.updateConflicts(data);
        });
        // 新增：处理重叠滑行道更新事件
        this.socket.on('overlap_taxiways_update', (data) => {
            console.log("Received overlap taxiways update:", data);
            this.updateOverlapTaxiways(data);
        });
        this.socket.on('path_planning_result', (data) => {
            console.log("Received planned path:", data);
            this.updatePlannedPath(data);
        })

        // 连接成功和断开连接事件
        this.socket.on('connect', () => console.log('Connected to WebSocket server'));
        this.socket.on('disconnect', () => console.log('Disconnected from WebSocket server'));
        this.socket.on('connect_error', (error) => {
            console.error('Connection Error:', error); // 打印连接错误
        });
    }

    startSimulate () {
        console.log('Starting simulation...');
        if (this.socket) {
            this.socket.emit('simulate_start');
        }
    }

    updatePlanePosition(newPosition) {
        // 将新的对象格式转换为数组格式以兼容现有绘制逻辑
        // 实际格式: { [aircraft_id]: { coords: [lng, lat], speed, state, path_progress, position, departure_time, remaining_taxi_time, time_to_takeoff } }
        // 转换为: [{ id: aircraft_id, coords: [lng, lat], cur_path, trajectory, speed, state, path_progress, position, departure_time, remaining_taxi_time, time_to_takeoff }]
        if (newPosition && typeof newPosition === 'object') {
            this.planePosition = Object.entries(newPosition).map(([aircraftId, aircraftData]) => ({
                id: aircraftId,
                coords: aircraftData.coords,             // 直接使用 coords 字段
                cur_path: [],                            // 暂时设为空数组，如果后续有路径数据可以更新
                trajectory: [],                          // 暂时设为空数组，如果后续有轨迹数据可以更新
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
        console.log('planePosition', this.planePosition);
    }

    updateConflicts(newConflicts) {
        this.conflicts = newConflicts;
    }

    // 新增：更新重叠滑行道数据的方法
    updateOverlapTaxiways(newOverlapTaxiways) {
        this.overlapTaxiways = newOverlapTaxiways;
    }
    updatePlannedPath(newPlannedPath) {
        // 适配新的后端数据格式
        // 新格式: {planned_flights: {...}, active_flights: {...}, conflicts: [...]}
        this.plannedPath = newPlannedPath;
        this.plannedFlights = newPlannedPath.planned_flights || {};
        this.activeFlights = newPlannedPath.active_flights || {};
        this.pathConflicts = newPlannedPath.conflicts || [];
    }

    updateFlightPlans(flightData) {
        if (flightData) {
            // 直接使用包含planned_flights、active_flights和conflicts的完整数据
            // 数据格式已经符合PlanningView期望的格式: { planned_flights: {...}, active_flights: {...}, conflicts: [...] }
            this.plannedFlights = flightData;
        }
    }
}

const websocketStore = new WebSocketStore();
export default websocketStore;