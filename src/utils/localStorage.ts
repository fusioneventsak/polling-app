/**
 * Utility functions for managing localStorage voting records
 * Ensures consistent handling of voting state across the application
 */

export interface VotingRecord {
  activityId: string;
  timestamp: number;
  roomId?: string;
}

const VOTED_ACTIVITIES_KEY = 'votedActivities';
const VOTING_RECORDS_KEY = 'votingRecords';

/**
 * Get all voted activity IDs (legacy format)
 */
export const getVotedActivities = (): string[] => {
  try {
    const stored = localStorage.getItem(VOTED_ACTIVITIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading voted activities from localStorage:', error);
    return [];
  }
};

/**
 * Add an activity to the voted list
 */
export const addVotedActivity = (activityId: string, roomId?: string): void => {
  try {
    const votedActivities = getVotedActivities();
    if (!votedActivities.includes(activityId)) {
      votedActivities.push(activityId);
      localStorage.setItem(VOTED_ACTIVITIES_KEY, JSON.stringify(votedActivities));
    }

    // Also store in enhanced format with metadata
    const votingRecords = getVotingRecords();
    const existingRecord = votingRecords.find(r => r.activityId === activityId);
    if (!existingRecord) {
      votingRecords.push({
        activityId,
        timestamp: Date.now(),
        roomId
      });
      localStorage.setItem(VOTING_RECORDS_KEY, JSON.stringify(votingRecords));
    }
  } catch (error) {
    console.error('Error adding voted activity to localStorage:', error);
  }
};

/**
 * Check if user has voted for an activity
 */
export const hasVotedForActivity = (activityId: string): boolean => {
  const votedActivities = getVotedActivities();
  return votedActivities.includes(activityId);
};

/**
 * Remove an activity from the voted list
 */
export const removeVotedActivity = (activityId: string): void => {
  try {
    const votedActivities = getVotedActivities();
    const filteredActivities = votedActivities.filter(id => id !== activityId);
    localStorage.setItem(VOTED_ACTIVITIES_KEY, JSON.stringify(filteredActivities));

    // Also remove from enhanced records
    const votingRecords = getVotingRecords();
    const filteredRecords = votingRecords.filter(r => r.activityId !== activityId);
    localStorage.setItem(VOTING_RECORDS_KEY, JSON.stringify(filteredRecords));
  } catch (error) {
    console.error('Error removing voted activity from localStorage:', error);
  }
};

/**
 * Clear all voting records for specific activities
 */
export const clearVotingRecordsForActivities = (activityIds: string[]): void => {
  try {
    const votedActivities = getVotedActivities();
    const filteredActivities = votedActivities.filter(id => !activityIds.includes(id));
    localStorage.setItem(VOTED_ACTIVITIES_KEY, JSON.stringify(filteredActivities));

    const votingRecords = getVotingRecords();
    const filteredRecords = votingRecords.filter(r => !activityIds.includes(r.activityId));
    localStorage.setItem(VOTING_RECORDS_KEY, JSON.stringify(filteredRecords));

    console.log('Cleared voting records for', activityIds.length, 'activities');
  } catch (error) {
    console.error('Error clearing voting records from localStorage:', error);
  }
};

/**
 * Clear all voting records for a specific room
 */
export const clearVotingRecordsForRoom = (roomId: string): void => {
  try {
    const votingRecords = getVotingRecords();
    const roomActivityIds = votingRecords
      .filter(r => r.roomId === roomId)
      .map(r => r.activityId);

    if (roomActivityIds.length > 0) {
      clearVotingRecordsForActivities(roomActivityIds);
      console.log('Cleared voting records for room', roomId, '- affected', roomActivityIds.length, 'activities');
    }
  } catch (error) {
    console.error('Error clearing room voting records from localStorage:', error);
  }
};

/**
 * Get enhanced voting records with metadata
 */
export const getVotingRecords = (): VotingRecord[] => {
  try {
    const stored = localStorage.getItem(VOTING_RECORDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading voting records from localStorage:', error);
    return [];
  }
};

/**
 * Clear all voting records (complete reset)
 */
export const clearAllVotingRecords = (): void => {
  try {
    localStorage.removeItem(VOTED_ACTIVITIES_KEY);
    localStorage.removeItem(VOTING_RECORDS_KEY);
    console.log('Cleared all voting records from localStorage');
  } catch (error) {
    console.error('Error clearing all voting records from localStorage:', error);
  }
};

/**
 * Migrate legacy voting records to include room information
 */
export const migrateLegacyVotingRecords = (roomActivities: { activityId: string; roomId: string }[]): void => {
  try {
    const votedActivities = getVotedActivities();
    const votingRecords = getVotingRecords();

    // Find voted activities that don't have enhanced records
    const missingRecords = votedActivities.filter(activityId => 
      !votingRecords.some(r => r.activityId === activityId)
    );

    if (missingRecords.length > 0) {
      const newRecords: VotingRecord[] = missingRecords.map(activityId => {
        const roomInfo = roomActivities.find(ra => ra.activityId === activityId);
        return {
          activityId,
          timestamp: Date.now(),
          roomId: roomInfo?.roomId
        };
      });

      const updatedRecords = [...votingRecords, ...newRecords];
      localStorage.setItem(VOTING_RECORDS_KEY, JSON.stringify(updatedRecords));
      console.log('Migrated', newRecords.length, 'legacy voting records');
    }
  } catch (error) {
    console.error('Error migrating legacy voting records:', error);
  }
};

/**
 * Validate and clean up inconsistent voting records
 */
export const validateVotingRecords = (): void => {
  try {
    const votedActivities = getVotedActivities();
    const votingRecords = getVotingRecords();

    // Remove any voting records that aren't in the voted activities list
    const validRecords = votingRecords.filter(r => votedActivities.includes(r.activityId));
    
    // Remove any voted activities that are older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentRecords = validRecords.filter(r => r.timestamp > thirtyDaysAgo);
    const recentActivityIds = recentRecords.map(r => r.activityId);

    // Update localStorage with cleaned data
    localStorage.setItem(VOTED_ACTIVITIES_KEY, JSON.stringify(recentActivityIds));
    localStorage.setItem(VOTING_RECORDS_KEY, JSON.stringify(recentRecords));

    const removedCount = votedActivities.length - recentActivityIds.length;
    if (removedCount > 0) {
      console.log('Cleaned up', removedCount, 'old voting records');
    }
  } catch (error) {
    console.error('Error validating voting records:', error);
  }
};