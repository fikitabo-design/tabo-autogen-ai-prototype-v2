
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
    // Check for PWA standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    // Listen for install prompt
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
    setAssets((prev) => [...newAssets, ...prev]);
  }, []);

  // Improved process function for better concurrency handling
  const runGeneration = async (targetAsset: Asset) => {
    try {
      const metadata = await generateAssetMetadata(targetAsset, platform, {
        engine: activeEngine,
        groqKey: groqKey
      });
      setAssets((prev) => prev.map(a => a.id === targetAsset.id ? { ...a, status: 'success', metadata } : a));
    } catch (error) {
       console.error(error);
       setAssets((prev) => prev.map(a => a.id === targetAsset.id ? { ...a, status: 'error', error: 'Neural Fault' } : a));
    }
  };

  const handleGenerateAll = async () => {
    if (isGenerating) return;
    
    const pendingAssets = assets.filter(a => a.status !== 'success');
    if (pendingAssets.length === 0) return;

    setIsGenerating(true);
    
    // Mark all as pending simultaneously
    setAssets(prev => prev.map(a => 
      pendingAssets.find(pa => pa.id === a.id) 
        ? { ...a, status: 'pending', error: undefined } 
        : a
    ));

    // Execute all generations in parallel (Turbo Mode)
    try {
      await Promise.all(pendingAssets.map(asset => runGeneration(asset)));
    } catch (error) {
      console.error("Turbo generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAssetModified = useCallback((id: string, newUrl: string) => {
    setAssets((prev) => prev.map(a => a.id === id ? { ...a, previewUrl: newUrl, status: 'success' } : a));
  }, []);

  const exportCSV = () => {
    const successAssets = assets.filter(a => a.status === 'success');
    if (successAssets.length === 0) return;
    
    let headers: string[] = ['Filename', 'Description', 'Keywords'];
    if (platform === 'Shutterstock') {
      headers = ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature Content', 'Illustration'];
    } else if (platform === 'Teepublic') {
      headers = ['Filename', 'Title', 'Description', 'Keywords', 'Main Tag'];
    }

    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const rows = successAssets.map(a => {
      let row: string[] = [];
      if (platform === 'Shutterstock') {
        const cats = [a.metadata.category1, a.metadata.category2].filter(Boolean).join(',');
        row = [esc(a.name), esc(a.metadata.description), esc(a.metadata.keywords), esc(cats), "no", "no", a.type === 'Vector' ? "yes" : "no"];
      } else if (platform === 'Teepublic') {
        row = [esc(a.name), esc(a.metadata.title), esc(a.metadata.description), esc(a.metadata.keywords), esc(a.metadata.mainTag || '')];
      } else {
        row = [esc(a.name), esc(a.metadata.title), esc(a.metadata.description), esc(a.metadata.keywords)];
      }
      return row;
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `autometagen_${platform.toLowerCase().replace(' ', '_')}_${new Date().getTime()}.csv`;
    link.click();
  };

  const isReady = activeEngine === 'gemini' ? true : groqKey.length > 10;
  const hasSuccessfulAssets = assets.some(a => a.status === 'success');

  return (
    <div 
      className="min-h-screen p-4 sm:p-12 max-w-5xl mx-auto flex flex-col gap-8 relative"
      onDragEnter={() => setIsDraggingGlobally(true)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingGlobally(false);
        if (e.dataTransfer.files) addAssetsFromFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {isDraggingGlobally && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-3xl flex items-center justify-center pointer-events-none border-[12px] border-dashed border-white/20 m-6 rounded-[56px]">
          <h2 className="text-6xl font-[900] text-white uppercase tracking-tighter animate-bounce">Release Files</h2>
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
             <div className="w-16 h-16 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg">
               <svg className="w-10 h-10 text-black" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                 <path d="M50 5L90 25V75L50 95L10 75V25L50 5Z" stroke="currentColor" strokeWidth="6" />
                 <path d="M30 35H70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
                 <path d="M50 35V75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
               </svg>
             </div>
             <div>
               <h1 className="text-3xl sm:text-4xl font-[900] tracking-tighter text-white leading-none uppercase">Autometagen AI</h1>
               <p className="text-[10px] font-black text-white/40 tracking-[0.3em] uppercase mt-1">By Tabo</p>
               {deferredPrompt && (
                 <button onClick={handleInstallClick} className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest mt-1 underline decoration-dotted">Install Desktop App</button>
               )}
             </div>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            <button onClick={() => setActiveEngine('gemini')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeEngine === 'gemini' ? 'bg-white text-black' : 'text-white/30 hover:text-white/50'}`}>Gemini</button>
            <button onClick={() => setActiveEngine('groq')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeEngine === 'groq' ? 'bg-white text-black' : 'text-white/30 hover:text-white/50'}`}>Groq</button>
          </div>
          {activeEngine === 'groq' && (
            <input 
              type="password" 
              value={groqKey} 
              onChange={(e) => setGroqKey(e.target.value)} 
              placeholder="Paste Groq API Key"
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[10px] text-white focus:outline-none w-48"
            />
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass p-10 rounded-[40px] space-y-10 shadow-xl">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 block">Marketplace Target</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    platform === p 
                    ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' 
                    : 'bg-black/40 text-white/40 border-white/10 hover:border-white/30 hover:text-white/70'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={handleGenerateAll} 
            disabled={isGenerating || assets.length === 0 || !isReady} 
            className="w-full py-6 bg-white text-black rounded-[28px] font-black text-sm uppercase tracking-[0.3em] disabled:opacity-20 shadow-2xl transition-all relative overflow-hidden group"
          >
            <span className="relative z-10">
              {isGenerating ? 'Parallel processing...' : `Execute Turbo Meta • ${assets.length} items`}
            </span>
            {isGenerating && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent translate-x-[-100%] animate-[shimmer_1.5s_infinite]" />
            )}
          </button>
        </div>

        <div className="glass p-10 rounded-[40px] flex flex-col items-center justify-center text-center relative group overflow-hidden border-2 border-dashed border-white/10 hover:border-white/40 transition-all cursor-pointer">
          <input type="file" multiple onChange={(e) => addAssetsFromFiles(Array.from(e.target.files || []))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          <div className="space-y-6 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto border border-white/10">
              <svg className="w-10 h-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div>
              <p className="text-[12px] text-white font-black uppercase tracking-[0.2em]">Queue Ingestion</p>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Browse or Drag Files</p>
            </div>
          </div>
        </div>
      </main>

      <section className="space-y-6 pb-40">
        <div className="flex justify-between items-end border-b border-white/5 pb-6 px-4">
          <h2 className="text-xs font-black text-white uppercase tracking-[0.4em]">Active Pipeline</h2>
          {hasSuccessfulAssets && (
            <button onClick={exportCSV} className="text-[10px] font-black text-white hover:text-green-400 uppercase tracking-[0.3em] transition-all flex items-center gap-2 group">
              <svg className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download CSV
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {assets.map((asset) => (
            <AssetItem 
              key={asset.id} 
              asset={asset} 
              platform={platform} 
              onUpdate={(id, f, v) => setAssets(prev => prev.map(a => a.id === id ? { ...a, metadata: { ...a.metadata, [f]: v } } : a))} 
              onRemove={(id) => setAssets(prev => prev.filter(a => a.id !== id))} 
              onRegenerate={() => runGeneration(asset)} 
              onAssetModified={handleAssetModified} 
            />
          ))}
        </div>
      </section>

      <footer className="mt-auto py-16 text-center border-t border-white/5">
        <p className="text-[11px] font-black text-white/5 uppercase tracking-[0.7em]">Autometagen AI • Powered by Tabo</p>
      </footer>
    </div>
  );
};

export default App;
