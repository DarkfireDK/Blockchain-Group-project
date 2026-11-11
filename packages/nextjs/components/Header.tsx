"use client";

import Link from "next/link";
import { CommandLineIcon, MagnifyingGlassIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

export const Header = () => {
  const { targetNetwork } = useTargetNetwork();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080b0d]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="AERIS 首页" className="group flex shrink-0 items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#87f5d6]/20 bg-[#87f5d6]/[0.07] text-[#87f5d6] transition group-hover:border-[#87f5d6]/40">
            <PaperAirplaneIcon className="h-5 w-5 -rotate-45" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.16em] text-[#f0f5f3]">AERIS</span>
            <span className="block whitespace-nowrap text-[8px] font-semibold tracking-[0.12em] text-[#5f6d70]">
              链上航班保障
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#87f5d6]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#899699]">
              {targetNetwork.name}
            </span>
          </div>
          <Link
            href="/blockexplorer"
            title="区块浏览器"
            aria-label="区块浏览器"
            className="hidden h-9 w-9 place-items-center rounded-lg text-[#657276] transition hover:bg-white/[0.05] hover:text-[#dce5e3] sm:grid"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/debug"
            title="调试合约"
            aria-label="调试合约"
            className="hidden h-9 w-9 place-items-center rounded-lg text-[#657276] transition hover:bg-white/[0.05] hover:text-[#dce5e3] sm:grid"
          >
            <CommandLineIcon className="h-4 w-4" />
          </Link>
          <FaucetButton />
          <div className="h-6 w-px bg-white/[0.08]" />
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    </header>
  );
};
