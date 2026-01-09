"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEnrichment, EnrichmentStatus, AnalysisResult } from "@/hooks/useEnrichment";

interface LastFmInfo {
  tags: string[];
}

const STATUS_LABELS: Record<EnrichmentStatus, string> = {
  'idle': 'En attente',
  'starting': 'Démarrage...',
  'yt-metadata': 'Récupération métadonnées YouTube...',
  'downloading': 'Téléchargement audio...',
  'analyzing': 'Analyse en cours...',
  'lastfm': 'Récupération des tags Last.fm...',
  'complete': 'Terminé',
  'error': 'Erreur',
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const { status, error: analysisError, enrich, isLoading } = useEnrichment();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [autoAnalyzeTriggered, setAutoAnalyzeTriggered] = useState(false);
  const [lastFmInfo, setLastFmInfo] = useState<LastFmInfo | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-analyze from URL param
  useEffect(() => {
    const videoId = searchParams.get("v");
    const title = searchParams.get("title");
    const artist = searchParams.get("artist");

    if (videoId && !autoAnalyzeTriggered && !isLoading) {
      setAutoAnalyzeTriggered(true);
      setYoutubeUrl(videoId);

      const trackName = title && artist ? `${title} - ${artist}` : `YouTube: ${videoId}`;
      setSourceName(trackName);

      // Run analysis
      enrich(videoId).then(result => {
        if (result) {
          setAnalysisResult(result);
          if (result.lastfmTags && result.lastfmTags.length > 0) {
            setLastFmInfo({ tags: result.lastfmTags });
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, autoAnalyzeTriggered, isLoading]);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const analyzeFromYoutube = async () => {
    const videoId = extractVideoId(youtubeUrl.trim());
    if (!videoId) {
      setLocalError("URL YouTube invalide");
      return;
    }

    setLocalError(null);
    setAnalysisResult(null);
    setLastFmInfo(null);
    setSourceName(`YouTube: ${videoId}`);

    const result = await enrich(videoId);
    if (result) {
      setAnalysisResult(result);
      if (result.lastfmTags && result.lastfmTags.length > 0) {
        setLastFmInfo({ tags: result.lastfmTags });
      }
    }
  };

  const analyzeFile = () => {
    setLocalError("L'analyse de fichiers locaux n'est pas supportée. Utilisez un lien YouTube.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) analyzeFile();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]?.type.startsWith("audio/")) analyzeFile();
  };

  const displayError = analysisError || localError;
  const features = analysisResult;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Audio Analyzer</h1>
        <p className="text-zinc-400 mb-8">
          Analyse serveur avec Essentia
        </p>

        {/* YouTube URL input */}
        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">
            Lien YouTube Music
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://music.youtube.com/watch?v=..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              disabled={isLoading}
            />
            <button
              onClick={analyzeFromYoutube}
              disabled={isLoading || !youtubeUrl.trim()}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isLoading ? "..." : "Analyser"}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-500 text-sm">ou</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Drop zone */}
        <div
          onClick={() => !isLoading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            !isLoading
              ? "border-zinc-700 cursor-pointer hover:border-zinc-500"
              : "border-zinc-800 cursor-not-allowed opacity-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />
          <p className="text-zinc-400">Fichiers locaux non supportés</p>
        </div>

        {/* Loading status with progressive steps */}
        {isLoading && status !== 'idle' && status !== 'complete' && (
          <div className="mt-6 p-4 bg-zinc-900 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">{STATUS_LABELS[status]}</span>
            </div>
            {/* Progress steps visualization */}
            <div className="ml-8 space-y-1 text-sm text-zinc-400">
              {status === 'starting' && <div>Initialisation...</div>}
              {status === 'yt-metadata' && <div>Récupération des informations YouTube</div>}
              {status === 'downloading' && <div>Téléchargement depuis YouTube</div>}
              {status === 'analyzing' && <div>Extraction des features (BPM, Key, etc.)</div>}
              {status === 'lastfm' && <div>Enrichissement métadonnées</div>}
            </div>
          </div>
        )}

        {/* Error */}
        {displayError && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            {displayError}
          </div>
        )}

        {/* Results */}
        {features && status === 'complete' && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">{sourceName}</h2>
            <div className="grid grid-cols-2 gap-4">
              <FeatureCard label="BPM" value={features.bpm} />
              <FeatureCard
                label="Tonalité"
                value={
                  features.key && features.scale
                    ? `${features.key} ${features.scale}`
                    : null
                }
              />
              <FeatureCard
                label="Danceability"
                value={features.danceability !== null ? `${features.danceability}%` : null}
              />
              <FeatureCard
                label="Energy"
                value={features.energy !== null ? `${features.energy}%` : null}
              />
            </div>

            {/* Last.fm Tags */}
            {lastFmInfo && lastFmInfo.tags.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm text-zinc-400 mb-2">Genres / Tags (Last.fm)</h3>
                <div className="flex flex-wrap gap-2">
                  {lastFmInfo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back link */}
        <div className="mt-12">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            ← Retour
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-zinc-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-semibold">
        {value !== null ? value : <span className="text-zinc-600">—</span>}
      </p>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-white" />
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  );
}
