// src/stores/WebSocketStore.js
import { makeAutoObservable } from 'mobx';
import { io } from 'socket.io-client';

class WebSocketStore {
    socket = null;
    planePosition = [];
    isConnected = false;
    conflicts = null;
    overlapTaxiways = null; // 新增：存储重叠滑行道数据


    
    plannedPath = null; // 新增 plannedPath 属性
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
        this.socket.on('plane_position_update', (data) => {
            console.log("Received plane position update:", data);
            this.updatePlanePosition(data);
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
        this.planePosition = newPosition;
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
}

const websocketStore = new WebSocketStore();
export default websocketStore;