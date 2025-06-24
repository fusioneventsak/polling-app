import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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

// Standing image component for floor display
const StandingImagePlane: React.FC<{
  imageUrl: string;
  position: [number, number, number];
  fallbackText: string;
  glowColor: string;
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
        loadedTexture.flipY = true;
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = 16;
        setTexture(loadedTexture);
        setLoadError(false);
      },
      undefined,
      (error) => {
        setLoadError(true);
        setTexture(null);
      }
    );
    
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [imageUrl]);

  if (!texture || loadError || !imageUrl || imageUrl.trim() === '') {
    return null;
  }

  // Calculate position and rotation for tilted image
  const imageHeight = 3.0;
  const imageWidth = 4.0;
  const tiltAngle = Math.PI / 12; // 15 degrees tilt toward camera
  
  // Adjust Y position to account for tilt - bottom edge should touch floor
  const imageY = (imageHeight / 2) * Math.cos(tiltAngle) + 0.1;

  return (
    <group>
      {/* Main image plane - tilted toward camera with bottom on floor */}
      <mesh position={[position[0], imageY, position[2]]} rotation={[-tiltAngle, 0, 0]} renderOrder={10}>
        <planeGeometry args={[imageWidth, imageHeight]} />
        <meshStandardMaterial 
          map={texture}
          transparent={false}
          side={THREE.DoubleSide}
          roughness={0.1}
          metalness={0.1}
          depthWrite={true}
        />
      </mesh>
      
      {/* Subtle glow behind image */}
      <mesh position={[position[0], imageY, position[2] - 0.01]} rotation={[-tiltAngle, 0, 0]} renderOrder={9}>
        <planeGeometry args={[imageWidth + 0.2, imageHeight + 0.2]} />
        <meshBasicMaterial 
          color={glowColor}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh position={[position[0], imageY, position[2] - 0.02]} rotation={[-tiltAngle, 0, 0]} renderOrder={8}>
        <planeGeometry args={[imageWidth + 0.4, imageHeight + 0.4]} />
        <meshBasicMaterial 
          color={glowColor}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// Enhanced 3D Bar Component with curved positioning
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
    
    if (glowRef.current && responses > 0) {
      const targetHeight = Math.max(height, 0.2);
      const currentHeight = glowRef.current.scale.y;
      const animationSpeed = 0.04;
      
      if (Math.abs(currentHeight - targetHeight) > 0.01) {
        const newHeight = THREE.MathUtils.lerp(currentHeight, targetHeight, animationSpeed);
        glowRef.current.scale.y = newHeight;
        glowRef.current.position.y = newHeight / 2;
      }
      
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
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[3.2, 3.2, 0.25]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      <mesh ref={meshRef} position={[position[0], 0.15, position[2]]} scale={[1, 0.2, 1]} castShadow>
        <cylinderGeometry args={[2.4, 2.4, 1]} />
        <meshStandardMaterial 
          color={barColor}
          metalness={0.9}
          roughness={0.1}
          envMapIntensity={1.5}
          transparent
          opacity={0.95}
        />
      </mesh>
      
      {responses > 0 && (
        <mesh ref={glowRef} position={[position[0], 0.15, position[2]]} scale={[1.8, 0.2, 1.8]}>
          <cylinderGeometry args={[2.1, 2.1, 1]} />
          <meshBasicMaterial 
            color={glowColor}
            transparent
            opacity={0.12}
          />
        </mesh>
      )}
    </group>
  );
};

// Helper function to calculate font size to fit text in container
const calculateFitFontSize = (text: string, spacing: number) => {
  const availableWidth = spacing * 0.8;
  const textLength = text.length;
  
  // Base calculation: estimate character width relative to font size
  // Rough estimate: each character is about 0.6x the font size in width
  const charWidthRatio = 0.6;
  
  // Calculate the font size needed to fit the text
  let fontSize = availableWidth / (textLength * charWidthRatio);
  
  // Set reasonable bounds
  const maxFontSize = 1.6; // Don't go bigger than this for short text
  const minFontSize = 0.4; // Don't go smaller than this for readability
  
  fontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));
  
  return {
    fontSize,
    maxWidth: availableWidth,
    displayText: text // Always show full text, no truncation
  };
};

