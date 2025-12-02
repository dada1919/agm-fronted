import React, { useEffect, useRef, useState, useContext } from 'react';
import { useI18n } from '@/i18n/LanguageProvider';
import maplibregl, { Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { observer } from 'mobx-react-lite';
import websocketStore from '@/stores/WebSocketStore';
import { AIRCRAFT_COLORS, TAXIWAY_COLORS } from '@/constants/colors';
import { autorun } from 'mobx';
import { BUTTON_COLORS } from '@/constants/colors';

// import trajectoryWorkerManager from '@/utils/workerManager'; // 不再使用WebWorker
// import { WebSocketContext } from '@/websocket/WebsocketProvider';
// ... 其他import

// 性能优化：减少console.log输出，只保留关键错误日志
const debugMode = process.env.NODE_ENV === 'development' && false; // 可以通过环境变量控制

const logDebug = (message, ...args) => {
  if (debugMode) {
    console.log(message, ...args);
  }
};

const logInfo = (message, ...args) => {
  if (debugMode) {
    console.log(message, ...args);
  }
};

const TaxiwayMap = observer(() => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({}); // 存储飞机标记（以便于更新和删除）
  const plannedStartMarkers = useRef({}); // 存储规划路径起点的飞机图标
  const areaTimers = useRef({});
  const geoJsonUrl = '/taxiwayline2.geojson'; // 文件需放在public目录下
  const { t } = useI18n();

  // 地图视图飞机图标统一尺寸常量（可根据需求调整）
  const MAP_AIRPLANE_ICON_SIZE = 40; // 实时飞机图标（原32）

  // ---------------- 运行道坐标转换工具（UTM Zone 50N → WGS84）----------------
  // 运行道数据为 UTM 投影（Zone 50N），为在地图上叠加，需要转换为经纬度
  const utmToLatLon = (easting, northing, zoneNumber, northernHemisphere = true) => {
    const a = 6378137.0; // WGS84 半径
    const f = 1 / 298.257223563;
    const b = a * (1 - f);
    const e = Math.sqrt(1 - (b * b) / (a * a));
    const e1sq = e * e / (1 - e * e);
    const k0 = 0.9996;

    let x = easting - 500000.0;
    let y = northing;
    if (!northernHemisphere) {
      y -= 10000000.0;
    }

    const m = y / k0;
    const mu = m / (a * (1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

    const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
    const j1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const j2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
    const j3 = (151 * Math.pow(e1, 3) / 96);
    const j4 = (1097 * Math.pow(e1, 4) / 512);

    const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);

    const sinfp = Math.sin(fp);
    const cosfp = Math.cos(fp);
    const tanfp = Math.tan(fp);

    const c1 = e1sq * cosfp * cosfp;
    const t1 = tanfp * tanfp;
    const r1 = a * (1 - e * e) / Math.pow(1 - e * e * sinfp * sinfp, 1.5);
    const n1 = a / Math.sqrt(1 - e * e * sinfp * sinfp);
    const d = x / (n1 * k0);

    // 经度中心子午线（Zone * 6 - 180 + 3）
    const lon0 = ((zoneNumber - 1) * 6 - 180 + 3) * Math.PI / 180.0;

    const q1 = n1 * tanfp / r1;
    const q2 = (d * d / 2);
    const q3 = (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * e1sq) * Math.pow(d, 4) / 24;
    const q4 = (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * e1sq - 3 * c1 * c1) * Math.pow(d, 6) / 720;

    const lat = fp - q1 * (q2 - q3 + q4);

    const q5 = d;
    const q6 = (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6;
    const q7 = (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * e1sq + 24 * t1 * t1) * Math.pow(d, 5) / 120;
    const lon = lon0 + (q5 - q6 + q7) / cosfp;

    return { lng: lon * 180 / Math.PI, lat: lat * 180 / Math.PI };
  };

  const convertRunwayToWGS84 = (geojson, zoneNumber = 50, northernHemisphere = true) => {
    if (!geojson || !geojson.features) return geojson;
    const converted = {
      type: 'FeatureCollection',
      name: geojson.name || 'runway_wgs84',
      features: geojson.features.map(f => {
        const g = f.geometry || {};
        if (g.type === 'MultiPolygon') {
          const newCoords = g.coordinates.map(poly =>
            poly.map(ring =>
              ring.map(([x, y]) => {
                const { lng, lat } = utmToLatLon(x, y, zoneNumber, northernHemisphere);
                return [lng, lat];
              })
            )
          );
          return { ...f, geometry: { type: 'MultiPolygon', coordinates: newCoords } };
        }
        // 其他类型不转换，透传
        return f;
      })
    };
    return converted;
  };
  const MAP_PLANNED_START_ICON_SIZE = 32; // 规划起点飞机图标（原24）

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

    // 确保容器元素已经挂载到DOM
    if (!mapContainer.current) {
      console.error('地图容器元素未找到');
      return;
    }

    // 加载GeoJSON数据
    fetch(geoJsonUrl)
      .then(response => response.json())
      .then(data => {
        logInfo('GeoJSON数据加载完成:', data);
        logInfo('地图容器元素:', mapContainer.current);

        // 再次检查容器元素是否存在
        if (!mapContainer.current) {
          console.error('地图容器元素在数据加载后丢失');
          return;
        }

        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [116.593238, 40.051893],  // 初始中心点
          zoom: 23, // 提高初始缩放级别，让地图更大
          maxZoom: 24, // 允许更大的缩放范围
          bearing: 90  // 向右旋转90度
        });

        map.current.on('load', () => {
          logInfo('地图加载完成1');

          // 只修改背景和水体等基础图层，不影响其他要素
          map.current.setPaintProperty('background', 'background-color', '#f8f9fa');
          map.current.setPaintProperty('water', 'fill-color', 'hsl(210, 50%, 95%)');

          // 建筑图层颜色调整
          if (map.current.getLayer('building')) {
            map.current.setPaintProperty('building', 'fill-color', 'hsl(0, 0%, 90%)'); // 浅灰色
            map.current.setPaintProperty('building', 'fill-opacity', 0.2); // 降低不透明度
          }

          if (map.current.getLayer('building-top')) {
            map.current.setPaintProperty('building-top', 'fill-color', 'hsl(0, 0%, 88%)'); // 稍深一点的灰色
            map.current.setPaintProperty('building-top', 'fill-opacity', 0.2);
          }

          // 可选：调整其他相关图层，使整体更协调
          if (map.current.getLayer('landcover')) {
            map.current.setPaintProperty('landcover', 'fill-color', 'hsl(100, 20%, 95%)');
          }

          if (map.current.getLayer('landuse_residential')) {
            map.current.setPaintProperty('landuse_residential', 'fill-color', 'hsl(0, 0%, 92%)');
            map.current.setPaintProperty('landuse_residential', 'fill-opacity', 0.4);
          }

          // 底图：OpenStreetMap 栅格瓦片
          // try {
          //   if (!map.current.getSource('osm-raster')) {
          //     map.current.addSource('osm-raster', {
          //       type: 'raster',
          //       tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          //       tileSize: 256,
          //       attribution: '© OpenStreetMap contributors'
          //     });
          //   }
          //   if (!map.current.getLayer('osm-basemap')) {
          //     map.current.addLayer({
          //       id: 'osm-basemap',
          //       type: 'raster',
          //       source: 'osm-raster',
          //       minzoom: 0,
          //       maxzoom: 22,
          //       paint: {
          //         'raster-opacity': 0.2
          //       }
          //     });
          //   }
          // } catch (e) {
          //   console.error('添加底图失败:', e);
          // }

          // mapContainer.current.style.filter = 'brightness(0.7) sepia(0.2)'; 

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
                TAXIWAY_COLORS.UNNAMED,
                TAXIWAY_COLORS.NAMED
              ],
              'line-width': [
                'interpolate', // 使用插值函数
                ['linear'], // 线性插值
                ['zoom'], // 使用缩放级别
                0,   // 缩放级别 0
                0.3, // 更细的初始线宽
                12,  // 缩放级别 12
                1.5, // 中级缩放线宽
                18,  // 缩放级别 18 及以上
                4    // 高缩放级别线宽（减少）
              ],
              'line-opacity': 1
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            }
          });

          // 叠加跑道（从 UTM Zone 50N 转换至 WGS84）并放置在滑行道线之下
          try {
            fetch('/runway.geojson')
              .then(r => r.json())
              .then(runwayData => {
                const runwayWGS84 = convertRunwayToWGS84(runwayData, 50, true);

                if (!map.current.getSource('runways')) {
                  map.current.addSource('runways', {
                    type: 'geojson',
                    data: runwayWGS84
                  });
                }

                // 填充层（柔和灰蓝）
                if (!map.current.getLayer('runway-fill')) {
                  map.current.addLayer({
                    id: 'runway-fill',
                    type: 'fill',
                    source: 'runways',
                    paint: {
                      'fill-color': '#9aa7b0',
                      'fill-opacity': 0.55
                    }
                  }, 'taxiway-lines'); // 插入在滑行道线之前（下方）
                }

                // 轮廓线（稍深）
                if (!map.current.getLayer('runway-outline')) {
                  map.current.addLayer({
                    id: 'runway-outline',
                    type: 'line',
                    source: 'runways',
                    paint: {
                      'line-color': '#6b7780',
                      'line-width': 1.2,
                      'line-opacity': 0.6
                    }
                  }, 'taxiway-lines');
                }
              })
              .catch(err => console.error('加载/转换跑道数据失败:', err));
          } catch (e) {
            console.error('叠加跑道失败:', e);
          }

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
                    <h3 style="margin: 0 0 10px 0; color: #333;">${t('road.info')}</h3>
                    <p style="margin: 5px 0;"><strong>${t('road.id')}:</strong> ${taxiwayId}</p>
                    <p style="margin: 5px 0;"><strong>${t('road.name')}:</strong> ${taxiwayName}</p>
                    <p style="margin: 5px 0;"><strong>${t('coords')}:</strong> ${e.lngLat.lng.toFixed(6)}, ${e.lngLat.lat.toFixed(6)}</p>
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

          // WebWorker已移除，不再需要初始化
          // trajectoryWorkerManager.init().then(() => {
          //   console.log('WebWorker初始化完成');
          // }).catch(error => {
          //   console.error('WebWorker初始化失败:', error);
          //   console.error('错误详情:', error.message, error.stack);
          // });

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

    const colors = ['rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)', 'rgb(247,129,191)']

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

    // 获取或分配飞机的持久化偏移量（实际轨迹复用规划路径的偏移量）
    const updatePlane = async () => {
      // console.log('更新飞机位置');
      if (!map.current) return; // 确保地图已加载

      // 记录当前存在的飞机ID以及它们的计数
      const existingPlaneIds = new Set(Object.keys(markers.current));
      const updatedPlaneIds = new Set();

      // 获取当前的轨迹图层
      let trajectoryLayerId = 'plane-trajectories';


      // 处理现有和新飞机标记
      websocketStore.planePosition.forEach(async plane => {
        const { id, coords, cur_path, trajectory } = plane;
        // 使用WebSocketStore统一颜色映射，active状态使用不透明基础色
        const color = websocketStore.getAircraftColor(id, true);

        // 计算飞机朝向角度 - 使用当前坐标和上一个位置
        let rotation = 0;

        // 新增飞机
        if (!existingPlaneIds.has(id)) {
          const marker = new Marker({ element: createAirplaneMarker(color, MAP_AIRPLANE_ICON_SIZE, rotation) }) // 使用统一颜色和角度创建标记
            .setLngLat(applyDisplayOffsetToLngLat([coords[0], coords[1]], null, trajectory, websocketStore.plannedFlights?.[id]?.display_offset || 0, null)) // 设置标记位置（应用与轨迹一致的偏移）
            .setPopup(new Popup().setHTML(`<h1>${id}</h1>`))
            .addTo(map.current);

          // 存储新标记和当前位置，以及轨迹缓存
          markers.current[id] = {
            marker,
            lastPosition: [...coords], // 保存当前位置作为上一个位置
            lastTrajectory: null, // 缓存上次的轨迹数据
            lastTrajectoryHash: null, // 缓存轨迹数据的哈希值
            lastPerp: computePerpendicularUnitPixel(null, [coords[0], coords[1]], trajectory) || null, // 缓存最近一次法向量（屏幕空间）
            lastDisplayOffset: websocketStore.plannedFlights?.[id]?.display_offset ?? 0 // 缓存最近一次非零显示偏移
          };

          // 新飞机需要绘制轨迹
          try {
            // 从plannedFlights获取display_offset
            const plannedFlight = websocketStore.plannedFlights?.[id];
            const offset = plannedFlight?.display_offset || 0;

            drawTrajectory(id, trajectory, color, offset);

            // 缓存轨迹数据
            markers.current[id].lastTrajectory = JSON.stringify(trajectory);
            markers.current[id].lastTrajectoryHash = trajectory ? trajectory.length : 0;
          } catch (error) {
            console.error(`处理轨迹失败 ${id}:`, error);
          }
        } else {
          // 更新已有飞机标记的位置和方向
          const { marker, lastPosition } = markers.current[id];

          // 如果有上一个位置，计算朝向
          if (lastPosition && Array.isArray(lastPosition) && lastPosition.length >= 2) {
            // 计算方向角度
            const dx = coords[0] - lastPosition[0];
            const dy = coords[1] - lastPosition[1];

            // 确保移动了足够的距离才更新角度
            if (Math.abs(dx) > 0.0000001 || Math.abs(dy) > 0.0000001) {
              // 考虑纬度缩放差异，修正经度方向的距离
              const avgLat = (coords[1] + lastPosition[1]) / 2;
              const latRad = avgLat * Math.PI / 180;
              const dxAdj = dx * Math.cos(latRad);

              // 计算地理方向角度（度）
              const geoAngle = Math.atan2(dy, dxAdj) * (180 / Math.PI);

              // 考虑地图当前旋转（bearing），将地理角度转换为屏幕上的可视角度
              const bearing = map.current ? map.current.getBearing() : 0; // 顺时针为正

              // 根据SVG默认朝向（向上）做偏移；并校正地图旋转
              rotation = 90 - geoAngle - bearing;

              // console.log(`飞机ID: ${id}, geoAngle: ${geoAngle}°, bearing: ${bearing}°, 应用角度: ${rotation}° (dx:${dx}, dy:${dy}, dxAdj:${dxAdj})`);

              // 获取飞机元素并应用旋转
              const el = marker.getElement();
              const rotateEl = el.querySelector('.airplane-rotate');
              if (rotateEl) {
                rotateEl.style.transform = `rotate(${rotation}deg)`;
                rotateEl.style.transformOrigin = 'center center';
              }
            }
          }

          // 更新位置（应用与轨迹一致的偏移，缺失时回退到上一次稳定值）
          const plannedFlight = websocketStore.plannedFlights?.[id];
          const displayOffset = (plannedFlight?.display_offset != null)
            ? plannedFlight.display_offset
            : (markers.current[id].lastDisplayOffset ?? 0);

          // 计算本次法向量；若无法计算（静止或数据缺失），沿用上一次法向量以避免抖动
          const perpNow = computePerpendicularUnitPixel(lastPosition, [coords[0], coords[1]], trajectory) || markers.current[id].lastPerp;
          const newLngLat = applyDisplayOffsetToLngLat([coords[0], coords[1]], lastPosition, trajectory, displayOffset, perpNow);
          marker.setLngLat(newLngLat);

          // 更新缓存以稳定后续方向与偏移
          if (perpNow) {
            markers.current[id].lastPerp = perpNow;
          }
          if (plannedFlight?.display_offset != null) {
            markers.current[id].lastDisplayOffset = plannedFlight.display_offset;
          }

          // 检查轨迹是否发生变化，只有变化时才重新绘制
          const currentTrajectoryStr = JSON.stringify(trajectory);
          const currentTrajectoryHash = trajectory ? trajectory.length : 0;

          if (markers.current[id].lastTrajectory !== currentTrajectoryStr ||
            markers.current[id].lastTrajectoryHash !== currentTrajectoryHash) {

            // 轨迹发生变化，重新绘制
            try {
              // 从plannedFlights获取display_offset
              const plannedFlight = websocketStore.plannedFlights?.[id];
              const offset = plannedFlight?.display_offset || 0;

              drawTrajectory(id, trajectory, color, offset);

              // 更新缓存
              markers.current[id].lastTrajectory = currentTrajectoryStr;
              markers.current[id].lastTrajectoryHash = currentTrajectoryHash;

              // console.log(`飞机 ${id} 轨迹发生变化，重新绘制`);
            } catch (error) {
              console.error(`处理轨迹失败 ${id}:`, error);
            }
          }

          // 更新上一个位置
          markers.current[id].lastPosition = [...coords];

          // 重置计数
          markers.current[id].count = 0;
        }

        // 记录更新的飞机ID
        updatedPlaneIds.add(id);
      });
      // });

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
            // console.log(`移除飞机: ${id}`);
          }
        }
      });
    };


    // 飞机 SVG 生成器（支持颜色、旋转角度）
    function createAirplaneMarker(color = '#FF3B30', size = 32, rotation = -90) {
      const el = document.createElement('div');
      el.className = 'airplane-marker';
      // 外层容器仅负责尺寸，不参与旋转，避免与Maplibre内部样式冲突
      el.style.cssText = `display: block; width: ${size}px; height: ${size}px;`;

      // 使用之前的飞机图标，并在内层包装元素上应用旋转
      el.innerHTML = `
        <div class="airplane-rotate" style="
          width: ${size}px;
          height: ${size}px;
          transform: rotate(${rotation}deg);
          transform-origin: center center;
          will-change: transform;
        ">
          <svg viewBox="0 0 1024 1024" width="${size}" height="${size}" style="color: ${color}">
            <path fill="currentColor" d="M512 174.933333c23.466667 0 42.666667 8.533333 59.733333 25.6s25.6 36.266667 25.6 59.733334v192l206.933334 185.6c6.4 4.266667 10.666667 12.8 14.933333 21.333333s6.4 17.066667 6.4 25.6v23.466667c0 8.533333-2.133333 12.8-6.4 14.933333s-10.666667 2.133333-17.066667-2.133333l-204.8-140.8v149.333333c38.4 36.266667 57.6 57.6 57.6 64v36.266667c0 8.533333-2.133333 12.8-6.4 17.066666-4.266667 2.133333-10.666667 2.133333-19.2 0l-117.333333-72.533333-117.333333 72.533333c-6.4 4.266667-12.8 4.266667-19.2 0s-6.4-8.533333-6.4-17.066666v-36.266667c0-8.533333 19.2-29.866667 57.6-64v-149.333333l-204.8 140.8c-6.4 4.266667-12.8 6.4-17.066667 2.133333-4.266667-2.133333-6.4-8.533333-6.4-14.933333V684.8c0-8.533333 2.133333-17.066667 6.4-25.6 4.266667-8.533333 8.533333-17.066667 14.933333-21.333333l206.933334-185.6v-192c0-23.466667 8.533333-42.666667 25.6-59.733334s36.266667-25.6 59.733333-25.6z"/>
          </svg>
        </div>
      `;

      return el;
    }

    // 根据当前缩放级别复刻线图层的偏移倍数，返回像素偏移 = display_offset * factor
    function getLineOffsetPixel(displayOffset, zoom) {
      const z = Number(zoom) || 0;
      // 与 drawTrajectory 的 'interpolate' 缩放规则一致：
      // 10 -> *3, 15 -> *6, 20 -> *9 （线性插值，并做边界夹取）
      let factor;
      if (z <= 10) {
        factor = 3;
      } else if (z >= 20) {
        factor = 9;
      } else if (z <= 15) {
        const t = (z - 10) / (15 - 10);
        factor = 3 + t * (6 - 3);
      } else {
        const t = (z - 15) / (20 - 15);
        factor = 6 + t * (9 - 6);
      }
      return (Number(displayOffset) || 0) * factor;
    }

    // 计算在屏幕像素空间的法向量（相对于轨迹/运动方向的右侧），用于将图标偏移到与线偏移一致的位置
    function computePerpendicularUnitPixel(lastLngLat, currentLngLat, trajectory) {
      if (!map.current) return null;

      const isValidPair = (pair) => {
        return Array.isArray(pair) && pair.length >= 2 &&
          Number.isFinite(pair[0]) && Number.isFinite(pair[1]) &&
          Math.abs(pair[0]) <= 180 && Math.abs(pair[1]) <= 90;
      };

      // 优先使用最近的运动方向（上一个位置 -> 当前位置）
      if (isValidPair(lastLngLat) && isValidPair(currentLngLat)) {
        const p0 = map.current.project({ lng: lastLngLat[0], lat: lastLngLat[1] });
        const p1 = map.current.project({ lng: currentLngLat[0], lat: currentLngLat[1] });
        const vx = p1.x - p0.x;
        const vy = p1.y - p0.y;
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > 0.0001 && Number.isFinite(len)) {
          const ux = vx / len;
          const uy = vy / len;
          // 屏幕空间右侧法向量：(-uy, ux)
          return { x: -uy, y: ux };
        }
      }

      // 若无运动（或新建时），尝试从轨迹末段估计方向
      if (trajectory && Array.isArray(trajectory) && trajectory.length > 0) {
        const lastSeg = trajectory[trajectory.length - 1];
        // MultiLineString 的一个段可能是坐标数组
        if (Array.isArray(lastSeg) && lastSeg.length >= 2) {
          const a = lastSeg[lastSeg.length - 2];
          const b = lastSeg[lastSeg.length - 1];
          if (isValidPair(a) && isValidPair(b)) {
            const p0 = map.current.project({ lng: a[0], lat: a[1] });
            const p1 = map.current.project({ lng: b[0], lat: b[1] });
            const vx = p1.x - p0.x;
            const vy = p1.y - p0.y;
            const len = Math.sqrt(vx * vx + vy * vy);
            if (len > 0.0001 && Number.isFinite(len)) {
              const ux = vx / len;
              const uy = vy / len;
              return { x: -uy, y: ux };
            }
          }
        }
      }
      return null;
    }

    // 将当前经纬度按与线一致的偏移规则，转换为新的经纬度（屏幕像素偏移转回地理坐标）
    function applyDisplayOffsetToLngLat(lngLat, lastLngLat, trajectory, displayOffset, lastPerp) {
      const offsetPx = getLineOffsetPixel(displayOffset, map.current ? map.current.getZoom() : 0);
      const safeReturn = () => {
        if (Array.isArray(lastLngLat) && lastLngLat.length >= 2 && Number.isFinite(lastLngLat[0]) && Number.isFinite(lastLngLat[1])) {
          return { lng: lastLngLat[0], lat: lastLngLat[1] };
        }
        return { lng: Number(lngLat?.[0]) || 0, lat: Number(lngLat?.[1]) || 0 };
      };
      if (!offsetPx) return { lng: lngLat[0], lat: lngLat[1] };

      const perp = computePerpendicularUnitPixel(lastLngLat, lngLat, trajectory) || lastPerp;
      if (!perp || !Number.isFinite(perp.x) || !Number.isFinite(perp.y)) return { lng: lngLat[0], lat: lngLat[1] };

      if (!lngLat || !Array.isArray(lngLat) || lngLat.length < 2 || !Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) {
        return safeReturn();
      }

      const base = map.current.project({ lng: lngLat[0], lat: lngLat[1] });
      const target = { x: base.x + perp.x * offsetPx, y: base.y + perp.y * offsetPx };
      const ll = map.current.unproject(target);
      return { lng: ll.lng, lat: ll.lat };
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

    // 生成由深到浅（加白）的不透明渐变色数组（末端不过度变浅）
    function generateWhiteMixVariants(rgbColor, steps = 10, maxMix = 0.6) {
      const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return Array.from({ length: steps }, () => rgbColor);
      const r0 = parseInt(match[1], 10);
      const g0 = parseInt(match[2], 10);
      const b0 = parseInt(match[3], 10);

      // 从原色逐步向白色(255,255,255)混合，得到由深到浅的不透明颜色
      return Array.from({ length: steps }, (_, i) => {
        // 归一化混合比例，并限制最大混合强度，避免末端过白
        const tNorm = steps <= 1 ? 1 : i / (steps - 1); // 0 -> 1
        const t = Math.min(1, tNorm * maxMix);
        const r = Math.round(r0 + (255 - r0) * t);
        const g = Math.round(g0 + (255 - g0) * t);
        const b = Math.round(b0 + (255 - b0) * t);
        return `rgb(${r}, ${g}, ${b})`;
      });
    }

    const blueGradientScale = [
      '#E3F2FD',  // 最浅蓝色
      '#BBDEFB',  // 浅蓝色
      '#90CAF9',  // 中浅蓝色
      '#64B5F6',  // 中蓝色
      '#42A5F5',  // 中深蓝色
      '#2196F3',  // 标准蓝色
      '#1E88E5',  // 深蓝色
      '#1976D2',  // 更深蓝色
      '#1565C0',  // 很深蓝色
      '#0D47A1'   // 最深蓝色
    ];

    blueGradientScale.reverse(); // 反转蓝色渐变数组，使最新轨迹为最深蓝色

    const drawTest = (id, trajectorys, color, h) => {
      const geodata = {
        "type": "FeatureCollection", "features": [
          { "type": "Feature", "properties": { "color": "#FF1919" }, "geometry": { "type": "MultiLineString", "coordinates": [[[116.60957629798676, 40.07072042269285], [116.60961207779839, 40.07049230443101]], [[116.60961207779839, 40.07049230443101], [116.60963321741602, 40.07035752551841]], [[116.60963321741602, 40.07035752551841], [116.60965000451456, 40.07025049637292]], [[116.60965000451456, 40.07025049637292], [116.60965485000008, 40.070219605000034]], [[116.60965485000008, 40.070219605000034], [116.6096962291351, 40.06995578124849]], [[116.6096962291351, 40.06995578124849], [116.60972500800007, 40.06977229400008]], [[116.60972500800007, 40.06977229400008], [116.60971822385996, 40.06968795905062]], [[116.60971822385996, 40.06968795905062], [116.60971402993081, 40.06966143549661]], [[116.60971402993081, 40.06966143549661], [116.60969898350422, 40.06960770804471]], [[116.60969898350422, 40.06960770804471], [116.60967780773305, 40.069556088079956]], [[116.60967780773305, 40.069556088079956], [116.60965078838404, 40.06950727221347]], [[116.60965078838404, 40.06950727221347], [116.60961829008313, 40.069461919214866]], [[116.60961829008313, 40.069461919214866], [116.60958075139463, 40.06942064112253]], [[116.60958075139463, 40.06942064112253], [116.6095645741975, 40.0694065504]], [[116.6095645741975, 40.0694065504], [116.60950016253007, 40.06936079056222]], [[116.60950016253007, 40.06936079056222], [116.60937563129383, 40.069304415965526]]] } },
          { "type": "Feature", "properties": { "color": "#FF3232", "index": 3 }, "geometry": { "type": "MultiLineString", "coordinates": [[[116.60937563129383, 40.069304415965526], [116.60953867890284, 40.06938399498392]], [[116.60953867890284, 40.06938399498392], [116.60944325710257, 40.069326507543295]], [[116.60944325710257, 40.069326507543295], [116.60934724367137, 40.069295142473926]], [[116.60934724367137, 40.069295142473926], [116.60781169709529, 40.06915322543125]]] } }]
      }

      const marker1 = new Marker({ element: createAirplaneMarker(color, MAP_AIRPLANE_ICON_SIZE) }) // 使用指定颜色创建标记
        .setLngLat([116.60937563129383, 40.069304415965526]) // 设置标记位置
        .setPopup(new Popup().setHTML(`<h1>1</h1>`))
        .addTo(map.current);

      const marker2 = new Marker({ element: createAirplaneMarker(color, MAP_AIRPLANE_ICON_SIZE) }) // 使用指定颜色创建标记
        .setLngLat([116.60953867890284, 40.06938399498392]) // 设置标记位置
        .setPopup(new Popup().setHTML(`<h1>2</h1>`))
        .addTo(map.current);


      const marker3 = new Marker({ element: createAirplaneMarker(color, MAP_AIRPLANE_ICON_SIZE) }) // 使用指定颜色创建标记
        .setLngLat([116.60944325710257, 40.069326507543295]) // 设置标记位置
        .setPopup(new Popup().setHTML(`<h1>3</h1>`))
        .addTo(map.current);

      const marker4 = new Marker({ element: createAirplaneMarker(color, MAP_AIRPLANE_ICON_SIZE) }) // 使用指定颜色创建标记
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
            "line-width": 3,
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

    // 绘制飞机的轨迹 - 优化版本
    const drawTrajectory = (id, trajectorys, color, offset = 0) => {
      // 检查地图是否完全初始化
      if (!map.current ||
        !map.current.getSource ||
        !map.current.addSource ||
        !map.current.getLayer ||
        !map.current.addLayer ||
        !map.current.removeLayer ||
        !map.current.removeSource) {
        console.warn('地图未完全初始化，跳过轨迹绘制');
        return;
      }

      // 检查轨迹数据是否为空
      if (!trajectorys || trajectorys.length === 0) {
        return;
      }

      let geodata = { type: 'FeatureCollection', features: [] }; // 初始化地理数据对象
      let index = 0;
      // const multiColor = generateAlphaVariants(color, 10, 5); // 生成颜色透明度阶梯

      // console.log('绘制轨迹', id, trajectorys);

      // 使用绿色渐变（与时间线 ACTIVE 基色一致）
      // 使用由深到浅（加白）的绿色渐变，与时间线的ACTIVE基色(#4daf4a)一致
      const greenGradientScale = generateWhiteMixVariants('rgb(77, 175, 74)', 10);

      trajectorys.forEach(trajectory => {
        // console.log('绘制轨迹',  trajectory);
        if (trajectory.length > 0) {
          geodata.features.push({
            type: 'Feature',
            properties: {
              // 统一使用时间线视图中滑行飞机的绿色渐变
              color: greenGradientScale[Math.min(index++, greenGradientScale.length - 1)],
              // color: blueGradientScale[(index++) % 10] ,
              height: offset // 将偏移量存储在height属性中
            },
            geometry: {
              type: 'MultiLineString',
              coordinates: trajectory
            }
          });
        }
      })

      // 如果没有有效的轨迹数据，移除现有的图层和数据源
      if (geodata.features.length === 0) {
        if (map.current.getLayer(id)) {
          map.current.removeLayer(id);
        }
        if (map.current.getSource(id)) {
          map.current.removeSource(id);
        }
        return;
      }

      // console.log(JSON.stringify(geodata));

      // console.log( JSON.stringify(geodata, null, 2) );
      // console.log(geodata);

      // 优化：检查数据源是否存在，避免重复创建
      const sourceExists = map.current.getSource(id);

      if (!sourceExists) {
        // 批量添加数据源和图层
        try {
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
              "line-width": 5,  // 轨迹加粗一点，偏移效果更清晰
              'line-offset': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, ['*', ['get', 'height'], 3],  // 增加偏移倍数
                15, ['*', ['get', 'height'], 6],  // 增加偏移倍数
                20, ['*', ['get', 'height'], 9]   // 增加偏移倍数
              ],
              'line-opacity': 1.0,
              'line-blur': 0.5
            }
          });
        } catch (error) {
          console.error(`添加轨迹图层失败 ${id}:`, error);
        }
      } else {
        // 更新轨迹数据 - 使用批量更新，避免频繁的DOM操作
        try {
          const source = map.current.getSource(id);
          if (source && source.setData) {
            // 使用requestAnimationFrame来批量更新，减少重绘次数
            requestAnimationFrame(() => {
              source.setData(geodata);
            });
          }
        } catch (error) {
          console.error(`更新轨迹数据失败 ${id}:`, error);
        }
      }
    };

    // 绘制模拟结果的轨迹（使用浅蓝色系列）
    const drawSimulatedTrajectory = (id, trajectorys, baseColor = '#377eb8', h = 0) => {
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
      // 防御：地图未初始化或样式未就绪时直接返回，避免空引用
      const m = map.current;
      if (!m || !id) return;
      const styleReady = typeof m.getStyle === 'function' ? !!m.getStyle() : (typeof m.isStyleLoaded === 'function' ? m.isStyleLoaded() : true);
      if (!styleReady) return;
      try {
        if (typeof m.getLayer === 'function' && m.getLayer(id)) {
          m.removeLayer(id);
        }
      } catch (err) {
        console.warn('removeTrajectory 移除图层异常:', id, err);
      }
      try {
        if (typeof m.getSource === 'function' && m.getSource(id)) {
          m.removeSource(id);
        }
      } catch (err) {
        console.warn('removeTrajectory 移除数据源异常:', id, err);
      }
    };

    // 观察 messages 数组的变化，添加节流处理
    // 性能优化：使用更高效的节流机制
    let updateTimeout = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 100; // 100ms间隔

    const throttledUpdatePlane = () => {
      const now = Date.now();
      if (now - lastUpdateTime >= UPDATE_INTERVAL) {
        lastUpdateTime = now;
        updatePlane();
      } else {
        // 如果距离上次更新时间不足，则延迟执行
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        updateTimeout = setTimeout(() => {
          lastUpdateTime = Date.now();
          updatePlane();
        }, UPDATE_INTERVAL - (now - lastUpdateTime));
      }
    };

    const disposer1 = autorun(() => {
      // 访问可观察状态以建立依赖，确保空数据也会触发
      const _ = websocketStore.planePosition;
      throttledUpdatePlane();
    });


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

    const disposer2 = autorun(() => {
      // console.log('冲突数据变化:', websocketStore.conflicts);
      if (websocketStore.conflicts != null) {
        const conflict = websocketStore.conflicts;
        // 连接线坐标（两点之间的短线段）
        const trajectory = [[
          [conflict.pos1, conflict.pos2]
        ]];

        // 分别获取两架飞机的显示偏移（plannedFlights 中的 display_offset）
        const o1 = websocketStore.plannedFlights?.[conflict.id1]?.display_offset || 0;
        const o2 = websocketStore.plannedFlights?.[conflict.id2]?.display_offset || 0;

        // 使用同一种紫色保持现有视觉，不改变色系
        const color = '#984ea3';

        // 分别绘制两条平行冲突线，偏移量对应各自飞机的 display_offset
        drawConflict(`conflict-${conflict.id1}-${conflict.id2}-a`, trajectory, color, o1);
        drawConflict(`conflict-${conflict.id1}-${conflict.id2}-b`, trajectory, color, o2);
      }
    });

    // 绘制冲突节点标记
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
              'circle-radius': 12,
              'circle-color': color,
              'circle-opacity': 0.7,
              'circle-stroke-width': 1,
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
      // 增强地图初始化检查
      if (!map.current ||
        !map.current.getStyle ||
        !map.current.getLayer ||
        !map.current.removeLayer ||
        !map.current.getSource ||
        !map.current.removeSource) {
        console.warn('地图未完全初始化，跳过规划路径清理');
        return;
      }

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

        // 清理规划路径的偏移数据
        const plannedPathIds = layersToRemove
          .filter(layerId => layerId.startsWith('planned-path-layer-'))
          .map(layerId => `planned-${layerId.replace('planned-path-layer-', '')}`);

        // 清理所有规划路径的持久化偏移量
        if (websocketStore.plannedFlights) {
          Object.keys(websocketStore.plannedFlights).forEach(flightId => {
            // 规划路径清理逻辑已移除
          });
        }

        // 同步移除所有规划路径起点的飞机图标
        try {
          if (plannedStartMarkers.current) {
            Object.entries(plannedStartMarkers.current).forEach(([fid, mk]) => {
              if (mk && mk.remove) mk.remove();
              delete plannedStartMarkers.current[fid];
            });
          }
        } catch (e) {
          console.error('清理规划路径起点标记时出错:', e);
        }
      } catch (error) {
        console.error('清理planned paths时出错:', error);
      }
    };

    // 绘制planned飞机的规划路径
    const drawPlannedPaths = () => {
      // 增强地图初始化检查
      if (!map.current ||
        !map.current.getStyle ||
        !map.current.getSource ||
        !map.current.addSource ||
        !map.current.getLayer ||
        !map.current.addLayer ||
        !geojsonData ||
        !websocketStore.plannedFlights) {
        console.warn('地图未完全初始化或数据不可用，跳过规划路径绘制');
        return;
      }

      // 先清理旧的路径
      clearPlannedPaths();

      const plannedFlights = websocketStore.plannedFlights;

      if (!plannedFlights || Object.keys(plannedFlights).length === 0) {
        return;
      }


      // 遍历每个planned航班
      for (const [flightId, flightData] of Object.entries(plannedFlights)) {
        if (!flightData.node_path || !Array.isArray(flightData.node_path) || flightData.node_path.length < 2) {
          continue;
        }

        // 如果type为active，则不绘制规划路径
        if (flightData.type === 'active') {
          console.log(`飞机 ${flightId} 类型为active，跳过规划路径绘制`);
          continue;
        }

        // 筛选飞机规划路径：如果飞机正在滑行中，就不绘制规划路径
        const isCurrentlyTaxiing = websocketStore.planePosition &&
          websocketStore.planePosition.some(plane =>
            plane.id === flightId &&
            (plane.state === 'taxiing' || plane.state === 'moving')
          );

        if (isCurrentlyTaxiing) {
          console.log(`飞机 ${flightId} 正在滑行中，跳过规划路径绘制`);
          continue;
        }

        console.log('绘制规划路径', flightId, flightData);

        // 使用原有的node_path方式绘制
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

        // 使用plannedFlights中的display_offset
        const offset = flightData.display_offset || 0;

        // 创建GeoJSON数据
        const pathGeoJSON = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {
              flightId: flightId,
              destination: flightData.destination,
              offset: offset  // 添加偏移信息到属性中
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
                'line-width': 3, // 规划路线加粗一点
                'line-dasharray': [2, 2], // 虚线样式
                'line-opacity': 0.8,
                'line-offset': ['get', 'offset'] // 使用属性中的偏移值
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
                    <h3 style="margin: 0 0 10px 0; color: #333;">${t('plan.path')}</h3>
                    <p style="margin: 5px 0;"><strong>${t('flight.id')}:</strong> ${flightId}</p>
                    <p style="margin: 5px 0;"><strong>${t('destination')}:</strong> ${destination}</p>
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

        // 在 node_path 的起点绘制飞机图标（颜色与 PlanningView 一致）
        try {
          if (pathCoordinates && pathCoordinates.length >= 2 && map.current) {
            const start = pathCoordinates[0];
            const next = pathCoordinates[1];

            // 计算与首段一致的法向量，用于与线偏移保持一致
            const perp0 = computePerpendicularUnitPixel(start, next, null);
            const startLL = applyDisplayOffsetToLngLat(start, null, null, offset, perp0);

            // 计算朝向角度，使图标朝向路径前进方向
            const dx = next[0] - start[0];
            const dy = next[1] - start[1];
            let rotation = -90; // 默认向上
            if (Math.abs(dx) > 0.0000001 || Math.abs(dy) > 0.0000001) {
              const avgLat = (next[1] + start[1]) / 2;
              const latRad = avgLat * Math.PI / 180;
              const dxAdj = dx * Math.cos(latRad);
              const geoAngle = Math.atan2(dy, dxAdj) * (180 / Math.PI);
              const bearing = map.current ? map.current.getBearing() : 0;
              rotation = 90 - geoAngle - bearing;
            }

            // 如果已有该航班的起点标记，先移除
            if (plannedStartMarkers.current[flightId]) {
              plannedStartMarkers.current[flightId].remove();
              delete plannedStartMarkers.current[flightId];
            }

            const startMarker = new Marker({ element: createAirplaneMarker(pathColor, MAP_PLANNED_START_ICON_SIZE, rotation) })
              .setLngLat({ lng: startLL.lng, lat: startLL.lat })
              .addTo(map.current);

            plannedStartMarkers.current[flightId] = startMarker;
          }
        } catch (err) {
          console.error(`为航班 ${flightId} 绘制起点飞机图标失败:`, err);
        }
      }
    };

    // 观察plannedFlights数据变化，添加节流处理
    let plannedPathsUpdateTimeout = null;
    let lastPlannedPathsUpdateTime = 0;
    const PLANNED_PATHS_UPDATE_INTERVAL = 200; // 200ms间隔

    const throttledDrawPlannedPaths = () => {
      const now = Date.now();
      if (now - lastPlannedPathsUpdateTime >= PLANNED_PATHS_UPDATE_INTERVAL) {
        lastPlannedPathsUpdateTime = now;
        drawPlannedPaths();
      } else {
        if (plannedPathsUpdateTimeout) {
          clearTimeout(plannedPathsUpdateTimeout);
        }
        plannedPathsUpdateTimeout = setTimeout(() => {
          lastPlannedPathsUpdateTime = Date.now();
          drawPlannedPaths();
        }, PLANNED_PATHS_UPDATE_INTERVAL - (now - lastPlannedPathsUpdateTime));
      }
    };

    const disposer4 = autorun(() => {
      try {
        if (websocketStore.plannedFlights && Object.keys(websocketStore.plannedFlights).length > 0) {
          logInfo('plannedFlights数据变化:', websocketStore.plannedFlights);
          throttledDrawPlannedPaths();
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
            drawSimulatedTrajectory(simLayerId, trajectory, '#377eb8', idx);
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

    // 绘制冲突连线（应用与轨迹一致的缩放偏移规则）
    const drawConflict = (id, trajectorys, color, h) => {
      let geodata = { type: 'FeatureCollection', features: [] }; // 初始化地理数据对象

      trajectorys.forEach(trajectory => {
        if (trajectory.length > 0) {
          geodata.features.push({
            type: 'Feature',
            properties: {
              height: h
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
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": color, // 使用指定颜色
            "line-width": 4,
            'line-offset': 0,
            'line-opacity': 0.6,
            'line-blur': 0.5
          }
        });
        // 新增后将冲突线层置顶
        if (map.current.moveLayer) {
          try { map.current.moveLayer(id); } catch (e) { /* ignore */ }
        }
      } else {
        // 更新轨迹数据
        const source = map.current.getSource(id);
        if (source) {
          source.setData(geodata);
        }
        // 更新后确保冲突线层置顶
        if (map.current.moveLayer) {
          try { map.current.moveLayer(id); } catch (e) { /* ignore */ }
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
            console.log('绘制当前冲突数据 (current):', currentConflicts);
            highlightTaxiwayByLayerWithArea(currentConflicts, 'current');
          } else {
            console.log('当前没有冲突数据');
            // 清除现有的当前冲突高亮显示
            if (window._currentAreaLayers) {
              console.log('准备清理 current 冲突图层，数量:', window._currentAreaLayers.length, 'IDs:', window._currentAreaLayers);
              window._currentAreaLayers.forEach(id => {
                if (map.current.getLayer(id)) map.current.removeLayer(id);
                if (map.current.getSource(id)) map.current.removeSource(id);
              });
              window._currentAreaLayers = [];
              console.log('已清理 current 冲突图层');
            }
          }
        });

        // 监听future_conflicts变化
        const disposer5 = autorun(() => {
          const futureConflicts = websocketStore.future_conflicts || [];
          console.log('future_conflicts监听触发，数据:', futureConflicts);

          if (Array.isArray(futureConflicts) && futureConflicts.length > 0) {
            console.log('绘制未来冲突数据 (future):', futureConflicts);
            highlightTaxiwayByLayerWithArea(futureConflicts, 'future');
          } else {
            console.log('当前没有未来冲突数据或数据为空');
            // 清除现有的未来冲突高亮显示
            if (window._futureAreaLayers) {
              console.log('准备清理 future 冲突图层，数量:', window._futureAreaLayers.length, 'IDs:', window._futureAreaLayers);
              window._futureAreaLayers.forEach(id => {
                if (map.current.getLayer(id)) map.current.removeLayer(id);
                if (map.current.getSource(id)) map.current.removeSource(id);
              });
              window._futureAreaLayers = [];
              console.log('已清理 future 冲突图层');
            }
          }
        });

        function highlightTaxiwayByLayerWithArea(overlapData, conflictType = 'current') {
          console.log('highlightTaxiwayByLayerWithArea调用，类型:', conflictType, '数据:', overlapData);
          if (!map.current || !geojsonData) {
            console.log('地图或geojsonData未准备好');
            return;
          }

          // 根据冲突类型选择不同的图层管理
          const layerArrayName = conflictType === 'future' ? '_futureAreaLayers' : '_currentAreaLayers';
          const registryName = conflictType === 'future' ? '_futureConflictRegistry' : '_currentConflictRegistry';
          console.log('使用图层数组名称:', layerArrayName);
          // 初始化全局跟踪结构
          if (!window[layerArrayName]) window[layerArrayName] = [];
          if (!window[registryName]) window[registryName] = {};

          // 收集本次更新的键集合，用于差异化更新
          const newKeys = new Set();

          // 规范化冲突数据结构，兼容不同字段命名与 Proxy
          const normalizeConflict = (item) => {
            const mf = item?.merged_functions || item?.functions || item?.piecewise_functions;
            const seq = item?.taxiway_sequence || item?.taxiway_ids || item?.taxiways || item?.path?.taxiway_sequence;
            const f1 = item?.flight1_id || item?.id1 || item?.flight1;
            const f2 = item?.flight2_id || item?.id2 || item?.flight2;
            const t = item?.conflict_time || item?.time || 0;
            const kid = item?.conflict_id || `${f1 || ''}-${f2 || ''}-${Array.isArray(seq) ? seq.join('_') : ''}`;
            return { merged_functions: mf, taxiway_sequence: seq, flight1_id: f1, flight2_id: f2, conflict_time: t, conflict_id: kid, is_unchanged: item?.is_unchanged };
          };

          overlapData.forEach((rawItem, conflictIdx) => {
            const conflictItem = normalizeConflict(rawItem);
            const { merged_functions, taxiway_sequence, flight1_id, flight2_id, conflict_time, conflict_id, is_unchanged } = conflictItem;
            const conflictKey = conflict_id;
            newKeys.add(conflictKey);


            if (!Array.isArray(merged_functions) || !Array.isArray(taxiway_sequence)) {
              // 仅输出关键标识，避免打印 Proxy 引发噪声
              console.warn(`Invalid conflict data, skip. key=${conflictKey}`);
              return;
            }



            // 采样所有分段函数的边界点（跨道路分段）
            // Step 1: Get all segments and orient them to form a continuous path
            const featuresRaw = taxiway_sequence.map(id => ({
              id: String(id),
              feat: geojsonData.features.find(f => String(parseInt(f.id)) === String(id)) || null
            }));
            const missingIds = featuresRaw.filter(r => !r.feat).map(r => r.id);
            if (missingIds.length > 0) {
              console.warn(`部分滑行道ID未找到，可能导致路径断裂或偏移:`, missingIds);
            }
            const features = featuresRaw.filter(r => !!r.feat).map(r => r.feat);

            if (!features.length) {
              console.warn(`No taxiway features found for key=${conflictKey}`);
              return;
            }

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
            // 使用像素空间法向量与偏移，以保证视觉关于滑行道对称
            const metersPerPixelAtLat = (lat, zoom) => {
              const rad = Math.PI / 180;
              const worldCircumference = 2 * Math.PI * 6378137;
              const scale = Math.pow(2, Number(zoom) || 0) * 512; // MapLibre默认瓦片尺寸512
              return (Math.cos(lat * rad) * worldCircumference) / scale;
            };
            let lastPerpPx = null;

            merged_functions.forEach(seg => {
              const { x1, x2, a, b, c } = seg;

              // Clamp the function's domain to the actual path length
              const globalStart = Math.max(0, x1);
              const globalEnd = Math.min(totalPathLength, x2);

              if (globalEnd <= globalStart) return;

              const scale = 0.5; // 宽度缩放系数与旧实现保持一致
              const sampleStep = 1; // Sample every 1 meter
              const nSamples = Math.max(2, Math.ceil((globalEnd - globalStart) / sampleStep));

              for (let i = 0; i <= nSamples; i++) {
                const dist = globalStart + (globalEnd - globalStart) * (i / nSamples);
                const yRaw = b !== 0 ? (-(a * dist + c) / b) * scale : 0;
                const y = Math.abs(yRaw); // 始终以中心线为对称轴，左右各偏移 y/2

                const pt = getPointAtDistance(continuousPath, pathDists, dist);
                const zoom = map.current.getZoom ? map.current.getZoom() : 0;
                const aheadDist = Math.min(dist + 0.5, totalPathLength);
                const behindDist = Math.max(dist - 0.5, 0);
                const ptAhead = getPointAtDistance(continuousPath, pathDists, aheadDist);
                const ptBehind = getPointAtDistance(continuousPath, pathDists, behindDist);

                const pBehind = map.current.project({ lng: ptBehind[0], lat: ptBehind[1] });
                const pAhead = map.current.project({ lng: ptAhead[0], lat: ptAhead[1] });
                const vx = pAhead.x - pBehind.x;
                const vy = pAhead.y - pBehind.y;
                const len = Math.sqrt(vx * vx + vy * vy);
                let perpPx;
                if (len > 0.0001 && Number.isFinite(len)) {
                  const ux = vx / len;
                  const uy = vy / len;
                  perpPx = { x: -uy, y: ux };
                  lastPerpPx = perpPx;
                } else {
                  perpPx = lastPerpPx || { x: 0, y: 0 };
                }

                const mpp = metersPerPixelAtLat(pt[1], zoom) || 1;
                const offsetPx = (y / 2) / mpp;

                const p0 = map.current.project({ lng: pt[0], lat: pt[1] });
                const leftPx = { x: p0.x + perpPx.x * offsetPx, y: p0.y + perpPx.y * offsetPx };
                const rightPx = { x: p0.x - perpPx.x * offsetPx, y: p0.y - perpPx.y * offsetPx };

                const leftLL = map.current.unproject(leftPx);
                const rightLL = map.current.unproject(rightPx);

                allLeftPoints.push([leftLL.lng, leftLL.lat]);
                allRightPoints.push([rightLL.lng, rightLL.lat]);
              }
            });

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

            const areaId = `${conflictType}-area-${conflictKey}`;

            // 根据冲突类型设置不同的样式
            let fillColor, fillOpacity;
            if (conflictType === 'future') {
              // 未来冲突：降低透明度以减弱视觉占用
              fillColor = 'rgba(30, 144, 255, 0.25)';
              fillOpacity = 0.8;
            } else {
              // 当前冲突：降低透明度以减弱视觉占用
              fillColor = 'rgba(255,165,0, 0.25)';
              fillOpacity = 0.8;
            }

            try {
              console.log('尝试添加图层:', areaId, '类型:', conflictType);
              // 如果标记为未修改且已存在，则无需重绘，直接跳过
              if (is_unchanged === true && window[registryName][conflictKey]) {
                console.log('跳过重绘（未修改）：key=', conflictKey, 'areaId=', window[registryName][conflictKey].areaId, 'type=', conflictType);
                // 已存在于注册表，保持现状
                return;
              }

              // 如果已有同键的旧图层，则先移除旧图层与数据源（仅移除当前类型命名空间内的图层）
              const existing = window[registryName][conflictKey];
              if (existing) {
                const expectedAreaPrefix = `${conflictType}-area-`;
                const expectedAxisPrefix = `${conflictType}-axis-`;

                const removeArea = existing.areaId && String(existing.areaId).startsWith(expectedAreaPrefix);
                const removeAxis = existing.axisId && String(existing.axisId).startsWith(expectedAxisPrefix);

                console.log('重绘前移除旧图层: key=', conflictKey, 'areaId=', existing.areaId, 'type=', conflictType, '匹配前缀:', expectedAreaPrefix);

                if (removeArea) {
                  if (map.current.getLayer(existing.areaId)) map.current.removeLayer(existing.areaId);
                  if (map.current.getSource(existing.areaId)) map.current.removeSource(existing.areaId);
                  const idx = window[layerArrayName].indexOf(existing.areaId);
                  if (idx > -1) window[layerArrayName].splice(idx, 1);
                } else {
                  console.warn('跳过移除非当前类型图层:', existing.areaId, '期望前缀:', expectedAreaPrefix);
                }

                if (removeAxis) {
                  if (map.current.getLayer(existing.axisId)) map.current.removeLayer(existing.axisId);
                  if (map.current.getSource(existing.axisId)) map.current.removeSource(existing.axisId);
                  const idx2 = window[layerArrayName].indexOf(existing.axisId);
                  if (idx2 > -1) window[layerArrayName].splice(idx2, 1);
                } else if (existing.axisId) {
                  console.warn('跳过移除非当前类型轴图层:', existing.axisId, '期望前缀:', expectedAxisPrefix);
                }
              }

              map.current.addSource(areaId, { type: 'geojson', data: polygon });
              map.current.addLayer({
                id: areaId,
                type: 'fill',
                source: areaId,
                paint: {
                  'fill-color': fillColor,
                  'fill-opacity': fillOpacity
                },
                interactive: true
              });
              console.log('成功添加图层:', areaId, '颜色:', fillColor);

              map.current.on('click', areaId, (e) => {
                if (e.features && e.features.length > 0) {
                  const props = e.features[0].properties;
                  new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`<pre>${JSON.stringify(props.data, null, 2)}</pre>`)
                    .addTo(map.current);
                }
              });
              window[layerArrayName].push(areaId);
              // 记录/更新注册表，存储当前冲突键的图层ID与数据快照（用于后续 diff）
              const snapshotHash = JSON.stringify({ merged_functions, taxiway_sequence, flight1_id, flight2_id });
              window[registryName][conflictKey] = { areaId, hash: snapshotHash };
            } catch (error) {
              console.error('Error creating merged area layer:', areaId, '类型:', conflictType, 'error:', error);
            }


          });
          console.log('当前冲突键集合:', newKeys);

          // 移除本次更新中不再出现的冲突键对应的图层（仅移除当前类型命名空间内的图层）
          const existingKeys = Object.keys(window[registryName]);
          existingKeys.forEach(key => {
            if (!newKeys.has(key)) {
              const info = window[registryName][key];
              if (info) {
                const expectedAreaPrefix = `${conflictType}-area-`;
                const expectedAxisPrefix = `${conflictType}-axis-`;
                const removeArea = info.areaId && String(info.areaId).startsWith(expectedAreaPrefix);
                const removeAxis = info.axisId && String(info.axisId).startsWith(expectedAxisPrefix);

                if (removeArea) {
                  console.log('差异清理：移除缺失的冲突', key, 'areaId=', info.areaId, 'type=', conflictType);
                  if (map.current.getLayer(info.areaId)) map.current.removeLayer(info.areaId);
                  if (map.current.getSource(info.areaId)) map.current.removeSource(info.areaId);
                  const idx = window[layerArrayName].indexOf(info.areaId);
                  if (idx > -1) window[layerArrayName].splice(idx, 1);
                } else if (info.areaId) {
                  console.warn('差异清理跳过：非当前类型图层', info.areaId, '期望前缀:', expectedAreaPrefix);
                }

                if (removeAxis) {
                  if (map.current.getLayer(info.axisId)) map.current.removeLayer(info.axisId);
                  if (map.current.getSource(info.axisId)) map.current.removeSource(info.axisId);
                  const idx2 = window[layerArrayName].indexOf(info.axisId);
                  if (idx2 > -1) window[layerArrayName].splice(idx2, 1);
                } else if (info.axisId) {
                  console.warn('差异清理跳过：非当前类型轴图层', info.axisId, '期望前缀:', expectedAxisPrefix);
                }
              }
              delete window[registryName][key];
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
                'fill-color': 'rgba(255,165,0, 0.25)',
                'fill-opacity': 0.25
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
      if (disposer5) disposer5(); // 清理future conflicts观察者
      if (disposerSim) disposerSim(); // 清理模拟观察者
      if (highlightTimer) clearTimeout(highlightTimer);

      // WebWorker已移除，不再需要清理
      // trajectoryWorkerManager.destroy();

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
    <div style={{ display: 'flex', width: '100%', height: '100%', gap: '8px' }}>
      {/* 左侧：冲突解决面板（固定宽度，不与地图重叠） */}
      <div style={{
        width: '50%',
        maxWidth: '700px',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        padding: '12px'
      }}>
        <ConflictResolutionPanel />
      </div>

      {/* 右侧：地图区域，占剩余宽度 */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
})

// 冲突解决面板组件
const ConflictResolutionPanel = observer(() => {
  const { t } = useI18n();

  // 使用WebSocketStore中的状态，而不是本地状态
  const conflicts = websocketStore.conflictResolutions;


  const selectedConflict = websocketStore.selectedConflict;
  const resolutions = websocketStore.resolutions;
  const resolution_analysis = websocketStore.resolution_analysis;
  const loading = websocketStore.conflictResolutionLoading;
  const errorMessage = websocketStore.lastError;

  // 获取特定冲突的解决方案 - 直接调用WebSocketStore的方法
  const getConflictResolutions = (conflictId) => {
    websocketStore.getConflictResolutions(conflictId);

  };

  // 应用解决方案 - 直接调用WebSocketStore的方法
  const applyResolution = (conflictId, solutionId) => {
    websocketStore.applyConflictResolution(conflictId, solutionId);
    console.log("应用了接圈方案", conflictId, solutionId)
  };

  // 模拟应用解决方案
  const simulateResolution = (conflictId, solutionId) => {
    // 如果当前已在模拟同一个方案，则视为“关闭模拟”并清除效果
    const current = websocketStore.getCurrentSimulation();
    const isSameSimulation = current &&
      current.conflict_id === conflictId &&
      current.solution_id === solutionId &&
      !!current.simulated_state;

    if (isSameSimulation) {
      console.log('再次点击模拟，同步停止并清理模拟效果', { conflictId, solutionId });
      try {
        // websocketStore.stoptSimulate();
        websocketStore.clearCurrentSimulation();
      } catch (e) {
        console.error('停止/清理模拟时出错:', e);
      }
      return;
    }

    // 否则正常触发模拟该解决方案
    if (websocketStore.socket && websocketStore.socket.connected) {
      console.log("模拟应用冲突解决方案", conflictId, solutionId);
      websocketStore.socket.emit('simulate_conflict_resolution', {
        conflict_id: conflictId,
        solution_id: solutionId
      });
    } else {
      console.error('WebSocket未连接，无法发送模拟应用请求');
      websocketStore.lastError = 'WebSocket未连接，无法发送模拟应用请求';
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

  // 冲突消失时，自动清理模拟效果（地图和时间线都会响应 currentSimulation 被清除）
  React.useEffect(() => {
    try {
      const current = websocketStore.getCurrentSimulation();
      const hasCurrentSimulation = !!(current && current.simulated_state);
      if (!hasCurrentSimulation) return;

      // 设置最短宽限期，避免数据抖动导致的误清理
      const now = Date.now();
      const tsMs = current?.timestamp ? new Date(current.timestamp).getTime() : 0;
      const MIN_GRACE_MS = 2000;
      if (tsMs && now - tsMs < MIN_GRACE_MS) {
        return;
      }

      const extractLastPart = (id) => {
        if (!id) return null;
        if (typeof id === 'string') {
          const parts = id.split('_');
          return parts[parts.length - 1];
        }
        return String(id);
      };

      const expectedId = extractLastPart(current.conflict_id);

      // 组合当前/未来冲突和面板列表作为存在性的依据，提升健壮性
      const listCurrent = Array.isArray(websocketStore.current_conflicts) ? websocketStore.current_conflicts : [];
      const listFuture = Array.isArray(websocketStore.future_conflicts) ? websocketStore.future_conflicts : [];
      const listPanel = Array.isArray(conflicts) ? conflicts : [];

      const activeIds = new Set();
      [listCurrent, listFuture, listPanel].forEach(list => {
        list.forEach(c => {
          const rawId = c?.conflict_id ?? c?.id ?? c?.analysis?.conflict_id;
          const norm = extractLastPart(rawId);
          if (norm) activeIds.add(norm);
        });
      });

      // 若存在模拟且对应冲突不在任何列表中（已消失或被解决），则清理模拟
      if (hasCurrentSimulation && expectedId && !activeIds.has(expectedId)) {
        console.log('检测到冲突消失，清理模拟效果', { currentConflictId: current.conflict_id, expectedId, activeIds: Array.from(activeIds) });
        websocketStore.clearCurrentSimulation();
      }
    } catch (e) {
      console.error('冲突消失自动清理模拟时出错:', e);
    }
  }, [conflicts, websocketStore.current_conflicts, websocketStore.future_conflicts]);



  return (
    <div style={{
      padding: '16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      width: '100%'
    }}>
      {/* 标题与下划线已移除 */}

      {/* 加载状态 */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#666'
        }}>
          {t('processing')}
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
            {t('current.conflicts')} ({conflicts.length})
          </h4>

          {conflicts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#999',
              padding: '20px'
            }}>
              {t('no.conflicts')}
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
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '6px'
                }}>
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
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '13px'
                  }}>
                    {conflict.conflict_id || conflict.id}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                  {t('flights')}: {[
                    conflict.flight1_id,
                    conflict.flight2_id
                  ].filter(Boolean).join(', ') || 'N/A'}
                  {' '}
                  | {t('node')}: {Array.isArray(conflict.taxiway_sequence)
                    ? conflict.taxiway_sequence.join(', ')
                    : (conflict.taxiway_sequence || 'N/A')}
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
                    backgroundColor: 'transparent',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    border: 'none'
                  }}
                  title={t('view.details')}
                >
                  <svg t="1763042591206" className="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" focusable="false">
                    <path d="M346.2 514.6m-64.2 0a64.2 64.2 0 1 0 128.4 0 64.2 64.2 0 1 0-128.4 0Z" fill="#91B1D5"></path>
                    <path d="M450.1 514.6a64.2 64.2 0 1 0 128.4 0 64.2 64.2 0 1 0-128.4 0Z" fill="#91B1D5"></path>
                    <path d="M682.5 514.6m-64.2 0a64.2 64.2 0 1 0 128.4 0 64.2 64.2 0 1 0-128.4 0Z" fill="#91B1D5"></path>
                    <path d="M512 136.3c50.7 0 99.9 9.9 146.2 29.5 44.7 18.9 84.9 46 119.5 80.6 34.5 34.5 61.6 74.7 80.6 119.5 19.6 46.3 29.5 95.5 29.5 146.2s-9.9 99.9-29.5 146.2c-18.9 44.7-46 84.9-80.6 119.5-34.5 34.5-74.7 61.6-119.5 80.6-46.3 19.6-95.5 29.5-146.2 29.5s-99.9-9.9-146.2-29.5c-44.7-18.9-84.9-46-119.4-80.6-34.5-34.5-61.6-74.7-80.6-119.5-19.6-46.3-29.5-95.5-29.5-146.2s9.9-99.9 29.5-146.2c18.9-44.7 46-84.9 80.6-119.5 34.5-34.5 74.7-61.6 119.4-80.6 46.3-19.6 95.5-29.5 146.2-29.5m0-70C265.9 66.3 66.3 265.9 66.3 512S265.9 957.7 512 957.7 957.7 758.1 957.7 512 758.1 66.3 512 66.3z" fill="#91B1D5"></path>
                  </svg>
                </div>

                {conflict.status === 'resolved' && (
                  <div style={{
                    textAlign: 'center',
                    color: '#28a745',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {t('resolved')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 解决方案详情 */}
      {selectedConflict && (
        <div className="prettyScrollbar" style={{ flex: 1, overflowY: 'auto', width: '100%', margin: 0, backgroundColor: 'transparent' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <button
              onClick={() => {
                websocketStore.selectedConflict = null;
                websocketStore.resolutions = [];
                websocketStore.clearLastError();
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                marginRight: '8px',
                color: '#979797'
              }}
            >
              {/* 返回图标，颜色继承按钮的 color */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 1024 1024"
                fill="currentColor"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M363.840919 472.978737C336.938714 497.358861 337.301807 537.486138 364.730379 561.486138L673.951902 832.05497C682.818816 839.813519 696.296418 838.915012 704.05497 830.048098 711.813519 821.181184 710.915012 807.703582 702.048098 799.94503L392.826577 529.376198C384.59578 522.174253 384.502227 511.835287 392.492414 504.59418L702.325747 223.807723C711.056111 215.895829 711.719614 202.404616 703.807723 193.674252 695.895829 184.943889 682.404617 184.280386 673.674253 192.192278L363.840919 472.978737Z" />
              </svg>
            </button>
            <h4 style={{
              margin: 0,
              fontSize: '14px',
              color: '#555'
            }}>
              {selectedConflict.conflict_id} {t('solutions')}
            </h4>
          </div>
          {errorMessage && (
            <div style={{
              border: '1px solid #dc3545',
              color: '#dc3545',
              backgroundColor: '#f8d7da',
              padding: '8px',
              borderRadius: '4px',
              marginBottom: '12px',
              fontSize: '12px'
            }}>
              {errorMessage}
            </div>
          )}
          {!loading && Array.isArray(resolutions) && resolutions.length === 0 && !errorMessage && (
            <div style={{
              border: '1px solid #adb5bd',
              color: '#6c757d',
              backgroundColor: '#f1f3f5',
              padding: '8px',
              borderRadius: '4px',
              marginBottom: '12px',
              fontSize: '12px'
            }}>
              未找到解决方案
            </div>
          )}

          {/* 计算度量最大值用于归一化显示 */}
          {(() => {
            // 打印解决方案详情数据到控制台
            // console.log('=== 解决方案详情数据 ===');
            // console.log('selectedConflict:', selectedConflict);
            // console.log('resolutions:', resolutions);
            // console.log('resolution_analysis:', resolution_analysis);
            // console.log('loading:', loading);
            // console.log('========================');
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
              const pw = 200, ph = 44; // SVG尺寸（略增高以留空隙）
              const labelX = 6;
              const barX = 80; // 增加标签与柱状图之间的水平空隙
              const valueGap = 6; // 数值与柱状图的间距
              const pNorm = Math.min(1, Math.abs(pathDelta) / (maxPath || 1));
              const tNorm = Math.min(1, Math.abs(timeDelta) / (maxTime || 1));
              const barWPath = Math.max(2, pNorm * (pw - 90));
              const barWTime = Math.max(2, tNorm * (pw - 90));
              return (
                <svg width={pw} height={ph} style={{ borderRadius: 4 }}>
                  <text x={labelX} y="14" fontSize="11" fill={BUTTON_COLORS.LIGHT_GRAY}>{t('path.delta')}</text>
                  <rect x={barX} y="6" width={pw - 90} height="8" fill="#f0f0f0" rx="3" />
                  <rect x={barX} y="6" width={barWPath} height="8" fill={BUTTON_COLORS.LIGHT_GRAY} rx="3" />
                  <text x={barX + barWPath + valueGap} y="13" fontSize="10" fill={BUTTON_COLORS.LIGHT_GRAY}>{pathDelta?.toFixed ? pathDelta.toFixed(2) : pathDelta}</text>

                  <text x={labelX} y="38" fontSize="11" fill={BUTTON_COLORS.LIGHT_GRAY}>{t('time.delta')}</text>
                  <rect x={barX} y="30" width={pw - 90} height="8" fill="#f0f0f0" rx="3" />
                  <rect x={barX} y="30" width={barWTime} height="8" fill={BUTTON_COLORS.LIGHT_GRAY} rx="3" />
                  <text x={barX + barWTime + valueGap} y="37" fontSize="10" fill={BUTTON_COLORS.LIGHT_GRAY}>{timeDelta?.toFixed ? timeDelta.toFixed(2) : timeDelta}</text>
                </svg>
              );
            };

            // 辅助：影响图（impact_graph）
            const ImpactGraph = ({ impactGraph, targetFlight }) => {
              const nodes = impactGraph?.nodes ? Object.entries(impactGraph.nodes) : [];
              const edges = impactGraph?.edges || [];

              // 根据节点数量动态计算高度
              const nodeCount = nodes.length;
              const minHeight = 90; // 缩小最小高度
              const maxHeight = 220; // 缩小最大高度
              const heightPerNode = 24; // 每个节点占用高度更紧凑
              const calculatedHeight = Math.min(maxHeight, Math.max(minHeight, nodeCount * heightPerNode));
              
              const w = 480, h = calculatedHeight; // 缩小整体宽度
             

              // 构建有向图的树形布局
              const buildTreeLayout = (nodes, edges) => {
                if (nodes.length === 0) return {};

                // 创建有向邻接表（只记录出边）
                const outgoing = {};
                const incoming = {};
                nodes.forEach(([id]) => {
                  outgoing[id] = [];
                  incoming[id] = [];
                });

                edges.forEach(edge => {
                  const from = edge.from;
                  const to = edge.to;
                  if (outgoing[from] && incoming[to]) {
                    outgoing[from].push(to);
                    incoming[to].push(from);
                  }
                });

                // 找到根节点（没有入边的节点）
                const rootNodes = nodes.filter(([id]) => incoming[id].length === 0);
                const rootId = rootNodes.length > 0 ? rootNodes[0][0] : nodes[0][0];

                // BFS构建层级（只沿着出边方向）
                const levels = {};
                const visited = new Set();
                const queue = [{ id: rootId, level: 0 }];
                visited.add(rootId);
                levels[rootId] = 0;

                let maxLevel = 0;
                while (queue.length > 0) {
                  const { id, level } = queue.shift();
                  maxLevel = Math.max(maxLevel, level);

                  // 只遍历出边
                  outgoing[id].forEach(childId => {
                    if (!visited.has(childId)) {
                      visited.add(childId);
                      levels[childId] = level + 1;
                      queue.push({ id: childId, level: level + 1 });
                    }
                  });
                }

                // 处理未访问的节点（可能是孤立节点）
                nodes.forEach(([id]) => {
                  if (!visited.has(id)) {
                    levels[id] = maxLevel + 1;
                    maxLevel = Math.max(maxLevel, maxLevel + 1);
                  }
                });

                // 按层级分组节点
                const nodesByLevel = {};
                nodes.forEach(([id]) => {
                  const level = levels[id];
                  if (!nodesByLevel[level]) nodesByLevel[level] = [];
                  nodesByLevel[level].push(id);
                });

                // 计算位置
                const positions = {};
                const levelWidth = maxLevel > 0 ? (w - 60) / (maxLevel + 1) : w - 60;
                if (nodes.length === 1) {
  const id = nodes[0][0];
  positions[id] = {
    x: w / 3.5,      // 水平居中
    y: h / 2       // 垂直居中（您已用 h/2，可保留）
  };
}
else{
                Object.keys(nodesByLevel).forEach(level => {
                  const levelNodes = nodesByLevel[level];
                  const levelHeight = levelNodes.length > 1 ? (h - 40) / (levelNodes.length - 1) : h / 2;

                  levelNodes.forEach((nodeId, index) => {
                    positions[nodeId] = {
                      x: 30 + parseInt(level) * levelWidth,
                      y: levelNodes.length === 1 ? h / 2 : 20 + index * levelHeight
                    };
                  });
                });
                }

                return positions;
              };

              const positions = buildTreeLayout(nodes, edges);

              // 获取飞机颜色的函数
              const getAircraftColor = (aircraftId) => {
                // 检查是否为活跃飞机
                const isActive = websocketStore.planePosition &&
                  websocketStore.planePosition.some(plane => plane.id === aircraftId);

                // 使用WebSocketStore的统一颜色管理
                return websocketStore.getAircraftColor(aircraftId, isActive);
              };

              // 计算影响程度的函数（基于延迟时间）
              const getImpactLevel = (delayMinutes) => {
                if (typeof delayMinutes !== 'number') return 1;
                // 将延迟时间映射到1-5的影响级别
                if (delayMinutes <= 1) return 1;
                if (delayMinutes <= 3) return 2;
                if (delayMinutes <= 5) return 3;
                if (delayMinutes <= 10) return 4;
                return 5;
              };

              // 根据影响级别计算线条粗细（整体缩小宽度）
              const getStrokeWidth = (impactLevel) => {
                return Math.max(0.5, impactLevel * 0.5); // 0.5-2.5 像素
              };

              return (
                <svg width={w} height={h} style={{ borderRadius: 4 }}>
                  {/* 边 - 添加箭头，根据影响程度调整粗细 */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7"
                      refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                    </marker>
                    {/* 统一飞机图标，用于节点显示（与地图视图一致） */}
                    <symbol id="impact-airplane-icon" viewBox="0 0 1024 1024">
                      <path fill="currentColor" d="M512 174.933333c23.466667 0 42.666667 8.533333 59.733333 25.6s25.6 36.266667 25.6 59.733334v192l206.933334 185.6c6.4 4.266667 10.666667 12.8 14.933333 21.333333s6.4 17.066667 6.4 25.6v23.466667c0 8.533333-2.133333 12.8-6.4 14.933333s-10.666667 2.133333-17.066667-2.133333l-204.8-140.8v149.333333c38.4 36.266667 57.6 57.6 57.6 64v36.266667c0 8.533333-2.133333 12.8-6.4 17.066666-4.266667 2.133333-10.666667 2.133333-19.2 0l-117.333333-72.533333-117.333333 72.533333c-6.4 4.266667-12.8 4.266667-19.2 0s-6.4-8.533333-6.4-17.066666v-36.266667c0-8.533333 19.2-29.866667 57.6-64v-149.333333l-204.8 140.8c-6.4 4.266667-12.8 6.4-17.066667 2.133333-4.266667-2.133333-6.4-8.533333-6.4-14.933333V684.8c0-8.533333 2.133333-17.066667 6.4-25.6 4.266667-8.533333 8.533333-17.066667 14.933333-21.333333l206.933334-185.6v-192c0-23.466667 8.533333-42.666667 25.6-59.733334s36.266667-25.6 59.733333-25.6z" />
                    </symbol>
                  </defs>
                  {edges.map((e, idx) => {
                    const fromId = e.from;
                    const toId = e.to;
                    const from = positions[fromId];
                    const to = positions[toId];
                    if (!from || !to) return null;

                    // 获取目标节点的延迟信息来计算影响程度
                    const toNodeInfo = nodes.find(([id]) => id === toId)?.[1];
                    const impactLevel = getImpactLevel(toNodeInfo?.delay_minutes);
                    const strokeWidth = getStrokeWidth(impactLevel);
                    // 使用两条贝塞尔曲线形成带状闭合路径（半透明）
                    const dx = to.x - from.x;
                    const dy = to.y - from.y;
                    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    const dirX = dx / length;
                    const dirY = dy / length;
                    // 终点收缩到圆的边缘
                    const NODE_RADIUS = 9;
                    const endX = to.x - dirX * NODE_RADIUS;
                    const endY = to.y - dirY * NODE_RADIUS;
                    // 垂直方向单位向量（用于带状上下边界）
                    // const perpX = -dirY;
                    // const perpY = dirX;

                    // 单条三次贝塞尔曲线（非带状），保持宽度一致，使用描边
                    const startX = from.x + dirX * NODE_RADIUS;
                    const startY = from.y + dirY * NODE_RADIUS;

                    // 恢复为直线：起点与终点之间的直线，起点/终点均贴合节点圆边缘
                    const d = `M ${startX} ${startY} L ${endX} ${endY}`;

                    // 半透明带状曲线
                    return (
                      <path
                        key={idx}
                        d={d}
                        fill="none"
                        stroke="#666"
                        opacity={0.35}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                  {/* 节点 - 使用飞机ID唯一颜色映射 */}
                  {nodes.map(([id, info]) => {
                    const pos = positions[id];
                    if (!pos) return null;

                    // 使用WebSocketStore的颜色映射：按飞机ID分配唯一颜色
                    const aircraftColor = getAircraftColor(id);
                    const iconSize = 18;

                    return (
                      <g key={id}>
                        {/* 使用统一飞机icon替代圆形节点 */}
                        <svg x={pos.x - iconSize / 2} y={pos.y - iconSize / 2} width={iconSize} height={iconSize} viewBox="0 0 1024 1024" style={{ color: aircraftColor }}>
                          {/* 将飞机方向朝向右边（顺时针旋转90度，围绕中心） */}
                          <use xlinkHref="#impact-airplane-icon" transform="rotate(90 512 512)" />
                        </svg>
                        <text x={pos.x} y={pos.y - 12} textAnchor="middle" fontSize="9" fill="#333" fontWeight="bold">{id}</text>
                        {typeof info.delay_minutes === 'number' && (
                          <text x={pos.x} y={pos.y + 14} textAnchor="middle" fontSize="9" fill="#333" fontWeight="bold">
                            {info.delay_minutes.toFixed(1)}m
                          </text>
                        )}
                      </g>
                    );
                  })}
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
                      backgroundColor: 'rgba(255,255,255,0.6)',
                      width: '100%',
                      maxWidth: '1200px',
                      marginLeft: 'auto',
                      marginRight: 'auto'
                    }}
                  >
                    {/* 顶部：策略图标 + 策略名称（左） / 操作按钮（右） */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StrategyIcon strategy={resolution.strategy} />
                        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333' }}>{resolution.strategy}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          title={t('simulate.apply')}
                          aria-label={t('simulate.apply')}
                          onClick={() => simulateResolution(resolution_analysis.conflict_id, resolution.option_id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: BUTTON_COLORS.LIGHT_GRAY,
                            borderRadius: '4px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.color = BUTTON_COLORS.LIGHT_GRAY_HOVER}
                          onMouseOut={(e) => e.currentTarget.style.color = BUTTON_COLORS.LIGHT_GRAY}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" opacity="0.15" />
                            <path d="M9 8l7 4-7 4z" />
                          </svg>
                        </button>
                        <button
                          title={t('apply.solution')}
                          aria-label={t('apply.solution')}
                          onClick={() => applyResolution(resolution_analysis.conflict_id, resolution.option_id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: BUTTON_COLORS.LIGHT_GRAY,
                            borderRadius: '4px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.color = BUTTON_COLORS.LIGHT_GRAY_HOVER}
                          onMouseOut={(e) => e.currentTarget.style.color = BUTTON_COLORS.LIGHT_GRAY}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" opacity="0.15" />
                            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 两行布局：第一行放时间路径比较图和按钮，第二行放影响图 */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* 左侧：目标ID标签 */}
                      <div style={{ display: 'flex', alignItems: 'center', minWidth: 100 }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 3,
                            backgroundColor: '#f5f5f5',
                            color: AIRCRAFT_COLORS.ACTIVE,
                          }}
                        >
                          {t('target')}: {resolution.target_flight}
                        </span>
                      </div>

                      {/* 中间：时间和路径的比较图（固定宽度） */}
                      <div style={{ width: 300 }}>
                        <MetricBars
                          pathDelta={resolution.path_length_delta || 0}
                          timeDelta={resolution.time_delta_minutes || 0}
                          maxPath={maxPath}
                          maxTime={maxTime}
                        />
                      </div>

                      {/* 右侧：影响图（靠右显示） */}
                      <div  key={resolution.option_id}
                    style={{
                      marginLeft: 'auto', // 推动该div到最右边
      display: 'flex', // 使用flexbox来实现内容居中
      justifyContent: 'center', // 水平居中
      alignItems: 'center', // 垂直居中
      border: '1px solid #ddd',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '12px',
                    
                    }}>
                     
    <ImpactGraph
      impactGraph={resolution.impact_graph}
      targetFlight={resolution.target_flight}
    />
  
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
