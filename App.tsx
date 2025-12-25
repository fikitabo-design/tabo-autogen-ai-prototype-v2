
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Asset, AssetType, Platform } from './types';
import { PLATFORMS } from './constants';
import { generateAssetMetadata } from './services/geminiService';
import { AssetItem } from './components/AssetItem';
import { UserGuide } from './components/UserGuide';

type AIEngine = 'gemini' | 'groq';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [platform, setPlatform] = useState<Platform>('Shutterstock');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showGuide, setShowGuide] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  
  const [activeEngine, setActiveEngine] = useState<AIEngine>(() => {
    return (localStorage.getItem('tabo_engine') as AIEngine) || 'gemini';
  });
  const [groqKey, setGroqKey] = useState<string>(() => localStorage.getItem('tabo_groq_key') || '');

  // 1. Persistence & Startup Checks
  useEffect(() => {
    const checkKeys = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasGeminiKey(selected);
      }
    };
    checkKeys();

    const savedAssets = localStorage.getItem('autometagen_pipeline');
    if (savedAssets) {
      try {
        const parsed = JSON.parse(savedAssets);
        setAssets(parsed.map((a: any) => ({ ...a, file: new File([], a.name) })));
      } catch (e) {
        console.error("Failed to restore pipeline", e);
      }
    }
  }, []);

  useEffect(() => {
    const dataToSave = assets.map(({ file, previewUrl, ...rest }) => rest);
    localStorage.setItem('autometagen_pipeline', JSON.stringify(dataToSave));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('tabo_engine', activeEngine);
  }, [activeEngine]);

  useEffect(() => {
    localStorage.setItem('tabo_groq_key', groqKey);
  }, [groqKey]);

  // 2. Connectivity & PWA
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleSelectGeminiKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasGeminiKey(true); // Assume success per instructions
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
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

  const runGeneration = async (targetAsset: Asset) => {
    if (!navigator.onLine) {
      setAssets(prev => prev.map(a => a.id === targetAsset.id ? { ...a, status: 'error', error: 'No internet connection' } : a));
      return;
    }

    try {
      const metadata = await generateAssetMetadata(targetAsset, platform, {
        engine: activeEngine,
        groqKey: groqKey
      });
      setAssets((prev) => prev.map(a => a.id === targetAsset.id ? { ...a, status: 'success', metadata } : a));
    } catch (error: any) {
       console.error(error);
       if (error?.message?.includes('entity was not found') || error?.status === 404) {
          setHasGeminiKey(false);
          setAssets(prev => prev.map(a => a.id === targetAsset.id ? { ...a, status: 'error', error: 'Gemini Key Invalid. Please re-select.' } : a));
       } else {
          setAssets((prev) => prev.map(a => a.id === targetAsset.id ? { ...a, status: 'error', error: error?.message || 'AI Engine Error' } : a));
       }
    }
  };

  const handleGenerateAll = async () => {
    if (isGenerating) return;
    
    // Key validation
    if (activeEngine === 'gemini' && !hasGeminiKey) {
      handleSelectGeminiKey();
      return;
    }
    if (activeEngine === 'groq' && groqKey.length < 10) {
      alert("Please enter a valid Groq API Key first.");
      return;
    }

    if (!navigator.onLine) {
      alert("AI Generation requires an active internet connection.");
      return;
    }
    
    const pendingAssets = assets.filter(a => a.status !== 'success');
    if (pendingAssets.length === 0) return;

    setIsGenerating(true);
    setAssets(prev => prev.map(a => 
      pendingAssets.find(pa => pa.id === a.id) ? { ...a, status: 'pending', error: undefined } : a
    ));

    const BATCH_SIZE = 5;
    for (let i = 0; i < pendingAssets.length; i += BATCH_SIZE) {
      const batch = pendingAssets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(asset => runGeneration(asset)));
    }

    setIsGenerating(false);
  };

  const removeAsset = (id: string) => {
    setAssets(prev => {
      const asset = prev.find(a => a.id === id);
      if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  const wipePipeline = () => {
    if (window.confirm("Clear all assets from pipeline?")) {
      assets.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
      setAssets([]);
      localStorage.removeItem('autometagen_pipeline');
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
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const successCount = assets.filter(a => a.status === 'success').length;

  return (
    <div 
      className="min-h-screen p-4 sm:p-12 max-w-5xl mx-auto flex flex-col gap-8 relative pb-32"
      onDragEnter={() => setIsDraggingGlobally(true)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingGlobally(false);
        if (e.dataTransfer.files) addAssetsFromFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />

      <button 
        onClick={() => setShowGuide(true)}
        className="fixed top-6 right-6 z-[150] w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/10 shadow-xl group"
      >
        <span className="text-lg font-black group-hover:scale-125 transition-transform">?</span>
      </button>

      {!isOnline && (
        <div className="fixed top-0 left-0 w-full bg-yellow-500 text-black text-[10px] font-black uppercase py-2 text-center z-[200] tracking-[0.3em] flex items-center justify-center gap-2">
          Offline Mode • Manual editing & export enabled
        </div>
      )}

      {isDraggingGlobally && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-3xl flex items-center justify-center pointer-events-none border-[12px] border-dashed border-white/20 m-6 rounded-[56px]">
          <h2 className="text-6xl font-[900] text-white uppercase tracking-tighter animate-pulse text-center px-10">DROP UNLIMITED ASSETS</h2>
        </div>
      )}

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 glass p-10 rounded-[40px] shadow-2xl border-white/10 relative overflow-hidden mt-4">
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
               <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-black text-white/40 tracking-[0.3em] uppercase">User Key Pipeline</p>
                {deferredPrompt && (
                  <button onClick={handleInstallClick} className="text-[8px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-blue-500/20">Install App</button>
                )}
               </div>
             </div>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-full lg:w-auto">
            <button onClick={() => setActiveEngine('gemini')} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeEngine === 'gemini' ? 'bg-white text-black' : 'text-white/30 hover:text-white/50'}`}>Gemini</button>
            <button onClick={() => setActiveEngine('groq')} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeEngine === 'groq' ? 'bg-white text-black' : 'text-white/30 hover:text-white/50'}`}>Groq</button>
          </div>
          
          <div className="w-full lg:w-auto min-w-[240px]">
            {activeEngine === 'gemini' ? (
              <div className="flex items-center gap-2 bg-black/20 p-2 rounded-xl border border-white/5">
                <div className={`w-2 h-2 rounded-full animate-pulse ${hasGeminiKey ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest flex-1">
                  {hasGeminiKey ? 'Gemini Active (User Key)' : 'No Gemini Key Detected'}
                </span>
                <button 
                  onClick={handleSelectGeminiKey}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-black text-white uppercase rounded-md border border-white/10 transition-colors"
                >
                  {hasGeminiKey ? 'Change Key' : 'Activate Key'}
                </button>
              </div>
            ) : (
              <div className="relative group">
                <input 
                  type="password" 
                  value={groqKey} 
                  onChange={(e) => setGroqKey(e.target.value)} 
                  placeholder="Enter Personal Groq API Key"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] text-white focus:outline-none w-full focus:border-white/30 transition-all placeholder:text-white/10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                   <div className={`w-1.5 h-1.5 rounded-full ${groqKey.length > 10 ? 'bg-green-500' : 'bg-white/10'}`} />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass p-10 rounded-[40px] space-y-10 shadow-xl border border-white/5">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block">Marketplace Target</label>
              {assets.length > 0 && (
                <button onClick={wipePipeline} className="text-[9px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest transition-colors">Clear Pipeline</button>
              )}
            </div>
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
          <div className="relative">
            <button 
              onClick={handleGenerateAll} 
              disabled={isGenerating || assets.length === 0 || !isOnline} 
              className="w-full py-6 bg-white text-black rounded-[28px] font-black text-sm uppercase tracking-[0.3em] disabled:opacity-20 shadow-2xl transition-all relative overflow-hidden active:scale-[0.98]"
            >
              <span className="relative z-10">
                {!isOnline ? 'Offline: AI Disabled' : isGenerating ? `Processing...` : `START INFINITE GENERATION • ${assets.length}`}
              </span>
              {isGenerating && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent translate-x-[-100%] animate-[shimmer_1.5s_infinite]" />
              )}
            </button>
          </div>
        </div>

        <div className="glass p-10 rounded-[40px] flex flex-col items-center justify-center text-center relative group overflow-hidden border-2 border-dashed border-white/10 hover:border-white/40 transition-all cursor-pointer">
          <input type="file" multiple onChange={(e) => addAssetsFromFiles(Array.from(e.target.files || []))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          <div className="space-y-6 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto border border-white/10 shadow-inner">
              <svg className="w-10 h-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div>
              <p className="text-[12px] text-white font-black uppercase tracking-[0.2em]">Add Assets</p>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Unlimited Pipeline</p>
            </div>
          </div>
        </div>
      </main>

      <section className="space-y-6">
        <div className="flex justify-between items-end border-b border-white/5 pb-6 px-4">
          <h2 className="text-xs font-black text-white uppercase tracking-[0.4em]">Active Pipeline</h2>
          {successCount > 0 && (
            <button onClick={exportCSV} className="text-[10px] font-black text-white hover:text-green-400 uppercase tracking-[0.3em] transition-all flex items-center gap-2 group bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export {successCount} CSV
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
              onRemove={removeAsset} 
              onRegenerate={() => runGeneration(asset)} 
              onAssetModified={handleAssetModified} 
            />
          ))}
        </div>
      </section>

      <footer className="mt-auto py-16 text-center border-t border-white/5">
        <p className="text-[11px] font-black text-white/5 uppercase tracking-[0.7em]">Autometagen AI • Professional Pipeline • v3.5</p>
      </footer>
    </div>
  );
};

export default App;
