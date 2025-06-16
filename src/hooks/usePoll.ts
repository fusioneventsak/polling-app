import { useState, useEffect } from 'react';
import { useRoom } from './useRoom';
import type { Room, Activity, CreatePollData } from '../types';

// Legacy hook for backward compatibility
export const usePoll = (pollId?: string) => {
  const { rooms, currentRoom, loading, error, createPoll: createRoomPoll, createRoom, startActivity, endActivity, joinRoom: joinRoomHook, submitResponse, updateActivity } = useRoom(pollId);
  const [polls, setPolls] = useState<Activity[]>([]);
  const [poll, setPoll] = useState<Activity | null>(null);

  useEffect(() => {
    // Convert rooms and activities to legacy poll format
    const allActivities = rooms.flatMap(room => 
      room.activities?.map(activity => ({
        ...activity,
        code: room.code,
        question: activity.title,
        isActive: activity.is_active,
        total_votes: activity.total_responses,
        participants: room.participants,
        created_at: activity.created_at,
        updated_at: activity.updated_at,
        options: activity.options?.map(option => ({
          ...option,
          votes: option.responses
        })) || []
      })) || []
    );
    
    setPolls(allActivities);

    if (pollId) {
      const foundPoll = allActivities.find(p => p.id === pollId);
      setPoll(foundPoll || null);
    }
  }, [rooms, pollId]);

  const joinPoll = async (code: string) => {
    const result = await joinRoomHook(code);
    
    // If successful, check for active activity and navigate
    if (result.success && result.room) {
      const activeActivity = result.room.activities?.find(a => a.is_active);
      if (activeActivity) {
        // Return the activity ID for navigation
        return {
          ...result,
          activeActivityId: activeActivity.id
        };
      }
    }
    
    return result;
  };

  const createPoll = async (data: CreatePollData): Promise<string | null> => {
    // Create a room first, then add the poll as an activity
    const roomId = await createRoom({
      name: data.question,
      description: 'Poll room'
    });

    if (!roomId) return null;

    return await createRoomPoll(roomId, data.question, data.options);
  };

  const startPoll = async (pollId: string) => {
    const activity = polls.find(p => p.id === pollId);
    if (activity) {
      const room = rooms.find(r => r.activities?.some(a => a.id === pollId));
      if (room) {
        await startActivity(room.id, pollId);
      }
    }
  };

  const endPoll = async (pollId: string) => {
    await endActivity(pollId);
  };

  const castVote = async (pollId: string, optionId: string): Promise<{ success: boolean; error?: string }> => {
    const activity = polls.find(p => p.id === pollId);
    if (activity) {
      const room = rooms.find(r => r.activities?.some(a => a.id === pollId));
      if (room) {
        const participantId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return await submitResponse(room.id, pollId, optionId, participantId);
      }
    }
    return { success: false, error: 'Poll not found' };
  };

  const updatePoll = async (pollId: string, updates: { question?: string; options?: Array<{ text: string; media?: string }> }): Promise<boolean> => {
    const activityUpdates: any = {};
    
    if (updates.question) {
      activityUpdates.title = updates.question;
    }
    
    if (updates.options) {
      activityUpdates.options = updates.options.map(opt => ({
        text: opt.text,
        media_url: opt.media
      }));
    }
    
    return await updateActivity(pollId, activityUpdates);
  };

  return {
    polls,
    poll,
    loading,
    error,
    createPoll,
    startPoll,
    endPoll,
    castVote,
    updatePoll,
    joinPoll
  };
};