// Floor Stats Component with Auto-Scaling Text
const FloorStatsDisplay: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
}> = ({ options, totalResponses }) => {
  return (
    <group>
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        
        // Calculate curved positioning
        const radius = Math.max(12, options.length * 2);
        const angleStep = Math.PI / Math.max(options.length - 1, 1);
        const startAngle = -Math.PI / 2;
        const angle = startAngle + index * angleStep;
        
        const xPosition = Math.sin(angle) * radius;
        const zPosition = Math.cos(angle) * radius * 0.6 + 15; // Move forward for floor display
        
        // Dynamic colors based on option
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const barColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        
        // Calculate font size to fit entire text
        const spacing = Math.min(8, 20 / options.length);
        const textProps = calculateFitFontSize(option.text, spacing);
        
        return (
          <group key={option.id}>
            {/* Background platform for better contrast */}
            <mesh position={[xPosition, 0.05, zPosition]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[spacing * 0.85, 4]} />
              <meshStandardMaterial 
                color="#0f172a"
                transparent
                opacity={0.9}
                metalness={0.3}
                roughness={0.7}
              />
            </mesh>
            
            {/* Glowing border for platform */}
            <mesh position={[xPosition, 0.04, zPosition]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[spacing * 0.9, 4.2]} />
              <meshBasicMaterial 
                color={barColor}
                transparent
                opacity={0.3}
              />
            </mesh>
            
            {/* Large percentage text with glow */}
            <Text
              position={[xPosition, 0.15, zPosition - 1]}
              fontSize={2.2}
              color={barColor}
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              outlineWidth={0.08}
              outlineColor="#000000"
              fillOpacity={1}
            >
              {percentage}%
            </Text>
            
            {/* Percentage shadow for depth */}
            <Text
              position={[xPosition + 0.1, 0.1, zPosition - 0.9]}
              fontSize={2.2}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              fillOpacity={0.3}
            >
              {percentage}%
            </Text>
            
            {/* Vote count with better styling */}
            <Text
              position={[xPosition, 0.12, zPosition + 0.5]}
              fontSize={1.1}
              color="#94a3b8"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              outlineWidth={0.03}
              outlineColor="#000000"
            >
              {option.responses} votes
            </Text>
            
            {/* Auto-scaling option text - fits entire text */}
            <Text
              position={[xPosition, 0.12, zPosition + 1.5]}
              fontSize={textProps.fontSize}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              maxWidth={textProps.maxWidth}
              outlineWidth={Math.max(0.02, textProps.fontSize * 0.03)}
              outlineColor="#1e293b"
              textAlign="center"
              lineHeight={1.2}
            >
              {textProps.displayText}
            </Text>
            
            {/* Option text shadow */}
            <Text
              position={[xPosition + 0.05, 0.08, zPosition + 1.55]}
              fontSize={textProps.fontSize}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              maxWidth={textProps.maxWidth}
              fillOpacity={0.4}
              textAlign="center"
              lineHeight={1.2}
            >
              {textProps.displayText}
            </Text>
          </group>
        );
      })}
    </group>
  );
};

// Standing Images Component
const StandingImagesDisplay: React.FC<{
  options: ActivityOption[];
}> = ({ options }) => {
  return (
    <group>
      {options.map((option, index) => {
        if (!option.media_url || option.media_url.trim() === '') {
          return null;
        }
        
        // Calculate curved positioning for images
        const radius = Math.max(10, options.length * 1.8);
        const angleStep = Math.PI / Math.max(options.length - 1, 1);
        const startAngle = -Math.PI / 2;
        const angle = startAngle + index * angleStep;
        
        const xPosition = Math.sin(angle) * radius;
        const zPosition = Math.cos(angle) * radius * 0.4 + 8; // Position between bars and floor stats
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const saturation = 75;
        const lightness = 60;
        
        const glowColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <group key={option.id}>
            <StandingImagePlane
              imageUrl={option.media_url}
              position={[xPosition, 0, zPosition]}
              fallbackText={`Option ${String.fromCharCode(65 + index)}`}
              glowColor={glowColor}
            />
          </group>
        );
      })}
    </group>
  );
};

