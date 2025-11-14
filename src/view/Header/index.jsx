import React from "react";
import { useI18n } from '@/i18n/LanguageProvider';
import "./index.less";

const Header = () => {
    const { lang, setLang, t } = useI18n();
    return (
        <div className="header-root">
            <div className="header-icon">
                <span>{t('app.title')}</span>
            </div>
            <div className="lang-switch">
                <label htmlFor="lang-select" style={{ fontSize: 12, color: '#666' }}>{t('lang.switch')}:</label>
                <select
                    id="lang-select"
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 4 }}
                >
                    <option value="zh">{t('lang.zh')}</option>
                    <option value="en">{t('lang.en')}</option>
                </select>
            </div>
        </div>
    )
}
export default Header