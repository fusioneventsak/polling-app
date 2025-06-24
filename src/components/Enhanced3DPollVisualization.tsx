// Enhanced3DPollVisualization.tsx - FIXED VERSION with Real-time Updates
import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Float, useTexture } from '@react-three/drei';
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

interface Enhanced3DBarProps {
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
}

// FIXED: Enhanced 3D Bar with proper real-time animation
const Enhanced3DBar: React.FC<Enhanced3DBarProps> = ({ 
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
  const [animatedHeight, setAnimatedHeight] = useState(0.3);
  const [targetHeight, setTargetHeight] = useState(0.3);
  
  // FIXED: Update target height when props change
  useEffect(() => {
    const newTarget = Math.max(height, 0.3);
    setTargetHeight(newTarget);
  }, [height, responses]);
  
  // FIXED: Smooth animation with proper real-time updates
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
    
    // FIXED: Glow effect animation
    if (glowRef.current && responses > 0) {
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.08;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        glowRef.current.scale.y = newHeight;
        glowRef.current.position.y = newHeight / 2;
      }
      
      // Enhanced pulsing glow effect
      const pulseIntensity = 0.2 + Math.sin(state.clock.elapsedTime * 2 + delay) * 0.15;
      glowRef.current.material.opacity = pulseIntensity;
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
      {/* Enhanced base platform with animated glow */}
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.9}
          roughness={0.1}
          emissive="#1e293b"
          emissiveIntensity={responses > 0 ? 0.1 : 0.05}
        />
      </mesh>
      
      {/* Main animated bar */}
      <mesh ref={meshRef} position={[position[0], 0.15, position[2]]} scale={[1, animatedHeight, 1]}>
        <cylinderGeometry args={[0.6, 0.6, 1]} />
        <meshStandardMaterial 
          color={barColor}
          metalness={0.4}
          roughness={0.3}
          emissive={barColor}
          emissiveIntensity={responses > 0 ? 0.2 : 0.05}
        />
      </mesh>
      
      {/* Enhanced glow effect for active bars */}
      {responses > 0 && (
        <mesh ref={glowRef} position={[position[0], 0.15, position[2]]} scale={[1.4, animatedHeight, 1.4]}>
          <cylinderGeometry args={[0.7, 0.7, 1]} />
          <meshBasicMaterial 
            color={glowColor}
            transparent
            opacity={0.2}
          />
        </mesh>
      )}
      
      {/* Percentage text with enhanced styling */}
      <Text
        position={[position[0], animatedHeight + 0.8, position[2]]}
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
        position={[position[0], animatedHeight + 0.4, position[2]]}
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
const Enhanced3DScene: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
  themeColors: any;
  activityTitle?: string;
}> = ({ options, totalResponses, themeColors, activityTitle }) => {
  const { camera } = useThree();
  const [maxResponses, setMaxResponses] = useState(1);
  const maxHeight = 4;
  
  // FIXED: Update maxResponses when data changes
  useEffect(() => {
    const newMax = Math.max(...options.map(opt => opt.responses), 1);
    setMaxResponses(newMax);
  }, [options]);
  
  const floorColor = useMemo(() => new THREE.Color("#1a1a1a"), []);
  const titleShadowColor = useMemo(() => new THREE.Color("#1e293b"), []);
  
  // FIXED: Camera positioning for better view
  useEffect(() => {
    const baseDistance = 18;
    const distanceAdjustment = Math.max(0, (options.length - 3) * 1.5);
    const targetZ = baseDistance + distanceAdjustment;
    
    const baseHeight = 10;
    const extraHeight = Math.max(0, (options.length - 3) * 2);
    const targetY = baseHeight + extraHeight;
    
    camera.position.set(0, targetY, targetZ);
    camera.lookAt(0, 2, 0);
  }, [camera, options.length]);
  
  // FIXED: Get curved position for bars
  const getCurvedPosition = useCallback((index: number, totalCount: number) => {
    if (totalCount <= 3) {
      const spacing = 3;
      const totalWidth = (totalCount - 1) * spacing;
      const startX = -totalWidth / 2;
      return { x: startX + index * spacing, z: 0 };
    }
    
    const radius = Math.max(8, totalCount * 1.2);
    const angleStep = (Math.PI * 1.2) / Math.max(totalCount - 1, 1);
    const startAngle = -Math.PI * 0.6;
    const angle = startAngle + index * angleStep;
    
    return {
      x: Math.sin(angle) * radius,
      z: Math.cos(angle) * radius * 0.3
    };
  }, []);
  
  const titleFontSize = useMemo(() => {
    if (!activityTitle) return 1.0;
    const length = activityTitle.length;
    if (length <= 20) return 1.2;
    if (length <= 40) return 1.0;
    if (length <= 60) return 0.8;
    return 0.6;
  }, [activityTitle]);
  
  return (
    <>
      {/* Enhanced lighting setup */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />
      <spotLight position={[0, 15, 8]} angle={0.3} penumbra={1} intensity={0.7} />
      
      {/* Enhanced floor with grid pattern */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          color={floorColor}
          metalness={0.1}
          roughness={0.9}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* FIXED: Bars with real-time updates */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.2)
          : 0.8;
        
        const curvedPos = getCurvedPosition(index, options.length);
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const barColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        
        return (
          <Enhanced3DBar
            key={`${option.id}-${option.responses}`} // FIXED: Key includes responses for proper re-rendering
            position={[curvedPos.x, 0, curvedPos.z]}
            height={height}
            color={barColorValue}
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
      
      {/* Enhanced floating title */}
      <Float speed={0.3} rotationIntensity={0.01} floatIntensity={0.05}>
        <Text
          position={[0, 10, -2]}
          fontSize={titleFontSize}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={25}
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {activityTitle || 'Poll Options'}
        </Text>
        
        <Text
          position={[0.1, 9.9, -2.1]}
          fontSize={titleFontSize}
          color={titleShadowColor}
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

// FIXED: Loading component
const LoadingFallback: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center bg-slate-900/20 rounded-xl border border-slate-700">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white text-lg font-medium">Loading 3D Visualization...</p>
      <p className="text-slate-400 text-sm">Preparing real-time poll display</p>
    </div>
  </div>
);

// FIXED: Main component with proper memo and real-time handling
export const Enhanced3DPollVisualization: React.FC<Enhanced3DPollVisualizationProps> = React.memo(({ 
  options, 
  totalResponses, 
  themeColors,
  activityTitle,
  activityMedia,
  isVotingLocked,
  className = ""
}) => {
  const [isClient, setIsClient] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  
  // FIXED: Ensure client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // FIXED: Force re-render when data changes significantly
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [options.length, totalResponses]);

  if (!isClient) {
    return <LoadingFallback />;
  }

  return (
    <motion.div 
      className={`w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl border border-slate-700 overflow-hidden ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      key={renderKey} // FIXED: Force re-mount on data changes
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
        <Enhanced3DScene
          options={options}
          totalResponses={totalResponses}
          themeColors={themeColors}
          activityTitle={activityTitle}
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

Enhanced3DPollVisualization.displayName = 'Enhanced3DPollVisualization';