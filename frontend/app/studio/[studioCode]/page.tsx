'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import StudioSession from '@/components/StudioSession';
import { fetchWithAuth } from '@/lib/utils';

export default function StudioPage() {
  const params = useParams();
  const studioCode = params.studioCode as string;
  const [token, setToken] = useState<string | null>(null);

  const livekitServerUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;

  useEffect(() => {
    if (!studioCode) return;

    const fetchToken = async () => {
      try {
        const response = await fetchWithAuth('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: studioCode }),
        });

        if (response.ok) {
          const data = await response.json();
          setToken(data.token);
        } else {
          alert('LiveKit token alınamadı.');
        }
      } catch (error: any) {
        if (!error.message.includes('Session expired')) {
            console.error('Failed to fetch LiveKit token:', error);
            alert('Stüdyoya bağlanırken bir hata oluştu.');
        }
      }
    };

    fetchToken();
  }, [studioCode]);

  if (!token || !livekitServerUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p>Stüdyoya bağlanılıyor...</p>
      </div>
    );
  }

  return <StudioSession token={token} serverUrl={livekitServerUrl} studioCode={studioCode} />;
}