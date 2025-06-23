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
        // Enhanced texture properties for better quality
        loadedTexture.needsUpdate = true;
        loadedTexture.flipY = true;
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = 16; // Maximum anisotropic filtering for crisp images
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
      {/* Main image - enhanced for better quality, 25% larger */}
      <mesh position={position} rotation={[-Math.PI / 6, 0, 0]} renderOrder={2}>
        <planeGeometry args={[2.5, 1.875]} />
        <meshStandardMaterial 
          map={texture}
          transparent={false}
          side={THREE.DoubleSide}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>
      
      {/* Glow border matching bar color - 25% larger */}
      <mesh position={[position[0], position[1], position[2] - 0.01]} rotation={[-Math.PI / 6, 0, 0]} renderOrder={1}>
        <planeGeometry args={[2.75, 2.125]} />
        <meshBasicMaterial 
          color={glowColor}
          transparent
          opacity={0.5}
        />
      </mesh>
      
      {/* Outer glow effect with lighter version of bar color - 25% larger */}
      <mesh position={[position[0], position[1], position[2] - 0.02]} rotation={[-Math.PI / 6, 0, 0]} renderOrder={0}>
        <planeGeometry args={[3.0, 2.375]} />
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
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Error logged but not to console in production
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
      {/* Base platform with enhanced design - even bigger */}
      <mesh position={[position[0], 0.05, position[2]]}>
        <cylinderGeometry args={[2.5, 2.5, 0.25]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Main 3D bar with enhanced metallic materials - even bigger */}
      <mesh ref={meshRef} position={[position[0], 0.15, position[2]]} scale={[1, 0.2, 1]} castShadow>
        <cylinderGeometry args={[1.8, 1.8, 1]} />
        <meshStandardMaterial 
          color={barColor}
          metalness={0.9}
          roughness={0.1}
          envMapIntensity={1.5}
          transparent
          opacity={0.95}
        />
      </mesh>
      
      {/* Glow effect for bars with responses - smaller to prevent overlap */}
      {responses > 0 && (
        <mesh ref={glowRef} position={[position[0], 0.15, position[2]]} scale={[1.8, 0.2, 1.8]}>
          <cylinderGeometry args={[1.6, 1.6, 1]} />
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

// Floor Stats Component (foreground layer)
const FloorStatsDisplay: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
}> = ({ options, totalResponses }) => {
  return (
    <group>
      {options.map((option, index) => {
        const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;
        
        // Calculate optimal spacing that scales with number of options - improved algorithm
        const minSpacing = 6.0; // Minimum spacing to prevent glow overlap
        const maxSpacing = 12.0; // Maximum spacing for 1-2 options
        const spacing = Math.max(minSpacing, Math.min(maxSpacing, 50 / Math.max(options.length, 1)));
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
        
        // Calculate optimal spacing that scales with number of options - improved algorithm
        const minSpacing = 6.0; // Minimum spacing to prevent glow overlap
        const maxSpacing = 12.0; // Maximum spacing for 1-2 options
        const spacing = Math.max(minSpacing, Math.min(maxSpacing, 50 / Math.max(options.length, 1)));
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
              {/* Standing image - much bigger and properly elevated above floor */}
              <StandingImagePlane
                imageUrl={option.media_url}
                position={[xPosition, 1.0, 3]}
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
  
  // Camera fly-in animation with dynamic zoom based on option count
  useEffect(() => {
    // Starting position (far away)
    camera.position.set(0, 15, 40);
    
    // Animate to final position
    const animateCamera = () => {
      const targetX = 0;
      const targetY = 4; // Higher to see floor stats
      
      // Dynamic zoom for clear text and image visibility - much closer final position
      const baseDistance = 18; // Much closer base distance for clear visibility
      const extraDistance = Math.max(0, (options.length - 2) * 3.0); // Reasonable spacing increase
      const targetZ = baseDistance + extraDistance;
      
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
  }, [camera, options.length]); // Only run when camera or initial options.length changes
  
  // Calculate dynamic font sizes
  const titleFontSize = activityTitle ? calculateTitleFontSize(activityTitle) : 1.8;
  const descriptionFontSize = activityTitle ? calculateDescriptionFontSize(activityTitle) : 0.6;
  
  return (
    <>
      {/* Enhanced lighting setup for better bar visibility */}
      <ambientLight intensity={0.8} />
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={3.0} 
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
        intensity={2.5} 
        color="#ffffff"
      />
      <directionalLight 
        position={[0, 25, -10]} 
        intensity={2.0} 
        color="#ffffff"
      />
      <pointLight position={[-10, 10, 10]} intensity={1.5} color={themeColors.accentColor} />
      <pointLight position={[10, 10, -10]} intensity={1.2} color={themeColors.secondaryColor} />
      <pointLight position={[0, 15, 5]} intensity={1.8} color="#ffffff" />
      <spotLight 
        position={[0, 18, 0]} 
        intensity={2.5} 
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
      
      {/* High-resolution space environment */}
      {React.useMemo(() => {
        // Create a large sphere for space environment
        const loader = new THREE.TextureLoader();
        
        // High-quality space skybox options (you can replace with any of these):
        // Option 1: NASA Hubble Deep Field images
        const spaceTextures = [
          'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=2048&q=80', // Deep space
          'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=2048&q=80', // Milky Way
          'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=2048&q=80', // Nebula
          'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=4096&q=90'  // Ultra high-res nebula
        ];
        
        // Option 2: NASA texture URLs (more realistic)
        const nasaTextures = [
          'https://www.solarsystemscope.com/textures/download/2k_stars_milky_way.jpg',
          'https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg'
        ];
        
        // Create sphere geometry for skybox
        const sphereGeometry = new THREE.SphereGeometry(200, 64, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({
          side: THREE.BackSide, // Render inside of sphere
          transparent: true,
          opacity: 0.8
        });
        
        // Load high-resolution space texture
        loader.load(
          'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=4096&q=90',
          (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            sphereMaterial.map = texture;
            sphereMaterial.needsUpdate = true;
          },
          undefined,
          (error) => {
            console.warn('Space texture failed to load, using fallback');
            // Fallback to procedural starfield
            sphereMaterial.color = new THREE.Color('#0a0a2e');
          }
        );
        
        return (
          <mesh>
            <primitive object={sphereGeometry} />
            <primitive object={sphereMaterial} />
          </mesh>
        );
      }, [])}
      
      {/* Additional procedural starfield as backup */}
      {Array.from({ length: 500 }).map((_, i) => {
        const distance = 150 + Math.random() * 50;
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI;
        
        const x = Math.sin(angle2) * Math.cos(angle1) * distance;
        const y = Math.cos(angle2) * distance;
        const z = Math.sin(angle2) * Math.sin(angle1) * distance;
        
        const starSize = 0.02 + Math.random() * 0.05;
        const brightness = 0.3 + Math.random() * 0.7;
        
        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[starSize]} />
            <meshBasicMaterial 
              color="#ffffff"
              transparent
              opacity={brightness}
            />
          </mesh>
        );
      })}
      
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
        
        // Calculate optimal spacing that scales with number of options - same algorithm as images
        const minSpacing = 6.0; // Minimum spacing to prevent glow overlap
        const maxSpacing = 12.0; // Maximum spacing for 1-2 options
        const spacing = Math.max(minSpacing, Math.min(maxSpacing, 50 / Math.max(options.length, 1)));
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
        minHeight: '800px',
        width: '100%',
        minWidth: '100%',
        position: 'relative'
      }}
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

      {/* Voting locked indicator */}
      {isVotingLocked && (
        <div className="absolute top-4 right-4 bg-red-900/40 backdrop-blur-sm rounded-lg p-3 border border-red-600/30 z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-400 text-xs font-medium">VOTING LOCKED</span>
          </div>
        </div>
      )}

      {/* 3D Canvas with error boundary */}
      <ErrorBoundary fallback={<LoadingFallback />}>
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            key={`canvas-${options.length}-${totalResponses}`}
            camera={{ 
              position: [0, 15, 40], // Starting position for fly-in
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
              pixelRatio: Math.min(window.devicePixelRatio, 2) // Higher resolution for better image quality
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
      </ErrorBoundary>
    </motion.div>
  );
};