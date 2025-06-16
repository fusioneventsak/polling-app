import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
let polls = [];
let participants = new Map(); // pollId -> Set of socketIds

// Utility functions
const generatePollCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const createPoll = (data) => {
  const poll = {
    id: Date.now().toString(),
    code: generatePollCode(),
    question: data.question,
    questionMedia: data.questionMedia,
    options: data.options.map((opt, index) => ({
      id: `opt_${Date.now()}_${index}`,
      text: opt.text,
      media: opt.media,
      votes: 0
    })),
    isActive: false,
    totalVotes: 0,
    participants: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  polls.push(poll);
  participants.set(poll.id, new Set());
  return poll;
};

const getPollByCode = (code) => {
  return polls.find(poll => poll.code === code);
};

const getPollById = (id) => {
  return polls.find(poll => poll.id === id);
};

const updatePoll = (pollId, updates) => {
  const pollIndex = polls.findIndex(poll => poll.id === pollId);
  if (pollIndex !== -1) {
    polls[pollIndex] = {
      ...polls[pollIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return polls[pollIndex];
  }
  return null;
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current polls list to new connection
  socket.emit('polls-list', polls);

  // Create new poll
  socket.on('create-poll', (data, callback) => {
    try {
      const poll = createPoll(data);
      io.emit('poll-created', poll);
      callback({ success: true, poll });
    } catch (error) {
      console.error('Error creating poll:', error);
      callback({ success: false, error: 'Failed to create poll' });
    }
  });

  // Start poll
  socket.on('start-poll', (pollId) => {
    const poll = updatePoll(pollId, { isActive: true });
    if (poll) {
      io.emit('poll-updated', poll);
      io.emit('poll-started', pollId);
    }
  });

  // End poll
  socket.on('end-poll', (pollId) => {
    const poll = updatePoll(pollId, { isActive: false });
    if (poll) {
      io.emit('poll-updated', poll);
      io.emit('poll-ended', pollId);
    }
  });

  // Join poll
  socket.on('join-poll', (code, callback) => {
    const poll = getPollByCode(code);
    
    if (!poll) {
      callback({ success: false, error: 'Poll not found' });
      return;
    }

    if (!poll.isActive) {
      callback({ success: false, error: 'Poll is not active' });
      return;
    }

    // Add participant
    const pollParticipants = participants.get(poll.id);
    if (pollParticipants && !pollParticipants.has(socket.id)) {
      pollParticipants.add(socket.id);
      const updatedPoll = updatePoll(poll.id, { 
        participants: pollParticipants.size 
      });
      
      socket.join(poll.id);
      io.emit('poll-updated', updatedPoll);
      io.emit('participant-joined', { 
        pollId: poll.id, 
        participantCount: pollParticipants.size 
      });
    }

    callback({ success: true, poll });
  });

  // Cast vote
  socket.on('cast-vote', ({ pollId, optionId }, callback) => {
    const poll = getPollById(pollId);
    
    if (!poll) {
      callback({ success: false, error: 'Poll not found' });
      return;
    }

    if (!poll.isActive) {
      callback({ success: false, error: 'Poll is not active' });
      return;
    }

    // Find option and increment vote
    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) {
      callback({ success: false, error: 'Option not found' });
      return;
    }

    option.votes += 1;
    const updatedPoll = updatePoll(pollId, { 
      totalVotes: poll.totalVotes + 1,
      options: poll.options
    });

    if (updatedPoll) {
      io.emit('poll-updated', updatedPoll);
      io.emit('vote-cast', {
        pollId,
        optionId,
        userId: socket.id,
        timestamp: new Date().toISOString()
      });
    }

    callback({ success: true });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from all poll participants
    participants.forEach((participantSet, pollId) => {
      if (participantSet.has(socket.id)) {
        participantSet.delete(socket.id);
        const updatedPoll = updatePoll(pollId, { 
          participants: participantSet.size 
        });
        
        if (updatedPoll) {
          io.emit('poll-updated', updatedPoll);
          io.emit('participant-left', { 
            pollId, 
            participantCount: participantSet.size 
          });
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});