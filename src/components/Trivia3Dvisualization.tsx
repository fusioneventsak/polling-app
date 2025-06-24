import React, { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Float, OrbitControls, Stars, Environment } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { TriviaCountdownTimer } from './TriviaCountdownTimer';
import type { ActivityOption, TriviaGameState } from '../types';

interface Trivia3DVisualizationProps {
  options: ActivityOption[];
  totalResponses: number;
  themeColors: any;
  activityTitle?: string;
  activityMedia?: string;
  gameState: TriviaGameState;
  onTimerComplete: () => void;
  onTimerTick?: (timeRemaining: number) => void;
  countdownDuration?: number;
  showCorrectAnswer?: boolean;
  pointsPerCorrect?: number;
  backgroundGradient?: string;
}

// Enhanced 3D Option Card Component for Trivia
const TriviaOptionCard: React.FC<{
  option: ActivityOption;
  position: [number, number, number];
  index: number;
  isRevealed: boolean;
  isAnswering: boolean;
  delay: number;
  totalResponses: number;
}> = ({ option, position, index, isRevealed, isAnswering, delay, totalResponses }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const percentage = totalResponses > 0 ? Math.round((option.responses / totalResponses) * 100) : 0;

  // Create THREE.Color objects to prevent undefined value errors
  const optionColor = useMemo(() => {
    if (isRevealed && option.is_correct) {
      return new THREE.Color('#10b981'); // Green for correct answer
    }
    if (isRevealed && !option.is_correct) {
      return new THREE.Color('#6b7280'); // Gray for incorrect answers
    }
    // Rainbow colors during answering phase
    const hue = (index * 360) / 4; // Assuming max 4 options
    return new THREE.Color(`hsl(${hue}, 70%, 60%)`);
  }, [isRevealed, option.is_correct, index]);

  const glowColor = useMemo(() => {
    const colorValue = option.is_correct ? '#34d399' : optionColor;
    return new THREE.Color(colorValue);
  }, [optionColor, option.is_correct]);

  const baseColor = useMemo(() => new THREE.Color("#1e293b"), []);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + delay) * 0.2;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[4, 6, 0.5]} />
        <meshPhysicalMaterial
          color={optionColor}
          transparent
          opacity={0.9}
          metalness={0.8}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Glow Effect */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[4.2, 6.2, 0.3]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={isRevealed && option.is_correct ? 0.4 : 0.1}
        />
      </mesh>

      {/* Option Text */}
      <Text
        position={[0, 1, 0.3]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.5}
        textAlign="center"
        fontWeight="bold"
      >
        {option.text}
      </Text>

      {/* Response Count (if revealed) */}
      {isRevealed && (
        <>
          <Text
            position={[0, -1, 0.3]}
            fontSize={0.8}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            {option.responses} votes
          </Text>
          
          <Text
            position={[0, -1.8, 0.3]}
            fontSize={0.5}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            {percentage}%
          </Text>
        </>
      )}

      {/* Correct Answer Indicator */}
      {isRevealed && option.is_correct && (
        <>
          {/* Crown or checkmark for correct answer */}
          <Text
            position={[0, 2.5, 0.3]}
            fontSize={1}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
          >
            ✓
          </Text>
          
          <Text
            position={[0, -2.5, 0.3]}
            fontSize={0.4}
            color="#10b981"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            CORRECT!
          </Text>
        </>
      )}

      {/* Option Letter (A, B, C, D) */}
      <Text
        position={[-1.7, 2.7, 0.3]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {String.fromCharCode(65 + index)}
      </Text>
    </group>
  );
};

