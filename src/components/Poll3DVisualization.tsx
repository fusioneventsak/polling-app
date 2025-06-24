// Poll3DVisualization.tsx - FIXED VERSION with Real-time Updates
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
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

// FIXED: AnimatedBar with proper real-time response
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
  const [targetHeight, setTargetHeight] = useState(0.3);
  
  // FIXED: Update target height when props change (this is crucial for real-time updates)
  useEffect(() => {
    const newTarget = Math.max(height, 0.3);
    setTargetHeight(newTarget);
  }, [height, responses]);
  
  // FIXED: Animate the bar height with proper response to data changes
  useFrame((state) => {
    if (meshRef.current) {
      const currentHeight = meshRef.current.scale.y;
      const animationSpeed = 0.08; // Slightly faster for more responsive feel
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        meshRef.current.scale.y = newHeight;
        meshRef.current.position.y = newHeight / 2;
        setAnimatedHeight(newHeight);
      }
    }
    
    // Animate glow effect
    if (glowRef.current && responses > 0) {
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.08;
      
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
        position={[position[0], animatedHeight + (imageUrl ? 2.0 : 1.0), position[2]]}
        fontSize={0.4}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {percentage}%
      </Text>
      
      {/* Response count */}
      <Text
        position={[position[0], animatedHeight + (imageUrl ? 1.6 : 0.6), position[2]]}
        fontSize={0.3}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {responses} votes
      </Text>
      
      {/* Option label */}
      <Text
        position={[position[0], -0.5, position[2]]}
        fontSize={0.25}
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

// FIXED: Scene component with proper real-time data handling
const Scene: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
  themeColors: any;
  activityTitle?: string;
  activityMedia?: string;
}> = ({ options, totalResponses, themeColors, activityTitle, activityMedia }) => {
  const { camera } = useThree();
  const [maxResponses, setMaxResponses] = useState(1);
  const maxHeight = 4;
  
  // FIXED: Update maxResponses when data changes
  useEffect(() => {
    const newMax = Math.max(...options.map(opt => opt.responses), 1);
    setMaxResponses(newMax);
  }, [options]);
  
  const floorColor = useMemo(() => new THREE.Color("#1a1a1a"), []);
  const whiteColor = useMemo(() => new THREE.Color("#ffffff"), []);
  const titleShadowColor = useMemo(() => new THREE.Color("#1e293b"), []);
  
  // Camera positioning
  useEffect(() => {
    const startDistance = 80;
    const startHeight = 35;
    
    camera.position.set(0, startHeight, startDistance);
    camera.lookAt(0, 0, 0);
    
    const animateCamera = () => {
      const targetX = 0;
      const baseHeight = 12;
      const extraHeight = Math.max(0, (options.length - 3) * 2.5);
      const targetY = baseHeight + extraHeight;
      
      const baseDistance = 20;
      const distanceAdjustment = Math.max(0, (options.length - 3) * 1.5);
      const targetZ = baseDistance + distanceAdjustment;
      
      const animationDuration = 3500;
      const startTime = Date.now();
      const startPos = camera.position.clone();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        const easeProgress = progress < 0.7 
          ? Math.pow(progress, 0.4) 
          : 1 - 0.3 * Math.pow(1 - progress, 3);
        
        camera.position.x = startPos.x + (targetX - startPos.x) * easeProgress;
        camera.position.y = startPos.y + (targetY - startPos.y) * easeProgress;
        camera.position.z = startPos.z + (targetZ - startPos.z) * easeProgress;
        
        const lookAtY = 0.5 + Math.max(0, (options.length - 4) * 0.2);
        camera.lookAt(0, lookAtY, 0);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    };
    
    const timer = setTimeout(animateCamera, 100);
    return () => clearTimeout(timer);
  }, [camera, options.length]);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />
      <spotLight position={[0, 15, 8]} angle={0.3} penumbra={1} intensity={0.6} />
      
      {/* Floor */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          color={floorColor}
          metalness={0.1}
          roughness={0.9}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* Floor grid */}
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
      
      {/* FIXED: Bars for each option with proper key including response data */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.3)
          : 0.8;
        
        const spacing = Math.min(2.5, 15 / Math.max(options.length, 1));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        
        const hue = (index / Math.max(options.length - 1, 1)) * 280;
        const saturation = 70;
        const lightness = 55;
        
        const barColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${220 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <AnimatedBar
            key={`${option.id}-${option.responses}`} // FIXED: Include response count in key
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
      
      {/* Activity media display */}
      {activityMedia && (
        <mesh position={[0, 10, -5]}>
          <planeGeometry args={[3, 2]} />
          <meshBasicMaterial transparent opacity={0.9}>
            <primitive object={new THREE.TextureLoader().load(activityMedia)} attach="map" />
          </meshBasicMaterial>
        </mesh>
      )}
      
      {/* Main title */}
      <Text
        position={[0, 8.5, -5]}
        fontSize={1.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={20}
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {activityTitle || 'Poll Options'}
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
        {activityTitle || 'Poll Options'}
      </Text>
    </>
  );
};

// FIXED: Main component with proper real-time handling
export const Poll3DVisualization: React.FC<Poll3DVisualizationProps> = React.memo(({ 
  options, 
  totalResponses, 
  themeColors,
  activityTitle,
  activityMedia,
  isVotingLocked,
  className = ""
}) => {
  const [renderKey, setRenderKey] = useState(0);
  
  // FIXED: Force re-render when data changes significantly
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [options.length, totalResponses]);

  return (
    <motion.div 
      className={`w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl border border-slate-700 overflow-hidden ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      key={renderKey} // FIXED: Force re-mount on significant data changes
    >
      <Canvas
        camera={{ 
          position: [0, 12, 20], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
        dpr={[1, 2]}
      >
        <Scene
          options={options}
          totalResponses={totalResponses}
          themeColors={themeColors}
          activityTitle={activityTitle}
          activityMedia={activityMedia}
        />
      </Canvas>
      
      {/* FIXED: Real-time stats overlay */}
      <motion.div 
        className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-sm font-medium">Total Votes</div>
        <motion.div 
          className="text-2xl font-bold text-cyan-400"
          key={totalResponses} // FIXED: Animate number changes
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {totalResponses}
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

Poll3DVisualization.displayName = 'Poll3DVisualization';