import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { Card } from './Card';
import { ImageUpload } from './ImageUpload';
import { Plus, Trash2, Check, X, Lock, Unlock } from 'lucide-react';
import { roomService } from '../services/roomService';
import type { Activity, ActivityType, CreateActivityData } from '../types';

interface ActivityEditorProps {
  roomId: string;
  activity?: Activity | null;
  onSave: (activity: Activity) => void;
  onCancel: () => void;
}

export const ActivityEditor: React.FC<ActivityEditorProps> = ({ 
  roomId, 
  activity, 
  onSave, 
  onCancel 
}) => {
  const [title, setTitle] = useState(activity?.title || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [type, setType] = useState<ActivityType>(activity?.type || 'poll');
  const [mediaUrl, setMediaUrl] = useState(activity?.media_url || '');
  const [isVotingLocked, setIsVotingLocked] = useState(
    activity?.settings?.voting_locked || false
  );
  const [options, setOptions] = useState(
    activity?.options?.map(opt => ({ 
      text: opt.text, 
      isCorrect: opt.is_correct || false,
      mediaUrl: opt.media_url || ''
    })) || [
      { text: '', isCorrect: false, mediaUrl: '' },
      { text: '', isCorrect: false, mediaUrl: '' }
    ]
  );
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);

  const addOption = () => {
    if (options.length < 6) {
      setOptions(prev => [...prev, { text: '', isCorrect: false, mediaUrl: '' }]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, text: string) => {
    setOptions(prev => prev.map((opt, i) => i === index ? { ...opt, text } : opt));
  };

  const updateOptionMedia = (index: number, mediaUrl: string) => {
    setOptions(prev => prev.map((opt, i) => i === index ? { ...opt, mediaUrl } : opt));
  };

  const toggleCorrectAnswer = (index: number) => {
    setOptions(prev => prev.map((opt, i) => 
      i === index ? { ...opt, isCorrect: !opt.isCorrect } : opt
    ));
  };

  const handleSave = async () => {
    // Prevent multiple simultaneous save attempts
    if (saving || saveInProgress.current) {
      console.log('Save already in progress, ignoring duplicate request');
      return;
    }

    if (!title.trim() || !options.every(opt => opt.text.trim())) {
      return;
    }

    saveInProgress.current = true;
    setSaving(true);
    
    try {
      console.log('Starting activity save process...');
      
      if (activity) {
        // Update existing activity
        console.log('Updating existing activity:', activity.id);
        const updatedActivity = await roomService.updateActivity(activity.id, {
          title,
          description,
          media_url: mediaUrl,
          settings: {
            ...activity.settings,
            voting_locked: isVotingLocked
          },
          options: options.map(opt => ({
            text: opt.text,
            is_correct: opt.isCorrect,
            media_url: opt.mediaUrl || undefined
          }))
        });
        console.log('Activity updated successfully');
        onSave(updatedActivity);
      } else {
        // Create new activity
        console.log('Creating new activity');
        const activityData: CreateActivityData = {
          room_id: roomId,
          type,
          title,
          description,
          media_url: mediaUrl,
          settings: {
            voting_locked: isVotingLocked
          },
          options: options.map(opt => ({
            text: opt.text,
            is_correct: opt.isCorrect,
            media_url: opt.mediaUrl || undefined
          }))
        };
        
        const newActivity = await roomService.createActivity(activityData);
        console.log('Activity created successfully');
        onSave(newActivity);
      }
    } catch (error) {
      console.error('Failed to save activity:', error);
      // Show user-friendly error message
      alert('Failed to save activity. Please try again.');
    } finally {
      setSaving(false);
      saveInProgress.current = false;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">
          {activity ? 'Edit Activity' : 'Create Activity'}
        </h2>
        
        <div className="space-y-6">
          {!activity && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Activity Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              >
                <option value="poll">Poll</option>
                <option value="trivia">Trivia</option>
                <option value="quiz">Quiz</option>
                <option value="survey">Survey</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter activity title"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter activity description"
              rows={3}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Activity Media (Optional)
            </label>
            <ImageUpload
              roomCode="temp" // We'll use a temp code for now
              currentImageUrl={mediaUrl}
              onImageUploaded={setMediaUrl}
              onImageRemoved={() => setMediaUrl('')}
              label="Upload an image for this activity"
              description="Add visual content to make your activity more engaging"
              maxSizeMB={5}
            />
          </div>

          {/* Vote Locking Control */}
          {activity && (
            <div className="border-t border-slate-600 pt-6">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-600">
                <div className="flex items-center gap-3">
                  {isVotingLocked ? (
                    <Lock className="w-5 h-5 text-red-400" />
                  ) : (
                    <Unlock className="w-5 h-5 text-green-400" />
                  )}
                  <div>
                    <h3 className="font-medium text-white">Voting Control</h3>
                    <p className="text-sm text-slate-400">
                      {isVotingLocked 
                        ? 'Voting is currently locked - participants cannot vote'
                        : 'Voting is open - participants can submit responses'
                      }
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsVotingLocked(!isVotingLocked)}
                  variant={isVotingLocked ? "danger" : "primary"}
                  size="sm"
                  disabled={saving}
                >
                  {isVotingLocked ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      Unlock Votes
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Lock Votes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Options
            </label>
            <div className="space-y-4">
              {options.map((option, index) => (
                <div key={index} className="border border-slate-600 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />
                    
                    {type === 'trivia' || type === 'quiz' ? (
                      <Button
                        variant={option.isCorrect ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => toggleCorrectAnswer(index)}
                        className="px-3"
                        disabled={saving}
                      >
                        ✓
                      </Button>
                    ) : null}
                    
                    {options.length > 2 && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeOption(index)}
                        disabled={saving}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <ImageUpload
                      roomCode="temp" // We'll use a temp code for now
                      currentImageUrl={option.mediaUrl || ''}
                      onImageUploaded={(url) => updateOptionMedia(index, url)}
                      onImageRemoved={() => updateOptionMedia(index, '')}
                      label={`Option ${index + 1} Image (Optional)`}
                      description="Upload an image for this option"
                      maxSizeMB={5}
                      className="mt-2"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {options.length < 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addOption}
                className="mt-3"
                disabled={saving}
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!title.trim() || !options.every(opt => opt.text.trim()) || saving}
            className="flex-1"
          >
            <Check className="w-4 h-4" />
            {activity ? 'Save Changes' : 'Create Activity'}
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};