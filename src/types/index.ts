// Room-based types
export interface Room {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  current_activity_id?: string;
  current_activity_type?: string;
  participants: number;
  created_at: string;
  updated_at: string;
  activities?: Activity[];
  current_activity?: Activity;
  settings?: RoomSettings;
}

export interface RoomSettings {
  theme?: {
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    background_gradient?: string;
    text_color?: string;
  };
  branding?: {
    logo_url?: string;
    organization_name?: string;
    show_powered_by?: boolean;
  };
  display?: {
    show_participant_count?: boolean;
    show_timer?: boolean;
    animation_speed?: 'slow' | 'normal' | 'fast';
  };
}

export interface Activity {
  id: string;
  room_id: string;
  room?: Room;
  type: ActivityType;
  title: string;
  description?: string;
  media_url?: string;
  settings: ActivitySettings;
  is_active: boolean;
  total_responses: number;
  activity_order: number;
  created_at: string;
  updated_at: string;
  options?: ActivityOption[];
}

export interface ActivityOption {
  id: string;
  activity_id: string;
  text: string;
  media_url?: string;
  is_correct: boolean;
  responses: number;
  option_order: number;
  created_at: string;
}

export interface ParticipantResponse {
  id: string;
  room_id: string;
  activity_id: string;
  option_id: string;
  participant_id: string;
  response_time?: number;
  created_at: string;
}

export type ActivityType = 'poll' | 'trivia' | 'quiz' | 'survey' | 'word_cloud';

export interface ActivitySettings {
  allow_multiple_responses?: boolean;
  show_results_immediately?: boolean;
  time_limit?: number; // seconds
  points_per_correct?: number;
  randomize_options?: boolean;
  [key: string]: any;
}

// Legacy types for backward compatibility
export interface PollOption extends ActivityOption {}

export interface Poll extends Activity {
  question: string;
  questionMedia?: string;
  options: PollOption[];
  isActive: boolean;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vote extends ParticipantResponse {
  pollId: string;
  optionId: string;
  userId: string;
  timestamp: string;
}

export interface SocketEvents {
  'room-created': (room: Room) => void;
  'room-updated': (room: Room) => void;
  'activity-created': (activity: Activity) => void;
  'activity-updated': (activity: Activity) => void;
  'activity-started': (activityId: string) => void;
  'activity-ended': (activityId: string) => void;
  'response-submitted': (response: ParticipantResponse) => void;
  'participant-joined': (data: { roomId: string; participantCount: number }) => void;
  'participant-left': (data: { roomId: string; participantCount: number }) => void;
  'error': (message: string) => void;
}

// Create data interfaces
export interface CreateRoomData {
  name: string;
  description?: string;
}

export interface CreateActivityData {
  room_id: string;
  type: ActivityType;
  title: string;
  description?: string;
  media_url?: string;
  settings?: ActivitySettings;
  options: Array<{
    text: string;
    media_url?: string;
    is_correct?: boolean;
  }>;
}

export interface CreatePollData extends CreateActivityData {
  question: string;
  questionMedia?: string;
  options: Array<{ text: string; media?: string }>;
}