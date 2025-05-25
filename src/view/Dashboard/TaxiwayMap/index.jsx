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
                '#ff0000' // 命名滑行道颜色
              ],
              'line-width': 4,
              'line-opacity': 0.9
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
              duration: 1000
            });
          }

          console.log('地图加载完成');

          websocketStore.startSimulate(); // 启动模拟

        });
      })
      .catch(error => console.error('数据加载失败:', error));


    // const updatePlane = () => {
    //   // console.log('planePosition:', websocketStore.planePosition);
    //   console.log('更新飞机位置');
    //   if (!map.current) return; // 确保地图已加载
    //   // if (planePosition.length === 0) return; // 如果没有飞机位置数据，则不进行更新

    //   // 首先清理目前的标记
    //   // console.log(markers.current);
    //   Object.values(markers.current).forEach(marker => marker.remove());
    //   markers.current = {}; // 清空标记记录

    //   // 添加新标记
    //   websocketStore.planePosition.forEach(plane => {
    //       const marker = new Marker()
    //           .setLngLat([plane.coords[0], plane.coords[1]]) // 设置标记位置
    //           .setPopup(new Popup().setHTML(`<h1>${plane.id}</h1>`))
    //           .addTo(map.current)
    //       markers.current[plane.id] = marker; // 存储到字典中
    //   });

    // }
    
    // const updatePlane = () => {
    //   console.log('更新飞机位置');
    //   if (!map.current) return; // 确保地图已加载
  
    //   // 记录当前存在的飞机ID以及它们的计数
    //   const existingPlaneIds = new Set(Object.keys(markers.current));
    //   const updatedPlaneIds = new Set();
  
    //   // 处理现有和新飞机标记
    //   websocketStore.planePosition.forEach(plane => {
    //       const { id, coords } = plane;
  
    //       // 新增飞机
    //       if (!existingPlaneIds.has(id)) {
    //           const marker = new Marker()
    //               .setLngLat([coords[0], coords[1]]) // 设置标记位置
    //               .setPopup(new Popup().setHTML(`<h1>${id}</h1>`))
    //               .addTo(map.current);
    //           markers.current[id] = marker; // 存储新标记
    //       } else {
    //           // 更新已有飞机标记的位置
    //           const marker = markers.current[id];
    //           marker.setLngLat([coords[0], coords[1]]); // 更新位置
  
    //           // 这里可以使用 gsap 或 CSS 动画来平滑过渡位置
    //           // 例如：marker.getElement().style.transition = "transform 0.5s";
    //           // marker.getElement().style.transform = `translate(${...})`; // 这是一个简化方案
    //       }
  
    //       // 记录更新的飞机ID
    //       updatedPlaneIds.add(id);
    //   });
  
    //   // 删除超过赛车次数未出现的飞机标记
    //   Object.keys(markers.current).forEach(id => {
    //       if (!updatedPlaneIds.has(id)) {
    //           if (!markers.current[id].count) {
    //               markers.current[id].count = 1; // 初始化计数
    //           } else if (markers.current[id].count < 10) {
    //               markers.current[id].count += 1; // 增加计数
    //           } else {
    //               // 超过5次未出现，移除该标记
    //               markers.current[id].remove();
    //               delete markers.current[id]; // 从字典中删除标记记录
    //               console.log(`移除飞机: ${id}`);
    //           }
    //       } else {
    //           markers.current[id].count = 0; // 重置计数
    //       }
    //   });
    // };
    const colors = ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0','#f0027f','#bf5b17','#666666', '#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666']
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

      //|coords[0] = [40.078311811606845,116.5924545365713] 40.05957986775247|116.60989032423797|
      // const acolor = '#000000';
      // const amarker = new Marker({acolor}) // 使用指定颜色创建标记
      //   .setLngLat([116.5924545365713, 40.078311811606845]) // 设置标记位置
      //   // .setPopup(new Popup().setHTML(`<h1>${id}</h1>`))
      //   .addTo(map.current);

      // const bmarker = new Marker({acolor}) // 使用指定颜色创建标记
      //   .setLngLat([116.60989032423797, 40.05957986775247]) // 设置标记位置
      //   // .setPopup(new Popup().setHTML(`<h1>${id}</h1>`))
      //   .addTo(map.current);

  
      // 处理现有和新飞机标记
      websocketStore.planePosition.forEach(plane => {
          const { id, coords, cur_path } = plane;
          const color = getColor(id); // 根据飞机ID设置颜色，默认黑色

          // if (id == 'CCA1642') {
          //   console.log(coords);
          //   const acolor = '#000000'; // 使用指定颜色创建标记
          //   const amarker = new Marker({acolor}) // 使用指定颜色创建标记
          //         .setLngLat([coords[0], coords[1]]) // 设置标记位置
          //         .setPopup(new Popup().setHTML(`<h1>${id}</h1>`))
          //         .addTo(map.current);
          // }
  
          // 新增飞机
          if (!existingPlaneIds.has(id)) {
              const marker = new Marker({ color }) // 使用指定颜色创建标记
                  .setLngLat([coords[0], coords[1]]) // 设置标记位置
                  .setPopup(new Popup().setHTML(`<h1>${id}</h1>`))
                  .addTo(map.current);
  
              markers.current[id] = { marker, trajectory: [] }; // 存储新标记和轨迹数据
          } else {
              // 更新已有飞机标记的位置
              const { marker, trajectory } = markers.current[id];
              marker.setLngLat([coords[0], coords[1]]); // 更新位置
              // marker.getElement().style.transition = "transform 0.5s";
  
              // 添加到轨迹中
              trajectory.push([coords[0], coords[1]]);
              drawTrajectory(id, trajectory, color); // 绘制轨迹
  
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
                    const { marker, trajectory } = markers.current[id];
                    marker.remove();
                    removeTrajectory(id); // 移除轨迹
                    delete markers.current[id]; // 从字典中删除标记记录
                    deleteColor(id); // 删除颜色
                    console.log(`移除飞机: ${id}`);
                }
            }
        });
    };
  
    // 绘制飞机的轨迹
    const drawTrajectory = (id, trajectory, color) => {
        if (!map.current.getSource(id)) {
            map.current.addSource(id, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: trajectory
                    },
                },
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
                    "line-width": 3
                }
            });
        } else {
            // 更新轨迹数据
            const source = map.current.getSource(id);
            if (source) {
                source.setData({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: trajectory
                    },
                });
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