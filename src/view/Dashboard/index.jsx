import React from "react";
import TaxiwayMap from "./TaxiwayMap";
import "./index.css";

const Dashboard = () => {
    return (
        <div className="dashboard-container">
          {/* 左侧主栏 */}
          <div className="left-panel">
            <div className="left-top">
              <div className="content-placeholder" />
            </div>
            <div className="left-bottom">
              <div className="content-placeholder" />
            </div>
          </div>
    
          {/* 右侧主栏 */}
          <div className="right-panel">
            <div className="right-top">
              <div className="content-placeholder" />
            </div>
            <div className="right-bottom">
              <div className="content-placeholder">
                <TaxiwayMap geoJsonUrl="/taxiwayline2.geojson" />
              </div>
              
            </div>
          </div>
        </div>
    )
}

export default Dashboard