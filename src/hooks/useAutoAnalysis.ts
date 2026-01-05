import { useEffect, useRef } from 'react';

const AUTO_ANALYSIS_LIMIT = 5; // Analyze 5 tracks at a time to not overload
const CHECK_INTERVAL = 60000; // Check every minute

export function useAutoAnalysis() {
  const isChecking = useRef(false);

  useEffect(() => {
    const checkAndStart = async () => {
      if (isChecking.current) return;
      isChecking.current = true;

      try {
        // Check if batch is already running
        const statusRes = await fetch('/api/analysis/batch');
        if (!statusRes.ok) return;

        const status = await statusRes.json();
        if (status.running) {
          return; // Already running
        }

        // Check if there are pending tracks
        const statsRes = await fetch('/api/analysis/stats');
        if (!statsRes.ok) return;

        const stats = await statsRes.json();
        if (stats.pendingCount > 0) {
          // Start batch analysis in background
          await fetch('/api/analysis/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: AUTO_ANALYSIS_LIMIT }),
          });
          console.log(`[AutoAnalysis] Started batch for ${Math.min(AUTO_ANALYSIS_LIMIT, stats.pendingCount)} tracks`);
        }
      } catch (err) {
        console.warn('[AutoAnalysis] Check failed:', err);
      } finally {
        isChecking.current = false;
      }
    };

    // Initial check after a short delay (let app load first)
    const initialTimeout = setTimeout(checkAndStart, 5000);

    // Periodic check
    const interval = setInterval(checkAndStart, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);
}
