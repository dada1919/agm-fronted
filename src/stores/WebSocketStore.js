// src/stores/WebSocketStore.js
import { makeAutoObservable } from 'mobx';
import { io } from 'socket.io-client';

class WebSocketStore {
    socket = null;
    planePosition = [];
    isConnected = false;
    conflicts = null;
    plannedPath = null; // 新增 plannedPath 属性

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
            // console.log("Received plane position update:", data);
            this.updatePlanePosition(data);
        });
        this.socket.on('conflict_alert', (data) => {
            console.log("Received conflict update:", data);
            this.updateConflicts(data);
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
    }

    updateConflicts(newConflicts) {
        this.conflicts = newConflicts;
    }

    updatePlannedPath(newPlannedPath) {
        this.plannedPath = newPlannedPath;
    }
}

const websocketStore = new WebSocketStore();
export default websocketStore;