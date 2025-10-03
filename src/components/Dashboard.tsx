'use client'

import React from 'react';
import { LikedSongsAnalysis } from './LikedSongsAnalysis';

interface DashboardProps {
  userName: string;
}

export const Dashboard: React.FC<DashboardProps> = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <LikedSongsAnalysis />
    </div>
  );
};
