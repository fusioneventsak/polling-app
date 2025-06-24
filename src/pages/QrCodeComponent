import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { QrCode, ExternalLink, Copy, Check } from 'lucide-react';

interface QRCodeProps {
  url: string;
  size?: number;
  title?: string;
  showUrl?: boolean;
  showCopyButton?: boolean;
  className?: string;
}

// Memoized QR Code Display - prevents unnecessary re-renders
export const QRCodeDisplay = memo<QRCodeProps>(({ 
  url, 
  size = 200, 
  title,
  showUrl = true,
  showCopyButton = true,
  className = "" 
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(false);
  
  // Memoize the QR URL to prevent regeneration
  const qrApiUrl = useMemo(() => {
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=1e293b&color=ffffff&format=svg&ecc=M&margin=1`;
  }, [url, size]);

  // Generate QR code only once per unique URL/size combination
  useEffect(() => {
    if (!qrApiUrl || qrDataUrl === qrApiUrl) return;
    
    setIsGenerating(true);
    setError(false);
    
    // Set the URL directly - no need for complex loading
    setQrDataUrl(qrApiUrl);
    setIsGenerating(false);
  }, [qrApiUrl, qrDataUrl]);

  const handleCopyUrl = async () => {
    if (copied) return; // Prevent multiple clicks
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenUrl = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Early return for no URL - completely static
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 min-h-[400px] ${className}`}>
        <div className="text-center p-8">
          <QrCode className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Waiting for activity...</p>
          <p className="text-slate-500 text-sm mt-2">QR code will appear when session is active</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-8 min-h-[400px] flex flex-col justify-center ${className}`}>
      {title && (
        <h2 className="text-3xl font-bold text-white mb-8 text-center">{title}</h2>
      )}
      
      {/* Static QR Code Container */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          {isGenerating ? (
            <div 
              className="flex items-center justify-center bg-slate-700/50 rounded-xl border-2 border-dashed border-slate-600"
              style={{ width: size + 40, height: size + 40 }}
            >
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-slate-400 text-sm">Loading...</p>
              </div>
            </div>
          ) : qrDataUrl ? (
            <div className="relative">
              {/* Glow effect */}
              <div 
                className="absolute inset-0 bg-white/10 rounded-2xl blur-xl"
                style={{ margin: '-10px' }}
              />
              
              {/* Main QR container */}
              <div className="relative bg-white p-6 rounded-2xl shadow-2xl">
                <img 
                  src={qrDataUrl} 
                  alt="QR Code"
                  className="block rounded-lg"
                  style={{ width: size, height: size }}
                  onLoad={() => setIsGenerating(false)}
                  onError={() => {
                    setError(true);
                    setIsGenerating(false);
                  }}
                />
              </div>
              
              {/* Decorative corners */}
              <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
              <div className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
              <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
              <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Static URL Display and Actions */}
      {showUrl && qrDataUrl && !isGenerating && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-600/50">
            <p className="text-slate-400 text-sm mb-2 font-medium">Scan QR code or visit:</p>
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
              <code className="text-blue-400 text-sm break-all block">
                {url}
              </code>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            {showCopyButton && (
              <button
                onClick={handleCopyUrl}
                disabled={copied}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${copied 
                    ? 'bg-green-600 text-green-100' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }
                `}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy URL
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={handleOpenUrl}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-blue-100 rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// Set display name for debugging
QRCodeDisplay.displayName = 'QRCodeDisplay';

// Simple static inline QR component
export const InlineQRCode = memo<{
  url: string;
  size?: number;
  className?: string;
}>(({ url, size = 120, className = "" }) => {
  const qrUrl = useMemo(() => {
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&format=svg&ecc=M&margin=0`;
  }, [url, size]);

  if (!qrUrl) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-200 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <QrCode className="w-8 h-8 text-slate-500" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded border ${className}`}>
      <img 
        src={qrUrl} 
        alt="QR Code"
        className="w-full h-full rounded"
        style={{ width: size, height: size }}
      />
    </div>
  );
});

InlineQRCode.displayName = 'InlineQRCode';

export default QRCodeDisplay;