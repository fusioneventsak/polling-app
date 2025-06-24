import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { Card } from './Card';
import { ImageUpload } from './ImageUpload';
import { 
  Settings, 
  Palette, 
  Image, 
  Monitor, 
  Save, 
  X, 
  Upload,
  Eye,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import type { Room, RoomSettings } from '../types';

// Helper function to generate a unique 4-digit room code
const generateRoomCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

interface RoomSettingsProps {
  room?: Room;
  onSave: (roomData: any) => Promise<void> | void;
  onCancel: () => void;
}

export const RoomSettings: React.FC<RoomSettingsProps> = ({ room, onSave, onCancel }) => {
  const [name, setName] = useState(room?.name || '');
  const [description, setDescription] = useState(room?.description || '');
  const [settings, setSettings] = useState<RoomSettings>(room?.settings || {
    theme: {
      primary_color: '#2563eb',
      secondary_color: '#0891b2',
      accent_color: '#06b6d4',
      background_gradient: 'from-slate-900 via-blue-900 to-slate-900',
      text_color: '#ffffff'
    },
    branding: {
      logo_url: '',
      organization_name: '',
      show_powered_by: true
    },
    display: {
      show_participant_count: true,
      show_timer: true,
      animation_speed: 'normal'
    }
  });
  
  const [activeTab, setActiveTab] = useState<'theme' | 'branding' | 'display'>('theme');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const predefinedColors = [
    { name: 'Blue', primary: '#2563eb', secondary: '#0891b2', accent: '#06b6d4' },
    { name: 'Purple', primary: '#7c3aed', secondary: '#a855f7', accent: '#c084fc' },
    { name: 'Green', primary: '#059669', secondary: '#10b981', accent: '#34d399' },
    { name: 'Red', primary: '#dc2626', secondary: '#ef4444', accent: '#f87171' },
    { name: 'Orange', primary: '#ea580c', secondary: '#f97316', accent: '#fb923c' },
    { name: 'Pink', primary: '#db2777', secondary: '#ec4899', accent: '#f472b6' },
    { name: 'Indigo', primary: '#4f46e5', secondary: '#6366f1', accent: '#818cf8' },
    { name: 'Teal', primary: '#0d9488', secondary: '#14b8a6', accent: '#5eead4' }
  ];

  const backgroundGradients = [
    { name: 'Blue Ocean', value: 'from-slate-900 via-blue-900 to-slate-900' },
    { name: 'Purple Night', value: 'from-slate-900 via-purple-900 to-slate-900' },
    { name: 'Green Forest', value: 'from-slate-900 via-green-900 to-slate-900' },
    { name: 'Red Sunset', value: 'from-slate-900 via-red-900 to-slate-900' },
    { name: 'Orange Fire', value: 'from-slate-900 via-orange-900 to-slate-900' },
    { name: 'Dark Mode', value: 'from-gray-900 via-slate-900 to-black' },
    { name: 'Midnight', value: 'from-blue-950 via-slate-950 to-black' },
    { name: 'Corporate', value: 'from-slate-800 via-slate-900 to-slate-800' }
  ];

  const updateTheme = (updates: Partial<RoomSettings['theme']>) => {
    setSettings(prev => ({
      ...prev,
      theme: { ...prev.theme, ...updates }
    }));
  };

  const updateBranding = (updates: Partial<RoomSettings['branding']>) => {
    setSettings(prev => ({
      ...prev,
      branding: { ...prev.branding, ...updates }
    }));
  };

  const updateDisplay = (updates: Partial<RoomSettings['display']>) => {
    setSettings(prev => ({
      ...prev,
      display: { ...prev.display, ...updates }
    }));
  };

  const applyColorScheme = (scheme: typeof predefinedColors[0]) => {
    updateTheme({
      primary_color: scheme.primary,
      secondary_color: scheme.secondary,
      accent_color: scheme.accent
    });
  };

  const resetToDefaults = () => {
    setSettings({
      theme: {
        primary_color: '#2563eb',
        secondary_color: '#0891b2',
        accent_color: '#06b6d4',
        background_gradient: 'from-slate-900 via-blue-900 to-slate-900',
        text_color: '#ffffff'
      },
      branding: {
        logo_url: '',
        organization_name: '',
        show_powered_by: true
      },
      display: {
        show_participant_count: true,
        show_timer: true,
        animation_speed: 'normal'
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (room) {
        // Update existing room
        await onSave({ settings });
      } else {
        // Create new room
        const roomCode = generateRoomCode();
        await onSave({ name, description, code: roomCode, settings });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'theme' as const, label: 'Theme & Colors', icon: Palette },
    { id: 'branding' as const, label: 'Branding', icon: Image },
    { id: 'display' as const, label: 'Display Options', icon: Monitor }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900/50 border-r border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Room Settings</h2>
          </div>
          
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              className="w-full mb-3"
            >
              {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {previewMode ? 'Hide Preview' : 'Show Preview'}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-sm text-slate-400">
                Customize the appearance of your room's display and voting pages
              </p>
            </div>
            
            <Button variant="ghost" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {!room && (
                <motion.div
                  key="basic-info"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 mb-8"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Room Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter room name"
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
                      placeholder="Enter room description"
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'theme' && (
                <motion.div
                  key="theme"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {/* Color Schemes */}
                  <div>
                    <h4 className="text-white font-semibold mb-4">Quick Color Schemes</h4>
                    <div className="grid grid-cols-4 gap-3">
                      {predefinedColors.map((scheme) => (
                        <button
                          key={scheme.name}
                          onClick={() => applyColorScheme(scheme)}
                          className="p-3 rounded-lg border border-slate-600 hover:border-slate-500 transition-all group"
                        >
                          <div className="flex gap-1 mb-2">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: scheme.primary }}
                            />
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: scheme.secondary }}
                            />
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: scheme.accent }}
                            />
                          </div>
                          <span className="text-xs text-slate-300 group-hover:text-white">
                            {scheme.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Colors */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Primary Color
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={settings.theme?.primary_color || '#2563eb'}
                          onChange={(e) => updateTheme({ primary_color: e.target.value })}
                          className="w-12 h-10 rounded-lg border border-slate-600 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.theme?.primary_color || '#2563eb'}
                          onChange={(e) => updateTheme({ primary_color: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                          placeholder="#2563eb"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Secondary Color
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={settings.theme?.secondary_color || '#0891b2'}
                          onChange={(e) => updateTheme({ secondary_color: e.target.value })}
                          className="w-12 h-10 rounded-lg border border-slate-600 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.theme?.secondary_color || '#0891b2'}
                          onChange={(e) => updateTheme({ secondary_color: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                          placeholder="#0891b2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Accent Color
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={settings.theme?.accent_color || '#06b6d4'}
                          onChange={(e) => updateTheme({ accent_color: e.target.value })}
                          className="w-12 h-10 rounded-lg border border-slate-600 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.theme?.accent_color || '#06b6d4'}
                          onChange={(e) => updateTheme({ accent_color: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                          placeholder="#06b6d4"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Text Color
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={settings.theme?.text_color || '#ffffff'}
                          onChange={(e) => updateTheme({ text_color: e.target.value })}
                          className="w-12 h-10 rounded-lg border border-slate-600 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.theme?.text_color || '#ffffff'}
                          onChange={(e) => updateTheme({ text_color: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Background Gradients */}
                  <div>
                    <h4 className="text-white font-semibold mb-4">Background Gradient</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {backgroundGradients.map((gradient) => (
                        <button
                          key={gradient.name}
                          onClick={() => updateTheme({ background_gradient: gradient.value })}
                          className={`p-4 rounded-lg border transition-all ${
                            settings.theme?.background_gradient === gradient.value
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                        >
                          <div 
                            className={`w-full h-8 rounded mb-2 bg-gradient-to-r ${gradient.value}`}
                          />
                          <span className="text-xs text-slate-300">{gradient.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'branding' && (
                <motion.div
                  key="branding"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={settings.branding?.organization_name || ''}
                      onChange={(e) => updateBranding({ organization_name: e.target.value })}
                      placeholder="Your Organization Name"
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      This will be displayed on the voting and display pages
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Organization Logo
                    </label>
                    <ImageUpload
                      roomCode={room?.code || 'temp'}
                      currentImageUrl={settings.branding?.logo_url}
                      onImageUploaded={(url) => updateBranding({ logo_url: url })}
                      onImageRemoved={() => updateBranding({ logo_url: '' })}
                      label=""
                      description="Upload your organization logo"
                      maxSizeMB={5}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div>
                      <h4 className="text-white font-medium">Show "Powered by PollStream"</h4>
                      <p className="text-sm text-slate-400">
                        Display attribution in the footer of pages
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.branding?.show_powered_by !== false}
                        onChange={(e) => updateBranding({ show_powered_by: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </motion.div>
              )}

              {activeTab === 'display' && (
                <motion.div
                  key="display"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div>
                        <h4 className="text-white font-medium">Show Participant Count</h4>
                        <p className="text-sm text-slate-400">
                          Display the number of participants on display pages
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.display?.show_participant_count !== false}
                          onChange={(e) => updateDisplay({ show_participant_count: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div>
                        <h4 className="text-white font-medium">Show Timer</h4>
                        <p className="text-sm text-slate-400">
                          Display current time on display pages
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.display?.show_timer !== false}
                          onChange={(e) => updateDisplay({ show_timer: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Animation Speed
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['slow', 'normal', 'fast'] as const).map((speed) => (
                        <button
                          key={speed}
                          onClick={() => updateDisplay({ animation_speed: speed })}
                          className={`p-4 rounded-lg border transition-all capitalize ${
                            settings.display?.animation_speed === speed
                              ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                              : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'
                          }`}
                        >
                          {speed}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              Changes will apply to all display and voting pages for this room
            </div>
            
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                <Save className="w-4 h-4" />
                {room ? 'Save Settings' : 'Create Room'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};