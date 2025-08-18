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

// const testData = {
//     'planned_flights': {
//         'CCA1642': { 'path': [['841', 1], ['840', 1], ['839', 1], ['838', 1], ['837', 1], ['836', 1], ['835', 1], ['834', 1], ['833', 1], ['2822', 1], ['736', 0], ['737', 0], ['2851', 1], ['2855', 1], ['2840', 1], ['2839', 1], ['2838', 0], ['2830', 0], ['2831', 0], ['2832', 0], ['2833', 0], ['2834', 0]], 'node_path': ['775', '774', '773', '772', '771', '770', '769', '768', '767', '766', '671', '672', '673', '1826', '1821', '1820', '1819', '1813', '1814', '1815', '1816', '1817', '1818'], 'taxiway_sequence': ['841', '840', '839', '838', '837', '836', '835', '834', '833', '2822', '736', '737', '2851', '2855', '2840', '2839', '2838', '2830', '2831', '2832', '2833', '2834'], 'taxi_time': 449.3087355738903, 'start_time': 6, 'origin': '775', 'destination': '1818', 'time_to_takeoff': 7 },
//         'CHH7538': { 'path': [['344', 0], ['345', 0], ['346', 0], ['347', 0], ['348', 0], ['349', 0], ['350', 0], ['351', 0], ['352', 0], ['2126', 1], ['2124', 1], ['2123', 1], ['2122', 1], ['2130', 0], ['2132', 0]], 'node_path': ['294', '295', '296', '297', '298', '299', '300', '301', '302', '303', '1552', '1551', '1550', '1549', '1554', '1968'], 'taxiway_sequence': ['344', '345', '346', '347', '348', '349', '350', '351', '352', '2126', '2124', '2123', '2122', '2130', '2132'], 'taxi_time': 576.7686521583825, 'start_time': 116, 'origin': '294', 'destination': '1968', 'time_to_takeoff': 11 },
//         'ETH605': { 'path': [['1389', 1], ['1388', 1], ['160', 1], ['159', 1], ['158', 1], ['157', 1], ['156', 1], ['155', 1], ['154', 1], ['153', 1], ['152', 1], ['151', 1], ['150', 1], ['149', 1], ['148', 1], ['147', 1], ['146', 1], ['2639', 1], ['893', 1], ['2627', 0], ['818', 1], ['817', 1], ['816', 1], ['2724', 1], ['658', 1], ['2720', 0], ['186', 1], ['185', 1], ['184', 1], ['183', 1], ['182', 1], ['181', 1], ['2716', 1], ['64', 1]], 'node_path': ['1996', '1149', '131', '130', '129', '128', '127', '126', '125', '124', '123', '122', '121', '120', '119', '118', '117', '116', '824', '823', '1745', '751', '750', '749', '598', '597', '152', '151', '150', '149', '148', '147', '146', '42', '41'], 'taxiway_sequence': ['1389', '1388', '160', '159', '158', '157', '156', '155', '154', '153', '152', '151', '150', '149', '148', '147', '146', '2639', '893', '2627', '818', '817', '816', '2724', '658', '2720', '186', '185', '184', '183', '182', '181', '2716', '64'], 'taxi_time': 1179.5237413367543, 'start_time': 118, 'origin': '1996', 'destination': '41', 'time_to_takeoff': 21 },
//         'CHH7716': { 'path': [['1618', 0], ['797', 1], ['796', 1], ['795', 1], ['794', 1], ['793', 1], ['792', 1], ['937', 1], ['791', 1], ['790', 1], ['789', 1], ['788', 1], ['787', 1], ['786', 1], ['1771', 0], ['880', 0], ['881', 0], ['882', 0], ['1932', 0], ['1934', 0], ['1936', 0], ['1785', 0], ['1786', 0], ['1787', 0]], 'node_path': ['745', '731', '730', '729', '728', '727', '726', '725', '863', '724', '723', '722', '721', '720', '719', '811', '812', '813', '814', '1456', '1457', '1391', '1392', '1393', '1920'], 'taxiway_sequence': ['1618', '797', '796', '795', '794', '793', '792', '937', '791', '790', '789', '788', '787', '786', '1771', '880', '881', '882', '1932', '1934', '1936', '1785', '1786', '1787'], 'taxi_time': 925.6569040229369, 'start_time': 258, 'origin': '745', 'destination': '1920', 'time_to_takeoff': 19 },
//         'CHH7184': { 'path': [['1563', 1], ['2895', 1], ['2894', 0], ['345', 0], ['346', 0], ['347', 0], ['348', 0], ['349', 0], ['350', 0], ['351', 0], ['352', 0], ['2126', 1], ['2124', 1], ['2127', 1], ['841', 0], ['842', 0], ['843', 0], ['844', 0], ['847', 0], ['848', 0], ['849', 0], ['850', 0], ['851', 0], ['852', 0], ['2098', 0], ['1459', 1], ['1458', 1], ['1457', 1], ['1456', 1], ['1455', 1], ['1454', 1], ['1453', 1], ['1452', 1], ['1451', 1], ['1654', 1]], 'node_path': ['397', '1278', '1845', '295', '296', '297', '298', '299', '300', '301', '302', '303', '1552', '1551', '774', '775', '776', '777', '778', '779', '780', '781', '782', '783', '784', '1203', '1202', '1201', '1200', '1199', '1198', '1197', '1196', '1195', '1194', '1329'], 'taxiway_sequence': ['1563', '2895', '2894', '345', '346', '347', '348', '349', '350', '351', '352', '2126', '2124', '2127', '841', '842', '843', '844', '847', '848', '849', '850', '851', '852', '2098', '1459', '1458', '1457', '1456', '1455', '1454', '1453', '1452', '1451', '1654'], 'taxi_time': 1193.6505629027668, 'start_time': 577, 'origin': '397', 'destination': '1329', 'time_to_takeoff': 29 },
//         'UZB502': { 'path': [['2968', 1]], 'node_path': ['1868', '1869'], 'taxiway_sequence': ['2968'], 'taxi_time': 55.24926167354947, 'start_time': 99, 'origin': '1868', 'destination': '1869', 'time_to_takeoff': 2 },
//         'CCA1346': { 'path': [['2642', 1], ['143', 1], ['142', 1], ['141', 1], ['140', 1], ['139', 1], ['138', 1], ['137', 1], ['136', 1], ['135', 1], ['134', 1], ['133', 1], ['132', 1], ['131', 1], ['130', 1], ['129', 1], ['128', 1], ['2675', 0]], 'node_path': ['834', '114', '113', '112', '111', '110', '109', '108', '107', '106', '105', '104', '103', '102', '101', '100', '99', '98', '2003'], 'taxiway_sequence': ['2642', '143', '142', '141', '140', '139', '138', '137', '136', '135', '134', '133', '132', '131', '130', '129', '128', '2675'], 'taxi_time': 254.48942158563852, 'start_time': 201, 'origin': '834', 'destination': '2003', 'time_to_takeoff': 7 },
//         'UAE307': { 'path': [['2716', 1], ['64', 1]], 'node_path': ['146', '42', '41'], 'taxiway_sequence': ['2716', '64'], 'taxi_time': 118.44060108174774, 'start_time': 118, 'origin': '146', 'destination': '41', 'time_to_takeoff': 3 },
//         'CCD1918': { 'path': [['1588', 1], ['2610', 1], ['2607', 1], ['2605', 1], ['193', 1], ['2624', 1], ['891', 0], ['2628', 1], ['2630', 0], ['904', 0], ['2642', 1], ['143', 1], ['142', 1], ['141', 1], ['140', 1], ['139', 1], ['138', 1], ['137', 1], ['136', 1], ['135', 1], ['134', 1], ['133', 1], ['132', 1], ['131', 1], ['130', 1], ['129', 1], ['128', 1], ['127', 1], ['126', 1], ['125', 1], ['124', 1], ['2661', 0], ['254', 0], ['2477', 0], ['552', 1], ['551', 1], ['550', 1], ['549', 1], ['548', 1], ['547', 1], ['546', 1], ['545', 1], ['544', 1], ['543', 1], ['542', 1], ['541', 1], ['540', 1], ['539', 1], ['538', 1], ['537', 1], ['536', 1], ['535', 1], ['2556', 1], ['2572', 0]], 'node_path': ['398', '1294', '1743', '1741', '159', '158', '821', '822', '1745', '833', '834', '114', '113', '112', '111', '110', '109', '108', '107', '106', '105', '104', '103', '102', '101', '100', '99', '98', '97', '96', '95', '94', '214', '215', '495', '494', '493', '492', '491', '490', '489', '488', '487', '486', '485', '484', '483', '482', '481', '480', '479', '478', '477', '1724', '2050'], 'taxiway_sequence': ['1588', '2610', '2607', '2605', '193', '2624', '891', '2628', '2630', '904', '2642', '143', '142', '141', '140', '139', '138', '137', '136', '135', '134', '133', '132', '131', '130', '129', '128', '127', '126', '125', '124', '2661', '254', '2477', '552', '551', '550', '549', '548', '547', '546', '545', '544', '543', '542', '541', '540', '539', '538', '537', '536', '535', '2556', '2572'], 'taxi_time': 1257.0560552121317, 'start_time': 459, 'origin': '398', 'destination': '2050', 'time_to_takeoff': 28 }
//     },
//     "active_flights": { 'CCA1642': { 'path': [['841', 1], ['840', 1], ['839', 1], ['838', 1], ['837', 1], ['836', 1], ['835', 1], ['834', 1], ['833', 1], ['2822', 1], ['736', 0], ['737', 0], ['2851', 1], ['2855', 1], ['2840', 1], ['2839', 1], ['2838', 0], ['2830', 0], ['2831', 0], ['2832', 0], ['2833', 0], ['2834', 0]], 'node_path': ['775', '774', '773', '772', '771', '770', '769', '768', '767', '766', '671', '672', '673', '1826', '1821', '1820', '1819', '1813', '1814', '1815', '1816', '1817', '1818'], 'taxiway_sequence': ['841', '840', '839', '838', '837', '836', '835', '834', '833', '2822', '736', '737', '2851', '2855', '2840', '2839', '2838', '2830', '2831', '2832', '2833', '2834'], 'taxi_time': 449.3087355738903, 'start_time': '2023-11-02T00:00:06', 'origin': '775', 'destination': '1818', 'remaining_taxi_time': 65.80714, 'time_to_takeoff': 5 } },
//     "conflicts":
//         [
//             { "flight1": "CCA1642", "flight2": "CHH7184", "node": "841", "time": 1 },
//             { "flight1": "ETH605", "flight2": "UAE307", "node": "2716", "time": 2 },
//         ]
// };


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

    // 处理航班数据，生成表格数据源
    const processFlightData = (plannedData) => {
        const tableData = [];
        const aircraftIds = [];

        // 处理planned_flights数据
        if (plannedData.planned_flights) {
            Object.entries(plannedData.planned_flights).forEach(([flightId, flightData]) => {
                aircraftIds.push(flightId);

                // 检查该航班是否也在active_flights中
                const isInActive = plannedData.active_flights && plannedData.active_flights[flightId];

                if (isInActive) {
                    // 如果在active_flights中，使用active_flights的数据
                    const activeData = plannedData.active_flights[flightId];
                    tableData.push({
                        key: flightId,
                        flight_id: flightId,
                        status: 'normal', // 既在planned又在active中，状态为normal
                        taxi_time: activeData.taxi_time / 60, // 转换为分钟
                        start_time: activeData.start_time, // 保持原格式
                        time_to_takeoff: activeData.time_to_takeoff,
                        remaining_taxi_time: activeData.remaining_taxi_time, // 秒为单位
                        origin: activeData.origin,
                        destination: activeData.destination
                    });
                } else {
                    // 只在planned_flights中，状态为planned
                    tableData.push({
                        key: flightId,
                        flight_id: flightId,
                        status: 'planned',
                        taxi_time: flightData.taxi_time / 60, // 转换为分钟
                        start_time: flightData.start_time, // 数字格式（秒）
                        time_to_takeoff: flightData.time_to_takeoff,
                        remaining_taxi_time: null, // planned_flights没有剩余时间
                        origin: flightData.origin,
                        destination: flightData.destination
                    });
                }
            });
        }

        // 处理只在active_flights中的航班（如果有的话）
        if (plannedData.active_flights) {
            Object.entries(plannedData.active_flights).forEach(([flightId, flightData]) => {
                // 如果该航班不在planned_flights中
                if (!plannedData.planned_flights || !plannedData.planned_flights[flightId]) {
                    aircraftIds.push(flightId);
                    tableData.push({
                        key: flightId,
                        flight_id: flightId,
                        status: 'normal',
                        taxi_time: flightData.taxi_time / 60, // 转换为分钟
                        start_time: flightData.start_time,
                        time_to_takeoff: flightData.time_to_takeoff,
                        remaining_taxi_time: flightData.remaining_taxi_time,
                        origin: flightData.origin,
                        destination: flightData.destination
                    });
                }
            });
        }
        // console.log("tableData: ", tableData);
        return { tableData, aircraftIds };
    };

    useEffect(() => {
        const svg = d3.select(svgRef.current);

        // 创建 D3 元素引用


        const updatePlanningView = (plannedData) => {
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
            //柱状图的处理
            // 处理计划航班
            if (plannedData.planned_flights) {
                Object.entries(plannedData.planned_flights).forEach(([flightId, flightData]) => {

                    // planned_flights的start_time是数字（秒），需要转换为分钟
                    const startTimeMinutes = flightData.start_time / 60;
                    const taxiTimeMinutes = flightData.taxi_time / 60;
                    const timeToTakeoff = flightData.time_to_takeoff;

                    const convertedData = {
                        aircraft_id: flightId,
                        type: 'planning', // 计划航班类型
                        time_to_start: startTimeMinutes,
                        taxi_time: taxiTimeMinutes,
                        paths: [{
                            start_time: startTimeMinutes, // 开始时间
                            end_time: startTimeMinutes + taxiTimeMinutes, // 结束时间
                            duration: taxiTimeMinutes, // 持续时间
                            path: flightData.path
                        }],
                        conflicts: [] // 后续处理冲突
                    };

                    plannedResults.push(convertedData);
                    left_times.push(startTimeMinutes);
                    plan_times.push(taxiTimeMinutes);//计划航班的计划时间
                    fly_times.push(timeToTakeoff);

                    // 计算planned flight的结束时间作为maxTime的参考
                    const endTime = startTimeMinutes + taxiTimeMinutes;
                    if (endTime > maxTime) {
                        maxTime = endTime;
                    }
                });
            }
          
            // 处理活跃航班
            if (plannedData.active_flights) {
    
                Object.entries(plannedData.active_flights).forEach(([flightId, flightData]) => {
                    
                    // active_flights的remaining_taxi_time是剩余时间（秒），转换为分钟
                    const remainingTimeMinutes = (flightData.remaining_taxi_time || 0) / 60;
                    const timeToTakeoff = flightData.time_to_takeoff;
                    // console.log('flightData--------------:', flightData);
                    // console.log('timeToTakeoff--------------:', timeToTakeoff);
                    // console.log('remainingTimeMinutes--------------:', remainingTimeMinutes);
                    // console.log('rime--------------:', flightData.time_to_takeoff);
                    const convertedData = {
                        aircraft_id: flightId,
                        type: 'active', // 活跃航班类型
                        time_to_takeoff: flightData.time_to_takeoff, // 添加time_to_takeoff字段
                        paths: [{
                            time: remainingTimeMinutes, // 剩余时间
                            path: flightData.path
                        }],
                        plan_time: remainingTimeMinutes,
                        conflicts: [] // 后续处理冲突
                    };

                    plannedResults.push(convertedData);
                    left_times.push(0);
                    plan_times.push(remainingTimeMinutes); // 活跃航班的剩余时间
                    fly_times.push(timeToTakeoff);


                    if (remainingTimeMinutes > maxTime) {
                        maxTime = remainingTimeMinutes;
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
           const height = requiredHeight+200; // 额外增加200px用于边距和图例
           
            const margin = { top:0, right: 100, bottom: 80, left: 150 }; // 增加各边距以容纳图例和标签

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
            const chartHeight = (aircraftIds.length+1) * ROW_HEIGHT_P+HEADER_HEIGHT;
           
            // 使用序数比例尺来精确控制行位置，确保与表格完全对齐
            const yScale = d3.scaleOrdinal()
                .domain(aircraftIds)
                .range(aircraftIds.map((_, index) => (HEADER_HEIGHT + index* ROW_HEIGHT_P+(ROW_HEIGHT_P/2))));
          
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

            let activeIndex = 0;
            let planningIndex = 0;

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
                    .attr("x1", d => {
                        // 对于planned flights，从start_time开始；对于active flights，从0开始
                        return plannedResult.type === 'planning' ? xScale(d.start_time) : xScale(0);
                    })
                    .attr("x2", d => {
                        // 对于planned flights，到end_time结束；对于active flights，到time结束
                        return plannedResult.type === 'planning' ? xScale(d.end_time) : xScale(d.time);
                    })
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
                    .attr("cx", d => {
                        // 对于planned flights，起始点在start_time；对于active flights，起始点在0
                        return plannedResult.type === 'planning' ? xScale(d.start_time) : xScale(0);
                    })
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
                    .attr("cx", d => {
                        // 对于planned flights，结束点在end_time；对于active flights，结束点在time
                        return plannedResult.type === 'planning' ? xScale(d.end_time) : xScale(d.time);
                    })
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
                            const x = plannedResult.type === 'planning' ? xScale(d.end_time) : xScale(d.time);
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
            // 绘制水平线（时间线）
            // for (let plannedResult of plannedResults) {

            //     console.log("Planned Result:", JSON.stringify(plannedResult));

            //     flight = g.selectAll(".flight")
            //         .data(plannedResult.evaluations)
            //         .enter()
            //         .append("g")
            //         .attr("class", "flight");

            //     let color = colors[index % colors.length];
            //     index ++;

            //     flight.append("line")
            //         .attr("x1", d => xScale(0))
            //         .attr("x2", (d) => {console.log("x2"+xScale(d[1])); return xScale(d[1])} )
            //         .attr("y1", (d, i) => {console.log("y1"+yScale(plannedResult.aircraft_id)); return 3*i+yScale(plannedResult.aircraft_id)})
            //         .attr("y2", (d, i) => {return 3*i+yScale(plannedResult.aircraft_id)})
            //         .attr("stroke", color)
            //         .attr("stroke-width", 2)
            //         .attr("stroke-linecap", "round");

            //     flights.push(flight);


            // }


            // flights.append("line")
            //     .attr("x1", d => xScale(0))
            //     .attr("x2", d => xScale(d.evaluations[1]))
            //     .attr("y1", d => yScale(d.aircraft_id))
            //     .attr("y2", d => yScale(d.id))
            //     .attr("stroke", d => {
            //         if (d.status === 'delayed') return '#e74c3c';
            //         if (d.status === 'early') return '#2ecc71';
            //         return '#3498db';
            //     })
            //     .attr("stroke-width", 4)
            //     .attr("stroke-linecap", "round");   

            // // 绘制起始点
            // flights.append("circle")
            //     .attr("cx", d => xScale(d.t0))
            //     .attr("cy", d => yScale(d.id))
            //     .attr("r", 5)
            //     .attr("fill", d => {
            //         if (d.status === 'delayed') return '#e74c3c';
            //         if (d.status === 'early') return '#2ecc71';
            //         return '#3498db';
            //     })
            //     .attr("stroke", "white")
            //     .attr("stroke-width", 1);

            // // 绘制结束点
            // flights.append("circle")
            //     .attr("cx", d => xScale(d.t1))
            //     .attr("cy", d => yScale(d.id))
            //     .attr("r", 5)
            //     .attr("fill", d => {
            //         if (d.status === 'delayed') return '#e74c3c';
            //         if (d.status === 'early') return '#2ecc71';
            //         return '#3498db';
            //     })
            //     .attr("stroke", "white")
            //     .attr("stroke-width", 1);

            // // 添加时间标签
            // flights.append("text")
            //     .attr("x", d => xScale(d.t0) - 5)
            //     .attr("y", d => yScale(d.id) - 10)
            //     .attr("text-anchor", "end")
            //     .attr("fill", "#7f8c8d")
            //     .attr("font-size", "10px")
            //     .text(d => `T0: ${d.t0.toFixed(1)}`);


            // 1. 柱状图参数
            const barWidth = 12;
            const barGap = 4;
            const barChartHeight = 80; // 增加柱状图最大高度
            const barChartOffset = -150; // 增加柱状图距离主图的偏移

            // 2. 柱状图比例尺
            const maxBarValue = Math.max(...left_times, ...plan_times, ...fly_times);
            const barScale = d3.scaleLinear()
                .domain([0, maxBarValue])
                .range([0, barChartHeight]);

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

            // 添加d3拖拽行为定义
            const createTaxiSliderDrag = (aircraftId, taxiTime, totalTimeToTakeoff) => {
                return d3.drag()
                    .on("start", function(event) {
                        // 拖拽开始事件
                        d3.select(this).attr("cursor", "grabbing");
                        // 设置拖拽状态，防止WebSocket数据更新干扰
                        websocketStore.setDraggingState(true, aircraftId);
                        console.log(`开始拖拽飞机 ${aircraftId}`);
                    })
                    .on("drag", function(event) {
                        // 拖拽过程中的事件处理
                        const currentElement = d3.select(this);
                        
                        // 获取当前滑块的x位置
                        let currentX = parseFloat(currentElement.attr("x"));
                        
                        // 计算新的x位置（基于鼠标移动距离）
                        let newX = currentX + event.dx;
                        
                        // 计算边界限制
                        const minX = 0; // 最左边界
                        const maxX = barScale(totalTimeToTakeoff - taxiTime); // 最右边界
                        
                        // 应用边界限制
                        newX = Math.max(minX, Math.min(newX, maxX));
                        
                        // 更新滑块位置
                        currentElement.attr("x", newX);
                        
                        // 计算新的开始时间
                        const newStartTime = xScale.invert(newX);
                        
                        // 实时更新时间线图
                        updateTimelineForAircraft(aircraftId, newStartTime, taxiTime);
                    })
                    .on("end", function(event) {
                        // 拖拽结束事件
                        const currentElement = d3.select(this);
                        currentElement.attr("cursor", "grab");
                        
                        // 计算最终位置和时间
                        const finalX = parseFloat(currentElement.attr("x"));
                        const finalStartTime = xScale.invert(finalX);
                        
                        // 更新数据模型
                        const aircraftData = plannedResults.find(result => result.aircraft_id === aircraftId);
                        const time_to_start = aircraftData.time_to_start;

                        if (aircraftData) {
                            aircraftData.time_to_start = finalStartTime;
                            aircraftData.paths[0].start_time = finalStartTime;
                            aircraftData.paths[0].end_time = finalStartTime + taxiTime;
                        }
                        
                        websocketStore.adjustFlightTime(aircraftId, (finalStartTime-time_to_start)*60);

                        
                        // 清除拖拽状态
                        websocketStore.setDraggingState(false, null);
                        
                        console.log(`飞机 ${aircraftId} 拖拽完成，新的起飞时间: ${finalStartTime.toFixed(2)} 分钟`);
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
                        planBarGroup.append("rect")
                            .attr("class", "time-track")
                            .attr("x", 0)
                            .attr("y", yBase) 
                            .attr("width", barScale(totalTimeToTakeoff)+1)
                            .attr("height", barWidth) 
                            .attr("fill", "#f0f0f0")
                            .attr("stroke", "#d0d0d0")
                            .attr("stroke-width", 1)
                            .attr("rx", 2);

                        // 计算当前taxi_time滑块的位置
                        const currentStartTime = left_times[i] || 0;
                        const taxiTime = aircraftData.taxi_time || plan_times[i];

                        // 绘制可拖拽的taxi_time滑块
                        const taxiSlider = planBarGroup.append("rect")
                            .attr("class", `taxi-slider-${id}`)
                            .attr("x", barScale(currentStartTime))
                            .attr("y", yBase)
                            .attr("width", barScale(taxiTime))
                            .attr("height", barWidth)
                            .attr("fill", planTimeColor)
                            .attr("opacity", barOpacity)
                            .attr("stroke-dasharray", "3,3")
                            .attr("cursor", "grab")
                            .attr("rx", 2)
                            // 应用d3拖拽行为
                            .call(createTaxiSliderDrag(id, taxiTime, totalTimeToTakeoff));
                        }
                         else {
                        // 活跃飞机：绘制灰色背景条(time_to_takeoff)和彩色滑块(remaining-taxi-time)
                        console.log("活跃飞机",aircraftData);

                        const activeBarGroup = barGroup.append("g")
                            .attr("class", `active-bar-group-${id}`);

                        // 获取活跃飞机的time_to_takeoff数据
                        const timeToTakeoffMinutes = (aircraftData.time_to_takeoff || 0)+10; // 转换为分钟
                        const remainingTimeMinutes = aircraftData.plan_time+3; // 剩余滑行时间

                        // 绘制背景轨道（显示总的time_to_takeoff范围）
                        activeBarGroup.append("rect")
                            .attr("class", "active-time-track")
                            .attr("x", 0)
                            .attr("y", yBase - 2)
                            .attr("width", barScale(timeToTakeoffMinutes))
                            .attr("height", barWidth + 4)
                            .attr("fill", "#f0f0f0")
                            .attr("stroke", "#d0d0d0")
                            .attr("stroke-width", 1)
                            .attr("rx", 2);

                        // 绘制剩余滑行时间滑块（从0开始，长度为remaining-taxi-time）
                        activeBarGroup.append("rect")
                            .attr("class", `remaining-slider-${id}`)
                            .attr("x", 0) // 从0开始
                            .attr("y", yBase)
                            .attr("width", barScale(remainingTimeMinutes)) // 长度为剩余时间
                            .attr("height", barWidth)
                            .attr("fill", planTimeColor)
                            .attr("opacity", barOpacity)
                            .attr("stroke", "#C44569")
                            .attr("stroke-width", 2)
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
                // 可选：加数值标签
                // barGroup.append("text")
                //     .attr("x", barScale(left_times[i]) + 5)
                //     .attr("y", yBase + barWidth / 2 + 4)
                //     .attr("text-anchor", "start")
                //     .attr("font-size", "10px")
                //     .attr("fill", "#1f77b4")
                //     .text(left_times[i]);
                // barGroup.append("text")
                //     .attr("x", barScale(plan_times[i]) + 5)
                //     .attr("y", yBase + barWidth + barGap + barWidth / 2 + 4)
                //     .attr("text-anchor", "start")
                //     .attr("font-size", "10px")
                //     .attr("fill", "#ff7f0e")
                //     .text(plan_times[i]);
        

            // 添加图例
            const legendGroup = svg.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${width - 250}, 30)`); // 调整图例位置，确保在可视区域内

            // 图例背景
            legendGroup.append("rect")
                .attr("x", -10)
                .attr("y", -10)
                .attr("width", 180)
                .attr("height", 120)
                .attr("fill", "white")
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

            // 在主图g上绘制冲突点和连接线
            // 新格式中冲突信息在顶层conflicts数组中
            if (plannedData.conflicts && plannedData.conflicts.length > 0) {
                plannedData.conflicts.forEach(conflict => {
                    // console.log("Processing conflict:", conflict);

                    // 根据新的冲突数据格式处理：flight1, flight2, time
                    // if (conflict.flight1 && conflict.flight2 && conflict.time !== undefined) {
                    //     const flight1Id = conflict.flight1;
                    //     const flight2Id = conflict.flight2;
                    //     const conflictTime = conflict.time;
                        

                    //     // 检查两架飞机是否都在aircraftIds中
                    //     if (aircraftIds.includes(flight1Id) && aircraftIds.includes(flight2Id)) {
                    //         const y1 = getYPosition(flight1Id);
                    //         const y2 = getYPosition(flight2Id);
                    //         const x = xScale(conflictTime); // 冲突时间点的x坐标

                      if (Array.isArray(conflict) && conflict.length >= 3) {
                        const conflictId = conflict[0]; // 冲突ID
                        const flightIds = conflict[1]; // 航班ID数组
                        const conflictTime = conflict[2]; // 冲突时间
            
                        // 确保航班ID数组包含两个元素
                        if (Array.isArray(flightIds) && flightIds.length >= 2) {
                            const flight1Id = flightIds[0];
                            const flight2Id = flightIds[1];

                            // 检查两架飞机是否都在aircraftIds中
                            if (aircraftIds.includes(flight1Id) && aircraftIds.includes(flight2Id)) {
                                const y1 = getYPosition(flight1Id);
                                const y2 = getYPosition(flight2Id);
                                const x = xScale(conflictTime); // 冲突时间点的x坐标

                                        // 绘制冲突点（在每架飞机的时间线上）
                                        g.append("circle")
                                            .attr("cx", x)
                                            .attr("cy", y1)
                                            .attr("r", 6)
                                            .attr("fill", "red")
                                            .attr("stroke", "white")
                                            .attr("stroke-width", 2);

                                        g.append("circle")
                                            .attr("cx", x)
                                            .attr("cy", y2)
                                            .attr("r", 6)
                                            .attr("fill", "red")
                                            .attr("stroke", "white")
                                            .attr("stroke-width", 2);

                                        // 绘制连接两架飞机的冲突线
                                        g.append("line")
                                            .attr("x1", x)
                                            .attr("y1", y1)
                                            .attr("x2", x)
                                            .attr("y2", y2)
                                            .attr("stroke", "red")
                                            .attr("stroke-width", 3)
                                            .attr("stroke-dasharray", "5,5")
                                            .attr("opacity", 0.8);

                                        // 添加冲突标识文本
                                        g.append("text")
                                            .attr("x", x + 10)
                                            .attr("y", (y1 + y2) / 2)
                                            .attr("font-size", "10px")
                                            .attr("fill", "red")
                                            .attr("font-weight", "bold")
                                            .text(`冲突@${conflictTime.toFixed(2)}`);
                                }
                        }
                }});
            }


        };

        //这里的逻辑应该是前端按按钮向后端传要规划的飞机id,后端返回结果
        const disposer = autorun(() => {
            // console.log("=== PlanningView autorun triggered ===");
            // console.log("websocketStore:", websocketStore);
            // console.log("websocketStore.plannedFlights:", websocketStore.plannedFlights);
            // console.log("typeof websocketStore.plannedFlights:", typeof websocketStore.plannedFlights);
            // console.log("websocketStore.plannedFlights keys:", websocketStore.plannedFlights ? Object.keys(websocketStore.plannedFlights) : 'null/undefined');

            let plannedFlights = websocketStore.plannedFlights;

            
            if (websocketStore.plannedFlights &&
                Object.keys(websocketStore.plannedFlights).length > 0) {

                // console.log("Planned Path:", JSON.stringify(websocketStore.plannedPath));
                // console.log("Planned Flights:", plannedFlights);
                // console.log("Active Flights:", websocketStore.activeFlights);
                // console.log("Path Conflicts:", websocketStore.pathConflicts);

                // 使用新的数据格式更新视图
                updatePlanningView(plannedFlights);

            }
            else {
                console.log("WebSocket data not received, using test data...");
                updatePlanningView(testData); // 使用测试数据填充
            }

        });

        return () => {
            // 清理函数
            disposer();
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