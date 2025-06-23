import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css"
import React, { useMemo } from "react"

import Map, { Source, Layer } from "react-map-gl/maplibre"          // 地图组件
import { Canvas } from "react-three-map/maplibre"// Three.js ↔︎ MapLibre 桥

import { Line } from "@react-three/drei"          // 粗线帮助组件
import { Vector3 } from "three"

const  Test = ()=> {
  /* 轨迹：经纬度+海拔（米） */
  const track = [
    [116.593238, 40.051893, 10000],
    [11.593238, 41.061893, 100],
    [115.593238, 40.051893, 120],
    [116.593238, 40.051893, 140],
    [116.593238, 40.051893, 80]
  ];

  /* 空白样式：只有透明背景 */
    const blankStyle = {
        version: 8,
        sources: {},
        layers: [
        {
            id: "background",
            type: "background",
            paint: { "background-color": "#00000000" }
        }
        ]
    }

    const [anchorLng, anchorLat] = track[0];


  /* 把经纬度转换成 Mercator 0-1 坐标，只在首次渲染时计算一次 */
  const points = useMemo(() => {
    // ① 锚点（经纬度 → Mercator 单位）
    const origin = maplibregl.MercatorCoordinate.fromLngLat(
      { lng: anchorLng, lat: anchorLat }, 0
    )
  
    // ② 1 个 Mercator 单位对应多少米 —— Mapbox / MapLibre 官方工具方法
    const unitToMeter = 1000
  
    // ③ 把每个轨迹点转成“相对锚点的米”
    return track.map(([lng, lat, alt]) => {
      const c = maplibregl.MercatorCoordinate.fromLngLat(
        { lng, lat }, alt          // alt 依旧填“真实海拔（米）”
      )
  
      return new Vector3(
        (c.x - origin.x) * unitToMeter,   // ← × 转换系数
        (c.y - origin.y) * unitToMeter,
        (c.z - origin.z) * unitToMeter    // c.z 本来就是比值，也统一放大
      )
    })
  }, [])

  return (
    <Map
      mapLib={maplibregl}
      initialViewState={{ longitude: anchorLng, latitude: anchorLat, zoom: 14, pitch: 60 }}
      mapStyle={blankStyle}          // ① 换成空白底图
      style={{ height: "100vh" }}
    >
      {/* ② 把自己的路网 GeoJSON 当作 Source + Line Layer */}
      <Source id="road-source" type="geojson" data="/taxiwayline2.geojson">
        <Layer
          id="road-line"
          type="line"
          paint={{
            "line-color": "#5E7CFF",
            "line-width": 2
          }}
        />
      </Source>

      {/* ③ Three.js 轨迹层（不变） */}
      <Canvas latitude={anchorLat} longitude={anchorLng} frameloop="demand">
        <Line points={points} color="#ff5500" lineWidth={5} depthTest={false} depthWrite={false} />
      </Canvas>
    </Map>
  )
}
export default Test;
