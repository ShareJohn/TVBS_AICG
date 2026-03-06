
export interface CGData {
  mainTitle: string;
  contentItems: string[];
  theme: CGTheme;
  titlePosX: number;
  titlePosY: number;
  titleScale: number;
  contentPosX: number;
  contentPosY: number;
  contentScale: number;
  mainSize: number;
  itemSize: number;
  mainWidth: number;
  itemWidth: number;
  mainFont: string;
  itemFont: string;
  showStroke?: boolean;
  strokeWidth?: number;
  bgOpacity?: number;
}

export type CGTheme = 'default' | 'urgent' | 'corporate' | 'modern' | 'nature';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  solid: string; // 用於內容文字與主色調的純色值
}

export const FONT_OPTIONS = [
  { label: '思源黑體 (Noto Sans TC)', value: "'Noto Sans TC', sans-serif" },
  { label: '微軟正黑體', value: "'Microsoft JhengHei', sans-serif" },
  { label: 'Oswald (新聞風格)', value: "'Oswald', sans-serif" },
  { label: 'Roboto (現代黑體)', value: "'Roboto', sans-serif" },
  { label: 'Playfair (優雅襯線)', value: "'Playfair Display', serif" },
  { label: '標楷體', value: "'DFKai-SB', serif" },
  { label: '等寬字體 (Monospace)', value: "monospace" }
];

export const THEMES: Record<CGTheme, ThemeConfig> = {
  default: {
    primary: 'from-blue-900 to-blue-600',
    secondary: 'bg-white/95',
    accent: 'border-yellow-400',
    text: 'text-slate-900',
    solid: '#1e3a8a', // blue-900
  },
  urgent: {
    primary: 'from-red-800 to-red-600',
    secondary: 'bg-white/95', // 改為白色背景，避免黑底紅字
    accent: 'border-red-600',
    text: 'text-red-900',
    solid: '#991b1b', // red-800
  },
  corporate: {
    primary: 'from-slate-900 to-slate-700',
    secondary: 'bg-slate-100/95',
    accent: 'border-blue-400',
    text: 'text-slate-900',
    solid: '#0f172a', // slate-900
  },
  modern: {
    primary: 'from-purple-800 to-indigo-700',
    secondary: 'bg-white/90',
    accent: 'border-pink-500',
    text: 'text-indigo-900',
    solid: '#5b21b6', // purple-800
  },
  nature: {
    primary: 'from-emerald-800 to-teal-600',
    secondary: 'bg-stone-50/95',
    accent: 'border-orange-400',
    text: 'text-emerald-900',
    solid: '#065f46', // emerald-800
  }
};
