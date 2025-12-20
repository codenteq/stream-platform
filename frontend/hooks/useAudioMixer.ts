import { useEffect, useRef, useState } from 'react';
import {
    LocalParticipant,
    Room,
    RoomEvent,
    Track,
    RemoteTrack,
    LocalAudioTrack,
    TrackPublication,
    RemoteTrackPublication,
    RemoteParticipant
} from 'livekit-client';

export function useAudioMixer(room: Room | undefined, localParticipant: LocalParticipant | undefined) {
    const [mixedTrack, setMixedTrack] = useState<LocalAudioTrack | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const sourceNodesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());

    // Local mic handling
    const localMicRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        if (!room || !localParticipant) return;

        // Initialize AudioContext
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new AudioContextClass();

        // Resume AudioContext if suspended (browser policy)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const dest = ctx.createMediaStreamDestination();

        audioContextRef.current = ctx;
        destinationRef.current = dest;

        // Publish the mixed track
        // We create a LocalAudioTrack from the destination stream
        const mixedStreamTrack = dest.stream.getAudioTracks()[0];
        const newMixedTrack = new LocalAudioTrack(mixedStreamTrack);

        // Publish it
        // We use a custom source or just 'Unknown' to differentiate
        localParticipant.publishTrack(newMixedTrack, {
            name: 'broadcast-mix',
            source: Track.Source.Unknown, // Important: Don't set as Microphone to avoid confusion
        }).then((pub) => {
            console.log('Published mixed audio track:', pub.trackSid);
            setMixedTrack(newMixedTrack);
        }).catch(e => console.error("Failed to publish mixed track", e));

        return () => {
            newMixedTrack.stop();
            if (localParticipant) {
                // We can't easily unpublish without trackRef, but stopping it stops transmission.
                // Ideally we unpublish: localParticipant.unpublishTrack(newMixedTrack);
            }
            ctx.close();
        };
    }, [room, localParticipant]);

    // Function to add a track to the mix
    const addTrackToMix = (track: Track | RemoteTrack, id: string) => {
        if (!audioContextRef.current || !destinationRef.current) return;

        // If already exists, remove first (fixes mic toggle issue)
        if (sourceNodesRef.current.has(id)) {
            removeTrackFromMix(id);
        }

        if (track.mediaStream) {
            try {
                const source = audioContextRef.current.createMediaStreamSource(track.mediaStream);
                source.connect(destinationRef.current);
                sourceNodesRef.current.set(id, source);
                console.log(`Added track ${id} to mix`);
            } catch (e) {
                console.error("Error adding track to mix", e);
            }
        }
    };

    // Function to remove a track from the mix
    const removeTrackFromMix = (id: string) => {
        const source = sourceNodesRef.current.get(id);
        if (source) {
            source.disconnect();
            sourceNodesRef.current.delete(id);
            console.log(`Removed track ${id} from mix`);
        }
    };

    // Monitor Remote Tracks
    useEffect(() => {
        if (!room) return;

        const handleTrackSubscribed = (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (track.kind === Track.Kind.Audio && track.sid) {
                addTrackToMix(track, track.sid);
            }
        };

        const handleTrackUnsubscribed = (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (track.sid) {
                removeTrackFromMix(track.sid);
            }
        };

        // Subscribe to events
        room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

        // Add existing tracks
        room.remoteParticipants.forEach(p => {
            Array.from(p.trackPublications.values()).forEach(pub => {
                if (pub.kind === Track.Kind.Audio && pub.track && pub.track.sid) {
                    addTrackToMix(pub.track, pub.track.sid);
                }
            });
        });

        return () => {
            room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
            room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        };
    }, [room]);

    // Monitor Local Mic
    useEffect(() => {
        if (!localParticipant) return;

        // We need to wait for local mic to be published
        const handleLocalTrackPublished = (pub: TrackPublication) => {
            if (pub.kind === Track.Kind.Audio && pub.source === Track.Source.Microphone && pub.track) {
                // Add local mic to mix
                addTrackToMix(pub.track, 'local-mic');
            }
        };

        // Check existing
        Array.from(localParticipant.trackPublications.values()).forEach(pub => {
            if (pub.kind === Track.Kind.Audio && pub.source === Track.Source.Microphone && pub.track) {
                addTrackToMix(pub.track, 'local-mic');
            }
        });

        // Listen for new (e.g. if user toggles mute/unmute which stops/starts track?)
        // Actually mute just disables the track, `mediaStream` might stay active or not.
        // Ideally we listen to `LocalTrackPublished`.
        room?.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);

        return () => {
            room?.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
            removeTrackFromMix('local-mic');
        };
    }, [localParticipant, room]);

    return { mixedTrack };
}
