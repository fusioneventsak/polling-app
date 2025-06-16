import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { Card } from './Card';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  loading = false
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="w-8 h-8 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-8 h-8 text-orange-400" />;
      case 'info':
        return <Info className="w-8 h-8 text-blue-400" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-400" />;
      default:
        return <AlertCircle className="w-8 h-8 text-red-400" />;
    }
  };

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'danger' as const;
      case 'warning':
        return 'danger' as const;
      case 'info':
        return 'primary' as const;
      case 'success':
        return 'primary' as const;
      default:
        return 'danger' as const;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'danger':
        return 'border-red-500/30';
      case 'warning':
        return 'border-orange-500/30';
      case 'info':
        return 'border-blue-500/30';
      case 'success':
        return 'border-green-500/30';
      default:
        return 'border-red-500/30';
    }
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-500/10';
      case 'warning':
        return 'bg-orange-500/10';
      case 'info':
        return 'bg-blue-500/10';
      case 'success':
        return 'bg-green-500/10';
      default:
        return 'bg-red-500/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <Card className={`border-2 ${getBorderColor()} ${getBackgroundColor()}`}>
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mx-auto mb-4"
            >
              {getIcon()}
            </motion.div>
            
            <h3 className="text-xl font-bold text-white mb-3">
              {title}
            </h3>
            
            <p className="text-slate-300 mb-6 leading-relaxed">
              {message}
            </p>
            
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
              >
                {cancelText}
              </Button>
              <Button
                variant={getConfirmButtonVariant()}
                onClick={onConfirm}
                loading={loading}
                disabled={loading}
                className="flex-1"
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};