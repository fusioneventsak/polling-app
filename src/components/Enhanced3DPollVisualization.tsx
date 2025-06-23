import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, OrbitControls, Float, useTexture } from '@react-three/drei';
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

// Enhanced component for handling texture loading with better error handling
const OptionMediaPlane: React.FC<{
  imageUrl: string;
  position: [number, number, number];
}> = ({ imageUrl, position }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imageUrl || imageUrl.trim() === '') {
      setLoading(false);
      return;
    }

    console.log('OptionMediaPlane: Loading texture for URL:', imageUrl);
    setLoading(true);
    setError(false);

    const loader = new THREE.TextureLoader();
    
    loader.load(
      imageUrl,
      (loadedTexture) => {
        console.log('OptionMediaPlane: Texture loaded successfully for:', imageUrl);
        // Apply texture properties
        loadedTexture.flipY = false;
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        setTexture(loadedTexture);
        setLoading(false);
      },
      (progress) => {
        console.log('OptionMediaPlane: Loading progress:', progress);
      },
      (err) => {
        console.error('OptionMediaPlane: Failed to load texture:', imageUrl, err);
        setError(true);
        setLoading(false);
      }
    );

    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [imageUrl]);

  if (loading) {
    return (
      <mesh position={position}>
        <planeGeometry args={[2.8, 4.0]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.3} />
      </mesh>
    );
  }

  if (error || !texture) {
    return (
      <mesh position={position}>
        <planeGeometry args={[2.8, 4.0]} />
        <meshBasicMaterial color="#475569" transparent opacity={0.2} />
      </mesh>
    );
  }

  return (
    <mesh position={position}>
      <planeGeometry args={[2.8, 4.0]} />
      <meshBasicMaterial map={texture} transparent opacity={0.85} />
    </mesh>
  );
};

