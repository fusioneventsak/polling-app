import React, { useRef, useMemo, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Text, OrbitControls, Float } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import type { ActivityOption } from '../types';

interface Enhanced3DPollVisualizationProps {
  options: ActivityOption[];
  totalResponses: number;
  themeColors: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  activityTitle?: string;
  activityMedia?: string;
  isVotingLocked?: boolean;
  className?: string;
}

// Helper function to calculate dynamic font size based on text length
const calculateTitleFontSize = (text: string): number => {
  const baseSize = 1.8;
  const maxSize = 2.2;
  const minSize = 1.2;
  
  if (text.length <= 20) return maxSize;
  if (text.length <= 40) return baseSize;
  if (text.length <= 60) return minSize * 1.2;
  return minSize;
};

const calculateDescriptionFontSize = (text: string): number => {
  return text.length <= 50 ? 0.8 : text.length <= 100 ? 0.6 : 0.5;
};

// Fixed texture loading component - simplified to avoid material uniform issues
const OptionMediaPlane: React.FC<{
  imageUrl: string;
  position: [number, number, number];
}> = ({ imageUrl, position }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loadError, setLoadError] = useState(false);
  
  useEffect(() => {
    if (!imageUrl || imageUrl.trim() === '') {
      setTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    
    loader.load(
      imageUrl,
      (loadedTexture) => {
        // Minimal texture setup to prevent uniform errors
        loadedTexture.needsUpdate = true;
        setTexture(loadedTexture);
        setLoadError(false);
        console.log('OptionMediaPlane: Texture loaded successfully for:', imageUrl);
      },
      undefined,
      (error) => {
        console.error('OptionMediaPlane: Failed to load texture:', imageUrl, error);
        setLoadError(true);
        setTexture(null);
      }
    );
    
    // Cleanup function
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [imageUrl]);

  // Don't render if no valid texture
  if (!texture || loadError || !imageUrl || imageUrl.trim() === '') {
    return null;
  }

  return (
    <mesh position={position} renderOrder={1}>
      <planeGeometry args={[2.5, 1.875]} />
      <meshBasicMaterial 
        map={texture}
        transparent 
        opacity={0.9}
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// Simplified standing image component with better error handling
const StandingImagePlane: React.FC<{
  imageUrl: string;
  position: [number, number, number];
  fallbackText: string;
  glowColor: string; // Add glow color prop to match bar color
}> = ({ imageUrl, position, fallbackText, glowColor }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loadError, setLoadError] = useState(false);
  
  useEffect(() => {
    if (!imageUrl || imageUrl.trim() === '') {
      setTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    
    loader.load(
      imageUrl,
      (loadedTexture) => {
        loadedTexture.needsUpdate = true;
        setTexture(loadedTexture);
        setLoadError(false);
        console.log('StandingImagePlane: Texture loaded for standing placement:', imageUrl);
      },
      undefined,
      (error) => {
        console.warn('StandingImagePlane: Failed to load texture:', error);
        setLoadError(true);
        setTexture(null);
      }
    );
    
    // Cleanup
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [imageUrl]);

  if (!texture || loadError || !imageUrl || imageUrl.trim() === '') {
    return null;
  }

  return (
    <group>
      {/* Main image - no transparency for better pop */}
      <mesh position={position} rotation={[-Math.PI / 6, 0, 0]} renderOrder={2}>
        <planeGeometry args={[2.0, 1.5]} />
        <meshBasicMaterial 
          map={texture}
        />
      </mesh>
      
      {/* Glow border matching bar color */}
      <mesh position={[position[0], position[1], position[2] - 0.01]} rotation={[-Math.PI / 6, 0, 0]} renderOrder={1}>
        <planeGeometry args={[2.2, 1.7]} />
        <meshBasicMaterial 
          color={glowColor}
          transparent
          opacity={0.5}
        />
      </mesh>
      
      {/* Outer glow effect with lighter version of bar color */}
      <mesh position={[position[0], position[1], position[2] - 0.02]} rotation={[-Math.PI / 6, 0, 0]} renderOrder={0}>
        <planeGeometry args={[2.4, 1.9]} />
        <meshBasicMaterial 
          color={glowColor}
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
};

// Error boundary for texture loading
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    console.error('ErrorBoundary: Caught error in texture loading:', error);
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary: Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// 3D Bar Component (background layer)
const Enhanced3DBar: React.FC<{
  position: [number, number, number];
  height: number;
  color: string;
  label: string;
  percentage: number;
  responses: number;
  isCorrect?: boolean;
  delay: number;
  maxHeight: number;
  index: number;
}> = ({ 
  position, 
  height, 
  color, 
  label, 
  percentage, 
  responses, 
  isCorrect, 
  delay,
  maxHeight,
  index
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [animatedHeight, setAnimatedHeight] = useState(0.2);
  
  // Animate the bar height
  useFrame((state) => {
    const targetHeight = Math.max(height, 0.2);
    
    if (meshRef.current) {
      const currentHeight = meshRef.current.scale.y;
      const animationSpeed = 0.04;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        meshRef.current.scale.y = newHeight;
        meshRef.current.position.y = newHeight / 2;
        setAnimatedHeight(newHeight);
      }
    }
    
    // Animate glow effect - simplified to avoid material issues
    if (glowRef.current && responses > 0) {
      const targetHeight = Math.max(height, 0.2);
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.04;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        glowRef.current.scale.y = newHeight;
        glowRef.current.position.y = newHeight / 2;
      }
      
      // Pulsing glow effect - safe material access
      const pulseIntensity = 0.1 + Math.sin(state.clock.elapsedTime * 2 + delay) * 0.05;
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      if (material && material.opacity !== undefined) {
        material.opacity = pulseIntensity;
      }
    }
  });

  const barColor = useMemo(() => {
    if (isCorrect) return '#10b981';
    return color;
  }, [color, isCorrect]);

  const glowColor = useMemo(() => {
    if (isCorrect) return '#34d399';
    return color;
  }, [color, isCorrect]);

  return (
    <group>
      {/* Base platform with enhanced design */}
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[1.2, 1.2, 0.1]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Main 3D bar with enhanced materials */}
      <mesh ref={meshRef} position={[position[0], 0.1, position[2]]} scale={[1, 0.2, 1]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 1]} />
        <meshStandardMaterial 
          color={barColor}
          metalness={0.4}
          roughness={0.3}
          emissive={barColor}
          emissiveIntensity={responses > 0 ? 0.2 : 0.05}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Glow effect for bars with responses */}
      {responses > 0 && (
        <mesh ref={glowRef} position={[position[0], 0.1, position[2]]} scale={[1.4, 0.2, 1.4]}>
          <cylinderGeometry args={[1.0, 1.0, 1]} />
          <meshBasicMaterial 
            color={glowColor}
            transparent
            opacity={0.15}
          />
        </mesh>
      )}
    </group>
  );
};

// Floor Stats Component (foreground layer)
const FloorStatsDisplay: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
}> = ({ options, totalResponses }) => {
  return (
    <group>
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        
        // Calculate optimal spacing
        const spacing = Math.min(5.0, 30 / Math.max(options.length, 1));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        const xPosition = startX + index * spacing;
        
        return (
          <group key={option.id}>
            {/* Large percentage on the floor */}
            <Text
              position={[xPosition, 0.1, 6]}
              fontSize={1.2}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {percentage}%
            </Text>
            
            {/* Percentage shadow for depth */}
            <Text
              position={[xPosition + 0.05, 0.05, 6.05]}
              fontSize={1.2}
              color="#1e293b"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {percentage}%
            </Text>
            
            {/* Vote count on floor */}
            <Text
              position={[xPosition, 0.1, 7]}
              fontSize={0.6}
              color="#94a3b8"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {option.responses} votes
            </Text>
            
            {/* Option text on floor */}
            <Text
              position={[xPosition, 0.1, 8]}
              fontSize={0.6}
              color="#e2e8f0"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              maxWidth={4}
            >
              {option.text.length > 25 ? `${option.text.substring(0, 25)}...` : option.text}
            </Text>
          </group>
        );
      })}
    </group>
  );
};

