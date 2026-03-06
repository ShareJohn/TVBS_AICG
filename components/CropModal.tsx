
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

interface Point {
  x: number;
  y: number;
}

interface Area {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface CropModalProps {
  image: string;
  onConfirm: (croppedImage: string, width: number, height: number) => void;
  onCancel: () => void;
  targetAspect?: number;
}

export const CropModal: React.FC<CropModalProps> = ({ image, onConfirm, onCancel, targetAspect }) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(targetAspect || 16 / 9);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async () => {
    if (!croppedAreaPixels) return;
    try {
      const img = await createImage(image);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      const base64Image = canvas.toDataURL('image/png');
      onConfirm(base64Image, canvas.width, canvas.height);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="absolute inset-0 z-[500] flex flex-col bg-[#0a0a0a] animate-in fade-in duration-300">
      {/* 裁切工具列 */}
      <div className="bg-[#1a1a1a] px-6 py-3 flex items-center justify-between border-b border-black shadow-lg z-[10]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-blue-500 font-black text-[10px] uppercase tracking-widest italic">Crop Editor</span>
            <div className="w-1 h-1 bg-white/20 rounded-full" />
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">調整影像範圍</span>
          </div>

          {!targetAspect && (
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-sm border border-white/5">
              {[{ v: 16 / 9, l: '16:9' }, { v: 4 / 3, l: '4:3' }, { v: 1 / 1, l: '1:1' }, { v: undefined, l: 'FREE' }].map(opt => (
                <button
                  key={opt.l}
                  onClick={() => setAspect(opt.v)}
                  className={`px-4 py-1.5 text-[9px] font-black rounded-sm transition-all ${aspect === opt.v ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          )}
          {targetAspect && (
            <div className="px-4 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-sm">
              <span className="text-blue-400 text-[9px] font-black uppercase tracking-widest">鎖定原圖比例 (FIXED)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">取消</button>
          <button onClick={getCroppedImg} className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl rounded-sm active:scale-95 transition-all">確認裁切</button>
        </div>
      </div>

      {/* 裁切畫布 */}
      <div className="relative flex-1">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          zoomWithScroll={true}
          objectFit="contain"
          classes={{
            containerClassName: "cursor-crosshair",
            cropAreaClassName: "border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]"
          }}
        />
      </div>

      {/* 底部控制 */}
      <div className="bg-[#1a1a1a] px-8 py-4 border-t border-black flex items-center justify-center gap-8 z-[10]">
        <div className="flex items-center gap-4 w-full max-w-md">
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Zoom</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.01}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 cursor-pointer"
          />
          <span className="text-[10px] font-black text-blue-500 min-w-[35px]">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
