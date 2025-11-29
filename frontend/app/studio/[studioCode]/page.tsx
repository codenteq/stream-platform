'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import StudioSession from '@/components/StudioSession';
import { fetchWithAuth } from '@/lib/utils';

export default function StudioPage() {
  const params = useParams();
  const studioCode = params.studioCode as string;
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<'host' | 'guest'>('guest');
  const [showGuestJoin, setShowGuestJoin] = useState(false);
  const [guestName, setGuestName] = useState('');

  const livekitServerUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;

  useEffect(() => {
    if (!studioCode) return;

    const fetchToken = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ room: studioCode }),
        });

        if (response.ok) {
          const data = await response.json();
          setToken(data.token);
          setRole('host');
        } else if (response.status === 401) {
          // Unauthorized, treat as guest
          setToken(null);
          setRole('guest');
          setShowGuestJoin(true);
        } else {
          alert('LiveKit token alınamadı.');
        }
      } catch (error: any) {
        console.error('Failed to fetch LiveKit token:', error);
        setToken(null);
        setRole('guest');
        setShowGuestJoin(true);
      }
    };

    fetchToken();
  }, [studioCode]);

  const handleGuestJoin = async () => {
    if (!guestName.trim()) return;

    try {
      const response = await fetch('/api/public/join-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioCode, name: guestName }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setRole('guest');
        setShowGuestJoin(false);
      } else {
        alert('Misafir girişi başarısız.');
      }
    } catch (error) {
      console.error('Guest join failed:', error);
      alert('Misafir girişi sırasında hata oluştu.');
    }
  };

  if (!token && role === 'host') {
    // Loading state for host
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p>Stüdyoya bağlanılıyor...</p>
      </div>
    );
  }

  if (showGuestJoin) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
          <h2 className="text-2xl font-bold mb-4 text-center">Stüdyoya Katıl</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Adınız</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500"
                placeholder="Adınızı girin"
              />
            </div>
            <button
              onClick={handleGuestJoin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
            >
              Katıl
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If token is null but role is guest, StudioSession handles the join flow
  if (!livekitServerUrl) return null;

  return <StudioSession token={token || ''} serverUrl={livekitServerUrl} studioCode={studioCode} initialRole={role} />;
}