// Standing Images Component (middle layer) - Wrapped in error boundary
const StandingImagesDisplay: React.FC<{
  options: ActivityOption[];
}> = ({ options }) => {
  return (
    <group>
      {options.map((option, index) => {
        if (!option.media_url || option.media_url.trim() === '') {
          return null;
        }
        
        // Calculate optimal spacing that scales with number of options
        const spacing = Math.min(5.0, Math.max(3.0, 25 / Math.max(options.length, 1)));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        const xPosition = startX + index * spacing;
        
        // Calculate bar color to match the glow - same logic as bars
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const saturation = 75;
        const lightness = 60;
        
        const glowColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <ErrorBoundary 
            key={option.id}
            fallback={<group />}
          >
            <group>
              {/* Standing image - tilted up towards camera with matching glow color */}
              <StandingImagePlane
                imageUrl={option.media_url}
                position={[xPosition, 0.75, 3]}
                fallbackText={`Option ${String.fromCharCode(65 + index)}`}
                glowColor={glowColor}
              />
            </group>
          </ErrorBoundary>
        );
      })}
    </group>
  );
};

// Main 3D Scene with Layered Layout
const Enhanced3DScene: React.FC<{ 
  options: ActivityOption[]; 
  totalResponses: number; 
  themeColors: any;
  activityTitle?: string;
  activityDescription?: string;
}> = ({ options, totalResponses, themeColors, activityTitle }) => {
  const { camera } = useThree();
  const maxResponses = Math.max(...options.map(opt => opt.responses), 1);
  const maxHeight = 4;
  
  // Camera fly-in animation
  useEffect(() => {
    // Starting position (far away)
    camera.position.set(0, 15, 40);
    
    // Animate to final position
    const animateCamera = () => {
      const targetX = 0;
      const targetY = 4; // Higher to see floor stats
      const targetZ = 15; // Closer than original 20
      
      const animationDuration = 2000; // 2 seconds
      const startTime = Date.now();
      const startPos = camera.position.clone();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Smooth easing function
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        camera.position.x = startPos.x + (targetX - startPos.x) * easeProgress;
        camera.position.y = startPos.y + (targetY - startPos.y) * easeProgress;
        camera.position.z = startPos.z + (targetZ - startPos.z) * easeProgress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    };
    
    // Start animation after a brief delay
    const timer = setTimeout(animateCamera, 100);
    
    return () => clearTimeout(timer);
  }, [camera]);
  
  // Calculate dynamic font sizes
  const titleFontSize = activityTitle ? calculateTitleFontSize(activityTitle) : 1.8;
  const descriptionFontSize = activityTitle ? calculateDescriptionFontSize(activityTitle) : 0.6;
  
  return (
    <>
      {/* Enhanced lighting setup */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={2.0} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <pointLight position={[-10, 10, 10]} intensity={0.8} color={themeColors.accentColor} />
      <pointLight position={[10, 10, -10]} intensity={0.6} color={themeColors.secondaryColor} />
      <spotLight 
        position={[0, 18, 0]} 
        intensity={1.5} 
        angle={Math.PI / 3}
        penumbra={0.3}
        color="#ffffff"
        castShadow
      />
      
      {/* Enhanced ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color="#0f172a" 
          transparent 
          opacity={0.9}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      {/* Animated grid lines */}
      <gridHelper 
        args={[100, 100, themeColors.accentColor, '#334155']} 
        position={[0, 0.01, 0]}
      />
      
      {/* Floating particles for atmosphere */}
      {Array.from({ length: 60 }).map((_, i) => (
        <Float key={i} speed={0.5 + Math.random()} rotationIntensity={0.1} floatIntensity={0.2}>
          <mesh 
            position={[
              (Math.random() - 0.5) * 80,
              Math.random() * 20 + 8,
              (Math.random() - 0.5) * 80
            ]}
          >
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial 
              color={i % 3 === 0 ? themeColors.accentColor : i % 3 === 1 ? themeColors.secondaryColor : themeColors.primaryColor}
              transparent
              opacity={0.7}
              emissive={i % 3 === 0 ? themeColors.accentColor : i % 3 === 1 ? themeColors.secondaryColor : themeColors.primaryColor}
              emissiveIntensity={0.3}
            />
          </mesh>
        </Float>
      ))}
      
      {/* LAYER 1: Floor Stats (Foreground) */}
      <FloorStatsDisplay options={options} totalResponses={totalResponses} />
      
      {/* LAYER 2: Standing Images (Middle) - Wrapped in error boundary */}
      <ErrorBoundary fallback={<group />}>
        <StandingImagesDisplay options={options} />
      </ErrorBoundary>
      
      {/* LAYER 3: 3D Bars (Background) */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.2)
          : 0.8;
        
        // Calculate optimal spacing
        const spacing = Math.min(5.0, 30 / Math.max(options.length, 1));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        
        // Enhanced color palette
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const saturation = 75;
        const lightness = 60;
        
        const barColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <Enhanced3DBar
            key={option.id}
            position={[startX + index * spacing, 0, -2]}
            height={height}
            color={barColor}
            label={option.text}
            percentage={percentage}
            responses={option.responses}
            isCorrect={option.is_correct}
            delay={index * 0.3}
            maxHeight={maxHeight}
            index={index}
          />
        );
      })}
      
      {/* ENHANCED FLOATING TITLE - Much Higher and Bigger */}
      <Float speed={0.3} rotationIntensity={0.01} floatIntensity={0.05}>
        {/* Main title with dynamic sizing - centered */}
        <Text
          position={[0, 12, -15]}
          fontSize={titleFontSize}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={25}
        >
          {activityTitle || 'Poll Options'}
        </Text>
        
        {/* Title shadow/depth effect - centered */}
        <Text
          position={[0.1, 11.9, -15.1]}
          fontSize={titleFontSize}
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
          maxWidth={25}
        >
          {activityTitle || 'Poll Options'}
        </Text>
      </Float>
    </>
  );
};

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center bg-slate-900/20 rounded-xl border border-slate-700">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white text-lg font-medium">Loading 3D Visualization...</p>
      <p className="text-slate-400 text-sm">Preparing immersive poll display with media</p>
    </div>
  </div>
);

