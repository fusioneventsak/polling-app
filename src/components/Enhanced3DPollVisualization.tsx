// Enhanced3DPollVisualization.tsx - REAL-TIME FIX with Original Features
import React, { useRef, useMemo, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Float, OrbitControls, Environment, Stars } from '@react-three/drei';
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

// FINAL: Amphitheater curve TOWARD camera for all options
const getCurvedPosition = (index: number, totalCount: number, radius: number = 28) => {
  // For small counts, use straight line with MASSIVE spacing
  if (totalCount <= 2) {
    const spacing = 25;
    const totalWidth = (totalCount - 1) * spacing;
    const startX = -totalWidth / 2;
    return { x: startX + index * spacing, z: 2, rotationY: 0 }; // FORWARD toward camera
  }
  
  // For 3 options, curve TOWARD camera
  if (totalCount === 3) {
    const positions = [
      { x: -25, z: 0, rotationY: 0.2 },   // CURVE FORWARD
      { x: 0, z: 3, rotationY: 0 },       // CENTER FORWARD
      { x: 25, z: 0, rotationY: -0.2 }    // CURVE FORWARD
    ];
    return positions[index];
  }
  
  // For 4+ options, AMPHITHEATER CURVE TOWARD CAMERA
  const adjustedRadius = Math.max(radius, totalCount * 5);
  const maxAngle = Math.min(Math.PI * 1.1, totalCount * 0.35);
  const angleStep = maxAngle / Math.max(totalCount - 1, 1);
  const startAngle = -maxAngle / 2;
  const angle = startAngle + index * angleStep;
  
  return {
    x: Math.sin(angle) * adjustedRadius,
    z: Math.cos(angle) * adjustedRadius * 0.4 + 5, // CURVE TOWARD CAMERA (+5 instead of -2)
    rotationY: angle * 0.3
  };
};

// ORIGINAL: Calculate font size helper
const calculateFitFontSize = (text: string, maxWidth: number) => {
  const baseSize = 0.8;
  const charWidth = 0.6;
  const estimatedWidth = text.length * charWidth * baseSize;
  
  if (estimatedWidth > maxWidth * 0.8) {
    return {
      fontSize: Math.max(0.4, (maxWidth * 0.8) / (text.length * charWidth)),
      displayText: text.length > 25 ? text.substring(0, 22) + '...' : text,
      maxWidth: maxWidth * 0.8
    };
  }
  
  return {
    fontSize: baseSize,
    displayText: text,
    maxWidth: maxWidth * 0.8
  };
};

// ORIGINAL: Calculate title font size
const calculateTitleFontSize = (title?: string) => {
  if (!title) return 1.8;
  const length = title.length;
  if (length <= 15) return 2.2;
  if (length <= 30) return 1.8;
  if (length <= 50) return 1.4;
  return 1.0;
};

