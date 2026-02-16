"use client";

import React, { useState, useEffect } from 'react';

const Footer = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return (
    <footer className="w-full bg-[#0a0a0a] border-t border-[#1a1a1a] text-zinc-400 px-6 py-2 text-xs shrink-0">
      <div className="flex items-center justify-between w-full">
        {/* Left side - Links */}
        <div className="hidden md:flex items-center space-x-4">
          <a href="#" className="hover:text-[#00FFE0] transition-colors">API Docs</a>
          <span className="text-zinc-700">|</span>
          <a href="#" className="hover:text-[#00FFE0] transition-colors">Support</a>
          <span className="text-zinc-700">|</span>
          <a href="#" className="hover:text-[#00FFE0] transition-colors">Terms</a>
        </div>

        {/* Right side - Status */}
        <div className="flex items-center space-x-4 ml-auto">
          {/* Connection status */}
          <div className="flex items-center space-x-1.5">
            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-[#00FFE0] animate-pulse shadow-[0_0_8px_rgba(0,255,224,0.6)]' : 'bg-red-500'}`}></span>
            <span className={isOnline ? 'text-[#00FFE0]' : 'text-red-500'}>
              {isOnline ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Version */}
          <div className="text-zinc-600">
            v1.0.0
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
