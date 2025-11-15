import React, { useEffect, useRef, useState, useContext } from 'react';
import { useI18n } from '@/i18n/LanguageProvider';
import websocketStore from '@/stores/WebSocketStore';
import { observer } from 'mobx-react';
import { autorun } from 'mobx';
import * as d3 from 'd3';
import { Table } from 'antd';
import { createStyles } from 'antd-style';
import { AIRCRAFT_COLORS, CONFLICT_COLORS, STRATEGY_COLORS, SIMULATION_COLORS, TIMELINE_STYLES } from '@/constants/colors';

// 统一底部额外空间，保证左右内容高度一致
const EXTRA_BOTTOM_SPACE = 200;

// 连线样式配置常量
const CONNECTION_LINE_WIDTH = 8;  // 统一连线宽度
const CONNECTION_LINE_OPACITY = 0.15;  // 统一连线透明度
const ARROW_FILL_OPACITY = 0.4;  // 箭头填充半透明，但比线更不透明
const ARROW_GAP_PX = 10; // 箭头与连线端点的间隔，避免重叠
const ARROW_TIP_X = 10; // 箭头尖端的 x 坐标，缩短箭头长度（原为 16）

// 时间线端点圆半径常量
const TIMELINE_POINT_RADIUS = 4;  // 统一时间线端点圆半径

// Overlap 类型颜色常量（集中管理相向/同向/交叉的颜色）
const OVERLAP_COLORS = {
    OPPOSITE: CONFLICT_COLORS.OPPOSITE,
    SAME_DIRECTION: CONFLICT_COLORS.SAME_DIRECTION,
    CROSSING: CONFLICT_COLORS.CROSSING,
};

// 冲突点圆半径常量
const CONFLICT_POINT_RADIUS_CURRENT = 6;  // 当前冲突点半径
const CONFLICT_POINT_RADIUS_FUTURE = 6;   // 未来冲突点半径

