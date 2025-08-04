import React, { useEffect, useRef, useState, useContext } from 'react';
import maplibregl, { Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { observer } from 'mobx-react-lite';
import websocketStore from '@/stores/WebSocketStore';
import { autorun } from 'mobx';
// import { WebSocketContext } from '@/websocket/WebsocketProvider';

const TaxiwayMap = observer(() => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({}); // 存储飞机标记（以便于更新和删除）
  const geoJsonUrl = '/taxiwayline2.geojson'; // 文件需放在public目录下
  // const { socket } = useContext(WebSocketContext);
  // const [inputMessage, setInputMessage] = useState('taxiway');


  useEffect(() => {
        
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
          zoom: 17,
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
                '#888',  // 未命名滑行道颜色
                // '#ff0000' // 命名滑行道颜色
                '#e9e9e9'
              ],
              'line-width':  [
                'interpolate', // 使用插值函数
                ['linear'], // 线性插值
                ['zoom'], // 使用缩放级别
                0,  // 在缩放级别 0 时，线宽为 1
                1, // 线宽为 1
                12, // 在缩放级别 12 时，线宽为 4
                4, // 线宽为 4
                18, // 在最大缩放级别 18 时，线宽为 10
                10 // 线宽为 10
            ],
              'line-opacity': 0.8
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            }
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

    const colors = ['rgb(228,26,28)','rgb(55,126,184)','rgb(77,175,74)','rgb(152,78,163)','rgb(255,127,0)','rgb(255,255,51)','rgb(166,86,40)','rgb(247,129,191)']

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
        console.log('plane1', plane);
          const { id, coords, cur_path, trajectory } = plane;
          const color = getColor(id); // 根据飞机ID设置颜色，默认黑色

        
          // 新增飞机
          if (!existingPlaneIds.has(id)) {

            const marker = new Marker({ element:createAirplaneMarker(color) }) // 使用指定颜色创建标记
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
              console.log('keysArray', keysArray);
              console.log('id', id);
              console.log(keysArray.indexOf(id))
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
      return Array.from({length: times}, (_, i) => {
        const alpha = (1 - i/(steps)).toFixed(2); // 保留两位小数
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
        "type":"FeatureCollection","features":[
          {"type":"Feature","properties":{"color":"#FF1919"},"geometry":{"type":"MultiLineString","coordinates":[[[116.60957629798676,40.07072042269285],[116.60961207779839,40.07049230443101]],[[116.60961207779839,40.07049230443101],[116.60963321741602,40.07035752551841]],[[116.60963321741602,40.07035752551841],[116.60965000451456,40.07025049637292]],[[116.60965000451456,40.07025049637292],[116.60965485000008,40.070219605000034]],[[116.60965485000008,40.070219605000034],[116.6096962291351,40.06995578124849]],[[116.6096962291351,40.06995578124849],[116.60972500800007,40.06977229400008]],[[116.60972500800007,40.06977229400008],[116.60971822385996,40.06968795905062]],[[116.60971822385996,40.06968795905062],[116.60971402993081,40.06966143549661]],[[116.60971402993081,40.06966143549661],[116.60969898350422,40.06960770804471]],[[116.60969898350422,40.06960770804471],[116.60967780773305,40.069556088079956]],[[116.60967780773305,40.069556088079956],[116.60965078838404,40.06950727221347]],[[116.60965078838404,40.06950727221347],[116.60961829008313,40.069461919214866]],[[116.60961829008313,40.069461919214866],[116.60958075139463,40.06942064112253]],[[116.60958075139463,40.06942064112253],[116.6095645741975,40.0694065504]],[[116.6095645741975,40.0694065504],[116.60950016253007,40.06936079056222]],[[116.60950016253007,40.06936079056222],[116.60937563129383,40.069304415965526]]]}},
          {"type":"Feature","properties":{"color":"#FF3232", "index":3},"geometry":{"type":"MultiLineString","coordinates":[[[116.60937563129383,40.069304415965526],[116.60953867890284,40.06938399498392]],[[116.60953867890284,40.06938399498392],[116.60944325710257,40.069326507543295]],[[116.60944325710257,40.069326507543295],[116.60934724367137,40.069295142473926]],[[116.60934724367137,40.069295142473926],[116.60781169709529,40.06915322543125]]]}}]
      }

      const marker1 = new Marker({ element:createAirplaneMarker(color) }) // 使用指定颜色创建标记
                .setLngLat([116.60937563129383,40.069304415965526]) // 设置标记位置
                .setPopup(new Popup().setHTML(`<h1>1</h1>`))
                .addTo(map.current);

      const marker2 = new Marker({ element:createAirplaneMarker(color) }) // 使用指定颜色创建标记
      .setLngLat([116.60953867890284,40.06938399498392]) // 设置标记位置
      .setPopup(new Popup().setHTML(`<h1>2</h1>`))
      .addTo(map.current);


      const marker3 = new Marker({ element:createAirplaneMarker(color) }) // 使用指定颜色创建标记
      .setLngLat([116.60944325710257,40.069326507543295]) // 设置标记位置
      .setPopup(new Popup().setHTML(`<h1>3</h1>`))
      .addTo(map.current);

      const marker4 = new Marker({ element:createAirplaneMarker(color) }) // 使用指定颜色创建标记
      .setLngLat([116.60957629798676,40.07072042269285]) // 设置标记位置
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
      let geodata = {type: 'FeatureCollection', features: []}; // 初始化地理数据对象
      let index = 0;
      // const multiColor = generateAlphaVariants(color, 10, 5); // 生成颜色透明度阶梯

      // console.log('绘制轨迹', id, trajectorys);

      trajectorys.forEach(trajectory => {
        // console.log('绘制轨迹',  trajectory);
        if (trajectory.length > 0) {
            geodata.features.push({
                type: 'Feature',
                properties: { 
                  color: grayScale[Math.min((index++) , 9)] ,
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
                
                "line-color": ['get','color'], // 使用指定颜色
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
      console.log('冲突数据变化:', websocketStore.conflicts);
      if (websocketStore.conflicts != null) {
          const conflict = websocketStore.conflicts;
          // const { id1, id2, time, coords1, coords2, distance } = websocketStore.conflicts;
          console.log('冲突数据:', conflict);
          const color = '#984ea3'; // 根据飞机ID设置颜色，默认黑色
          const trajectory = [[
            [conflict.pos1, conflict.pos2]]
          ];
          drawConflict(conflict.id1+'-'+conflict.id2, trajectory, color, 0); // 绘制轨迹

      }
    });


    // 绘制冲突连线
    const drawConflict = (id, trajectorys, color, h) => {
      let geodata = {type: 'FeatureCollection', features: []}; // 初始化地理数据对象
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

      console.log('绘制冲突连线', id);
      console.log(JSON.stringify(geodata));

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
        const disposer3 = autorun(() => {
          const overlapTaxiways = websocketStore.overlapTaxiways;
          if (overlapTaxiways && Array.isArray(overlapTaxiways) && overlapTaxiways.length > 0) {
            const ids = overlapTaxiways.map(item => String(item.taxiway_id));
            console.log('ids', ids);
          
          
            highlightTaxiwayByLayerWithArea(overlapTaxiways);
            if (highlightTimer) {
              clearTimeout(highlightTimer);
              highlightTimer = null;
            }
          }
        });

        function highlightTaxiwayByLayerWithArea(overlapData) {
          if (!map.current || !geojsonData) return;

          // 先移除旧的面积图层
          if (window._areaLayers) {
            window._areaLayers.forEach(id => {
              if (map.current.getLayer(id)) map.current.removeLayer(id);
              if (map.current.getSource(id)) map.current.removeSource(id);
            });
          }
          window._areaLayers = [];

          overlapData.forEach(item => {
            const { taxiway_id, data } = item;
            // 找到该taxiway的polyline
            console.log('taxiway_id', taxiway_id,'data',data);
            const feature = geojsonData.features.find(f => String(parseInt(f.id)) === String(taxiway_id));
            console.log('feature', feature);
            if (!feature) return;
            const line = feature.geometry.coordinates[0]; // 只取第一段
            const dists = getCumulativeDistances(line);

            data.forEach((seg, idx) => {
              const { x1, x2, a, b, c } = seg;
              const scale = 0.1; // 你原有的scale
              // 采样步长可以适当大一点，比如1米
              const sampleStep = 1;

              // 1. 取出polyline
              const rawLine = feature.geometry.coordinates[0];
              const dists = getCumulativeDistances(rawLine);

              // 2. 计算x1、x2对应的y1、y2
              let y1 = b !== 0 ? (-(a * x1 + c) / b) * scale : 0;
              let y2 = b !== 0 ? (-(a * x2 + c) / b) * scale : 0;
              console.log("x1,x2,y1,y2",x1,x2,y1,y2)
              // 3. 采样x1到x2区间的所有点
              const totalDist = dists[dists.length - 1];
              const leftPoints = [];
              const rightPoints = [];
              const nSamples = Math.max(2, Math.ceil((x2 - x1) / sampleStep));
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
                const normLen = Math.sqrt(normal[0]**2 + normal[1]**2) || 1;
                const n = [normal[0]/normLen, normal[1]/normLen];

                // 左右偏移
                leftPoints.push(offsetPoint(pt, n, y/2));
                rightPoints.push(offsetPoint(pt, [-n[0], -n[1]], y/2));
              }

              // 4. 组合多边形（左边界+右边界逆序+闭合）
              const polygonCoords = [
                ...leftPoints,
                ...rightPoints.reverse(),
                leftPoints[0]
              ];

              const polygon = {
                type: 'Feature',
                properties: { data: seg, taxiway_id, idx },
                geometry: { type: 'Polygon', coordinates: [polygonCoords] }
              };

              // 5. 绘制
              const areaId = `area-${taxiway_id}-${idx}`;
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
            });
          });
        }
      
      })
      .catch(error => console.error('数据加载失败:', error));


    return () => {
      console.log('清理地图');
      map.current?.remove();
      disposer1(); // 清理观察者
      disposer2(); // 清理观察者
      if (highlightTimer) clearTimeout(highlightTimer);
      if (window._areaLayers) {
        window._areaLayers.forEach(id => {
          if (map.current.getLayer(id)) map.current.removeLayer(id);
          if (map.current.getSource(id)) map.current.removeSource(id);
        });
        window._areaLayers = [];
      }
      disposer3 && disposer3();
    }
  }, []);


  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
})

export default TaxiwayMap;

// 计算两点间距离（米，WGS84球面近似）
function getDistance(lon1, lat1, lon2, lat2) {
  const R = 6378137; // 地球半径（米）
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 计算polyline每个点的累计距离
function getCumulativeDistances(line) {
  let dists = [0];
  for (let i = 1; i < line.length; i++) {
    const [lon1, lat1] = line[i-1];
    const [lon2, lat2] = line[i];
    dists.push(dists[i-1] + getDistance(lon1, lat1, lon2, lat2));
  }
  return dists;
}

// 在polyline上找到距离为x的点（线性插值）
function getPointAtDistance(line, dists, x) {
  for (let i = 1; i < dists.length; i++) {
    if (x <= dists[i]) {
      const t = (x - dists[i-1]) / (dists[i] - dists[i-1]);
      const [lon1, lat1] = line[i-1];
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
      const [lon1, lat1] = line[i-1];
      const [lon2, lat2] = line[i];
      let dx = lon2 - lon1;
      let dy = lat2 - lat1;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len === 0) return [0, 0];
      return [dx/len, dy/len];
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