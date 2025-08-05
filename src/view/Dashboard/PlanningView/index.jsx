import React, { useEffect, useRef, useState, useContext } from 'react';
import websocketStore from '@/stores/WebSocketStore';
import { observer } from 'mobx-react';
import { autorun } from 'mobx';
import * as d3 from 'd3';
import { Table } from 'antd';
import { createStyles } from 'antd-style';

const useStyle = createStyles(({ css, token }) => {
  const { antCls } = token;
  return {
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
      }
    `,
  };
});

const columns = [
  {
    title: 'Full Name',
    width: 100,
    dataIndex: 'name',
    key: 'name',
    fixed: 'left',
  },
  {
    title: 'Age',
    width: 100,
    dataIndex: 'age',
    key: 'age',
    fixed: 'left',
  },
  {
    title: 'Column 1',
    dataIndex: 'address',
    key: '1',
    width: 150,
  },
  {
    title: 'Column 2',
    dataIndex: 'address',
    key: '2',
    width: 150,
  },
  {
    title: 'Column 3',
    dataIndex: 'address',
    key: '3',
    width: 150,
  },
  {
    title: 'Column 4',
    dataIndex: 'address',
    key: '4',
    width: 150,
  },
  {
    title: 'Column 5',
    dataIndex: 'address',
    key: '5',
    width: 150,
  },
  {
    title: 'Column 6',
    dataIndex: 'address',
    key: '6',
    width: 150,
  },
  {
    title: 'Column 7',
    dataIndex: 'address',
    key: '7',
    width: 150,
  },
  { title: 'Column 8', dataIndex: 'address', key: '8' },
  { title: 'Column 9', dataIndex: 'address', key: '9' },
  { title: 'Column 10', dataIndex: 'address', key: '10' },
  { title: 'Column 11', dataIndex: 'address', key: '11' },
  { title: 'Column 12', dataIndex: 'address', key: '12' },
  { title: 'Column 13', dataIndex: 'address', key: '13' },
  { title: 'Column 14', dataIndex: 'address', key: '14' },
  { title: 'Column 15', dataIndex: 'address', key: '15' },
  { title: 'Column 16', dataIndex: 'address', key: '16' },
  { title: 'Column 17', dataIndex: 'address', key: '17' },
  { title: 'Column 18', dataIndex: 'address', key: '18' },
  { title: 'Column 19', dataIndex: 'address', key: '19' },
  { title: 'Column 20', dataIndex: 'address', key: '20' },
  {
    title: 'Action',
    key: 'operation',
    fixed: 'right',
    width: 100,
    render: () => <a>action</a>,
  },
];

const dataSource = Array.from({ length: 100 }).map((_, i) => ({
  key: i,
  name: `Edward King ${i}`,
  age: 32,
  address: `London, Park Lane no. ${i}`,
}));

const PlanningView = observer(() => {
    const { styles } = useStyle();
    const width = 1200, height = 400; // 增加尺寸以容纳更多数据
    const svgRef = useRef();
    const d3Container = useRef({});
    const [timeScale, setTimeScale] = useState({ min: 0, max: 100 });

    useEffect(() => {
        const svg = d3.select(svgRef.current);
    
        // 创建 D3 元素引用
       

        const updatePlanningView = (plannedData) => {
            // 适配新的数据格式
            // plannedData: {planned_flights: {...}, active_flights: {...}, conflicts: [...]}
            let maxTime = 0;
            let aircraftIds = [];
            let left_times = [];
            let plan_times = [];
            
            // 转换新数据格式为可视化需要的格式
            const plannedResults = [];
            
            // 处理计划航班
            if (plannedData.planned_flights) {
                Object.entries(plannedData.planned_flights).forEach(([flightId, flightData]) => {
                    aircraftIds.push(flightId);
                    
                    // 转换为原有格式，添加类型标识
                    const convertedData = {
                        aircraft_id: flightId,
                        type: 'planning', // 添加类型标识
                        paths: [{
                            time: flightData.taxi_time / 60, // 转换为分钟
                            path: flightData.path
                        }],
                        left_time: 0, // 计划航班没有剩余时间
                        conflicts: [] // 后续处理冲突
                    };
                    
                    plannedResults.push(convertedData);
                    left_times.push(0);
                    plan_times.push(flightData.taxi_time / 60);
                    
                    if (flightData.taxi_time / 60 > maxTime) {
                        maxTime = flightData.taxi_time / 60;
                    }
                });
            }
            
            // 处理活跃航班
            if (plannedData.active_flights) {
                Object.entries(plannedData.active_flights).forEach(([flightId, flightData]) => {
                    aircraftIds.push(flightId);
                    
                    const convertedData = {
                        aircraft_id: flightId,
                        type: 'active', // 添加类型标识
                        paths: [{
                            time: flightData.remaining_taxi_time / 60, // 转换为分钟
                            path: flightData.path
                        }],
                        left_time: flightData.remaining_taxi_time / 60,
                        conflicts: []
                    };
                    
                    plannedResults.push(convertedData);
                    left_times.push(flightData.remaining_taxi_time / 60);
                    plan_times.push(0); // 活跃航班没有计划时间
                    
                    if (flightData.remaining_taxi_time / 60 > maxTime) {
                        maxTime = flightData.remaining_taxi_time / 60;
                    }
                });
            }

            console.log("aircraftIds:", aircraftIds);
            console.log("Max Time:", maxTime);

            maxTime = Math.ceil(maxTime)
            setTimeScale({ min: 0, max: maxTime });

            // 绘制视图

            const svg = d3.select(svgRef.current);
            const width = 1200; // 与组件定义的宽度保持一致
            
            // 根据飞机数量动态计算所需高度
            const minHeightPerAircraft = 50; // 每架飞机最少需要的高度
            const requiredHeight = aircraftIds.length * minHeightPerAircraft;
            const baseHeight = 400;
            const height = Math.max(baseHeight, requiredHeight + 200); // 额外增加200px用于边距和图例
            
            const margin = { top: 80, right: 250, bottom: 80, left: 150 }; // 增加各边距以容纳图例和标签
            
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
            
            console.log(maxTime, aircraftIds);

            // 创建时间比例尺
            const xScale = d3.scaleLinear()
                            .domain([0, maxTime])
                            .range([0, innerWidth]);
            
            // 创建飞机ID比例尺（点比例尺）
            // 根据飞机数量动态调整高度
            const actualHeight = Math.max(innerHeight, requiredHeight);
            
            const yScale = d3.scalePoint()
                            .domain(aircraftIds)
                            .range([0, actualHeight])
                            .padding(0.5); // 增加间距以避免重叠
            
            // 创建X轴
            const xAxis = d3.axisBottom(xScale)
                        .tickFormat(d => `T+${d.toFixed(0)}`)
                        .tickSizeOuter(0);
            
            // 创建Y轴
            const yAxis = d3.axisLeft(yScale);

            const color = '#000000'; // 默认颜色
            
            // 绘制X轴
            g.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${actualHeight})`)
            .call(xAxis)
            .append("text")
            .attr("x", innerWidth / 2)
            .attr("y", 40)
            .attr("stroke", color)
            .attr("fill", color)
            .attr("text-anchor", "middle")
            .text("时间 (分钟)");
            
            // 绘制Y轴
            g.append("g")
            .attr("class", "y-axis")
            .call(yAxis)
            .append("text")
            .attr("x", -40)
            .attr("y", -30)
            .attr("fill", color)
            .attr("stroke", color)
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-90)")
            .text("飞机 ID");
            
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
            flights.each(function(plannedResult, i) {
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
                    .attr("x1", d => xScale(0))
                    .attr("x2", d => xScale(d.time))
                    .attr("y1", (d, j) => yScale(plannedResult.aircraft_id) + j * 3)
                    .attr("y2", (d, j) => yScale(plannedResult.aircraft_id) + j * 3)
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
                    .attr("cx", d => xScale(0))
                    .attr("cy", (d, j) => yScale(plannedResult.aircraft_id) + j * 3)
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
                    .attr("cx", d => xScale(d.time))
                    .attr("cy", (d, j) => yScale(plannedResult.aircraft_id) + j * 3)
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
                            const x = xScale(d.time);
                            const y = yScale(plannedResult.aircraft_id) - 10;
                            return `${x},${y} ${x-5},${y-8} ${x+5},${y-8}`;
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
                        .attr("x", d => xScale(d.time) - 4)
                        .attr("y", yScale(plannedResult.aircraft_id) - 14)
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
            const barChartOffset = -120; // 增加柱状图距离主图的偏移

            // 2. 柱状图比例尺
            const maxBarValue = Math.max(...left_times, ...plan_times);
            const barScale = d3.scaleLinear()
                .domain([0, maxBarValue])
                .range([0, barChartHeight]);

            // 3. 绘制柱状图
            const barGroup = svg.append("g")
                .attr("transform", `translate(${margin.left + barChartOffset},${margin.top})`);

            aircraftIds.forEach((id, i) => {
                const yBase = yScale(id) - barWidth; // 柱状图纵向中心
                
                // 找到对应的飞机数据以确定类型
                const aircraftData = plannedResults.find(result => result.aircraft_id === id);
                const isActive = aircraftData && aircraftData.type === 'active';
                
                // 根据飞机类型设置柱状图颜色和样式
                const leftTimeColor = isActive ? "#FF6B6B" : "#4ECDC4"; // 活跃飞机用暖色，计划飞机用冷色
                const planTimeColor = isActive ? "#FF8E53" : "#45B7D1";
                const barOpacity = isActive ? 0.8 : 0.6; // 活跃飞机更不透明
                
                // left_time 柱（剩余时间）
                if (left_times[i] > 0) {
                    barGroup.append("rect")
                        .attr("x", 0)
                        .attr("y", yBase)
                        .attr("width", barScale(left_times[i]))
                        .attr("height", barWidth)
                        .attr("fill", leftTimeColor)
                        .attr("opacity", barOpacity)
                        .attr("stroke", isActive ? "#C44569" : "#2C3E50")
                        .attr("stroke-width", isActive ? 2 : 1);
                }
                
                // plan_time 柱（计划时间）
                if (plan_times[i] > 0) {
                    barGroup.append("rect")
                        .attr("x", 0)
                        .attr("y", yBase)
                        .attr("width", barScale(plan_times[i]))
                        .attr("height", barWidth)
                        .attr("fill", planTimeColor)
                        .attr("opacity", barOpacity)
                        .attr("stroke", isActive ? "#C44569" : "#2C3E50")
                        .attr("stroke-width", isActive ? 2 : 1)
                        .attr("stroke-dasharray", isActive ? "none" : "3,3"); // 计划飞机使用虚线边框
                }
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
            });

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
                    console.log("Processing conflict:", conflict);
                    
                    // 根据新的冲突数据格式处理：flight1, flight2, time
                    if (conflict.flight1 && conflict.flight2 && conflict.time !== undefined) {
                        const flight1Id = conflict.flight1;
                        const flight2Id = conflict.flight2;
                        const conflictTime = conflict.time;
                        
                        // 检查两架飞机是否都在aircraftIds中
                        if (aircraftIds.includes(flight1Id) && aircraftIds.includes(flight2Id)) {
                            const y1 = yScale(flight1Id);
                            const y2 = yScale(flight2Id);
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
                });
            }


        }

        //这里的逻辑应该是前端按按钮向后端传要规划的飞机id,后端返回结果
        const disposer = autorun(() => {
            if (websocketStore.plannedPath != null) {
                console.log("Planned Path:", JSON.stringify(websocketStore.plannedPath));
                console.log("Planned Flights:", websocketStore.plannedFlights);
                console.log("Active Flights:", websocketStore.activeFlights);
                console.log("Path Conflicts:", websocketStore.pathConflicts);
                
                // 使用新的数据格式更新视图
                updatePlanningView(websocketStore.plannedPath);
            }
        })

        return () => {
            // 清理函数
            disposer();
        };
    }, []);

    // 测试函数：模拟新的后端数据格式
    const testNewDataFormat = () => {
        const testData = {
            "planned_flights": {
                "CONFLICT_A": {
                    "path": ["2041", "1704", "1703", "1702", "551", "1718", "1719", "471", "470", "469", "1084", "2018"],
                    "taxi_time": 152.70205381271265,
                    "start_time": "2025-07-28T12:28:00",
                    "origin": "2041",
                    "destination": "2018"
                },
                "CONFLICT_B": {
                    "path": ["2041", "1704", "1703", "1702", "551", "1718", "1719", "471", "470", "469", "1084", "2018"],
                    "taxi_time": 152.70205381271265,
                    "start_time": "2025-07-28T12:29:30",
                    "origin": "2041",
                    "destination": "2018"
                },
                "CONFLICT_C": {
                    "path": ["2041", "1704", "1703", "1702", "551", "1718", "1719", "471", "470", "469", "1084", "2018"],
                    "taxi_time": 152.70205381271265,
                    "start_time": "2025-07-28T12:29:00",
                    "origin": "2041",
                    "destination": "2018"
                }
            },
            "active_flights": {},
            "conflicts": [
                {"flight1": "CONFLICT_B", "flight2": "CONFLICT_C", "node": "2041", "time": 1},
                {"flight1": "CONFLICT_B", "flight2": "CONFLICT_A", "node": "2041", "time": 2},
                // {"flight1": "CONFLICT_B", "flight2": "CONFLICT_C", "node": "2041", "time": 3}
            ]
        };
        
        // 模拟WebSocket数据更新
        websocketStore.updatePlannedPath(testData);
    };

    return (
        <div style={{ 
            width: '100%', 
            height: '100%', 
            overflow: 'hidden', // 防止出现滚动条
            padding: '10px',
            boxSizing: 'border-box'
        }}>
            <button 
                onClick={testNewDataFormat}
                style={{
                    margin: '10px 0',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                测试新数据格式
            </button>
            <div style={{ 
                display: 'flex',
                width: '100%', 
                height: 'calc(100% - 60px)', // 减去按钮的高度
                gap: '10px'
            }}>
                {/* 左侧表格 */}
                <div style={{ 
                    width: '40%', 
                    height: '100%',
                    overflow: 'hidden'
                }}>
                    <Table
                        className={styles.customTable}
                        columns={columns}
                        dataSource={dataSource}
                        scroll={{ x: 'max-content', y: 55 * 5 }}
                        size="small"
                        pagination={false}
                    />
                </div>
                
                {/* 右侧图表 */}
                <div style={{ 
                    width: '60%', 
                    height: '100%',
                    overflow: 'auto'
                }}>
                    <svg 
                        ref={svgRef} 
                        width="100%" 
                        height="100%"
                        viewBox={`0 0 ${width} ${height}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%',
                            display: 'block'
                        }}
                    >
                    </svg>
                </div>
            </div>
        </div>
    );
})

export default PlanningView;