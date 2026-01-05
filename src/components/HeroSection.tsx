'use client'

import React from 'react';

interface HeroSectionProps {
  userName?: string;
}

export function HeroSection({ userName = 'User' }: HeroSectionProps) {
  return (
    <div className="relative min-h-[60vh] bg-gradient-to-br from-slate-900 via-slate-800 to-red-pantone overflow-hidden">
      {/* Background music elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-red-pantone animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 rounded-full bg-cool-gray animate-pulse delay-500"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 rounded-full bg-crimson animate-pulse delay-1000"></div>
      </div>

      {/* Musical notes floating animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 text-6xl text-red-pantone/20 float-note">♪</div>
        <div className="absolute top-1/3 right-1/4 text-4xl text-cool-gray/20 float-note delay-1000">♫</div>
        <div className="absolute bottom-1/3 left-1/5 text-5xl text-crimson/20 float-note delay-2000">♪</div>
        <div className="absolute top-2/3 right-1/3 text-3xl text-antiflash-white/20 float-note delay-1500">♬</div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Welcome message */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 fade-in-up">
            Hey {userName}!
          </h1>

          <p className="text-xl md:text-2xl text-antiflash-white/90 mb-12 fade-in-up stagger-1">
            Manage your YouTube music in style
          </p>

          {/* Music placeholders grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 fade-in-up stagger-2">
            {/* Album placeholder 1 */}
            <div className="group cursor-pointer">
              <div className="aspect-square bg-gradient-to-br from-cool-gray to-space-cadet rounded-xl mb-3 flex items-center justify-center shadow-xl transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
                <div className="text-white/60 text-4xl">🎵</div>
              </div>
              <p className="text-antiflash-white/80 text-sm">Playlist 1</p>
            </div>

            {/* Album placeholder 2 */}
            <div className="group cursor-pointer">
              <div className="aspect-square bg-gradient-to-br from-red-pantone to-crimson rounded-xl mb-3 flex items-center justify-center shadow-xl transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
                <div className="text-white text-4xl">🎸</div>
              </div>
              <p className="text-antiflash-white/80 text-sm">Rock Hits</p>
            </div>

            {/* Album placeholder 3 */}
            <div className="group cursor-pointer">
              <div className="aspect-square bg-gradient-to-br from-space-cadet to-cool-gray rounded-xl mb-3 flex items-center justify-center shadow-xl transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
                <div className="text-white/60 text-4xl">🎧</div>
              </div>
              <p className="text-antiflash-white/80 text-sm">Electronic</p>
            </div>

            {/* Album placeholder 4 */}
            <div className="group cursor-pointer">
              <div className="aspect-square bg-gradient-to-br from-crimson via-red-pantone to-cool-gray rounded-xl mb-3 flex items-center justify-center shadow-xl transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
                <div className="text-white text-4xl">🎤</div>
              </div>
              <p className="text-antiflash-white/80 text-sm">Favorites</p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="grid md:grid-cols-3 gap-8 mt-16 fade-in-up stagger-3">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-pantone/20 rounded-full flex items-center justify-center">
                <span className="text-red-pantone text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Analysis</h3>
              <p className="text-antiflash-white/70">Discover your listening stats</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-cool-gray/20 rounded-full flex items-center justify-center">
                <span className="text-cool-gray text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Manage</h3>
              <p className="text-antiflash-white/70">Organize your playlists easily</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-crimson/20 rounded-full flex items-center justify-center">
                <span className="text-crimson text-2xl">💫</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Discover</h3>
              <p className="text-antiflash-white/70">Explore new genres</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave effect */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-20">
          <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25" fill="currentColor" className="text-antiflash-white"></path>
          <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5" fill="currentColor" className="text-antiflash-white"></path>
          <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" fill="currentColor" className="text-antiflash-white"></path>
        </svg>
      </div>
    </div>
  );
}