// Main 3D Scene with dynamic camera and curved layout
const Enhanced3DScene: React.FC<{ 
  options: ActivityOption[]; 
  totalResponses: number; 
  themeColors: any;
  activityTitle?: string;
}> = ({ options, totalResponses, themeColors, activityTitle }) => {
  const { camera } = useThree();
  const maxResponses = Math.max(...options.map(opt => opt.responses), 1);
  const maxHeight = 4;
  
  // Dynamic camera fly-in animation
  useEffect(() => {
    // Start position - far away and high up
    camera.position.set(0, 25, 50);
    camera.lookAt(0, 0, 0);
    
    const animateCamera = () => {
      const targetX = 0;
      const targetY = 8;
      
      // Calculate target distance based on number of options
      const baseDistance = 20;
      const extraDistance = Math.max(0, (options.length - 2) * 3);
      const targetZ = baseDistance + extraDistance;
      
      const animationDuration = 3000; // 3 seconds for dramatic entrance
      const startTime = Date.now();
      const startPos = camera.position.clone();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Smooth easing function for cinematic feel
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        camera.position.x = startPos.x + (targetX - startPos.x) * easeProgress;
        camera.position.y = startPos.y + (targetY - startPos.y) * easeProgress;
        camera.position.z = startPos.z + (targetZ - startPos.z) * easeProgress;
        
        // Smooth look-at transition
        const lookAtY = 2 * easeProgress;
        camera.lookAt(0, lookAtY, 0);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    };
    
    // Start animation after a brief delay
    const timer = setTimeout(animateCamera, 200);
    
    return () => clearTimeout(timer);
  }, [camera, options.length]);
  
  const titleFontSize = activityTitle ? calculateTitleFontSize(activityTitle) : 1.8;
  
  return (
    <>
      {/* Enhanced lighting with colored lights for each bar */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={2.5} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <directionalLight 
        position={[-10, 15, 10]} 
        intensity={2.0} 
        color="#ffffff"
      />
      <directionalLight 
        position={[0, 25, -10]} 
        intensity={1.8} 
        color="#ffffff"
      />
      
      {/* Colored point lights for each option */}
      {options.map((option, index) => {
        const radius = Math.max(12, options.length * 2);
        const angleStep = Math.PI / Math.max(options.length - 1, 1);
        const startAngle = -Math.PI / 2;
        const angle = startAngle + index * angleStep;
        
        const xPosition = Math.sin(angle) * radius;
        const zPosition = Math.cos(angle) * radius * 0.6;
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const lightColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        
        return (
          <pointLight 
            key={option.id}
            position={[xPosition, 12, zPosition]} 
            intensity={1.5} 
            color={lightColor}
            distance={20}
            decay={2}
          />
        );
      })}
      
      <pointLight position={[0, 15, 5]} intensity={1.8} color="#ffffff" />
      <spotLight 
        position={[0, 18, 0]} 
        intensity={2.5} 
        angle={Math.PI / 3}
        penumbra={0.3}
        color="#ffffff"
        castShadow
      />
      
      {/* Enhanced floor */}
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
      
      <gridHelper 
        args={[100, 100, themeColors.accentColor, '#334155']} 
        position={[0, 0.01, 0]}
      />
      
      {/* Floor stats display */}
      <FloorStatsDisplay options={options} totalResponses={totalResponses} />
      
      {/* Standing images display */}
      <StandingImagesDisplay options={options} />
      
      {/* Curved arrangement of bars */}
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.2)
          : 0.8;
        
        // Calculate curved positioning
        const radius = Math.max(12, options.length * 2);
        const angleStep = Math.PI / Math.max(options.length - 1, 1);
        const startAngle = -Math.PI / 2;
        const angle = startAngle + index * angleStep;
        
        const xPosition = Math.sin(angle) * radius;
        const zPosition = Math.cos(angle) * radius * 0.6 - 8; // Position bars behind center
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const saturation = 75;
        const lightness = 60;
        
        const barColor = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <Enhanced3DBar
            key={option.id}
            position={[xPosition, 0, zPosition]}
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
      
      {/* Floating title */}
      <Float speed={0.3} rotationIntensity={0.01} floatIntensity={0.05}>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 0 01-2-2z" />
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
      className={`w-full h-full bg-gradient-to-br from-slate-900/40 to-blue-900/20 rounded-xl border border-slate-700 overflow-hidden shadow-2xl relative ${className}`}
      style={{ 
        height: '100%', 
        minHeight: '900px',
        width: '100%',
        minWidth: '100%',
        position: 'relative'
      }}
    >
      {activityMedia && (
        <div className="absolute top-4 left-4 z-10">
          <img
            src={activityMedia}
            alt="Activity media"
            className="w-32 h-24 object-cover rounded-lg border border-white/20 shadow-lg"
          />
        </div>
      )}

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
          key={`canvas-${options.length}`}
          camera={{ 
            position: [0, 25, 50],
            fov: 75,
            near: 0.1,
            far: 1000
          }}
          style={{ 
            background: 'transparent',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
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
            minDistance={15}
            maxDistance={60}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI / 2.2}
            autoRotate={false}
            rotateSpeed={0.5}
          />
        </Canvas>
      </Suspense>
    </motion.div>
  );
};