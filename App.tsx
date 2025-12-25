
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Asset, AssetType, Platform } from './types';
import { PLATFORMS } from './constants';
import { generateAssetMetadata } from './services/geminiService';
import { AssetItem } from './components/AssetItem';

type AIEngine = 'gemini' | 'groq';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [platform, setPlatform] = useState<Platform>('Shutterstock');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  const [activeEngine, setActiveEngine] = useState<AIEngine>(() => {
    return (localStorage.getItem('tabo_engine') as AIEngine) || 'gemini';
  });
  const [groqKey, setGroqKey] = useState<string>(() => localStorage.getItem('tabo_groq_key') || '');
  
  const groqFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if app is running in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Sync engine choice to storage
  useEffect(() => {
    localStorage.setItem('tabo_engine', activeEngine);
  }, [activeEngine]);

  // Sync Groq key to storage
  useEffect(() => {
    localStorage.setItem('tabo_groq_key', groqKey);
  }, [groqKey]);

  const detectAssetType = (file: File): AssetType => {
    if (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov)$/i)) return 'Video';
    if (file.type.includes('svg') || file.name.match(/\.svg$/i)) return 'Vector';
    return 'Photo';
  };

  const addAssetsFromFiles = useCallback((files: File[]) => {
    const newAssets: Asset[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      type: detectAssetType(file),
      status: 'idle',
      metadata: { title: '', description: '', keywords: '' },
      previewUrl: file.type.startsWith('image/') || file.type.startsWith('video/') 
        ? URL.createObjectURL(file) 
        : undefined
    }));
    setAssets((prev) => [...prev, ...newAssets]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobally(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget === null) {
      setIsDraggingGlobally(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobally(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addAssetsFromFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processAsset = async (assetId: string) => {
    setAssets((prev) => prev.map(a => a.id === assetId ? { ...a, status: 'pending' } : a));
    const currentAsset = assets.find(a => a.id === assetId);
    if (!currentAsset) return;
    try {
      const metadata = await generateAssetMetadata(currentAsset, platform, {
        engine: activeEngine,
        groqKey: groqKey
      });
      setAssets((prev) => prev.map(a => a.id === assetId ? { ...a, status: 'success', metadata } : a));
    } catch (error) {
       console.error(error);
       setAssets((prev) => prev.map(a => a.id === assetId ? { ...a, status: 'error', error: 'Neural Fault' } : a));
    }
  };

  const handleGenerateAll = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    for (const asset of assets.filter(a => a.status !== 'success')) {
      await processAsset(asset.id);
    }
    setIsGenerating(false);
  };

  const handleAssetModified = useCallback((id: string, newUrl: string) => {
    setAssets((prev) => prev.map(a => a.id === id ? { ...a, previewUrl: newUrl } : a));
  }, []);

  const handleLinkGroqKey = () => {
    groqFileInputRef.current?.click();
  };

  const handleRemoveKey = () => {
    if (activeEngine === 'groq') {
      setGroqKey('');
      localStorage.removeItem('tabo_groq_key');
      alert("Groq Key removed.");
    }
  };

  const handleGroqFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const match = content.match(/gsk_[a-zA-Z0-9]{30,}/);
      if (match) {
        setGroqKey(match[0]);
        alert("Groq Key Linked successfully!");
      } else {
        const firstLine = content.split('\n')[0].trim();
        if (firstLine.length > 20) {
          setGroqKey(firstLine);
          alert("Key linked from file.");
        } else {
          alert("No valid Groq key found in the selected file.");
        }
      }
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    const successAssets = assets.filter(a => a.status === 'success');
    if (successAssets.length === 0) return;
    
    let headers: string[] = ['Filename', 'Description', 'Keywords'];
    if (platform === 'Shutterstock') {
      headers = ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature Content', 'Illustration'];
    } else if (platform === 'Teepublic') {
      headers = ['Filename', 'Title', 'Description', 'Keywords', 'Main Tag'];
    } else if (platform === 'Adobe Stock') {
      headers = ['Filename', 'Title', 'Keywords', 'Category'];
    }

    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const rows = successAssets.map(a => {
      let row: string[] = [];
      if (platform === 'Shutterstock') {
        const cats = [a.metadata.category1, a.metadata.category2].filter(Boolean).join(',');
        row = [esc(a.name), esc(a.metadata.description), esc(a.metadata.keywords), esc(cats), "no", "no", a.type === 'Vector' ? "yes" : "no"];
      } else if (platform === 'Teepublic') {
        row = [esc(a.name), esc(a.metadata.title), esc(a.metadata.description), esc(a.metadata.keywords), esc(a.metadata.mainTag || '')];
      } else if (platform === 'Adobe Stock') {
        row = [esc(a.name), esc(a.metadata.title), esc(a.metadata.keywords), "1"];
      } else {
        row = [esc(a.name), esc(a.metadata.title), esc(a.metadata.description), esc(a.metadata.keywords)];
      }
      return row;
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tabo_autometagen_${platform.toLowerCase().replace(' ', '_')}_${new Date().getTime()}.csv`;
    link.click();
  };

  const isReady = activeEngine === 'gemini' ? true : groqKey.length > 10;
  const hasSuccessfulAssets = assets.some(a => a.status === 'success');

  return (
    <div 
      className="min-h-screen p-4 sm:p-12 max-w-5xl mx-auto flex flex-col gap-8 relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input ref={groqFileInputRef} type="file" accept=".txt,.json,.key" className="hidden" onChange={handleGroqFileChange} />

      {isDraggingGlobally && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-3xl flex items-center justify-center pointer-events-none border-[12px] border-dashed border-white/20 m-6 rounded-[56px] transition-all duration-300">
          <div className="text-center space-y-6 animate-bounce">
            <div className="w-40 h-40 bg-white text-black rounded-full flex items-center justify-center mx-auto shadow-2xl">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3-3m3-3v12" /></svg>
            </div>
            <h2 className="text-6xl font-[900] text-white uppercase tracking-tighter">Release Files</h2>
          </div>
        </div>
      )}
      
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 glass p-10 rounded-[40px] shadow-2xl border-white/10 relative overflow-hidden">
        {isStandalone && (
          <div className="absolute top-0 right-0 p-4">
             <span className="text-[8px] font-black text-green-500/50 uppercase tracking-[0.4em] border border-green-500/20 px-3 py-1 rounded-full">Standalone Mode</span>
          </div>
        )}
        
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
             <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
               <svg className="w-9 h-9 text-black" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                 <path d="M50 5L90 25V75L50 95L10 75V25L50 5Z" stroke="currentColor" strokeWidth="6" />
                 <path d="M30 35H70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
                 <path d="M50 35V75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
               </svg>
             </div>
             <div className="flex flex-col">
               <h1 className="text-4xl sm:text-5xl font-[900] tracking-tighter text-white">TABO <span className="text-white/20">AUTOMETAGEN</span></h1>
               {deferredPrompt && (
                 <button 
                  onClick={handleInstallClick}
                  className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest text-left mt-1 underline decoration-dotted underline-offset-4"
                 >
                   Install App for Offline Use
                 </button>
               )}
             </div>
          </div>
          <div className="flex gap-4 items-center">
            <p className="text-[11px] text-white/30 font-black uppercase tracking-[0.3em]">Advanced Meta Intelligence</p>
            <div className="h-[1px] w-8 bg-white/10" />
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button onClick={() => setActiveEngine('gemini')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeEngine === 'gemini' ? 'bg-white text-black' : 'text-white/30 hover:text-white/50'}`}>Gemini</button>
              <button onClick={() => setActiveEngine('groq')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeEngine === 'groq' ? 'bg-white text-black' : 'text-white/30 hover:text-white/50'}`}>Groq</button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-start lg:items-end gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 p-4 rounded-3xl w-full lg:w-auto min-h-[80px]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${isReady ? 'bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`} />
                <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                  {activeEngine.toUpperCase()} {isReady ? 'Active' : 'Missing Key'}
                </span>
              </div>
              {activeEngine === 'groq' && groqKey && (
                <p className="text-[9px] text-white/30 font-mono tracking-tighter">
                  {groqKey.substring(0, 8)}...{groqKey.substring(groqKey.length - 4)}
                </p>
              )}
              {activeEngine === 'gemini' && (
                <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Cloud System Link</p>
              )}
            </div>

            {activeEngine === 'groq' && (
              <>
                <div className="h-8 w-[1px] bg-white/10 mx-2" />
                <div className="flex items-center gap-2">
                  <button onClick={handleLinkGroqKey} className="flex items-center gap-2 bg-white hover:bg-white/90 text-black px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-xl group">
                    <svg className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-tighter">{groqKey ? 'Change' : 'Link Key'}</span>
                  </button>
                  {groqKey && (
                    <button 
                      onClick={handleRemoveKey}
                      className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20 active:scale-90"
                      title="Remove Connection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass p-10 rounded-[40px] space-y-10 shadow-xl">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Marketplace Target</label>
            <div className="relative">
              <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="w-full bg-black/60 border border-white/10 rounded-3xl px-6 py-5 text-sm text-white focus:outline-none appearance-none cursor-pointer hover:border-white/20 transition-all">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
          <button 
            onClick={handleGenerateAll} 
            disabled={isGenerating || assets.length === 0 || !isReady} 
            className="w-full py-6 bg-white text-black rounded-[28px] font-black text-sm uppercase tracking-[0.3em] disabled:opacity-20 shadow-2xl hover:scale-[1.01] transition-all relative overflow-hidden group"
          >
            <span className="relative z-10">
              {!isReady ? `Link ${activeEngine.toUpperCase()} Key to Start` : isGenerating ? 'Processing Data...' : `Execute Tabo Meta • ${assets.length} items`}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
          </button>
        </div>

        <div className="glass p-10 rounded-[40px] flex flex-col items-center justify-center text-center relative group overflow-hidden border-2 border-dashed border-white/10 hover:border-white/40 transition-all cursor-pointer">
          <input type="file" multiple onChange={(e) => addAssetsFromFiles(Array.from(e.target.files || []))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          <div className="space-y-6 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto border border-white/10 shadow-xl backdrop-blur-md">
              <svg className="w-10 h-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div className="space-y-2">
              <p className="text-[12px] text-white font-black uppercase tracking-[0.2em]">Queue Ingestion</p>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Browse from device</p>
            </div>
          </div>
        </div>
      </main>

      <section className="space-y-6 pb-40">
        <div className="flex justify-between items-end border-b border-white/5 pb-6 px-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-black text-white uppercase tracking-[0.4em]">Active Pipeline</h2>
            <span className="bg-white/10 text-white/60 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">{assets.length} In-Flight</span>
          </div>
          {hasSuccessfulAssets && (
            <button onClick={exportCSV} className="text-[10px] font-black text-white hover:text-green-400 uppercase tracking-[0.3em] transition-all flex items-center gap-2 group animate-in fade-in slide-in-from-right-2">
              <svg className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download CSV
            </button>
          )}
        </div>
        
        {assets.length === 0 && (
          <div className="text-center py-32 border border-white/5 rounded-[48px] bg-white/[0.01]">
            <p className="text-white/20 font-black uppercase tracking-[0.5em] text-[10px]">Neural Stream Offline</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-6">
          {assets.map((asset) => (
            <AssetItem 
              key={asset.id} 
              asset={asset} 
              platform={platform} 
              onUpdate={(id, f, v) => setAssets(prev => prev.map(a => a.id === id ? { ...a, metadata: { ...a.metadata, [f]: v } } : a))} 
              onRemove={(id) => setAssets(prev => prev.filter(a => a.id !== id))} 
              onRegenerate={processAsset} 
              onAssetModified={handleAssetModified} 
            />
          ))}
        </div>
      </section>

      <footer className="mt-auto py-16 text-center border-t border-white/5">
        <p className="text-[11px] font-black text-white/5 uppercase tracking-[0.7em]">Tabo Autometagen Network • Ver 6.0.0</p>
      </footer>
    </div>
  );
};

export default App;
