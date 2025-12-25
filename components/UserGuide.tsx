
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
      title: 'Ingestion',
      desc: 'Seret (Drag & Drop) foto, vektor, atau video Anda langsung ke area pipeline atau gunakan tombol "Add Assets".'
    },
    {
      id: '02',
      title: 'Konfigurasi',
      desc: 'Pilih platform marketplace target (Shutterstock, Adobe Stock, dsb) untuk menyesuaikan format metadata.'
    },
    {
      id: '03',
      title: 'Turbo Execution',
      desc: 'Klik tombol "START INFINITE GENERATION". Sistem akan memproses seluruh aset secara paralel menggunakan AI Gemini 3 Flash.'
    },
    {
      id: '04',
      title: 'Review & AI Magic',
      desc: 'Metadata akan muncul otomatis. Gunakan "AI Magic Edit" pada preview gambar untuk mengubah visual dengan prompt teks.'
    },
    {
      id: '05',
      title: 'Export CSV',
      desc: 'Setelah selesai, klik "Export CSV" untuk mendownload file yang siap diunggah ke portal kontributor masing-masing.'
    }
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-[40px] p-8 sm:p-12 border-white/10 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="mb-10">
          <h2 className="text-3xl font-[900] uppercase tracking-tighter text-white">Panduan Penggunaan</h2>
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mt-2">Mastering the Unlimited Pipeline</p>
        </div>

        <div className="space-y-8">
          {steps.map((step) => (
            <div key={step.id} className="flex gap-6 group">
              <div className="text-2xl font-black text-white/10 group-hover:text-white/40 transition-colors tabular-nums">
                {step.id}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/80 group-hover:text-white transition-colors">
                  {step.title}
                </h3>
                <p className="text-xs text-white/40 leading-relaxed font-medium">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-white/5 rounded-3xl border border-white/10">
          <div className="flex items-center gap-3 text-yellow-500 mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Tips Profesional</span>
          </div>
          <p className="text-[11px] text-white/30 leading-relaxed italic">
            "Aplikasi ini didesain untuk volume besar. Pipeline Anda akan tetap tersimpan secara lokal meskipun browser ditutup. Gunakan fitur 'AI Magic Edit' untuk memodifikasi gambar tanpa keluar dari alur kerja."
          </p>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-10 py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Saya Mengerti
        </button>
      </div>
    </div>
  );
};
