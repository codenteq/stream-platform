import { fetchWithAuth } from '@/lib/utils';
import type { Broadcast, CurrentUser, Destination } from '@/lib/types';

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let message = fallback;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* gövde JSON değil */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export const api = {
  me: async () => json<CurrentUser>(await fetchWithAuth('/api/me'), 'Kullanıcı bilgisi alınamadı'),
  updateMe: async (body: { name: string }) =>
    json<CurrentUser>(await fetchWithAuth('/api/me', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) }), 'Profil güncellenemedi'),

  broadcasts: async () => (await json<Broadcast[]>(await fetchWithAuth('/api/broadcasts'), 'Yayınlar getirilemedi')) || [],
  broadcastByStudio: async (code: string) =>
    json<Broadcast>(await fetchWithAuth(`/api/broadcasts/studio/${code}`), 'Yayın bulunamadı'),
  createBroadcast: async (body: Record<string, unknown>) =>
    json<Broadcast>(await fetchWithAuth('/api/broadcasts', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) }), 'Yayın oluşturulamadı'),
  updateBroadcast: async (id: number, body: Record<string, unknown>) =>
    json<Broadcast>(await fetchWithAuth(`/api/broadcasts/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) }), 'Yayın güncellenemedi'),
  deleteBroadcast: async (id: number) =>
    json<void>(await fetchWithAuth(`/api/broadcasts/${id}`, { method: 'DELETE' }), 'Yayın silinemedi'),

  destinations: async () => (await json<Destination[]>(await fetchWithAuth('/api/destinations'), 'Hedefler getirilemedi')) || [],
  createDestination: async (body: Omit<Destination, 'id' | 'created_at'>) =>
    json<Destination>(await fetchWithAuth('/api/destinations', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) }), 'Hedef eklenemedi'),
  updateDestination: async (id: number, body: Omit<Destination, 'id' | 'created_at'>) =>
    json<Destination>(await fetchWithAuth(`/api/destinations/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) }), 'Hedef güncellenemedi'),
  deleteDestination: async (id: number) =>
    json<void>(await fetchWithAuth(`/api/destinations/${id}`, { method: 'DELETE' }), 'Hedef silinemedi'),

  removeParticipant: async (studioCode: string, identity: string) =>
    json<void>(
      await fetchWithAuth(`/api/broadcasts/studio/${studioCode}/participants/remove`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ identity }) }),
      'Katılımcı çıkarılamadı'
    ),
  muteParticipant: async (studioCode: string, identity: string, trackSid: string) =>
    json<void>(
      await fetchWithAuth(`/api/broadcasts/studio/${studioCode}/participants/mute`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ identity, trackSid }) }),
      'Katılımcı sessize alınamadı'
    ),
};

export function studioInviteUrl(studioCode: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || '';
  return `${origin}/studio/${studioCode}`;
}
