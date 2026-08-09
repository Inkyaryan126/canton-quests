'use client';

import { useState, useEffect } from 'react';
import { GeneratedQR } from '@/lib/types';
import { getEvents, getGeneratedQRs } from '@/lib/game-engine';

export default function PrintableQrSheetPage() {
  const [qrs, setQrs] = useState<GeneratedQR[]>([]);
  const [eventTitle, setEventTitle] = useState<string>('Canton Quest Weekend');

  useEffect(() => {
    const events = getEvents();
    const active = events[0];
    if (active) {
      setEventTitle(active.title);
      setQrs(getGeneratedQRs(active.id));
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-black p-8 font-mono">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">CANTON QUESTS — OFFICIAL FIELD QR SHEET</h1>
          <p className="text-xs text-gray-700 pt-1">Event: {eventTitle} • Generated for Field Deployment</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-black text-white text-xs px-4 py-2 font-bold rounded print:hidden hover:bg-gray-800"
        >
          🖨️ PRINT SHEET
        </button>
      </div>

      {qrs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No generated QR codes found for this event. Generate QR tokens in the Admin QR Studio first.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {qrs.map((qr) => (
            <div key={qr.id} className="border-2 border-black p-4 rounded-lg flex flex-col items-center text-center space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-widest bg-gray-200 px-2 py-0.5 rounded">
                OFFICIAL GAME EMBLEM
              </span>

              {/* QR Simulation Frame */}
              <div className="w-36 h-36 border-4 border-black p-2 flex flex-col items-center justify-center bg-gray-50 font-bold text-xs space-y-1">
                <span className="text-2xl">📱</span>
                <span className="text-[10px] break-all font-mono">{qr.token}</span>
              </div>

              <div className="space-y-1">
                <span className="font-extrabold text-sm block">{qr.label}</span>
                <span className="text-[9px] text-gray-600 block">{qr.targetUrl}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
