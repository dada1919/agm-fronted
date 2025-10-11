import React, { useEffect, useRef, useState, useContext } from 'react';
import websocketStore from '@/stores/WebSocketStore';
import { observer } from 'mobx-react';
import { autorun } from 'mobx';
import * as d3 from 'd3';
import { Table } from 'antd';
import { createStyles } from 'antd-style';

// SVG表格组件
const SVGTable = ({ columns, dataSource, rowHeight, headerHeight, onScroll, tableRef }) => {
    const svgTableRef = useRef();
    const containerRef = useRef();

    // 计算表格尺寸
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const totalHeight = headerHeight + dataSource.length * rowHeight;

    useEffect(() => {
        if (tableRef) {
            tableRef.current = containerRef.current;
        }
    }, [tableRef]);

    // 渲染单元格内容
    const renderCellContent = (column, record, value) => {
        if (column.render) {
            return column.render(value, record);
        }
        return value || '-';
    };

    // 获取单元格文本颜色
    const getCellTextColor = (column, record, value) => {
        if (column.key === 'flight_id') {
            return record.status === 'normal' ? '#52c41a' : '#1890ff';
        }
        return '#000000';
    };

    // 格式化显示文本
    const formatDisplayText = (column, record, value) => {
        if (column.key === 'taxi_time') {
            return value ? value.toFixed(1) : '-';
        }
        if (column.key === 'start_time') {
            if (typeof value === 'string') {
                return new Date(value).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            } else if (typeof value === 'number') {
                return `T+${(value / 60).toFixed(1)}`;
            }
            return '-';
        }
        if (column.key === 'time_to_takeoff') {
            return value !== undefined ? value.toFixed(1) : '-';
        }
        if (column.key === 'remaining_taxi_time') {
            return value ? (value / 60).toFixed(1) : '-';
        }
        return value || '-';
    };

    return (
        <div
            ref={containerRef}
            onScroll={onScroll}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                backgroundColor: '#ffffff'
            }}
            className="svg-table-container"
        >
            <svg
                ref={svgTableRef}
                width={tableWidth}
                height={totalHeight}
                style={{
                    display: 'block',
                    backgroundColor: '#ffffff',
                    minWidth: tableWidth,
                }}
            >
                {/* 表头背景 */}
                <rect
                    x={0}
                    y={0}
                    width={tableWidth}
                    height={headerHeight}
                    fill="#fafafa"
                    stroke="#f0f0f0"
                    strokeWidth={1}
                />

                {/* 表头文本和分割线 */}
                {columns.map((column, colIndex) => {
                    const x = columns.slice(0, colIndex).reduce((sum, col) => sum + col.width, 0);
                    return (
                        <g key={`header-${colIndex}`}>
                            {/* 表头文本 */}
                            <text
                                x={x + column.width / 2}
                                y={headerHeight / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="12px"
                                fontWeight="bold"
                                fill="#000000"
                            >
                                {column.title}
                            </text>

                            {/* 列分割线 */}
                            {colIndex < columns.length - 1 && (
                                <line
                                    x1={x + column.width}
                                    y1={0}
                                    x2={x + column.width}
                                    y2={headerHeight}
                                    stroke="#f0f0f0"
                                    strokeWidth={1}
                                />
                            )}
                        </g>
                    );
                })}

                {/* 表格数据行 */}
                {dataSource.map((record, rowIndex) => {
                    const y = headerHeight + rowIndex * rowHeight;
                    return (
                        <g key={`row-${rowIndex}`}>
                            {/* 行背景 */}
                            <rect
                                x={0}
                                y={y}
                                width={tableWidth}
                                height={rowHeight}
                                fill="#ffffff"
                                stroke="#f0f0f0"
                                strokeWidth={1}
                                className="table-row"
                                style={{
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.setAttribute('fill', '#f5f5f5');
                                }}
                                onMouseLeave={(e) => {
                                    e.target.setAttribute('fill', '#ffffff');
                                }}
                            />

                            {/* 行中心线（用于与右侧对齐） */}
                            <line
                                x1={0}
                                y1={y + rowHeight / 2}
                                x2={tableWidth}
                                y2={y + rowHeight / 2}
                                stroke="transparent"
                                strokeWidth={1}
                                className="row-center-line"
                            />

                            {/* 单元格内容 */}
                            {columns.map((column, colIndex) => {
                                const x = columns.slice(0, colIndex).reduce((sum, col) => sum + col.width, 0);
                                const value = record[column.dataIndex];
                                const displayText = formatDisplayText(column, record, value);
                                const textColor = getCellTextColor(column, record, value);

                                return (
                                    <g key={`cell-${rowIndex}-${colIndex}`}>
                                        {/* 单元格文本 */}
                                        <text
                                            x={x + column.width / 2}
                                            y={y + rowHeight / 2}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize="12px"
                                            fontWeight={column.key === 'flight_id' ? 'bold' : 'normal'}
                                            fill={textColor}
                                        >
                                            {displayText}
                                        </text>

                                        {/* 列分割线 */}
                                        {colIndex < columns.length - 1 && (
                                            <line
                                                x1={x + column.width}
                                                y1={y}
                                                x2={x + column.width}
                                                y2={y + rowHeight}
                                                stroke="#f0f0f0"
                                                strokeWidth={1}
                                            />
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}

                {/* 表格外边框 */}
                <rect
                    x={0}
                    y={0}
                    width={tableWidth}
                    height={totalHeight}
                    fill="none"
                    stroke="#f0f0f0"
                    strokeWidth={1}
                />
            </svg>
        </div>
    );
};

const useStyle = createStyles(({ css, token }) => {
    const { antCls } = token;
    return {
        // 隐藏滚动条的通用样式
        hideScrollbar: css`
          /* 隐藏滚动条但保持滚动功能 */
          ::-webkit-scrollbar {
            width: 0px;
            height: 0px;
            display: none;
          }
          
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        `,
        customTable: css`
      ${antCls}-table {
        ${antCls}-table-container {
         
          ${antCls}-table-body,
          ${antCls}-table-content {
            scrollbar-width: thin;
            scrollbar-color: #eaeaea transparent;
            scrollbar-gutter: stable;
          }
        }
        
        // 确保表头和内容对齐
        ${antCls}-table-thead > tr > th {
          height: 40px !important;
          line-height: 40px !important;
          padding: 0 8px !important;
          font-size: 12px !important;
          font-weight: bold !important;
          white-space: nowrap !important;
          text-align: center !important;
          vertical-align: middle !important;
          background-color: #fafafa !important;
          border-bottom: 1px solid #f0f0f0 !important;
          box-sizing: border-box !important;
        }
        
        ${antCls}-table-tbody > tr > td {
          height: 40px !important;
          line-height: 40px !important;
          padding: 0 8px !important;
          font-size: 12px !important;
          white-space: nowrap !important;
          text-align: center !important;
          vertical-align: middle !important;
          border-bottom: 1px solid #f0f0f0 !important;
          box-sizing: border-box !important;
        }
        
        // 固定列样式
        ${antCls}-table-cell-fix-left,
        ${antCls}-table-cell-fix-right {
          background-color: #fff !important;
          border-right: 1px solid #f0f0f0 !important;
        }
        
        // 表格布局固定
        ${antCls}-table-table {
          table-layout: fixed !important;
        }
        
        // 悬停效果
        ${antCls}-table-tbody > tr:hover > td {
          background-color: #f5f5f5 !important;
        }
        
        // 隐藏滚动条但保持滚动功能
        ${antCls}-table-body::-webkit-scrollbar {
          width: 0px;
          height: 0px;
          display: none;
        }
        
        ${antCls}-table-body {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
      }
    `,
    };
});




// 定义航班表格列
const columns = [
    {
        title: 'Flight ID', // 航班ID
        width: 100,
        dataIndex: 'flight_id',
        key: 'flight_id',
        fixed: 'left', // 固定列
        ellipsis: true,
        render: (flightId, record) => {
            // 根据航班状态显示不同颜色
            // 绿色：既在planned又在active中（normal状态）
            // 蓝色：只在planned中（planned状态）
            const color = record.status === 'normal' ? '#52c41a' : '#1890ff';
            return (
                <span style={{ color: color, fontWeight: 'bold', fontSize: '12px' }}>
                    {flightId}
                </span>
            );
        }
    },
    {
        title: 'Taxi Time', // 滑行时间
        dataIndex: 'taxi_time',
        key: 'taxi_time',
        width: 90,
        ellipsis: true,
        render: (time) => time ? time.toFixed(1) : '-'
    },
    {
        title: 'Start Time', // 开始时间
        dataIndex: 'start_time',
        key: 'start_time',
        width: 100,
        ellipsis: true,
        render: (time) => {
            if (typeof time === 'string') {
                // active_flights中的时间格式
                return new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            } else if (typeof time === 'number') {
                // planned_flights中的时间格式（秒）
                return `T+${(time / 60).toFixed(1)}`;
            }
            return '-';
        }
    },
    {
        title: 'Time to Takeoff', // 起飞时间
        dataIndex: 'time_to_takeoff',
        key: 'time_to_takeoff',
        width: 110,
        ellipsis: true,
        render: (time) => time !== undefined ? time.toFixed(1) : '-'
    },
    {
        title: 'Remaining Time', // 剩余时间
        dataIndex: 'remaining_taxi_time',
        key: 'remaining_taxi_time',
        width: 110,
        ellipsis: true,
        render: (time) => time ? (time / 60).toFixed(1) : '-'
    },
    {
        title: 'Origin', // 起点
        dataIndex: 'origin',
        key: 'origin',
        width: 80,
        ellipsis: true
    },
    {
        title: 'Destination', // 终点
        dataIndex: 'destination',
        key: 'destination',
        width: 80,
        ellipsis: true
    }
];

const PlanningView = observer(() => {
    const { styles } = useStyle();
    const width = 1200, height = 400; // 增加尺寸以容纳更多数据
    const svgRef = useRef();
    const d3Container = useRef({});
    const [timeScale, setTimeScale] = useState({ min: 0, max: 100 });
    const [tableDataSource, setTableDataSource] = useState([]); // 表格数据源
    const [aircraftOrder, setAircraftOrder] = useState([]); // 航班顺序，用于同步滚动
    const tableRef = useRef(); // 表格引用
    const chartRef = useRef(); // 图表容器引用
    const ROW_HEIGHT = 40;
    const ROW_HEIGHT_P = 40; // 每行高度，用于同步滚动
    const HEADER_HEIGHT = 40; // 表头高度

    // 分段函数计算逻辑
    const calculatePiecewiseFunction = (t, piecewiseData) => {
        if (!piecewiseData || !Array.isArray(piecewiseData)) {
            return null;
        }

        // 找到包含时间点t的分段
        for (const segment of piecewiseData) {
            const { t1, t2, a, b, c } = segment;
            if (t >= t1 && t <= t2) {
                // 计算函数值: ax + by + c = 0 => y = -(ax + c) / b
                if (b !== 0) {
                    return -(a * t + c) / b;
                } else {
                    // 如果b=0，则为垂直线，返回特殊值
                    return a * t + c;
                }
            }
        }
        return null;
    };

    // 创建颜色映射函数
    const createColorScale = (minValue, maxValue) => {
        return d3.scaleSequential(d3.interpolateViridis)
            .domain([minValue, maxValue]);
    };

    // 生成带状图形的路径点
    const generateBandPath = (t1, t2, piecewiseData, xScale, y1, y2, resolution = 50) => {
        const points = [];
        const step = (t2 - t1) / resolution;

        for (let i = 0; i <= resolution; i++) {
            const t = t1 + i * step;
            const x = xScale(t);
            const functionValue = calculatePiecewiseFunction(t, piecewiseData);

            if (functionValue !== null) {
                // 将函数值映射到两条时间线之间的位置
                // 假设函数值范围需要归一化到[0,1]之间
                const normalizedValue = Math.max(0, Math.min(1, (functionValue + 10) / 20)); // 简单归一化
                const y = y1 + (y2 - y1) * normalizedValue;
                points.push([x, y]);
            }
        }

        return points;
    };

    // 冲突数据更新函数，支持样式配置
    const updateConflictData = (conflictData, conflictType = 'current', styleConfig = {}) => {
        console.log(`=== 更新${conflictType}冲突数据 ===`);
        console.log(`冲突数据:`, conflictData);
        console.log(`样式配置:`, styleConfig);

        // 默认样式配置
        const defaultStyles = {
            current: {
                pointColor: 'red',
                pointRadius: 6,
                lineColor: 'red',
                lineWidth: 3,
                lineDashArray: '5,5',
                opacity: 0.8,
                textColor: 'red',
                fontSize: '10px',
                fontWeight: 'bold'
            },
            future: {
                pointColor: 'orange',
                pointRadius: 5,
                lineColor: 'orange',
                lineWidth: 2,
                lineDashArray: '3,3',
                opacity: 0.6,
                textColor: 'orange',
                fontSize: '9px',
                fontWeight: 'normal'
            }
        };

        // 合并样式配置
        const styles = {
            ...defaultStyles[conflictType],
            ...styleConfig
        };

        // 获取当前的SVG容器和相关变量
        const svg = d3.select(svgRef.current);
        const g = svg.select('.main-group');

        if (g.empty()) {
            console.warn('SVG主组未找到，无法绘制冲突数据');
            return;
        }

        // 创建或获取特定冲突类型的组
        let conflictGroup = g.select(`.conflict-group-${conflictType}`);
        if (conflictGroup.empty()) {
            conflictGroup = g.append('g')
                .attr('class', `conflict-group-${conflictType}`)
                .attr('data-type', conflictType);
        }

        // 清除之前的冲突标记（仅清除当前类型的冲突组内容）
        conflictGroup.selectAll('*').remove();

        // 如果没有冲突数据，直接返回
        if (!conflictData || conflictData.length === 0) {
            console.log(`没有${conflictType}冲突数据需要绘制`);
            return;
        }

        // 获取当前的时间比例尺和位置函数
        const xScale = d3Container.current.xScale;
        const getYPosition = d3Container.current.getYPosition;
        const aircraftIds = d3Container.current.aircraftIds;

        if (!xScale || !getYPosition || !aircraftIds) {
            console.warn('缺少必要的绘图函数或数据，无法绘制冲突');
            return;
        }

        // 处理冲突数据
        conflictData.forEach((conflict, index) => {
            console.log(`处理${conflictType}冲突 ${index + 1}:`, conflict);

            // 支持新的对象格式和旧的数组格式
            let conflictId, flight1Id, flight2Id, conflictTime;

            if (typeof conflict === 'object' && !Array.isArray(conflict)) {
                // 新的对象格式
                conflictId = conflict.conflict_id;
                flight1Id = conflict.flight1_id;
                flight2Id = conflict.flight2_id;
                conflictTime = conflict.time_to_conflict / 60; // 转换秒为分钟
            } else if (Array.isArray(conflict) && conflict.length >= 3) {
                // 旧的数组格式 [conflictId, [flight1, flight2], time]
                conflictId = conflict[0];
                const flightIds = conflict[1];
                conflictTime = conflict[2];

                if (Array.isArray(flightIds) && flightIds.length >= 2) {
                    flight1Id = flightIds[0];
                    flight2Id = flightIds[1];
                } else {
                    console.warn(`冲突数据格式错误，航班ID数组无效:`, flightIds);
                    return;
                }
            } else {
                console.warn(`冲突数据格式错误:`, conflict);
                return;
            }

            // 检查两架飞机是否都在aircraftIds中
            if (aircraftIds.includes(flight1Id) && aircraftIds.includes(flight2Id)) {
                const y1 = getYPosition(flight1Id);
                const y2 = getYPosition(flight2Id);
                const x = xScale(conflictTime); // 冲突时间点的x坐标

                // 绘制冲突点（在每架飞机的时间线上）
                g.append("circle")
                    .attr("class", `conflict-${conflictType} conflict-point`)
                    .attr("cx", x)
                    .attr("cy", y1)
                    .attr("r", styles.pointRadius)
                    .attr("fill", styles.pointColor)
                    .attr("stroke", "white")
                    .attr("stroke-width", 2)
                    .attr("opacity", styles.opacity);

                g.append("circle")
                    .attr("class", `conflict-${conflictType} conflict-point`)
                    .attr("cx", x)
                    .attr("cy", y2)
                    .attr("r", styles.pointRadius)
                    .attr("fill", styles.pointColor)
                    .attr("stroke", "white")
                    .attr("stroke-width", 2)
                    .attr("opacity", styles.opacity);

                // 绘制连接两架飞机的冲突线
                g.append("line")
                    .attr("class", `conflict-${conflictType} conflict-line`)
                    .attr("x1", x)
                    .attr("y1", y1)
                    .attr("x2", x)
                    .attr("y2", y2)
                    .attr("stroke", styles.lineColor)
                    .attr("stroke-width", styles.lineWidth)
                    .attr("stroke-dasharray", styles.lineDashArray)
                    .attr("opacity", styles.opacity);

                // 添加冲突标识文本，显示更多信息
                const conflictLabel = typeof conflict === 'object' && !Array.isArray(conflict)
                    ? `${conflict.conflict_type || 'CONFLICT'} (${conflict.severity || 'UNKNOWN'})`
                    : `${conflictType === 'current' ? '当前' : '未来'}冲突`;

                g.append("text")
                    .attr("class", `conflict-${conflictType} conflict-text`)
                    .attr("x", x + 5) // 稍微偏移避免重叠
                    .attr("y", (y1 + y2) / 2)
                    .attr("font-size", styles.fontSize)
                    .attr("fill", styles.textColor)
                    .attr("font-weight", styles.fontWeight)
                    .attr("opacity", styles.opacity)
                    .text(`${conflictLabel}@T+${conflictTime.toFixed(1)}`);

                console.log(`成功绘制${conflictType}冲突: ${flight1Id} vs ${flight2Id} at T+${conflictTime.toFixed(1)}分钟`);

                // 绘制分段函数带状图形（如果存在分段函数数据）
                if (typeof conflict === 'object' && !Array.isArray(conflict) && conflict.temporal_functions) {
                    console.log(`绘制${conflictType}分段函数带状图形:`, conflict.temporal_functions);

                    // 获取分段函数的时间范围
                    const piecewiseData = conflict.temporal_functions;
                    const timeRange = piecewiseData.reduce((range, segment) => {
                        return {
                            min: Math.min(range.min, segment.t1),
                            max: Math.max(range.max, segment.t2)
                        };
                    }, { min: Infinity, max: -Infinity });

                    // 计算函数值范围用于颜色映射
                    const functionValues = [];
                    const resolution = 100;
                    const step = (timeRange.max - timeRange.min) / resolution;

                    for (let i = 0; i <= resolution; i++) {
                        const t = timeRange.min + i * step;
                        const value = calculatePiecewiseFunction(t, piecewiseData);
                        if (value !== null) {
                            functionValues.push(value);
                        }
                    }

                    if (functionValues.length > 0) {
                        const valueRange = {
                            min: Math.min(...functionValues),
                            max: Math.max(...functionValues)
                        };

                        // 创建颜色比例尺
                        const colorScale = createColorScale(valueRange.min, valueRange.max);

                        // 为每个冲突类型创建唯一的渐变ID
                        const gradientId = `conflict-gradient-${conflictType}-${conflictId}`;

                        // 创建线性渐变定义
                        const gradient = conflictGroup.append("defs")
                            .append("linearGradient")
                            .attr("id", gradientId)
                            .attr("x1", "0%")
                            .attr("y1", "0%")
                            .attr("x2", "100%")
                            .attr("y2", "0%");

                        // 添加渐变停止点
                        for (let i = 0; i <= resolution; i++) {
                            const t = timeRange.min + i * step;
                            const value = calculatePiecewiseFunction(t, piecewiseData);
                            if (value !== null) {
                                const normalizedValue = (value - valueRange.min) / (valueRange.max - valueRange.min);
                                const color = colorScale(normalizedValue);
                                gradient.append("stop")
                                    .attr("offset", `${i / resolution * 100}%`)
                                    .attr("stop-color", color);
                            }
                        }

                        // 绘制单一方形路径
                        const x1 = xScale(timeRange.min);
                        const x2 = xScale(timeRange.max);
                        const y1 = getYPosition(flight1Id);
                        const y2 = getYPosition(flight2Id);

                        // 创建方形路径
                        conflictGroup.append("path")
                            .attr("class", `conflict-${conflictType} conflict-band`)
                            .attr("d", `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`)
                            .attr("fill", `url(#${gradientId})`)
                            .attr("stroke", "none")
                            .attr("opacity", styles.opacity);
                    }
                }




                // 如果是新格式，输出更多调试信息
                if (typeof conflict === 'object' && !Array.isArray(conflict)) {
                    console.log(`  - 冲突类型: ${conflict.conflict_type}`);
                    console.log(`  - 严重程度: ${conflict.severity}`);
                    console.log(`  - 预计延误: ${conflict.estimated_delay}分钟`);
                    console.log(`  - 安全风险: ${conflict.safety_risk}`);
                }
            } else {
                console.warn(`冲突中的航班ID不在当前显示列表中: ${flight1Id}, ${flight2Id}`);
                console.warn(`当前显示的航班ID列表:`, aircraftIds);
            }
        });

        console.log(`${conflictType}冲突数据更新完成，共处理 ${conflictData.length} 个冲突`);
    };

    // 处理航班数据，生成表格数据源（统一来源 planned_flights，使用 remaining_taxi_time）
    const processFlightData = (plannedData) => {
        const tableData = [];
        const aircraftIds = [];

        if (plannedData.planned_flights) {
            Object.entries(plannedData.planned_flights).forEach(([flightId, flightData]) => {
                aircraftIds.push(flightId);
                const status = flightData.type === 'active' ? 'normal' : 'planned';
                tableData.push({
                    key: flightId,
                    flight_id: flightId,
                    status,
                    taxi_time: (flightData.remaining_taxi_time || 0) / 60,
                    start_time: flightData.start_time,
                    time_to_takeoff: flightData.time_to_takeoff,
                    remaining_taxi_time: flightData.remaining_taxi_time,
                    origin: flightData.origin,
                    destination: flightData.destination
                });
            });
        }
        return { tableData, aircraftIds };
    };

    useEffect(() => {
         if (websocketStore.isDragging) {
            return; // 如果正在拖拽，则跳过更新
        }
        const svg = d3.select(svgRef.current);

        // 创建 D3 元素引用

        // 处理模拟数据的函数
        const processSimulationData = () => {
            const currentSimulation = websocketStore.getCurrentSimulation();
            let simulationResults = [];

            // 如果有模拟数据，处理模拟数据为时间线格式
            if (currentSimulation && currentSimulation.simulated_state) {
                const simulatedState = currentSimulation.simulated_state;

                // 处理模拟的计划航班
                if (simulatedState.planned_flights) {
                    Object.entries(simulatedState.planned_flights).forEach(([flightId, flightData]) => {
                        const startTimeMinutes = flightData.start_time / 60;
                        const taxiTimeMinutes = flightData.taxi_time / 60;

                        const convertedData = {
                            aircraft_id: flightId,
                            type: 'simulation_planning', // 模拟计划航班类型
                            time_to_start: startTimeMinutes,
                            taxi_time: taxiTimeMinutes,
                            paths: [{
                                start_time: startTimeMinutes,
                                end_time: startTimeMinutes + taxiTimeMinutes,
                                duration: taxiTimeMinutes,
                                path: flightData.path
                            }],
                            conflicts: []
                        };

                        simulationResults.push(convertedData);
                    });
                }

                // 处理模拟的活跃航班
                if (simulatedState.active_flights) {
                    Object.entries(simulatedState.active_flights).forEach(([flightId, flightData]) => {
                        const remainingTimeMinutes = (flightData.remaining_taxi_time || 0) / 60;

                        const convertedData = {
                            aircraft_id: flightId,
                            type: 'simulation_active', // 模拟活跃航班类型
                            time_to_takeoff: flightData.time_to_takeoff,
                            paths: [{
                                time: remainingTimeMinutes,
                                path: flightData.path
                            }],
                            plan_time: remainingTimeMinutes,
                            conflicts: []
                        };

                        simulationResults.push(convertedData);
                    });
                }
            }

            return simulationResults;
        };


        const updatePlanningView = (plannedData) => {
            // 绘制模拟数据时间线的函数
            const drawSimulationTimelines = (g, simulationResults, xScale, getYPosition, simulationColors) => {
                if (simulationResults.length === 0) return;

                const simulationFlights = g.selectAll(".simulation-flight-group")
                    .data(simulationResults)
                    .enter()
                    .append("g")
                    .attr("class", d => `simulation-flight-group ${d.type}-flight`)
                    .attr("id", d => `simulation-flight-${d.aircraft_id}`);

                let simulationIndex = 0;

                simulationFlights.each(function (simulationResult, i) {
                    const simulationGroup = d3.select(this);

                    // 为模拟数据选择颜色和样式
                    const color = simulationColors[simulationIndex % simulationColors.length];
                    const strokeWidth = 3; // 模拟数据线条中等粗细
                    const strokeDasharray = "8,4"; // 长虚线，区别于原时间线
                    simulationIndex++;

                    // 绘制模拟时间线（在原时间线下方偏移）
                    const yOffset = 8; // 向下偏移8像素

                    simulationGroup.selectAll("line")
                        .data(simulationResult.paths)
                        .enter()
                        .append("line")
                        .attr("x1", d => {
                            return simulationResult.type === 'simulation_planning' ? xScale(d.start_time) : xScale(0);
                        })
                        .attr("x2", d => {
                            return simulationResult.type === 'simulation_planning' ? xScale(d.end_time) : xScale(d.time);
                        })
                        .attr("y1", (d, j) => getYPosition(simulationResult.aircraft_id) + j * 3 + yOffset)
                        .attr("y2", (d, j) => getYPosition(simulationResult.aircraft_id) + j * 3 + yOffset)
                        .attr("stroke", color)
                        .attr("stroke-width", strokeWidth)
                        .attr("stroke-linecap", "round")
                        .attr("stroke-dasharray", strokeDasharray)
                        .attr("opacity", 0.8); // 稍微透明以区分

                    // 添加模拟起始点图标（菱形）
                    simulationGroup.selectAll(".simulation-start-point")
                        .data(simulationResult.paths)
                        .enter()
                        .append("polygon")
                        .attr("class", "simulation-start-point")
                        .attr("points", d => {
                            const x = simulationResult.type === 'simulation_planning' ? xScale(d.start_time) : xScale(0);
                            const y = getYPosition(simulationResult.aircraft_id) + yOffset;
                            const size = 4;
                            return `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`;
                        })
                        .attr("fill", color)
                        .attr("stroke", "white")
                        .attr("stroke-width", 1)
                        .attr("opacity", 0.9);

                    // 添加模拟结束点图标（菱形）
                    simulationGroup.selectAll(".simulation-end-point")
                        .data(simulationResult.paths)
                        .enter()
                        .append("polygon")
                        .attr("class", "simulation-end-point")
                        .attr("points", d => {
                            const x = simulationResult.type === 'simulation_planning' ? xScale(d.end_time) : xScale(d.time);
                            const y = getYPosition(simulationResult.aircraft_id) + yOffset;
                            const size = 4;
                            return `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`;
                        })
                        .attr("fill", color)
                        .attr("stroke", "white")
                        .attr("stroke-width", 1)
                        .attr("opacity", 0.9);

                    // 为模拟活跃飞机添加特殊标识（星形）
                    if (simulationResult.type === 'simulation_active') {
                        simulationGroup.selectAll(".simulation-active-indicator")
                            .data(simulationResult.paths)
                            .enter()
                            .append("polygon")
                            .attr("class", "simulation-active-indicator")
                            .attr("points", d => {
                                const x = xScale(d.time);
                                const y = getYPosition(simulationResult.aircraft_id) - 5 + yOffset;
                                const size = 3;
                                // 创建星形的点
                                return `${x},${y - size} ${x + size * 0.3},${y - size * 0.3} ${x + size},${y} ${x + size * 0.3},${y + size * 0.3} ${x},${y + size} ${x - size * 0.3},${y + size * 0.3} ${x - size},${y} ${x - size * 0.3},${y - size * 0.3}`;
                            })
                            .attr("fill", color)
                            .attr("stroke", "white")
                            .attr("stroke-width", 1)
                            .attr("opacity", 0.9);
                    }

                    // 为模拟计划飞机添加特殊标识（六边形）
                    if (simulationResult.type === 'simulation_planning') {
                        simulationGroup.selectAll(".simulation-planning-indicator")
                            .data(simulationResult.paths)
                            .enter()
                            .append("polygon")
                            .attr("class", "simulation-planning-indicator")
                            .attr("points", d => {
                                const x = xScale(d.end_time);
                                const y = getYPosition(simulationResult.aircraft_id) - 8 + yOffset;
                                const size = 4;
                                // 创建六边形的点
                                const angle = Math.PI / 3; // 60度
                                let points = [];
                                for (let i = 0; i < 6; i++) {
                                    const px = x + size * Math.cos(i * angle);
                                    const py = y + size * Math.sin(i * angle);
                                    points.push(`${px},${py}`);
                                }
                                return points.join(' ');
                            })
                            .attr("fill", color)
                            .attr("stroke", "white")
                            .attr("stroke-width", 1)
                            .attr("opacity", 0.9);
                    }
                });
            };

            // 适配新的数据格式
            // plannedData: {planned_flights: {...}, active_flights: {...}, conflicts: [...]}
            // console.log('PlanningView received data:', plannedData);
            // console.log('planned_flights:', plannedData?.planned_flights);
            // console.log('active_flights:', plannedData?.active_flights);

            // 处理航班数据，生成表格数据源
            const { tableData, aircraftIds: processedAircraftIds } = processFlightData(plannedData);
            setTableDataSource(tableData);
            setAircraftOrder(processedAircraftIds);
            // console.log('Generated table data:', tableData);
            // console.log('Aircraft order:', processedAircraftIds);

            let maxTime = 0;
            let aircraftIds = processedAircraftIds; // 使用处理后的航班ID顺序
            let left_times = [];
            let plan_times = [];
            let fly_times = [];

            // 转换新数据格式为可视化需要的格式
            const plannedResults = [];
            // 统一处理 planned_flights（含 type），使用 remaining_taxi_time
            if (plannedData.planned_flights) {
                Object.entries(plannedData.planned_flights).forEach(([flightId, flightData]) => {
                    const startTimeMinutes = (flightData.start_time || 0) / 60;
                    const durationMinutes = (flightData.remaining_taxi_time || 0) / 60;
                    const timeToTakeoff = flightData.time_to_takeoff;
                    const type = flightData.type === 'active' ? 'active' : 'planning';

                    const convertedData = {
                        aircraft_id: flightId,
                        type,
                        time_to_start: startTimeMinutes,
                        taxi_time: durationMinutes,
                        plan_time: durationMinutes,
                        paths: [{
                            start_time: startTimeMinutes,
                            end_time: startTimeMinutes + durationMinutes,
                            duration: durationMinutes,
                            path: flightData.path
                        }],
                        conflicts: []
                    };

                    plannedResults.push(convertedData);
                    left_times.push(startTimeMinutes);
                    plan_times.push(durationMinutes);
                    fly_times.push(timeToTakeoff);

                    const endTime = startTimeMinutes + durationMinutes;
                    if (endTime > maxTime) {
                        maxTime = endTime;
                    }
                });
            }
            //规划视图的处理
            // console.log("aircraftIds:", aircraftIds);
            // console.log("Max Time:", maxTime);
            // console.log("plannedResults:", plannedResults);
            // console.log("Active flights count:", plannedResults.filter(r => r.type === 'active').length);
            // console.log("Planning flights count:", plannedResults.filter(r => r.type === 'planning').length);

            maxTime = Math.ceil(maxTime)
            setTimeScale({ min: 0, max: maxTime });

            // 绘制视图

            const svg = d3.select(svgRef.current);
            const width = 1200; // 与组件定义的宽度保持一致

            // 根据飞机数量动态计算所需高度，与表格保持一致
            const requiredHeight = HEADER_HEIGHT + aircraftIds.length * ROW_HEIGHT_P;

            const baseHeight = 400;

            // const height = Math.max(baseHeight, requiredHeight + 200); // 额外增加200px用于边距和图例
            const height = requiredHeight + 200; // 额外增加200px用于边距和图例

            // 为右侧图例预留空间，避免与时间线重叠
            const LEGEND_WIDTH = 200;
            const LEGEND_GAP = 20;
            const margin = { top: 0, right: LEGEND_WIDTH + LEGEND_GAP, bottom: 80, left: 150 }; // 增加右侧边距以容纳图例

            // 清除之前的内容
            svg.selectAll("*").remove();

            // 设置SVG尺寸
            svg.attr("width", width)
                .attr("height", height)
                .attr("viewBox", [0, 0, width, height])
                .attr("style", "max-width: 100%; height: auto;");

            // 创建主容器
            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // 计算实际绘图区域尺寸
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;


            // 创建时间比例尺
            const xScale = d3.scaleLinear()
                .domain([0, maxTime])
                .range([0, innerWidth]);

            // 创建飞机ID比例尺，确保与表格行高完全一致
            //const chartHeight = Math.max(400, aircraftIds.length * ROW_HEIGHT_P);
            const chartHeight = (aircraftIds.length + 1) * ROW_HEIGHT_P + HEADER_HEIGHT;

            // 使用序数比例尺来精确控制行位置，确保与表格完全对齐
            const yScale = d3.scaleOrdinal()
                .domain(aircraftIds)
                .range(aircraftIds.map((_, index) => (HEADER_HEIGHT + index * ROW_HEIGHT_P + (ROW_HEIGHT_P / 2))));

            // 计算行的中心位置，使用yScale确保与表格行完全对齐
            const getYPosition = (flightId) => {

                return yScale(flightId);
            };

            // 创建X轴
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(d => `T+${d.toFixed(0)}`)
                .tickSizeOuter(0);

            const color = '#000000'; // 默认颜色

            // 绘制X轴
            g.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0, ${chartHeight})`)
                .call(xAxis)
                .append("text")
                .attr("x", innerWidth / 2)
                .attr("y", 40)
                .attr("stroke", color)
                .attr("fill", color)
                .attr("text-anchor", "middle")
                .text("时间 (分钟)");

            // 手动创建Y轴以确保与表格对齐
            const yAxisGroup = g.append("g")
                .attr("class", "y-axis");

            // 添加Y轴标题
            yAxisGroup.append("text")
                .attr("x", -10)
                .attr("y", 20)
                .attr("fill", color)
                .attr("stroke", color)
                .attr("text-anchor", "end")
                //.attr("transform", "rotate(-90)")
                .text("飞机 ID")


            // 手动添加Y轴刻度线和标签
            aircraftIds.forEach((flightId, index) => {
                const yPos = getYPosition(flightId);


                // 添加刻度线
                yAxisGroup.append("line")
                    .attr("x1", -6)
                    .attr("x2", 0)
                    .attr("y1", yPos)
                    .attr("y2", yPos)
                    .attr("stroke", "#000")
                    .attr("stroke-width", 1);

                // 添加标签
                yAxisGroup.append("text")
                    .attr("x", -9)
                    .attr("y", yPos)
                    .attr("dy", "0.32em")
                    .attr("text-anchor", "end")
                    .attr("font-size", "12px")
                    .attr("fill", "#000")
                    .text(flightId);
            });

            // 绘制时间线

            // 为不同类型的飞机定义不同的颜色和样式
            const activeColors = ['#FF6B6B', '#FF8E53', '#FF6B9D', '#C44569', '#F8B500']; // 活跃飞机：暖色调
            const planningColors = ['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']; // 计划飞机：冷色调
            const simulationColors = ['#9B59B6', '#8E44AD', '#E74C3C', '#C0392B', '#F39C12']; // 模拟数据：紫红色调

            let activeIndex = 0;
            let planningIndex = 0;




            // 处理模拟数据
            const simulationResults = processSimulationData();

            const flights = g.selectAll(".flight-group")
                .data(plannedResults) // 绑定所有飞机的数据
                .enter()
                .append("g") // 为每架飞机创建一个 <g>
                .attr("class", d => `flight-group ${d.type}-flight`) // 添加类型相关的class
                .attr("id", d => `flight-${d.aircraft_id}`); // 使用飞机ID作为DOM的ID，便于调试

            // 在每个飞机分组内，根据类型设置不同样式
            flights.each(function (plannedResult, i) {
                const flightGroup = d3.select(this);

                // 根据飞机类型选择颜色和样式
                let color, strokeWidth, strokeDasharray;
                if (plannedResult.type === 'active') {
                    color = activeColors[activeIndex % activeColors.length];
                    strokeWidth = 4; // 活跃飞机线条更粗
                    strokeDasharray = "none"; // 实线
                    activeIndex++;
                } else {
                    color = planningColors[planningIndex % planningColors.length];
                    strokeWidth = 2; // 计划飞机线条较细
                    strokeDasharray = "5,5"; // 虚线
                    planningIndex++;
                }

                // 绘制时间线
                flightGroup.selectAll("line")
                    .data(plannedResult.paths)
                    .enter()
                    .append("line")
                    .attr("x1", d => xScale(d.start_time))
                    .attr("x2", d => xScale(d.end_time))
                    .attr("y1", (d, j) => getYPosition(plannedResult.aircraft_id) + j * 3)
                    .attr("y2", (d, j) => getYPosition(plannedResult.aircraft_id) + j * 3)
                    .attr("stroke", color)
                    .attr("stroke-width", strokeWidth)
                    .attr("stroke-linecap", "round")
                    .attr("stroke-dasharray", strokeDasharray);

                // 添加起始点图标
                flightGroup.selectAll(".start-point")
                    .data(plannedResult.paths)
                    .enter()
                    .append("circle")
                    .attr("class", "start-point")
                    .attr("cx", d => xScale(d.start_time))
                    .attr("cy", (d, j) => getYPosition(plannedResult.aircraft_id) + j * 3)
                    .attr("r", plannedResult.type === 'active' ? 6 : 4)
                    .attr("fill", color)
                    .attr("stroke", "white")
                    .attr("stroke-width", 2);

                // 添加结束点图标
                flightGroup.selectAll(".end-point")
                    .data(plannedResult.paths)
                    .enter()
                    .append("circle")
                    .attr("class", "end-point")
                    .attr("cx", d => xScale(d.end_time))
                    .attr("cy", (d, j) => getYPosition(plannedResult.aircraft_id) + j * 3)
                    .attr("r", plannedResult.type === 'active' ? 6 : 4)
                    .attr("fill", plannedResult.type === 'active' ? color : "white")
                    .attr("stroke", color)
                    .attr("stroke-width", 2);

                // 为活跃飞机添加特殊标识（三角形）
                if (plannedResult.type === 'active') {
                    flightGroup.selectAll(".active-indicator")
                        .data(plannedResult.paths)
                        .enter()
                        .append("polygon")
                        .attr("class", "active-indicator")
                        .attr("points", d => {
                            const x = xScale(d.end_time);
                            const y = getYPosition(plannedResult.aircraft_id) - 10;
                            return `${x},${y} ${x - 5},${y - 8} ${x + 5},${y - 8}`;
                        })
                        .attr("fill", color)
                        .attr("stroke", "white")
                        .attr("stroke-width", 1);
                }

                // 为计划飞机添加特殊标识（方形）
                if (plannedResult.type === 'planning') {
                    flightGroup.selectAll(".planning-indicator")
                        .data(plannedResult.paths)
                        .enter()
                        .append("rect")
                        .attr("class", "planning-indicator")
                        .attr("x", d => xScale(d.end_time) - 4)
                        .attr("y", getYPosition(plannedResult.aircraft_id) - 14)
                        .attr("width", 8)
                        .attr("height", 8)
                        .attr("fill", "white")
                        .attr("stroke", color)
                        .attr("stroke-width", 2);
                }
            });

            // 定义绘制 overlaps 的函数（节点与滑行道重叠高亮与连接）
            const drawOverlaps = (g, overlaps, xScale, getYPosition, aircraftIds) => {
                // 只要 nodes 或 taxiways 有数据就绘制
                const hasTaxiways = overlaps && Array.isArray(overlaps.taxiways) && overlaps.taxiways.length > 0;
                const hasNodes = overlaps && Array.isArray(overlaps.nodes) && overlaps.nodes.length > 0;
                if (!(hasTaxiways || hasNodes)) return;

                const overlapLayer = g.append('g')
                    .attr('class', 'overlap-layer')
                    .attr('pointer-events', 'none');
                const groupColor = d3.scaleOrdinal(d3.schemeTableau10);

                // 在根 SVG 上定义圆角箭头标记（仅创建一次）
                const svgRoot = d3.select(g.node().ownerSVGElement);
                let defs = svgRoot.select('defs');
                if (defs.empty()) defs = svgRoot.append('defs');
                // 倒钩/燕尾（chevron）箭头标记
                let chevronMarker = defs.select('#overlap-chevron-arrow');
                if (chevronMarker.empty()) {
                    chevronMarker = defs.append('marker')
                        .attr('id', 'overlap-chevron-arrow')
                        .attr('viewBox', '0 -10 20 20')
                        .attr('refX', 19) // 箭头尖端位置靠近右端
                        .attr('refY', 0)
                        .attr('markerWidth', 20)
                        .attr('markerHeight', 20)
                        .attr('orient', 'auto')
                        .attr('markerUnits', 'userSpaceOnUse');

                    // 燕尾/倒钩箭头：尾部有缺口，视觉更尖锐
                    // 形状说明：
                    // M0,-8  从左下开始
                    // L12,-3 到箭身上边
                    // L20,0  箭尖
                    // L12,3  箭身下边
                    // L0,8   左上
                    // L4,0   回到尾部中点形成燕尾缺口
                    // Z      闭合路径
                    chevronMarker.append('path')
                        .attr('d', 'M0,-8 L12,-3 L20,0 L12,3 L0,8 L4,0 Z')
                        .attr('fill', 'context-stroke')
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 2.5)
                        .attr('stroke-linejoin', 'round')
                        .attr('stroke-linecap', 'round')
                        .attr('opacity', 0.98);
                }

                const toMinutes = (v) => {
                    const num = Number(v) || 0;
                    return num / 60; // 后端秒 -> 前端分钟
                };

                // 绘制滑行道重叠
                (overlaps.taxiways || []).forEach((twGroup, idx) => {
                    const color = groupColor(idx);
                    const flightWindows = Array.isArray(twGroup.flight_windows) ? twGroup.flight_windows : [];

                    console.log('flightwindows',flightWindows);


                    // 按行顺序排序，便于连接线依次连接
                    const sortedFW = flightWindows.slice().sort((a, b) => {
                        return aircraftIds.indexOf(a.flight_id) - aircraftIds.indexOf(b.flight_id);
                    });

                    console.log('sorted',sortedFW);

                    // 高亮每个飞机在该滑行道上的时间段
                    sortedFW.forEach((fw) => {
                        const fid = fw.flight_id;
                        const y = getYPosition(fid);
                        const startMin = toMinutes(fw?.time_window?.start ?? 0);
                        const endMin = toMinutes(fw?.time_window?.end ?? fw?.time_window?.start ?? 0);
                        const x1 = xScale(startMin);
                        const x2 = xScale(endMin);
                        const bandHeight = 8;

                        // 零长度时间窗画为点，非零画为半透明矩形
                        if (Math.abs(endMin - startMin) < 1e-6) {
                            overlapLayer.append('circle')
                                .attr('class', 'overlap-point')
                                .attr('cx', x1)
                                .attr('cy', y)
                                .attr('r', 5)
                                .attr('fill', color)
                                .attr('opacity', 0.7)
                                .attr('stroke', '#fff')
                                .attr('stroke-width', 1);
                        } else {
                            overlapLayer.append('rect')
                                .attr('class', 'overlap-segment')
                                .attr('x', Math.min(x1, x2))
                                .attr('y', y - bandHeight / 2)
                                .attr('width', Math.max(2, Math.abs(x2 - x1)))
                                .attr('height', bandHeight)
                                .attr('rx', 3)
                                .attr('fill', color)
                                .attr('opacity', 0.25)
                                .attr('stroke', color)
                                .attr('stroke-width', 1);
                        }
                    });

                    // 连接重叠飞机的端点：相向则连接最近端点并画相对箭头；同向保持原连接
                    for (let i = 0; i < sortedFW.length - 1; i++) {
                        const a = sortedFW[i];
                        const b = sortedFW[i + 1];

                        const aStartMin = toMinutes(a?.time_window?.start ?? 0);
                        const aEndMin = toMinutes(a?.time_window?.end ?? a?.time_window?.start ?? 0);
                        const bStartMin = toMinutes(b?.time_window?.start ?? 0);
                        const bEndMin = toMinutes(b?.time_window?.end ?? b?.time_window?.start ?? 0);

                        const axStart = xScale(aStartMin);
                        const axEnd = xScale(aEndMin);
                        const bxStart = xScale(bStartMin);
                        const bxEnd = xScale(bEndMin);
                        const ay = getYPosition(a.flight_id);
                        const by = getYPosition(b.flight_id);

                        const aDir = aEndMin - aStartMin;
                        const bDir = bEndMin - bStartMin;
                        const isOpposing = (aDir * bDir) < 0;

                        if (isOpposing) {
                            // 相向：在四种端点组合中选择距离最近的一对
                            const candidates = [
                                { ax: axStart, ay, bx: bxStart, by, dist: Math.abs(aStartMin - bStartMin), label: 'start-start' },
                                { ax: axStart, ay, bx: bxEnd,   by, dist: Math.abs(aStartMin - bEndMin),   label: 'start-end'   },
                                { ax: axEnd,   ay, bx: bxStart, by, dist: Math.abs(aEndMin   - bStartMin), label: 'end-start'   },
                                { ax: axEnd,   ay, bx: bxEnd,   by, dist: Math.abs(aEndMin   - bEndMin),   label: 'end-end'     },
                            ];
                            const best = candidates.reduce((m, p) => p.dist < m.dist ? p : m, candidates[0]);

                            let xLeft = best.ax, yLeft = best.ay, xRight = best.bx, yRight = best.by;
                            if (xLeft > xRight) {
                                xLeft = best.bx; yLeft = best.by;
                                xRight = best.ax; yRight = best.ay;
                            }

                            // 由两段曲线组成，每段末端绘制指向中点的箭头
                            const mx = (xLeft + xRight) / 2;
                            const my = (yLeft + yRight) / 2;

                            // 为保证箭头方向与曲线末端切线一致，使用对称控制点：
                            // P1 在起点沿指向中点方向偏移，P2 在终点（中点）沿相同方向反向偏移
                            const lx = mx - xLeft;
                            const ly = my - yLeft;
                            const llen = Math.sqrt(lx * lx + ly * ly) || 1;
                            const lux = lx / llen;
                            const luy = ly / llen;
                            const lHandle = Math.min(40, llen * 0.35);
                            const l1x = xLeft + lux * lHandle;
                            const l1y = yLeft + luy * lHandle;
                            const l2x = mx - lux * lHandle;
                            const l2y = my - luy * lHandle;

                            const rx = mx - xRight;
                            const ry = my - yRight;
                            const rlen = Math.sqrt(rx * rx + ry * ry) || 1;
                            const rux = rx / rlen;
                            const ruy = ry / rlen;
                            const rHandle = Math.min(40, rlen * 0.35);
                            const r1x = xRight + rux * rHandle;
                            const r1y = yRight + ruy * rHandle;
                            const r2x = mx - rux * rHandle;
                            const r2y = my - ruy * rHandle;

                            // 左段曲线（到中点）
                            overlapLayer.append('path')
                                .attr('class', `overlap-connector opposing-left ${best.label}`)
                                .attr('d', `M${xLeft},${yLeft} C${l1x},${l1y} ${l2x},${l2y} ${mx},${my}`)
                                .attr('stroke', color)
                                .attr('stroke-width', 1.5)
                                .attr('fill', 'none')
                                .attr('opacity', 0.8)
                                .attr('marker-end', 'url(#overlap-chevron-arrow)');

                            // 右段曲线（到中点）
                            overlapLayer.append('path')
                                .attr('class', `overlap-connector opposing-right ${best.label}`)
                                .attr('d', `M${xRight},${yRight} C${r1x},${r1y} ${r2x},${r2y} ${mx},${my}`)
                                .attr('stroke', color)
                                .attr('stroke-width', 1.5)
                                .attr('fill', 'none')
                                .attr('opacity', 0.8)
                                .attr('marker-end', 'url(#overlap-chevron-arrow)');
                        } else {
                            // 同向：比较两个飞机的 start，选 start 较大的为 aLate，另一架为 bEarly；
                            // 绘制从 aLate 的 end 指向 bEarly 的 end 的箭头曲线（箭头指向 bEarly）。
                            const aIsLate = aStartMin >= bStartMin;
                            const aLateEndMin = aIsLate ? aEndMin : bEndMin;
                            const bEarlyEndMin = aIsLate ? bEndMin : aEndMin;
                            const aLateY = aIsLate ? ay : by;
                            const bEarlyY = aIsLate ? by : ay;
                            const xFrom = xScale(aLateEndMin);
                            const xTo = xScale(bEarlyEndMin);

                            // 使用平滑的贝塞尔曲线，控制点位于两行的中线，避免遮挡
                            const midY = (ay + by) / 2;
                            const c1x = xFrom, c1y = midY;
                            const c2x = xTo,   c2y = midY;

                            overlapLayer.append('path')
                                .attr('class', 'overlap-connector same-direction end-to-end')
                                .attr('d', `M${xFrom},${aLateY} C${c1x},${c1y} ${c2x},${c2y} ${xTo},${bEarlyY}`)
                                .attr('stroke', color)
                                .attr('stroke-width', 1.8)
                                .attr('fill', 'none')
                                .attr('opacity', 0.85)
                                .attr('marker-end', 'url(#overlap-chevron-arrow)')
                                .style('color', color);
                        }
                    }

                    // 在组首部标注涉及的滑行道ID（可选）
                    // 将图例标签移动到时间线右侧的空白区域，并按索引竖排，避免遮挡
                    const labelX = (xScale.range && xScale.range()[1] !== undefined)
                        ? xScale.range()[1] + 10
                        : xScale(xScale.domain()[1]) + 10;
                    const labelY = 12 + idx * 14;
                    overlapLayer.append('text')
                        .attr('class', 'overlap-label')
                        .attr('x', labelX)
                        .attr('y', labelY)
                        .attr('text-anchor', 'start')
                        .attr('fill', color)
                        .attr('font-size', '10px')
                        .attr('font-weight', 'bold')
                        .text(`${(twGroup.taxiway_ids || []).join(',')}`);
                });

                // 绘制节点重叠：连接两架飞机的 start，改为带“一个卷”的卷曲线（在中点处形成一个卷）
                const nodeLayer = g.append('g')
                    .attr('class', 'overlap-node-layer')
                    .attr('pointer-events', 'none');
                (overlaps.nodes || []).forEach((nodeGroup, nidx) => {
                    const color = groupColor(100 + nidx);
                    const flightWindows = Array.isArray(nodeGroup.flight_windows)
                        ? nodeGroup.flight_windows
                        : (Array.isArray(nodeGroup.flights) ? nodeGroup.flights : []);

                    // 只处理至少两架飞机
                    const sortedFW = flightWindows.slice().sort((a, b) => {
                        return aircraftIds.indexOf(a.flight_id) - aircraftIds.indexOf(b.flight_id);
                    });
                    if (sortedFW.length < 2) return;

                    for (let i = 0; i < sortedFW.length - 1; i++) {
                        const a = sortedFW[i];
                        const b = sortedFW[i + 1];
                        const aStartMin = toMinutes(a?.time_window?.start ?? 0);
                        const bStartMin = toMinutes(b?.time_window?.start ?? 0);
                        const ax = xScale(aStartMin);
                        const bx = xScale(bStartMin);
                        const ay = getYPosition(a.flight_id);
                        const by = getYPosition(b.flight_id);
                        // 生成一个带“卷”的卷曲线：在中点处形成单个环，然后继续到终点
                        const mx = (ax + bx) / 2;
                        const my = (ay + by) / 2;

                        // 方向与垂直向量（用于在中点构造卷）
                        const dvx = bx - ax;
                        const dvy = by - ay;
                        const dlen = Math.sqrt(dvx * dvx + dvy * dvy) || 1;
                        const ux = dvx / dlen, uy = dvy / dlen; // 方向
                        const px = -uy, py = ux;                // 垂直

                        // 卷的半径与入口/出口点（相对中点）
                        const r = Math.min(10, dlen * 0.12);
                        const loopOffset = Math.min(12, dlen * 0.2); // 控制入口/出口与中点的距离
                        const entryX = mx - ux * loopOffset + px * r;
                        const entryY = my - uy * loopOffset + py * r;
                        const exitX  = mx + ux * loopOffset - px * r;
                        const exitY  = my + uy * loopOffset - py * r;
                        const leftX  = mx - px * r;
                        const leftY  = my - py * r;
                        const rightX = mx + px * r;
                        const rightY = my + py * r;

                        // 起点控制手柄与终点控制手柄（使连接更顺畅）
                        const h = Math.min(40, dlen * 0.35);
                        const s1x = ax + ux * h;
                        const s1y = ay + uy * h;
                        const e2x = bx - ux * h;
                        const e2y = by - uy * h;

                        // 路径由三段组成：起点到入口的平滑曲线 + 中点处的完整单圈 + 出口到终点的平滑曲线
                        const pathD = [
                            `M${ax},${ay}`,
                            `C${s1x},${s1y} ${entryX - px * (h * 0.25)},${entryY - py * (h * 0.25)} ${entryX},${entryY}`,
                            `A${r},${r} 0 1 1 ${rightX},${rightY}`,
                            `A${r},${r} 0 1 1 ${leftX},${leftY}`,
                            `C${exitX + px * (h * 0.25)},${exitY + py * (h * 0.25)} ${e2x},${e2y} ${bx},${by}`
                        ].join(' ');

                        nodeLayer.append('path')
                            .attr('class', 'overlap-node-connector start-to-start curl-one')
                            .attr('d', pathD)
                            .attr('stroke', color)
                            .attr('stroke-width', 1.5)
                            .attr('fill', 'none')
                            .attr('opacity', 0.9)
                            .attr('stroke-linejoin', 'round')
                            .attr('stroke-linecap', 'round');
                    }
                });
            };

            // 绘制模拟数据时间线
            drawSimulationTimelines(g, simulationResults, xScale, getYPosition, simulationColors);
            // 绘制 overlaps（根据系统状态中的节点/滑行道重叠）
            drawOverlaps(g, websocketStore.overlaps, xScale, getYPosition, aircraftIds);


            // 1. 柱状图参数
            const barWidth = 12;
            const barGap = 4;
            const barChartHeight = 80; // 增加柱状图最大高度
            const barChartOffset = -150; // 增加柱状图距离主图的偏移
            const blockWidth = 10; // 每个块的宽度
            const blockGap = 2; // 块之间的间隙

            // 2. 柱状图比例尺
            const maxBarValue = Math.max(...left_times, ...plan_times, ...fly_times);
            const barScale = d3.scaleLinear()
                .domain([0, maxBarValue])
                .range([0, maxBarValue * (blockWidth + blockGap)]);

            // 3. 绘制柱状图
            const barGroup = svg.append("g")
                .attr("transform", `translate(${margin.left + barChartOffset},${margin.top})`);

            // 定义更新时间线的函数
            const updateTimelineForAircraft = (aircraftId, newStartTime, taxiTime) => {
                // 查找对应的飞机时间线元素

                const flightGroup = g.select(`#flight-${aircraftId}`);
                if (flightGroup.empty()) return;

                // 更新时间线的起始和结束位置
                flightGroup.selectAll("line")
                    .attr("x1", xScale(newStartTime))
                    .attr("x2", xScale(newStartTime + taxiTime));

                // 更新起始点位置
                flightGroup.selectAll(".start-point")
                    .attr("cx", xScale(newStartTime));

                // 更新结束点位置
                flightGroup.selectAll(".end-point")
                    .attr("cx", xScale(newStartTime + taxiTime));

                // 更新计划飞机的特殊标识位置
                flightGroup.selectAll(".planning-indicator")
                    .attr("x", xScale(newStartTime + taxiTime) - 4);
            };
            const updateFlightTime = (aircraftId, deltaTimeInSeconds) => {
                const adjustedDelta = deltaTimeInSeconds + (deltaTimeInSeconds < 0 ? -1 : (deltaTimeInSeconds > 0 ? 1 : 0));

    // 发送调整后的秒数到后端
    websocketStore.adjustFlightTime(aircraftId, adjustedDelta*60);
            };
            // 添加d3拖拽行为定义
          // 假设：barScale 是 d3.scaleLinear().domain([0, totalTimelineInSeconds]).range([0, width]).clamp(true)

const createTaxiSliderDrag = (aircraftId, taxiTime, totalTimeToTakeoff, {
  containerSelector,   // 容器选择器或节点（建议是包裹滑块的 <g>）
  handleMinWidth = 10, // 命中区下限（像素），小于该值会用透明命中扩大
  snapStep = 1,        // 结束时吸附步长（秒），可改为 0.5/0.2 提升手感
  useRaf = true        // 是否用 rAF 合并更新
} = {}) => {
  let dragOffset = 0;                // 鼠标相对元素左边缘的偏移
  let originalStartTimeSec = null;   // 拖拽开始时的原始秒
  let frameReq = null;               // rAF 句柄

  // 定位容器：用于 drag.container，确保 event.x/y 相对该容器
  const container = typeof containerSelector === 'string'
    ? d3.select(containerSelector)
    : d3.select(containerSelector);

  const minX = 0;
  const maxX = barScale(totalTimeToTakeoff - taxiTime); // 防止滑块越过起飞窗口

  // 工具函数：像素夹紧
  const clampX = (x) => Math.max(minX, Math.min(x, maxX));

  const updateX = (el, x) => {
    const apply = () => el.attr("x", x);
    if (useRaf) {
      if (frameReq) cancelAnimationFrame(frameReq);
      frameReq = requestAnimationFrame(apply);
    } else {
      apply();
    }
  };

  return d3.drag()
    .container(container.node()) // 统一坐标系，后续用 event.x
    .on("start", function (event) {
      const el = d3.select(this);

      // 扩大命中区（如果太窄）
      const bbox = this.getBBox();
      if (bbox.width < handleMinWidth) {
        el.attr("pointer-events", "all"); // 确保能点中
      }

      el.attr("cursor", "grabbing");

      const currentX = parseFloat(el.attr("x")) || 0;
      // 记录“鼠标相对元素”的偏移，避免开拖瞬移
      dragOffset = event.x - currentX;

      // 用比例尺反算初始秒
      originalStartTimeSec = Math.round(barScale.invert(currentX));

      // 暂停外部数据写入
      websocketStore.setDraggingState(true, aircraftId);
    })
    .on("drag", function (event) {
      const el = d3.select(this);

      // 基于偏移计算新像素位置（连续）
      let newX = clampX(event.x - dragOffset);
      updateX(el, newX);

      // 实时更新（连续秒）——提升手感：只在 UI 上连续更新
      const newStartSec = barScale.invert(newX);

      // 这里不要四舍五入，保持连续，避免“吸附抖”
      updateTimelineForAircraft(aircraftId, /* newStartTime= */ newStartSec, taxiTime);
    })
    .on("end", function () {
      const el = d3.select(this);
      el.attr("cursor", "grab");

      // 最终像素与秒
      const finalX = clampX(parseFloat(el.attr("x")) || 0);

      // 在结束时做“温和吸附”（秒级或半秒）
      const snappedStartSec = Math.round(barScale.invert(finalX) / snapStep) * snapStep;
      const snappedX = clampX(barScale(snappedStartSec));
      el.attr("x", snappedX); // 回写到吸附后的位置

      const deltaTimeSec = snappedStartSec - originalStartTimeSec;

      // 更新数据模型（一次性、离散）
      const aircraftData = plannedResults.find(r => r.aircraft_id === aircraftId);
      if (aircraftData) {
        const s = snappedStartSec; // 统一用秒
        aircraftData.time_to_start = s;
        if (aircraftData.paths && aircraftData.paths[0]) {
          aircraftData.paths[0].start_time = s;
          aircraftData.paths[0].end_time   = s + taxiTime;
        }
      }

      websocketStore.setDraggingState(false, null);

      if (deltaTimeSec !== 0) {
        updateFlightTime(aircraftId, deltaTimeSec);
      }

      console.log(`飞机 ${aircraftId} 拖拽完成，时间变化: ${deltaTimeSec} 秒`);

      // 清理 rAF
      if (frameReq) {
        cancelAnimationFrame(frameReq);
        frameReq = null;
      }
    });
};


            aircraftIds.forEach((id, i) => {

                const yBase = getYPosition(id) - barWidth / 2; // 柱状图纵向中心

                // 找到对应的飞机数据以确定类型

                // 查找当前id的所有数据
                const allAircraftData = plannedResults.filter(result => result.aircraft_id === id);

                // 如果有active类型的数据就使用active的,否则使用planning的
                const aircraftData = allAircraftData.find(data => data.type === 'active') || allAircraftData[0];
                // console.log('aircraftData---------------',aircraftData);

                const isActive = aircraftData && aircraftData.type === 'active';
                // console.log('isActive', id,'i:',i,':',isActive,'data',aircraftData,'data2',left_times[i],plan_times[i],fly_times[i]);


                // 根据飞机类型设置柱状图颜色和样式
                const leftTimeColor = isActive ? "#FF6B6B" : "#4ECDC4"; // 活跃飞机用暖色，计划飞机用冷色
                const planTimeColor = isActive ? "#FF8E53" : "#45B7D1";
                const barOpacity = isActive ? 0.8 : 0.6; // 活跃飞机更不透明


                // plan_time 柱（计划时间）- 为非活跃飞机添加拖拽功能
                if (plan_times[i] > 0) {

                    if (!isActive) {
                        // 非活跃飞机：创建可拖拽的滑块
                        const planBarGroup = barGroup.append("g")
                            .attr("class", `plan-bar-group-${id}`);

                        // 绘制背景轨道（显示总的time_to_takeoff范围）
                        const totalTimeToTakeoff = fly_times[i];
                        const totalBlocks = Math.ceil(totalTimeToTakeoff); // 计算
                        // 使用数据绑定创建背景块
                        planBarGroup.selectAll(".time-track-block")
                            .data(d3.range(totalBlocks))
                            .enter()
                            .append("rect")
                            .attr("class", "time-track-block")
                            .attr("x", d => d * (blockWidth + blockGap))
                            .attr("y", yBase)
                            .attr("width", blockWidth)
                            .attr("height", barWidth)
                            .attr("fill", "#f0f0f0")
                            .attr("stroke", "#d0d0d0")
                            .attr("stroke-width", 1)
                            .attr("rx", 2);


                        // 计算当前taxi_time滑块的位置
                        const currentStartTime = left_times[i] || 0;
                        const taxiTime = aircraftData.taxi_time || plan_times[i];
                        // 计算滑块的起始和结束块索引
                        const startBlock = Math.floor(currentStartTime);
                        const endBlock = Math.ceil(currentStartTime + taxiTime);
                        const sliderBlocks = endBlock - startBlock;
                        // 绘制可拖拽的taxi_time滑块
                        const taxiSlider = planBarGroup.append("rect")
                            .attr("class", `taxi-slider-${id}`)
                            .attr("x", startBlock * (blockWidth + blockGap))
                            .attr("y", yBase)
                            .attr("width", sliderBlocks * (blockWidth + blockGap) - blockGap)
                            .attr("height", barWidth)
                            .attr("fill", planTimeColor)
                            .attr("opacity", barOpacity)
                            .attr("cursor", "grab")
                            .attr("rx", 2)
                            // 应用d3拖拽行为
                            .call(createTaxiSliderDrag(id, taxiTime, totalTimeToTakeoff));

                    }
                    else {
                        // 活跃飞机：绘制灰色背景条(time_to_takeoff)和彩色滑块(remaining-taxi-time)


                        const activeBarGroup = barGroup.append("g")
                            .attr("class", `active-bar-group-${id}`);

                        // 获取活跃飞机的time_to_takeoff数据
                        const timeToTakeoffMinutes = (aircraftData.time_to_takeoff || 0); // 转换为分钟
                        const remainingTimeMinutes = aircraftData.plan_time; // 剩余滑行时间
                        const totalBlocks = Math.ceil(timeToTakeoffMinutes);
                        const remainingBlocks = Math.ceil(remainingTimeMinutes);

                        //绘制背景轨道
                        activeBarGroup.selectAll(".active-time-track-block")
                            .data(d3.range(totalBlocks))
                            .enter()
                            .append("rect")
                            .attr("class", "active-time-track-block")
                            .attr("x", d => d * (blockWidth + blockGap))
                            .attr("y", yBase)
                            .attr("width", blockWidth)
                            .attr("height", barWidth)
                            .attr("fill", "#f0f0f0")
                            .attr("stroke", "#d0d0d0")
                            .attr("stroke-width", 1)
                            .attr("rx", 2);

                        // 绘制剩余滑行时间滑块（从0开始，长度为remaining-taxi-time）
                        // 绘制剩余滑行时间滑块
                        activeBarGroup.selectAll(".remaining-slider-block")
                            .data(d3.range(remainingBlocks))
                            .enter()
                            .append("rect")
                            .attr("class", "remaining-slider-block")
                            .attr("x", d => d * (blockWidth + blockGap))
                            .attr("y", yBase)
                            .attr("width", blockWidth)
                            .attr("height", barWidth)
                            .attr("fill", planTimeColor)
                            .attr("opacity", barOpacity)
                            .attr("rx", 2);

                        // // 添加活跃飞机标识
                        // activeBarGroup.append("text")
                        //     .attr("x", barScale(remainingTimeMinutes / 2))
                        //     .attr("y", yBase + barWidth / 2 + 3)
                        //     .attr("text-anchor", "middle")
                        //     .attr("font-size", "10px")
                        //     .attr("fill", "white")
                        //     .attr("pointer-events", "none")
                        //     .text("●"); // 圆点表示活跃状态
                    }

                    // 添加拖拽提示图标
                    // planBarGroup.append("text")
                    //     .attr("x", barScale(currentStartTime + taxiTime / 2))
                    //     .attr("y", yBase + barWidth / 2 + 3)
                    //     .attr("text-anchor", "middle")
                    //     .attr("font-size", "10px")
                    //     .attr("fill", "white")
                    //     .attr("pointer-events", "none")
                    //.text("⟷"); // 双向箭头表示可拖拽
                }

            });



            // 添加图例
            const legendGroup = svg.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${width - margin.right + 10}, 30)`)
                .attr('pointer-events', 'none'); // 禁用交互，避免遮挡

            // 图例背景 - 增加高度以容纳模拟数据图例
            legendGroup.append("rect")
                .attr("x", -10)
                .attr("y", -10)
                .attr("width", 200)
                .attr("height", 200)
                .attr("fill", "none") // 背景透明，避免遮挡时间线
                .attr("stroke", "#ccc")
                .attr("stroke-width", 1)
                .attr("rx", 5);

            // 图例标题
            legendGroup.append("text")
                .attr("x", 0)
                .attr("y", 10)
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .attr("fill", "#333")
                .text("飞机类型");

            // Active Aircraft 图例
            const activeLegend = legendGroup.append("g")
                .attr("transform", "translate(0, 25)");

            activeLegend.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", "#FF6B6B")
                .attr("stroke-width", 4)
                .attr("stroke-linecap", "round");

            activeLegend.append("circle")
                .attr("cx", 20)
                .attr("cy", 0)
                .attr("r", 6)
                .attr("fill", "#FF6B6B")
                .attr("stroke", "white")
                .attr("stroke-width", 2);

            activeLegend.append("polygon")
                .attr("points", "20,0 15,-8 25,-8")
                .attr("fill", "#FF6B6B")
                .attr("stroke", "white")
                .attr("stroke-width", 1)
                .attr("transform", "translate(0, -10)");

            activeLegend.append("text")
                .attr("x", 35)
                .attr("y", 5)
                .attr("font-size", "12px")
                .attr("fill", "#333")
                .text("活跃飞机 (Active)");

            // Planning Aircraft 图例
            const planningLegend = legendGroup.append("g")
                .attr("transform", "translate(0, 55)");

            planningLegend.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", "#4ECDC4")
                .attr("stroke-width", 2)
                .attr("stroke-linecap", "round")
                .attr("stroke-dasharray", "5,5");

            planningLegend.append("circle")
                .attr("cx", 20)
                .attr("cy", 0)
                .attr("r", 4)
                .attr("fill", "white")
                .attr("stroke", "#4ECDC4")
                .attr("stroke-width", 2);

            planningLegend.append("rect")
                .attr("x", 16)
                .attr("y", -14)
                .attr("width", 8)
                .attr("height", 8)
                .attr("fill", "white")
                .attr("stroke", "#4ECDC4")
                .attr("stroke-width", 2);

            planningLegend.append("text")
                .attr("x", 35)
                .attr("y", 5)
                .attr("font-size", "12px")
                .attr("fill", "#333")
                .text("计划飞机 (Planning)");

            // 样式说明
            legendGroup.append("text")
                .attr("x", 0)
                .attr("y", 85)
                .attr("font-size", "10px")
                .attr("fill", "#666")
                .text("• 实线/粗线：活跃飞机");

            legendGroup.append("text")
                .attr("x", 0)
                .attr("y", 100)
                .attr("font-size", "10px")
                .attr("fill", "#666")
                .text("• 虚线/细线：计划飞机");

            // 模拟数据图例分隔线
            legendGroup.append("line")
                .attr("x1", 0)
                .attr("x2", 170)
                .attr("y1", 115)
                .attr("y2", 115)
                .attr("stroke", "#ddd")
                .attr("stroke-width", 1);

            // 模拟数据标题
            legendGroup.append("text")
                .attr("x", 0)
                .attr("y", 135)
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("fill", "#666")
                .text("模拟数据");

            // 模拟活跃飞机图例
            const simActiveGroup = legendGroup.append("g")
                .attr("transform", "translate(0, 150)");

            simActiveGroup.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", "#FF6B6B")
                .attr("stroke-width", 3)
                .attr("stroke-dasharray", "8,4")
                .attr("opacity", 0.7)
                .attr("stroke-linecap", "round");

            simActiveGroup.append("polygon")
                .attr("points", "0,0 -6,-6 6,-6")
                .attr("fill", "#FF6B6B")
                .attr("stroke", "white")
                .attr("stroke-width", 1)
                .attr("opacity", 0.7)
                .attr("transform", "translate(20, -8)");

            simActiveGroup.append("text")
                .attr("x", 35)
                .attr("y", 5)
                .attr("font-size", "11px")
                .attr("fill", "#666")
                .text("模拟活跃飞机");

            // 模拟计划飞机图例
            const simPlanGroup = legendGroup.append("g")
                .attr("transform", "translate(0, 170)");

            simPlanGroup.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", "#4ECDC4")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "8,4")
                .attr("opacity", 0.7)
                .attr("stroke-linecap", "round");

            simPlanGroup.append("polygon")
                .attr("points", "0,0 -4,-4 4,-4 4,4 -4,4")
                .attr("fill", "white")
                .attr("stroke", "#4ECDC4")
                .attr("stroke-width", 2)
                .attr("opacity", 0.7)
                .attr("transform", "translate(20, -8)");

            simPlanGroup.append("text")
                .attr("x", 35)
                .attr("y", 5)
                .attr("font-size", "11px")
                .attr("fill", "#666")
                .text("模拟计划飞机");

            // 在主图g上绘制冲突点和连接线
            // 注意：冲突数据现在通过独立的autorun处理，这里不再处理冲突绘制
            // 冲突数据分别来自websocketStore.current_conflicts和websocketStore.future_conflicts
            // 由updateConflictData函数统一处理，支持不同样式配置

            // 保存绘图相关变量到d3Container，供冲突更新函数使用
            d3Container.current = {
                xScale,
                getYPosition,
                aircraftIds,
                svg,
                g: g.append("g").attr("class", "main-group") // 创建主绘图组
            };

            // 将现有的绘图内容移动到主绘图组中
            const mainGroup = d3Container.current.g;

            // 在重新绘制图表后，重新绘制冲突数据以确保带状图形不会消失
            // setTimeout(() => {
            //     // 重新绘制当前冲突
            //     if (websocketStore.current_conflicts && Array.isArray(websocketStore.current_conflicts)) {
            //         const currentConflictStyles = {
            //             pointColor: '#ff4d4f',
            //             pointRadius: 6,
            //             lineColor: '#ff4d4f',
            //             lineWidth: 3,
            //             lineDashArray: '5,5',
            //             opacity: 0.9,
            //             textColor: '#ff4d4f',
            //             fontSize: '11px',
            //             fontWeight: 'bold'
            //         };
            //         updateConflictData(websocketStore.current_conflicts, 'current', currentConflictStyles);
            //     }
                
            //     // 重新绘制未来冲突
            //     if (websocketStore.future_conflicts && Array.isArray(websocketStore.future_conflicts)) {
            //         const futureConflictStyles = {
            //             pointColor: '#fa8c16',
            //             pointRadius: 5,
            //             lineColor: '#fa8c16',
            //             lineWidth: 2,
            //             lineDashArray: '3,3',
            //             opacity: 0.7,
            //             textColor: '#fa8c16',
            //             fontSize: '10px',
            //             fontWeight: 'normal'
            //         };
            //         updateConflictData(websocketStore.future_conflicts, 'future', futureConflictStyles);
            //     }
            // }, 100); // 短暂延迟确保主图表绘制完成

        };

        //这里的逻辑应该是前端按按钮向后端传要规划的飞机id,后端返回结果
        const disposer = autorun(() => {
            if (websocketStore.plannedFlights &&
                Object.keys(websocketStore.plannedFlights).length > 0) {

                // 构建完整的数据结构传递给updatePlanningView
                const completeData = {
                    planned_flights: websocketStore.plannedFlights || {},
                    active_flights: websocketStore.activeFlights || {},
                    conflicts: websocketStore.conflicts || []
                };

                // console.log("Planned Path:", JSON.stringify(websocketStore.plannedPath));
                console.log("Planned Flights:", websocketStore.plannedFlights);
                console.log("Active Flights:", websocketStore.activeFlights);
                console.log("Complete Data:", completeData);

                // 使用新的数据格式更新视图
                updatePlanningView(completeData);

            }
            else {
                console.log("WebSocket data not received, using test data...");

            }

        });


        // 更新冲突数据
        // const disposer2 = autorun(() => {
        //     console.log("=== 冲突数据 autorun 触发 ===");
        //     console.log("websocketStore.current_conflicts:", websocketStore.current_conflicts);
        //     console.log("websocketStore.future_conflicts:", websocketStore.future_conflicts);

        //     // 处理当前冲突数据
        //     if (websocketStore.current_conflicts && Array.isArray(websocketStore.current_conflicts)) {
        //         console.log("更新当前冲突数据，数量:", websocketStore.current_conflicts.length);
                
        //         // 使用红色样式配置处理当前冲突
        //         const currentConflictStyles = {
        //             pointColor: '#ff4d4f',
        //             pointRadius: 6,
        //             lineColor: '#ff4d4f',
        //             lineWidth: 3,
        //             lineDashArray: '5,5',
        //             opacity: 0.9,
        //             textColor: '#ff4d4f',
        //             fontSize: '11px',
        //             fontWeight: 'bold'
        //         };
                
        //         updateConflictData(websocketStore.current_conflicts, 'current', currentConflictStyles);
        //     } else {
        //         console.log("没有当前冲突数据或数据格式错误");
        //         // 清除当前冲突的显示
        //         updateConflictData([], 'current');
        //     }

        //     // 处理未来冲突数据
        //     if (websocketStore.future_conflicts && Array.isArray(websocketStore.future_conflicts)) {
        //         console.log("更新未来冲突数据，数量:", websocketStore.future_conflicts.length);
                
        //         // 使用橙色样式配置处理未来冲突
        //         const futureConflictStyles = {
        //             pointColor: '#fa8c16',
        //             pointRadius: 5,
        //             lineColor: '#fa8c16',
        //             lineWidth: 2,
        //             lineDashArray: '3,3',
        //             opacity: 0.7,
        //             textColor: '#fa8c16',
        //             fontSize: '10px',
        //             fontWeight: 'normal'
        //         };
                
        //         updateConflictData(websocketStore.future_conflicts, 'future', futureConflictStyles);
        //     } else {
        //         console.log("没有未来冲突数据或数据格式错误");
        //         // 清除未来冲突的显示
        //         updateConflictData([], 'future');
        //     }
        // })

        return () => {
            // 清理函数
            disposer();
            // disposer2();
        };
    }, []);



    // 表格容器滚动处理函数
    const handleTableContainerScroll = (e) => {
        const { scrollTop } = e.target;
        if (chartRef.current) {
            chartRef.current.scrollTop = scrollTop;
        }
    };

    const handleChartScroll = (e) => {
        const { scrollTop } = e.target;
        if (tableRef.current) {
            // 直接设置表格容器的滚动位置
            tableRef.current.scrollTop = scrollTop;
        }
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden', // 防止出现滚动条
            padding: '10px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                display: 'flex',
                width: '100%',
                height: '100%', // 减去按钮的高度
                gap: '10px'
            }}>
                {/* 左侧表格 - 使用SVG表格替换Ant Design Table */}
                <div
                    style={{
                        width: '40%',
                        height: '100%',
                        overflowX: 'hidden'
                    }}
                >
                    <SVGTable
                        columns={columns}
                        dataSource={tableDataSource}
                        rowHeight={ROW_HEIGHT}
                        headerHeight={HEADER_HEIGHT}
                        onScroll={handleTableContainerScroll}
                        tableRef={tableRef}
                    />
                </div>

                {/* 右侧图表 */}
                <div
                    ref={chartRef}
                    onScroll={handleChartScroll}
                    className={styles.hideScrollbar}
                    style={{
                        width: '60%',
                        height: '100%',
                        overflow: 'auto',
                        // backgroundColor:'red'
                    }}
                >
                    <svg
                        ref={svgRef}
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${width} ${height}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            display: 'block',

                        }}
                    >
                    </svg>
                </div>
            </div>
        </div>
    );
})

export default PlanningView;