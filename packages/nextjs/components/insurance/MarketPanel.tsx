"use client";

import { useMemo } from "react";
import {
  ConsoleButton,
  ConsolePanel,
  EmptyState,
  SectionHeading,
  StatusChip,
  formatDateTime,
  formatUsdc,
  shortAddress,
} from "./shared";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ArrowsRightLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import {
  useScaffoldContract,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const MarketPanel = () => {
  const { data: listedEvents } = useScaffoldEventHistory({
    contractName: "PolicyMarket",
    eventName: "Listed",
    watch: true,
  });
  const { data: feeBps } = useScaffoldReadContract({
    contractName: "PolicyMarket",
    functionName: "feeBps",
  });

  const policyIds = useMemo(() => {
    const ids = listedEvents?.flatMap(event => (event.args.policyId ? [event.args.policyId.toString()] : [])) ?? [];
    return Array.from(new Set(ids))
      .map(BigInt)
      .sort((a, b) => (a > b ? -1 : 1))
      .slice(0, 50);
  }, [listedEvents]);

  return (
    <ConsolePanel className="p-5 sm:p-6">
      <SectionHeading
        eyebrow="二级市场"
        title="转让保单风险"
        description="按卖方报价购买有效保单 NFT。成交后，买方将成为理赔与到期退款的受益人。"
        action={<StatusChip label={`市场手续费 ${Number(feeBps ?? 0) / 100}%`} tone="warning" />}
      />

      <div className="mt-6 hidden grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_auto] gap-4 border-b border-white/[0.07] pb-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#59666a] lg:grid">
        <span>保单</span>
        <span>保额</span>
        <span>到期时间</span>
        <span>报价</span>
        <span>操作</span>
      </div>

      <div className="mt-2">
        {policyIds.length === 0 ? (
          <EmptyState title="暂无挂牌" description="从“我的保障”中挂牌一张有效保单，它就会显示在这里供其他买家选购。" />
        ) : (
          policyIds.map(policyId => <MarketRow key={policyId.toString()} policyId={policyId} />)
        )}
      </div>
    </ConsolePanel>
  );
};

const MarketRow = ({ policyId }: { policyId: bigint }) => {
  const { address } = useAccount();
  const usdcWrite = useScaffoldWriteContract({ contractName: "MockUSDC" });
  const marketWrite = useScaffoldWriteContract({ contractName: "PolicyMarket" });
  const { data: marketContract } = useScaffoldContract({ contractName: "PolicyMarket" });
  const { data: rawPolicy } = useScaffoldReadContract({
    contractName: "PolicyNFT",
    functionName: "getPolicy",
    args: [policyId],
  });
  const { data: rawListing } = useScaffoldReadContract({
    contractName: "PolicyMarket",
    functionName: "listings",
    args: [policyId],
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [address, marketContract?.address],
    query: { enabled: Boolean(address && marketContract) },
  });
  const { data: balance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address],
    query: { enabled: Boolean(address) },
  });

  const listing = rawListing
    ? Array.isArray(rawListing)
      ? { seller: rawListing[0] as Address, price: rawListing[1] as bigint, active: rawListing[2] as boolean }
      : (rawListing as unknown as { seller: Address; price: bigint; active: boolean })
    : undefined;

  if (!listing?.active || !rawPolicy) return null;

  const price = listing.price;
  const needsApproval = (allowance ?? 0n) < price;
  const isSeller = address?.toLowerCase() === listing.seller.toLowerCase();

  const handleApprove = async () => {
    if (!marketContract) return;
    try {
      await usdcWrite.writeContractAsync({ functionName: "approve", args: [marketContract.address, price] });
      notification.success("市场交易授权已完成");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const handleBuy = async () => {
    try {
      await marketWrite.writeContractAsync({ functionName: "buy", args: [policyId, price] });
      notification.success("保单 NFT 已转入你的钱包");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  return (
    <div className="grid gap-4 border-b border-white/[0.06] py-4 last:border-0 lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#f4c66a]/15 bg-[#f4c66a]/[0.06] text-[#f4c66a]">
          <PaperAirplaneIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate font-mono text-xs font-semibold tracking-[0.05em] text-[#e5ecea]">
            {rawPolicy.flightNumber}
          </p>
          <p className="mb-0 mt-1 text-[10px] text-[#627074]">
            #{policyId.toString()} · 卖方 {shortAddress(listing.seller)}
          </p>
        </div>
      </div>
      <div>
        <span className="mb-1 block text-[9px] tracking-[0.08em] text-[#59666a] lg:hidden">保额</span>
        <span className="font-mono text-xs text-[#d6dfdd]">{formatUsdc(rawPolicy.coverageAmount)} USDC</span>
      </div>
      <div>
        <span className="mb-1 block text-[9px] tracking-[0.08em] text-[#59666a] lg:hidden">到期时间</span>
        <span className="font-mono text-[11px] text-[#a7b2b1]">{formatDateTime(rawPolicy.coverageEnd)}</span>
      </div>
      <div>
        <span className="mb-1 block text-[9px] tracking-[0.08em] text-[#59666a] lg:hidden">报价</span>
        <span className="font-mono text-xs font-semibold text-[#87f5d6]">{formatUsdc(price)} USDC</span>
      </div>
      <div className="flex justify-start lg:justify-end">
        {isSeller ? (
          <StatusChip label="我的挂牌" />
        ) : (
          <ConsoleButton
            variant={needsApproval ? "secondary" : "primary"}
            onClick={needsApproval ? handleApprove : handleBuy}
            busy={usdcWrite.isMining || marketWrite.isMining}
            disabled={!address || (!needsApproval && price > (balance ?? 0n))}
            icon={<ArrowsRightLeftIcon className="h-4 w-4" />}
          >
            {needsApproval ? "授权" : "购买"}
          </ConsoleButton>
        )}
      </div>
    </div>
  );
};
