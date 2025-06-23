import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import type { ActivityOption } from '../types';

interface Poll3DVisualizationProps {
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

interface BarProps {
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
}

const ImagePlane: React.FC<{ imageUrl: string; position: [number, number, number] }> = ({ imageUrl, position }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    if (imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        imageUrl,
        (loadedTexture) => {
          loadedTexture.flipY = false;
          setTexture(loadedTexture);
        },
        undefined,
        (error) => {
          console.warn('Failed to load texture:', error);
        }
      );
    }
  }, [imageUrl]);

  if (!texture) return null;

  return (
    <mesh position={position} rotation={[0, 0, 0]}>
      <planeGeometry args={[0.8, 0.6]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
};

const AnimatedBar: React.FC<BarProps> = ({ 
  position, 
  height, 
  color, 
  label, 
  percentage, 
  responses, 
  isCorrect, 
  delay,
  maxHeight,
  imageUrl
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [animatedHeight, setAnimatedHeight] = useState(0.3);
  
  // Animate the bar height
  useFrame((state) => {
    const targetHeight = Math.max(height, 0.3); // Minimum height for visibility
    
    if (meshRef.current) {
      const currentHeight = meshRef.current.scale.y;
      const animationSpeed = 0.06;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        meshRef.current.scale.y = newHeight;
        meshRef.current.position.y = newHeight / 2;
        setAnimatedHeight(newHeight);
      }
    }
    
    // Animate glow effect
    if (glowRef.current && responses > 0) {
      const targetHeight = Math.max(height, 0.3);
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.06;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        glowRef.current.scale.y = newHeight;
        glowRef.current.position.y = newHeight / 2;
      }
      
      // Pulsing glow effect
      const pulseIntensity = 0.15 + Math.sin(state.clock.elapsedTime * 1.5 + delay) * 0.1;
      glowRef.current.material.opacity = pulseIntensity;
    }
  });

  const barColor = useMemo(() => {
    if (isCorrect) return '#10b981'; // Green for correct answers
    return color;
  }, [color, isCorrect]);

  const glowColor = useMemo(() => {
    if (isCorrect) return '#34d399';
    return color;
  }, [color, isCorrect]);

  return (
    <group>
      {/* Base platform */}
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[0.6, 0.6, 0.1]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Main bar */}
      <mesh ref={meshRef} position={[position[0], 0.15, position[2]]} scale={[1, 0.3, 1]}>
        <cylinderGeometry args={[0.5, 0.5, 1]} />
        <meshStandardMaterial 
          color={barColor}
          metalness={0.3}
          roughness={0.4}
          emissive={barColor}
          emissiveIntensity={responses > 0 ? 0.15 : 0.05}
        />
      </mesh>
      
      {/* Glow effect for bars with responses */}
      {responses > 0 && (
        <mesh ref={glowRef} position={[position[0], 0.15, position[2]]} scale={[1.3, 0.3, 1.3]}>
          <cylinderGeometry args={[0.6, 0.6, 1]} />
          <meshBasicMaterial 
            color={glowColor}
            transparent
            opacity={0.15}
          />
        </mesh>
      )}
      
      {/* Option image above the bar */}
      {imageUrl && (
        <ImagePlane 
          imageUrl={imageUrl} 
          position={[position[0], animatedHeight + 1.2, position[2]]} 
        />
      )}
      
      {/* Percentage text */}
      <Text
        position={[position[0], animatedHeight + (imageUrl ? 2.2 : 1.5), position[2]]}
        fontSize={0.35}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {percentage}%
      </Text>
      
      {/* Response count */}
      <Text
        position={[position[0], animatedHeight + (imageUrl ? 1.9 : 1.2), position[2]]}
        fontSize={0.15}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {responses} {responses === 1 ? 'vote' : 'votes'}
      </Text>
      
      {/* Option label */}
      <Text
        position={[position[0], animatedHeight + (imageUrl ? 1.6 : 0.9), position[2]]}
        fontSize={0.18}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.5}
      >
        {label.length > 25 ? `${label.substring(0, 25)}...` : label}
      </Text>
      
      {/* Correct indicator */}
      {isCorrect && (
        <Text
          position={[position[0], animatedHeight + (imageUrl ? 1.3 : 0.6), position[2]]}
          fontSize={0.12}
          color="#10b981"
          anchorX="center"
          anchorY="middle"
        >
          ✓ CORRECT
        </Text>
      )}
    </group>
  );
};

