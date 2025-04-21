const mongoose = require('mongoose');
const NotificationManager = require('./notificationManager');

class DatabaseManager {
  static async getStats() {
    try {
      const stats = await mongoose.connection.db.stats();
      return {
        sizeInMB: (stats.dataSize / (1024 * 1024)).toFixed(2),
        storageInMB: (stats.storageSize / (1024 * 1024)).toFixed(2),
        indexSizeInMB: (stats.indexSize / (1024 * 1024)).toFixed(2),
        freeStorageMB: (512 - stats.storageSize / (1024 * 1024)).toFixed(2),
        usagePercentage: ((stats.storageSize / (1024 * 1024) / 512) * 100).toFixed(1)
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }

  static async cleanupOldReservations() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // First, archive completed reservations
      const result = await mongoose.model('Reservation').deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        status: { $in: ['confirmed', 'cancelled'] }
      });

      // Then, check for abandoned pending reservations (older than 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const abandonedResult = await mongoose.model('Reservation').deleteMany({
        createdAt: { $lt: oneDayAgo },
        status: 'pending'
      });

      const totalDeleted = result.deletedCount + abandonedResult.deletedCount;
      
      if (totalDeleted > 0) {
        await NotificationManager.notify(
          'Cleanup Completed',
          `Cleaned up ${result.deletedCount} old reservations and ${abandonedResult.deletedCount} abandoned pending reservations.`
        );
      }

      return totalDeleted;
    } catch (error) {
      console.error('Error during cleanup:', error);
      await NotificationManager.notify(
        'Cleanup Failed',
        `Error during cleanup: ${error.message}`,
        true
      );
      return 0;
    }
  }

  static async archiveReservations() {
    try {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Get reservations to archive
      const reservationsToArchive = await mongoose.model('Reservation').find({
        createdAt: { $lt: sixtyDaysAgo }
      });

      if (reservationsToArchive.length > 0) {
        // Create archive collection if it doesn't exist
        const Archive = mongoose.model('Archive') || mongoose.model('Archive', new mongoose.Schema({}, { strict: false }));
        
        // Add archive date and metadata
        const archiveData = reservationsToArchive.map(res => ({
          ...res.toObject(),
          archivedAt: new Date(),
          archiveReason: 'age',
          originalCollection: 'reservations'
        }));

        // Insert into archive
        await Archive.insertMany(archiveData);

        // Delete archived reservations
        await mongoose.model('Reservation').deleteMany({
          _id: { $in: reservationsToArchive.map(r => r._id) }
        });

        await NotificationManager.notify(
          'Archiving Completed',
          `Archived ${reservationsToArchive.length} old reservations successfully.`
        );

        return reservationsToArchive.length;
      }
      return 0;
    } catch (error) {
      console.error('Error during archiving:', error);
      await NotificationManager.notify(
        'Archiving Failed',
        `Error during archiving: ${error.message}`,
        true
      );
      return 0;
    }
  }

  static async monitorHealth() {
    try {
      const stats = await this.getStats();
      if (!stats) return;

      // Alert thresholds (in MB)
      const WARNING_THRESHOLD = 350;  // About 68% of free tier
      const CRITICAL_THRESHOLD = 400; // About 78% of free tier
      const EMERGENCY_THRESHOLD = 450; // About 88% of free tier

      const storageUsed = parseFloat(stats.storageInMB);
      const message = `
Database Storage Alert

Current Usage: ${stats.storageInMB}MB of 512MB
Usage Percentage: ${stats.usagePercentage}%
Free Space: ${stats.freeStorageMB}MB
Index Size: ${stats.indexSizeInMB}MB

Automatic Cleanup:
- Daily cleanup of orders older than 30 days
- Weekly archiving of data older than 60 days
- Immediate cleanup of abandoned pending orders (24h+)
`;

      // Send appropriate alerts based on usage
      if (storageUsed > EMERGENCY_THRESHOLD) {
        await NotificationManager.notify(
          'EMERGENCY: Database Near Capacity',
          `${message}\n\nURGENT: Database is nearing free tier limit. Emergency cleanup initiated.`,
          true
        );
        // Trigger immediate cleanup
        await this.cleanupOldReservations();
        await this.archiveReservations();
      } else if (storageUsed > CRITICAL_THRESHOLD) {
        await NotificationManager.notify(
          'CRITICAL: High Database Usage',
          `${message}\n\nAction Required: Please review and clean up unnecessary data.`,
          true
        );
      } else if (storageUsed > WARNING_THRESHOLD) {
        await NotificationManager.notify(
          'WARNING: Database Usage Alert',
          `${message}\n\nConsider cleaning up old data to prevent reaching limits.`,
          false
        );
      }

      return {
        ...stats,
        alerts: {
          warning: storageUsed > WARNING_THRESHOLD,
          critical: storageUsed > CRITICAL_THRESHOLD,
          emergency: storageUsed > EMERGENCY_THRESHOLD
        }
      };
    } catch (error) {
      console.error('Error monitoring database health:', error);
      await NotificationManager.notify(
        'Monitoring Error',
        `Error during health monitoring: ${error.message}`,
        true
      );
    }
  }

  static scheduleMaintenanceTasks() {
    // Monitor health every 4 hours
    setInterval(async () => {
      await this.monitorHealth();
    }, 4 * 60 * 60 * 1000);

    // Run cleanup daily at specified hour (default 3 AM)
    const cleanupHour = parseInt(process.env.CLEANUP_HOUR || '3');
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === cleanupHour && now.getMinutes() === 0) {
        await this.cleanupOldReservations();
      }
    }, 60 * 1000);

    // Run archiving weekly on Sunday at specified hour (default 4 AM)
    const archiveHour = parseInt(process.env.ARCHIVE_HOUR || '4');
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() === 0 && now.getHours() === archiveHour && now.getMinutes() === 0) {
        await this.archiveReservations();
      }
    }, 60 * 1000);

    // Run initial health check
    this.monitorHealth();
    console.log('Database maintenance tasks scheduled');
  }
}

module.exports = DatabaseManager; 