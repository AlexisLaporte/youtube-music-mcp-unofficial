"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EssentiaInstance = any;

interface AudioFeatures {
  bpm: number | null;
  key: string | null;
  scale: string | null;
  energy: number | null;
  danceability: number | null;
}

interface CachedAnalysis {
  cached: boolean;
  videoId: string;
  title: string | null;
  artist: string | null;
  bpm?: number | null;
  key?: string | null;
  scale?: string | null;
  energy?: number | null;
  danceability?: number | null;
  lastfmTags?: string[] | null;
}

interface LastFmInfo {
  tags: string[];
  listeners?: string;
  playcount?: string;
}

declare global {
  interface Window {
    Essentia: EssentiaInstance;
    EssentiaWASM: EssentiaInstance;
  }
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isEssentiaReady, setIsEssentiaReady] = useState(false);
  const [features, setFeatures] = useState<AudioFeatures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState("Loading Essentia.js...");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [autoAnalyzeTriggered, setAutoAnalyzeTriggered] = useState(false);
  const [lastFmInfo, setLastFmInfo] = useState<LastFmInfo | null>(null);
  const [trackMeta, setTrackMeta] = useState<{ title: string; artist: string } | null>(null);
  const essentiaRef = useRef<EssentiaInstance>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLastFmTags = async (artist: string, track: string): Promise<string[] | null> => {
    try {
      const res = await fetch(`/api/lastfm?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
      if (res.ok) {
        const data = await res.json();
        const tags = data.tags || [];
        setLastFmInfo({ tags, listeners: data.listeners, playcount: data.playcount });
        return tags;
      }
    } catch (e) {
      console.warn("Last.fm fetch failed:", e);
    }
    return null;
  };

  useEffect(() => {
    loadEssentia();
  }, []);

  // Auto-analyze from URL param
  useEffect(() => {
    const videoId = searchParams.get("v");
    const title = searchParams.get("title");
    const artist = searchParams.get("artist");

    if (videoId && isEssentiaReady && !autoAnalyzeTriggered) {
      setAutoAnalyzeTriggered(true);
      setYoutubeUrl(videoId);

      // Check cache first
      checkCacheAndAnalyze(videoId, title, artist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isEssentiaReady, autoAnalyzeTriggered]);

  const checkCacheAndAnalyze = async (videoId: string, urlTitle: string | null, urlArtist: string | null) => {
    setIsLoading(true);
    setLoadingStatus("Vérification du cache...");

    try {
      const res = await fetch(`/api/analysis?v=${videoId}`);
      const data: CachedAnalysis = await res.json();

      // Use URL params or cached/fetched metadata
      const title = urlTitle || data.title;
      const artist = urlArtist || data.artist;

      if (title && artist) {
        setTrackMeta({ title, artist });
        setSourceName(`${title} - ${artist}`);
      } else {
        setSourceName(`YouTube: ${videoId}`);
      }

      // If we have cached analysis results, use them
      if (data.cached && data.bpm !== undefined) {
        setFeatures({
          bpm: data.bpm,
          key: data.key || null,
          scale: data.scale || null,
          energy: data.energy ?? null,
          danceability: data.danceability ?? null,
        });

        if (data.lastfmTags && data.lastfmTags.length > 0) {
          setLastFmInfo({ tags: data.lastfmTags });
        } else if (title && artist) {
          fetchLastFmTags(artist, title);
        }

        setIsLoading(false);
        return;
      }

      // No cache - need to analyze
      let tags: string[] | null = null;
      if (title && artist) {
        tags = await fetchLastFmTags(artist, title);
      }

      await analyzeVideoId(videoId, title, artist, tags);
    } catch (error) {
      console.error("Cache check failed:", error);
      // Fallback to direct analysis
      let tags: string[] | null = null;
      if (urlTitle && urlArtist) {
        setTrackMeta({ title: urlTitle, artist: urlArtist });
        setSourceName(`${urlTitle} - ${urlArtist}`);
        tags = await fetchLastFmTags(urlArtist, urlTitle);
      }
      await analyzeVideoId(videoId, urlTitle, urlArtist, tags);
    }
  };

  const loadEssentia = async () => {
    try {
      const wasmScript = document.createElement("script");
      wasmScript.src = "https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.js";
      document.head.appendChild(wasmScript);

      await new Promise((resolve) => {
        wasmScript.onload = resolve;
      });

      setLoadingStatus("Loading main module...");

      const essentiaScript = document.createElement("script");
      essentiaScript.src = "https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js";
      document.head.appendChild(essentiaScript);

      await new Promise((resolve) => {
        essentiaScript.onload = resolve;
      });

      setLoadingStatus("Initializing...");

      const wasm = await window.EssentiaWASM();
      essentiaRef.current = new window.Essentia(wasm);
      setIsEssentiaReady(true);
    } catch (err) {
      console.error("Failed to load Essentia:", err);
      setError("Failed to load Essentia.js");
    }
  };

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

  const analyzeVideoId = async (
    videoId: string,
    title?: string | null,
    artist?: string | null,
    tags?: string[] | null
  ) => {
    setError(null);
    setFeatures(null);
    setLoadingStatus("Extraction de l'audio...");

    try {
      const response = await fetch(`/api/audio?v=${videoId}`);
      if (!response.ok) {
        throw new Error("Impossible d'extraire l'audio");
      }

      setLoadingStatus("Décodage...");
      const arrayBuffer = await response.arrayBuffer();
      await analyzeBuffer(arrayBuffer, videoId, title, artist, tags);
    } catch (err) {
      console.error("YouTube analysis failed:", err);
      setError(err instanceof Error ? err.message : "Erreur d'extraction");
      setIsLoading(false);
    }
  };

  const analyzeFromYoutube = async () => {
    const videoId = extractVideoId(youtubeUrl.trim());
    if (!videoId) {
      setError("URL YouTube invalide");
      return;
    }
    // For manual input, check cache first
    await checkCacheAndAnalyze(videoId, null, null);
  };

  const analyzeBuffer = async (
    arrayBuffer: ArrayBuffer,
    videoId?: string,
    title?: string | null,
    artist?: string | null,
    tags?: string[] | null
  ) => {
    if (!essentiaRef.current) {
      setError("Essentia n'est pas encore prêt");
      setIsLoading(false);
      return;
    }

    try {
      const essentia = essentiaRef.current;
      const audioContext = new AudioContext();

      setLoadingStatus("Analyse en cours...");
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0);
      const signal = essentia.arrayToVector(audioData);

      const extractedFeatures: AudioFeatures = {
        bpm: null,
        key: null,
        scale: null,
        energy: null,
        danceability: null,
      };

      try {
        const rhythm = essentia.RhythmExtractor2013(signal);
        extractedFeatures.bpm = Math.round(rhythm.bpm);
      } catch (e) {
        console.warn("BPM extraction failed:", e);
      }

      try {
        const keyResult = essentia.KeyExtractor(signal);
        extractedFeatures.key = keyResult.key;
        extractedFeatures.scale = keyResult.scale;
      } catch (e) {
        console.warn("Key extraction failed:", e);
      }

      try {
        const rms = essentia.RMS(signal);
        extractedFeatures.energy = Math.round(rms.rms * 1000) / 10;
      } catch (e) {
        console.warn("Energy extraction failed:", e);
      }

      try {
        const danceability = essentia.Danceability(signal);
        extractedFeatures.danceability = Math.round(danceability.danceability * 100);
      } catch (e) {
        console.warn("Danceability extraction failed:", e);
      }

      setFeatures(extractedFeatures);
      await audioContext.close();

      // Save to cache if we have videoId
      if (videoId) {
        fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            title: title || trackMeta?.title,
            artist: artist || trackMeta?.artist,
            ...extractedFeatures,
            lastfmTags: tags || null,
          }),
        }).catch(console.error);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Erreur d'analyse");
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFeatures(null);
    setSourceName(file.name);

    const arrayBuffer = await file.arrayBuffer();
    await analyzeBuffer(arrayBuffer);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzeFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) analyzeFile(file);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Audio Analyzer</h1>
        <p className="text-zinc-400 mb-8">
          Analyse avec Essentia.js
        </p>

        {/* Loading Essentia */}
        {!isEssentiaReady && !error && (
          <div className="mb-6 p-4 bg-zinc-900 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-zinc-400">{loadingStatus}</span>
          </div>
        )}

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
              disabled={!isEssentiaReady || isLoading}
            />
            <button
              onClick={analyzeFromYoutube}
              disabled={!isEssentiaReady || isLoading || !youtubeUrl.trim()}
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
          onClick={() => isEssentiaReady && !isLoading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isEssentiaReady && !isLoading
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
            disabled={!isEssentiaReady || isLoading}
          />
          <p className="text-zinc-400">Glisse un fichier audio ici</p>
        </div>

        {/* Loading status */}
        {isLoading && (
          <div className="mt-6 p-4 bg-zinc-900 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>{loadingStatus}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Results */}
        {features && (
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
