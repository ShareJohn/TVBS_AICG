import React, { memo } from 'react';
import { CGTheme, THEMES } from '../types';

interface CGPreviewProps {
  data: {
    id: string;
    type: 'image' | 'title' | 'content' | 'block' | 'stamp';
    src?: string;
    text?: string;
    items?: string[];
    theme: CGTheme;
    size: number;
    font: string;
    width: number;
    letterSpacing: number;
    borderRadius: number;
    bgOpacity: number;
    showStroke: boolean;
    strokeWidth: number;
    showBackground: boolean;
    baseW: number;
    baseH: number;
    rotation?: number;
    stampShape?: 'explosion' | 'box';
    autoWrap?: boolean;
    layoutType?: string;
    imageTransform?: { x: number, y: number, scale: number };
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
  };
  mode: 'title' | 'content';
  isSelected?: boolean;
  hasGlobalBg?: boolean;
}

/**
 * 改進後的文字描邊演算法：使用多重陰影確保邊緣連續無斷裂
 */
const getStrokeShadow = (width: number, color: string) => {
  if (!width || width <= 0) return '';
  const shadows = [];
  const steps = 12; // 增加取樣點以獲得更圓潤的描邊
  for (let i = 0; i < steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const x = Math.cos(angle) * width;
    const y = Math.sin(angle) * width;
    shadows.push(`${x.toFixed(1)}px ${y.toFixed(1)}px 0 ${color}`);
  }
  return shadows.join(', ');
};

const getExplosionPath = (width: number, height: number, spikes = 20) => {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  const points = [];

  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * rx;
    let y = cy + Math.sin(rot) * ry;
    points.push(`${x},${y}`);
    rot += step;

    x = cx + Math.cos(rot) * (rx * 0.7);
    y = cy + Math.sin(rot) * (ry * 0.7);
    points.push(`${x},${y}`);
    rot += step;
  }
  return points.join(' ');
};

