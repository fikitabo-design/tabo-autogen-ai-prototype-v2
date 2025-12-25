
import React from 'react';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuide: React.FC<UserGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      id: '01',
      title: 'Aktivasi Engine (Wajib)',
      desc: 'Pipeline terkunci secara default. Pilih Gemini atau Groq di header. Gunakan ikon folder (Browse) untuk mengambil API Key langsung dari dashboard Google AI Studio.'
    },
    {
      id: '02',
      title: 'Ingestion Pipeline',
      desc: 'Setelah status "AUTOLOCKED" muncul, area drop aset akan terbuka. Seret foto, vektor, atau video (Unlimited) ke area yang tersedia.'
    },
    {
      id: '03',
      title: 'Targeting Market',
      desc: 'Pilih marketplace tujuan (Shutterstock, Adobe Stock, dll). AI akan menyesuaikan kategori, jumlah keyword, dan batasan karakter secara otomatis.'
    },
    {
      id: '04',
      title: 'Infinite Generation',
      desc: 'Klik tombol "START". Sistem memproses batch secara paralel. Gemini 3 Flash akan menganalisis konten visual untuk akurasi metadata maksimal.'
    },
    {
      id: '05',
      title: 'Final Review & Export',
      desc: 'Review hasil atau gunakan "AI Magic Edit" untuk memodifikasi visual. Export ke CSV yang sudah diformat khusus untuk portal kontributor.'
    }
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="glass max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-[48px] p-8 sm:p-14 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative">
        <button 
          onClick={onClose}
          className="absolute top-10 right-10 text-white/20 hover:text-white transition-all hover:rotate-90 duration-300"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
             <div className="h-1 w-12 bg-white rounded-full"></div>
             <p className="text-[10px] font-[900] text-white/40 uppercase tracking-[0.5em]">System Documentation</p>
          </div>
          <h2 className="text-4xl font-[900] uppercase tracking-tighter text-white leading-tight">Professional Workflow<br/>Autometagen AI</h2>
        </div>

        <div className="space-y-10">
          {steps.map((step) => (
            <div key={step.id} className="flex gap-8 group">
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs font-black text-white/10 group-hover:text-white/60 transition-colors tabular-nums">
                  {step.id}
                </div>
                <div className="w-[1px] flex-1 bg-white/5 group-last:hidden"></div>
              </div>
              <div className="space-y-2 pb-2">
                <h3 className="text-sm font-[900] uppercase tracking-widest text-white/90 group-hover:text-white transition-colors">
                  {step.title}
                </h3>
                <p className="text-[13px] text-white/40 leading-relaxed font-medium group-hover:text-white/60 transition-colors">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 p-8 bg-gradient-to-br from-white/[0.03] to-transparent rounded-[32px] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45l7.5 13.05H4.5L12 5.45zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
          </div>
          <div className="flex items-center gap-3 text-white/80 mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Privacy & Security</span>
          </div>
          <p className="text-[11px] text-white/30 leading-relaxed font-bold uppercase tracking-tight">
            Aplikasi ini bersifat "Client-Side Only". API Key dan data aset Anda hanya tersimpan di LocalStorage browser Anda secara terenkripsi (Local Session). Tabo tidak menyimpan data Anda di server eksternal mana pun.
          </p>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-10 py-6 bg-white text-black rounded-[24px] font-[900] uppercase text-xs tracking-[0.4em] hover:bg-white/90 active:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
        >
          Initialize Pipeline
        </button>
      </div>
    </div>
  );
};
