import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RotateCw, AlertCircle } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export const ConnectionStatus: React.FC = () => {
  const { connectionStatus, isConnected } = useSocket();

  if (connectionStatus === 'connected') {
    return null; // Don't show anything when connected
  }

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'disconnected':
        return {
          icon: WifiOff,
          text: 'Connection Lost',
          subtext: 'Attempting to reconnect...',
          bgColor: 'bg-red-900/90',
          borderColor: 'border-red-600',
          textColor: 'text-red-100',
          iconColor: 'text-red-400'
        };
      case 'reconnecting':
        return {
          icon: RotateCw,
          text: 'Reconnecting',
          subtext: 'Please wait...',
          bgColor: 'bg-orange-900/90',
          borderColor: 'border-orange-600',
          textColor: 'text-orange-100',
          iconColor: 'text-orange-400'
        };
      default:
        return {
          icon: AlertCircle,
          text: 'Connection Issue',
          subtext: 'Please check your internet connection',
          bgColor: 'bg-gray-900/90',
          borderColor: 'border-gray-600',
          textColor: 'text-gray-100',
          iconColor: 'text-gray-400'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className={`
          ${config.bgColor} ${config.borderColor} ${config.textColor}
          backdrop-blur-sm border rounded-lg px-4 py-3 shadow-lg
          flex items-center gap-3 min-w-[250px]
        `}>
          <Icon 
            className={`
              w-5 h-5 ${config.iconColor} flex-shrink-0
              ${connectionStatus === 'reconnecting' ? 'animate-spin' : ''}
            `} 
          />
          <div className="flex-1">
            <p className="font-medium text-sm">{config.text}</p>
            <p className="text-xs opacity-80">{config.subtext}</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};