export const CGPreview = memo(({
  data,
  mode,
  isSelected,
  hasGlobalBg
}: CGPreviewProps) => {
  const theme = THEMES[data.theme];
  const bgAlpha = data.bgOpacity ?? 1;
  const isTitle = mode === 'title' || data.type === 'block';

  const isProfileLayout = data.layoutType === 'profile';
  const showBackground = isProfileLayout && !hasGlobalBg && (data.id.includes('title-r') || data.id.includes('content-r')) ? true : data.showBackground;

  // 主標字型特效 (若是 profile 且無底層且為主標題)
  const isProfileMainTitleNoBg = isProfileLayout && !hasGlobalBg && data.id.includes('title-main');
  const showStroke = isProfileMainTitleNoBg ? true : data.showStroke;
  const strokeWidth = isProfileMainTitleNoBg ? 8 : data.strokeWidth;

  // 決定文字顏色與描邊顏色
  // 如果是標題但沒有開啟背景框（例如 profile 版型的新設定），則字體顏色使用與主題搭配的實色 (theme.solid) 而非白色，避免在淺底圖上無法辨識
  // 如果是 profile 小標且開啟背景 (強制開啟時)，文字顏色為白色
  let textColor = (isTitle && showBackground !== false) ? 'white' : theme.solid;
  let strokeColor = (isTitle && showBackground !== false) ? theme.solid : 'white';

  if (isProfileMainTitleNoBg) {
    textColor = 'white';
    strokeColor = theme.solid;
  }

  // 核心對齊樣式
  const commonTextStyles: React.CSSProperties = {
    fontFamily: data.font,
    letterSpacing: `${data.letterSpacing}px`,
    fontSize: `${data.size}px`,
    lineHeight: 1,
    zIndex: 2,
    color: textColor,
    whiteSpace: data.autoWrap ? 'pre-wrap' : 'nowrap',
    wordBreak: data.autoWrap ? 'break-word' : 'normal',
    display: 'inline-block',
    textAlign: 'left',
    fontWeight: 900,
    textShadow: showStroke ? getStrokeShadow(strokeWidth, strokeColor) : 'none',
    padding: 0,
    margin: 0,
    transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s ease, color 0.2s ease',
  };

  const textHoverClass = "hover:scale-[1.03] hover:brightness-125 cursor-pointer active:scale-95";

  const renderContent = () => {
    if (data.type === 'image') {
      const transform = data.imageTransform;
      return (
        <div className="w-full h-full overflow-hidden relative" style={{ borderRadius: `${data.borderRadius}px` }}>
          {data.src ? (
            <>
              {/* 底層：模糊且暗化的邊緣延伸圖 */}
              <img
                src={data.src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-[16px] brightness-75 scale-110 pointer-events-none"
                style={{ opacity: data.bgOpacity }}
              />

              {/* 頂層：可受控制與縮放的清晰原圖 */}
              <img
                src={data.src}
                alt="Uploaded Asset"
                className="absolute pointer-events-none origin-top-left z-10 drop-shadow-2xl max-w-none max-h-none"
                style={{
                  opacity: data.bgOpacity,
                  width: data.imageNaturalWidth ? `${data.imageNaturalWidth}px` : '100%',
                  height: data.imageNaturalHeight ? `${data.imageNaturalHeight}px` : '100%',
                  objectFit: 'cover', // 強制維持比例，避免左右壓扁
                  transform: transform
                    ? `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
                    : 'none'
                }}
              />
            </>
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center text-[10px] text-white/20 uppercase font-black">
              Missing Image
            </div>
          )}
        </div>
      );
    }

    if (data.type === 'block') {
      return (
        <div className="relative w-full h-full group/block" style={{ width: `${data.width}px` }}>
          <div className={`absolute inset-0 bg-gradient-to-r ${theme.primary} border-l-[16px] ${theme.accent} transition-all duration-300 group-hover/block:brightness-110`}
            style={{ opacity: bgAlpha, borderRadius: `${data.borderRadius}px`, zIndex: 0 }}
          />
        </div>
      );
    }

    if (mode === 'title') {
      return (
        <div
          className="relative h-full flex items-center group/title"
          style={{
            width: showBackground || data.autoWrap ? `${data.width}px` : 'auto',
            minWidth: data.autoWrap ? 'auto' : 'max-content'
          }}
        >
          {showBackground && (
            <div className={`absolute inset-0 bg-gradient-to-r ${theme.primary} border-l-[16px] ${theme.accent} transition-all duration-300 group-hover/title:brightness-110`}
              style={{ opacity: bgAlpha, borderRadius: `${data.borderRadius}px`, zIndex: 0 }}
            />
          )}
          <div className={`relative z-10 flex ${data.autoWrap ? 'items-start' : 'items-center'} h-full w-full`} style={{ paddingLeft: showBackground ? '48px' : '0px', paddingRight: showBackground ? '48px' : '0px' }}>
            <span style={commonTextStyles} className={`uppercase tracking-tighter w-full ${textHoverClass}`}>
              {data.text || '標題文字'}
            </span>
          </div>
        </div>
      );
    }

    if (data.type === 'stamp') {
      const isExplosion = data.stampShape === 'explosion';
      const points = isExplosion ? getExplosionPath(data.width, data.baseH || 200) : '';

      return (
        <div className="relative w-full h-full flex items-center justify-center group/stamp">
          <div className="absolute inset-0" style={{ zIndex: 0 }}>
            {isExplosion ? (
              <svg width="100%" height="100%" viewBox={`0 0 ${data.width} ${data.baseH}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <polygon points={points} fill={theme.solid} stroke="white" strokeWidth="8" strokeLinejoin="round" />
              </svg>
            ) : (
              <div className="w-full h-full border-[12px] border-white" style={{ backgroundColor: theme.solid, borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div className="absolute inset-3 border-[4px] border-white/30 rounded-lg"></div>
              </div>
            )}
          </div>
          <div className="relative z-10 text-center">
            <span style={{ ...commonTextStyles, fontSize: isExplosion ? `${data.size * 1.5}px` : `${data.size}px`, transform: isExplosion ? 'rotate(-5deg)' : 'none' }}>
              {data.text || '獨家'}
            </span>
          </div>
        </div>
      );
    }

    else {
      const items = data.items || ['摘要項目'];
      return (
        <div className="flex flex-col gap-[10px] w-full items-start h-full" style={{ overflow: 'visible' }}>
          {items.map((item, index) => {
            return (
              <div
                key={index}
                className={`relative flex ${data.autoWrap ? 'items-start' : 'items-center'} group/item`}
                style={{
                  width: showBackground || data.autoWrap ? `${data.width}px` : 'auto',
                  minWidth: data.autoWrap ? 'auto' : 'max-content',
                  flex: 1
                }}
              >
                {showBackground && (
                  <div className={`absolute inset-0 ${theme.secondary} border-l-[8px] ${theme.accent} transition-all duration-300 group-hover/item:brightness-105`}
                    style={{ opacity: bgAlpha, borderRadius: `${data.borderRadius}px`, zIndex: 0 }}
                  />
                )}
                <div className={`relative z-10 flex ${data.autoWrap ? 'items-start' : 'items-center'} h-full w-full`} style={{ paddingLeft: showBackground ? '32px' : '0px', paddingRight: showBackground ? '32px' : '0px' }}>
                  <span style={commonTextStyles} className={`w-full ${textHoverClass}`}>
                    {item}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className={`flex flex-col items-start select-none relative w-full h-full transition-all duration-300 ${isSelected ? 'ring-2 ring-blue-500/20' : ''}`} style={{ overflow: 'visible', transform: `rotate(${data.rotation || 0}deg)` }}>
      {renderContent()}
    </div>
  );
});