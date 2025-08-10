import React from "react";
import TaxiwayMap from "./TaxiwayMap";
import "./index.css";
import PlanningView from "./PlanningView";

const Dashboard = () => {
    return (
        <div className="dashboard-container">
          {/* 上方 PlanningView */}
          <div className="top-panel">
            <PlanningView />
          </div>
    
          {/* 下方 TaxiwayMap */}
          <div className="bottom-panel">
            <TaxiwayMap geoJsonUrl="/taxiwayline2.geojson" />
          </div>
        </div>
    )
}

export default Dashboard