// FIXED: Standing Image Plane - PROPERLY RIGHT-SIDE UP
const StandingImagePlane: React.FC<{
  imageUrl: string;
  position: [number, number, number];
  fallbackText: string;
  glowColor: string;
}> = ({ imageUrl, position, fallbackText, glowColor }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hasError, setHasError] = useState(false);
  
  const glowColorObj = useMemo(() => new THREE.Color(glowColor), [glowColor]);
  
  useEffect(() => {
    if (imageUrl && imageUrl.trim() !== '') {
      const loader = new THREE.TextureLoader();
      loader.load(
        imageUrl,
        (loadedTexture) => {
          loadedTexture.flipY = true; // FIXED: Flip Y to make images right-side up
          setTexture(loadedTexture);
          setHasError(false);
        },
        undefined,
        (error) => {
          console.warn('Failed to load texture:', error);
          setHasError(true);
        }
      );
    }
  }, [imageUrl]);

  // FIXED: Much larger images
  const imageWidth = 6; // Increased from 3.5
  const imageHeight = 4.5; // Increased from 2.8
  const imageY = imageHeight / 2 + 0.2;

  if (hasError || !texture) {
    return (
      <group>
        <mesh position={[position[0], imageY, position[2]]} rotation={[0, 0, 0]}>
          <planeGeometry args={[imageWidth, imageHeight]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <Text
          position={[position[0], imageY, position[2] + 0.01]}
          fontSize={0.4}
          color="#9ca3af"
          anchorX="center"
          anchorY="middle"
        >
          {fallbackText}
        </Text>
      </group>
    );
  }

  return (
    <group>
      {/* Main image - RIGHT-SIDE UP with flipY = true */}
      <mesh position={[position[0], imageY, position[2]]} rotation={[0, 0, 0]} renderOrder={10}>
        <planeGeometry args={[imageWidth, imageHeight]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
      
      {/* Glow effects */}
      <mesh position={[position[0], imageY, position[2] - 0.01]} rotation={[0, 0, 0]} renderOrder={9}>
        <planeGeometry args={[imageWidth + 0.2, imageHeight + 0.2]} />
        <meshBasicMaterial 
          color={glowColorObj}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ORIGINAL: Simplified Light Beam Component
const SimplifiedLightBeam: React.FC<{
  position: [number, number, number];
  color: string;
  intensity: number;
  responses: number;
}> = ({ position, color, intensity, responses }) => {
  const beamRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  
  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  
  useFrame((state) => {
    if (lightRef.current && responses > 0) {
      const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 1.5) * 0.2;
      lightRef.current.intensity = intensity * pulse;
    }
  });

  return (
    <group ref={beamRef}>
      <spotLight
        ref={lightRef}
        position={[position[0], 25, position[2]]}
        target-position={[position[0], 0, position[2]]}
        color={threeColor}
        intensity={responses > 0 ? intensity * 2 : intensity * 0.5}
        angle={Math.PI / 8}
        penumbra={0.4}
        distance={30}
        decay={1.5}
        castShadow={false}
      />
      
      <mesh 
        position={[position[0], 12, position[2]]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[0.3, 2.0, 20, 16]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={responses > 0 ? 0.08 : 0.02}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      <mesh 
        position={[position[0], 12, position[2]]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[0.25, 1.7, 20, 16]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={responses > 0 ? 0.05 : 0.01}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      <mesh 
        position={[position[0], 0.02, position[2]]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[2.5, 16]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={responses > 0 ? 0.2 : 0.05}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ORIGINAL: Enhanced 3D Bar with REAL-TIME FIX
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
  rotationY?: number;
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
  index,
  rotationY = 0
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  // REAL-TIME FIX: Add target height state
  const [targetHeight, setTargetHeight] = useState(0.2);
  
  // REAL-TIME FIX: Update target when height prop changes
  useEffect(() => {
    setTargetHeight(Math.max(height, 0.2));
  }, [height, responses]);
  
  const barColorValue = isCorrect ? '#10b981' : color;
  const glowColorValue = isCorrect ? '#34d399' : color;
  
  const barColor = useMemo(() => new THREE.Color(barColorValue), [barColorValue]);
  const glowColor = useMemo(() => new THREE.Color(glowColorValue), [glowColorValue]);
  const baseColor = useMemo(() => new THREE.Color("#1e293b"), []);
  
  // REAL-TIME FIX: Use targetHeight in animation
  useFrame((state) => {
    if (meshRef.current) {
      const currentHeight = meshRef.current.scale.y;
      const animationSpeed = 0.05; // Slightly faster for responsiveness
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        meshRef.current.scale.y = newHeight;
        meshRef.current.position.y = newHeight / 2;
      }
    }
    
    if (glowRef.current && responses > 0) {
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.05;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        glowRef.current.scale.y = newHeight;
        glowRef.current.position.y = newHeight / 2;
      }
      
      const pulseIntensity = 0.1 + Math.sin(state.clock.elapsedTime * 2 + delay) * 0.05;
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      if (material && typeof material.opacity !== 'undefined') {
        material.opacity = pulseIntensity;
      }
    }
  });

  return (
    <group>
      <group rotation={[0, -(rotationY || 0), 0]}>
        <SimplifiedLightBeam
          position={position}
          color={barColorValue}
          intensity={responses > 0 ? 0.8 : 0.3}
          responses={responses}
        />
        
        {/* MUCH LARGER base platform */}
        <mesh position={[position[0], 0.1, position[2]]}>
          <cylinderGeometry args={[2.0, 2.0, 0.3]} />
          <meshStandardMaterial 
            color={baseColor}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        
        {/* MUCH LARGER main bar */}
        <mesh ref={meshRef} position={[position[0], 0.3, position[2]]} scale={[1, 0.2, 1]}>
          <cylinderGeometry args={[1.6, 1.6, 1]} />
          <meshStandardMaterial 
            color={barColor}
            metalness={0.4}
            roughness={0.3}
            emissive={barColor}
            emissiveIntensity={responses > 0 ? 0.2 : 0.05}
          />
        </mesh>
        
        {/* MUCH LARGER glow effect */}
        {responses > 0 && (
          <mesh ref={glowRef} position={[position[0], 0.3, position[2]]} scale={[1.3, 0.2, 1.3]}>
            <cylinderGeometry args={[1.8, 1.8, 1]} />
            <meshBasicMaterial 
              color={glowColor}
              transparent
              opacity={0.15}
            />
          </mesh>
        )}
      </group>
    </group>
  );
};

// FIXED: Floor Stats Display - SMALLER CONTAINERS, no collisions
const FloorStatsDisplay: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
}> = ({ options, totalResponses }) => {
  const floorColor = useMemo(() => new THREE.Color("#1a1a1a"), []);
  const shadowColor = useMemo(() => new THREE.Color("#0f172a"), []);
  
  return (
    <group>
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        
        // FINAL: MUCH LARGER spacing to prevent ANY collisions
        const baseSpacing = 16; // Increased from 10
        const spacing = Math.max(baseSpacing, Math.min(20, 120 / Math.max(options.length, 1))); // Much larger calculation 
        
        const curvedPos = getCurvedPosition(index, options.length, 28);
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const barColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        const barColor = useMemo(() => new THREE.Color(barColorValue), [barColorValue]);
        
        const textProps = calculateFitFontSize(option.text, spacing);
        
        return (
          <group key={`${option.id}-${option.responses}`}>
            <group rotation={[0, -(curvedPos.rotationY || 0), 0]}>
              {/* Floor panel - positioned forward in amphitheater */}
              <mesh position={[curvedPos.x, 0.05, curvedPos.z + 7]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[spacing * 0.3, 8]} />
                <meshStandardMaterial 
                  color={floorColor}
                  transparent
                  opacity={0.9}
                  metalness={0.3}
                  roughness={0.7}
                />
              </mesh>
              
              {/* Glow panel - positioned forward */}
              <mesh position={[curvedPos.x, 0.04, curvedPos.z + 7]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[spacing * 0.35, 8.3]} />
                <meshBasicMaterial 
                  color={barColor}
                  transparent
                  opacity={0.3}
                />
              </mesh>
              
              {/* Percentage text - forward position */}
              <Text
                position={[curvedPos.x, 0.15, curvedPos.z + 4.5]}
                fontSize={1.5}
                color={barColorValue}
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
                outlineWidth={0.05}
                outlineColor={shadowColor}
                fillOpacity={1}
              >
                {percentage}%
              </Text>
              
              {/* Vote count - forward position */}
              <Text
                position={[curvedPos.x, 0.12, curvedPos.z + 7]}
                fontSize={0.8}
                color="#94a3b8"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                {option.responses} votes
              </Text>
              
              {/* Option text - forward position */}
              <Text
                position={[curvedPos.x, 0.12, curvedPos.z + 9.5]}
                fontSize={textProps.fontSize * 0.8}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
                maxWidth={textProps.maxWidth * 0.6}
                outlineWidth={Math.max(0.01, textProps.fontSize * 0.02)}
                outlineColor="#1e293b"
                textAlign="center"
                lineHeight={1.2}
              >
                {textProps.displayText}
              </Text>
            </group>
          </group>
        );
      })}
    </group>
  );
};

