import React, { useEffect, useRef, useState, useContext } from 'react';
import maplibregl, { Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { observer } from 'mobx-react-lite';
import websocketStore from '@/stores/WebSocketStore';
import { autorun } from 'mobx';
// import { WebSocketContext } from '@/websocket/WebsocketProvider';
// ... 其他import

const TaxiwayMap = observer(() => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({}); // 存储飞机标记（以便于更新和删除）
  const areaTimers = useRef({});
  const geoJsonUrl = '/taxiwayline2.geojson'; // 文件需放在public目录下
  // const { socket } = useContext(WebSocketContext);
  // const [inputMessage, setInputMessage] = useState('taxiway');

  async function fetchConflictsTxt() {
    const res = await fetch('/conflicts.txt');
    const text = await res.text();
    // 提取 detected_conflicts: 后面的内容
    const match = text.match(/detected_conflicts:\s*(\[.*\])$/s);
    if (match) {
      try {
        // 将单引号替换为双引号，方便JSON解析
        const jsonStr = match[1].replace(/'/g, '"');
        return JSON.parse(jsonStr);
      } catch (e) {
        console.error('conflicts.txt 解析失败:', e);
        return [];
      }
    }
    return [];
  }

  useEffect(() => {
    let disposer3;
    // 加载GeoJSON数据
    fetch(geoJsonUrl)
      .then(response => response.json())
      .then(data => {
        console.log('GeoJSON数据加载完成:', data);
        console.log(mapContainer.current);
        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: { version: 8, sources: {}, layers: [] },
          center: [116.593238, 40.051893],  // 初始中心点
          zoom: 23, // 提高初始缩放级别，让地图更大
          maxZoom: 24, // 允许更大的缩放范围
          bearing: 90  // 向右旋转90度
        });

        map.current.on('load', () => {
          console.log('地图加载完成1');

          // 添加数据源
          map.current.addSource('taxiways', {
            type: 'geojson',
            data: data,
            promoteId: 'id'
          });

          // 主路网图层
          map.current.addLayer({
            id: 'taxiway-lines',
            type: 'line',
            source: 'taxiways',
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'name'], null],
                '#cccccc',  // 未命名滑行道颜色（更浅）
                '#f3f3f3'   // 命名滑行道颜色（更浅）
              ],
              'line-width': [
                'interpolate', // 使用插值函数
                ['linear'], // 线性插值
                ['zoom'], // 使用缩放级别
                0,  // 在缩放级别 0 时，线宽为 1
                1, // 线宽为 1
                12, // 在缩放级别 12 时，线宽为 4
                4, // 线宽为 4
                18, // 在最大缩放级别 18 时，线宽为 10
                15 // 线宽为 10
              ],
              'line-opacity': 1
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            }
          });

          // 添加道路点击事件监听器
          map.current.on('click', 'taxiway-lines', (e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              const taxiwayId = feature.properties.id;
              const taxiwayName = feature.properties.name || '未命名';

              // 创建弹出窗口显示道路信息
              new maplibregl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(`
                  <div style="padding: 10px;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">道路信息</h3>
                    <p style="margin: 5px 0;"><strong>道路ID:</strong> ${taxiwayId}</p>
                    <p style="margin: 5px 0;"><strong>道路名称:</strong> ${taxiwayName}</p>
                    <p style="margin: 5px 0;"><strong>坐标:</strong> ${e.lngLat.lng.toFixed(6)}, ${e.lngLat.lat.toFixed(6)}</p>
                  </div>
                `)
                .addTo(map.current);

              console.log('点击道路:', { id: taxiwayId, name: taxiwayName, coordinates: e.lngLat });
            }
          });

          // 添加鼠标悬停效果
          map.current.on('mouseenter', 'taxiway-lines', () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current.on('mouseleave', 'taxiway-lines', () => {
            map.current.getCanvas().style.cursor = '';
          });


          // 自动适应视图
          const bounds = new maplibregl.LngLatBounds();
          data.features.forEach(feature => {
            feature.geometry.coordinates[0].forEach(coord => {
              bounds.extend(coord);
            });
          });

          if (!bounds.isEmpty()) {
            map.current.fitBounds(bounds, {
              padding: 50,
              duration: 1000,
              bearing: 90  // 保持旋转角度
            });
          }

          console.log('地图加载完成');

          // drawTest('test', [], colors[0], 0); // 绘制初始轨迹

          websocketStore.startSimulate(); // 启动模拟

          // map.current.on('click', 'test', (e) => {
          //   const features = map.current.queryRenderedFeatures(e.point, { layers: ['line-layer'] });
          //   if (features.length) {
          //     const segmentOrder = features[0].properties.order; // 获取线段顺序
          //     console.log(`这是第 ${segmentOrder} 段`);
          //   }
          // });

        });
      })
      .catch(error => console.error('数据加载失败:', error));

    const colors = ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)', 'rgb(247,129,191)']

    // const colors = ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0','#f0027f','#bf5b17','#666666', '#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666']
    const colorSet = new Set(); // 使用 Set 来存储颜色，避免重复
    const colorMap = new Map();
    const getColor = (id) => {
      if (colorMap.has(id)) {
        return colorMap.get(id);
      } else {
        console.log(colorSet);
        for (let color of colors) {
          if (!colorSet.has(color)) {
            colorSet.add(color);
            colorMap.set(id, color);
            return color;
          }
        }
        return '#000000'; // 如果没有可用颜色，返回黑色
      }
    }

    const deleteColor = (id) => {
      if (colorMap.has(id)) {
        const color = colorMap.get(id);
        colorSet.delete(color);
        colorMap.delete(id);
      }
    }

    const updatePlane = () => {
      console.log('更新飞机位置');
      if (!map.current) return; // 确保地图已加载

      // 记录当前存在的飞机ID以及它们的计数
      const existingPlaneIds = new Set(Object.keys(markers.current));
      const updatedPlaneIds = new Set();

      // 获取当前的轨迹图层
      let trajectoryLayerId = 'plane-trajectories';


      // 处理现有和新飞机标记
      websocketStore.planePosition.forEach(plane => {
        const { id, coords, cur_path, trajectory } = plane;
        const color = getColor(id); // 根据飞机ID设置颜色，默认黑色


        // 新增飞机
        if (!existingPlaneIds.has(id)) {

          const marker = new Marker({ element: createAirplaneMarker(color) }) // 使用指定颜色创建标记
            .setLngLat([coords[0], coords[1]]) // 设置标记位置
            .setPopup(new Popup().setHTML(`<h1>${id}</h1>`))
            .addTo(map.current);

          markers.current[id] = { marker }; // 存储新标记和轨迹数据
        } else {
          // 更新已有飞机标记的位置
          const { marker } = markers.current[id];
          marker.setLngLat([coords[0], coords[1]]); // 更新位置
          // marker.getElement().style.transition = "transform 0.5s";

          // 添加到轨迹中
          // removeTrajectory(id); // 移除轨迹
          // trajectory.push([coords[0], coords[1]]);
          const keysArray = Array.from(colorMap.keys());
    
          drawTrajectory(id, trajectory, color, keysArray.indexOf(id)); // 绘制轨迹



          // 重置计数
          markers.current[id].count = 0;
        }

        // 记录更新的飞机ID
        updatedPlaneIds.add(id);
      });

      // 删除超过5次未出现的飞机标记
      Object.keys(markers.current).forEach(id => {
        if (!updatedPlaneIds.has(id)) {
          if (!markers.current[id].count) {
            markers.current[id].count = 1; // 初始化计数
          } else if (markers.current[id].count < 5) {
            markers.current[id].count += 1; // 增加计数
          } else {
            // 超过5次未出现，移除该标记和轨迹
            const { marker } = markers.current[id];
            marker.remove();
            removeTrajectory(id); // 移除轨迹
            delete markers.current[id]; // 从字典中删除标记记录
            deleteColor(id); // 删除颜色
            console.log(`移除飞机: ${id}`);
          }
        }
      });
    };


    // 飞机 SVG 生成器（支持颜色、旋转角度）
    function createAirplaneMarker(color = '#FF3B30', size = 32, rotation = 0) {
      const el = document.createElement('div');
      el.className = 'airplane-marker';
      el.innerHTML = `
        <svg viewBox="0 0 1024 1024" 
            width="${size}" 
            height="${size}" 
            style="color: ${color}"> <!-- 通过 color 控制主色 -->
          <path fill="currentColor" d="M512 174.933333c23.466667 0 42.666667 8.533333 59.733333 25.6s25.6 36.266667 25.6 59.733334v192l206.933334 185.6c6.4 4.266667 10.666667 12.8 14.933333 21.333333s6.4 17.066667 6.4 25.6v23.466667c0 8.533333-2.133333 12.8-6.4 14.933333s-10.666667 2.133333-17.066667-2.133333l-204.8-140.8v149.333333c38.4 36.266667 57.6 57.6 57.6 64v36.266667c0 8.533333-2.133333 12.8-6.4 17.066666-4.266667 2.133333-10.666667 2.133333-19.2 0l-117.333333-72.533333-117.333333 72.533333c-6.4 4.266667-12.8 4.266667-19.2 0s-6.4-8.533333-6.4-17.066666v-36.266667c0-8.533333 19.2-29.866667 57.6-64v-149.333333l-204.8 140.8c-6.4 4.266667-12.8 6.4-17.066667 2.133333-4.266667-2.133333-6.4-8.533333-6.4-14.933333V684.8c0-8.533333 2.133333-17.066667 6.4-25.6 4.266667-8.533333 8.533333-17.066667 14.933333-21.333333l206.933334-185.6v-192c0-23.466667 8.533333-42.666667 25.6-59.733334s36.266667-25.6 59.733333-25.6z"/>
        </svg>
      `;

      el.querySelector('svg').style.transform = `rotate(${rotation}deg)`;
      return el;
    }

    function generateAlphaVariants(rgbColor, steps = 10, times = 5) {

      // 提取RGB数值
      const [_, r, g, b] = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

      // 生成透明度阶梯（从1.00到0.00）
      return Array.from({ length: times }, (_, i) => {
        const alpha = (1 - i / (steps)).toFixed(2); // 保留两位小数
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      });

    }

    const grayScale = [
      '#FFE5E5',
      '#FFCCCC',
      '#FFB2B2',
      '#FF9999',
      '#FF7F7F',
      '#FF6666',
      '#FF4C4C',
      '#FF3232',
      '#FF1919',
      '#FF0000'
    ];

    grayScale.reverse(); // 反转灰度颜色数组

    const drawTest = (id, trajectorys, color, h) => {
      const geodata = {
        "type": "FeatureCollection", "features": [
          { "type": "Feature", "properties": { "color": "#FF1919" }, "geometry": { "type": "MultiLineString", "coordinates": [[[116.60957629798676, 40.07072042269285], [116.60961207779839, 40.07049230443101]], [[116.60961207779839, 40.07049230443101], [116.60963321741602, 40.07035752551841]], [[116.60963321741602, 40.07035752551841], [116.60965000451456, 40.07025049637292]], [[116.60965000451456, 40.07025049637292], [116.60965485000008, 40.070219605000034]], [[116.60965485000008, 40.070219605000034], [116.6096962291351, 40.06995578124849]], [[116.6096962291351, 40.06995578124849], [116.60972500800007, 40.06977229400008]], [[116.60972500800007, 40.06977229400008], [116.60971822385996, 40.06968795905062]], [[116.60971822385996, 40.06968795905062], [116.60971402993081, 40.06966143549661]], [[116.60971402993081, 40.06966143549661], [116.60969898350422, 40.06960770804471]], [[116.60969898350422, 40.06960770804471], [116.60967780773305, 40.069556088079956]], [[116.60967780773305, 40.069556088079956], [116.60965078838404, 40.06950727221347]], [[116.60965078838404, 40.06950727221347], [116.60961829008313, 40.069461919214866]], [[116.60961829008313, 40.069461919214866], [116.60958075139463, 40.06942064112253]], [[116.60958075139463, 40.06942064112253], [116.6095645741975, 40.0694065504]], [[116.6095645741975, 40.0694065504], [116.60950016253007, 40.06936079056222]], [[116.60950016253007, 40.06936079056222], [116.60937563129383, 40.069304415965526]]] } },
          { "type": "Feature", "properties": { "color": "#FF3232", "index": 3 }, "geometry": { "type": "MultiLineString", "coordinates": [[[116.60937563129383, 40.069304415965526], [116.60953867890284, 40.06938399498392]], [[116.60953867890284, 40.06938399498392], [116.60944325710257, 40.069326507543295]], [[116.60944325710257, 40.069326507543295], [116.60934724367137, 40.069295142473926]], [[116.60934724367137, 40.069295142473926], [116.60781169709529, 40.06915322543125]]] } }]
      }

      const marker1 = new Marker({ element: createAirplaneMarker(color) }) // 使用指定颜色创建标记
        .setLngLat([116.60937563129383, 40.069304415965526]) // 设置标记位置
        .setPopup(new Popup().setHTML(`<h1>1</h1>`))
        .addTo(map.current);

      const marker2 = new Marker({ element: createAirplaneMarker(color) }) // 使用指定颜色创建标记
        .setLngLat([116.60953867890284, 40.06938399498392]) // 设置标记位置
        .setPopup(new Popup().setHTML(`<h1>2</h1>`))
        .addTo(map.current);


      const marker3 = new Marker({ element: createAirplaneMarker(color) }) // 使用指定颜色创建标记
        .setLngLat([116.60944325710257, 40.069326507543295]) // 设置标记位置
        .setPopup(new Popup().setHTML(`<h1>3</h1>`))
        .addTo(map.current);

      const marker4 = new Marker({ element: createAirplaneMarker(color) }) // 使用指定颜色创建标记
        .setLngLat([116.60957629798676, 40.07072042269285]) // 设置标记位置
        .setPopup(new Popup().setHTML(`<h1>4</h1>`))
        .addTo(map.current);

      // 遍历轨迹数据，添加图层
      geodata.features.forEach((feature, index) => {
        // 创建唯一源 ID
        const sourceId = `segment-${index}`;

        // 添加数据源
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature // 每个特征单独作为源
        });

        // 添加图层
        map.current.addLayer({
          id: sourceId, // 使用源 ID
          type: 'line',
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": feature.properties.color, // 使用特征中的颜色属性
            "line-width": 2,
            "line-opacity": 0.8,
            "line-blur": 0.5
          }
        });
      });


      map.current.on('click', (e) => {
        // 查询用户点击的位置的特征
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: geodata.features.map((_, index) => `segment-${index}`) // 获取所有添加的图层
        });

        // 检查是否点击了某个线段
        if (features.length > 0) {
          const clickedSegmentId = features[0].layer.id; // 获取被点击线段的 ID

          console.log('Clicked segment ID:', clickedSegmentId);

          // 遍历所有图层，将被点击的线段高亮显示
          geodata.features.forEach((feature, index) => {
            const sourceId = `segment-${index}`;
            const color = (sourceId === clickedSegmentId) ? '#FFFF00' : feature.properties.color; // 高亮为黄色
            map.current.setPaintProperty(sourceId, 'line-color', color);
          });
        }
      });

    }

    // 绘制飞机的轨迹
    const drawTrajectory = (id, trajectorys, color, h) => {
      let geodata = { type: 'FeatureCollection', features: [] }; // 初始化地理数据对象
      let index = 0;
      // const multiColor = generateAlphaVariants(color, 10, 5); // 生成颜色透明度阶梯

     console.log('绘制轨迹', id, trajectorys);

      trajectorys.forEach(trajectory => {
        // console.log('绘制轨迹',  trajectory);
        if (trajectory.length > 0) {
          geodata.features.push({
            type: 'Feature',
            properties: {
              color: grayScale[Math.min((index++), 9)],
              height: h,
              // color: grayScale[(index++) % 10] ,
            },
            geometry: {
              type: 'MultiLineString',
              coordinates: trajectory
            }
          });
        }
      })

      // console.log(JSON.stringify(geodata));

      // console.log( JSON.stringify(geodata, null, 2) );
      // console.log(geodata);
      if (!map.current.getSource(id)) {
        map.current.addSource(id, {
          type: 'geojson',
          data: geodata
        });

        map.current.addLayer({
          id: id,
          type: 'line',
          source: id,
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {

            "line-color": ['get', 'color'], // 使用指定颜色
            "line-width": 3,
            'line-offset': [
              '*',
              ['get', 'height'], // 车道序号(0,1,2...)
              // ['interpolate', ['linear'], ['zoom'],
              //   10, 3,  // 缩放小时间距小
              //   15, 8   // 放大地图时间距大
              // ]
            ],
            'line-opacity': 1.0,
            'line-blur': 0.5
          }
        });
      } else {
        // 更新轨迹数据
        const source = map.current.getSource(id);
        if (source) {
          source.setData(
            geodata
          );
        }
      }
    };

    // 绘制模拟结果的轨迹（使用浅蓝色系列）
    const drawSimulatedTrajectory = (id, trajectorys, baseColor = 'rgb(24, 144, 255)', h = 0) => {
      let geodata = { type: 'FeatureCollection', features: [] };
      let index = 0;
      const multiColor = generateAlphaVariants(baseColor, 10, 10);

      trajectorys.forEach(trajectory => {
        if (trajectory && trajectory.length > 0) {
          geodata.features.push({
            type: 'Feature',
            properties: {
              color: multiColor[Math.min(index++, multiColor.length - 1)],
              height: h,
            },
            geometry: {
              type: 'MultiLineString',
              coordinates: trajectory
            }
          });
        }
      });

      if (!map.current.getSource(id)) {
        map.current.addSource(id, {
          type: 'geojson',
          data: geodata
        });

        map.current.addLayer({
          id: id,
          type: 'line',
          source: id,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3,
            'line-offset': ['*', ['get', 'height']],
            'line-opacity': 1.0,
            'line-blur': 0.5
          }
        });
      } else {
        const source = map.current.getSource(id);
        if (source) {
          source.setData(geodata);
        }
      }
    };

    // 清理所有模拟轨迹图层
    const clearSimulatedTrajectories = () => {
      if (!map.current || !map.current.getStyle) return;
      try {
        const style = map.current.getStyle();
        if (!style || !style.layers) return;

        const layersToRemove = [];
        const sourcesToRemove = [];

        style.layers.forEach(layer => {
          if (layer.id && layer.id.startsWith('sim-')) {
            layersToRemove.push(layer.id);
            if (layer.source && !sourcesToRemove.includes(layer.source)) {
              sourcesToRemove.push(layer.source);
            }
          }
        });

        layersToRemove.forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        });
        sourcesToRemove.forEach(sourceId => {
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        });
      } catch (e) {
        console.error('清理模拟轨迹时出错:', e);
      }
    };

    // 移除飞机的轨迹
    const removeTrajectory = (id) => {
      if (map.current.getLayer(id)) {
        map.current.removeLayer(id);
      }
      if (map.current.getSource(id)) {
        map.current.removeSource(id);
      }
    };

    // 观察 messages 数组的变化
    const disposer1 = autorun(() => {
      if (websocketStore.planePosition.length > 0) {
        updatePlane();
      }
    });


    const disposer2 = autorun(() => {
      // console.log('冲突数据变化:', websocketStore.conflicts);
      if (websocketStore.conflicts != null) {
        const conflict = websocketStore.conflicts;
        // const { id1, id2, time, coords1, coords2, distance } = websocketStore.conflicts;
       
        const color = '#984ea3'; // 根据飞机ID设置颜色，默认黑色
        const trajectory = [[
          [conflict.pos1, conflict.pos2]]
        ];
        drawConflict(conflict.id1 + '-' + conflict.id2, trajectory, color, 0); // 绘制轨迹
      }
    });

    // 监听冲突解决方案数据变化，绘制冲突节点标记
    disposer3 = autorun(() => {
      console.log('冲突解决方案数据变化:', websocketStore.conflictResolutions);
      
      // 清除之前的冲突标记
      clearConflictMarkers();
      
      // 绘制新的冲突标记
      if (websocketStore.conflictResolutions && Array.isArray(websocketStore.conflictResolutions)) {
        drawConflictMarkers(websocketStore.conflictResolutions);
      }
    });



    // 清理planned paths图层
    const clearPlannedPaths = () => {
      if (!map.current || !map.current.getStyle) return;

      try {
        const style = map.current.getStyle();
        if (!style || !style.layers) return;

        // 查找所有planned-path开头的图层和数据源
        const layersToRemove = [];
        const sourcesToRemove = [];

        style.layers.forEach(layer => {
          if (layer.id && layer.id.startsWith('planned-path-')) {
            layersToRemove.push(layer.id);
            if (layer.source && !sourcesToRemove.includes(layer.source)) {
              sourcesToRemove.push(layer.source);
            }
          }
        });

        // 移除图层
        layersToRemove.forEach(layerId => {
          if (map.current && map.current.getLayer && map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        });

        // 移除数据源
        sourcesToRemove.forEach(sourceId => {
          if (map.current && map.current.getSource && map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        });
      } catch (error) {
        console.error('清理planned paths时出错:', error);
      }
    };

    // 绘制planned飞机的规划路径
    const drawPlannedPaths = () => {
      if (!map.current || !map.current.getStyle || !geojsonData || !websocketStore.plannedFlights) return;

      // 先清理旧的路径
      clearPlannedPaths();

      const plannedFlights = websocketStore.plannedFlights;

      if (!plannedFlights || Object.keys(plannedFlights).length === 0) {
        return;
      }

      // 注释掉本地颜色数组，改用WebSocketStore的统一颜色管理
      // const activeColors = ['#FF6B6B', '#FF8E53', '#FF6B9D', '#C44569', '#F8B500']; // 活跃飞机：暖色调
      // const planningColors = ['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']; // 计划飞机：冷色调

      // 不再需要本地索引，改用WebSocketStore的统一管理
      // let activeIndex = 0;
      // let planningIndex = 0;

      // 遍历每个planned航班
      Object.entries(plannedFlights).forEach(([flightId, flightData]) => {
        if (!flightData.node_path || !Array.isArray(flightData.node_path) || flightData.node_path.length < 2) {
          return;
        }

        // 筛选飞机规划路径：如果飞机正在滑行中，就不绘制规划路径
        const isCurrentlyTaxiing = websocketStore.planePosition && 
          websocketStore.planePosition.some(plane => 
            plane.id === flightId && 
            (plane.state === 'taxiing' || plane.state === 'moving')
          );
        
        if (isCurrentlyTaxiing) {
          console.log(`飞机 ${flightId} 正在滑行中，跳过规划路径绘制`);
          return;
        }

        console.log('绘制规划路径', flightId, flightData);

        // 根据node_path中的滑行道ID找到对应的坐标
        const pathCoordinates = [];

        for (let i = 0; i < flightData.node_path.length - 1; i++) {
          const currentNodeId = String(flightData.node_path[i]);
          const nextNodeId = String(flightData.node_path[i + 1]);

          // 查找连接这两个节点的滑行道
          const taxiway = geojsonData.features.find(feature => {
            const startNode = String(feature.properties.startnode);
            const endNode = String(feature.properties.endnode);
            return (startNode === currentNodeId && endNode === nextNodeId) ||
              (startNode === nextNodeId && endNode === currentNodeId);
          });

          if (taxiway && taxiway.geometry && taxiway.geometry.coordinates) {
            const coords = taxiway.geometry.coordinates[0];
            if (coords && coords.length > 0) {
              // 根据节点顺序决定坐标方向
              const startNode = String(taxiway.properties.startnode);
              const shouldReverse = startNode !== currentNodeId;

              const coordsToAdd = shouldReverse ? [...coords].reverse() : coords;

              // 避免重复添加相同的点
              if (pathCoordinates.length === 0) {
                pathCoordinates.push(...coordsToAdd);
              } else {
                // 跳过第一个点（与上一段的最后一个点重复）
                pathCoordinates.push(...coordsToAdd.slice(1));
              }
            }
          }
        }

        if (pathCoordinates.length < 2) {
          console.warn(`无法为航班 ${flightId} 构建完整路径`);
          return;
        }

        // 根据航班类型确定颜色，使用WebSocketStore的统一颜色管理
        // 检查是否为活跃航班（可以通过websocketStore.planePosition或其他方式判断）
        const isActiveFlight = websocketStore.planePosition && 
          websocketStore.planePosition.some(plane => plane.id === flightId);
        
        // 使用WebSocketStore的统一颜色管理
        const pathColor = websocketStore.getAircraftColor(flightId, isActiveFlight);

        // 创建GeoJSON数据
        const pathGeoJSON = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {
              flightId: flightId,
              destination: flightData.destination
            },
            geometry: {
              type: 'LineString',
              coordinates: pathCoordinates
            }
          }]
        };

        const sourceId = `planned-path-source-${flightId}`;
        const layerId = `planned-path-layer-${flightId}`;

        try {
          // 确保map完全初始化
          if (!map.current || !map.current.getSource || !map.current.addSource) {
            console.warn('地图未完全初始化，跳过路径绘制');
            return;
          }

          // 添加数据源
          if (!map.current.getSource(sourceId)) {
            map.current.addSource(sourceId, {
              type: 'geojson',
              data: pathGeoJSON
            });
          } else {
            map.current.getSource(sourceId).setData(pathGeoJSON);
          }

          // 添加图层
          if (!map.current.getLayer(layerId)) {
            map.current.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': pathColor, // 使用与PlanningView一致的颜色
                'line-width': 2, // 调细规划路径的宽度
                'line-dasharray': [2, 2], // 虚线样式
                'line-opacity': 0.8
              }
            });

            // 添加点击事件
            map.current.on('click', layerId, (e) => {
              const feature = e.features[0];
              const { flightId, destination } = feature.properties;

              new maplibregl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(`
                  <div style="padding: 10px;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">规划路径</h3>
                    <p style="margin: 5px 0;"><strong>航班ID:</strong> ${flightId}</p>
                    <p style="margin: 5px 0;"><strong>目的地:</strong> ${destination}</p>
                  </div>
                `)
                .addTo(map.current);
            });

            // 添加鼠标悬停效果
            map.current.on('mouseenter', layerId, () => {
              map.current.getCanvas().style.cursor = 'pointer';
            });

            map.current.on('mouseleave', layerId, () => {
              map.current.getCanvas().style.cursor = '';
            });
          }
        } catch (error) {
          console.error(`绘制航班 ${flightId} 路径时出错:`, error);
        }
      });
    };

    // 观察plannedFlights数据变化
    const disposer4 = autorun(() => {
      try {
        if (websocketStore.plannedFlights && Object.keys(websocketStore.plannedFlights).length > 0) {
          console.log('plannedFlights数据变化:', websocketStore.plannedFlights);
          drawPlannedPaths();
        } else {
          // 如果没有数据，清理路径
          clearPlannedPaths();
        }
      } catch (error) {
        console.error('处理plannedFlights数据时出错:', error);
      }
    });

    // 监听并绘制模拟结果的飞机轨迹（与实时轨迹一致的结构，但颜色不同）
    const disposerSim = autorun(() => {
      try {
        const sim = websocketStore.getCurrentSimulation();
        const state = sim && sim.simulated_state;
        const positions = state && state.aircraft_positions;

        if (!map.current) return;

        if (positions && typeof positions === 'object' && Object.keys(positions).length > 0) {
          clearSimulatedTrajectories();
          Object.entries(positions).forEach(([aircraftId, aircraftData], idx) => {
            const trajectory = aircraftData?.trajectory || [];
            const simLayerId = `sim-${aircraftId}`;
            // 使用浅蓝色系列，和规划视图颜色系保持一致（更浅）
            drawSimulatedTrajectory(simLayerId, trajectory, 'rgb(24, 144, 255)', idx);
          });
        } else {
          // 无模拟数据时清理
          clearSimulatedTrajectories();
        }
      } catch (error) {
        console.error('处理模拟轨迹时出错:', error);
      }
    });


    // 根据severity级别获取颜色
    const getSeverityColor = (severity) => {
      switch (severity?.toUpperCase()) {
        case 'HIGH':
          return '#ff4d4f'; // 红色
        case 'MEDIUM':
          return '#faad14'; // 黄色
        case 'LOW':
          return '#52c41a'; // 绿色
        default:
          return '#d9d9d9'; // 灰色
      }
    };

    // 绘制冲突节点圆圈标记
    const drawConflictMarkers = (conflicts) => {
      if (!conflicts || !Array.isArray(conflicts)) return;

      conflicts.forEach((conflict, index) => {
        const { conflict_node, safety_risk, severity } = conflict;
        if (!conflict_node) return;

        // 尝试从滑行道数据中找到节点坐标
        let nodeCoordinates = null;
        
        // 查找包含该节点的滑行道
        const relatedTaxiway = geojsonData.features.find(feature => {
          const startNode = String(feature.properties.startnode);
          const endNode = String(feature.properties.endnode);
          return startNode === String(conflict_node) || endNode === String(conflict_node);
        });

        if (relatedTaxiway && relatedTaxiway.geometry && relatedTaxiway.geometry.coordinates) {
          const coords = relatedTaxiway.geometry.coordinates[0];
          if (coords && coords.length > 0) {
            // 如果节点是起始节点，使用第一个坐标；如果是结束节点，使用最后一个坐标
            const startNode = String(relatedTaxiway.properties.startnode);
            nodeCoordinates = startNode === String(conflict_node) ? coords[0] : coords[coords.length - 1];
          }
        }

        if (!nodeCoordinates) {
          console.warn(`无法找到冲突节点 ${conflict_node} 的坐标`);
          return;
        }

        const markerId = `conflict-marker-${conflict_node}-${index}`;
        const color = getSeverityColor(severity);

        // 创建冲突标记的GeoJSON数据
        const markerGeoJSON = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {
              conflict_node,
              safety_risk,
              severity,
              color
            },
            geometry: {
              type: 'Point',
              coordinates: nodeCoordinates
            }
          }]
        };

        // 添加数据源
        if (!map.current.getSource(markerId)) {
          map.current.addSource(markerId, {
            type: 'geojson',
            data: markerGeoJSON
          });

          // 添加圆圈图层
          map.current.addLayer({
            id: `${markerId}-circle`,
            type: 'circle',
            source: markerId,
            paint: {
              'circle-radius': 20,
              'circle-color': color,
              'circle-opacity': 0.8,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });

          // 添加文本图层显示safety_risk数值
          map.current.addLayer({
            id: `${markerId}-text`,
            type: 'symbol',
            source: markerId,
            layout: {
              'text-field': String(safety_risk || ''),
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-anchor': 'center'
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 1
            }
          });
        } else {
          // 更新现有数据源
          map.current.getSource(markerId).setData(markerGeoJSON);
        }
      });
    };

    // 清除冲突标记
    const clearConflictMarkers = () => {
      if (!map.current || !map.current.getStyle) return;

      try {
        const style = map.current.getStyle();
        if (!style || !style.layers) return;

        // 查找所有冲突标记图层
        const layersToRemove = [];
        const sourcesToRemove = [];

        style.layers.forEach(layer => {
          if (layer.id && layer.id.startsWith('conflict-marker-')) {
            layersToRemove.push(layer.id);
            if (layer.source && !sourcesToRemove.includes(layer.source)) {
              sourcesToRemove.push(layer.source);
            }
          }
        });

        // 移除图层
        layersToRemove.forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        });

        // 移除数据源
        sourcesToRemove.forEach(sourceId => {
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        });
      } catch (error) {
        console.error('清除冲突标记时出错:', error);
      }
    };

    // 绘制冲突连线
    const drawConflict = (id, trajectorys, color, h) => {
      let geodata = { type: 'FeatureCollection', features: [] }; // 初始化地理数据对象
      let index = 0;
      // const multiColor = generateAlphaVariants(color, 10, 5); // 生成颜色透明度阶梯

      // console.log('绘制轨迹', id, trajectorys);

      trajectorys.forEach(trajectory => {
        // console.log('绘制轨迹',  trajectory);
        if (trajectory.length > 0) {
          geodata.features.push({
            type: 'Feature',
            geometry: {
              type: 'MultiLineString',
              coordinates: trajectory
            }
          });
        }
      })

      // console.log('绘制冲突连线', id);
      // console.log(JSON.stringify(geodata));

      if (!map.current.getSource(id)) {
        map.current.addSource(id, {
          type: 'geojson',
          data: geodata
        });

        map.current.addLayer({
          id: id,
          type: 'line',
          source: id,
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {

            "line-color": color, // 使用指定颜色
            "line-width": 10,
            'line-offset': [
              '*',
              ['get', 'height'],
            ],
            'line-opacity': 0.8,
            'line-blur': 0.5
          }
        });
      } else {
        // 更新轨迹数据
        const source = map.current.getSource(id);
        if (source) {
          source.setData(
            geodata
          );
        }
      }
    };

    let highlightTimer = null;
    let highlightLayers = [];
    let geojsonData = null; // 保存原始geojson

    // 加载GeoJSON数据
    fetch(geoJsonUrl)
      .then(response => response.json())
      .then(data => {
        geojsonData = data; // 保存原始geojson
        // 确保每个 feature 都有 id 字段
        geojsonData.features.forEach(f => {
          f.id = String(parseInt(f.properties.id));
        });
        // 轨迹绘制法高亮taxiway_id


        // 监听overlapTaxiways变化
        disposer3 = autorun(() => {

          let overlapTaxiways = websocketStore.overlapTaxiways;
          console.log('WebSocket overlapTaxiways:', overlapTaxiways);
          
         
            const currentConflicts = overlapTaxiways || [];
            console.log('当前冲突数据 (current):', currentConflicts);

            if (Array.isArray(currentConflicts) && currentConflicts.length > 0) {
              highlightTaxiwayByLayerWithArea(currentConflicts);
            } else {
              console.log('当前没有冲突数据');
              // 清除现有的高亮显示
              if (window._areaLayers) {
                window._areaLayers.forEach(id => {
                  if (map.current.getLayer(id)) map.current.removeLayer(id);
                  if (map.current.getSource(id)) map.current.removeSource(id);
                });
                window._areaLayers = [];
              }
            }
          
       
          
        });

        function highlightTaxiwayByLayerWithArea(overlapData) {
          // console.log('highlightTaxiwayByLayerWithArea', overlapData);
          if (!map.current || !geojsonData) return;

          // 先移除旧的面积图层
          if (window._areaLayers) {
            window._areaLayers.forEach(id => {
              if (map.current.getLayer(id)) map.current.removeLayer(id);
              if (map.current.getSource(id)) map.current.removeSource(id);
            });
          }
          window._areaLayers = [];

          overlapData.forEach((conflictItem, conflictIdx) => {
            const { merged_functions, taxiway_sequence, flight1_id, flight2_id, conflict_time } = conflictItem;


            if (!merged_functions || !Array.isArray(merged_functions) || !taxiway_sequence || !Array.isArray(taxiway_sequence)) {
              console.warn('Invalid data format:', conflictItem);
              return;
            }



            // 采样所有分段函数的边界点（跨道路分段）
            // Step 1: Get all segments and orient them to form a continuous path
            const features = taxiway_sequence
              .map(id => geojsonData.features.find(f => String(parseInt(f.id)) === String(id)))
              .filter(Boolean);

            const orientedSegments = [];
            if (features.length > 0) {
              // Start with the first segment. We will orient it based on the second, if it exists.
              const firstSegment = [...features[0].geometry.coordinates[0]];

              if (features.length > 1) {
                const secondSegment = features[1].geometry.coordinates[0];

                const firstStart = firstSegment[0];
                const firstEnd = firstSegment[firstSegment.length - 1];
                const secondStart = secondSegment[0];
                const secondEnd = secondSegment[secondSegment.length - 1];

                const distStartToSecond = Math.min(
                  getDistance(firstStart[0], firstStart[1], secondStart[0], secondStart[1]),
                  getDistance(firstStart[0], firstStart[1], secondEnd[0], secondEnd[1])
                );

                const distEndToSecond = Math.min(
                  getDistance(firstEnd[0], firstEnd[1], secondStart[0], secondStart[1]),
                  getDistance(firstEnd[0], firstEnd[1], secondEnd[0], secondEnd[1])
                );

                // If the original start point is closer to the next segment, reverse the segment.
                // This ensures the path flows from the "far" point to the "near" point.
                if (distStartToSecond < distEndToSecond) {
                  firstSegment.reverse();
                }
              }
              orientedSegments.push(firstSegment);

              // Orient subsequent segments based on the previously oriented one
              for (let i = 1; i < features.length; i++) {
                const prevSegment = orientedSegments[i - 1];
                const currentSegment = [...features[i].geometry.coordinates[0]];

                const prevEnd = prevSegment[prevSegment.length - 1];
                const currentStart = currentSegment[0];
                const currentEnd = currentSegment[currentSegment.length - 1];

                if (getDistance(prevEnd[0], prevEnd[1], currentEnd[0], currentEnd[1]) < getDistance(prevEnd[0], prevEnd[1], currentStart[0], currentStart[1])) {
                  currentSegment.reverse();
                }
                orientedSegments.push(currentSegment);
              }
            }

            // Step 2: Build the final continuous path and add markers
            const continuousPath = [];
            let lastPoint = null;

            orientedSegments.forEach((segment, index) => {
              // Add a red marker at the start of each segment for debugging
              // new maplibregl.Marker({ color: 'red' })
              //   .setLngLat(segment[0])
              //   .setPopup(new maplibregl.Popup().setText(`道路${features[index].properties.id} 0点`))
              //   .addTo(map.current);

              // Add points to the continuous path, avoiding duplicates at junctions
              if (index === 0) {
                continuousPath.push(...segment);
              } else {
                continuousPath.push(...segment.slice(1));
              }
              lastPoint = continuousPath[continuousPath.length - 1];
            });

            // Step 2: Calculate cumulative distances for the entire continuous path
            const pathDists = getCumulativeDistances(continuousPath);
            const totalPathLength = pathDists[pathDists.length - 1];

            // Step 3: Generate points for the area polygon based on merged_functions
            const allLeftPoints = [];
            const allRightPoints = [];

            merged_functions.forEach(seg => {
              const { x1, x2, a, b, c } = seg;

              // Clamp the function's domain to the actual path length
              const globalStart = Math.max(0, x1);
              const globalEnd = Math.min(totalPathLength, x2);

              if (globalEnd <= globalStart) return;

              const scale = 0.5;
              const sampleStep = 1; // Sample every 1 meter
              const nSamples = Math.max(2, Math.ceil((globalEnd - globalStart) / sampleStep));

              for (let i = 0; i <= nSamples; i++) {
                const dist = globalStart + (globalEnd - globalStart) * (i / nSamples);
                const y = b !== 0 ? (-(a * dist + c) / b) * scale : 0;

                const pt = getPointAtDistance(continuousPath, pathDists, dist);
                const tangent = getTangentAtDistance(continuousPath, pathDists, dist);
                const normal = [-tangent[1], tangent[0]];
                const normLen = Math.sqrt(normal[0] ** 2 + normal[1] ** 2) || 1;
                const n = [normal[0] / normLen, normal[1] / normLen];

                const leftPt = offsetPoint(pt, n, y / 2);
                const rightPt = offsetPoint(pt, [-n[0], -n[1]], y / 2);

                allLeftPoints.push(leftPt);
                allRightPoints.push(rightPt);
              }
            });

            // 组合多边形点
            // const polygonCoords = [
            //   ...allLeftPoints,
            //   ...allRightPoints.reverse(),
            //   allLeftPoints[0]
            // ];

            // const polygon = {
            //   type: 'Feature',
            //   properties: {
            //     data: merged_functions,
            //     taxiway_sequence,
            //     conflict_idx: conflictIdx,
            //     flight1_id,
            //     flight2_id
            //   },
            //   geometry: { type: 'Polygon', coordinates: [polygonCoords] }
            // };

            // const areaId = `area-${flight1_id}-${flight2_id}-${conflictIdx}`;
            // try {
            //   map.current.addSource(areaId, { type: 'geojson', data: polygon });
            //   map.current.addLayer({
            //     id: areaId,
            //     type: 'fill',
            //     source: areaId,
            //     paint: {
            //       'fill-color': 'rgba(255,165,0, 0.5)',
            //       'fill-opacity': 0.5
            //     },
            //     interactive: true
            //   });
            //   map.current.on('click', areaId, (e) => {
            //     if (e.features && e.features.length > 0) {
            //       const props = e.features[0].properties;
            //       new maplibregl.Popup()
            //         .setLngLat(e.lngLat)
            //         .setHTML(`<pre>${JSON.stringify(props.data, null, 2)}</pre>`)
            //         .addTo(map.current);
            //     }
            //   });
            //   window._areaLayers.push(areaId);
            // } catch (error) {
            //   console.error('Error creating merged area layer:', areaId, error);
            // }







            const polygonCoords = [
              ...allLeftPoints,
              ...allRightPoints.reverse()
            ];

            polygonCoords.push([...allLeftPoints[0]]);



            const polygon = {
              type: 'Feature',
              properties: {
                data: merged_functions,
                taxiway_sequence,
                conflict_idx: conflictIdx,
                flight1_id,
                flight2_id,
                conflict_time
              },
              geometry: { type: 'Polygon', coordinates: [polygonCoords] }
            };

            const areaId = `area-${flight1_id}-${flight2_id}-${conflictIdx}`;
            try {

              map.current.addSource(areaId, { type: 'geojson', data: polygon });
              map.current.addLayer({
                id: areaId,
                type: 'fill',
                source: areaId,
                paint: {
                  'fill-color': 'rgba(255,165,0, 0.5)',
                  'fill-opacity': 0.5
                },
                interactive: true
              });
              // // 外边框线图层
              // const borderId = `${areaId}-border`;
              // map.current.addSource(borderId, {
              //   type: 'geojson',
              //   data: {
              //     type: 'Feature',
              //     geometry: {
              //       type: 'LineString',
              //       coordinates: polygonCoords
              //     }
              //   }
              // });
              // map.current.addLayer({
              //   id: borderId,
              //   type: 'line',
              //   source: borderId,
              //   paint: {
              //     // 渐变红色
              //     'line-width': 4,
              //     'line-color': [
              //       'interpolate',
              //       ['linear'],
              //       ['line-progress'],
              //       0, 'red',
              //       1, 'yellow'
              //     ]
              //   }
              // });
              map.current.on('click', areaId, (e) => {
                if (e.features && e.features.length > 0) {
                  const props = e.features[0].properties;
                  new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`<pre>${JSON.stringify(props.data, null, 2)}</pre>`)
                    .addTo(map.current);
                }
              });
              window._areaLayers.push(areaId);
              if (conflict_time && typeof conflict_time === 'number' && conflict_time > 0) {
                const timeoutMs = conflict_time * 1000 * 20; // 转换为毫秒

                //console.log(`设置面积图 ${areaId} 在 ${conflict_time} 秒后清除`);

                const timerId = setTimeout(() => {
                  // console.log(`自动清除面积图: ${areaId}`);

                  // 清除地图图层和数据源
                  if (map.current && map.current.getLayer(areaId)) {
                    map.current.removeLayer(areaId);
                  }
                  if (map.current && map.current.getSource(areaId)) {
                    map.current.removeSource(areaId);
                  }

                  // 从全局数组中移除
                  const index = window._areaLayers.indexOf(areaId);
                  if (index > -1) {
                    window._areaLayers.splice(index, 1);
                  }

                  // 清除定时器记录
                  delete areaTimers.current[areaId];
                }, timeoutMs);

                // 保存定时器ID
                areaTimers.current[areaId] = timerId;
              }
            } catch (error) {
              console.error('Error creating merged area layer:', areaId, error);
            }


          });


        }

        function processTaxiwayFunctions(taxiwayId, functions, conflictIdx, conflictItem) {
          // 找到该taxiway的polyline
          // console.log('Processing taxiway_id:', taxiwayId, 'functions:', functions);

          const feature = geojsonData.features.find(f => {
            const featureId = String(parseInt(f.id));
            const searchId = String(taxiwayId);

            return featureId === searchId;
          });
          console.log('Found feature:', feature);
          if (!feature) {
            console.warn('Feature not found for taxiway_id:', taxiwayId);
            return;
          }

          // 合并所有分段函数为一个连续的面积图
          const scale = 0.1;
          const sampleStep = 1;
          const rawLine = feature.geometry.coordinates[0];
          const dists = getCumulativeDistances(rawLine);

          // 收集所有边界点
          const allLeftPoints = [];
          const allRightPoints = [];

          // 处理每个分段函数
          functions.forEach((seg, idx) => {
            const { x1, x2, a, b, c } = seg;

            // 计算x1、x2对应的y1、y2
            let y1 = b !== 0 ? (-(a * x1 + c) / b) * scale : 0;
            let y2 = b !== 0 ? (-(a * x2 + c) / b) * scale : 0;
            console.log("x1,x2,y1,y2", x1, x2, y1, y2);

            // 采样x1到x2区间的所有点
            const nSamples = Math.max(2, Math.ceil((x2 - x1) / sampleStep));
            const segmentLeftPoints = [];
            const segmentRightPoints = [];

            for (let i = 0; i <= nSamples; i++) {
              // 当前采样点在x1-x2区间的距离
              const x = x1 + (x2 - x1) * (i / nSamples);
              // 线性插值y
              const y = y1 + (y2 - y1) * (i / nSamples);

              // 取出该点在polyline上的经纬度
              const pt = getPointAtDistance(rawLine, dists, x);
              // 取出该点的法线方向
              const tangent = getTangentAtDistance(rawLine, dists, x);
              const normal = [-tangent[1], tangent[0]];
              const normLen = Math.sqrt(normal[0] ** 2 + normal[1] ** 2) || 1;
              const n = [normal[0] / normLen, normal[1] / normLen];

              // 左右偏移
              segmentLeftPoints.push(offsetPoint(pt, n, y / 2));
              segmentRightPoints.push(offsetPoint(pt, [-n[0], -n[1]], y / 2));
            }

            // 将当前分段函数的点添加到总集合中
            // 对于第一个分段函数，直接添加所有点
            if (idx === 0) {
              allLeftPoints.push(...segmentLeftPoints);
              allRightPoints.push(...segmentRightPoints);
            } else {
              // 对于后续分段函数，只添加从第二个点开始的部分（避免重复）
              allLeftPoints.push(...segmentLeftPoints.slice(1));
              allRightPoints.push(...segmentRightPoints.slice(1));
            }
          });

          // 按照指定顺序组合多边形点：(x1,y1) -> (x2,y2) -> (x3,y3) -> (x4,y4) -> (x4,0) -> (x3,0) -> (x2,0) -> (x1,0)
          const polygonCoords = [
            ...allLeftPoints,  // 上边界：从左到右
            ...allRightPoints.reverse(),  // 下边界：从右到左
            allLeftPoints[0]  // 闭合
          ];

          const polygon = {
            type: 'Feature',
            properties: {
              data: functions,
              taxiway_id: taxiwayId,
              conflict_idx: conflictIdx,
              flight1_id: conflictItem.flight1_id,
              flight2_id: conflictItem.flight2_id
            },
            geometry: { type: 'Polygon', coordinates: [polygonCoords] }
          };

          // 绘制合并后的面积图
          const areaId = `area-${taxiwayId}-${conflictIdx}`;
          console.log('Creating merged area layer:', areaId, 'with polygon:', polygon);

          try {
            map.current.addSource(areaId, { type: 'geojson', data: polygon });
            map.current.addLayer({
              id: areaId,
              type: 'fill',
              source: areaId,
              paint: {
                'fill-color': 'rgba(255,165,0, 0.5)',
                'fill-opacity': 0.5
              },
              interactive: true
            });
            map.current.on('click', areaId, (e) => {
              if (e.features && e.features.length > 0) {
                const props = e.features[0].properties;
                new maplibregl.Popup()
                  .setLngLat(e.lngLat)
                  .setHTML(`<pre>${JSON.stringify(props.data, null, 2)}</pre>`)
                  .addTo(map.current);
              }
            });
            window._areaLayers.push(areaId);
            console.log('Successfully created merged area layer:', areaId);
          } catch (error) {
            console.error('Error creating merged area layer:', areaId, error);
          }
        }


      })
      .catch(error => console.error('数据加载失败:', error));


    return () => {

      map.current?.remove();
      disposer1(); // 清理观察者
      disposer2(); // 清理观察者
      if (disposer3) disposer3(); // 清理冲突标记观察者
      if (disposer4) disposer4(); // 清理planned flights观察者
      if (disposerSim) disposerSim(); // 清理模拟观察者
      if (highlightTimer) clearTimeout(highlightTimer);
      // 新增：清理所有面积图定时器
      Object.values(areaTimers.current).forEach(timerId => {
        clearTimeout(timerId);
      });
      areaTimers.current = {};

      // 清理planned paths图层
      clearPlannedPaths();
      
      // 清理冲突标记
      clearConflictMarkers();

      if (window._areaLayers) {
        window._areaLayers.forEach(id => {
          if (map.current.getLayer(id)) map.current.removeLayer(id);
          if (map.current.getSource(id)) map.current.removeSource(id);
        });
        window._areaLayers = [];
      }
    }
  }, []);


  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* 冲突解决界面 - 左侧 30% 宽度 */}
      <div style={{
        width: '30%',
        height: '100%',
        backgroundColor: 'transparent',
        borderRight: '1px solid #e9ecef',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <ConflictResolutionPanel />
      </div>

      {/* 地图区域 - 右侧 70% 宽度 */}
      <div style={{ width: '70%', height: '100%' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
})

// 冲突解决面板组件
const ConflictResolutionPanel = observer(() => {

  // 使用WebSocketStore中的状态，而不是本地状态
  const conflicts = websocketStore.conflictResolutions;
  

  const selectedConflict = websocketStore.selectedConflict;
  const resolutions = websocketStore.resolutions;
  const resolution_analysis = websocketStore.resolution_analysis;
  const loading = websocketStore.conflictResolutionLoading;
  
  // 获取特定冲突的解决方案 - 直接调用WebSocketStore的方法
  const getConflictResolutions = (conflictId) => {
    websocketStore.getConflictResolutions(conflictId);
    
  };

  // 应用解决方案 - 直接调用WebSocketStore的方法
  const applyResolution = (conflictId, solutionId) => {
    websocketStore.applyConflictResolution(conflictId, solutionId);
    console.log("应用了接圈方案",conflictId,solutionId)
  };

  // 模拟应用解决方案
  const simulateResolution = (conflictId, solutionId) => {
    if (websocketStore.socket && websocketStore.socket.connected) {
      console.log("模拟应用冲突解决方案", conflictId, solutionId);
      websocketStore.socket.emit('simulate_conflict_resolution', {
        conflict_id: conflictId,
        solution_id: solutionId
      });
    } else {
      console.error('WebSocket未连接，无法发送模拟应用请求');
    }
  };

  // 当选中冲突变化时，自动获取并展示解决方案
  const REQUEST_INTERVAL_MS = 3000; // 请求间隔（毫秒）
  const lastRequestRef = React.useRef({ id: null, ts: 0 });
  React.useEffect(() => {
    if (!selectedConflict) return;
    const id = selectedConflict.conflict_id ?? selectedConflict.id;
    if (!id) return;

    const now = Date.now();
    const alreadyLoaded = (
      resolution_analysis && resolution_analysis.conflict_id === id &&
      Array.isArray(resolutions) && resolutions.length > 0
    );

    // 如果已加载当前冲突的解决方案，更新时间戳并跳过
    if (alreadyLoaded) {
      lastRequestRef.current = { id, ts: now };
      return;
    }

    // 限流：若正在加载或未到请求间隔，跳过
    const timePassed = now - (lastRequestRef.current.ts || 0);
    const sameId = lastRequestRef.current.id === id;
    const canRequest = !loading && (!sameId || timePassed > REQUEST_INTERVAL_MS);
    if (canRequest) {
      lastRequestRef.current = { id, ts: now };
      getConflictResolutions(id);
    }
  }, [selectedConflict, loading, resolutions, resolution_analysis]);

  // 注释掉自动选择冲突的逻辑，让用户手动选择
  // React.useEffect(() => {
  //   if (!selectedConflict && Array.isArray(conflicts) && conflicts.length > 0) {
  //     const firstUnresolved = conflicts.find(c => c.status !== 'resolved') || conflicts[0];
  //     websocketStore.selectedConflict = firstUnresolved;
  //   }
  // }, [conflicts, selectedConflict]);

  return (
    <div style={{
      padding: '16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 标题与下划线已移除 */}

      {/* 加载状态 */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#666'
        }}>
          处理中...
        </div>
      )}

      {/* 冲突列表 */}
      {!selectedConflict && (
        <div className="prettyScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          <h4 style={{
            fontSize: '14px',
            marginBottom: '12px',
            color: '#555'
          }}>
            当前冲突 ({conflicts.length})
          </h4>

          {conflicts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#999',
              padding: '20px'
            }}>
              暂无冲突
            </div>
          ) : (
            conflicts.map(conflict => (
              <div
                key={conflict.id}
                style={{
                  position: 'relative',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '6px',
                  backgroundColor: conflict.status === 'resolved' ? '#f8f9fa' : 'white',
                  borderLeft: `4px solid ${conflict.severity === 'HIGH' ? '#dc3545' :
                    conflict.severity === 'MEDIUM' ? '#ffc107' : '#28a745'
                    }`,
                  opacity: conflict.status === 'resolved' ? 0.6 : 1
                }}
              >
               
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '13px'
                  }}>
                    {conflict.id}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor:
                        conflict.severity === 'HIGH' ? '#dc3545' :
                          conflict.severity === 'MEDIUM' ? '#ffc107' : '#28a745',
                      color: 'white'
                    }}>
                      {conflict.severity || 'UNKNOWN'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor:
                        conflict.conflict_type === 'CROSSING' ? '#dc3545' :
                          conflict.conflict_type === 'parallel' ? '#ffc107' : '#28a745',
                      color: 'white'
                    }}>
                      {conflict.conflict_type || 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                  航班: {conflict.involved_flights?.join(', ') || 'N/A'} | 节点: {conflict.conflict_node || 'N/A'}
                </div>

                {/* 整卡点击即选中并自动获取解决方案 */}
                <div
                  onClick={() => {
                    // 仅设置选中，实际请求由上面的副作用限流触发
                    websocketStore.selectedConflict = conflict;
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#e9f2ff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    border: '1px solid #0b5ed7'
                  }}
                  title="查看详情与方案"
                >
                  <span style={{
                    fontSize: '10px',
                    color: '#0b5ed7',
                    fontWeight: 'bold'
                  }}>
                    ▶
                  </span>
                </div>

                {conflict.status === 'resolved' && (
                  <div style={{
                    textAlign: 'center',
                    color: '#28a745',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    已解决
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 解决方案详情 */}
      {selectedConflict && (
        <div className="prettyScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <button
              onClick={() => {
                websocketStore.selectedConflict = null;
                websocketStore.resolutions = [];
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                marginRight: '8px',
                color: '#007bff'
              }}
            >
              ←
            </button>
            <h4 style={{
              margin: 0,
              fontSize: '14px',
              color: '#555'
            }}>
              {selectedConflict.conflict_id} 解决方案
            </h4>
          </div>

          {/* 计算度量最大值用于归一化显示 */}
          {(() => {
            return null;
          })()}

          {(() => {
            // 辅助：策略图标
            const StrategyIcon = ({ strategy }) => {
              const color = strategy === 'emergency_mode' ? '#dc3545'
                : strategy === 'waiting' ? '#ffc107'
                : strategy === 'rerouting' ? '#17a2b8'
                : '#6c757d';
              return (
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                  {strategy === 'emergency_mode' && (
                    <g fill={color}>
                      <rect x="10" y="3" width="4" height="10" rx="2"></rect>
                      <circle cx="12" cy="19" r="3"></circle>
                    </g>
                  )}
                  {strategy === 'waiting' && (
                    <g stroke={color} strokeWidth="2" fill="none">
                      <circle cx="12" cy="12" r="9"></circle>
                      <path d="M12 12 L12 7"></path>
                      <path d="M12 12 L16 14"></path>
                    </g>
                  )}
                  {strategy === 'rerouting' && (
                    <g fill="none" stroke={color} strokeWidth="2">
                      <path d="M4 18 C8 10, 12 14, 16 6" />
                      <path d="M16 6 L13 6 M16 6 L16 9" />
                    </g>
                  )}
                  {strategy !== 'emergency_mode' && strategy !== 'waiting' && strategy !== 'rerouting' && (
                    <g fill={color}>
                      <circle cx="12" cy="12" r="8"></circle>
                    </g>
                  )}
                </svg>
              );
            };

            // 辅助：度量条形图（路径增量/时间增量）
            const MetricBars = ({ pathDelta = 0, timeDelta = 0, maxPath = 1, maxTime = 1 }) => {
              const pw = 160, ph = 40; // SVG尺寸
              const pNorm = Math.min(1, Math.abs(pathDelta) / (maxPath || 1));
              const tNorm = Math.min(1, Math.abs(timeDelta) / (maxTime || 1));
              const barWPath = Math.max(2, pNorm * (pw - 60));
              const barWTime = Math.max(2, tNorm * (pw - 60));
              return (
                <svg width={pw} height={ph} style={{ border: '1px solid #eee', borderRadius: 4 }}>
                  <text x="6" y="14" fontSize="11" fill="#666">路径增量</text>
                  <rect x="60" y="6" width={pw - 70} height="8" fill="#f0f0f0" rx="3" />
                  <rect x="60" y="6" width={barWPath} height="8" fill="#17a2b8" rx="3" />
                  <text x={60 + barWPath + 4} y="13" fontSize="10" fill="#333">{pathDelta?.toFixed ? pathDelta.toFixed(2) : pathDelta}</text>

                  <text x="6" y="34" fontSize="11" fill="#666">时间增量</text>
                  <rect x="60" y="26" width={pw - 70} height="8" fill="#f0f0f0" rx="3" />
                  <rect x="60" y="26" width={barWTime} height="8" fill="#007bff" rx="3" />
                  <text x={60 + barWTime + 4} y="33" fontSize="10" fill="#333">{timeDelta?.toFixed ? timeDelta.toFixed(2) : timeDelta}</text>
                </svg>
              );
            };

            // 辅助：影响图（impact_graph）
            const ImpactGraph = ({ impactGraph }) => {
              const nodes = impactGraph?.nodes ? Object.entries(impactGraph.nodes) : [];
              const edges = impactGraph?.edges || [];
              const w = 220, h = 80;
              const positions = nodes.map((n, i) => ({ key: n[0], x: 40 + i * (w / Math.max(3, nodes.length)), y: h / 2 }));
              const severityColor = (sev) => sev === 'high' || sev === 'HIGH' ? '#dc3545' : sev === 'medium' || sev === 'MEDIUM' ? '#ffc107' : '#28a745';
              return (
                <svg width={w} height={h} style={{ border: '1px solid #eee', borderRadius: 4 }}>
                  {/* 边 */}
                  {edges.map((e, idx) => {
                    const fromIdx = positions.findIndex(p => p.key === e[0] || p.key === e.from);
                    const toIdx = positions.findIndex(p => p.key === e[1] || p.key === e.to);
                    if (fromIdx === -1 || toIdx === -1) return null;
                    const from = positions[fromIdx];
                    const to = positions[toIdx];
                    return <line key={idx} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#bbb" strokeWidth="1" />
                  })}
                  {/* 节点 */}
                  {nodes.map(([id, info], i) => (
                    <g key={id}>
                      <circle cx={positions[i].x} cy={positions[i].y} r={12} fill={severityColor(info.severity)} opacity="0.8" />
                      <text x={positions[i].x} y={positions[i].y - 16} textAnchor="middle" fontSize="10" fill="#333">{id}</text>
                      {typeof info.delay_minutes === 'number' && (
                        <text x={positions[i].x} y={positions[i].y + 18} textAnchor="middle" fontSize="10" fill="#333">{info.delay_minutes.toFixed(2)}m</text>
                      )}
                    </g>
                  ))}
                </svg>
              );
            };

            // 计算归一化用的最大值
            const maxPath = Math.max(...resolutions.map(r => Math.abs(r.path_length_delta || 0)), 1);
            const maxTime = Math.max(...resolutions.map(r => Math.abs(r.time_delta_minutes || 0)), 1);

            return (
              <>
                {resolutions.map((resolution) => (
                  <div
                    key={resolution.option_id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '12px',
                      backgroundColor: 'transparent'
                    }}
                  >
                    {/* 顶部：策略图标 + 策略名称 + 目标航班 */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <StrategyIcon strategy={resolution.strategy} />
                      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333' }}>{resolution.strategy}</div>
                      <span style={{ marginLeft: '8px', fontSize: 11, padding: '2px 6px', borderRadius: 3, backgroundColor: '#e8f3ff', color: '#1677ff' }}>
                        目标: {resolution.target_flight}
                      </span>
                    </div>

                    {/* 指标、影响图与操作按钮在同一行 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <MetricBars
                        pathDelta={resolution.path_length_delta || 0}
                        timeDelta={resolution.time_delta_minutes || 0}
                        maxPath={maxPath}
                        maxTime={maxTime}
                      />
                      <ImpactGraph impactGraph={resolution.impact_graph} />
                      {/* 右侧图标按钮 */}
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          title="应用此方案"
                          aria-label="应用此方案"
                          onClick={() => applyResolution(resolution_analysis.conflict_id, resolution.option_id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#28a745',
                            borderRadius: '4px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.color = '#218838'}
                          onMouseOut={(e) => e.currentTarget.style.color = '#28a745'}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" opacity="0.15" />
                            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          title="模拟应用"
                          aria-label="模拟应用"
                          onClick={() => simulateResolution(resolution_analysis.conflict_id, resolution.option_id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#007bff',
                            borderRadius: '4px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.color = '#0056b3'}
                          onMouseOut={(e) => e.currentTarget.style.color = '#007bff'}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" opacity="0.15" />
                            <path d="M9 8l7 4-7 4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
});

export default TaxiwayMap;

// 计算两点间距离（米，WGS84球面近似）
function getDistance(lon1, lat1, lon2, lat2) {
  const R = 6378137; // 地球半径（米）
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 计算polyline每个点的累计距离
function getCumulativeDistances(line) {
  let dists = [0];
  for (let i = 1; i < line.length; i++) {
    const [lon1, lat1] = line[i - 1];
    const [lon2, lat2] = line[i];
    dists.push(dists[i - 1] + getDistance(lon1, lat1, lon2, lat2));
  }
  return dists;
}

// 在polyline上找到距离为x的点（线性插值）
function getPointAtDistance(line, dists, x) {
  for (let i = 1; i < dists.length; i++) {
    if (x <= dists[i]) {
      const t = (x - dists[i - 1]) / (dists[i] - dists[i - 1]);
      const [lon1, lat1] = line[i - 1];
      const [lon2, lat2] = line[i];
      return [
        lon1 + (lon2 - lon1) * t,
        lat1 + (lat2 - lat1) * t
      ];
    }
  }
  // 超出polyline末端
  return line[line.length - 1];
}

// 计算polyline上距离为x点的切线方向（单位向量，经纬度差）
function getTangentAtDistance(line, dists, x) {
  for (let i = 1; i < dists.length; i++) {
    if (x <= dists[i]) {
      const [lon1, lat1] = line[i - 1];
      const [lon2, lat2] = line[i];
      let dx = lon2 - lon1;
      let dy = lat2 - lat1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return [0, 0];
      return [dx / len, dy / len];
    }
  }
  // 末端
  return [0, 0];
}

// 经纬度偏移（以米为单位，近似公式，适合小范围）
function offsetPoint([lon, lat], [nx, ny], d) {
  // nx, ny为单位向量（经度、纬度方向）
  // d为米
  const R = 6378137;
  const dLat = (d * ny) / R;
  const dLon = (d * nx) / (R * Math.cos(Math.PI * lat / 180));
  return [
    lon + dLon * 180 / Math.PI,
    lat + dLat * 180 / Math.PI
  ];
}