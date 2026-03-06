
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FONT_OPTIONS, CGTheme, THEMES } from './types';
import { CGPreview } from './components/CGPreview';
// import { generateHeadlines } from './services/geminiService';
import { CropModal } from './components/CropModal';
import html2canvas from 'html2canvas';

interface Asset {
  id: string;
  type: 'image' | 'title' | 'content' | 'block' | 'stamp';
  src?: string;
  text?: string;
  items?: string[];
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  baseW: number;
  baseH: number;
  opacity: number;
  bgOpacity: number;
  name: string;
  visible: boolean;
  locked?: boolean;
  groupId?: string;
  font: string;
  size: number;
  theme: CGTheme;
  width: number;
  letterSpacing: number;
  borderRadius: number;
  showBackground: boolean;
  showStroke: boolean;
  strokeWidth: number;
  originalSrc?: string;
  rotation?: number;
  stampShape?: 'explosion' | 'box';
  autoWrap?: boolean;
  layoutType?: string;
}

interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SafetyGuides: React.FC<{ opacity: number }> = ({ opacity }) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const imageUrl = `https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/Safety%20range/%E8%A8%98%E8%80%85.png?cache=${new Date().getTime()}`;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-[9999] safety-overlay" style={{ opacity }}>
      {!loadFailed ? (
        <img
          src={imageUrl}
          alt="Safety Guides"
          className="w-full h-full object-fill opacity-100 block"
          style={{ pointerEvents: 'none' }}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div className="w-full h-full border-[60px] border-blue-500/10 flex items-center justify-center">
          <div className="w-full h-full border-2 border-dashed border-blue-500/30">
            <div className="absolute top-2 right-2 bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded font-bold">
              安全框 (備援模式)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [history, setHistory] = useState<Asset[][]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
  // const [aiPanelPos, setAiPanelPos] = useState({ x: 0, y: 0 });
  const [previewScale, setPreviewScale] = useState(0.45);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [canvasBgVisible, setCanvasBgVisible] = useState(true);
  const [safetyVisible, setSafetyVisible] = useState(true);
  const [safetyOpacity, setSafetyOpacity] = useState(0.5);
  // const [aiInput, setAiInput] = useState('');
  const [fontLoaded, setFontLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isPulloutSelecting, setIsPulloutSelecting] = useState(false);
  const [pulloutSourceId, setPulloutSourceId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const [pendingCropImages, setPendingCropImages] = useState<{ src: string, name: string, id?: string, aspect?: number }[]>([]);
  const [currentCropIndex, setCurrentCropIndex] = useState<number | null>(null);

  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);

  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [isBgPanelOpen, setIsBgPanelOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const HEIGHT_FACTOR = 1.5;

  useEffect(() => {
    document.fonts.ready.then(() => {
      setFontLoaded(true);
    });
    // setAiPanelPos({
    //   x: window.innerWidth / 2 - 250,
    //   y: window.innerHeight - 350
    // });
  }, []);

  const calculateAssetVisualBounds = (asset: Asset): { baseW: number, baseH: number } => {
    if (asset.type === 'image') return { baseW: asset.baseW || 400, baseH: asset.baseH || 300 };
    const rowH = Math.max(1, asset.size * HEIGHT_FACTOR);
    if (asset.type === 'block') return { baseW: Math.max(1, asset.width), baseH: rowH };

    const getPreciseTextWidth = (text: string, font: string, size: number, spacing: number) => {
      if (!measureCtx) return Math.max(size, (text || '').length * size);
      measureCtx.font = `900 ${size}px ${font}`;
      const measured = measureCtx.measureText(text || ' ').width;
      return Math.max(1, measured + ((text || '').length * (spacing || 0)));
    };

    if (asset.type === 'title') {
      const textW = getPreciseTextWidth(asset.text || '', asset.font, asset.size, asset.letterSpacing);
      const contentW = textW + 96;
      const finalW = asset.showBackground ? Math.max(asset.width, contentW) : contentW;
      return { baseW: Math.max(1, finalW), baseH: rowH };
    } else {
      const items = asset.items || [];
      const maxTextW = items.length > 0 ? Math.max(...items.map(it => getPreciseTextWidth(it, asset.font, asset.size, asset.letterSpacing))) : 0;
      const contentW = maxTextW + 64;
      const finalW = asset.showBackground ? Math.max(asset.width, contentW) : contentW;
      const totalH = items.length > 0 ? (rowH * items.length) + (10 * (items.length - 1)) : rowH;
      return { baseW: Math.max(1, finalW), baseH: Math.max(1, totalH) };
    }
  };

  const selectionBounds = useMemo(() => {
    const selectedAssets = assets.filter(a => selectedAssetIds.includes(a.id));
    if (selectedAssets.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedAssets.forEach(asset => {
      const bounds = calculateAssetVisualBounds(asset);
      const w = bounds.baseW * (asset.scaleX || 1);
      const h = bounds.baseH * (asset.scaleY || 1);
      minX = Math.min(minX, asset.x);
      minY = Math.min(minY, asset.y);
      maxX = Math.max(maxX, asset.x + w);
      maxY = Math.max(maxY, asset.y + h);
    });
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
    return { left: minX, top: minY, width: Math.max(2, maxX - minX), height: Math.max(2, maxY - minY) };
  }, [assets, selectedAssetIds, fontLoaded, refreshKey]);

  const firstSelectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetIds[0]), [assets, selectedAssetIds]);

  const pushToHistory = (currentState: Asset[]) => {
    setHistory(prev => [JSON.parse(JSON.stringify(currentState)), ...prev].slice(0, 30));
  };

  const undo = () => {
    if (history.length === 0) return;
    const [previousState, ...rest] = history;
    setAssets(previousState);
    setHistory(rest);
  };

  const updateAsset = (id: string, patch: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const updateSelectedAssets = (patch: Partial<Asset>) => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    setAssets(prev => prev.map(a => selectedAssetIds.includes(a.id) ? { ...a, ...patch } : a));
  };

  const alignSelectedAssets = (alignment: 'left' | 'h-center' | 'right' | 'top' | 'v-center' | 'bottom' | 'h-dist' | 'v-dist') => {
    if (selectedAssetIds.length < 2 || !selectionBounds) return;
    pushToHistory(assets);
    setAssets(prev => {
      const targets = prev.filter(a => selectedAssetIds.includes(a.id));
      const others = prev.filter(a => !selectedAssetIds.includes(a.id));
      let newTargets = [...targets];
      switch (alignment) {
        case 'left': newTargets = targets.map(a => ({ ...a, x: selectionBounds.left })); break;
        case 'h-center':
          const centerX = selectionBounds.left + selectionBounds.width / 2;
          newTargets = targets.map(a => {
            const b = calculateAssetVisualBounds(a);
            return { ...a, x: centerX - (b.baseW * a.scaleX) / 2 };
          });
          break;
        case 'right':
          newTargets = targets.map(a => {
            const b = calculateAssetVisualBounds(a);
            return { ...a, x: selectionBounds.left + selectionBounds.width - (b.baseW * a.scaleX) };
          });
          break;
        case 'top': newTargets = targets.map(a => ({ ...a, y: selectionBounds.top })); break;
        case 'v-center':
          const centerY = selectionBounds.top + selectionBounds.height / 2;
          newTargets = targets.map(a => {
            const b = calculateAssetVisualBounds(a);
            return { ...a, y: centerY - (b.baseH * a.scaleY) / 2 };
          });
          break;
        case 'bottom':
          newTargets = targets.map(a => {
            const b = calculateAssetVisualBounds(a);
            return { ...a, y: selectionBounds.top + selectionBounds.height - (b.baseH * a.scaleY) };
          });
          break;
        case 'h-dist':
          const sortedH = [...targets].sort((a, b) => a.x - b.x);
          if (sortedH.length > 2) {
            const totalW = sortedH.reduce((acc, a) => acc + (calculateAssetVisualBounds(a).baseW * a.scaleX), 0);
            const gap = (selectionBounds.width - totalW) / (sortedH.length - 1);
            let currentX = selectionBounds.left;
            newTargets = sortedH.map(a => {
              const res = { ...a, x: currentX };
              currentX += (calculateAssetVisualBounds(a).baseW * a.scaleX) + gap;
              return res;
            });
          }
          break;
        case 'v-dist':
          const sortedV = [...targets].sort((a, b) => a.y - b.y);
          if (sortedV.length > 2) {
            const totalH = sortedV.reduce((acc, a) => acc + (calculateAssetVisualBounds(a).baseH * a.scaleY), 0);
            const gap = (selectionBounds.height - totalH) / (sortedV.length - 1);
            let currentY = selectionBounds.top;
            newTargets = sortedV.map(a => {
              const res = { ...a, y: currentY };
              currentY += (calculateAssetVisualBounds(a).baseH * a.scaleY) + gap;
              return res;
            });
          }
          break;
      }
      return [...others, ...newTargets];
    });
  };

  const groupSelected = () => {
    if (selectedAssetIds.length < 2) return;
    pushToHistory(assets);
    const newGroupId = `group-${Date.now()}`;
    setAssets(prev => prev.map(a => selectedAssetIds.includes(a.id) ? { ...a, groupId: newGroupId } : a));
  };

  const ungroupSelected = () => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    setAssets(prev => prev.map(a => selectedAssetIds.includes(a.id) ? { ...a, groupId: undefined } : a));
  };

  const duplicateSelected = () => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    const selectedAssets = assets.filter(a => selectedAssetIds.includes(a.id));
    const newAssets = selectedAssets.map(a => ({
      ...a,
      id: `${a.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: a.x + 20, y: a.y + 20, name: `${a.name} (複本)`
    }));
    setAssets(prev => [...prev, ...newAssets]);
    setSelectedAssetIds(newAssets.map(a => a.id));
  };

  const deleteSelected = () => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    setAssets(prev => prev.filter(a => !selectedAssetIds.includes(a.id)));
    setSelectedAssetIds([]);
  };

  const handleAssetMouseDown = (e: React.MouseEvent, id: string) => {
    if (currentCropIndex !== null) return;
    e.stopPropagation();
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    let targetGroupIds = [id];
    if (asset.groupId) {
      targetGroupIds = assets.filter(a => asset.groupId === a.groupId).map(a => a.id);
    }

    let nextSelectedIds: string[];
    if (e.shiftKey) {
      nextSelectedIds = Array.from(new Set([...selectedAssetIds, ...targetGroupIds]));
    } else {
      if (selectedAssetIds.includes(id)) {
        nextSelectedIds = selectedAssetIds;
      } else {
        nextSelectedIds = targetGroupIds;
      }
    }

    setSelectedAssetIds(nextSelectedIds);
    setLastClickedId(id);

    const startX = e.clientX;
    const startY = e.clientY;

    let dragTargets = assets.filter(a => nextSelectedIds.includes(a.id));
    let initialPos = dragTargets.reduce((acc, a) => ({ ...acc, [a.id]: { x: a.x, y: a.y } }), {} as any);
    let hasDuplicatedDuringDrag = false;

    const onMove = (me: MouseEvent) => {
      const dx = (me.clientX - startX) / previewScale;
      const dy = (me.clientY - startY) / previewScale;

      if (me.altKey && !hasDuplicatedDuringDrag && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasDuplicatedDuringDrag = true;
        pushToHistory(assets);
        const newClones = dragTargets.map(a => ({
          ...a, id: `${a.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${a.name} (複本)`
        }));
        const newIds = newClones.map(c => c.id);
        initialPos = newClones.reduce((acc, c, i) => ({ ...acc, [c.id]: { x: dragTargets[i].x, y: dragTargets[i].y } }), {} as any);
        setSelectedAssetIds(newIds);
        setAssets(prev => {
          const clonedWithOffset = newClones.map(c => ({ ...c, x: initialPos[c.id].x + dx, y: initialPos[c.id].y + dy }));
          return [...prev, ...clonedWithOffset];
        });
        return;
      }
      setAssets(prev => prev.map(a => initialPos[a.id] ? { ...a, x: initialPos[a.id].x + dx, y: initialPos[a.id].y + dy } : a));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTransformMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectionBounds) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialBounds = { ...selectionBounds };
    const selectedAssets = assets.filter(a => selectedAssetIds.includes(a.id));
    const initialStates = selectedAssets.map(a => ({
      id: a.id, x: a.x, y: a.y, scaleX: a.scaleX, scaleY: a.scaleY, width: a.width,
      relX: (a.x - initialBounds.left) / initialBounds.width,
      relY: (a.y - initialBounds.top) / initialBounds.height
    }));
    const onMove = (me: MouseEvent) => {
      let dx = (me.clientX - startX) / previewScale;
      let dy = (me.clientY - startY) / previewScale;
      let newLeft = initialBounds.left, newTop = initialBounds.top, newWidth = initialBounds.width, newHeight = initialBounds.height;
      if (handle.includes('e')) newWidth = Math.max(1, initialBounds.width + dx);
      if (handle.includes('w')) { const delta = Math.min(initialBounds.width - 1, dx); newWidth = initialBounds.width - delta; newLeft = initialBounds.left + delta; }
      if (handle.includes('s')) newHeight = Math.max(1, initialBounds.height + dy);
      if (handle.includes('n')) { const delta = Math.min(initialBounds.height - 1, dy); newHeight = initialBounds.height - delta; newTop = initialBounds.top + delta; }
      if (me.shiftKey && handle.length === 2) {
        const ratio = initialBounds.width / initialBounds.height;
        if (newWidth / newHeight > ratio) { newWidth = newHeight * ratio; if (handle.includes('w')) newLeft = initialBounds.left + (initialBounds.width - newWidth); }
        else { newHeight = newWidth / ratio; if (handle.includes('n')) newTop = initialBounds.top + (initialBounds.height - newHeight); }
      }
      const factorX = newWidth / initialBounds.width;
      const factorY = newHeight / initialBounds.height;
      setAssets(prev => prev.map(a => {
        const initial = initialStates.find(i => i.id === a.id);
        if (!initial) return a;
        const isHorizontalOnly = handle === 'e' || handle === 'w';
        return {
          ...a, x: newLeft + (initial.relX * newWidth), y: newTop + (initial.relY * newHeight),
          scaleX: isHorizontalOnly ? initial.scaleX : Math.max(0.01, initial.scaleX * factorX),
          scaleY: isHorizontalOnly ? initial.scaleY : Math.max(0.01, initial.scaleY * factorY),
          width: isHorizontalOnly ? Math.max(10, initial.width * factorX) : a.width
        };
      }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleMainMouseDown = (e: React.MouseEvent) => {
    if (currentCropIndex !== null) return;
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      const startX = e.clientX, startY = e.clientY, initialPan = { ...panOffset };
      const onMove = (me: MouseEvent) => setPanOffset({ x: initialPan.x + (me.clientX - startX), y: initialPan.y + (me.clientY - startY) });
      const onUp = () => { setIsPanning(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    } else if (e.button === 0) {
      if (e.ctrlKey) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const startXScreen = e.clientX, startYScreen = e.clientY;
        const startXCanvas = (startXScreen - rect.left) / previewScale;
        const startYCanvas = (startYScreen - rect.top) / previewScale;

        const onMove = (me: MouseEvent) => {
          const currentXCanvas = (me.clientX - rect.left) / previewScale;
          const currentYCanvas = (me.clientY - rect.top) / previewScale;
          setMarquee({
            x: Math.min(startXCanvas, currentXCanvas),
            y: Math.min(startYCanvas, currentYCanvas),
            width: Math.abs(currentXCanvas - startXCanvas),
            height: Math.abs(currentYCanvas - startYCanvas)
          });
        };
        const onUp = (me: MouseEvent) => {
          const currentXCanvas = (me.clientX - rect.left) / previewScale;
          const currentYCanvas = (me.clientY - rect.top) / previewScale;
          const finalRect = {
            x: Math.min(startXCanvas, currentXCanvas),
            y: Math.min(startYCanvas, currentYCanvas),
            width: Math.abs(currentXCanvas - startXCanvas),
            height: Math.abs(currentYCanvas - startYCanvas)
          };

          if (isPulloutSelecting && pulloutSourceId) {
            const source = assets.find(a => a.id === pulloutSourceId);
            if (source && source.type === 'image' && finalRect.width > 20 && finalRect.height > 20) {
              // Calculate relative crop
              // Note: this is a simplified version, ideally we'd use a real cropping tool or complex canvas logic
              // For now, we just create a clone and suggest the user to use the recrop tool or we can try to automate it if we have the original data
              const newId = `pullout-${Date.now()}`;
              const zoomAsset: Asset = {
                ...JSON.parse(JSON.stringify(source)),
                id: newId,
                name: `拉字放大 (${source.name})`,
                x: finalRect.x,
                y: finalRect.y,
                scaleX: (finalRect.width / source.baseW) * 2, // Double the size of selection for 'zoom' effect
                scaleY: (finalRect.height / source.baseH) * 2,
                showStroke: true,
                strokeWidth: 8,
                theme: 'urgent' as CGTheme
              };
              // Note: Professional implementation would involve actual image cropping here.
              // We'll trigger the crop tool for the new asset with the selected area if possible.
              setAssets(prev => [...prev, zoomAsset]);
              setSelectedAssetIds([newId]);
              setIsPulloutSelecting(false);
              setPulloutSourceId(null);

              alert("已建立放大區塊，您可以進一步使用「重新裁切」來精確調整顯示範圍。");
            }
          } else {
            const foundIds = assets.filter(a => {
              if (!a.visible) return false;
              const b = calculateAssetVisualBounds(a);
              const aw = b.baseW * a.scaleX, ah = b.baseH * a.scaleY;
              return a.x < finalRect.x + finalRect.width && a.x + aw > finalRect.x &&
                a.y < finalRect.y + finalRect.height && a.y + ah > finalRect.y;
            }).map(a => a.id);
            setSelectedAssetIds(foundIds);
          }
          setMarquee(null);
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      } else {
        setSelectedAssetIds([]);
        setLastClickedId(null);
      }
    }
  };

  const handleLayerClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    const getGroupIds = (assetId: string) => {
      const asset = assets.find(a => a.id === assetId);
      if (asset?.groupId) {
        return assets.filter(a => a.groupId === asset.groupId).map(a => a.id);
      }
      return [assetId];
    };

    if (isShift && lastClickedId) {
      const displayAssets = assets.slice().reverse();
      const startIdx = displayAssets.findIndex(a => a.id === lastClickedId);
      const endIdx = displayAssets.findIndex(a => a.id === id);
      const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
      const rangeAssets = displayAssets.slice(min, max + 1);

      const newSelection = new Set<string>();
      rangeAssets.forEach(a => {
        getGroupIds(a.id).forEach(gid => newSelection.add(gid));
      });
      setSelectedAssetIds(Array.from(newSelection));
    } else if (isCtrl) {
      const groupIds = getGroupIds(id);
      setSelectedAssetIds(prev => {
        const isAlreadySelected = prev.includes(id);
        if (isAlreadySelected) {
          return prev.filter(pid => !groupIds.includes(pid));
        } else {
          return Array.from(new Set([...prev, ...groupIds]));
        }
      });
      setLastClickedId(id);
    } else {
      setSelectedAssetIds(getGroupIds(id));
      setLastClickedId(id);
    }
  };

  const addNewTitle = () => {
    pushToHistory(assets);
    const baseId = Date.now(), fontSize = 64, commonH = fontSize * HEIGHT_FACTOR;
    const textAsset: Asset = {
      id: `text-${baseId}`, type: 'title', text: '主標題文字內容', x: 560, y: 80, scaleX: 1, scaleY: 1, baseW: 800, baseH: commonH,
      opacity: 1, bgOpacity: 1, name: '標題圖層', visible: true, font: "'Noto Sans TC', sans-serif", size: fontSize, theme: 'default',
      width: 800, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 4
    };
    setAssets(prev => [...prev, textAsset]);
    setSelectedAssetIds([textAsset.id]);
    setLastClickedId(textAsset.id);
  };

  const addNewContent = () => {
    pushToHistory(assets);
    const baseId = Date.now(), fontSize = 32, commonH = fontSize * HEIGHT_FACTOR;
    const textAsset: Asset = {
      id: `text-c-${baseId}`, type: 'content', items: ['重點摘要項目 01'], x: 560, y: 180, scaleX: 1, scaleY: 1, baseW: 800, baseH: commonH,
      opacity: 1, bgOpacity: 1, name: '摘要圖層', visible: true, font: "'Noto Sans TC', sans-serif", size: fontSize, theme: 'default',
      width: 800, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 2
    };
    setAssets(prev => [...prev, textAsset]);
    setSelectedAssetIds([textAsset.id]);
    setLastClickedId(textAsset.id);
  };

  const addNewBlock = () => {
    pushToHistory(assets);
    const baseId = Date.now();
    const blockAsset: Asset = {
      id: `block-${baseId}`, type: 'block', x: 560, y: 490, scaleX: 1, scaleY: 1, baseW: 800, baseH: 100,
      opacity: 1, bgOpacity: 1, name: '裝飾色塊', visible: true, font: "'Noto Sans TC', sans-serif", size: 64, theme: 'default',
      width: 800, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0
    };
    setAssets(prev => [...prev, blockAsset]);
    setSelectedAssetIds([blockAsset.id]);
    setLastClickedId(blockAsset.id);
  };

  const addNewStamp = () => {
    pushToHistory(assets);
    const baseId = Date.now();
    const stampAsset: Asset = {
      id: `stamp-${baseId}`, type: 'stamp', text: '獨家', x: 800, y: 400, scaleX: 1, scaleY: 1, baseW: 300, baseH: 200,
      opacity: 1, bgOpacity: 1, name: '蓋章', visible: true, font: "'Noto Sans TC', sans-serif", size: 64, theme: 'urgent',
      width: 300, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0,
      rotation: -5, stampShape: 'explosion'
    };
    setAssets(prev => [...prev, stampAsset]);
    setSelectedAssetIds([stampAsset.id]);
    setLastClickedId(stampAsset.id);
  };

  const applyMultifunctionLayout = (type: 'double' | 'triple' | 'profile' | 'pullout') => {
    pushToHistory(assets);
    const baseId = Date.now();
    const groupName = type === 'double' ? '雙框' : type === 'triple' ? '三框' : type === 'profile' ? '小檔案' : '文章拉字';
    const mainGroupId = `${groupName}-${baseId}`;
    let decorationAssets: Asset[] = [];
    let imageAssets: Asset[] = [];
    let textAssets: Asset[] = [];

    const createGroup = (index: number, x: number, w: number, prefix: string) => {
      const assetUniqueId = `${baseId}-${index}`;

      // 1. 頂部裝飾條 (回復原始位置 Y: 0-100)
      const topBar: Asset = {
        id: `block-top-${assetUniqueId}`, type: 'block', x, y: 0, scaleX: 1, scaleY: 1, baseW: w, baseH: 100,
        opacity: 1, bgOpacity: 1.0, name: `${prefix}裝飾條 ${index + 1}`, visible: true, font: "", size: 0, theme: 'default',
        width: w, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0, groupId: mainGroupId
      };

      // 2. 標題區域 (移動到畫面約 1/2 高度, Y: 580, 左右內縮 150px)
      const title: Asset = {
        id: `title-${assetUniqueId}`, type: 'title', text: `${prefix}標題 ${index + 1}`, x: x + 150, y: 580, scaleX: 1, scaleY: 1, baseW: w - 300, baseH: 100,
        opacity: 1, bgOpacity: 1, name: `${prefix}標題 ${index + 1}`, visible: true, font: "'Noto Sans TC', sans-serif", size: 56, theme: 'default',
        width: w - 300, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0
      };

      // 3. 摘要區域 (移動到 1/2 高度下方, Y: 680, 左右內縮 150px)
      const content: Asset = {
        id: `content-${assetUniqueId}`, type: 'content', items: [`${prefix}摘要項目內容`], x: x + 150, y: 680, scaleX: 1, scaleY: 1, baseW: w - 300, baseH: 200,
        opacity: 1, bgOpacity: 1, name: `${prefix}摘要 ${index + 1}`, visible: true, font: "'Noto Sans TC', sans-serif", size: 32, theme: 'default',
        width: w - 300, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0
      };

      // 4. 圖片區域 (回復原始位置 Y: 100-700)
      const img: Asset = {
        id: `img-${assetUniqueId}`, type: 'image', x, y: 100, scaleX: 1, scaleY: 1, baseW: w, baseH: 600,
        opacity: 1, bgOpacity: 1.0, name: `${prefix}圖片 ${index + 1}`, visible: true, font: "", size: 0, theme: 'default',
        width: w, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, groupId: mainGroupId
      };

      return { topBar, img, title, content };
    };

    if (type === 'double') {
      const w = 960;
      const g1 = createGroup(0, 0, w, "雙框");
      const g2 = createGroup(1, 960, w, "雙框");
      decorationAssets = [g1.topBar, g2.topBar];
      imageAssets = [g1.img, g2.img];
      textAssets = [g1.title, g1.content, g2.title, g2.content];
    } else if (type === 'triple') {
      const w = 640;
      const g1 = createGroup(0, 0, w, "三框");
      const g2 = createGroup(1, 640, w, "三框");
      const g3 = createGroup(2, 1280, w, "三框");

      // 最左邊標題與摘要往內 30px
      g1.title.x += 30;
      g1.title.width -= 30;
      g1.title.baseW -= 30;
      g1.content.x += 30;
      g1.content.width -= 30;
      g1.content.baseW -= 30;

      // 最右邊標題與摘要往內 30px (從右側縮排)
      g3.title.width -= 30;
      g3.title.baseW -= 30;
      g3.content.width -= 30;
      g3.content.baseW -= 30;

      decorationAssets = [g1.topBar, g2.topBar, g3.topBar];
      imageAssets = [g1.img, g2.img, g3.img];
      textAssets = [g1.title, g1.content, g2.title, g2.content, g3.title, g3.content];
    } else if (type === 'profile' || type === 'pullout') {
      const w = 960; // 1920 / 2
      const prefix = type === 'profile' ? "小檔案" : "文章拉字";

      if (type === 'profile') {
        // 設定底圖 (依需求自動載入指定底圖)
        setBgImageUrl('https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/%E5%B0%8F%E6%AA%94%E6%A1%88%E5%BA%95%E5%9C%9600.png');

        const uniqueId = `${baseId}-profile`;

        // 1. 最上面大標題字
        const mainTitle: Asset = {
          id: `title-main-${uniqueId}`, type: 'title', text: `${prefix} 大標題`, x: 260, y: 70, scaleX: 1, scaleY: 1, baseW: 1400, baseH: 100,
          opacity: 1, bgOpacity: 1, name: `${prefix}大標題`, visible: true, font: "'Noto Sans TC', sans-serif", size: 80, theme: 'default',
          width: 1400, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, autoWrap: false, layoutType: 'profile'
        };

        // 2. 左側置入圖片
        const leftImg: Asset = {
          id: `img-l-${uniqueId}`, type: 'image', x: 74, y: 242, scaleX: 1, scaleY: 1, baseW: 818, baseH: 597,
          opacity: 1, bgOpacity: 1.0, name: `${prefix}圖片`, visible: true, font: "", size: 0, theme: 'default',
          width: 818, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, groupId: mainGroupId, layoutType: 'profile'
        };

        // 3. 右側有一組小標題配上內文 (可多組)
        const rightTitle1: Asset = {
          id: `title-r1-${uniqueId}`, type: 'title', text: `生平`, x: 978, y: 240, scaleX: 1, scaleY: 1, baseW: 800, baseH: 60,
          opacity: 1, bgOpacity: 1, name: `${prefix}小標題1`, visible: true, font: "'Noto Sans TC', sans-serif", size: 50, theme: 'default',
          width: 800, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, autoWrap: false, layoutType: 'profile'
        };
        const rightContent1: Asset = {
          id: `content-r1-${uniqueId}`, type: 'content', items: ["1999 年出生於英國布里斯托", "2019 年加入 McLaren 一級方程式車隊", "以穩定節奏、雨戰能力與冷靜駕駛聞名\n新世代車手的代表人物"], x: 978, y: 320, scaleX: 1, scaleY: 1, baseW: 800, baseH: 150,
          opacity: 1, bgOpacity: 1, name: `${prefix}內文1`, visible: true, font: "'Noto Sans TC', sans-serif", size: 36, theme: 'default',
          width: 800, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, autoWrap: true, layoutType: 'profile'
        };

        const rightTitle2: Asset = {
          id: `title-r2-${uniqueId}`, type: 'title', text: `榮耀`, x: 978, y: 520, scaleX: 1, scaleY: 1, baseW: 800, baseH: 60,
          opacity: 1, bgOpacity: 1, name: `${prefix}小標題2`, visible: true, font: "'Noto Sans TC', sans-serif", size: 50, theme: 'default',
          width: 800, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, autoWrap: false, layoutType: 'profile'
        };
        const rightContent2: Asset = {
          id: `content-r2-${uniqueId}`, type: 'content', items: ["2025 年 F1 世界冠軍", "多次分站冠軍、年終積分榜長期名列前段", "打破 McLaren 近年冠軍荒的重要車手\n媒體票選最具人氣車手之一"], x: 978, y: 600, scaleX: 1, scaleY: 1, baseW: 800, baseH: 150,
          opacity: 1, bgOpacity: 1, name: `${prefix}內文2`, visible: true, font: "'Noto Sans TC', sans-serif", size: 36, theme: 'default',
          width: 800, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, autoWrap: true, layoutType: 'profile'
        };

        decorationAssets = [];
        imageAssets = [leftImg];
        textAssets = [mainTitle, rightTitle1, rightContent1, rightTitle2, rightContent2];
      } else {
        // ... pullout logic remains mostly the same, moving it inside the else block
        // 左側 (圖片區 - 回復原始位置)
        const leftUniqueId = `${baseId}-left`;
        const leftTopBar: Asset = {
          id: `block-top-l-${leftUniqueId}`, type: 'block', x: 0, y: 0, scaleX: 1, scaleY: 1, baseW: w, baseH: 100,
          opacity: 1, bgOpacity: 1.0, name: `${prefix}左裝飾條`, visible: true, font: "", size: 0, theme: 'default',
          width: w, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0, groupId: mainGroupId
        };
        const leftImg: Asset = {
          id: `img-l-${leftUniqueId}`, type: 'image', x: 0, y: 100, scaleX: 1, scaleY: 1, baseW: w, baseH: 600,
          opacity: 1, bgOpacity: 1.0, name: `${prefix}圖片`, visible: true, font: "", size: 0, theme: 'default',
          width: w, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0, groupId: mainGroupId
        };

        // 右側 (文字區 - 移動到畫面約 1/2 高度, 左右內縮 15px)
        const rightUniqueId = `${baseId}-right`;
        const rightTopBar: Asset = {
          id: `block-top-r-${rightUniqueId}`, type: 'block', x: w, y: 0, scaleX: 1, scaleY: 1, baseW: w, baseH: 100,
          opacity: 1, bgOpacity: 1.0, name: `${prefix}右裝飾條`, visible: true, font: "", size: 0, theme: 'default',
          width: w, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0, groupId: mainGroupId
        };
        const rightMidBar: Asset = {
          id: `block-mid-r-${rightUniqueId}`, type: 'block', x: w, y: 100, scaleX: 1, scaleY: 1, baseW: w, baseH: 600,
          opacity: 1, bgOpacity: 0.6, name: `${prefix}右內底`, visible: true, font: "", size: 0, theme: 'default',
          width: w, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0, groupId: mainGroupId
        };
        const rightTitle: Asset = {
          id: `title-r-${rightUniqueId}`, type: 'title', text: `${prefix}主要標題`, x: w + 150, y: 480, scaleX: 1, scaleY: 1, baseW: w - 300, baseH: 100,
          opacity: 1, bgOpacity: 1, name: `${prefix}標題`, visible: true, font: "'Noto Sans TC', sans-serif", size: 60, theme: 'default',
          width: w - 300, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0
        };
        const rightContent: Asset = {
          id: `content-r-${rightUniqueId}`, type: 'content', items: ["項目內容列表 01", "項目內容列表 02"], x: w + 150, y: 580, scaleX: 1, scaleY: 1, baseW: w - 300, baseH: 200,
          opacity: 1, bgOpacity: 1, name: `${prefix}摘要`, visible: true, font: "'Noto Sans TC', sans-serif", size: 36, theme: 'default',
          width: w - 300, letterSpacing: 0, borderRadius: 0, showBackground: true, showStroke: false, strokeWidth: 0
        };

        decorationAssets = [leftTopBar, rightTopBar, rightMidBar];
        imageAssets = [leftImg];
        textAssets = [rightTitle, rightContent];
      }
    }

    const combinedAssets = [...decorationAssets, ...imageAssets, ...textAssets];
    setAssets(prev => [...prev, ...combinedAssets]);
    setSelectedAssetIds(combinedAssets.map(a => a.id));
    setLastClickedId(combinedAssets[0].id);
  };

  const addLogo = () => {
    alert("請選擇一張圖片作為 Logo，建議使用去背 PNG 檔。");
    fileInputRef.current?.click();
    // After selection, we should ideally position it at top-right. 
    // This logic relies on handleFileSelect -> addImagesFromFiles.
    // We can intercept the next image add to position it, but for simplicity, allow user to drag it.
    // Or we can modify addImagesFromFiles to check a flag? 
    // Let's just use the file input for now and maybe advise user.
    // Actually, distinct 'Logo' button implies specific position.
    // Let's rely on standard image add for now but create a 'Logo' layer via code if we had a default logo.
    // Since we don't have a default logo file, opening file picker is best.
  };

  const handleCropComplete = (croppedBase64: string, w: number, h: number) => {
    if (currentCropIndex === null) return;
    const current = pendingCropImages[currentCropIndex];
    pushToHistory(assets);

    if (current.id || replacingAssetId) {
      const targetId = current.id || replacingAssetId || '';
      // 如果是替換現有圖層，我們只更新圖片內容，不改變它在畫面上已經排好的大小
      updateAsset(targetId, { src: croppedBase64, originalSrc: current.src });
      setReplacingAssetId(null);
    } else {
      const baseId = Date.now() + currentCropIndex;
      const imgAsset: Asset = {
        id: `img-${baseId}`, type: 'image', src: croppedBase64, originalSrc: current.src, x: 960 - (w / 2), y: 540 - (h / 2), scaleX: 1, scaleY: 1, baseW: w, baseH: h,
        opacity: 1, bgOpacity: 1, name: `裁切圖片 (${current.name})`, visible: true, font: "", size: 0, theme: 'default',
        width: w, letterSpacing: 0, borderRadius: 0, showBackground: false, showStroke: false, strokeWidth: 0
      };

      const maxW = 1000;
      if (imgAsset.baseW > maxW) {
        const ratio = maxW / imgAsset.baseW;
        imgAsset.scaleX = ratio;
        imgAsset.scaleY = ratio;
      }
      setAssets(prev => [...prev, imgAsset]);
      setSelectedAssetIds([imgAsset.id]);
    }

    if (currentCropIndex < pendingCropImages.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
    } else {
      setPendingCropImages([]);
      setCurrentCropIndex(null);
    }
  };

  const addImagesFromFiles = async (files: FileList) => {
    const imagesToProcess: { src: string, name: string, id?: string, aspect?: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      let targetAspect: number | undefined = undefined;
      if (replacingAssetId) {
        const asset = assets.find(a => a.id === replacingAssetId);
        if (asset) targetAspect = asset.baseW / asset.baseH;
      }

      imagesToProcess.push({ src: base64, name: file.name, id: replacingAssetId || undefined, aspect: targetAspect });
    }
    if (imagesToProcess.length > 0) {
      setPendingCropImages(imagesToProcess);
      setCurrentCropIndex(0);
    }
  };

  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBgImageUrl(event.target?.result as string);
        setIsBgPanelOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addImagesFromFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files) addImagesFromFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleExportPng = async () => {
    if (!canvasRef.current || isExporting) return;
    try {
      setIsExporting(true);
      await document.fonts.ready;
      const canvas = await html2canvas(canvasRef.current!, {
        backgroundColor: null, scale: 2, width: 1920, height: 1080, useCORS: true, logging: false,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('.safety-overlay, .marquee-box, .transform-handle, .marquee-drag').forEach(u => (u as HTMLElement).style.display = 'none');
          const target = clonedDoc.querySelector('[data-id="canvas-main-container"]') as HTMLElement;
          if (target) { target.style.transform = 'none'; target.style.left = '0'; target.style.top = '0'; target.style.margin = '0'; target.style.background = 'transparent'; }

          clonedDoc.querySelectorAll('[data-id="canvas-main-container"] span').forEach(span => {
            const el = span as HTMLElement;
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            if (!isNaN(fontSize)) {
              el.style.transform = `translateY(${-0.38 * fontSize}px)`;
            }
          });
        }
      });
      const link = document.createElement('a');
      link.download = `NewsCG_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error('Export failed:', e); }
    finally { setIsExporting(false); setRefreshKey(prev => prev + 1); }
  };

  const handleSaveProjectInitiate = useCallback(() => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    setSaveModalName(`NewsCG_Project_${timestamp}`);
    setIsSaveModalOpen(true);
    setTimeout(() => saveInputRef.current?.focus(), 100);
  }, []);

  const executeSaveProject = useCallback(() => {
    try {
      const finalName = saveModalName.trim() || `NewsCG_Project_${Date.now()}`;
      const projectData = JSON.stringify(assets, null, 2);
      const blob = new Blob([projectData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.href = url;
      link.download = `${finalName}.json`;
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsSaveModalOpen(false);
    } catch (err) {
      console.error("Save failed:", err);
      alert("儲存專案失敗。");
    }
  }, [assets, saveModalName]);

  const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          pushToHistory(assets);
          setAssets(data);
          setSelectedAssetIds([]);
          setLastClickedId(null);
        } else {
          alert("無效的專案檔案格式");
        }
      } catch (err) {
        alert("讀取專案檔案失敗");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [assets]);



  const handleWheel = (e: React.WheelEvent) => {
    if (currentCropIndex !== null) return;
    setPreviewScale(Math.min(Math.max(previewScale + (-e.deltaY * 0.001), 0.05), 5));
  };
  const resetView = () => { setPreviewScale(0.45); setPanOffset({ x: 0, y: 0 }); setRefreshKey(prev => prev + 1); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const key = e.key.toLowerCase(), isCtrl = e.ctrlKey || e.metaKey;
      if (currentCropIndex !== null) {
        if (e.key === 'Escape') { e.preventDefault(); setPendingCropImages([]); setCurrentCropIndex(null); }
        return;
      }
      if (isCtrl && e.shiftKey && key === 's') { e.preventDefault(); handleSaveProjectInitiate(); return; }
      if (isCtrl && e.shiftKey && key === 'o') { e.preventDefault(); projectFileInputRef.current?.click(); return; }
      if (key === 't') { e.preventDefault(); addNewTitle(); }
      if (key === 'c') { e.preventDefault(); addNewContent(); }
      if (key === 'b') { e.preventDefault(); addNewBlock(); }
      if (key === 'i') { e.preventDefault(); fileInputRef.current?.click(); }
      // if (key === 'a') { e.preventDefault(); setIsAiPanelOpen(!isAiPanelOpen); }
      if (key === 'h') {
        e.preventDefault();
        if (e.shiftKey) setSafetyVisible(!safetyVisible);
        else setCanvasBgVisible(!canvasBgVisible);
      }
      if (key === 'r') { e.preventDefault(); resetView(); }
      if (isCtrl && key === 'z') { e.preventDefault(); undo(); }
      if (isCtrl && !e.shiftKey && key === 's') { e.preventDefault(); handleExportPng(); }
      if (isCtrl && key === 'd') { e.preventDefault(); duplicateSelected(); }
      if (isCtrl && key === 'g') { e.preventDefault(); groupSelected(); }
      if (!isCtrl && e.shiftKey && key === 'g') { e.preventDefault(); ungroupSelected(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedAssetIds([]);
        setLastClickedId(null);
        // setIsAiPanelOpen(false); 
        setIsSaveModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assets, selectedAssetIds, canvasBgVisible, safetyVisible, history, previewScale, panOffset, lastClickedId, handleSaveProjectInitiate, currentCropIndex]);

  const handleContentTextChange = (id: string, text: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    updateAsset(id, asset.type === 'content' ? { text, items: text.split('\n').filter(l => l.trim() !== '') } : { text });
  };

  const handleLayerDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    pushToHistory(assets);
    const newAssets = [...assets];
    const [movedAsset] = newAssets.splice(draggedIndex, 1);
    newAssets.splice(targetIndex, 0, movedAsset);
    setAssets(newAssets);
    setDraggedIndex(null);
  };

  const initiateRecrop = () => {
    if (!firstSelectedAsset || firstSelectedAsset.type !== 'image') return;
    const src = firstSelectedAsset.originalSrc || firstSelectedAsset.src || '';
    const aspect = firstSelectedAsset.baseW / (firstSelectedAsset.baseH || 1);
    setPendingCropImages([{ src, name: firstSelectedAsset.name, id: firstSelectedAsset.id, aspect }]);
    setCurrentCropIndex(0);
  };

  const startPulloutSelection = () => {
    if (!firstSelectedAsset || firstSelectedAsset.type !== 'image') return;
    setIsPulloutSelecting(true);
    setPulloutSourceId(firstSelectedAsset.id);
    alert("請在畫面上「按住 Ctrl + 滑鼠左鍵」拖曳出想要放大的範圍。");
  };

  return (
    <div className="flex flex-col h-screen bg-[#080808] text-slate-300 font-sans select-none overflow-hidden" onDrop={handleDrop} onDragOver={handleDragOver}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
      <input type="file" ref={bgFileInputRef} className="hidden" accept="image/*" onChange={handleBgFileSelect} />
      <input type="file" ref={projectFileInputRef} className="hidden" accept="application/json" onChange={handleLoadProject} />

      <div className="h-12 bg-[#1a1a1a] flex items-center px-4 border-b border-white/5 z-[100] gap-4 shadow-xl">
        <div className="flex items-center gap-2 pr-4 border-r border-white/10">
          <span className="text-blue-500 font-black text-sm tracking-tighter uppercase italic">PS News CG Generator</span>
        </div>
        <button onClick={undo} disabled={history.length === 0} className="text-[10px] font-bold text-slate-500 hover:text-white disabled:opacity-20 transition-all">復原 (^Z)</button>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-3 mr-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
              對位框
              {safetyVisible && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={safetyOpacity}
                  onChange={(e) => setSafetyOpacity(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  title={`透明度: ${Math.round(safetyOpacity * 100)}%`}
                />
              )}
              <button
                onClick={() => setSafetyVisible(!safetyVisible)}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${safetyVisible ? 'bg-blue-600' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${safetyVisible ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-600 font-black uppercase tracking-tighter">
            <span className="bg-white/5 px-2 py-1 rounded">T: 標題</span>
            <span className="bg-white/5 px-2 py-1 rounded">C: 摘要</span>
            <span className="bg-white/5 px-2 py-1 rounded">B: 色塊</span>
            <span className="bg-white/5 px-2 py-1 rounded">I: 圖片</span>
          </div>
          <button onClick={handleExportPng} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-sm font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isExporting ? '處理中...' : '導出成品 PNG (^S)'}</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-[56px] bg-[#1a1a1a] border-r border-black flex flex-col items-center py-4 gap-4 z-[100] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-2 items-center">
            <div className="text-[8px] font-black text-slate-600 uppercase mb-1">基礎</div>
            <ToolIcon icon="T" onClick={addNewTitle} label="標題 (T)" />
            <ToolIcon icon="C" onClick={addNewContent} label="摘要 (C)" />
            <ToolIcon icon="B" onClick={addNewBlock} label="色塊 (B)" />
            <ToolIcon icon="💥" onClick={addNewStamp} label="蓋章 (S)" />
            <ToolIcon icon="🖼️" onClick={() => fileInputRef.current?.click()} label="上傳圖片 (I)" />
            <ToolIcon icon="🌌" active={isBgPanelOpen} onClick={() => setIsBgPanelOpen(!isBgPanelOpen)} label="裝飾底圖" />
          </div>

          <div className="w-8 h-px bg-white/10" />

          <div className="flex flex-col gap-2 items-center">
            <div className="text-[8px] font-black text-slate-600 uppercase mb-1 text-center">多功能</div>
            <ToolIcon icon="♊" onClick={() => applyMultifunctionLayout('double')} label="雙框" />
            <ToolIcon icon="♋" onClick={() => applyMultifunctionLayout('triple')} label="三框" />
            <ToolIcon icon="📝" onClick={() => applyMultifunctionLayout('profile')} label="小檔案" />
            <ToolIcon icon="🔍" onClick={() => applyMultifunctionLayout('pullout')} label="文章拉字" />
          </div>

          <div className="w-8 h-px bg-white/10" />

          <ToolIcon icon="💾" onClick={handleSaveProjectInitiate} label="儲存專案 (Ctrl+Shift+S)" />
          <ToolIcon icon="📂" onClick={() => projectFileInputRef.current?.click()} label="開啟專案 (Ctrl+Shift+O)" />

          <div className="w-8 h-px bg-white/10" />
          <ToolIcon icon="🎯" onClick={resetView} label="重置視角 (R)" />
        </aside>

        <main onWheel={handleWheel} onMouseDown={handleMainMouseDown} className={`flex-1 bg-[#0f0f0f] relative overflow-hidden flex items-center justify-center ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}>
          {currentCropIndex !== null && pendingCropImages[currentCropIndex] ? (
            <CropModal
              image={pendingCropImages[currentCropIndex].src}
              targetAspect={pendingCropImages[currentCropIndex].aspect}
              onConfirm={handleCropComplete}
              onCancel={() => { setPendingCropImages([]); setCurrentCropIndex(null); setReplacingAssetId(null); }}
            />
          ) : (
            <div
              ref={canvasRef}
              data-id="canvas-main-container"
              className="relative shrink-0 shadow-[0_0_120px_rgba(0,0,0,1)] transition-all"
              style={{
                width: '1920px',
                height: '1080px',
                overflow: 'hidden',
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${previewScale})`,
                transformOrigin: 'center center',
                backgroundColor: isExporting ? 'transparent' : (canvasBgVisible ? '#2a2a2a' : '#ffffff'),
                backgroundImage: (!canvasBgVisible && !isExporting) ? `
                  linear-gradient(45deg, #e5e5e5 25%, transparent 25%), 
                  linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #e5e5e5 75%), 
                  linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)
                ` : 'none',
                backgroundSize: '20px 20px'
              }}
            >
              {bgImageUrl && (
                <img
                  src={bgImageUrl}
                  alt="Background"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                  style={{ zIndex: 0 }}
                />
              )}
              {assets.map((asset, index) => asset.visible && (
                <div key={asset.id}
                  onMouseDown={(e) => handleAssetMouseDown(e, asset.id)}
                  onDoubleClick={(e) => {
                    if (asset.type === 'image') {
                      setReplacingAssetId(asset.id);
                      fileInputRef.current?.click();
                    }
                  }}
                  className="absolute flex items-start justify-start cursor-move group/asset"
                  style={{
                    left: `${asset.x}px`, top: `${asset.y}px`, width: `${calculateAssetVisualBounds(asset).baseW}px`, height: `${calculateAssetVisualBounds(asset).baseH}px`,
                    transform: `scale(${asset.scaleX || 1}, ${asset.scaleY || 1})`, transformOrigin: 'left top', zIndex: 10 + index, opacity: asset.opacity, overflow: 'visible'
                  }}>
                  <CGPreview
                    data={asset as any}
                    mode={asset.type === 'title' ? 'title' : asset.type === 'block' ? 'title' : 'content'}
                    isSelected={selectedAssetIds.includes(asset.id)}
                    hasGlobalBg={!!bgImageUrl}
                  />
                </div>
              ))}
              {safetyVisible && !isExporting && <SafetyGuides opacity={safetyOpacity} />}
              {marquee && (
                <div className="absolute marquee-drag border border-blue-400 bg-blue-500/10 z-[8500]" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />
              )}
              {selectionBounds && !isExporting && (
                <div className="absolute marquee-box z-[8000] border-2 border-blue-500"
                  style={{ left: selectionBounds.left, top: selectionBounds.top, width: selectionBounds.width, height: selectionBounds.height, pointerEvents: 'none' }}>
                  {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => (
                    <div key={h} onMouseDown={(e) => handleTransformMouseDown(e, h)} className={`absolute transform-handle w-3.5 h-3.5 bg-white border-2 border-blue-600 shadow-lg z-[8001] pointer-events-auto
                      ${h === 'nw' ? 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize' : ''}
                      ${h === 'n' ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-n-resize' : ''}
                      ${h === 'ne' ? 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize' : ''}
                      ${h === 'e' ? 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-e-resize' : ''}
                      ${h === 'se' ? 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize' : ''}
                      ${h === 's' ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize' : ''}
                      ${h === 'sw' ? 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize' : ''}
                      ${h === 'w' ? 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-w-resize' : ''}`} />
                  ))}
                </div>
              )}
            </div>
          )}


        </main>

        {isBgPanelOpen && (
          <div className="absolute left-[70px] top-[140px] w-80 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-[200] p-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">裝飾底圖選擇 (Background)</h3>
              <button onClick={() => setIsBgPanelOpen(false)} className="text-slate-600 hover:text-white transition-colors">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { name: '關閉背景', url: null, thumb: '✖️' },
                { name: '曲線', url: 'https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-(%E6%9B%B2%E7%B7%9A).jpg' },
                { name: '斜方格-凹凸', url: 'https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-(%E6%96%9C%E6%96%B9%E6%A0%BC-%E5%87%B9%E5%87%B8).jpg' },
                { name: '斜方格', url: 'https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-(%E6%96%9C%E6%96%B9%E6%A0%BC).jpg' },
                { name: '凹凸方格', url: 'https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-(%E5%87%B9%E5%87%B8%E6%96%B9%E6%A0%BC).jpg' }
              ].map((bg, idx) => (
                <button
                  key={idx}
                  onClick={() => { setBgImageUrl(bg.url); setIsBgPanelOpen(false); }}
                  className={`relative aspect-[16/9] rounded-md border-2 overflow-hidden transition-all group ${bgImageUrl === bg.url ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-white/5 hover:border-white/20'}`}
                >
                  {bg.url ? (
                    <img src={bg.url} alt={bg.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black/40 text-xl">{bg.thumb}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1 px-2 text-[8px] font-bold text-slate-300 truncate">
                    {bg.name}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => bgFileInputRef.current?.click()}
              className="w-full py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-md text-[9px] font-black uppercase tracking-widest text-blue-400 transition-all flex items-center justify-center gap-2"
            >
              📤 上傳自定義底圖
            </button>
          </div>
        )}

        <aside className="w-[340px] bg-[#1a1a1a] border-l border-black flex flex-col z-[100] shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-8">
            {firstSelectedAsset ? (
              <div className="space-y-6">
                {selectedAssetIds.length >= 2 && (
                  <div className="space-y-4 pb-6 border-b border-white/5">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>對齊工具 (Align)</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <AlignButton onClick={() => alignSelectedAssets('left')} label="置左" /><AlignButton onClick={() => alignSelectedAssets('h-center')} label="居中" /><AlignButton onClick={() => alignSelectedAssets('right')} label="置右" /><AlignButton onClick={() => alignSelectedAssets('h-dist')} label="均分" />
                    </div>
                  </div>
                )}

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">視覺主題 (Theme)</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(Object.keys(THEMES) as CGTheme[]).map(t => (
                      <button key={t} onClick={() => updateSelectedAssets({ theme: t })} className={`h-8 rounded-sm border transition-all ${firstSelectedAsset.theme === t ? 'border-blue-500 ring-1 ring-blue-500' : 'border-white/10 bg-white/5'}`}>
                        <div className={`w-full h-full bg-gradient-to-br ${THEMES[t].primary}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {(firstSelectedAsset.type === 'title' || firstSelectedAsset.type === 'content' || firstSelectedAsset.type === 'stamp') && (
                  <div className="space-y-4">
                    <PropertySlider label="文字大小" value={firstSelectedAsset.size} min={12} max={300} unit="px" onChange={v => updateSelectedAssets({ size: v })} />
                    <textarea className="w-full bg-[#0a0a0a] border border-white/5 rounded px-3 py-2 text-[12px] h-32 outline-none text-slate-100" value={firstSelectedAsset.text || (firstSelectedAsset.items?.join('\n'))} onChange={e => handleContentTextChange(firstSelectedAsset.id, e.target.value)} />
                  </div>
                )}

                {firstSelectedAsset.type === 'image' && (
                  <div className="flex flex-col gap-2">
                    <button onClick={initiateRecrop} className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-sm text-[9px] font-black uppercase tracking-widest text-blue-400">重新裁切 (Recrop)</button>
                    <button onClick={startPulloutSelection} className="w-full py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 rounded-sm text-[9px] font-black uppercase tracking-widest text-orange-400">區域拉字 (Pull-out Zoom)</button>
                  </div>
                )}

                <PropertySlider label="旋轉角度" value={firstSelectedAsset.rotation || 0} min={-180} max={180} unit="°" onChange={v => updateSelectedAssets({ rotation: v })} />

                {firstSelectedAsset.type === 'stamp' && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">印章形狀 (Shape)</div>
                    <div className="flex gap-2">
                      <button onClick={() => updateSelectedAssets({ stampShape: 'explosion' })} className={`flex-1 py-2 rounded-sm text-[10px] uppercase font-bold ${firstSelectedAsset.stampShape === 'explosion' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500'}`}>爆炸 (Explosion)</button>
                      <button onClick={() => updateSelectedAssets({ stampShape: 'box' })} className={`flex-1 py-2 rounded-sm text-[10px] uppercase font-bold ${firstSelectedAsset.stampShape === 'box' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500'}`}>方框 (Box)</button>
                    </div>
                  </div>
                )}

                <PropertySlider label="整體透明度" value={firstSelectedAsset.opacity * 100} min={0} max={100} unit="%" onChange={v => updateSelectedAssets({ opacity: v / 100 })} />
              </div>
            ) : <div className="py-24 text-center opacity-30 text-[9px] font-black uppercase tracking-widest">選取圖層</div>}
          </div>
          <div className="mt-auto flex flex-col bg-[#141414] border-t border-black min-h-[300px]">
            <div className="h-9 flex items-center px-4 bg-[#1a1a1a] text-[9px] font-black text-slate-500 border-b border-black uppercase tracking-widest">圖層管理 (Layers)</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
              {(() => {
                const renderedGroups = new Set<string>();
                const reversedAssets = [...assets].reverse();
                return reversedAssets.map((a) => {
                  if (a.groupId) {
                    if (renderedGroups.has(a.groupId)) return null;
                    renderedGroups.add(a.groupId);

                    const groupAssets = assets.filter(item => item.groupId === a.groupId);
                    const isCollapsed = collapsedGroups.includes(a.groupId);
                    const groupTitle = a.groupId.split('-')[0] || "群組";
                    const isGroupSelected = groupAssets.every(ga => selectedAssetIds.includes(ga.id));
                    const isAnyGroupSelected = groupAssets.some(ga => selectedAssetIds.includes(ga.id));

                    return (
                      <div key={a.groupId} className="border-b border-black/10">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            const groupIds = groupAssets.map(ga => ga.id);
                            setSelectedAssetIds(groupIds);
                            setLastClickedId(groupIds[0]);
                          }}
                          className={`h-11 flex items-center px-4 cursor-pointer group/folder transition-colors ${isAnyGroupSelected ? 'bg-blue-600/10' : 'hover:bg-white/5'}`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedGroups(prev =>
                                isCollapsed ? prev.filter(id => id !== a.groupId) : [...prev, a.groupId]
                              );
                            }}
                            className="mr-3 text-[10px] w-4 h-4 flex items-center justify-center opacity-40 hover:opacity-100 transition-transform duration-200"
                            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}
                          >
                            ▼
                          </button>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="text-yellow-600">📁</span> {groupTitle}
                          </span>
                          <div className="ml-auto flex items-center gap-2 opacity-0 group-hover/folder:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const isAllVisible = groupAssets.every(ga => ga.visible);
                                groupAssets.forEach(ga => updateAsset(ga.id, { visible: !isAllVisible }));
                              }}
                              className="text-xs opacity-60 hover:opacity-100"
                              title="群組顯示/隱藏"
                            >
                              {groupAssets.every(ga => ga.visible) ? '👁️' : '🕶️'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                pushToHistory(assets);
                                setAssets(prev => prev.filter(item => item.groupId !== a.groupId));
                                setSelectedAssetIds([]);
                              }}
                              className="text-[10px] text-slate-600 hover:text-red-500"
                              title="刪除群組"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        {!isCollapsed && (
                          <div className="bg-black/30">
                            {groupAssets.slice().reverse().map(ga => (
                              <div
                                key={ga.id}
                                onClick={(e) => handleLayerClick(ga.id, e)}
                                className={`h-10 flex items-center pl-10 pr-4 border-b border-black/10 cursor-pointer group transition-colors ${selectedAssetIds.includes(ga.id) ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : 'hover:bg-white/5'}`}
                              >
                                <button onClick={(e) => { e.stopPropagation(); updateAsset(ga.id, { visible: !ga.visible }); }} className={`mr-4 text-xs ${ga.visible ? 'opacity-60' : 'opacity-20'}`}>{ga.visible ? '👁️' : '🕶️'}</button>
                                <span className="text-[9px] font-bold text-slate-500 truncate uppercase tracking-tight">{ga.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); setSelectedAssetIds([ga.id]); deleteSelected(); }} className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-slate-600 hover:text-red-500">🗑️</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={a.id} onClick={(e) => handleLayerClick(a.id, e)} className={`h-11 flex items-center px-4 border-b border-black/10 cursor-pointer group transition-colors ${selectedAssetIds.includes(a.id) ? 'bg-blue-600/15 border-l-2 border-l-blue-500' : 'hover:bg-white/5'}`}>
                      <button onClick={(e) => { e.stopPropagation(); updateAsset(a.id, { visible: !a.visible }); }} className={`mr-4 text-xs ${a.visible ? 'opacity-60' : 'opacity-20'}`}>{a.visible ? '👁️' : '🕶️'}</button>
                      <span className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight">{a.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedAssetIds([a.id]); deleteSelected(); }} className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-slate-600 hover:text-red-500">🗑️</button>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const AlignButton = ({ onClick, label }: any) => <button onClick={onClick} className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm text-[8px] font-black uppercase tracking-widest flex items-center justify-center">{label}</button>;
const ToolIcon = ({ active, icon, onClick, label }: any) => <button onClick={onClick} title={label} className={`w-10 h-10 flex items-center justify-center rounded-sm transition-all ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' : 'text-slate-600 hover:text-slate-300'}`}><span className="text-base font-bold">{icon}</span></button>;
const PropertySlider = ({ label, value, min, max, unit, onChange }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-tighter"><span>{label}</span><span className="text-blue-500">{Math.round(value || 0)}{unit}</span></div>
    <input type="range" min={min} max={max} value={value || 0} onChange={e => onChange(parseFloat(e.target.value))} className="w-full cursor-pointer" />
  </div>
);

export default App;
