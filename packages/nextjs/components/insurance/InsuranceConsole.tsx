"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { LiquidityPanel } from "./LiquidityPanel";
import { MarketPanel } from "./MarketPanel";
import { OperationsPanel } from "./OperationsPanel";
import { PolicyPanel, PolicyPortfolio } from "./PolicyPanel";
import { ConsoleButton, MetricCard, StatusChip, formatUsdc, shortAddress } from "./shared";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BeakerIcon,
  ClockIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type TabId = "cover" | "liquidity" | "market" | "operations";

const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "cover", label: "航班保障", icon: <ShieldCheckIcon className="h-4 w-4" /> },
  { id: "liquidity", label: "流动性", icon: <BanknotesIcon className="h-4 w-4" /> },
  { id: "market", label: "保单市场", icon: <ArrowsRightLeftIcon className="h-4 w-4" /> },
  { id: "operations", label: "运营管理", icon: <CommandLineIcon className="h-4 w-4" /> },
];

export const InsuranceConsole = () => {
  const [activeTab, setActiveTab] = useState<TabId>("cover");
  const { targetNetwork } = useTargetNetwork();
  const { data: nextPolicyId } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "nextPolicyId",
  });
  const { data: availableLiquidity } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "availableLiquidity",
  });
  const { data: lockedCoverage } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalLockedCoverage",
  });
  const { data: totalAssets } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalAssets",
  });
  const { data: minDelay } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "minDelayMinutes",
  });

  const policyCount = nextPolicyId ? Math.max(0, Number(nextPolicyId) - 1) : 0;
  const isProtocolReady = availableLiquidity !== undefined && minDelay !== undefined;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#080b0d] pb-16 text-[#eaf0ee]">
      <div className="mx-auto w-full max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] py-6 md:flex-row md:items-end md:justify-between lg:py-8">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  isProtocolReady ? "text-[#87f5d6]" : "text-[#f4c66a]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isProtocolReady
                      ? "bg-[#87f5d6] shadow-[0_0_8px_rgba(135,245,214,0.55)]"
                      : "bg-[#f4c66a] shadow-[0_0_8px_rgba(244,198,106,0.45)]"
                  }`}
                />
                {isProtocolReady ? "协议在线" : "正在连接"}
              </span>
              <span className="text-[10px] text-[#3f4b4e]">/</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#657276]">
                {targetNetwork.name}
              </span>
            </div>
            <h1 className="mb-0 mt-3 text-[clamp(1.75rem,4vw,2.6rem)] font-semibold leading-[1.05] tracking-normal text-[#f4f8f6]">
              航班风险，链上定价。
            </h1>
            <p className="mb-0 mt-3 max-w-xl text-sm leading-6 text-[#7f8d91]">
              从同一个透明控制台购买延误保障、提供理赔容量，并交易保单 NFT。
            </p>
          </div>
          <WalletSnapshot />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="可用承保容量"
            value={formatUsdc(availableLiquidity)}
            unit="USDC"
            hint="可为新航班保单提供保障"
            icon={<Squares2X2Icon className="h-4 w-4" />}
            tone="accent"
          />
          <MetricCard
            label="生效中保额"
            value={formatUsdc(lockedCoverage)}
            unit="USDC"
            hint="为有效保单预留的理赔资金"
            icon={<ShieldCheckIcon className="h-4 w-4" />}
          />
          <MetricCard
            label="池内净资产"
            value={formatUsdc(totalAssets)}
            unit="USDC"
            hint="扣除未结算保费后的 LP 净值"
            icon={<BanknotesIcon className="h-4 w-4" />}
          />
          <MetricCard
            label="理赔门槛"
            value={minDelay?.toString() ?? "-"}
            unit="分钟"
            hint="触发理赔所需的最低延误时间"
            icon={<ClockIcon className="h-4 w-4" />}
            tone="warning"
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-b border-white/[0.07]">
          <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="协议功能">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex h-12 shrink-0 items-center gap-2 px-3 text-xs font-medium transition sm:px-4 ${
                  activeTab === tab.id ? "text-[#f2f6f4]" : "text-[#657276] hover:text-[#b6c0be]"
                }`}
              >
                <span className="hidden sm:block">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && <span className="absolute inset-x-2 bottom-0 h-px bg-[#87f5d6]" />}
              </button>
            ))}
          </div>
          <span className="hidden shrink-0 font-mono text-[10px] text-[#4f5b5e] sm:block">
            已签发 {policyCount} 张保单
          </span>
        </div>

        <div className="mt-5">
          {activeTab === "cover" && (
            <>
              <PolicyPanel policyCount={policyCount} />
              <PolicyPortfolio policyCount={policyCount} />
            </>
          )}
          {activeTab === "liquidity" && <LiquidityPanel />}
          {activeTab === "market" && <MarketPanel />}
          {activeTab === "operations" && <OperationsPanel />}
        </div>
      </div>
    </div>
  );
};

const WalletSnapshot = () => {
  const { address } = useAccount();
  const usdcWrite = useScaffoldWriteContract({ contractName: "MockUSDC" });
  const { data: balance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address],
    query: { enabled: Boolean(address) },
  });
  const { data: lpShares } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "liquidity",
    args: [address],
    query: { enabled: Boolean(address) },
  });
  const { data: policyBalance } = useScaffoldReadContract({
    contractName: "PolicyNFT",
    functionName: "balanceOf",
    args: [address],
    query: { enabled: Boolean(address) },
  });

  const handleMint = async () => {
    if (!address) return;
    try {
      await usdcWrite.writeContractAsync({
        functionName: "mint",
        args: [address, parseUnits("1000", 6)],
      });
      notification.success("已领取 1,000 测试 USDC");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  if (!address) {
    return (
      <div className="flex min-h-24 w-full items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-[#0d1114] px-4 py-3 md:w-auto md:min-w-[310px]">
        <div>
          <p className="m-0 text-xs font-medium text-[#d8e1df]">钱包未连接</p>
          <p className="mb-0 mt-1 text-[11px] text-[#657276]">连接钱包后即可购买保障或提供流动性。</p>
        </div>
        <StatusChip label="未连接" />
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-white/[0.08] bg-[#0d1114] p-4 md:w-auto md:min-w-[390px]">
      <div className="flex items-center justify-between gap-5">
        <div>
          <p className="m-0 text-[10px] font-semibold tracking-[0.1em] text-[#657276]">我的钱包</p>
          <p className="mb-0 mt-1 font-mono text-xs text-[#aeb9b7]">{shortAddress(address)}</p>
        </div>
        <ConsoleButton
          variant="ghost"
          onClick={handleMint}
          busy={usdcWrite.isMining}
          icon={<BeakerIcon className="h-4 w-4" />}
        >
          领取测试 USDC
        </ConsoleButton>
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.07] border-t border-white/[0.06] pt-3">
        <WalletValue label="USDC" value={formatUsdc(balance)} />
        <WalletValue label="LP 份额" value={formatUsdc(lpShares, 2)} />
        <WalletValue label="保单" value={policyBalance?.toString() ?? "0"} />
      </div>
    </div>
  );
};

const WalletValue = ({ label, value }: { label: string; value: string }) => (
  <div className="px-3 first:pl-0 last:pr-0">
    <p className="m-0 text-[9px] tracking-[0.08em] text-[#586569]">{label}</p>
    <p className="mb-0 mt-1 truncate font-mono text-xs text-[#e0e8e6]">{value}</p>
  </div>
);
