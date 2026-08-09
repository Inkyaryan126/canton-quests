'use client';

import { useState, useEffect, useCallback } from 'react';
import { LocationInfo } from '@/lib/types';
import { checkProximity, formatDistance } from '@/lib/geo';

interface LocationVerifierProps {
  location?: LocationInfo;
  requiredRadiusMeters?: number;
  onLocationVerified?: (userLat: number, userLon: number, isProximityOk: boolean) => void;
}

export default function LocationVerifier({
  location,
  requiredRadiusMeters = 100,
  onLocationVerified,
}: LocationVerifierProps) {
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'acquired' | 'denied' | 'error'>('idle');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const targetLat = location?.latitude;
  const targetLon = location?.longitude;
  const effectiveRadius = location?.radiusMeters || requiredRadiusMeters;

  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('requesting');
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGpsStatus('acquired');

        if (targetLat !== undefined && targetLon !== undefined) {
          const prox = checkProximity({ latitude: lat, longitude: lon }, targetLat, targetLon, effectiveRadius);
          setDistanceMeters(prox.distanceMeters);
          setIsWithinRadius(prox.isWithinRadius);

          if (onLocationVerified) {
            onLocationVerified(lat, lon, prox.isWithinRadius);
          }
        }
      },
      (err) => {
        setGpsStatus('denied');
        setErrorMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. System will allow non-GPS fallback.'
            : 'Unable to acquire satellite lock.'
        );
        if (onLocationVerified) {
          onLocationVerified(0, 0, false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [targetLat, targetLon, effectiveRadius, onLocationVerified]);

  // Auto check on mount if location is available
  useEffect(() => {
    if (navigator.geolocation && gpsStatus === 'idle') {
      requestGeolocation();
    }
  }, [gpsStatus, requestGeolocation]);

  return (
    <div className="p-4 bg-obsidian/90 rounded-2xl border border-cyan-500/30 text-xs font-mono space-y-3 shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-2">
        <span className="text-white font-bold flex items-center gap-1.5">
          📡 GPS Location Proximity Sensor
        </span>
        <button
          type="button"
          onClick={requestGeolocation}
          className="text-[11px] text-cyan-400 hover:underline bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 rounded-full font-bold"
        >
          {gpsStatus === 'requesting' ? 'Scanning...' : '🔄 Refresh GPS'}
        </button>
      </div>

      {gpsStatus === 'requesting' && (
        <div className="flex items-center gap-2 text-amber-400 animate-pulse">
          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          Acquiring satellite signal...
        </div>
      )}

      {gpsStatus === 'acquired' && distanceMeters !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-gray-300">
            <span>Current Distance to Node:</span>
            <span className="font-extrabold text-cyan-400">{formatDistance(distanceMeters)}</span>
          </div>

          <div className="flex items-center justify-between text-gray-400 text-[11px]">
            <span>Required Radius:</span>
            <span>Within {effectiveRadius} meters</span>
          </div>

          {isWithinRadius ? (
            <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/50 rounded-xl text-emerald-300 font-bold flex items-center gap-2">
              <span>✅</span> PROXIMITY CONFIRMED! You are within the {effectiveRadius}m field boundary.
            </div>
          ) : (
            <div className="p-2.5 bg-amber-950/50 border border-amber-500/50 rounded-xl text-amber-300 font-bold space-y-1">
              <div className="flex items-center gap-2">
                <span>⚠️</span> OUTSIDE REQUIRED RADIUS ({formatDistance(distanceMeters)})
              </div>
              <div className="text-[11px] text-gray-300 font-normal">
                Move {formatDistance(distanceMeters - effectiveRadius)} closer to Canton node to verify physical presence.
              </div>
            </div>
          )}
        </div>
      )}

      {(gpsStatus === 'denied' || gpsStatus === 'error') && (
        <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-gray-300 text-[11px] space-y-1">
          <div className="text-amber-400 font-bold">📍 GPS Signal Unavailable</div>
          <div>{errorMessage}</div>
          <div className="text-gray-400 pt-1">
            Note: You can still complete passphrase and QR code quests without mandatory GPS permission.
          </div>
        </div>
      )}
    </div>
  );
}