// 3D Bar Component with Enhanced Image Display
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
  imageUrl?: string;
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
  imageUrl,
  index
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const imagePlaneRef = useRef<THREE.Group>(null);
  const [animatedHeight, setAnimatedHeight] = useState(0.2);
  
  console.log(`Enhanced3DBar ${index}: imageUrl =`, imageUrl);
  
  // Animate the bar height and image position
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
    
    // Animate glow effect
    if (glowRef.current && responses > 0) {
      const targetHeight = Math.max(height, 0.2);
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.04;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        glowRef.current.scale.y = newHeight;
        glowRef.current.position.y = newHeight / 2;
      }
      
      // Pulsing glow effect
      const pulseIntensity = 0.1 + Math.sin(state.clock.elapsedTime * 2 + delay) * 0.05;
      if (glowRef.current.material instanceof THREE.MeshBasicMaterial) {
        glowRef.current.material.opacity = pulseIntensity;
      }
    }

    // Subtle animation for background image
    if (imagePlaneRef.current && imageUrl) {
      // Very subtle floating motion
      imagePlaneRef.current.position.y = 3.0 + Math.sin(state.clock.elapsedTime * 0.5 + delay) * 0.1;
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

  const hasValidImage = imageUrl && imageUrl.trim() !== '';

  return (
    <group>
      {/* Option media image behind the bar - ENHANCED VERSION */}
      {hasValidImage && (
        <group ref={imagePlaneRef}>
          {console.log(`Enhanced3DBar ${index}: Rendering image plane for URL:`, imageUrl)}
          
          {/* Main background image plane - positioned behind the bar */}
          <OptionMediaPlane 
            imageUrl={imageUrl} 
            position={[position[0], 3.0, position[2] - 2.5]} 
          />
          
          {/* Subtle gradient overlay to blend with scene */}
          <mesh position={[position[0], 3.0, position[2] - 2.4]}>
            <planeGeometry args={[2.8, 4.0]} />
            <meshBasicMaterial 
              transparent
              opacity={0.3}
              color="#0f172a"
            />
          </mesh>
          
          {/* Top fade mask */}
          <mesh position={[position[0], 4.8, position[2] - 2.3]}>
            <planeGeometry args={[3.0, 1.0]} />
            <meshBasicMaterial 
              transparent
              opacity={0.8}
              color="#0f172a"
            />
          </mesh>
          
          {/* Bottom fade mask */}
          <mesh position={[position[0], 1.2, position[2] - 2.3]}>
            <planeGeometry args={[3.0, 1.0]} />
            <meshBasicMaterial 
              transparent
              opacity={0.8}
              color="#0f172a"
            />
          </mesh>

          {/* Side fade masks for better blending */}
          <mesh position={[position[0] - 1.6, 3.0, position[2] - 2.3]}>
            <planeGeometry args={[0.6, 4.2]} />
            <meshBasicMaterial 
              transparent
              opacity={0.9}
              color="#0f172a"
            />
          </mesh>
          
          <mesh position={[position[0] + 1.6, 3.0, position[2] - 2.3]}>
            <planeGeometry args={[0.6, 4.2]} />
            <meshBasicMaterial 
              transparent
              opacity={0.9}
              color="#0f172a"
            />
          </mesh>
        </group>
      )}
      
      {/* Base platform with enhanced design */}
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[1.2, 1.2, 0.1]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.8}
          roughness={0.2}
          emissive="#1e293b"
          emissiveIntensity={0.1}
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
      
      {/* 3D Text Labels with better positioning */}
      <Float speed={0.5} rotationIntensity={0.05} floatIntensity={0.1}>
        {/* Percentage - Large and prominent */}
        <Text
          position={[position[0], animatedHeight + 2.8, position[2]]}
          fontSize={0.6}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {percentage}%
        </Text>
        
        {/* Response count */}
        <Text
          position={[position[0], animatedHeight + 2.2, position[2]]}
          fontSize={0.35}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
        >
          {responses} {responses === 1 ? 'vote' : 'votes'}
        </Text>
        
        {/* Option label */}
        <Text
          position={[position[0], animatedHeight + 1.8, position[2]]}
          fontSize={0.4}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.5}
        >
          {label.length > 20 ? `${label.substring(0, 20)}...` : label}
        </Text>
        
        {/* Correct indicator */}
        {isCorrect && (
          <Text
            position={[position[0], animatedHeight + 1.4, position[2]]}
            fontSize={0.3}
            color="#10b981"
            anchorX="center"
            anchorY="middle"
          >
            ✓ CORRECT
          </Text>
        )}
      </Float>
      
      {/* 3D Percentage on the floor in front of the bar */}
      <Text
        position={[position[0], 0.1, position[2] + 2.0]}
        fontSize={0.8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {percentage}%
      </Text>
      
      {/* 3D Percentage shadow for depth effect */}
      <Text
        position={[position[0], 0.05, position[2] + 2.05]}
        fontSize={0.8}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {percentage}%
      </Text>

      {/* Option letter indicator on the base */}
      <Text
        position={[position[0], 0.15, position[2] - 1.5]}
        fontSize={0.5}
        color="#64748b"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {String.fromCharCode(65 + index)}
      </Text>
    </group>
  );
};

// Camera controller for optimal viewing
const CameraController: React.FC<{ optionsCount: number }> = ({ optionsCount }) => {
  const { camera } = useThree();
  
  useFrame(() => {
    // Position camera to show title prominently and avoid bar overlap
    const distance = Math.max(10, optionsCount * 1.2);
    
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.02);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, distance, 0.02);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 5, 0.02);
    
    // Look at a point that shows both title and bars well
    camera.lookAt(0, 2, 0);
  });
  
  return null;
};

