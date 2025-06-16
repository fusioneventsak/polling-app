import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { 
  Play, 
  Square, 
  Edit3, 
  Trash2, 
  GripVertical,
  MessageSquare,
  HelpCircle,
  BarChart,
  Cloud,
  Target
} from 'lucide-react';
import type { Activity, ActivityType } from '../types';

interface DraggableActivityProps {
  activity: Activity;
  index: number;
  onStart: (roomId: string, activityId: string) => void;
  onStop: (activityId: string) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onDisplay: () => void;
  roomId: string;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export const DraggableActivity: React.FC<DraggableActivityProps> = ({
  activity,
  index,
  onStart,
  onStop,
  onEdit,
  onDelete,
  onDisplay,
  roomId,
  isDragging,
  dragHandleProps
}) => {
  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'poll': return MessageSquare;
      case 'trivia': return HelpCircle;
      case 'quiz': return Target;
      case 'word_cloud': return Cloud;
      default: return MessageSquare;
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case 'poll': return 'Poll';
      case 'trivia': return 'Trivia';
      case 'quiz': return 'Quiz';
      case 'word_cloud': return 'Word Cloud';
      default: return 'Activity';
    }
  };

  const Icon = getActivityIcon(activity.type);

  return (
    <motion.div
      layout
      className={`flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600 transition-all ${
        isDragging ? 'shadow-2xl bg-slate-700/50 border-blue-500' : ''
      }`}
      whileHover={{ scale: isDragging ? 1 : 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-white transition-colors p-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Activity Order */}
        <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
          {index + 1}
        </div>

        <Icon className="w-5 h-5 text-cyan-400" />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-medium">
              {activity.title}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              activity.is_active 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-slate-500/20 text-slate-400'
            }`}>
              {getActivityTypeLabel(activity.type)}
            </span>
            {activity.is_active && (
              <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                ● LIVE
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400">
            {activity.total_responses} responses • {activity.options?.length || 0} options
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(activity)}
          className="opacity-70 hover:opacity-100"
        >
          <Edit3 className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(activity.id)}
          className="opacity-70 hover:opacity-100 text-red-400 hover:text-red-300"
        >
          <Trash2 className="w-4 h-4" />
        </Button>

        {activity.is_active ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onStop(activity.id)}
          >
            <Square className="w-4 h-4" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onStart(roomId, activity.id)}
          >
            <Play className="w-4 h-4" />
            Start
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisplay}
        >
          <BarChart className="w-4 h-4" />
          Display
        </Button>
      </div>
    </motion.div>
  );
};