import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import { Upload, X, Image as ImageIcon, Loader2, Check, AlertCircle } from 'lucide-react';

interface ImageUploadProps {
  roomCode: string;
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved?: () => void;
  label?: string;
  description?: string;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  className?: string;
  compact?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  roomCode,
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  label = "Upload Image",
  description = "Drag and drop an image or click to browse",
  maxSizeMB = 10,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  className = '',
  compact = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type not supported. Please use: ${acceptedTypes.join(', ')}`;
    }
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size too large. Maximum size is ${maxSizeMB}MB`;
    }
    
    return null;
  };

  const uploadFile = async (file: File) => {
    if (!supabase) {
      setError('Upload service not available');
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      // Generate unique filename with room code prefix
      const fileExt = file.name.split('.').pop();
      const fileName = `${roomCode}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const bucketName = 'room-uploads'; // Use shared bucket

      // Upload file to storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(`Failed to upload image: ${uploadError.message}`);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      setSuccess(true);
      onImageUploaded(publicUrl);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = async () => {
    if (!currentImageUrl || !onImageRemoved) return;

    try {
      if (supabase && currentImageUrl.includes('supabase')) {
        // Extract filename from URL for deletion
        const urlParts = currentImageUrl.split('/');
        const fileName = urlParts.slice(-2).join('/'); // Get room-code/filename.ext
        const bucketName = 'room-uploads';

        const { error } = await supabase.storage
          .from(bucketName)
          .remove([fileName]);
          
        if (error) {
          console.warn('Failed to delete file from storage:', error);
        }
      }

      onImageRemoved();
    } catch (err) {
      console.error('Error removing image:', err);
      // Still call onImageRemoved to update the UI even if deletion failed
      onImageRemoved();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
        
        {/* Current Image Preview */}
        <AnimatePresence>
          {currentImageUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 relative inline-block"
            >
              <img
                src={currentImageUrl}
                alt="Current upload"
                className="max-w-48 max-h-32 object-contain rounded-lg border border-slate-600"
              />
              {onImageRemoved && (
                <button
                  onClick={handleRemove}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Area */}
        <motion.div
          className={`relative border-2 border-dashed rounded-lg ${compact ? 'p-3' : 'p-6'} transition-all cursor-pointer ${
            dragOver
              ? 'border-blue-500 bg-blue-500/10'
              : uploading
              ? 'border-slate-600 bg-slate-800/50'
              : 'border-slate-600 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={!uploading ? handleClick : undefined}
          whileHover={!uploading ? { scale: 1.01 } : {}}
          whileTap={!uploading ? { scale: 0.99 } : {}}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={uploading}
          />

          <div className="text-center">
            <AnimatePresence mode="wait">
              {uploading ? (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                  <p className="text-slate-300 font-medium">Uploading...</p>
                  <p className="text-slate-400 text-sm">Please wait</p>
                </motion.div>
              ) : success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex flex-col items-center"
                >
                  <Check className="w-8 h-8 text-green-400 mb-3" />
                  <p className="text-green-400 font-medium">Upload successful!</p>
                </motion.div>
              ) : (
                <motion.div
                  key="default"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-slate-700 rounded-lg flex items-center justify-center ${compact ? 'mb-2' : 'mb-3'}`}>
                    {dragOver ? (
                      <Upload className={`${compact ? 'w-4 h-4' : 'w-6 h-6'} text-blue-400`} />
                    ) : (
                      <ImageIcon className={`${compact ? 'w-4 h-4' : 'w-6 h-6'} text-slate-400`} />
                    )}
                  </div>
                  <p className={`text-slate-300 font-medium ${compact ? 'text-sm mb-1' : 'mb-1'}`}>
                    {dragOver ? 'Drop image here' : description}
                  </p>
                  <p className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                    Max {maxSizeMB}MB • {acceptedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 mt-3 text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <p className={`text-xs text-slate-400 ${compact ? 'mt-1' : 'mt-2'}`}>
          {description && description !== label ? description : 'Supported formats: JPEG, PNG, GIF, WebP'}
        </p>
      </div>
    </div>
  );
};