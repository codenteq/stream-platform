import { useCallback, useEffect, useRef } from 'react';
import { ConnectionState, RoomEvent, type RemoteParticipant, type Room } from 'livekit-client';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Belirli bir konu (topic) üzerinden JSON mesajlaşma. Geri çağrı ref'te tutulur,
 * böylece `send` her render'da sabit kalır ve abonelik yeniden kurulmaz.
 */
export function useStudioChannel<T = unknown>(room: Room, topic: string, onMessage: (data: T, from?: RemoteParticipant) => void) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const handle = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, msgTopic?: string) => {
      if (msgTopic !== topic) return;
      try {
        handlerRef.current(JSON.parse(decoder.decode(payload)) as T, participant);
      } catch {
        /* geçersiz mesaj */
      }
    };
    room.on(RoomEvent.DataReceived, handle);
    return () => {
      room.off(RoomEvent.DataReceived, handle);
    };
  }, [room, topic]);

  return useCallback(
    async (data: unknown) => {
      if (room.state !== ConnectionState.Connected) return;
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(data)), { reliable: true, topic });
    },
    [room, topic]
  );
}
