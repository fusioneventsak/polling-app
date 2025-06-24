// Poll3DVisualization.tsx - MINIMAL REAL-TIME FIX (Original Styling Preserved)
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
  
  // ONLY CHANGE: Add targetHeight state that updates when props change
  const [targetHeight, setTargetHeight] = useState(0.3);
  
  // ONLY CHANGE: Update target when height prop changes
  useEffect(() => {
    setTargetHeight(Math.max(height, 0.3));
  }, [height]);
  
  // ORIGINAL: Keep all original animation logic exactly the same
  useFrame((state) => {
    // ONLY CHANGE: Use targetHeight instead of calculating it here
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
    
    // Animate glow effect - UNCHANGED
    if (glowRef.current && responses > 0) {
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.06;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        glowRef.current.scale.y = newHeight;
        glowRef.current.position.y = newHeight / 2;
      }
      
      // Pulsing glow effect - UNCHANGED
      const pulseIntensity = 0.15 + Math.sin(state.clock.elapsedTime * 1.5 + delay) * 0.1;
      glowRef.current.material.opacity = pulseIntensity;
    }
  });

  // ORIGINAL: Keep all original color logic
  const barColor = useMemo(() => {
    if (isCorrect) return '#10b981'; // Green for correct answers
    return color;
  }, [color, isCorrect]);

  const glowColor = useMemo(() => {
    if (isCorrect) return '#34d399';
    return color;
  }, [color, isCorrect]);

  // ORIGINAL: Keep ALL original JSX exactly the same
  return (
    <group>
      {/* Base platform - UNCHANGED */}
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[0.6, 0.6, 0.1]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Main bar - UNCHANGED */}
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
      
      {/* Glow effect for bars with responses - UNCHANGED */}
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
      
      {/* Option image above the bar - UNCHANGED */}
      {imageUrl && (
        <ImagePlane 
          imageUrl={imageUrl} 
          position={[position[0], animatedHeight + 1.2, position[2]]} 
        />
      )}
      
      {/* Percentage text - UNCHANGED */}
      <Text
        position={[position[0], animatedHeight + (imageUrl ? 2.0 : 1.0), position[2]]}
        fontSize={0.4}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {percentage}%
      </Text>
      
      {/* Response count - UNCHANGED */}
      <Text
        position={[position[0], animatedHeight + (imageUrl ? 1.6 : 0.6), position[2]]}
        fontSize={0.3}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {responses}
      </Text>
      
      {/* Option label - UNCHANGED */}
      <Text
        position={[position[0], -0.5, position[2]]}
        fontSize={0.3}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
        textAlign="center"
      >
        {label}
      </Text>
    </group>
  );
};

// ORIGINAL: Scene component with minimal changes
const Scene: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
  themeColors: any;
  activityTitle?: string;
  activityMedia?: string;
}> = ({ options, totalResponses, themeColors, activityTitle, activityMedia }) => {
  const maxResponses = Math.max(...options.map(opt => opt.responses), 1);
  const maxHeight = 4;
  
  return (
    <>
      {/* ORIGINAL: Lighting setup - UNCHANGED */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />
      <spotLight position={[0, 15, 8]} angle={0.3} penumbra={1} intensity={0.6} />
      
      {/* ORIGINAL: Floor - UNCHANGED */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          color="#1a1a1a"
          metalness={0.1}
          roughness={0.9}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* ORIGINAL: Floor grid - UNCHANGED */}
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[i % 3 === 1 ? themeColors.secondaryColor : themeColors.primaryColor, -0.4, (i - 5) * 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, 30]} />
          <meshBasicMaterial 
            color={i % 3 === 1 ? themeColors.secondaryColor : themeColors.primaryColor}
            transparent
            opacity={0.4}
          />
        </mesh>
      ))}
      
      {/* ORIGINAL: Bars for each option - ONLY CHANGE: Add response count to key */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        // Always show bars with minimum height, scale based on responses if any exist
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.3)
          : 0.8; // Show visible bars even with no responses
        
        // Calculate spacing and positioning - UNCHANGED
        const spacing = Math.min(2.5, 15 / Math.max(options.length, 1));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        
        // Create gradient colors for each bar - UNCHANGED
        const hue = (index / Math.max(options.length - 1, 1)) * 280; // Spread across color spectrum
        const saturation = 70;
        const lightness = 55;
        
        const barColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${220 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <AnimatedBar
            key={`${option.id}-${option.responses}`} // ONLY CHANGE: Include responses in key
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
      
      {/* ORIGINAL: Activity media display - UNCHANGED */}
      {activityMedia && (
        <mesh position={[0, 10, -5]}>
          <planeGeometry args={[3, 2]} />
          <meshBasicMaterial transparent opacity={0.9}>
            <primitive object={new THREE.TextureLoader().load(activityMedia)} attach="map" />
          </meshBasicMaterial>
        </mesh>
      )}
      
      {/* ORIGINAL: Main title - UNCHANGED */}
      <Text
        position={[0, 8.5, -5]}
        fontSize={1.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={20}
      >
        {activityTitle || 'Poll Options'}
      </Text>
      
      {/* ORIGINAL: Title shadow for 3D effect - UNCHANGED */}
      <Text
        position={[0.05, 8.45, -5.05]}
        fontSize={1.2}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
        maxWidth={20}
      >
        {activityTitle || 'Poll Options'}
      </Text>
    </>
  );
};

// ORIGINAL: Main component with minimal changes
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

  // ORIGINAL: Always render the 3D scene, even with no responses - UNCHANGED
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

  // ORIGINAL: Return with exact same styling and structure
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      className={`w-full bg-gradient-to-br from-slate-900/40 to-blue-900/20 rounded-xl border border-slate-700 overflow-hidden shadow-2xl relative ${className}`}
      style={{ height: '100%', minHeight: '400px' }}
    >
      <Canvas
        camera={{ position: [0, 8, 16], fov: 75 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <Scene
          options={options}
          totalResponses={totalResponses}
          themeColors={themeColors}
          activityTitle={activityTitle}
          activityMedia={activityMedia}
        />
      </Canvas>
    </motion.div>
  );
};