// SVG表格组件（圆角矩形独立行，保留表头与行内分割）
const SVGTable = ({ columns, dataSource, rowHeight, headerHeight, onScroll, tableRef, className }) => {
    const svgTableRef = useRef();
    const containerRef = useRef();

    // 计算表格尺寸（将表头与主体拆分，主体高度不再包含表头）
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const bodyHeight = dataSource.length * rowHeight + EXTRA_BOTTOM_SPACE;

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
            return record.status === 'normal' ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING;
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
            className={`svg-table-container ${className || ''}`}
        >
            {/* 粘性表头：单独的 SVG，随滚动容器固定在顶部 */}
            <div
                className="svg-table-header"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: '#fafafa',
                    borderBottom: '1px solid #f0f0f0'
                }}
            >
                <svg
                    className="svg-table-header-svg"
                    width={tableWidth}
                    height={headerHeight}
                    style={{
                        display: 'block',
                        minWidth: tableWidth,
                        backgroundColor: '#fafafa'
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
                                {Array.isArray(column.title) ? (
                                    // 多行标题
                                    column.title.map((line, lineIndex) => (
                                        <text
                                            key={`header-line-${lineIndex}`}
                                            x={x + column.width / 2}
                                            y={headerHeight / 2 + (lineIndex - (column.title.length - 1) / 2) * 14}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize="11px"
                                            fontWeight="bold"
                                            fill="#000000"
                                        >
                                            {line}
                                        </text>
                                    ))
                                ) : (
                                    // 单行标题
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
                                )}

                                {/* 列分割线（仅表头范围）*/}
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
                </svg>
            </div>

            {/* 可滚动主体：仅渲染数据行 */}
            <svg
                ref={svgTableRef}
                className="svg-table-body"
                width={tableWidth}
                height={bodyHeight}
                style={{
                    display: 'block',
                    backgroundColor: 'transparent',
                    minWidth: tableWidth,
                }}
            >
                {/* 表格数据行 */}
                {dataSource.map((record, rowIndex) => {
                    const y = rowIndex * rowHeight;
                    const borderColor = record.status === 'normal' ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING;
                    const fillNormal = '#ffffff';
                    const fillHover = '#f5faff';
                    const rectX = 6;
                    const rectY = y + 4;
                    const rectW = tableWidth - 12;
                    const rectH = rowHeight - 8;
                    return (
                        <g key={`row-${rowIndex}`} data-flight-id={record.flight_id} className="svg-table-row">
                            {/* 圆角矩形行 */}
                            <rect
                                x={rectX}
                                y={rectY}
                                width={rectW}
                                height={rectH}
                                rx={4}
                                ry={4}
                                fill={fillNormal}
                                stroke={borderColor}
                                strokeWidth={1}
                                className="rounded-row"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={(e) => { e.target.setAttribute('fill', fillHover); }}
                                onMouseLeave={(e) => { e.target.setAttribute('fill', fillNormal); }}
                            />

                            {/* 行内列分割线与单元格文本 */}
                            {columns.map((column, colIndex) => {
                                const x = columns.slice(0, colIndex).reduce((sum, col) => sum + col.width, 0);
                                const value = record[column.dataIndex];
                                const displayText = formatDisplayText(column, record, value);
                                const textColor = getCellTextColor(column, record, value);

                                return (
                                    <g key={`cell-${rowIndex}-${colIndex}`}>
                                        {/* 单元格文本，居中显示在该列范围内 */}
                                        {Array.isArray(displayText) ? (
                                            // 多行文本渲染
                                            <text
                                                x={rectX + x + column.width / 2}
                                                y={y + rowHeight / 2 - 6} // 向上偏移以居中两行文本
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize="10px"
                                                fontWeight={column.key === 'flight_id' ? 'bold' : 'normal'}
                                                fill={textColor}
                                            >
                                                <tspan key="line-0" x={rectX + x + column.width / 2} dy="0">{displayText[0]}</tspan>
                                                <tspan key="line-1" x={rectX + x + column.width / 2} dy="12">{displayText[1]}</tspan>
                                            </text>
                                        ) : (
                                            // 单行文本渲染
                                            <text
                                                x={rectX + x + column.width / 2}
                                                y={y + rowHeight / 2}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize="12px"
                                                fontWeight={column.key === 'flight_id' ? 'bold' : 'normal'}
                                                fill={textColor}
                                            >
                                                {displayText}
                                            </text>
                                        )}

                                        {/* 行内列分割线（只在该行范围内绘制）*/}
                                        {colIndex < columns.length - 1 && (
                                            <line
                                                x1={rectX + x + column.width}
                                                y1={rectY}
                                                x2={rectX + x + column.width}
                                                y2={rectY + rectH}
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

                {/* 外层边框移除，保持简洁 */}
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
        // 更细、更透明、蓝色的自定义滚动条样式
        prettyScrollbar: css`
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background-color: rgba(24, 144, 255, 0.35);
            border-radius: 3px;
            border: 1px solid rgba(24, 144, 255, 0.15);
          }
          ::-webkit-scrollbar-thumb:hover {
            background-color: rgba(24, 144, 255, 0.55);
          }
          scrollbar-width: thin; /* Firefox */
          scrollbar-color: rgba(24, 144, 255, 0.35) transparent; /* Firefox */
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
        width: 80,
        dataIndex: 'flight_id',
        key: 'flight_id',
        fixed: 'left', // 固定列
        ellipsis: true,
        render: (flightId, record) => {
            // 根据航班状态显示不同颜色
            // 浅绿色：既在planned又在active中（normal状态）
            // 浅蓝色：只在planned中（planned状态）
            const color = record.status === 'normal' ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING;
            return (
                <span style={{ color: color, fontWeight: 'bold', fontSize: '12px' }}>
                    {flightId}
                </span>
            );
        }
    },
    {
        title: ['Taxi', 'Time'], // 滑行时间 - 两行标题
        dataIndex: 'taxi_time',
        key: 'taxi_time',
        width: 70,
        ellipsis: true,
        render: (time) => time ? time.toFixed(1) : '-'
    },
    {
        title: ['Start', 'Time'], // 开始时间 - 两行标题
        dataIndex: 'start_time',
        key: 'start_time',
        width: 70,
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
        title: ['Time to', 'Takeoff'], // 起飞时间 - 两行标题
        dataIndex: 'time_to_takeoff',
        key: 'time_to_takeoff',
        width: 90,
        ellipsis: false,
        render: (time) => {
            const value = time !== undefined ? time.toFixed(1) : '-';
            return (
                <div style={{ 
                    whiteSpace: 'normal', 
                    lineHeight: '1.2',
                    fontSize: '11px',
                    textAlign: 'center'
                }}>
                    <div>Time to</div>
                    <div>Takeoff: {value}</div>
                </div>
            );
        }
    },
    {
        title: ['Remaining', 'Time'], // 剩余时间 - 两行标题
        dataIndex: 'remaining_taxi_time',
        key: 'remaining_taxi_time',
        width: 90,
        ellipsis: false,
        render: (time) => {
            const value = time ? (time / 60).toFixed(1) : '-';
            return (
                <div style={{ 
                    whiteSpace: 'normal', 
                    lineHeight: '1.2',
                    fontSize: '11px',
                    textAlign: 'center'
                }}>
                    <div>Remaining</div>
                    <div>Time: {value}</div>
                </div>
            );
        }
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
    const { t } = useI18n();
    const { styles } = useStyle();
    const width = 1200, height = 400; // 增加尺寸以容纳更多数据
const svgRef = useRef();
const svgAxisRef = useRef(); // 顶部粘性时间轴 SVG 引用
    const d3Container = useRef({});
    const [timeScale, setTimeScale] = useState({ min: 0, max: 100 });
    const [tableDataSource, setTableDataSource] = useState([]); // 表格数据源
    const [aircraftOrder, setAircraftOrder] = useState([]); // 航班顺序，用于同步滚动
    const tableRef = useRef(); // 表格引用
    const chartRef = useRef(); // 图表容器引用
    const overlayRef = useRef(); // 跨区域连线的覆盖层
    const isSyncingScroll = useRef(false); // 防止滚动事件互相触发造成循环
    const ROW_HEIGHT = 40;
    const ROW_HEIGHT_P = 40; // 每行高度，用于同步滚动
    const HEADER_HEIGHT = 40; // 表头高度

    // 本地化列定义
    const columnsI18n = React.useMemo(() => ([
        {
            title: t('flight.id'),
            width: 80,
            dataIndex: 'flight_id',
            key: 'flight_id',
            fixed: 'left',
            ellipsis: true,
            render: (flightId, record) => {
                const color = record.status === 'normal' ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING;
                return (
                    <span style={{ color: color, fontWeight: 'bold', fontSize: '12px' }}>
                        {flightId}
                    </span>
                );
            }
        },
        {
            title: [t('taxi'), t('time')],
            dataIndex: 'taxi_time',
            key: 'taxi_time',
            width: 70,
            ellipsis: true,
            render: (time) => time ? time.toFixed(1) : '-'
        },
        {
            title: [t('start'), t('time')],
            dataIndex: 'start_time',
            key: 'start_time',
            width: 70,
            ellipsis: true,
            render: (time) => {
                if (typeof time === 'string') {
                    return new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                } else if (typeof time === 'number') {
                    return `T+${(time / 60).toFixed(1)}`;
                }
                return '-';
            }
        },
        {
            title: [t('time.to'), t('takeoff')],
            dataIndex: 'time_to_takeoff',
            key: 'time_to_takeoff',
            width: 90,
            ellipsis: false,
            render: (time) => {
                const value = time !== undefined ? time.toFixed(1) : '-';
                return (
                    <div style={{ whiteSpace: 'normal', lineHeight: '1.2', fontSize: '11px', textAlign: 'center' }}>
                        <div>{t('time.to')}</div>
                        <div>{t('takeoff')}: {value}</div>
                    </div>
                );
            }
        },
        {
            title: [t('remaining'), t('time')],
            dataIndex: 'remaining_taxi_time',
            key: 'remaining_taxi_time',
            width: 90,
            ellipsis: false,
            render: (time) => {
                const value = time ? (time / 60).toFixed(1) : '-';
                return (
                    <div style={{ whiteSpace: 'normal', lineHeight: '1.2', fontSize: '11px', textAlign: 'center' }}>
                        <div>{t('remaining')}</div>
                        <div>{t('time')}: {value}</div>
                    </div>
                );
            }
        },
        {
            title: t('origin'),
            dataIndex: 'origin',
            key: 'origin',
            width: 80,
            ellipsis: true
        },
        {
            title: t('destination'),
            dataIndex: 'destination',
            key: 'destination',
            width: 80,
            ellipsis: true
        }
    ]), [t]);

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

    // 绘制从表格行到时间线飞机图标的连接线（使用覆盖层SVG）
    const drawRowToIconConnectors = () => {
        const overlaySvg = overlayRef.current;
        const tableContainer = tableRef.current;
        const chartContainer = chartRef.current;
        if (!overlaySvg || !tableContainer || !chartContainer) return;

        // 清空覆盖层
        while (overlaySvg.firstChild) overlaySvg.removeChild(overlaySvg.firstChild);

        const overlayRect = overlaySvg.getBoundingClientRect();
        // 选择主体表格SVG（包含数据行），避免误选表头SVG
        const tableSvg = tableContainer?.querySelector('.svg-table-body');
        // 使用主图 SVG，而不是顶部粘性轴的 SVG
        const chartSvg = svgRef.current;
        if (!tableSvg || !chartSvg) return;

        const rows = Array.from(tableSvg.querySelectorAll('[data-flight-id]'));
        rows.forEach((rowEl, idx) => {
            const flightId = rowEl.getAttribute('data-flight-id');
            const iconEl = chartSvg.querySelector(`.aircraft-icon-${CSS.escape(flightId)}`);
            if (!iconEl) return;

            const rowRect = rowEl.getBoundingClientRect();
            const iconRect = iconEl.getBoundingClientRect();

            // 表格右侧起点（优先使用行内圆角矩形的右缘），左边高度与其上下边界完全对齐
            const roundedRectEl = rowEl.querySelector('.rounded-row');
            const roundedRectRect = roundedRectEl ? roundedRectEl.getBoundingClientRect() : null;
            const xLeft = (roundedRectRect ? roundedRectRect.right : rowRect.right) - overlayRect.left;
            const rowTop = (roundedRectRect ? roundedRectRect.top : rowRect.top) - overlayRect.top;
            const rowBottom = (roundedRectRect ? roundedRectRect.bottom : (rowRect.top + rowRect.height)) - overlayRect.top;

            // 计算滑块左缘作为折线拐点X
            // 计划飞机滑块：.plan-bar-group-${id} 下的 .taxi-slider-${id}
            // 活跃飞机滑块：.active-bar-group-${id} 下的第一个 .remaining-slider-block
            const plannedSliderEl = chartSvg.querySelector(`.plan-bar-group-${CSS.escape(flightId)} .taxi-slider-${CSS.escape(flightId)}`);
            const activeBarGroupEl = chartSvg.querySelector(`.active-bar-group-${CSS.escape(flightId)}`);
            const planBarGroupEl  = chartSvg.querySelector(`.plan-bar-group-${CSS.escape(flightId)}`);
            let midX = null;
            let sliderRect = null; // 记录滑块或轨道的矩形用于带状连接
            
            // 规则：
            // Active飞机 -> 使用 taxi-slider-${id} 左端点
            // Planned飞机 -> 使用 time-track-block 左端点
            const taxiSliderEl = chartSvg.querySelector(`.taxi-slider-${CSS.escape(flightId)}`);
            if (activeBarGroupEl) {
                // Active优先：没有 taxi-slider 时，使用剩余滑行块或其背景块作为参照
                const remainingBlockEl = activeBarGroupEl.querySelector('.remaining-slider-block');
                const activeTrackEl = activeBarGroupEl.querySelector('.active-time-track-block');
                const refEl = taxiSliderEl || remainingBlockEl || activeTrackEl;
                if (refEl) {
                    const rect = refEl.getBoundingClientRect();
                    midX = rect.left - overlayRect.left;
                    sliderRect = rect;
                }
            } else if (planBarGroupEl) {
                const planTrackEl = planBarGroupEl.querySelector('.time-track-block');
                if (planTrackEl) {
                    const rect = planTrackEl.getBoundingClientRect();
                    midX = rect.left - overlayRect.left;
                    sliderRect = rect;
                }
            }

            // 若没有找到滑块元素，则跳过该连线（带状直线需要滑块高度）
            if (midX == null || !sliderRect) {
                return;
            }

            // 计算滑块左缘与其上下边界（作为带状右侧宽度），右侧高度保持为滑块自身高度
            const xRight = sliderRect.left - overlayRect.left;
            const sliderTop = sliderRect.top - overlayRect.top;
            const sliderBottom = sliderTop + sliderRect.height;

            // 带状左侧高度与表格行圆角矩形高度严格对齐（不收窄）
            const topLeftY = rowTop;
            const bottomLeftY = rowBottom;

            const points = [
                `${xLeft},${topLeftY}`,
                `${xRight},${sliderTop}`,
                `${xRight},${sliderBottom}`,
                `${xLeft},${bottomLeftY}`
            ].join(' ');

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', points);
            // 使用与表格一致的颜色（active=绿色，planning=蓝色），并设为半透明
            const isActive = !!activeBarGroupEl;
            const bandColor = isActive ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING;
            polygon.setAttribute('fill', bandColor);
            polygon.setAttribute('opacity', '0.25');
            polygon.setAttribute('stroke', 'none');
            overlaySvg.appendChild(polygon);
        });
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
                pointRadius: CONFLICT_POINT_RADIUS_CURRENT,
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
                pointRadius: CONFLICT_POINT_RADIUS_FUTURE,
                lineColor: 'orange',
                lineWidth: 2,
                lineDashArray: '3,3',
                opacity: 0.6,
                textColor: 'orange',
                fontSize: '9px',
                fontWeight: 'normal'
            }
            // 绘制跨区域连接线（确保表格和图表均已渲染）
           

        };
         
        setTimeout(() => {
            drawRowToIconConnectors();
        }, 0);

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
                    .attr("stroke", styles.pointColor)
                    .attr("stroke-width", TIMELINE_STYLES.LINE_WIDTH)
                    .attr("opacity", styles.opacity);

                g.append("circle")
                    .attr("class", `conflict-${conflictType} conflict-point`)
                    .attr("cx", x)
                    .attr("cy", y2)
                    .attr("r", styles.pointRadius)
                    .attr("fill", styles.pointColor)
                    .attr("stroke", styles.pointColor)
                    .attr("stroke-width", TIMELINE_STYLES.LINE_WIDTH)
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
        // 根据 time_to_takeoff 升序排序，缺失值放到最后
        tableData.sort((a, b) => {
            const ta = (a.time_to_takeoff ?? Number.POSITIVE_INFINITY);
            const tb = (b.time_to_takeoff ?? Number.POSITIVE_INFINITY);
            return ta - tb;
        });

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

                    // 使用与普通时间线相同的颜色和样式
                    const isActive = simulationResult.type === 'simulation_active';
                    const color = isActive ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING;
                    
                    // 根据飞机类型选择样式，与普通时间线保持一致
                    let strokeWidth, strokeDasharray;
                    if (isActive) {
                        strokeWidth = TIMELINE_STYLES.LINE_WIDTH;
                        strokeDasharray = TIMELINE_STYLES.ACTIVE_DASH; // 实线
                    } else {
                        strokeWidth = TIMELINE_STYLES.LINE_WIDTH;
                        strokeDasharray = TIMELINE_STYLES.PLANNING_DASH; // 虚线
                    }

                    // 移除Y轴偏移，与普通时间线在同一条直线上
                    const yOffset = 0;

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
                        .attr("opacity", 1.0); // 模拟数据保持不透明

                    // 添加模拟起始点图标（圆形，与普通时间线一致）
                    simulationGroup.selectAll(".simulation-start-point")
                        .data(simulationResult.paths)
                        .enter()
                        .append("circle")
                        .attr("class", "simulation-start-point")
                        .attr("cx", d => {
                            return simulationResult.type === 'simulation_planning' ? xScale(d.start_time) : xScale(0);
                        })
                        .attr("cy", (d, j) => getYPosition(simulationResult.aircraft_id) + j * 3 + yOffset)
                        .attr("r", TIMELINE_POINT_RADIUS)
                        .attr("fill", color)
                        .attr("stroke", color)
                        .attr("stroke-width", 2)
                        .attr("opacity", 1.0); // 模拟数据图标保持不透明

                    // 添加模拟结束点图标（圆形，与普通时间线一致）
                    simulationGroup.selectAll(".simulation-end-point")
                        .data(simulationResult.paths)
                        .enter()
                        .append("circle")
                        .attr("class", "simulation-end-point")
                        .attr("cx", d => {
                            return simulationResult.type === 'simulation_planning' ? xScale(d.end_time) : xScale(d.time);
                        })
                        .attr("cy", (d, j) => getYPosition(simulationResult.aircraft_id) + j * 3 + yOffset)
                        .attr("r", TIMELINE_POINT_RADIUS)
                        .attr("fill", isActive ? color : "white")
                        .attr("stroke", color)
                        .attr("stroke-width", 2)
                        .attr("opacity", 1.0); // 模拟数据图标保持不透明

                });
            };

            // 处理航班数据，生成表格数据源
            const { tableData, aircraftIds: processedAircraftIds } = processFlightData(plannedData);
            setTableDataSource(tableData);
            setAircraftOrder(processedAircraftIds);

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
            const width = chartRef.current ? chartRef.current.clientWidth : 1200; // 使用容器实际宽度，避免显示不全

            // 创建飞机ID比例尺，根据interval_to_previous字段调整间隔
            // 计算每个飞机的累积Y位置偏移
            const calculateYPositions = () => {
                const yPositions = {};
                // 行起始位置不再加表头高度，缩小顶部间隙
                let currentY = (ROW_HEIGHT_P / 2);
                
                aircraftIds.forEach((flightId, index) => {
                    yPositions[flightId] = currentY;
                    
                    // 获取下一个飞机的interval_to_previous值来计算间隔
                    if (index < aircraftIds.length - 1) {
                        const nextFlightId = aircraftIds[index + 1];
                        const nextFlightData = plannedData.planned_flights[nextFlightId];
                        const intervalToPrevious = nextFlightData?.interval_to_previous || ROW_HEIGHT_P;
                        
                        // 使用interval_to_previous作为到下一个飞机的间隔，如果没有则使用默认行高
                        currentY += Math.max(intervalToPrevious, ROW_HEIGHT_P);
                    }
                });
                
                return yPositions;
            };
            
            const yPositions = calculateYPositions();
            const maxY = Math.max(...Object.values(yPositions)) + ROW_HEIGHT_P;
            // 图表高度不再包含表头高度，缩小与时间轴间距
            const chartHeight = maxY;

            // 根据飞机数量动态计算所需高度，表格保持原来的间距
            const tableRequiredHeight = aircraftIds.length * ROW_HEIGHT_P;
            
            // SVG高度基于时间线的实际需要（使用interval_to_previous调整后的高度）
            const svgRequiredHeight = maxY;

            const baseHeight = 400;

            // SVG使用基于interval_to_previous计算的高度，表格保持原来的固定间距
            const height = Math.max(svgRequiredHeight + EXTRA_BOTTOM_SPACE, tableRequiredHeight + EXTRA_BOTTOM_SPACE);

            // 为右侧图例预留空间，避免与时间线重叠
            const LEGEND_WIDTH = 200;
            const LEGEND_GAP = 20;
            const margin = { top: 6, right: LEGEND_WIDTH + LEGEND_GAP, bottom: 80, left: 200 }; // 顶部留少量间距，缩小与时间轴间隙

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

            // 定义箭头标记（在SVG清理之后立即创建）
            let defs = svg.select('defs');
            if (defs.empty()) defs = svg.append('defs');
            
            // 相向冲突箭头标记 - 红色
            if (defs.select('#overlap-chevron-arrow-opposite').empty()) {
                let chevronMarkerOpposite = defs.append('marker')
                    .attr('id', 'overlap-chevron-arrow-opposite')
                    .attr('viewBox', '0 0 20 20')
                    .attr('refX', 0) // 箭头底边对齐路径终点，避免与路径重合
                    .attr('refY', 10)
                    .attr('markerWidth', 20) // 进一步增大箭头尺寸
                    .attr('markerHeight', 20) // 进一步增大箭头尺寸
                    .attr('orient', 'auto')
                    .attr('markerUnits', 'userSpaceOnUse');

                // 相向冲突红色箭头，减小高度并添加白色描边
                chevronMarkerOpposite.append('polygon')
                    .attr('points', `0,5 0,15 ${ARROW_TIP_X},10`)  // 减小高度：从y=5到y=15，缩短箭头长度
                    .attr('fill', OVERLAP_COLORS.OPPOSITE)  // 相向冲突红色
                    .attr('stroke', 'white')  // 添加白色描边
                    .attr('stroke-width', 1)  // 描边宽度
                    .attr('fill-opacity', ARROW_FILL_OPACITY)  // 箭头填充半透明
                    .attr('stroke-opacity', 1);               // 保持描边不透明，增强可读性
            }
            
            // 同向冲突箭头标记 - 橙色
            if (defs.select('#overlap-chevron-arrow-same').empty()) {
                let chevronMarkerSame = defs.append('marker')
                    .attr('id', 'overlap-chevron-arrow-same')
                    .attr('viewBox', '0 0 20 20')
                    .attr('refX', 0) // 箭头底边对齐路径终点，避免与路径重合
                    .attr('refY', 10)
                    .attr('markerWidth', 20) // 进一步增大箭头尺寸
                    .attr('markerHeight', 20) // 进一步增大箭头尺寸
                    .attr('orient', 'auto')
                    .attr('markerUnits', 'userSpaceOnUse');

                // 同向冲突橙色箭头，减小高度并添加白色描边
                chevronMarkerSame.append('polygon')
                    .attr('points', `0,5 0,15 ${ARROW_TIP_X},10`)  // 减小高度：从y=5到y=15，缩短箭头长度
                    .attr('fill', OVERLAP_COLORS.SAME_DIRECTION)  // 同向冲突橙色
                    .attr('stroke', 'white')  // 添加白色描边
                    .attr('stroke-width', 1)  // 描边宽度
                    .attr('fill-opacity', ARROW_FILL_OPACITY)  // 箭头填充半透明
                    .attr('stroke-opacity', 1);               // 保持描边不透明，增强可读性
            }

            // 计算实际绘图区域尺寸
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;


            // 创建时间比例尺
            const xScale = d3.scaleLinear()
                .domain([0, maxTime])
                .range([0, innerWidth]);

            // 使用序数比例尺来精确控制行位置，但现在基于interval_to_previous计算的位置
            const yScale = d3.scaleOrdinal()  
                .domain(aircraftIds)
                .range(aircraftIds.map(flightId => yPositions[flightId]));

            // 计算行的中心位置，使用yScale确保基于interval_to_previous的间隔
            const getYPosition = (flightId) => {
                return yScale(flightId);
            };

            // 创建顶部X轴
            const xAxis = d3.axisTop(xScale)
                .tickFormat(d => `T+${d.toFixed(0)}`)
                .tickSizeOuter(0);

            const color = '#000000'; // 默认颜色

            // 将X轴绘制到顶部粘性SVG中
            const axisSvg = d3.select(svgAxisRef.current);
            axisSvg.selectAll("*").remove();
            axisSvg
                .attr("width", width)
                .attr("height", HEADER_HEIGHT)
                .attr("viewBox", [0, 0, width, HEADER_HEIGHT])
                .attr("style", "max-width: 100%; height: auto;");

            const gAxis = axisSvg.append("g")
                // 将轴基线下移到容器底部附近，避免 axisTop 的刻度与标签被裁剪
                .attr("transform", `translate(${margin.left}, ${HEADER_HEIGHT - 6})`);

            gAxis.append("g")
                .attr("class", "x-axis")
                .call(xAxis.tickPadding(6));

            // 左侧添加Y轴标题（与左侧表头同一水平行，垂直居中）
            gAxis.append("text")
                .attr("x", -10)
                .attr("y", 6 - HEADER_HEIGHT / 2) // 与基线偏移相反方向，确保显示在粘性容器中间
                .attr("fill", color)
                .attr("stroke", color)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .text(t('flight.id'));

            // 手动创建Y轴以确保与表格对齐
            const yAxisGroup = g.append("g")
                .attr("class", "y-axis");

            // Y轴标题已移至顶部粘性区域


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

                // 移除Y轴标签，ID文本将移动到飞机图标位置
                // yAxisGroup.append("text")
                //     .attr("x", -10)
                //     .attr("y", yPos)
                //     .attr("dy", "0.32em")
                //     .attr("text-anchor", "end")
                //     .attr("font-size", "12px")
                //     .attr("fill", "#000")
                //     .text(flightId);
            });

            // 绘制时间线

            // 为不同类型的飞机定义不同的颜色和样式
            // 注释掉本地颜色数组，改用WebSocketStore的统一颜色管理
            // const activeColors = ['#FF6B6B', '#FF8E53', '#FF6B9D', '#C44569', '#F8B500']; // 活跃飞机：暖色调
            // const planningColors = ['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']; // 计划飞机：冷色调
            const simulationColors = SIMULATION_COLORS; // 模拟数据：紫红色调

            // 不再需要本地索引，改用WebSocketStore的统一管理
            // let activeIndex = 0;
            // let planningIndex = 0;




            // 处理模拟数据
            const simulationResults = processSimulationData();
            const hasSimulationData = simulationResults.length > 0; // 判断是否有模拟数据

            const flights = g.selectAll(".flight-group")
                .data(plannedResults) // 绑定所有飞机的数据
                .enter()
                .append("g") // 为每架飞机创建一个 <g>
                .attr("class", d => `flight-group ${d.type}-flight`) // 添加类型相关的class
                .attr("id", d => `flight-${d.aircraft_id}`); // 使用飞机ID作为DOM的ID，便于调试

            // 在每个飞机分组内，根据类型设置不同样式
            flights.each(function (plannedResult, i) {
                const flightGroup = d3.select(this);

                // 使用统一颜色：滑行中飞机用一种颜色，规划飞机用另一种颜色
                const isActive = plannedResult.type === 'active';
                const color = isActive ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING; // 滑行中：浅绿色，规划：浅蓝色
                
                // 根据飞机类型选择样式
                let strokeWidth, strokeDasharray;
                if (isActive) {
                    strokeWidth = hasSimulationData ? TIMELINE_STYLES.LINE_WIDTH + 2 : TIMELINE_STYLES.LINE_WIDTH; // 有模拟数据时加宽原始时间线
                    strokeDasharray = TIMELINE_STYLES.ACTIVE_DASH; // 实线
                } else {
                    strokeWidth = hasSimulationData ? TIMELINE_STYLES.LINE_WIDTH + 2 : TIMELINE_STYLES.LINE_WIDTH; // 有模拟数据时加宽原始时间线
                    strokeDasharray = TIMELINE_STYLES.PLANNING_DASH; // 虚线
                }

                // 根据是否有模拟数据设置透明度
                const timelineOpacity = hasSimulationData ? 0.4 : 1.0; // 有模拟数据时原时间线半透明

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
                    .attr("stroke-dasharray", strokeDasharray)
                    .attr("opacity", timelineOpacity); // 应用透明度

                // 添加起始点图标
                flightGroup.selectAll(".start-point")
                    .data(plannedResult.paths)
                    .enter()
                    .append("circle")
                    .attr("class", "start-point")
                    .attr("cx", d => xScale(d.start_time))
                    .attr("cy", (d, j) => getYPosition(plannedResult.aircraft_id) + j * 3)
                    .attr("r", TIMELINE_POINT_RADIUS)
                    .attr("fill", color)
                    .attr("stroke", color)
                    .attr("stroke-width", 2)
                    .attr("opacity", timelineOpacity); // 起始点也应用透明度;

                // 添加结束点图标
                flightGroup.selectAll(".end-point")
                    .data(plannedResult.paths)
                    .enter()
                    .append("circle")
                    .attr("class", "end-point")
                    .attr("cx", d => xScale(d.end_time))
                    .attr("cy", (d, j) => getYPosition(plannedResult.aircraft_id) + j * 3)
                    .attr("r", TIMELINE_POINT_RADIUS)
                    .attr("fill", plannedResult.type === 'active' ? color : "white")
                    .attr("stroke", color)
                    .attr("stroke-width", 2);

                // 为活跃飞机添加特殊标识（三角形）
                // if (plannedResult.type === 'active') {
                //     flightGroup.selectAll(".active-indicator")
                //         .data(plannedResult.paths)
                //         .enter()
                //         .append("polygon")
                //         .attr("class", "active-indicator")
                //         .attr("points", d => {
                //             const x = xScale(d.end_time);
                //             const y = getYPosition(plannedResult.aircraft_id) - 10;
                //             return `${x},${y} ${x - 5},${y - 8} ${x + 5},${y - 8}`;
                //         })
                //         .attr("fill", color)
                //         .attr("stroke", "white")
                //         .attr("stroke-width", 1);
                // }

                // 为计划飞机添加特殊标识（方形）
                // if (plannedResult.type === 'planning') {
                //     flightGroup.selectAll(".planning-indicator")
                //         .data(plannedResult.paths)
                //         .enter()
                //         .append("rect")
                //         .attr("class", "planning-indicator")
                //         .attr("x", d => xScale(d.end_time) - 4)
                //         .attr("y", getYPosition(plannedResult.aircraft_id) - 14)
                //         .attr("width", 8)
                //         .attr("height", 8)
                //         .attr("fill", "white")
                //         .attr("stroke", color)
                //         .attr("stroke-width", 2);
                // }
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



                const toMinutes = (v) => {
                    const num = Number(v) || 0;
                    return num / 60; // 后端秒 -> 前端分钟
                };

                // 绘制滑行道重叠
                (overlaps.taxiways || []).forEach((twGroup, idx) => {
                    // 使用与连线一致的颜色：基于后端提供的 direction
                    const groupDirection = String(twGroup?.direction || '').toLowerCase();
                    const color = groupDirection === 'opposite'
                        ? OVERLAP_COLORS.OPPOSITE
                        : (groupDirection === 'same' ? OVERLAP_COLORS.SAME_DIRECTION : OVERLAP_COLORS.CROSSING);
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
                            // 调整Y坐标以对齐时间线中心（考虑时间线绘制时的偏移）
                            const y = getYPosition(fid); // 时间线平均偏移约1.5像素
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
                                .attr('r', TIMELINE_STYLES.POINT_RADIUS)
                                .attr('fill', color)
                                .attr('opacity', 0.7)
                                .attr('stroke', color)
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
                        // 精确对齐到时间线中心
                        const ay = getYPosition(a.flight_id);
                        const by = getYPosition(b.flight_id);

                        // 新增：优先使用后端提供的方向字段进行类型判断
                        const groupDirection = String(twGroup?.direction || '').toLowerCase();
                        const hasDirectionFlag = groupDirection === 'same' || groupDirection === 'opposite';
                        // 当 direction 存在时使用它；否则回退到旧的时间窗方向计算
                        const aDir = aEndMin - aStartMin;
                        const bDir = bEndMin - bStartMin;
                        const isOpposing = hasDirectionFlag ? (groupDirection === 'opposite') : ((aDir * bDir) < 0);

                        if (isOpposing) {
                            // 相向：与同向一致的折线几何，但在折线中点保留两个相对的箭头
                            // 选择四种端点组合中距离最近的一对端点作为连接端点
                            const candidates = [
                                { ax: axStart, ay, bx: bxStart, by, dist: Math.abs(aStartMin - bStartMin), label: 'start-start' },
                                { ax: axStart, ay, bx: bxEnd,   by, dist: Math.abs(aStartMin - bEndMin),   label: 'start-end'   },
                                { ax: axEnd,   ay, bx: bxStart, by, dist: Math.abs(aEndMin   - bStartMin), label: 'end-start'   },
                                { ax: axEnd,   ay, bx: bxEnd,   by, dist: Math.abs(aEndMin   - bEndMin),   label: 'end-end'     },
                            ];
                            const best = candidates.reduce((m, p) => p.dist < m.dist ? p : m, candidates[0]);

                            let xFrom = best.ax, yFrom = best.ay, xTo = best.bx, yTo = best.by;
                            // 保证从左到右绘制，避免反向坐标导致折线不美观
                            if (xFrom > xTo) {
                                xFrom = best.bx; yFrom = best.by;
                                xTo = best.ax; yTo = best.ay;
                            }

                            const midY = (ay + by) / 2; // 与同向保持一致，垂直对齐到中线
                            const mx = (xFrom + xTo) / 2; // 中点x，用于双箭头相向汇合

                            // 左段折线：起点 -> 垂直至中线 -> 水平到中点（留出箭头间隔）；箭头指向中点
                            overlapLayer.append('path')
                                .attr('class', `overlap-connector opposing-left polyline ${best.label}`)
                                .attr('d', `M${xFrom},${yFrom} L${xFrom},${midY} L${mx - ARROW_GAP_PX},${midY}`)
                                .attr('stroke', OVERLAP_COLORS.OPPOSITE)
                                .attr('stroke-width', CONNECTION_LINE_WIDTH)
                                .attr('fill', 'none')
                                .attr('stroke-opacity', CONNECTION_LINE_OPACITY)
                                .attr('marker-end', 'url(#overlap-chevron-arrow-opposite)');

                            // 右段折线：终点 -> 垂直至中线 -> 水平到中点（留出箭头间隔）；箭头指向中点
                            overlapLayer.append('path')
                                .attr('class', `overlap-connector opposing-right polyline ${best.label}`)
                                .attr('d', `M${xTo},${yTo} L${xTo},${midY} L${mx + ARROW_GAP_PX},${midY}`)
                                .attr('stroke', OVERLAP_COLORS.OPPOSITE)
                                .attr('stroke-width', CONNECTION_LINE_WIDTH)
                                .attr('fill', 'none')
                                .attr('stroke-opacity', CONNECTION_LINE_OPACITY)
                                .attr('marker-end', 'url(#overlap-chevron-arrow-opposite)');
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

                            // 使用折线连接，控制点位于两行的精确中线
                            const midY = (ay + by) / 2; // 精确对齐到中点，不偏离

                            const endYAdjusted = bEarlyY > midY ? (bEarlyY - ARROW_GAP_PX) : (bEarlyY + ARROW_GAP_PX);
                            overlapLayer.append('path')
                                .attr('class', 'overlap-connector same-direction end-to-end')
                                .attr('d', `M${xFrom},${aLateY} L${xFrom},${midY} L${xTo},${midY} L${xTo},${endYAdjusted}`)
                                .attr('stroke', OVERLAP_COLORS.SAME_DIRECTION) // 同向冲突：橙色
                                .attr('stroke-width', CONNECTION_LINE_WIDTH) // 使用统一宽度
                                .attr('fill', 'none')
                                .attr('stroke-opacity', CONNECTION_LINE_OPACITY) // 仅对线透明度生效
                                .attr('marker-end', 'url(#overlap-chevron-arrow-same)')
                                .style('color', OVERLAP_COLORS.SAME_DIRECTION);
                        }
                    }

                });

                // 绘制节点重叠：改为折线样式，从后面的飞机连向前一个飞机，并在终点添加左边有缺口的圆
                const nodeLayer = g.append('g')
                    .attr('class', 'overlap-node-layer')
                    .attr('pointer-events', 'none');

                // 定义左边有缺口的圆形标记
                const svgRoot2 = d3.select(g.node().ownerSVGElement);
                let defs2 = svgRoot2.select('defs');
                if (defs2.empty()) defs2 = svgRoot2.append('defs');
                
                if (defs2.select('#gap-circle-marker').empty()) {
                    const marker = defs2.append('marker')
                        .attr('id', 'gap-circle-marker')
                        .attr('markerWidth', 3)   // 再缩小一半：从6减小到3
                        .attr('markerHeight', 3)  // 再缩小一半：从6减小到3
                        .attr('refX', 1.5)        // 调整参考点：从3减小到1.5
                        .attr('refY', 1.5)        // 调整参考点：从3减小到1.5
                        .attr('orient', 'auto');
                    
                    // 绘制左边有缺口的圆（再缩小一半）
                    marker.append('path')
                        .attr('d', 'M 1.5,0.25 A 1.25,1.25 0 1,1 1.5,2.75') // 再缩小一半：半径从2.5减小到1.25
                        .attr('fill', 'none')
                        .attr('stroke', OVERLAP_COLORS.CROSSING)
                        .attr('stroke-width', 0.8); // 减小线宽：从1减小到0.8
                }
                (overlaps.nodes || []).forEach((nodeGroup, nidx) => {
                    // 节点重叠统一使用与连线一致的颜色（CROSSING）
                    const color = OVERLAP_COLORS.CROSSING;
                    const flightWindows = Array.isArray(nodeGroup.flight_windows)
                        ? nodeGroup.flight_windows
                        : (Array.isArray(nodeGroup.flights) ? nodeGroup.flights : []);

                    // 只处理至少两架飞机
                    const sortedFW = flightWindows.slice().sort((a, b) => {
                        return aircraftIds.indexOf(a.flight_id) - aircraftIds.indexOf(b.flight_id);
                    });
                    if (sortedFW.length < 2) return;

                    // 在时间线上高亮节点重叠区段（与连线颜色一致）
                    sortedFW.forEach((fw) => {
                        const fid = fw.flight_id;
                        const y = getYPosition(fid);
                        const startMin = toMinutes(fw?.time_window?.start ?? 0);
                        const endMin = toMinutes(fw?.time_window?.end ?? fw?.time_window?.start ?? 0);
                        const x1 = xScale(startMin);
                        const x2 = xScale(endMin);
                        const bandHeight = 8;

                        if (Math.abs(endMin - startMin) < 1e-6) {
                            nodeLayer.append('circle')
                                .attr('class', 'overlap-point')
                                .attr('cx', x1)
                                .attr('cy', y)
                                .attr('r', TIMELINE_STYLES.POINT_RADIUS)
                                .attr('fill', OVERLAP_COLORS.CROSSING)
                                .attr('opacity', 0.7)
                                .attr('stroke', OVERLAP_COLORS.CROSSING)
                                .attr('stroke-width', 1);
                        } else {
                            nodeLayer.append('rect')
                                .attr('class', 'overlap-segment')
                                .attr('x', Math.min(x1, x2))
                                .attr('y', y - bandHeight / 2)
                                .attr('width', Math.max(2, Math.abs(x2 - x1)))
                                .attr('height', bandHeight)
                                .attr('rx', 3)
                                .attr('fill', OVERLAP_COLORS.CROSSING)
                                .attr('opacity', 0.25)
                                .attr('stroke', OVERLAP_COLORS.CROSSING)
                                .attr('stroke-width', 1);
                        }
                    });

                    for (let i = 0; i < sortedFW.length - 1; i++) {
                        const a = sortedFW[i];
                        const b = sortedFW[i + 1];
                        const aStartMin = toMinutes(a?.time_window?.start ?? 0);
                        const bStartMin = toMinutes(b?.time_window?.start ?? 0);
                        const ax = xScale(aStartMin);
                        const bx = xScale(bStartMin);
                        // 精确对齐到时间线中心
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

                        // 确定连线方向：从后面的飞机连向前面的飞机
                        // 根据时间排序，后面的飞机（时间较晚的）连向前面的飞机（时间较早的）
                        let fromX, fromY, toX, toY, pathD;
                        if (bStartMin > aStartMin) {
                            // b是后面的飞机，从b连向a
                            fromX = bx; fromY = by;
                            toX = ax; toY = ay;
                        } else {
                            // a是后面的飞机，从a连向b
                            fromX = ax; fromY = ay;
                            toX = bx; toY = by;
                        }

                        // 计算折线的中间点，避免与飞机图标重叠
                        // 使用平行的水平折线设计
                        const midY = (fromY + toY) / 2;
                        const verticalOffset = 15; // 垂直偏移量，使折线更明显
                        
                        // 创建平行的折线路径
                        // 垂直段 -> 水平段 -> 垂直段，确保中间的水平段是平行的
                        const horizontalY = midY; // 水平线的Y坐标保持一致，确保平行
                        pathD = `M${fromX},${fromY} L${fromX},${horizontalY} L${toX},${horizontalY} L${toX},${toY}`;

                        nodeLayer.append('path')
                            .attr('class', 'overlap-node-connector polyline')
                            .attr('d', pathD)
                            .attr('stroke', OVERLAP_COLORS.CROSSING) // 交叉冲突：蓝灰色
                            .attr('stroke-width', CONNECTION_LINE_WIDTH) // 使用统一宽度
                            .attr('fill', 'none')
                            .attr('stroke-opacity', CONNECTION_LINE_OPACITY) // 仅对线透明度生效
                            .attr('stroke-linejoin', 'round')
                            .attr('stroke-linecap', 'round')
                            .attr('marker-end', 'url(#gap-circle-marker)'); // 在终点添加左边有缺口的圆
                    }
                });
            };

            // 绘制模拟数据时间线
            drawSimulationTimelines(g, simulationResults, xScale, getYPosition, simulationColors);
            // 绘制 overlaps（根据系统状态中的节点/滑行道重叠）
            drawOverlaps(g, websocketStore.overlaps, xScale, getYPosition, aircraftIds);

            // 绘制影响图连接线（当有模拟数据时）
            const drawImpactGraphConnections = (g, impactGraph, getYPosition, aircraftIds) => {
                if (!impactGraph || !impactGraph.edges || impactGraph.edges.length === 0) return;
                
                const connectionLayer = g.append('g')
                    .attr('class', 'impact-graph-connections')
                    .attr('pointer-events', 'none');
                
                // 定义箭头标记
                const svgRoot = d3.select(g.node().ownerSVGElement);
                let defs = svgRoot.select('defs');
                if (defs.empty()) defs = svgRoot.append('defs');
                
                if (defs.select('#impact-arrow').empty()) {
                    defs.append('marker')
                        .attr('id', 'impact-arrow')
                        .attr('markerWidth', 12)
                        .attr('markerHeight', 12)
                        .attr('refX', 10)
                        .attr('refY', 6)
                        .attr('orient', 'auto')
                        .append('polygon')
                        .attr('points', '0,2 0,10 10,6')  // 与连线宽度成比例的三角形
                        .attr('fill', '#6699CC')  // 交叉冲突颜色
                        .attr('stroke', 'none')
                        .attr('opacity', 1);
                }
                
                // 绘制连接线
                impactGraph.edges.forEach((edge, idx) => {
                    const fromId = edge.from;
                    const toId = edge.to;
                    
                    // 检查飞机是否在当前视图中
                    if (!aircraftIds.includes(fromId) || !aircraftIds.includes(toId)) return;
                    
                    const fromY = getYPosition(fromId);
                    const toY = getYPosition(toId);
                    
                    // 连接线连接到飞机图标的边缘
                    const aircraftIconSize = 24; // 飞机图标的大小（scale 0.025 * 原始尺寸约等于24px）
                    const iconRadius = aircraftIconSize / 2;
                    
                    // 计算连接点位置
                    const deltaY = toY - fromY;
                    const distance = Math.abs(deltaY);
                    
                    let startX, endX, startY, endY;
                    
                    if (distance > 0) {
                        // 垂直连接
                        if (deltaY > 0) {
                            // 从上到下
                            startX = 0;
                            startY = fromY + iconRadius;
                            endX = 0;
                            endY = toY - iconRadius;
                        } else {
                            // 从下到上
                            startX = 0;
                            startY = fromY - iconRadius;
                            endX = 0;
                            endY = toY + iconRadius;
                        }
                    } else {
                        // 同一水平线，连接左右边缘
                        startX = iconRadius;
                        startY = fromY;
                        endX = -iconRadius;
                        endY = toY;
                    }
                    
                    // 计算影响程度（基于目标节点的延迟）
                    const toNodeInfo = impactGraph.nodes && impactGraph.nodes[toId];
                    const delayMinutes = toNodeInfo?.delay_minutes || 0;
                    const impactLevel = Math.min(5, Math.max(1, Math.ceil(delayMinutes / 2)));
                    const strokeWidth = Math.max(2, impactLevel * 1.2); // 增加线条粗细，最小2px
                    const opacity = 0.6 + impactLevel * 0.1;
                    
                    // 绘制曲线连接
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;
                    const pathD = `M${startX},${startY} Q${midX - 15},${midY} ${endX},${endY}`;
                    
                    connectionLayer.append('path')
                        .attr('class', `impact-connection-${fromId}-${toId}`)
                        .attr('d', pathD)
                        .attr('stroke', '#666')
                        .attr('stroke-width', strokeWidth)
                        .attr('fill', 'none')
                        .attr('opacity', opacity)
                        .attr('stroke-dasharray', '4,2')
                        .attr('marker-end', 'url(#impact-arrow)');
                });
            };
            
            // 当有当前模拟数据时，绘制影响图连接
            if (websocketStore.hasCurrentSimulation() && websocketStore.currentSimulation.solution) {
                const impactGraph = websocketStore.currentSimulation.solution.impact_graph;
                drawImpactGraphConnections(g, impactGraph, getYPosition, aircraftIds);
            }

            // 1. 柱状图参数
            const barWidth = 12;
            const barGap = 4;
            const barChartHeight = 80; // 增加柱状图最大高度
            const barChartOffset = -185; // 将时间滑块向左移动5像素（从-175调整到-185）
            const blockWidth = 5; // 缩小每个块的宽度，减少占用空间
            const blockGap = 1.5; // 保持适当间隙，保证可读性

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
                const leftTimeColor = isActive ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING; // 活跃飞机用浅绿色，计划飞机用浅蓝色
            const planTimeColor = isActive ? AIRCRAFT_COLORS.ACTIVE : AIRCRAFT_COLORS.PLANNING;
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



            // 在Y轴左侧添加飞机图标（原来ID文本的位置）
            const AIRCRAFT_ICON_X_OFFSET = 12; // 飞机图标X方向偏移
            const aircraftIconGroup = svg.append("g")
                .attr("class", "aircraft-icons")
                .attr("transform", `translate(${margin.left + AIRCRAFT_ICON_X_OFFSET},${margin.top})`); // 将飞机图标向右移动一点

            aircraftIds.forEach((id, i) => {
                const yBase = getYPosition(id); // 获取飞机对应的Y位置
                
                // 找到对应的飞机数据以确定类型
                const allAircraftData = plannedResults.filter(result => result.aircraft_id === id);
                const aircraftData = allAircraftData.find(data => data.type === 'active') || allAircraftData[0];
                const isActive = aircraftData && aircraftData.type === 'active';
                
                // 使用WebSocketStore获取与TaxiwayMap一致的颜色
                const aircraftColor = websocketStore.getAircraftColor(id, isActive);
                
                // 创建飞机图标（使用与TaxiwayMap相同的SVG路径）
                const aircraftIcon = aircraftIconGroup.append("g")
                    .attr("class", `aircraft-icon-${id}`)
                    .attr("transform", `translate(0, ${yBase})`);
                
                // 使用与TaxiwayMap相同的飞机SVG路径
                aircraftIcon.append("path")
                    .attr("d", "M512 174.933333c23.466667 0 42.666667 8.533333 59.733333 25.6s25.6 36.266667 25.6 59.733334v192l206.933334 185.6c6.4 4.266667 10.666667 12.8 14.933333 21.333333s6.4 17.066667 6.4 25.6v23.466667c0 8.533333-2.133333 12.8-6.4 14.933333s-10.666667 2.133333-17.066667-2.133333l-204.8-140.8v149.333333c38.4 36.266667 57.6 57.6 57.6 64v36.266667c0 8.533333-2.133333 12.8-6.4 17.066666-4.266667 2.133333-10.666667 2.133333-19.2 0l-117.333333-72.533333-117.333333 72.533333c-6.4 4.266667-12.8 4.266667-19.2 0s-6.4-8.533333-6.4-17.066666v-36.266667c0-8.533333 19.2-29.866667 57.6-64v-149.333333l-204.8 140.8c-6.4 4.266667-12.8 6.4-17.066667 2.133333-4.266667-2.133333-6.4-8.533333-6.4-14.933333V684.8c0-8.533333 2.133333-17.066667 6.4-25.6 4.266667-8.533333 8.533333-17.066667 14.933333-21.333333l206.933334-185.6v-192c0-23.466667 8.533333-42.666667 25.6-59.733334s36.266667-25.6 59.733333-25.6z")
                    .attr("fill", aircraftColor)
                    .attr("opacity", 0.8)
                    .attr("transform", "translate(-15, -15) scale(0.03) rotate(90)"); // 再次放大飞机图标
                
                // 添加策略指示器（当有模拟数据时）
                if (websocketStore.hasCurrentSimulation() && websocketStore.currentSimulation.solution) {
                    const solution = websocketStore.currentSimulation.solution;
                    
                    // 检查当前飞机是否为目标飞机
                    if (solution.target_flight === id && solution.strategy) {
                        const strategy = solution.strategy;
                        
                        // 策略图标组
                        const strategyIcon = aircraftIcon.append("g")
                            .attr("class", `strategy-indicator-${id}`)
                            .attr("transform", "translate(12, -3)"); // 调整策略图标位置，适应Y轴左侧显示
                        
                        // 策略图标背景圆圈（去掉边框）
                        strategyIcon.append("circle")
                            .attr("cx", 0)
                            .attr("cy", 0)
                            .attr("r", 8)
                            .attr("fill", "white")
                            .attr("opacity", 0.9);
                        
                        // 根据策略类型绘制不同图标
                        const iconColor = strategy === 'emergency_mode' ? STRATEGY_COLORS.EMERGENCY_MODE
                            : strategy === 'waiting' ? STRATEGY_COLORS.WAITING
                            : strategy === 'rerouting' ? STRATEGY_COLORS.REROUTING
                            : STRATEGY_COLORS.DEFAULT;
                        
                        if (strategy === 'emergency_mode') {
                            // 紧急模式：感叹号
                            strategyIcon.append("rect")
                                .attr("x", -1)
                                .attr("y", -4)
                                .attr("width", 2)
                                .attr("height", 6)
                                .attr("fill", iconColor);
                            strategyIcon.append("circle")
                                .attr("cx", 0)
                                .attr("cy", 3)
                                .attr("r", 1)
                                .attr("fill", iconColor);
                        } else if (strategy === 'waiting') {
                            // 等待策略：时钟
                            strategyIcon.append("circle")
                                .attr("cx", 0)
                                .attr("cy", 0)
                                .attr("r", 5)
                                .attr("stroke", iconColor)
                                .attr("stroke-width", 1)
                                .attr("fill", "none");
                            strategyIcon.append("line")
                                .attr("x1", 0)
                                .attr("y1", 0)
                                .attr("x2", 0)
                                .attr("y2", -3)
                                .attr("stroke", iconColor)
                                .attr("stroke-width", 1);
                            strategyIcon.append("line")
                                .attr("x1", 0)
                                .attr("y1", 0)
                                .attr("x2", 2)
                                .attr("y2", 1)
                                .attr("stroke", iconColor)
                                .attr("stroke-width", 1);
                        } else if (strategy === 'rerouting') {
                            // 重新路由：弯曲箭头
                            const pathD = "M-3,-2 Q0,-4 3,-2 L2,-3 M3,-2 L2,-1";
                            strategyIcon.append("path")
                                .attr("d", pathD)
                                .attr("stroke", iconColor)
                                .attr("stroke-width", 1)
                                .attr("fill", "none");
                        } else {
                            // 默认策略：圆点
                            strategyIcon.append("circle")
                                .attr("cx", 0)
                                .attr("cy", 0)
                                .attr("r", 3)
                                .attr("fill", iconColor);
                        }
                    }
                }
                
                // 移除飞机状态指示器（小圆点）
                // aircraftIcon.append("circle")
                //     .attr("cx", 8)
                //     .attr("cy", 0)
                //     .attr("r", 2)
                //     .attr("fill", isActive ? "#FF6B6B" : "#4ECDC4")
                //     .attr("stroke", "white")
                //     .attr("stroke-width", 1);
            });

            // 在飞机图标原位置（柱状图和时间线之间）添加ID文本
            const aircraftIdGroup = svg.append("g")
                .attr("class", "aircraft-ids")
                .attr("transform", `translate(${margin.left - 50},${margin.top})`);

            aircraftIds.forEach((id, i) => {
                const yBase = getYPosition(id);
                
                aircraftIdGroup.append("text")
                    .attr("x", 0)
                    .attr("y", yBase)
                    .attr("dy", "0.32em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", "12px")
                    .attr("font-weight", "bold")
                    .attr("fill", "#333")
                    .text(id);
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
                .attr("height", 100)
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
                .text(t('legend.title'));

            // Active Aircraft 图例
            const activeLegend = legendGroup.append("g")
                .attr("transform", "translate(0, 35)");

            activeLegend.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", AIRCRAFT_COLORS.ACTIVE)
                .attr("stroke-width", TIMELINE_STYLES.LINE_WIDTH)
                .attr("stroke-linecap", "round");

            activeLegend.append("circle")
                .attr("cx", 20)
                .attr("cy", 0)
                .attr("r", TIMELINE_POINT_RADIUS)
                .attr("fill", AIRCRAFT_COLORS.ACTIVE)
                .attr("stroke", AIRCRAFT_COLORS.ACTIVE)
                .attr("stroke-width", 2);

            activeLegend.append("text")
                .attr("x", 35)
                .attr("y", 5)
                .attr("font-size", "12px")
                .attr("fill", "#333")
                .text(t('legend.active'));

            // Planning Aircraft 图例
            const planningLegend = legendGroup.append("g")
                .attr("transform", "translate(0, 55)");

            planningLegend.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", AIRCRAFT_COLORS.PLANNING)
                .attr("stroke-width", TIMELINE_STYLES.LINE_WIDTH)
                .attr("stroke-linecap", "round")
                .attr("stroke-dasharray", TIMELINE_STYLES.PLANNING_DASH);

            planningLegend.append("circle")  
                .attr("cx", 20)
                .attr("cy", 0)
                .attr("r", TIMELINE_POINT_RADIUS)
                .attr("fill", "white")
                .attr("stroke", AIRCRAFT_COLORS.PLANNING)
                .attr("stroke-width", 2);

            planningLegend.append("text")
                .attr("x", 35)
                .attr("y", 5)
                .attr("font-size", "12px")
                .attr("fill", "#333")
                .text(t('legend.planning'));
      

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

    // 当表格数据源变化时，重绘跨区域连接线
    useEffect(() => {
        requestAnimationFrame(drawRowToIconConnectors);
    }, [tableDataSource]);



    // 表格容器滚动处理函数
    const handleTableContainerScroll = (e) => {
        const { scrollTop } = e.target;
        if (chartRef.current && chartRef.current.scrollTop !== scrollTop) {
            chartRef.current.scrollTop = scrollTop;
        }
        // 同步更新连接线位置
        requestAnimationFrame(drawRowToIconConnectors);
    };

    const handleChartScroll = (e) => {
        const { scrollTop } = e.target;
        if (tableRef.current && tableRef.current.scrollTop !== scrollTop) {
            tableRef.current.scrollTop = scrollTop;
        }
        // 同步更新连接线位置
        requestAnimationFrame(drawRowToIconConnectors);
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden', // 防止出现滚动条
            padding: '10px',
            boxSizing: 'border-box',
            position: 'relative'
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
                        width: '33.33%', // 调整为1/3
                        height: '100%',
                        overflowX: 'hidden'
                    }}
                >
                    <SVGTable
                        columns={columnsI18n}
                        dataSource={tableDataSource}
                        rowHeight={ROW_HEIGHT}
                        headerHeight={HEADER_HEIGHT}
                        onScroll={handleTableContainerScroll}
                        tableRef={tableRef}
                        className={styles.prettyScrollbar}
                    />
                </div>

                {/* 右侧图表 */}
                <div
                    ref={chartRef}
                    onScroll={handleChartScroll}
                    className={styles.hideScrollbar}
                    style={{
                        width: '66.67%', // 调整为2/3
                        height: '100%',
                        overflow: 'auto',
                        // backgroundColor:'red'
                    }}
                >
                    {/* 顶部粘性时间轴与“飞机ID”标题 */}
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 20,
                        background: '#ffffff',
                        borderBottom: '1px solid #f0f0f0'
                    }}
                >
                    <svg
                        ref={svgAxisRef}
                        width="100%"
                        height={HEADER_HEIGHT}
                        preserveAspectRatio="xMidYMid meet"
                        style={{
                            maxWidth: '100%',
                            display: 'block',
                            background: '#ffffff'
                        }}
                    />
                </div>
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
                {/* 覆盖层：绘制跨区域连接线 */}
                <svg
                    ref={overlayRef}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5, clipPath: `inset(${HEADER_HEIGHT}px 0 0 0)` }}
                />
            </div>
        </div>
    );
})

export default PlanningView;