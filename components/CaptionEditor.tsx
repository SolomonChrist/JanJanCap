
import React from 'react';
import { Caption, CaptionStyle } from '../types';

interface CaptionEditorProps {
  captions: Caption[];
  setCaptions: (captions: Caption[]) => void;
  style: CaptionStyle;
  setStyle: (style: CaptionStyle) => void;
  currentTime: number;
  onAddCaption: () => void;
  onBulkImport: () => void;
  onSeek?: (time: number) => void;
}

export const CaptionEditor: React.FC<CaptionEditorProps> = ({ 
  captions, 
  setCaptions, 
  style, 
  setStyle,
  currentTime,
  onAddCaption,
  onBulkImport,
  onSeek
}) => {
  const updateCaption = (id: string, field: keyof Caption, value: string | number) => {
    setCaptions(captions.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const deleteCaption = (id: string) => {
    setCaptions(captions.filter(c => c.id !== id));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Styling Section */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Visual Style</h2>
          <button onClick={onBulkImport} className="text-[10px] text-orange-500 hover:text-orange-400 font-bold uppercase transition-colors">Import Logs</button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-[9px] text-white/30 uppercase font-bold">X-Position</label>
                <input type="range" min="0" max="100" value={style.x} onChange={(e) => setStyle({ ...style, x: Number(e.target.value) })} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-orange-500 cursor-pointer" />
             </div>
             <div className="space-y-2">
                <label className="text-[9px] text-white/30 uppercase font-bold">Y-Position</label>
                <input type="range" min="0" max="100" value={style.y} onChange={(e) => setStyle({ ...style, y: Number(e.target.value) })} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-orange-500 cursor-pointer" />
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 uppercase font-bold">Size</label>
              <input type="number" value={style.fontSize} onChange={(e) => setStyle({ ...style, fontSize: Number(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 uppercase font-bold">Padding</label>
              <input type="number" value={style.padding} onChange={(e) => setStyle({ ...style, padding: Number(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 uppercase font-bold">Text Color</label>
              <div className="relative">
                <input type="color" value={style.color} onChange={(e) => setStyle({ ...style, color: e.target.value })} className="w-full h-9 bg-white/5 border border-white/10 rounded-lg cursor-pointer p-1" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 uppercase font-bold">Bg Color</label>
              <div className="relative">
                <input type="color" value={style.backgroundColor} onChange={(e) => setStyle({ ...style, backgroundColor: e.target.value })} className="w-full h-9 bg-white/5 border border-white/10 rounded-lg cursor-pointer p-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Captions Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Timeline Cards</h2>
          <button 
            onClick={onAddCaption}
            className="w-7 h-7 bg-orange-500 hover:bg-orange-400 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 transition-all active:scale-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {captions.length === 0 && (
            <div className="text-center py-12 opacity-30">
              <p className="text-[10px] uppercase tracking-widest italic">No segments added</p>
            </div>
          )}
          {captions.sort((a,b) => a.start - b.start).map((caption) => {
            const isActive = currentTime >= caption.start && currentTime <= caption.end;
            return (
              <div 
                key={caption.id} 
                onClick={() => onSeek && onSeek(caption.start)}
                className={`group p-4 rounded-2xl border transition-all cursor-pointer ${isActive ? 'bg-orange-500/10 border-orange-500/50' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 flex items-center gap-1.5 font-mono text-[9px] text-white/40">
                    <input 
                      type="number" step="0.1"
                      value={caption.start} 
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateCaption(caption.id, 'start', Number(e.target.value))}
                      className="w-12 bg-transparent text-white outline-none"
                    />
                    <span className="opacity-20">—</span>
                    <input 
                      type="number" step="0.1"
                      value={caption.end} 
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateCaption(caption.id, 'end', Number(e.target.value))}
                      className="w-12 bg-transparent text-white outline-none"
                    />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteCaption(caption.id); }} 
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-400 transition-opacity"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <textarea
                  value={caption.text}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateCaption(caption.id, 'text', e.target.value)}
                  className="w-full bg-transparent text-sm resize-none focus:outline-none text-white leading-relaxed placeholder-white/10"
                  rows={2}
                  placeholder="Caption text..."
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
