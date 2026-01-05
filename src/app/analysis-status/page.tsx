"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  MusicalNoteIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/24/outline";

interface AnalysisStats {
  totalTracks: number;
  analyzedCount: number;
  pendingCount: number;
  versionBreakdown: { version: number; count: number }[];
  recentAnalyses: {
    videoId: string;
    title: string | null;
    artist: string | null;
    bpm: number | null;
    version: number;
    updatedAt: number;
  }[];
  pendingIds: string[];
}

interface BatchStatus {
  running: boolean;
  startedAt: number | null;
  processedCount: number;
  lastVideoId: string | null;
  error: string | null;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default function AnalysisStatusPage() {
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  const fetchBatchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis/batch");
      if (res.ok) {
        const data = await res.json();
        setBatchStatus(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  const startBatch = async () => {
    try {
      const res = await fetch("/api/analysis/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: limit > 0 ? limit : undefined }),
      });
      const data = await res.json();
      if (data.status) {
        setBatchStatus(data.status);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    }
  };

  const stopBatch = async () => {
    try {
      await fetch("/api/analysis/batch", { method: "DELETE" });
      await fetchBatchStatus();
    } catch {
      // Ignore
    }
  };

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchBatchStatus()]);
      setLoading(false);
    };
    init();
  }, [fetchStats, fetchBatchStatus]);

  // Poll when batch is running
  useEffect(() => {
    if (!batchStatus?.running) return;

    const interval = setInterval(() => {
      fetchBatchStatus();
      fetchStats();
    }, 3000);

    return () => clearInterval(interval);
  }, [batchStatus?.running, fetchBatchStatus, fetchStats]);

  const progressPercent = stats
    ? Math.round((stats.analyzedCount / stats.totalTracks) * 100)
    : 0;

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-space-cadet flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Analysis Status</h1>
                <p className="text-sm text-gray-500">Track audio analysis progress</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  fetchStats();
                  fetchBatchStatus();
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <Link
                href="/"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Back to app
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-space-cadet" />
          </div>
        ) : stats ? (
          <div className="space-y-8">
            {/* Batch control panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Batch Analysis</h2>

              {batchStatus?.running ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-gray-700">Analysis running...</span>
                    {batchStatus.startedAt && (
                      <span className="text-sm text-gray-500">
                        ({formatDuration(Date.now() - batchStatus.startedAt)})
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">
                      Processed: <span className="font-medium">{batchStatus.processedCount}</span>
                    </div>
                    {batchStatus.lastVideoId && (
                      <div className="text-sm text-gray-500 mt-1">
                        Current: <code className="bg-gray-200 px-1 rounded">{batchStatus.lastVideoId}</code>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={stopBatch}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                  >
                    <StopIcon className="w-4 h-4" />
                    Stop
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {batchStatus?.error && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                      {batchStatus.error}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Limit:</label>
                      <input
                        type="number"
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        min={0}
                        placeholder="All"
                      />
                      <span className="text-xs text-gray-500">(0 = all)</span>
                    </div>

                    <button
                      onClick={startBatch}
                      disabled={stats.pendingCount === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-space-cadet text-white hover:bg-space-cadet/90 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <PlayIcon className="w-4 h-4" />
                      Start Analysis
                    </button>
                  </div>

                  <p className="text-sm text-gray-500">
                    {stats.pendingCount > 0
                      ? `${stats.pendingCount} tracks pending analysis`
                      : "All tracks have been analyzed"}
                  </p>
                </div>
              )}
            </div>

            {/* Progress overview */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress</h2>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {stats.analyzedCount} of {stats.totalTracks} tracks analyzed
                  </span>
                  <span className="text-sm font-medium text-gray-900">{progressPercent}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-space-cadet to-red-pantone rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700">Analyzed</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{stats.analyzedCount}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ClockIcon className="w-5 h-5 text-amber-600" />
                    <span className="text-sm text-amber-700">Pending</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-900">{stats.pendingCount}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MusicalNoteIcon className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-blue-700">Total</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{stats.totalTracks}</div>
                </div>
              </div>
            </div>

            {/* Version breakdown */}
            {stats.versionBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Algorithm Versions</h2>
                <div className="space-y-3">
                  {stats.versionBreakdown.map((v) => (
                    <div key={v.version} className="flex items-center gap-4">
                      <div className="w-20 text-sm text-gray-600">v{v.version}</div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-space-cadet/70 rounded-full"
                          style={{
                            width: `${(v.count / stats.analyzedCount) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-16 text-sm text-gray-900 text-right">{v.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent analyses */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Analyses</h2>
              {stats.recentAnalyses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No analyses yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stats.recentAnalyses.map((analysis) => (
                    <div key={analysis.videoId} className="py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {analysis.title || analysis.videoId}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {analysis.artist || "Unknown artist"}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 text-right">
                        {analysis.bpm && <span className="font-mono">{analysis.bpm} BPM</span>}
                      </div>
                      <div className="text-xs text-gray-400 w-20 text-right">
                        {formatDate(analysis.updatedAt)}
                      </div>
                      <div className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        v{analysis.version}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending tracks */}
            {stats.pendingIds.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Pending Tracks</h2>
                <p className="text-sm text-gray-500 mb-4">
                  First {Math.min(50, stats.pendingIds.length)} of {stats.pendingCount} tracks
                  awaiting analysis
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.pendingIds.map((id) => (
                    <a
                      key={id}
                      href={`https://music.youtube.com/watch?v=${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    >
                      {id}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
