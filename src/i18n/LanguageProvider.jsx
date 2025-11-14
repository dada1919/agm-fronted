import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 简易字典：中文 / 英文
const dictionaries = {
  zh: {
    'app.title': 'AGM',
    'road.info': '道路信息',
    'road.id': '道路ID',
    'road.name': '道路名称',
    'coords': '坐标',
    'plan.path': '规划路径',
    'flight.id': '航班ID',
    'destination': '目的地',
    'origin': '起点',
    'current.conflicts': '当前冲突',
    'no.conflicts': '暂无冲突',
    'resolved': '已解决',
    'view.details': '查看详情与方案',
    'solutions': '解决方案',
    'processing': '处理中...',
    'legend.title': '飞机类型',
    'legend.active': '活跃飞机 (Active)',
    'legend.planning': '计划飞机 (Planning)',
    'taxi': '滑行',
    'time': '时间',
    'start': '开始',
    'time.to': '距离',
    'takeoff': '起飞',
    'remaining': '剩余',
    'path.delta': '路径增量',
    'time.delta': '时间增量',
    'flights': '航班',
    'node': '节点',
    'target': '目标',
    'simulate.apply': '模拟应用',
    'apply.solution': '应用此方案',
    'lang.zh': '中文',
    'lang.en': 'English',
    'lang.switch': '语言',
  },
  en: {
    'app.title': 'AGM',
    'road.info': 'Road Info',
    'road.id': 'Road ID',
    'road.name': 'Road Name',
    'coords': 'Coordinates',
    'plan.path': 'Planned Path',
    'flight.id': 'Flight ID',
    'destination': 'Destination',
    'origin': 'Origin',
    'current.conflicts': 'Current Conflicts',
    'no.conflicts': 'No Conflicts',
    'resolved': 'Resolved',
    'view.details': 'View Details & Solutions',
    'solutions': 'Solutions',
    'processing': 'Processing...',
    'legend.title': 'Aircraft Types',
    'legend.active': 'Active Aircraft',
    'legend.planning': 'Planning Aircraft',
    'taxi': 'Taxi',
    'time': 'Time',
    'start': 'Start',
    'time.to': 'Time to',
    'takeoff': 'Takeoff',
    'remaining': 'Remaining',
    'path.delta': 'Path Delta',
    'time.delta': 'Time Delta',
    'flights': 'Flights',
    'node': 'Node',
    'target': 'Target',
    'simulate.apply': 'Simulate Apply',
    'apply.solution': 'Apply Solution',
    'lang.zh': '中文',
    'lang.en': 'English',
    'lang.switch': 'Language',
  }
};

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k });

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'zh');

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  const t = useCallback((key, params) => {
    const dict = dictionaries[lang] || dictionaries.zh;
    let text = dict[key] || key;
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((p) => {
        text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), String(params[p]));
      });
    }
    return text;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useI18n = () => useContext(LanguageContext);