// Scene Component
const TriviaScene: React.FC<{
  options: ActivityOption[];
  totalResponses: number;
  activityTitle?: string;
  gameState: TriviaGameState;
}> = ({ options, totalResponses, activityTitle, gameState }) => {
  const { camera } = useThree();

  useEffect(() => {
    // Adjust camera for trivia view
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      {/* Environment */}
      <Environment preset="night" />
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#3b82f6" />

      {/* Title */}
      <Float speed={0.5} rotationIntensity={0.02} floatIntensity={0.1}>
        <Text
          position={[0, 8, 0]}
          fontSize={1.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={20}
          textAlign="center"
          fontWeight="bold"
          outlineWidth={0.05}
          outlineColor="#1e293b"
        >
          {activityTitle || 'Trivia Question'}
        </Text>
      </Float>

      {/* Options arranged in a grid */}
      {options.map((option, index) => {
        const cols = options.length <= 2 ? 2 : 2; // Always 2 columns for better display
        const rows = Math.ceil(options.length / cols);
        
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        const xSpacing = 6;
        const ySpacing = 4;
        const startX = -(cols - 1) * xSpacing / 2;
        const startY = (rows - 1) * ySpacing / 2;
        
        const position: [number, number, number] = [
          startX + col * xSpacing,
          startY - row * ySpacing,
          0
        ];

        return (
          <TriviaOptionCard
            key={option.id}
            option={option}
            position={position}
            index={index}
            isRevealed={gameState.correctAnswerRevealed}
            isAnswering={gameState.phase === 'answering'}
            delay={index * 0.2}
            totalResponses={totalResponses}
          />
        );
      })}

      {/* Game Phase Indicator */}
      {gameState.phase === 'countdown' && (
        <Float speed={2} rotationIntensity={0.05} floatIntensity={0.2}>
          <Text
            position={[0, 4, 2]}
            fontSize={2}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            GET READY!
          </Text>
        </Float>
      )}

      {/* Answer Phase Text */}
      {gameState.phase === 'answering' && (
        <Float speed={1} rotationIntensity={0.02} floatIntensity={0.1}>
          <Text
            position={[0, -6, 1]}
            fontSize={0.8}
            color="#3b82f6"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            Choose your answer quickly!
          </Text>
        </Float>
      )}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={8}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
};

// Loading fallback
const LoadingFallback: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center bg-slate-900/20 rounded-xl border border-slate-700">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white text-lg font-medium">Loading Trivia Display...</p>
    </div>
  </div>
);

// Main Component
export const Trivia3DVisualization: React.FC<Trivia3DVisualizationProps> = ({
  options,
  totalResponses,
  themeColors,
  activityTitle,
  activityMedia,
  gameState,
  onTimerComplete,
  onTimerTick,
  countdownDuration = 30,
  showCorrectAnswer = true,
  pointsPerCorrect = 10,
  backgroundGradient
}) => {
  // Convert Tailwind gradient classes to CSS gradient
  const getBackgroundStyle = () => {
    if (!backgroundGradient) {
      return 'linear-gradient(to bottom right, #0f172a, #1e3a8a, #581c87)';
    }

    const colorMap: { [key: string]: string } = {
      'slate-900': '#0f172a',
      'blue-900': '#1e3a8a',
      'purple-900': '#581c87',
      'green-900': '#14532d',
      'red-900': '#7f1d1d',
      'orange-900': '#7c2d12',
      'gray-900': '#111827',
      'blue-950': '#172554',
      'slate-950': '#020617',
      'black': '#000000',
      'slate-800': '#1e293b'
    };

    const colors = backgroundGradient
      .replace('from-', '')
      .replace('via-', '')
      .replace('to-', '')
      .split(' ')
      .map(color => colorMap[color] || color)
      .join(', ');

    return `linear-gradient(to bottom right, ${colors})`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full overflow-hidden"
      style={{
        background: getBackgroundStyle()
      }}
    >
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 12], fov: 60 }}
        style={{ 
          background: 'transparent',
          width: '100%',
          height: '100%',
          display: 'block'
        }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <TriviaScene
            options={options}
            totalResponses={totalResponses}
            activityTitle={activityTitle}
            gameState={gameState}
          />
        </Suspense>
      </Canvas>

      {/* Countdown Timer Overlay */}
      {(gameState.phase === 'countdown' || gameState.phase === 'answering') && (
        <div className="absolute top-4 right-4">
          <TriviaCountdownTimer
            duration={countdownDuration}
            isActive={gameState.isActive && gameState.phase === 'answering'}
            onTimeUp={onTimerComplete}
            onTick={onTimerTick}
            size="sm"
            autoStart={gameState.phase === 'answering'}
          />
        </div>
      )}

      {/* Game Info Panel */}
      <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/10">
        <div className="text-white">
          <div className="text-xs font-medium mb-2">Trivia Game</div>
          <div className="text-xs text-slate-300 space-y-1">
            <div>Phase: <span className="capitalize text-blue-400">{gameState.phase}</span></div>
            <div>Responses: <span className="text-green-400">{totalResponses}</span></div>
            <div>Points: <span className="text-yellow-400">{pointsPerCorrect} per correct</span></div>
          </div>
        </div>
      </div>

      {/* Answer Revealed Banner */}
      <AnimatePresence>
        {gameState.correctAnswerRevealed && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-0 right-0 bg-gradient-to-r from-green-600 to-green-500 text-white text-center py-4 px-8 shadow-lg"
          >
            <div className="text-sm font-bold">
              Answer Revealed! 
              {showCorrectAnswer && (
                <span className="ml-2">
                  Correct answer: {options.find(opt => opt.is_correct)?.text}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live indicator */}
      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-red-400 text-xs font-medium">LIVE TRIVIA</span>
        </div>
      </div>
    </motion.div>
  );
};