const Scene: React.FC<{ 
  options: ActivityOption[]; 
  totalResponses: number; 
  themeColors: any;
  activityTitle?: string;
  activityMedia?: string;
}> = ({ 
  options, 
  totalResponses, 
  themeColors,
  activityTitle,
  activityMedia
}) => {
  const maxResponses = Math.max(...options.map(opt => opt.responses), 1);
  const maxHeight = 4; // Maximum bar height
  
  return (
    <>
      {/* Enhanced lighting setup */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 15, 5]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-8, 8, 8]} intensity={0.6} color={themeColors.accentColor} />
      <pointLight position={[8, 8, -8]} intensity={0.5} color={themeColors.secondaryColor} />
      <spotLight 
        position={[0, 12, 0]} 
        intensity={0.8} 
        angle={Math.PI / 3}
        penumbra={0.3}
        color="#ffffff"
      />
      
      {/* Enhanced ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[25, 25]} />
        <meshStandardMaterial 
          color="#0f172a" 
          transparent 
          opacity={0.9}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      
      {/* Grid lines */}
      <gridHelper 
        args={[25, 25, themeColors.accentColor, '#334155']} 
        position={[0, 0.01, 0]}
      />
      
      {/* Background atmosphere particles */}
      {Array.from({ length: 80 }).map((_, i) => (
        <mesh 
          key={i}
          position={[
            (Math.random() - 0.5) * 20,
            Math.random() * 12 + 3,
            (Math.random() - 0.5) * 20
          ]}
        >
          <sphereGeometry args={[0.03]} />
          <meshBasicMaterial 
            color={i % 3 === 0 ? themeColors.accentColor : i % 3 === 1 ? themeColors.secondaryColor : themeColors.primaryColor}
            transparent
            opacity={0.4}
          />
        </mesh>
      ))}
      
      {/* Bars for each option */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        // Always show bars with minimum height, scale based on responses if any exist
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.3)
          : 0.8; // Show visible bars even with no responses
        
        // Calculate spacing and positioning
        const spacing = Math.min(2.5, 15 / Math.max(options.length, 1));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        
        // Create gradient colors for each bar
        const hue = (index / Math.max(options.length - 1, 1)) * 280; // Spread across color spectrum
        const saturation = 70;
        const lightness = 55;
        
        const barColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${220 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <AnimatedBar
            key={option.id}
            position={[startX + index * spacing, 0, 0]}
            height={height}
            color={barColor}
            label={option.text}
            percentage={percentage}
            responses={option.responses}
            isCorrect={option.is_correct}
            delay={index * 0.2}
            maxHeight={maxHeight}
            imageUrl={option.media_url}
          />
        );
      })}
      
      {/* ENHANCED MAIN TITLE - Much Higher and More Prominent */}
      {/* Activity media display */}
      {activityMedia && (
        <mesh position={[0, 10, -5]}>
          <planeGeometry args={[3, 2]} />
          <meshBasicMaterial transparent opacity={0.9}>
            <primitive object={new THREE.TextureLoader().load(activityMedia)} attach="map" />
          </meshBasicMaterial>
        </mesh>
      )}
      
      {/* Main title - Show actual activity title instead of "Live Poll Results" */}
      <Text
        position={[0, 8.5, -5]}
        fontSize={1.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={20}
      >
        {activityTitle || 'Poll Question'}
      </Text>
      
      {/* Title shadow for 3D effect */}
      <Text
        position={[0.05, 8.45, -5.05]}
        fontSize={1.2}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
        maxWidth={20}
      >
        {activityTitle || 'Poll Question'}
      </Text>
      
    </>
  );
};

export const Poll3DVisualization: React.FC<Poll3DVisualizationProps> = ({ 
  options, 
  totalResponses, 
  themeColors,
  activityTitle,
  activityMedia,
  isVotingLocked,
  className = '' 
}) => {
  console.log('Poll3DVisualization props:', { options, totalResponses, themeColors, activityTitle });

  // Always render the 3D scene, even with no responses
  if (!options || options.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className={`w-full bg-slate-900/20 rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center ${className}`}
        style={{ height: '100%', minHeight: '400px' }}
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
      style={{ height: '100%', minHeight: '400px' }}
    >
      <Canvas
        camera={{ 
          position: [0, 6, 12], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        style={{ background: 'transparent' }}
        shadows
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <Scene 
          options={options} 
          totalResponses={totalResponses} 
          themeColors={themeColors}
          activityTitle={activityTitle}
          activityMedia={activityMedia}
        />
      </Canvas>
      
      {/* Overlay info */}
      <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-white/10">
        <div className="text-white text-sm">
          <div className="font-semibold">{totalResponses} Total Responses</div>
          <div className="text-slate-300 text-xs">{options.length} Options</div>
        </div>
      </div>
      
      {/* Voting locked indicator */}
      {isVotingLocked && (
        <div className="absolute top-4 right-4 bg-red-900/40 backdrop-blur-sm rounded-lg p-3 border border-red-600/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-400 text-xs font-medium">VOTING LOCKED</span>
          </div>
        </div>
      )}
      
      {/* Status indicator */}
      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-xs font-medium">LIVE</span>
        </div>
      </div>
    </motion.div>
  );
};