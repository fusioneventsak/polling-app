import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { BarChart3, Users, Zap, Monitor, Smartphone, Volume2 } from 'lucide-react';

export const HomePage: React.FC = () => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const features = [
    {
      id: 'realtime',
      icon: Zap,
      title: 'Real-Time Voting',
      description: 'Instant vote updates with WebSocket technology'
    },
    {
      id: 'display',
      icon: Monitor,
      title: 'Large Display',
      description: 'Optimized for projectors and large screens'
    },
    {
      id: 'mobile',
      icon: Smartphone,
      title: 'Mobile First',
      description: 'Beautiful mobile voting interface'
    },
    {
      id: '3d',
      icon: BarChart3,
      title: '3D Visualization',
      description: 'Stunning 3D animated results'
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center justify-center mb-6">
            <motion.div
              className="p-4 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-2xl"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.8 }}
            >
              <BarChart3 className="w-16 h-16 text-white" />
            </motion.div>
          </div>
          
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-6">
            PollStream
          </h1>
          
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Create engaging real-time polls with stunning 3D visualizations. 
            Perfect for presentations, events, and interactive sessions.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onHoverStart={() => setHoveredCard(feature.id)}
              onHoverEnd={() => setHoveredCard(null)}
            >
              <Card hover className="h-full text-center">
                <motion.div
                  className="mb-4"
                  animate={{ 
                    scale: hoveredCard === feature.id ? 1.1 : 1,
                    rotate: hoveredCard === feature.id ? 5 : 0
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <feature.icon className="w-12 h-12 text-cyan-400 mx-auto" />
                </motion.div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <Card className="text-center">
            <Users className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Join a Poll</h2>
            <p className="text-slate-300 mb-6">
              Enter a 4-digit code to participate in live polling
            </p>
            <Link to="/game">
              <Button size="lg" className="w-full">
                Join Poll
              </Button>
            </Link>
          </Card>

          <Card className="text-center">
            <Volume2 className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Create Polls</h2>
            <p className="text-slate-300 mb-6">
              Admin dashboard to create and manage live polls
            </p>
            <Link to="/admin">
              <Button size="lg" variant="secondary" className="w-full">
                Admin Panel
              </Button>
            </Link>
          </Card>
        </motion.div>

        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <p className="text-slate-400">
            Built with React, Three.js, and WebSocket technology
          </p>
        </motion.div>
      </div>
    </Layout>
  );
};