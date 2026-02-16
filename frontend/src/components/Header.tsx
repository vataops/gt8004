"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/components/Toast";

// HydroX Logo Component - matching landing page
const HydroXLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="32" height="32" rx="8" fill="#0a0a0a" />
    <path
      d="M16 6C16 6 10 12 10 18C10 21.3137 12.6863 24 16 24C19.3137 24 22 21.3137 22 18C22 12 16 6 16 6Z"
      fill="#00FFE0"
      style={{ filter: "drop-shadow(0 0 8px rgba(0,255,224,0.6))" }}
    />
    <path
      d="M16 10C16 10 13 14 13 17.5C13 19.433 14.567 21 16.5 21C18.433 21 20 19.433 20 17.5C20 14 16 10 16 10Z"
      fill="#0a0a0a"
      fillOpacity="0.5"
    />
  </svg>
);

// Wallet Icon
const WalletIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
  </svg>
);

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { walletAddress, isConnecting, isLaceAvailable, connectWallet, disconnectWallet } = useWallet();
  const { showToast } = useToast();

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      // No toast on success - wallet connection is shown in the header
    } catch (error) {
      const err = error as Error;
      showToast({
        type: "error",
        title: "Connection Failed",
        message: err.message,
      });
    }
  };

  const isPerpetualsActive = pathname.startsWith("/perpetuals") || pathname === "/";
  const isVaultsActive = pathname.startsWith("/vaults");
  const isStakingActive = pathname.startsWith("/staking");
  const isLoungeActive = pathname.startsWith("/lounge");

  // Format address for display
  const formatAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <header className="bg-[#0a0a0a] border-b border-[#1a1a1a] text-white px-6 py-3 shrink-0 z-50">
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center space-x-8">
          {/* Logo with HydroX theme */}
          <Link href="/" className="flex items-center space-x-2 group">
            <HydroXLogo className="h-8 w-8" />
            <h1 className="text-xl font-bold text-[#00FFE0] drop-shadow-[0_0_10px_rgba(0,255,224,0.5)] group-hover:drop-shadow-[0_0_15px_rgba(0,255,224,0.7)] transition-all">
              HydroX
            </h1>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-1">
            <Link
              href="/perpetuals"
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                isPerpetualsActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10 border border-[#00FFE0]/30"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              Perpetuals
            </Link>
            <Link
              href="/vaults"
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                isVaultsActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10 border border-[#00FFE0]/30"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              Vaults
            </Link>
            <Link
              href="/staking"
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium flex items-center gap-1.5 ${
                isStakingActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10 border border-[#00FFE0]/30"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Staking
            </Link>
            <Link
              href="/lounge"
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium flex items-center gap-1.5 ${
                isLoungeActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10 border border-[#00FFE0]/30"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Lounge
            </Link>
          </nav>
        </div>

        {/* Right side - Wallet Connection */}
        <div className="hidden md:flex items-center">
          {walletAddress ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#00FFE0]/10 border border-[#00FFE0]/30 rounded-lg shadow-[0_0_15px_rgba(0,255,224,0.1)]">
                <div className="w-2 h-2 bg-[#00FFE0] rounded-full animate-pulse shadow-[0_0_8px_rgba(0,255,224,0.6)]" />
                <span className="text-sm font-mono text-[#00FFE0] font-medium">
                  {formatAddress(walletAddress)}
                </span>
              </div>
              <button
                onClick={disconnectWallet}
                className="px-3 py-2 text-sm text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/10 rounded-lg transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={isConnecting || !isLaceAvailable}
              className="flex items-center gap-2 px-4 py-2 bg-[#00FFE0]/10 border border-[#00FFE0]/30 rounded-lg text-[#00FFE0] hover:bg-[#00FFE0]/20 hover:border-[#00FFE0]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,255,224,0.1)]"
            >
              <WalletIcon className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isConnecting ? "Connecting..." : isLaceAvailable ? "Connect Wallet" : "Install Lace"}
              </span>
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg hover:bg-[#00FFE0]/10 transition-colors text-[#00FFE0]"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16m-7 6h7"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-[#1a1a1a]">
          <nav className="flex flex-col space-y-1">
            <Link
              href="/perpetuals"
              className={`px-4 py-2 rounded-lg ${
                isPerpetualsActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              Perpetuals
            </Link>
            <Link
              href="/vaults"
              className={`px-4 py-2 rounded-lg ${
                isVaultsActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              Vaults
            </Link>
            <Link
              href="/staking"
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 ${
                isStakingActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Staking
            </Link>
            <Link
              href="/lounge"
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 ${
                isLoungeActive
                  ? "text-[#00FFE0] bg-[#00FFE0]/10"
                  : "text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/5"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Lounge
            </Link>
          </nav>
          <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
            {walletAddress ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#00FFE0]/10 border border-[#00FFE0]/30 rounded-lg">
                  <div className="w-2 h-2 bg-[#00FFE0] rounded-full animate-pulse" />
                  <span className="text-sm font-mono text-[#00FFE0]">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="w-full px-3 py-2 text-sm text-zinc-400 hover:text-[#00FFE0] hover:bg-[#00FFE0]/10 rounded-lg transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={isConnecting || !isLaceAvailable}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#00FFE0]/10 border border-[#00FFE0]/30 rounded-lg text-[#00FFE0] hover:bg-[#00FFE0]/20 hover:border-[#00FFE0]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <WalletIcon className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {isConnecting ? "Connecting..." : isLaceAvailable ? "Connect Wallet" : "Install Lace"}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
