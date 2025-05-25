import React, { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const WebSocketContext = createContext();

const WebSocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    // const [messages, setMessages] = useState([]);
    const [planePosition, setPlanePosition] = useState([]);

    useEffect(() => {
        // 创建 WebSocket 连接
        const newSocket = io('http://127.0.0.1:5000', {
            transports: ['websocket'], // 如果所需，指定传输协议
        });

        setSocket(newSocket);

        // 处理接收到的消息
        newSocket.on('plane_position_update', (data) => {
            console.log("Received plane position update:", data);
            setPlanePosition(data);
        });

        // 连接成功和断开连接事件
        newSocket.on('connect', () => console.log('Connected to WebSocket server'));
        newSocket.on('disconnect', () => console.log('Disconnected from WebSocket server'));
        newSocket.on('connect_error', (error) => {
            console.error('Connection Error:', error); // 打印连接错误
        });

        // 清理函数，在组件卸载时关闭连接
        return () => {
            console.log('Cleaning up WebSocket connection');
            // newSocket.disconnect();
        };
    }, []);

    // 发送消息函数
    // const sendMessage = (message) => {
    //     if (socket) {
    //         socket.emit('message', message);
    //     }
    // };
    const startSimulate = () => {
        console.log('Starting simulation...');
        if (socket) {
            socket.emit('simulate_start');
        }
    }

    const value = {
        socket
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export { WebSocketProvider, WebSocketContext };