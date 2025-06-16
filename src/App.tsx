import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './components/ThemeProvider';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import { GameJoinPage } from './pages/GameJoinPage';
import { VotePage } from './pages/VotePage';
import { DisplayPage } from './pages/DisplayPage';

function App() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/game" element={<GameJoinPage />} />
            <Route path="/vote/:pollId" element={<VotePage />} />
            <Route path="/display/:pollId" element={<DisplayPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;