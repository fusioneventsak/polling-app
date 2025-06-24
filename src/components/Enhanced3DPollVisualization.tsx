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

// FIXED: Amphitheater positioning - MUCH MORE SPACING, prevent crowding
const getCurvedPosition = (index: number, totalCount: number, radius: number = 20) => {
  // For small counts, use straight line with MASSIVE spacing
  if (totalCount <= 2) {
    const spacing = 15; // Much larger spacing
    const totalWidth = (totalCount - 1) * spacing;
    const startX = -totalWidth / 2;
    return { x: startX + index * spacing, z: 0, rotationY: 0 };
  }
  
  // For 3 options, wide spacing
  if (totalCount === 3) {
    const positions = [
      { x: -15, z: -2, rotationY: 0.4 },
      { x: 0, z: 0, rotationY: 0 },
      { x: 15, z: -2, rotationY: -0.4 }
    ];
    return positions[index];
  }
  
  // For 4+ options, PREVENT CROWDING with much larger radius
  const adjustedRadius = Math.max(radius, totalCount * 4); // Much larger multiplier to prevent crowding
  const maxAngle = Math.min(Math.PI * 1.1, totalCount * 0.3); // Wider but controlled arc
  const angleStep = maxAngle / Math.max(totalCount - 1, 1);
  const startAngle = -maxAngle / 2;
  const angle = startAngle + index * angleStep;
  
  return {
    x: Math.sin(angle) * adjustedRadius,
    z: Math.cos(angle) * adjustedRadius * 0.3 - 2, // Curve back away from camera
    rotationY: angle * 0.5
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

// FIXED: Standing Image Plane - RIGHT-SIDE UP and LARGER
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
          loadedTexture.flipY = false;
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

  // FIXED: Much larger images, RIGHT-SIDE UP
  const imageWidth = 4; // Increased from 2.4
  const imageHeight = 3; // Increased from 1.8
  const tiltAngle = 0; // FIXED: No tilt = right-side up
  const imageY = imageHeight / 2 + 0.1;

  if (hasError || !texture) {
    return (
      <group>
        <mesh position={[position[0], imageY, position[2]]} rotation={[0, 0, 0]}>
          <planeGeometry args={[imageWidth, imageHeight]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <Text
          position={[position[0], imageY, position[2] + 0.01]}
          fontSize={0.5}
          color="#9ca3af"
          anchorX="center"
          anchorY="middle"
          rotation={[0, 0, 0]}
        >
          {fallbackText}
        </Text>
      </group>
    );
  }

  return (
    <group>
      {/* Main image - RIGHT-SIDE UP */}
      <mesh position={[position[0], imageY, position[2]]} rotation={[0, 0, 0]} renderOrder={10}>
        <planeGeometry args={[imageWidth, imageHeight]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
      
      {/* Glow effects - RIGHT-SIDE UP */}
      <mesh position={[position[0], imageY, position[2] - 0.01]} rotation={[0, 0, 0]} renderOrder={9}>
        <planeGeometry args={[imageWidth + 0.3, imageHeight + 0.3]} />
        <meshBasicMaterial 
          color={glowColorObj}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
      
      <mesh position={[position[0], imageY, position[2] - 0.02]} rotation={[0, 0, 0]} renderOrder={8}>
        <planeGeometry args={[imageWidth + 0.6, imageHeight + 0.6]} />
        <meshBasicMaterial 
          color={glowColorObj}
          transparent
          opacity={0.1}
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
        
        {/* FIXED: Larger base platform */}
        <mesh position={[position[0], 0.1, position[2]]}>
          <cylinderGeometry args={[1.2, 1.2, 0.2]} />
          <meshStandardMaterial 
            color={baseColor}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        
        {/* FIXED: Larger main bar */}
        <mesh ref={meshRef} position={[position[0], 0.2, position[2]]} scale={[1, 0.2, 1]}>
          <cylinderGeometry args={[1.0, 1.0, 1]} />
          <meshStandardMaterial 
            color={barColor}
            metalness={0.4}
            roughness={0.3}
            emissive={barColor}
            emissiveIntensity={responses > 0 ? 0.2 : 0.05}
          />
        </mesh>
        
        {/* FIXED: Larger glow effect */}
        {responses > 0 && (
          <mesh ref={glowRef} position={[position[0], 0.2, position[2]]} scale={[1.3, 0.2, 1.3]}>
            <cylinderGeometry args={[1.1, 1.1, 1]} />
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

// FIXED: Floor Stats Display - NO OVERLAPPING, PROPER SPACING
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
        
        // FIXED: Adaptive spacing to prevent overlapping
        const baseSpacing = 16; // Much larger base spacing
        const spacing = Math.max(baseSpacing, Math.min(20, 120 / Math.max(options.length, 1))); 
        
        const curvedPos = getCurvedPosition(index, options.length, 20); // Use larger radius
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const barColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        const barColor = useMemo(() => new THREE.Color(barColorValue), [barColorValue]);
        
        const textProps = calculateFitFontSize(option.text, spacing);
        
        return (
          <group key={`${option.id}-${option.responses}`}>
            <group rotation={[0, -(curvedPos.rotationY || 0), 0]}>
              {/* Floor panel - LARGER to prevent overlapping */}
              <mesh position={[curvedPos.x, 0.05, curvedPos.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[spacing * 0.8, 8]} />
                <meshStandardMaterial 
                  color={floorColor}
                  transparent
                  opacity={0.9}
                  metalness={0.3}
                  roughness={0.7}
                />
              </mesh>
              
              {/* Glow panel */}
              <mesh position={[curvedPos.x, 0.04, curvedPos.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[spacing * 0.85, 8.4]} />
                <meshBasicMaterial 
                  color={barColor}
                  transparent
                  opacity={0.3}
                />
              </mesh>
              
              {/* Percentage text - MUCH LARGER */}
              <Text
                position={[curvedPos.x, 0.15, curvedPos.z - 2.5]}
                fontSize={4.0} // Much larger
                color={barColorValue}
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
                outlineWidth={0.15}
                outlineColor={shadowColor}
                fillOpacity={1}
              >
                {percentage}%
              </Text>
              
              {/* Vote count - LARGER */}
              <Text
                position={[curvedPos.x, 0.12, curvedPos.z]}
                fontSize={1.8}
                color="#94a3b8"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
                outlineWidth={0.05}
                outlineColor="#000000"
              >
                {option.responses} votes
              </Text>
              
              {/* Option text - LARGER */}
              <Text
                position={[curvedPos.x, 0.12, curvedPos.z + 3]}
                fontSize={textProps.fontSize * 1.5}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
                maxWidth={textProps.maxWidth}
                outlineWidth={Math.max(0.03, textProps.fontSize * 0.05)}
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

// FIXED: Standing Images Display - RIGHT-SIDE UP, behind stats
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
        const curvedPos = getCurvedPosition(index, options.length, 20);
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const glowColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        
        return (
          <group key={option.id}>
            <group rotation={[0, -(curvedPos.rotationY || 0), 0]}>
              <StandingImagePlane
                imageUrl={option.media_url}
                position={[curvedPos.x, 0, curvedPos.z - 1]} // Behind stats, in front of bars
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
  
  // FIXED: Camera positioning for proper view of larger, spaced out layout
  useEffect(() => {
    const startDistance = 100; // Much further back to see wider spacing
    const startHeight = 45;
    
    camera.position.set(0, startHeight, startDistance);
    camera.lookAt(0, 0, 0);
    
    const animateCamera = () => {
      const targetX = 0;
      
      // FIXED: Camera positioning for wider layout
      const baseHeight = 20; // Higher for better view of larger elements
      const extraHeight = Math.max(0, (options.length - 3) * 1.0);
      const targetY = baseHeight + extraHeight;
      
      // FIXED: Much further distance to see the full amphitheater without crowding
      const baseDistance = 35; // Much further back for proper view
      const distanceAdjustment = Math.max(0, (options.length - 3) * 3);
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
        
        // FIXED: Look at the center of the amphitheater
        const lookAtY = 2;
        camera.lookAt(0, lookAtY, -1); // Look slightly forward into the amphitheater
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    };
    
    const timer = setTimeout(animateCamera, 100);
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
      
      {/* FIXED: 3D Bars - BACK LAYER, larger and properly positioned */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.3)
          : 1.0; // Larger minimum height
        
        const curvedPos = getCurvedPosition(index, options.length, 20); // Use larger radius
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const barColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        
        return (
          <Enhanced3DBar
            key={`${option.id}-${option.responses}`} // REAL-TIME FIX: Include responses in key
            position={[curvedPos.x, 0, curvedPos.z - 3]} // BACK LAYER - bars behind everything
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
      
      {/* ORIGINAL: Floating title */}
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
            minDistance={Math.max(18, 32 - options.length * 1.5)} // FIXED: Further min distance for layers
            maxDistance={Math.max(50, options.length * 5)} // FIXED: Much further max distance
            minPolarAngle={Math.PI / 35} // FIXED: Allow more downward angle for layers
            maxPolarAngle={Math.PI / 2.0}
            autoRotate={false}
            rotateSpeed={0.4} // Slightly slower for better control
            target={[0, 2, 0]} // FIXED: Look at center of all layers
          />
        </Canvas>
      </Suspense>
    </motion.div>
  );
};