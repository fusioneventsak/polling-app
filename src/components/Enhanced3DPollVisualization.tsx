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

// Simplified standing image component
const StandingImagePlane: React.FC<{
  imageUrl: string;
  position: [number, number, number];
  fallbackText: string;
  glowColor: string;
}> = ({ imageUrl, position, fallbackText, glowColor }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loadError, setLoadError] = useState(false);
  
  // Create THREE.Color objects for glow materials
  const glowColorObj = useMemo(() => new THREE.Color(glowColor), [glowColor]);
  
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
        loadedTexture.format = THREE.RGBAFormat;
        loadedTexture.generateMipmaps = true;
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
          color={glowColorObj}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh position={[position[0], imageY, position[2] - 0.02]} rotation={[-tiltAngle, 0, 0]} renderOrder={8}>
        <planeGeometry args={[imageWidth + 0.4, imageHeight + 0.4]} />
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

// Volumetric Light Beam Component with realistic atmospheric scattering
const VolumetricLightBeam: React.FC<{
  position: [number, number, number];
  color: string; // Always expect string, convert to THREE.Color internally
  intensity: number;
  responses: number;
}> = ({ position, color, intensity, responses }) => {
  const beamRef = useRef<THREE.Group>(null);
  
  // Create THREE.Color objects to prevent undefined value errors
  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  
  useFrame((state) => {
    if (beamRef.current) {
      // Subtle animation for the light beam
      const time = state.clock.elapsedTime;
      beamRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshBasicMaterial;
          if (material && material.opacity !== undefined) {
            // Subtle pulsing based on responses
            const baseOpacity = responses > 0 ? 0.15 : 0.03;
            const pulse = Math.sin(time * 2 + index * 0.5) * 0.02;
            material.opacity = baseOpacity + pulse;
          }
        }
      });
    }
  });

  return (
    <group ref={beamRef}>
      {/* Main Spotlight - This provides actual lighting */}
      <spotLight
        position={[position[0], 18, position[2]]}
        target-position={[position[0], 0, position[2]]}
        color={threeColor}
        intensity={responses > 0 ? intensity * 3 : intensity * 0.8}
        angle={Math.PI / 8}
        penumbra={0.4}
        distance={25}
        decay={1.5}
        castShadow={true}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      
      {/* Atmospheric Scattering - Multiple layers for depth */}
      {Array.from({ length: 8 }).map((_, i) => {
        const height = 2 + i * 1.8;
        const radius = 0.3 + i * 0.4;
        const opacity = responses > 0 ? (0.08 - i * 0.008) : (0.02 - i * 0.002);
        
        return (
          <mesh 
            key={i}
            position={[position[0], 16 - height, position[2]]}
            rotation={[0, 0, 0]}
          >
            <cylinderGeometry args={[radius, radius + 0.2, height, 16]} />
            <meshBasicMaterial
              color={threeColor}
              transparent
              opacity={Math.max(0.001, opacity)}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
      
      {/* Light Particles - Floating dust/particles in the beam */}
      {responses > 0 && Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = Math.random() * 2;
        const height = 2 + Math.random() * 12;
        
        return (
          <mesh
            key={`particle-${i}`}
            position={[
              position[0] + Math.cos(angle) * radius,
              16 - height,
              position[2] + Math.sin(angle) * radius
            ]}
          >
            <sphereGeometry args={[0.02]} />
            <meshBasicMaterial
              color={threeColor}
              transparent
              opacity={0.6}
              emissive={threeColor}
              emissiveIntensity={0.3}
            />
          </mesh>
        );
      })}
      
      {/* Ground Light Pool - Where the light hits the floor */}
      <mesh 
        position={[position[0], 0.01, position[2]]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[3, 32]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={responses > 0 ? 0.15 : 0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// 3D Bar Component
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
  
  // Create THREE.Color objects to prevent undefined value errors
  const barColorValue = isCorrect ? '#10b981' : color;
  const glowColorValue = isCorrect ? '#34d399' : color;
  
  const barColor = useMemo(() => new THREE.Color(barColorValue), [barColorValue]);
  const glowColor = useMemo(() => new THREE.Color(glowColorValue), [glowColorValue]);
  const baseColor = useMemo(() => new THREE.Color("#1e293b"), []);
  
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

  return (
    <group>
      {/* Volumetric Light Beam - Pass string color, not THREE.Color */}
      <VolumetricLightBeam
        position={position}
        color={barColorValue} // Pass string instead of THREE.Color object
        intensity={responses > 0 ? 1.2 : 0.4}
        responses={responses}
      />
      
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[3.2, 3.2, 0.25]} />
        <meshStandardMaterial 
          color={baseColor}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      <mesh ref={meshRef} position={[position[0], 0.15, position[2]]} scale={[1, 0.2, 1]} castShadow>
        <cylinderGeometry args={[2.4, 2.4, 1]} />
        <meshStandardMaterial 
          color={barColor}
          metalness={0.7}
          roughness={0.2}
          envMapIntensity={1.5}
          transparent
          opacity={0.95}
          emissive={barColor}
          emissiveIntensity={responses > 0 ? 0.1 : 0.02}
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
  // Create THREE.Color objects for floor materials
  const floorColor = useMemo(() => new THREE.Color("#0f172a"), []);
  const shadowColor = useMemo(() => new THREE.Color("#000000"), []);

  return (
    <group>
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        
        const minSpacing = 6.0;
        const maxSpacing = 12.0;
        const spacing = Math.max(minSpacing, Math.min(maxSpacing, 50 / Math.max(options.length, 1)));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        const xPosition = startX + index * spacing;
        
        // Dynamic colors based on option
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const barColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, 75%, 60%)`;
        const barColor = useMemo(() => new THREE.Color(barColorValue), [barColorValue]);
        
        // Calculate font size to fit entire text
        const textProps = calculateFitFontSize(option.text, spacing);
        
        return (
          <group key={option.id}>
            {/* Background platform for better contrast */}
            <mesh position={[xPosition, 0.05, 7.5]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[spacing * 0.85, 4]} />
              <meshStandardMaterial 
                color={floorColor}
                transparent
                opacity={0.9}
                metalness={0.3}
                roughness={0.7}
              />
            </mesh>
            
            {/* Glowing border for platform */}
            <mesh position={[xPosition, 0.04, 7.5]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[spacing * 0.9, 4.2]} />
              <meshBasicMaterial 
                color={barColor}
                transparent
                opacity={0.3}
              />
            </mesh>
            
            {/* Large percentage text with glow */}
            <Text
              position={[xPosition, 0.15, 6]}
              fontSize={2.2}
              color={barColorValue}
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              outlineWidth={0.08}
              outlineColor={shadowColor}
              fillOpacity={1}
            >
              {percentage}%
            </Text>
            
            {/* Percentage shadow for depth */}
            <Text
              position={[xPosition + 0.1, 0.1, 6.1]}
              fontSize={2.2}
              color={shadowColor}
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              fillOpacity={0.3}
            >
              {percentage}%
            </Text>
            
            {/* Vote count with better styling */}
            <Text
              position={[xPosition, 0.12, 7.5]}
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
              position={[xPosition, 0.12, 9]}
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
              position={[xPosition + 0.05, 0.08, 9.05]}
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
        
        const minSpacing = 6.0;
        const maxSpacing = 12.0;
        const spacing = Math.max(minSpacing, Math.min(maxSpacing, 50 / Math.max(options.length, 1)));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        const xPosition = startX + index * spacing;
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const saturation = 75;
        const lightness = 60;
        
        const glowColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <group key={option.id}>
            <StandingImagePlane
              imageUrl={option.media_url}
              position={[xPosition, 0, 4]}
              fallbackText={`Option ${String.fromCharCode(65 + index)}`}
              glowColor={glowColorValue}
            />
          </group>
        );
      })}
    </group>
  );
};

// Main 3D Scene
const Enhanced3DScene: React.FC<{ 
  options: ActivityOption[]; 
  totalResponses: number; 
  themeColors: any;
  activityTitle?: string;
}> = ({ options, totalResponses, themeColors, activityTitle }) => {
  const { camera } = useThree();
  const maxResponses = Math.max(...options.map(opt => opt.responses), 1);
  const maxHeight = 4;
  
  // Create THREE.Color objects for scene materials
  const floorColor = useMemo(() => new THREE.Color("#000000"), []);
  const accentColor = useMemo(() => new THREE.Color(themeColors.accentColor), [themeColors.accentColor]);
  const secondaryColor = useMemo(() => new THREE.Color(themeColors.secondaryColor), [themeColors.secondaryColor]);
  const whiteColor = useMemo(() => new THREE.Color("#ffffff"), []);
  const titleShadowColor = useMemo(() => new THREE.Color("#1e293b"), []);
  
  useEffect(() => {
    camera.position.set(0, 15, 40);
    
    const animateCamera = () => {
      const targetX = 0;
      const targetY = 4;
      
      const baseDistance = 18;
      const extraDistance = Math.max(0, (options.length - 2) * 2.5);
      const targetZ = baseDistance + extraDistance;
      
      const animationDuration = 2000;
      const startTime = Date.now();
      const startPos = camera.position.clone();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
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
    
    const timer = setTimeout(animateCamera, 100);
    
    return () => clearTimeout(timer);
  }, [camera, options.length]);
  
  const titleFontSize = activityTitle ? calculateTitleFontSize(activityTitle) : 1.8;
  
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={1.5} 
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
        intensity={1.2} 
        color="#ffffff"
      />
      <directionalLight 
        position={[0, 25, -10]} 
        intensity={1.0} 
        color="#ffffff"
      />
      <pointLight position={[-10, 10, 10]} intensity={0.8} color={themeColors.accentColor} />
      <pointLight position={[10, 10, -10]} intensity={0.6} color={themeColors.secondaryColor} />
      <pointLight position={[0, 15, 5]} intensity={0.9} color="#ffffff" />
      <spotLight 
        position={[0, 18, 0]} 
        intensity={1.2} 
        angle={Math.PI / 3}
        penumbra={0.3}
        color={whiteColor}
        castShadow
      />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color={floorColor} 
          transparent 
          opacity={1.0}
          metalness={0.95}
          roughness={0.05}
          envMapIntensity={3.0}
        />
      </mesh>
      
      <FloorStatsDisplay options={options} totalResponses={totalResponses} />
      
      <StandingImagesDisplay options={options} />
      
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        const height = totalResponses > 0 
          ? Math.max((option.responses / maxResponses) * maxHeight, 0.2)
          : 0.8;
        
        const minSpacing = 6.0;
        const maxSpacing = 12.0;
        const spacing = Math.max(minSpacing, Math.min(maxSpacing, 50 / Math.max(options.length, 1)));
        const totalWidth = (options.length - 1) * spacing;
        const startX = -totalWidth / 2;
        
        const hue = (index / Math.max(options.length - 1, 1)) * 300;
        const saturation = 75;
        const lightness = 60;
        
        const barColorValue = option.is_correct 
          ? '#10b981' 
          : `hsl(${200 + hue}, ${saturation}%, ${lightness}%)`;
        
        return (
          <Enhanced3DBar
            key={option.id}
            position={[startX + index * spacing, 0, -8]}
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
      className={`w-full h-full bg-gradient-to-br from-slate-900/40 to-blue-900/20 rounded-xl border border-slate-700 overflow-hidden shadow-2xl relative ${className}`}
      style={{ 
        height: '100%',
        width: '100%',
        position: 'relative'
      }}
    >
      {activityMedia && (
        <div className="absolute top-4 left-4 z-10">
          <img
            src={activityMedia}
            alt="Activity media"
            className="w-24 h-18 object-cover rounded-lg border border-white/20 shadow-lg"
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
            position: [0, 15, 40],
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
            minDistance={12}
            maxDistance={45}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI / 2.5}
            autoRotate={false}
            rotateSpeed={0.5}
          />
        </Canvas>
      </Suspense>
    </motion.div>
  );
};