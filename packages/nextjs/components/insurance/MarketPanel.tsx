"use client";
import { useInsuranceChainClock } from "~~/hooks/scaffold-eth/useInsuranceChainClock";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { isMarketPolicyTradable } from "~~/utils/scaffold-eth/marketEligibility";
import { ArrowsRightLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import {
  useScaffoldContract,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const MarketPanel = () => {
  const { targetNetwork } = useTargetNetwork();
  const {data:block,error:blockError} = useInsuranceChainClock();
  const [visibility,setVisibility]=useState<Record<string,"visible"|"hidden"|"loading"|"error">>({});
  const onVisibilityChange=useCallback((id:string,value:"visible"|"hidden"|"loading"|"error")=>{
    setVisibility(previous=>previous[id]===value?previous:{...previous,[id]:value});
  },[]);
  const { data: listedEvents, isLoading:eventsLoading, error:eventsError } = useScaffoldEventHistory({
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
      .sort((a, b) => (a > b ? -1 : 1));
  }, [listedEvents]);
  const visibleCount=policyIds.filter(id=>visibility[id.toString()]==="visible").length;
  const loading=eventsLoading || policyIds.some(id=>!visibility[id.toString()] || visibility[id.toString()]==="loading");
  const readError=eventsError || blockError || policyIds.some(id=>visibility[id.toString()]==="error");

  return (
    <ConsolePanel className="p-5 sm:p-6">
      <SectionHeading
        eyebrow="二级市场"
        title="转让保单受益权"
        description="仅显示起飞前、尚未结算且归卖方持有的有效挂单。成交后，买方成为理赔与到期退款的受益人。"
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
        {policyIds.map(policyId => <MarketRow key={`${targetNetwork.id}-${policyId}`} policyId={policyId} chainTime={block?.timestamp} chainError={Boolean(blockError)} onVisibilityChange={onVisibilityChange} />)}
        {readError && <p role="alert" className="py-3 text-xs text-[#f4c66a]">部分市场数据读取失败，请确认网络连接并刷新。</p>}
        {visibleCount===0 && (loading ? <p role="status" className="py-5 text-sm text-[#839095]">正在核对可购买的保单…</p> : !readError ? <EmptyState title="暂无可购买的保单" description="已结算、已起飞、已撤单或已转移的旧挂单不会显示。已结束保单请到“航班保障 → 我的保单 → 已结束”查看。" /> : null)}
      </div>
    </ConsolePanel>
  );
};

const MarketRow = ({ policyId, chainTime, chainError, onVisibilityChange }: { policyId: bigint; chainTime?: bigint; chainError:boolean; onVisibilityChange:(id:string,value:"visible"|"hidden"|"loading"|"error")=>void }) => {
  const { address } = useAccount();
  const usdcWrite = useScaffoldWriteContract({ contractName: "MockUSDC" });
  const marketWrite = useScaffoldWriteContract({ contractName: "PolicyMarket" });
  const { data: marketContract } = useScaffoldContract({ contractName: "PolicyMarket" });
  const { data: rawPolicy, error:policyError } = useScaffoldReadContract({
    contractName: "PolicyNFT",
    functionName: "getPolicy",
    args: [policyId],
  });
  const { data: rawListing, error:listingError } = useScaffoldReadContract({
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
  const needsOwner = Boolean(listing?.active && rawPolicy?.status === 1 && chainTime !== undefined && chainTime < rawPolicy.departureDate);
  const {data:owner,error:ownerError} = useScaffoldReadContract({contractName:"PolicyNFT",functionName:"ownerOf",args:[policyId],query:{enabled:needsOwner}});
  const tradable = Boolean(listing && rawPolicy && chainTime !== undefined && isMarketPolicyTradable({active:listing.active,status:rawPolicy.status,departure:rawPolicy.departureDate,chainTime,seller:listing.seller,owner}));
  const state = chainError || policyError || listingError || (needsOwner && ownerError) ? "error" :
    !listing || !rawPolicy || chainTime === undefined || (needsOwner && !owner) ? "loading" : tradable ? "visible" : "hidden";
  useEffect(()=>onVisibilityChange(policyId.toString(),state),[policyId,state,onVisibilityChange]);
  if (!listing || !rawPolicy || !tradable) return null;

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
      const hash = await marketWrite.writeContractAsync({ functionName: "buy", args: [policyId, price] });
      if(hash) notification.success("保单 NFT 已转入你的钱包");
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