// FIXED: Standing Images Display - MIDDLE LAYER, clear separation
const StandingImagesDisplay: React.FC<{
  options: ActivityOption[];
}> = ({ options }) => {
  return (
    <group>
      {options.map((option, index) => {
        if (!option.media_url || option.media_url.trim() === '') {
          return null;
        }
        
        // FIXED: Use same radius and positioning as other elements
        const curvedPos = getCurvedPosition(index, options.length, 28);
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const glowColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        
        return (
          <group key={option.id}>
            <group rotation={[0, -(curvedPos.rotationY || 0), 0]}>
              <StandingImagePlane
                imageUrl={option.media_url}
                position={[curvedPos.x, 0, curvedPos.z + 2]} // Images in front of bars, behind stats
                fallbackText={`Option ${String.fromCharCode(65 + index)}`}
                glowColor={glowColorValue}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
};

// ORIGINAL: Main 3D Scene with REAL-TIME FIX
const Enhanced3DScene: React.FC<{ 
  options: ActivityOption[]; 
  totalResponses: number; 
  themeColors: any;
  activityTitle?: string;
}> = ({ options, totalResponses, themeColors, activityTitle }) => {
  const { camera } = useThree();
  const [maxResponses, setMaxResponses] = useState(1); // REAL-TIME FIX: State for maxResponses
  const maxHeight = 4;
  
  // REAL-TIME FIX: Update maxResponses when data changes
  useEffect(() => {
    const newMax = Math.max(...options.map(opt => opt.responses), 1);
    setMaxResponses(newMax);
  }, [options]);
  
  const floorColor = useMemo(() => new THREE.Color("#1a1a1a"), []);
  const titleShadowColor = useMemo(() => new THREE.Color("#1e293b"), []);
  
  // FIXED: Camera distance scales properly with option count + guaranteed fly-in
  useEffect(() => {
    const startDistance = 80; // Further back starting position
    const startHeight = 35;
    
    // ALWAYS start from far away for dramatic fly-in
    camera.position.set(0, startHeight, startDistance);
    camera.lookAt(0, 0, 0);
    
    const animateCamera = () => {
      const targetX = 0;
      
      // FIXED: Camera scales properly with option count
      const baseHeight = 15;
      const extraHeight = Math.max(0, (options.length - 3) * 1.5); // More height for more options
      const targetY = baseHeight + extraHeight;
      
      // FIXED: Much further distance for polls with many options
      const baseDistance = 25;
      const distanceAdjustment = Math.max(0, (options.length - 3) * 4); // Much more distance per option
      const targetZ = baseDistance + distanceAdjustment;
      
      const animationDuration = 4000; // Longer for more dramatic effect
      const startTime = Date.now();
      const startPos = camera.position.clone();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Smooth cinematic easing
        const easeProgress = progress < 0.6 
          ? Math.pow(progress, 0.3) // Slow start
          : 1 - 0.4 * Math.pow(1 - progress, 4); // Smooth deceleration
        
        camera.position.x = startPos.x + (targetX - startPos.x) * easeProgress;
        camera.position.y = startPos.y + (targetY - startPos.y) * easeProgress;
        camera.position.z = startPos.z + (targetZ - startPos.z) * easeProgress;
        
        // Look at center of amphitheater
        const lookAtY = 2;
        camera.lookAt(0, lookAtY, 0);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    };
    
    // ALWAYS trigger fly-in animation
    const timer = setTimeout(animateCamera, 200); // Slight delay for better effect
    return () => clearTimeout(timer);
  }, [camera, options.length]);
  
  const titleFontSize = calculateTitleFontSize(activityTitle);
  
  return (
    <>
      {/* ORIGINAL: Enhanced lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight 
        position={[-10, 15, 10]} 
        intensity={0.8} 
        color="#ffffff"
      />
      <pointLight position={[0, 15, 5]} intensity={0.6} color="#ffffff" />
      
      {/* ORIGINAL: Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color={floorColor} 
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      {/* ORIGINAL: Floor stats and images */}
      <FloorStatsDisplay options={options} totalResponses={totalResponses} />
      <StandingImagesDisplay options={options} />
      
      {/* FIXED: 3D Bars - BACK LAYER, properly scaled */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.5)
          : 1.2; // Larger minimum height
        
        const curvedPos = getCurvedPosition(index, options.length, 28);
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const barColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        
        return (
          <Enhanced3DBar
            key={`${option.id}-${option.responses}`}
            position={[curvedPos.x, 0, curvedPos.z - 2]} // Bars behind images
            height={height}
            color={barColorValue}
            label={option.text}
            percentage={percentage}
            responses={option.responses}
            isCorrect={option.is_correct}
            delay={index * 0.3}
            maxHeight={maxHeight}
            index={index}
            rotationY={curvedPos.rotationY}
          />
        );
      })}
      
      {/* FIXED: Title/Question IN FRONT of colored lights */}
      <Float speed={0.3} rotationIntensity={0.01} floatIntensity={0.05}>
        <Text
          position={[0, 12, 8]} // MOVED FORWARD - in front of lights
          fontSize={titleFontSize}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={30}
          outlineWidth={0.08}
          outlineColor="#000000"
          renderOrder={100} // Ensure it renders in front
        >
          {activityTitle || 'Poll Options'}
        </Text>
        
        {/* Title shadow */}
        <Text
          position={[0.1, 11.9, 7.9]} // Shadow slightly behind
          fontSize={titleFontSize}
          color={titleShadowColor}
          anchorX="center"
          anchorY="middle"
          maxWidth={30}
          renderOrder={99}
        >
          {activityTitle || 'Poll Options'}
        </Text>
      </Float>
    </>
  );
};

// ORIGINAL: Loading component
const LoadingFallback: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center bg-slate-900/20 rounded-xl border border-slate-700">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white text-lg font-medium">Loading 3D Visualization...</p>
      <p className="text-slate-400 text-sm">Preparing immersive poll display</p>
    </div>
  </div>
);

// ORIGINAL: Main component with REAL-TIME FIX
export const Enhanced3DPollVisualization: React.FC<Enhanced3DPollVisualizationProps> = ({ 
  options, 
  totalResponses, 
  themeColors,
  activityTitle,
  activityMedia,
  isVotingLocked,
  className = ''
}) => {
  const [renderKey, setRenderKey] = useState(0); // REAL-TIME FIX: Force re-render key
  
  // REAL-TIME FIX: Update render key when significant changes occur
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [options.length]);

  if (!options || options.length === 0) {
    return <LoadingFallback />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      className={`w-full h-full bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl relative ${className}`}
    >
      {/* ORIGINAL: Voting locked indicator */}
      {isVotingLocked && (
        <div className="absolute top-4 right-4 bg-red-900/40 backdrop-blur-sm rounded-lg p-3 border border-red-600/30 z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-400 text-xs font-medium">VOTING LOCKED</span>
          </div>
        </div>
      )}

      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          key={`canvas-${renderKey}`} // REAL-TIME FIX: Force canvas re-render
          camera={{ 
            position: [0, 12, 35],
            fov: 75,
            near: 0.1,
            far: 1000
          }}
          style={{ 
            background: 'transparent',
            width: '100%',
            height: '100%',
            display: 'block'
          }}
          shadows
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true,
            pixelRatio: Math.min(window.devicePixelRatio, 2)
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
            minDistance={Math.max(15, 28 - options.length * 1)} // FIXED: Closer min for small polls
            maxDistance={Math.max(45, options.length * 6)} // FIXED: Much further max for big polls
            minPolarAngle={Math.PI / 40}
            maxPolarAngle={Math.PI / 2.0}
            autoRotate={false}
            rotateSpeed={0.4}
            target={[0, 2, 2]} // Look at amphitheater center
          />
        </Canvas>
      </Suspense>
    </motion.div>
  );
};