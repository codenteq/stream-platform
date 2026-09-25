export type BroadcastStatus = 'draft' | 'scheduled' | 'live' | 'ended';

export interface StreamingTarget {
  id: number;
  broadcast_id: number;
  destination_id?: number | null;
  platform: string;
  name?: string;
  rtmp_url: string;
  stream_key: string;
  egress_id?: string;
}

export interface Destination {
  id: number;
  platform: string;
  name: string;
  rtmp_url: string;
  stream_key: string;
  created_at: string;
}

export interface Broadcast {
  id: number;
  title: string;
  description: string;
  studio_code: string;
  status: BroadcastStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  logo_url: string;
  show_logo: boolean;
  overlay_url: string;
  show_overlay: boolean;
  background_url: string;
  brand_color: string;
  theme: string;
  show_names: boolean;
  banners: string;
  targets: StreamingTarget[];
  created_at: string;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
}