// Main 3D Scene with Enhanced Title
const Enhanced3DScene: React.FC<{ 
  options: ActivityOption[]; 
  totalResponses: number; 
  themeColors: any;
  activityTitle?: string;
}> = ({ options, totalResponses, themeColors, activityTitle }) => {
  const maxResponses = Math.max(...options.map(opt => opt.responses), 1);
  const maxHeight = 4;
  
  console.log('Enhanced3DScene: Rendering with options:', options.map(opt => ({
    id: opt.id,
    text: opt.text,
    media_url: opt.media_url,
    responses: opt.responses
  })));
  
  return (
    <>
      {/* Enhanced lighting setup */}
      <ambientLight intensity={0.5} />
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
        <planeGeometry args={[60, 60]} />
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
        args={[60, 60, themeColors.accentColor, '#334155']} 
        position={[0, 0.01, 0]}
      />
      
      {/* Floating particles for atmosphere */}
      {Array.from({ length: 80 }).map((_, i) => (
        <Float key={i} speed={0.5 + Math.random()} rotationIntensity={0.1} floatIntensity={0.2}>
          <mesh 
            position={[
              (Math.random() - 0.5) * 50,
              Math.random() * 20 + 8,
              (Math.random() - 0.5) * 50
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
      
      {/* 3D Bars for each option */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.2)
          : 0.8;
        
        // Calculate optimal spacing to prevent overlap and show images properly
        const spacing = Math.min(4.0, 25 / Math.max(options.length, 1));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        
        // Enhanced color palette
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const saturation = 75;
        const lightness = 60;
        
        const barColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, ${saturation}%, ${lightness}%)`;
        
        console.log(`Enhanced3DScene: Creating bar ${index} with imageUrl:`, option.media_url);
        
        return (
          <Enhanced3DBar
            key={option.id}
            position={[startX + index * spacing, 0, 1]}
            height={height}
            color={barColor}
            label={option.text}
            percentage={percentage}
            responses={option.responses}
            isCorrect={option.is_correct}
            delay={index * 0.3}
            maxHeight={maxHeight}
            imageUrl={option.media_url}
            index={index}
          />
        );
      })}
      
      {/* ENHANCED FLOATING TITLE - Much Higher and Bigger */}
      <Float speed={0.3} rotationIntensity={0.01} floatIntensity={0.05}>
        {/* Main title with thick 3D effect */}
        <Text
          position={[0, 9, -10]}
          fontSize={2.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {totalResponses > 0 ? 'Live Poll Results' : (activityTitle || 'Poll Options')}
        </Text>
        
        {/* Title shadow/depth effect */}
        <Text
          position={[0.1, 8.9, -10.1]}
          fontSize={2.2}
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
        >
          {totalResponses > 0 ? 'Live Poll Results' : (activityTitle || 'Poll Options')}
        </Text>
        
        {/* Subtitle */}
        <Text
          position={[0, 8.2, -10]}
          fontSize={0.8}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
        >
          {totalResponses > 0 ? `${totalResponses} total responses` : 'Waiting for responses...'}
        </Text>
        
        {/* Activity title if different from main title */}
        {activityTitle && totalResponses > 0 && (
          <Text
            position={[0, 7.6, -10]}
            fontSize={0.6}
            color="#e2e8f0"
            anchorX="center"
            anchorY="middle"
            maxWidth={15}
          >
            {activityTitle}
          </Text>
        )}
      </Float>
      
      {/* Camera controller */}
      <CameraController optionsCount={options.length} />
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
  console.log('Enhanced3DPollVisualization: Received props:', { 
    optionsCount: options.length,
    totalResponses, 
    themeColors,
    activityTitle,
    optionsWithMedia: options.filter(opt => opt.media_url && opt.media_url.trim() !== '').length
  });

  // Log each option's media URL for debugging
  options.forEach((option, index) => {
    console.log(`Enhanced3DPollVisualization: Option ${index} (${option.text}) media_url:`, option.media_url);
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
      style={{ height: '100%', minHeight: '700px' }}
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
          <span className="text-green-400 text-sm font-medium">LIVE 3D</span>
        </div>
      </div>

      {/* 3D Canvas */}
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ 
            position: [0, 6, 15], 
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
            maxPolarAngle={Math.PI / 2}
            autoRotate={false}
            rotateSpeed={0.5}
          />
        </Canvas>
      </Suspense>
    </motion.div>
  );
};