
import React, { useEffect, useState, useRef } from 'react';
import { Asset, Platform } from '../types';
import { MAX_TITLE_LENGTH, MAX_DESC_LENGTH, TARGET_KEYWORD_COUNT, SHUTTERSTOCK_CATEGORIES } from '../constants';
import { editImageAsset } from '../services/geminiService';

interface AssetItemProps {
  asset: Asset;
  platform: Platform;
  onUpdate: (id: string, field: keyof Asset['metadata'], value: string) => void;
  onRemove: (id: string) => void;
  onRegenerate: (id: string) => void;
  onAssetModified: (id: string, newUrl: string) => void;
}

export const AssetItem: React.FC<AssetItemProps> = ({
  asset,
  platform,
  onUpdate,
  onRemove,
  onRegenerate,
  onAssetModified,
}) => {
  const [keywordCount, setKeywordCount] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const prevStatusRef = useRef(asset.status);

  useEffect(() => {
    const count = asset.metadata.keywords.split(',').filter((k) => k.trim().length > 0).length;
    setKeywordCount(count);
  }, [asset.metadata.keywords]);

  useEffect(() => {
    if (prevStatusRef.current === 'pending' && asset.status === 'success') {
      titleInputRef.current?.focus();
    }
    prevStatusRef.current = asset.status;
  }, [asset.status]);

  const handleEdit = async () => {
    if (!editPrompt.trim()) return;
    try {
      const newUrl = await editImageAsset(asset, editPrompt);
      onAssetModified(asset.id, newUrl);
      setShowEditor(false);
      setEditPrompt('');
    } catch (err) {
      console.error(err);
      alert("AI Edit failed. Try again.");
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      // Feedback visual selama 2 detik
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const isTeepublic = platform === 'Teepublic';
  const isShutterstock = platform === 'Shutterstock';
  const canEdit = asset.type !== 'Video';

  const CopyIcon = ({ field }: { field: string }) => {
    const isCopied = copiedField === field;
    return (
      <div className={`transition-all duration-300 flex items-center justify-center ${isCopied ? 'text-green-400 scale-125' : 'text-white/20 group-hover:text-white/60'}`}>
        {isCopied ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      asset.status === 'error' ? 'border-red-500/50 bg-red-500/5' : 'border-white/5 bg-white/[0.02]'
    }`}>
      <div className="flex items-start gap-4 mb-6">
        <div className="w-20 h-20 bg-white/5 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center border border-white/10 relative group">
          {asset.previewUrl ? (
            asset.type === 'Video' ? (
              <video src={asset.previewUrl} className="w-full h-full object-cover" />
            ) : (
              <img src={asset.previewUrl} alt={asset.name} className="w-full h-full object-cover" />
            )
          ) : (
             <div className="text-[10px] uppercase font-bold text-white/30">{asset.type}</div>
          )}
          
          {canEdit && (
            <button 
              onClick={() => setShowEditor(!showEditor)}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-black text-white uppercase tracking-tighter"
            >
              AI Magic Edit
            </button>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-white truncate max-w-xs" title={asset.name}>
                {asset.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-black uppercase tracking-widest border border-white/5">
                  {asset.type}
                </span>
                {asset.status === 'pending' && <span className="text-[10px] text-blue-400 animate-pulse font-bold">GENERATING...</span>}
              </div>
            </div>
            
            <div className="flex gap-1">
              <button
                onClick={() => onRegenerate(asset.id)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                title="Regenerate"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button
                onClick={() => onRemove(asset.id)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white/20 hover:text-red-400"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEditor && (
        <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2">
          <label className="text-[10px] text-white/40 font-black uppercase tracking-widest">Nano Banana AI Image Editor</label>
          <div className="flex gap-2">
            <input 
              autoFocus
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="E.g. 'Add a retro filter' or 'Make it a sunset'"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-white focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            />
            <button 
              onClick={handleEdit}
              className="px-4 py-2 bg-white text-black text-[10px] font-black rounded-lg uppercase"
            >
              Magic
            </button>
          </div>
        </div>
      )}

      {asset.status === 'pending' ? (
        <div className="space-y-4">
          <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5 block flex justify-between">
              Title
              <span className={asset.metadata.title.length > MAX_TITLE_LENGTH ? 'text-red-400' : 'text-white/20'}>
                {asset.metadata.title.length}/{MAX_TITLE_LENGTH}
              </span>
            </label>
            <div className="relative group">
              <input
                ref={titleInputRef}
                type="text"
                value={asset.metadata.title}
                onChange={(e) => onUpdate(asset.id, 'title', e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/20 transition-all pr-12"
              />
              <button 
                onClick={() => copyToClipboard(asset.metadata.title, 'title')} 
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Copy Title"
              >
                <CopyIcon field="title" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5 block flex justify-between">
              Description
              <span className={asset.metadata.description.length > MAX_DESC_LENGTH ? 'text-red-400' : 'text-white/20'}>
                {asset.metadata.description.length}/{MAX_DESC_LENGTH}
              </span>
            </label>
            <div className="relative group">
              <textarea
                value={asset.metadata.description}
                onChange={(e) => onUpdate(asset.id, 'description', e.target.value)}
                rows={2}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/20 transition-all resize-none pr-12"
              />
              <button 
                onClick={() => copyToClipboard(asset.metadata.description, 'description')} 
                className="absolute right-2 top-3 p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Copy Description"
              >
                <CopyIcon field="description" />
              </button>
            </div>
          </div>

          {isShutterstock && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5 block">Category 1</label>
                <select
                  value={asset.metadata.category1 || ''}
                  onChange={(e) => onUpdate(asset.id, 'category1', e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/20"
                >
                  <option value="">Select Category</option>
                  {SHUTTERSTOCK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5 block">Category 2</label>
                <select
                  value={asset.metadata.category2 || ''}
                  onChange={(e) => onUpdate(asset.id, 'category2', e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/20"
                >
                  <option value="">Select Category</option>
                  {SHUTTERSTOCK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
          )}

          {isTeepublic && (
            <div>
              <label className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5 block">Main Tag</label>
              <div className="relative group">
                <input
                  type="text"
                  value={asset.metadata.mainTag || ''}
                  onChange={(e) => onUpdate(asset.id, 'mainTag', e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/20 pr-12"
                />
                <button 
                  onClick={() => copyToClipboard(asset.metadata.mainTag || '', 'mainTag')} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-lg transition-colors"
                  title="Copy Main Tag"
                >
                  <CopyIcon field="mainTag" />
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5 block flex justify-between">
              {isTeepublic ? 'Supporting Tags' : 'Keywords (Search Grounded)'}
              <span className={keywordCount !== TARGET_KEYWORD_COUNT ? 'text-yellow-500' : 'text-green-500/70'}>
                {keywordCount} / {TARGET_KEYWORD_COUNT}
              </span>
            </label>
            <div className="relative group">
              <textarea
                ref={textAreaRef}
                value={asset.metadata.keywords}
                onChange={(e) => onUpdate(asset.id, 'keywords', e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/20 transition-all min-h-[100px] pr-12"
              />
              <button 
                onClick={() => copyToClipboard(asset.metadata.keywords, 'keywords')} 
                className="absolute right-2 top-3 p-2 hover:bg-white/5 rounded-lg transition-colors"
                title={isTeepublic ? "Copy Supporting Tags" : "Copy Keywords"}
              >
                <CopyIcon field="keywords" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
