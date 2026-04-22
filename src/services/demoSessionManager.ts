const PRELOGIN_TRANSITION_SNAPSHOT_KEY = 'preloginTransitionSnapshot:guest';
const PRELOGIN_TRANSITION_PENDING_KEY = 'preloginTransitionPendingUser';
const PRELOGIN_TRANSITION_RESTORED_KEY = 'preloginTransitionRestored';

export class DemoSessionManager {
  private static instance: DemoSessionManager;
  
  private constructor() {}
  
  static getInstance(): DemoSessionManager {
    if (!DemoSessionManager.instance) {
      DemoSessionManager.instance = new DemoSessionManager();
    }
    return DemoSessionManager.instance;
  }

  migrateGuestSnapshotToUser(userId: string): boolean {
    try {
      const raw = localStorage.getItem(PRELOGIN_TRANSITION_SNAPSHOT_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { expiresAt?: number };
      if (typeof parsed.expiresAt === 'number' && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(PRELOGIN_TRANSITION_SNAPSHOT_KEY);
        localStorage.removeItem(PRELOGIN_TRANSITION_PENDING_KEY);
        return false;
      }
      localStorage.setItem(PRELOGIN_TRANSITION_PENDING_KEY, userId);
      return true;
    } catch (error) {
      console.error('Failed to migrate guest transition snapshot:', error);
      return false;
    }
  }

  markUserRestoreConsumed(userId: string): void {
    try {
      localStorage.setItem(PRELOGIN_TRANSITION_RESTORED_KEY, userId);
      localStorage.removeItem(PRELOGIN_TRANSITION_PENDING_KEY);
    } catch (error) {
      console.error('Failed to mark transition snapshot consumed:', error);
    }
  }

  clearTransitionData(): void {
    try {
      localStorage.removeItem(PRELOGIN_TRANSITION_PENDING_KEY);
      localStorage.removeItem(PRELOGIN_TRANSITION_SNAPSHOT_KEY);
    } catch (error) {
      console.error('Failed to clear transition snapshot data:', error);
    }
  }
}