// Main component
export const Enhanced3DPollVisualization: React.FC<Enhanced3DPollVisualizationProps> = ({ 
  options, 
  totalResponses, 
  themeColors,
  activityTitle,
  activityMedia,
  isVotingLocked,
  className = '' 
}) => {
  console.log('Enhanced3DPollVisualization: Fixed layered layout with props:', { 
    optionsCount: options.length,
    totalResponses, 
    themeColors,
    activityTitle,
    optionsWithMedia: options.filter(opt => opt.media_url && opt.media_url.trim() !== '').length
  });

  if (!options || options.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className={`w-full bg-slate-900/20 rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center ${className}`}
        style={{ height: '100%', minHeight: '500px' }}
      >
        <div className="text-center text-slate-400">
          <div className="w-16 h-16 bg-slate-700 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-lg font-medium">No poll options available</p>
          <p className="text-sm">Poll options will appear here when created</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      className={`w-full bg-gradient-to-br from-slate-900/40 to-blue-900/20 rounded-xl border border-slate-700 overflow-hidden shadow-2xl relative ${className}`}
      style={{ height: '100%', minHeight: '800px' }}
    >
      {/* Activity media display */}
      {activityMedia && (
        <div className="absolute top-4 left-4 z-10">
          <img
            src={activityMedia}
            alt="Activity media"
            className="w-32 h-24 object-cover rounded-lg border border-white/20 shadow-lg"
          />
        </div>
      )}

      {/* Enhanced overlay info */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md rounded-lg p-4 border border-white/20 z-10">
        <div className="text-white text-sm">
          <motion.div 
            key={totalResponses}
            initial={{ scale: 1.2, color: '#22c55e' }}
            animate={{ scale: 1, color: '#ffffff' }}
            transition={{ duration: 0.5 }}
            className="font-bold text-lg"
          >
            {totalResponses} Total Responses
          </motion.div>
          <div className="text-slate-300 text-xs">{options.length} Options Available</div>
          <div className="text-slate-300 text-xs">
            {options.filter(opt => opt.media_url && opt.media_url.trim() !== '').length} with media
          </div>
          <div className="text-slate-300 text-xs mt-1">
            📊 Stats • 🖼️ Images • 📈 Bars
          </div>
          {isVotingLocked && (
            <div className="mt-2 px-2 py-1 bg-red-600/20 border border-red-600/30 rounded text-red-400 text-xs">
              🔒 Voting Locked
            </div>
          )}
        </div>
      </div>
      
      {/* Enhanced status indicator */}
      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/20 z-10">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [1, 0.6, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity 
            }}
            className="w-3 h-3 bg-green-400 rounded-full"
          />
          <span className="text-green-400 text-sm font-medium">FIXED 3D</span>
        </div>
      </div>

      {/* 3D Canvas with error boundary */}
      <ErrorBoundary fallback={<LoadingFallback />}>
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            camera={{ 
              position: [0, 15, 40], // Starting position for fly-in
              fov: 75,
              near: 0.1,
              far: 1000
            }}
            style={{ 
              background: 'transparent',
              width: '100%',
              height: '100%'
            }}
            shadows
            gl={{ 
              antialias: true, 
              alpha: true,
              powerPreference: "high-performance",
              preserveDrawingBuffer: true
            }}
          >
            <Enhanced3DScene 
              options={options} 
              totalResponses={totalResponses} 
              themeColors={themeColors}
              activityTitle={activityTitle}
            />
            <OrbitControls 
              enablePan={false}
              enableZoom={true}
              enableRotate={true}
              minDistance={8}
              maxDistance={25}
              minPolarAngle={Math.PI / 8}
              maxPolarAngle={Math.PI / 2.5}
              autoRotate={false}
              rotateSpeed={0.5}
            />
          </Canvas>
        </Suspense>
      </ErrorBoundary>
    </motion.div>
  );
};