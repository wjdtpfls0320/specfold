import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './ko.json';
import en from './en.json';

const saved = localStorage.getItem('specfold.lang');
const browser = navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';

i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, en: { translation: en } },
  lng: saved === 'ko' || saved === 'en' ? saved : browser,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (l) => {
  localStorage.setItem('specfold.lang', l);
  document.documentElement.lang = l;
});
document.documentElement.lang = i18n.language;

export default i18n;
