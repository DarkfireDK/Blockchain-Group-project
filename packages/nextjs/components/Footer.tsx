import Link from "next/link";
import { CommandLineIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

export const Footer = () => {
  return (
    <footer className="border-t border-white/[0.06] bg-[#080b0d]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 px-4 py-5 text-[10px] text-[#566367] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="m-0 tracking-[0.08em]">AERIS 协议 / 航班延误保障</p>
        <div className="flex items-center gap-4">
          <Link href="/debug" className="flex items-center gap-1.5 transition hover:text-[#aab5b3]">
            <CommandLineIcon className="h-3.5 w-3.5" /> 合约
          </Link>
          <a
            href="https://speedrunethereum.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 transition hover:text-[#aab5b3]"
          >
            <GlobeAltIcon className="h-3.5 w-3.5" /> Speedrun Ethereum
          </a>
        </div>
      </div>
    </footer>
  );
};
