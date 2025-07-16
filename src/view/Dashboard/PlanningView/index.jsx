import React, { useEffect, useRef, useState, useContext } from 'react';
import websocketStore from '@/stores/WebSocketStore';
import { observer } from 'mobx-react';
import { autorun } from 'mobx';
import * as d3 from 'd3';

const PlanningView = observer(() => {
    const width = 500, height = 400;
    const svgRef = useRef();
    const d3Container = useRef({});
    const [timeScale, setTimeScale] = useState({ min: 0, max: 100 });

    useEffect(() => {
        const svg = d3.select(svgRef.current);
    
        // 创建 D3 元素引用
       

        const updatePlanningView = (plannedResults) => {
            // 多个飞机的规划结果
            // const paths = plannedResult.path;
            // const evaluations = plannedResult.evaluations;
            // const conflicts = plannedResult.conflicts;
            let maxTime = 0;

            let aircraftIds = [];

            let left_times = [];

            let plan_times = [];

            for (let plannedResult of plannedResults) {
                // console.log("Planned Result:", plannedResult);
                // 在这里处理每个飞机的规划结果
                // 比如更新状态或触发其他操作
                aircraftIds.push(plannedResult.aircraft_id);
                const paths = plannedResult.path;
                const evaluations = plannedResult.evaluations;
                const conflicts = plannedResult.conflicts;
                const left_time = plannedResult.time; 

                console.log(evaluations[0][1])

                let time = Math.max(evaluations.map(e => e[1]))

                evaluations.forEach((evaluation) => {
                    if (evaluation[1] > maxTime)
                        maxTime = evaluation[1];
                })

                left_times.push(left_time);
                plan_times.push(evaluations[0][1]);

                console.log("Max Time:", maxTime);

                // console.log(time)

                // if (time > maxTime) {
                //     maxTime = time;
                // }
                // 以最长的时间作为比例尺
            }

            console.log("aircraftIds:", aircraftIds);
            // console.log(aircraftIds);

            maxTime = Math.ceil(maxTime)
            setTimeScale({ min: 0, max: maxTime });

            // 绘制视图

            const svg = d3.select(svgRef.current);
            const width = 400;
            const height = 400;
            const margin = { top: 60, right: 30, bottom: 60, left: 120 }; // 增加左边距为柱状图留空间
            
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
            const yScale = d3.scalePoint()
                            .domain(aircraftIds)
                            .range([0, innerHeight])
                            .padding(0.2);
            
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
            .attr("transform", `translate(0, ${innerHeight})`)
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

            const colors = ['rgb(55,126,184)','rgb(77,175,74)','rgb(152,78,163)','rgb(255,127,0)','rgb(255,255,51)','rgb(166,86,40)','rgb(247,129,191)']

            let index = 0;
            
            // let flights = []
            // let flight
            const flights = g.selectAll(".flight-group")
                .data(plannedResults) // 绑定所有飞机的数据
                .enter()
                .append("g") // 为每架飞机创建一个 <g>
                .attr("class", "flight-group") // 给它一个清晰的类名
                .attr("id", d => `flight-${d.aircraft_id}`); // 使用飞机ID作为DOM的ID，便于调试

            // 2. 在每个飞机分组内，再进行一次数据绑定，绑定它的航迹点
            flights.each(function(plannedResult, i) {
                // `this` 指向当前飞机的 <g> 元素
                // `plannedResult` 是当前飞机的完整数据对象
                // `i` 是 plannedResult 在 plannedResults 数组中的索引

                const flightGroup = d3.select(this);
                const color = colors[i % colors.length]; // 使用索引 i 来循环获取颜色

                // 在当前飞机 <g> 内，为它的 evaluations 数组的每个点创建一条线
                flightGroup.selectAll("line")
                    .data(plannedResult.evaluations)
                    .enter()
                    .append("line")
                    .attr("x1", d => xScale(0)) // 这里的 d 是 evaluations 数组中的一个元素，如 [type, time]
                    .attr("x2", d => xScale(d[1]))
                    .attr("y1", (d, j) => yScale(plannedResult.aircraft_id) + j * 3) // 使用内层索引 j 来做微调
                    .attr("y2", (d, j) => yScale(plannedResult.aircraft_id) + j * 3)
                    .attr("stroke", color)
                    .attr("stroke-width", 2)
                    .attr("stroke-linecap", "round");
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
            const barWidth = 10;
            const barGap = 4;
            const barChartHeight = 60; // 柱状图最大高度
            const barChartOffset = -80; // 柱状图距离主图的偏移（负数表示在主图左侧）

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
                // left_time 柱（上面）
                barGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", yBase)
                    .attr("width", barScale(left_times[i]))
                    .attr("height", barWidth)
                    .attr("fill", "#1f77b4");
                // plan_time 柱（下面，紧挨着）
                barGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", yBase)
                    .attr("width", barScale(plan_times[i]))
                    .attr("height", barWidth)
                    .attr("fill", "#ff7f0e");
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

            // 在主图g上绘制冲突点
            plannedResults.forEach((plannedResult, i) => {
                const aircraftId = plannedResult.aircraft_id;
                const y = yScale(aircraftId);

                // 处理多层嵌套的conflicts
                if (plannedResult.conflicts && plannedResult.conflicts.length > 0) {
                    plannedResult.conflicts.forEach(conflictGroup => {
                        if (Array.isArray(conflictGroup)) {
                            conflictGroup.forEach(conflictArr => {
                                if (Array.isArray(conflictArr)) {
                                    conflictArr.forEach(conflict => {
                                        if (conflict && conflict.conflict_time !== undefined) {
                                            g.append("circle")
                                                .attr("cx", xScale(conflict.conflict_time))
                                                .attr("cy", y)
                                                .attr("r", 6)
                                                .attr("fill", "red")
                                                .attr("stroke", "black")
                                                .attr("stroke-width", 1.5);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });


        }

        //这里的逻辑应该是前端按按钮向后端传要规划的飞机id,后端返回结果
        const disposer = autorun(() => {
            if (websocketStore.plannedPath != null) {
                console.log("Planned Path:", JSON.stringify(websocketStore.plannedPath));
                // 在这里处理规划结果，比如更新状态或触发其他操作

                updatePlanningView(websocketStore.plannedPath);

            }
        })

        return () => {
            // 清理函数
            disposer();
        };
    }, []);

    return (
        <svg ref={svgRef} width={width} height={height}>
    
        </svg>
    );
})

export default PlanningView;