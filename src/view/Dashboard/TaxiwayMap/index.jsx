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
          zoom: 17
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
              'line-width': 4,
              'line-opacity': 0.9
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            }
          });


          // 必须启用地形
          // map.current.addSource('terrain', {
          //   type: 'raster-dem',
          //   tiles: ['https://demotiles.maplibre.org/terrain/{z}/{x}/{y}.png'],
          //   tileSize: 256,
          //   maxzoom: 14
          // });
          // map.current.setTerrain({ source: 'terrain', exaggeration: 1.5 });


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
              duration: 1000
            });
          }

          console.log('地图加载完成');

          websocketStore.startSimulate(); // 启动模拟

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
          const { id, coords, cur_path, trajectory } = plane;
          const color = getColor(id); // 根据飞机ID设置颜色，默认黑色

    

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
  
    // 绘制飞机的轨迹
    const drawTrajectory = (id, trajectorys, color, h) => {
      let geodata = {type: 'FeatureCollection', features: []}; // 初始化地理数据对象
      let index = 0;
      const multiColor = generateAlphaVariants(color, 10, 5); // 生成颜色透明度阶梯

      // console.log('绘制轨迹', id, trajectorys);

    
      trajectorys.forEach(trajectory => {
        // console.log('绘制轨迹',  trajectory);
        if (trajectory.length > 0) {
            geodata.features.push({
                type: 'Feature',
                properties: { 
                  color: grayScale[Math.min((index++) , 9)] ,
                  height: h ? h : 0, // 如果没有高度，默认为0
                },
                geometry: {
                    type: 'MultiLineString',
                    coordinates: trajectory
                }
            });
        }
      })

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
                "line-width": 2,
                'line-offset': [
                  '*',
                  ['get', 'height'], // 车道序号(0,1,2...)
                  // ['interpolate', ['linear'], ['zoom'],
                  //   10, 3,  // 缩放小时间距小
                  //   15, 8   // 放大地图时间距大
                  // ]
                ],
                // 'line-translate': [2, 2], // [x, y] 偏移量
                // 'line-translate-anchor': 'map', // 相对视口偏移
                // 添加3D效果
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
    const disposer = autorun(() => {
      if (websocketStore.planePosition.length > 0) {
        updatePlane();
      }
    });

    return () => {
      console.log('清理地图');
      map.current?.remove();
      disposer(); // 清理观察者
    }
  }, []);


  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
})

export default TaxiwayMap;