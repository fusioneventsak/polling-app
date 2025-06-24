import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { Card } from './Card';
import { ImageUpload } from './ImageUpload';
import { Plus, Trash2, Check, X, Lock, Unlock, Timer, Zap, Trophy, Eye, EyeOff, Target, CheckCircle, AlertCircle } from 'lucide-react';
import { roomService } from '../services/roomService';
import type { Activity, ActivityType, CreateActivityData } from '../types';

interface ActivityEditorProps {
  roomId: string;
  activity?: Activity | null;
  onSave: (activity: Activity) => void;
  onCancel: () => void;
}

const TriviaSettingsPanel: React.FC<{
  settings: any;
  onUpdateSettings: (newSettings: any) => void;
  saving: boolean;
}> = ({ settings, onUpdateSettings, saving }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateSetting = (key: string, value: any) => {
    onUpdateSettings({
      ...settings,
      [key]: value
    });
  };

  return (
    <div className="space-y-6 p-6 bg-slate-800/50 rounded-lg border border-slate-600">
      <div className="flex items-center gap-3 mb-4">
        <Timer className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Trivia Settings</h3>
      </div>

      {/* Countdown Duration */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Countdown Timer Duration
        </label>
        <div className="grid grid-cols-7 gap-2">
          {[5, 10, 15, 20, 30, 45, 60].map((seconds) => (
            <button
              key={seconds}
              onClick={() => updateSetting('countdown_duration', seconds)}
              disabled={saving}
              className={`p-3 rounded-lg border transition-all text-sm font-medium ${
                settings.countdown_duration === seconds
                  ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                  : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {seconds}s
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          How long participants have to answer the question
        </p>
      </div>

      {/* Points Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Points per Correct Answer
          </label>
          <select
            value={settings.points_per_correct || 10}
            onChange={(e) => updateSetting('points_per_correct', parseInt(e.target.value))}
            disabled={saving}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={5}>5 points</option>
            <option value={10}>10 points</option>
            <option value={15}>15 points</option>
            <option value={20}>20 points</option>
            <option value={25}>25 points</option>
            <option value={50}>50 points</option>
            <option value={100}>100 points</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Speed Bonus Points
          </label>
          <select
            value={settings.points_per_speed || 0}
            onChange={(e) => updateSetting('points_per_speed', parseInt(e.target.value))}
            disabled={saving}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={0}>No bonus</option>
            <option value={1}>+1 per second left</option>
            <option value={2}>+2 per second left</option>
            <option value={5}>+5 per second left</option>
          </select>
        </div>
      </div>

      {/* Answer Reveal Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-green-400" />
            <div>
              <h4 className="text-white font-medium">Show Correct Answer</h4>
              <p className="text-sm text-slate-400">
                Reveal the correct answer after time expires
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.show_correct_answer !== false}
              onChange={(e) => updateSetting('show_correct_answer', e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        {settings.show_correct_answer !== false && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Answer Reveal Delay
            </label>
            <select
              value={settings.reveal_answer_delay || 3}
              onChange={(e) => updateSetting('reveal_answer_delay', parseInt(e.target.value))}
              disabled={saving}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={0}>Immediately</option>
              <option value={1}>1 second</option>
              <option value={2}>2 seconds</option>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Delay before showing the correct answer
            </p>
          </div>
        )}
      </div>

      {/* Advanced Settings Toggle */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            {/* Auto Advance */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Auto Advance</h4>
                <p className="text-sm text-slate-400">
                  Automatically move to next question after answer reveal
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_advance || false}
                  onChange={(e) => updateSetting('auto_advance', e.target.checked)}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* Randomize Options */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Randomize Answer Order</h4>
                <p className="text-sm text-slate-400">
                  Shuffle answer options for each participant
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.randomize_options || false}
                  onChange={(e) => updateSetting('randomize_options', e.target.checked)}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Settings Summary */}
      <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-600/30">
        <h4 className="text-purple-400 font-medium mb-2 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Trivia Configuration Summary
        </h4>
        <div className="text-sm text-slate-300 space-y-1">
          <div>Timer: <span className="text-purple-400">{settings.countdown_duration || 30} seconds</span></div>
          <div>Base Points: <span className="text-green-400">{settings.points_per_correct || 10}</span></div>
          {settings.points_per_speed > 0 && (
            <div>Speed Bonus: <span className="text-yellow-400">+{settings.points_per_speed} per second left</span></div>
          )}
          <div>Answer Reveal: <span className="text-blue-400">
            {settings.show_correct_answer === false ? 'Disabled' : `After ${settings.reveal_answer_delay || 3}s delay`}
          </span></div>
        </div>
      </div>
    </div>
  );
};

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
    if (type === 'trivia') {
      // For trivia, only one answer can be correct
      setOptions(prev => prev.map((opt, i) => ({
        ...opt,
        isCorrect: i === index ? !opt.isCorrect : false
      })));
    } else {
      // For other types, multiple answers can be correct
      setOptions(prev => prev.map((opt, i) => 
        i === index ? { ...opt, isCorrect: !opt.isCorrect } : opt
      ));
    }
  };

  const markAsCorrect = (index: number) => {
    if (type === 'trivia') {
      // For trivia, clear all other correct answers and set this one
      setOptions(prev => prev.map((opt, i) => ({
        ...opt,
        isCorrect: i === index
      })));
    } else {
      toggleCorrectAnswer(index);
    }
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
        
        const newActivity = await roomService.createActivity(roomId, activityData);
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

          {type === 'trivia' && (
            <TriviaSettingsPanel
              settings={settings}
              onUpdateSettings={setSettings}
              saving={saving}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {type === 'trivia' ? 'Answer Options' : 'Options'}
            </label>
            {type === 'trivia' && (
              <p className="text-sm text-slate-400 mb-4">
                Mark one option as correct. Participants will earn points for choosing the right answer.
              </p>
            )}
            <div className="space-y-4">
              {options.map((option, index) => (
                <div key={index} className="border border-slate-600 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={type === 'trivia' ? `Answer ${String.fromCharCode(65 + index)}` : `Option ${index + 1}`}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />
                    
                    {type === 'trivia' || type === 'quiz' ? (
                      <Button
                        variant={option.isCorrect ? "success" : "ghost"}
                        size="sm"
                        onClick={() => markAsCorrect(index)}
                        disabled={saving}
                        className={option.isCorrect ? "bg-green-600 hover:bg-green-700" : "border-slate-600 hover:border-green-500"}
                      >
                        {option.isCorrect ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Correct
                          </>
                        ) : (
                          <>
                            <Target className="w-4 h-4" />
                            Mark Correct
                          </>
                        )}
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
                  
                  {/* Enhanced Image Upload for Trivia */}
                  <div className="mt-3">
                    <ImageUpload
                      roomCode="temp" // We'll use a temp code for now
                      currentImageUrl={option.mediaUrl}
                      onImageUploaded={(url) => updateOptionMedia(index, url)}
                      onImageRemoved={() => updateOptionMedia(index, '')}
                      label={type === 'trivia' ? `Add image for answer ${String.fromCharCode(65 + index)}` : `Option ${index + 1} Image (Optional)`}
                      description={type === 'trivia' ? "Visual content can make trivia more engaging" : "Upload an image for this option"}
                      maxSizeMB={type === 'trivia' ? 2 : 5}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {options.length < (type === 'trivia' ? 6 : 8) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addOption}
                disabled={saving || options.length >= (type === 'trivia' ? 6 : 8)}
                className="w-full mt-4 border-2 border-dashed border-slate-600 hover:border-slate-500"
              >
                <Plus className="w-4 h-4" />
                Add {type === 'trivia' ? 'Answer' : 'Option'} {options.length < (type === 'trivia' ? 6 : 8) ? `(${options.length}/${type === 'trivia' ? 6 : 8})` : ''}
              </Button>
            )}

            {/* Trivia Validation Warning */}
            {type === 'trivia' && !options.some(opt => opt.isCorrect) && options.length > 1 && (
              <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Missing Correct Answer</span>
                </div>
                <p className="text-sm text-yellow-300 mt-1">
                  Please mark one answer as correct for this trivia question.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={
              !title.trim() || 
              !options.every(opt => opt.text.trim()) || 
              (type === 'trivia' && !options.some(opt => opt.isCorrect)) ||
              saving
            }
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