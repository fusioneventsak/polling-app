import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { Card } from './Card';
import { ImageUpload } from './ImageUpload';
import { Plus, Trash2, Check, X } from 'lucide-react';
import type { Activity, ActivityType } from '../types';

interface ActivityEditorProps {
  activity: Activity;
  onSave: (activityId: string, updates: { title?: string; description?: string; media_url?: string; options?: Array<{ text: string; is_correct?: boolean; media_url?: string }> }) => Promise<boolean>;
  onCancel: () => void;
}

export const ActivityEditor: React.FC<ActivityEditorProps> = ({ activity, onSave, onCancel }) => {
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description || '');
  const [mediaUrl, setMediaUrl] = useState(activity.media_url || '');
  const [options, setOptions] = useState(
    activity.options?.map(opt => ({ 
      text: opt.text, 
      isCorrect: opt.is_correct,
      mediaUrl: opt.media_url || ''
    })) || []
  );
  const [saving, setSaving] = useState(false);

  const addOption = () => {
    if (options.length < 6) {
      setOptions(prev => [...prev, { text: '', isCorrect: false }]);
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
    if (!title.trim() || !options.every(opt => opt.text.trim())) {
      return;
    }

    setSaving(true);
    try {
      const success = await onSave(activity.id, {
        title,
        description,
        media_url: mediaUrl,
        options: options.map(opt => ({
          text: opt.text,
          is_correct: opt.isCorrect || false,
          media_url: opt.mediaUrl || undefined
        }))
      });

      if (success) {
        onCancel();
      }
    } catch (error) {
      console.error('Failed to save activity:', error);
    } finally {
      setSaving(false);
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
        <h2 className="text-2xl font-bold text-white mb-6">Edit Activity</h2>
        
        <div className="space-y-6">
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Activity Media (Optional)
            </label>
            <ImageUpload
              roomCode={activity.room?.code || ''}
              currentImageUrl={mediaUrl}
              onImageUploaded={setMediaUrl}
              onImageRemoved={() => setMediaUrl('')}
              label=""
              description="Upload an image for this activity"
              maxSizeMB={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Options
            </label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    {(activity.type === 'trivia' || activity.type === 'quiz') && (
                      <Button
                        variant={option.isCorrect ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => toggleCorrectAnswer(index)}
                        className="px-3"
                      >
                        ✓
                      </Button>
                    )}
                    
                    {options.length > 2 && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <ImageUpload
                      roomCode={activity.room?.code || ''}
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
            disabled={!title.trim() || !options.every(opt => opt.text.trim())}
            className="flex-1"
          >
            <Check className="w-4 h-4" />
            Save Changes
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};