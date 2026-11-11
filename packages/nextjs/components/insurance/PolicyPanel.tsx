"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ConsoleButton,
  ConsolePanel,
  EmptyState,
  InlineNotice,
  type PolicyData,
  SectionHeading,
  StatusChip,
  formatDateTime,
  formatUsdc,
  inputClassName,
  labelClassName,
  policyStatusLabel,
  toDateTimeLocal,
  toUnixTimestamp,
} from "./shared";
import type { Address } from "viem";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import {
  CalendarDaysIcon,
  ClockIcon,
  PaperAirplaneIcon,
  PlusIcon,
  ShieldCheckIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { useScaffoldContract, useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const parseUsdcInput = (value: string) => {
  try {
    return parseUnits(value || "0", 6);
  } catch {
    return 0n;
  }
};

export const PolicyPanel = ({ policyCount }: { policyCount: number }) => {
  const { address } = useAccount();
  const [flightNumber, setFlightNumber] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [coverageEnd, setCoverageEnd] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("500");
  const refundablePercent = 50;

  const insuranceWrite = useScaffoldWriteContract({ contractName: "Insurance" });
  const usdcWrite = useScaffoldWriteContract({ contractName: "MockUSDC" });

  const { data: poolAddress } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "pool",
  });
  const { data: balance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address],
    query: { enabled: Boolean(address) },
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [address, poolAddress],
    query: { enabled: Boolean(address && poolAddress) },
  });
  const { data: availableLiquidity } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "availableLiquidity",
  });

  useEffect(() => {
    const now = new Date();
    setDepartureDate(toDateTimeLocal(new Date(now.getTime() + 24 * 60 * 60 * 1000)));
    setCoverageEnd(toDateTimeLocal(new Date(now.getTime() + 48 * 60 * 60 * 1000)));

  }, []);

  const coverageAmountWei = parseUsdcInput(coverageAmount);
  const premiumWei = (coverageAmountWei + 49n) / 50n;
  const premium = (Number(premiumWei) / 1e6).toString();
  const refundableWei = (premiumWei * BigInt(refundablePercent)) / 100n;
  const riskFeeWei = premiumWei - refundableWei;
  const needsApproval = (allowance ?? 0n) < premiumWei;
  const hasEnoughBalance = (balance ?? 0n) >= premiumWei;
  const hasPoolCapacity = (availableLiquidity ?? 0n) >= coverageAmountWei;
  const isValid =
    flightNumber.trim().length >= 2 &&
    coverageAmountWei >= 10_000_000n && coverageAmountWei <= 5_000_000_000n &&
    premiumWei > 0n &&
    Boolean(toUnixTimestamp(coverageEnd)) &&
    Boolean(toUnixTimestamp(departureDate));

  const handleApprove = async () => {
    if (!poolAddress) return;
    try {
      await usdcWrite.writeContractAsync({
        functionName: "approve",
        args: [poolAddress, premiumWei],
      });
      notification.success("保费授权已完成");
    } catch {
      // The scaffold write hook already surfaces the decoded transaction error.
    }
  };

  const handlePurchase = async () => {
    if (!isValid || !address) return;
    const departure = toUnixTimestamp(departureDate);
    const end = toUnixTimestamp(coverageEnd);
    if (!departure || !end) return;

    const start = departure;
    if (start <= BigInt(Math.floor(Date.now() / 1000))) return notification.error("请选择未来的起飞时间");
    if (end <= start) {
      notification.error("保障结束时间需晚于当前时间至少两分钟");
      return;
    }

    try {
      await insuranceWrite.writeContractAsync({
        functionName: "purchasePolicy",
        args: [flightNumber.trim().toUpperCase(), departure, start, end, coverageAmountWei, premiumWei, refundableWei],
      });
      notification.success("航班保单已铸造为 NFT");
      setFlightNumber("");
    } catch {
      // Error feedback is handled by useScaffoldWriteContract.
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.75fr)]">
      <ConsolePanel className="p-5 sm:p-6">
        <SectionHeading
          eyebrow="新增保障"
          title="创建航班保障"
          description="选择未来航班及保额（10–5,000测试USDC）。保费固定为保额的2%，其中50%可退。保障从起飞时间开始。"
          action={<StatusChip label="USDC" tone="success" />}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClassName}>
              航班号 <span className="tracking-normal text-[#566367]">IATA / ICAO</span>
            </span>
            <div className="relative">
              <PaperAirplaneIcon className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[#667579]" />
              <input
                className={`${inputClassName} pl-10 font-mono uppercase tracking-[0.08em]`}
                placeholder="MU5101"
                value={flightNumber}
                onChange={event => setFlightNumber(event.target.value)}
                maxLength={12}
              />
            </div>
          </label>

          <label className="block">
            <span className={labelClassName}>起飞时间</span>
            <input
              type="datetime-local"
              className={`${inputClassName} font-mono text-xs`}
              value={departureDate}
              onChange={event => setDepartureDate(event.target.value)}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>保障结束</span>
            <input
              type="datetime-local"
              className={`${inputClassName} font-mono text-xs`}
              value={coverageEnd}
              onChange={event => setCoverageEnd(event.target.value)}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>
              保额 <span className="tracking-normal text-[#566367]">USDC</span>
            </span>
            <input
              type="number"
              min="1"
              step="0.01"
              className={`${inputClassName} font-mono`}
              value={coverageAmount}
              onChange={event => setCoverageAmount(event.target.value)}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>
              保费 <span className="tracking-normal text-[#566367]">USDC</span>
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`${inputClassName} font-mono`}
              value={premium}
              readOnly
              aria-label="合约固定报价保费"
            />
          </label>
        </div>

        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-medium text-[#d8e1df]">可退保费</p>
              <p className="mb-0 mt-1 text-[11px] leading-5 text-[#708084]">
                报告宽限期结束且未赔付时，可发起退款交易退还此金额。
              </p>
            </div>
            <span className="font-mono text-xl font-medium text-[#87f5d6]">{refundablePercent}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            className="range range-xs mt-4 w-full [--range-shdw:#87f5d6]"
            value={refundablePercent}
            disabled
            aria-label="固定50%可退保费"
          />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-[#536064]">
            <span>0% 可退</span>
            <span>100% 可退</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-white/[0.07] rounded-lg border border-white/[0.07] bg-[#090d0f] py-4">
          <div className="px-4">
            <p className="m-0 text-[10px] tracking-[0.08em] text-[#667579]">赔付金额</p>
            <p className="mb-0 mt-1 font-mono text-sm text-[#edf3f1]">{formatUsdc(coverageAmountWei)}</p>
          </div>
          <div className="px-4">
            <p className="m-0 text-[10px] tracking-[0.08em] text-[#667579]">可退金额</p>
            <p className="mb-0 mt-1 font-mono text-sm text-[#edf3f1]">{formatUsdc(refundableWei)}</p>
          </div>
          <div className="px-4">
            <p className="m-0 text-[10px] tracking-[0.08em] text-[#667579]">风险费</p>
            <p className="mb-0 mt-1 font-mono text-sm text-[#edf3f1]">{formatUsdc(riskFeeWei)}</p>
          </div>
        </div>

        {!hasPoolCapacity && coverageAmountWei > 0n && (
          <div className="mt-4">
            <InlineNotice tone="warning">
              当前资金池无法承保此保额，可用容量为 {formatUsdc(availableLiquidity)} USDC。
            </InlineNotice>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-[11px] text-[#6f7c80]">
            钱包余额：<span className="font-mono text-[#aeb9b8]">{formatUsdc(balance)} USDC</span>
          </p>
          <button
            type="button"
            className={`btn h-11 min-h-0 rounded-lg border px-5 text-xs font-semibold normal-case shadow-none ${
              needsApproval
                ? "border-white/10 bg-white/[0.04] text-[#dbe4e2] hover:border-white/20 hover:bg-white/[0.07]"
                : "border-[#87f5d6] bg-[#87f5d6] text-[#07110e] hover:border-[#a3ffe7] hover:bg-[#a3ffe7]"
            } disabled:cursor-not-allowed disabled:opacity-40`}
            onClick={needsApproval ? handleApprove : handlePurchase}
            disabled={
              !address || (needsApproval ? premiumWei === 0n : !isValid || !hasEnoughBalance || !hasPoolCapacity)
            }
          >
            {usdcWrite.isMining || insuranceWrite.isMining ? (
              <span className="loading loading-spinner loading-xs" />
            ) : needsApproval ? (
              <ShieldCheckIcon className="h-4 w-4" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
            {needsApproval ? "授权保费" : "铸造保单"}
          </button>
        </div>
      </ConsolePanel>

      <PolicySidebar policyCount={policyCount} />
    </div>
  );
};

const PolicySidebar = ({ policyCount }: { policyCount: number }) => {
  const { data: minDelay } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "minDelayMinutes",
  });
  const { data: lockedCoverage } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalLockedCoverage",
  });
  const { data: totalAssets } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalAssets",
  });

  return (
    <div className="space-y-5">
      <ConsolePanel className="p-5">
        <SectionHeading eyebrow="结算机制" title="保单机制" />
        <div className="mt-5 space-y-4">
          <RuleRow icon={<ClockIcon className="h-4 w-4" />} label="延误触发" value={`${minDelay ?? "-"} 分钟`} />
          <RuleRow icon={<ShieldCheckIcon className="h-4 w-4" />} label="理赔金额" value="100% 保额" />
          <RuleRow icon={<CalendarDaysIcon className="h-4 w-4" />} label="到期退款" value="宽限期后发起交易" />
        </div>
        <div className="mt-5 border-t border-white/[0.07] pt-4 text-xs leading-6 text-[#758387]">
          起飞后至保障结束后24小时，授权Oracle可提交延误报告。宽限期结束后，任何人可触发退款给当前NFT持有人。
        </div>
      </ConsolePanel>

      <ConsolePanel className="p-5">
        <p className="m-0 text-[10px] font-semibold tracking-[0.1em] text-[#6c7a7e]">资金池快照</p>
        <div className="mt-4 space-y-3">
          <SnapshotRow label="已签发保单" value={String(policyCount)} />
          <SnapshotRow label="锁定保额" value={`${formatUsdc(lockedCoverage)} USDC`} />
          <SnapshotRow label="池内净资产" value={`${formatUsdc(totalAssets)} USDC`} />
        </div>
      </ConsolePanel>
    </div>
  );
};

const RuleRow = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="flex items-center gap-2.5 text-xs text-[#8b999c]">
      <span className="text-[#87f5d6]">{icon}</span>
      {label}
    </span>
    <span className="font-mono text-xs text-[#dce5e3]">{value}</span>
  </div>
);

const SnapshotRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
    <span className="text-xs text-[#7d8b8f]">{label}</span>
    <span className="font-mono text-xs text-[#cfd9d7]">{value}</span>
  </div>
);

export const PolicyPortfolio = ({ policyCount }: { policyCount: number }) => {
  const { address } = useAccount();
  const { data: purchaseEvents } = useScaffoldEventHistory({
    contractName: "Insurance",
    eventName: "PolicyPurchased",
    filters: address ? { buyer: address } : undefined,
    enabled: Boolean(address),
    watch: true,
  });
  const { data: marketEvents } = useScaffoldEventHistory({
    contractName: "PolicyMarket",
    eventName: "Purchased",
    filters: address ? { buyer: address } : undefined,
    enabled: Boolean(address),
    watch: true,
  });

  const policyIds = useMemo(() => {
    const ids = [
      ...(purchaseEvents?.flatMap(event => (event.args.policyId ? [event.args.policyId.toString()] : [])) ?? []),
      ...(marketEvents?.flatMap(event => (event.args.policyId ? [event.args.policyId.toString()] : [])) ?? []),
    ];
    return Array.from(new Set(ids))
      .map(BigInt)
      .sort((a, b) => (a > b ? -1 : 1))
      .slice(0, 24);
  }, [purchaseEvents, marketEvents]);

  return (
    <ConsolePanel className="mt-5 p-5 sm:p-6">
      <SectionHeading
        eyebrow="我的保障"
        title="我的有效保单"
        description="每张保单都是可转让的 NFT。仅起飞前可在市场转售，保障结束后24小时可发起到期结算。"
        action={<StatusChip label={`累计签发 ${policyCount} 张`} />}
      />
      <div className="mt-5">
        {!address ? (
          <EmptyState title="连接钱包" description="连接后，你的保单 NFT 与结算操作将显示在这里。" />
        ) : policyIds.length === 0 ? (
          <EmptyState title="暂无保单" description="在上方创建第一张航班保障，铸造后将显示在这里。" />
        ) : (
          policyIds.map(policyId => <PolicyRow key={policyId.toString()} policyId={policyId} />)
        )}
      </div>
    </ConsolePanel>
  );
};

const PolicyRow = ({ policyId }: { policyId: bigint }) => {
  const { address } = useAccount();
  const [listPrice, setListPrice] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState(0n);
  const insuranceWrite = useScaffoldWriteContract({ contractName: "Insurance" });
  const marketWrite = useScaffoldWriteContract({ contractName: "PolicyMarket" });
  const nftWrite = useScaffoldWriteContract({ contractName: "PolicyNFT" });
  const { data: marketContract } = useScaffoldContract({ contractName: "PolicyMarket" });
  const { data: rawPolicy } = useScaffoldReadContract({
    contractName: "PolicyNFT",
    functionName: "getPolicy",
    args: [policyId],
  });
  const { data: owner } = useScaffoldReadContract({
    contractName: "PolicyNFT",
    functionName: "ownerOf",
    args: [policyId],
    query: { enabled: rawPolicy?.status === 1 },
  });
  const { data: rawListing } = useScaffoldReadContract({
    contractName: "PolicyMarket",
    functionName: "listings",
    args: [policyId],
  });

  const policy = rawPolicy as unknown as PolicyData | undefined;
  const listing = rawListing
    ? Array.isArray(rawListing)
      ? { seller: rawListing[0] as Address, price: rawListing[1] as bigint, active: rawListing[2] as boolean }
      : (rawListing as unknown as { seller: Address; price: bigint; active: boolean })
    : undefined;

  useEffect(() => {
    const updateTimestamp = () => setCurrentTimestamp(BigInt(Math.floor(Date.now() / 1000)));
    updateTimestamp();
    const interval = window.setInterval(updateTimestamp, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!policy || policy.status !== 1 || !address || owner?.toLowerCase() !== address.toLowerCase()) return null;

  const canExpire = currentTimestamp > 0n && currentTimestamp > policy.coverageEnd + 86400n;
  const handleExpire = async () => {
    try {
      await insuranceWrite.writeContractAsync({ functionName: "expirePolicy", args: [policyId] });
      notification.success("到期保单已结算");
    } catch {
      // Transaction errors are already surfaced by the scaffold hook.
    }
  };

  const handleList = async () => {
    const price = parseUsdcInput(listPrice);
    if (price === 0n) {
      notification.error("挂牌价格必须大于零");
      return;
    }
    try {
      if (!marketContract) return;
      await nftWrite.writeContractAsync({ functionName: "approve", args: [marketContract.address, policyId] });
      await marketWrite.writeContractAsync({ functionName: "list", args: [policyId, price] });
      notification.success("保单已在二级市场挂牌");
      setListPrice("");
    } catch {
      // Transaction errors are already surfaced by the scaffold hook.
    }
  };

  const handleCancel = async () => {
    try {
      await marketWrite.writeContractAsync({ functionName: "cancelListing", args: [policyId] });
      notification.success("挂牌已取消");
    } catch {
      // Transaction errors are already surfaced by the scaffold hook.
    }
  };

  return (
    <div className="border-t border-white/[0.07] py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#87f5d6]/15 bg-[#87f5d6]/[0.06] text-[#87f5d6]">
            <PaperAirplaneIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 truncate font-mono text-sm font-semibold tracking-[0.05em] text-[#edf3f1]">
                {policy.flightNumber}
              </p>
              <StatusChip label={policyStatusLabel(policy.status)} tone="success" />
              <span className="font-mono text-[10px] text-[#5f6c70]">#{policyId.toString()}</span>
            </div>
            <p className="mb-0 mt-1 text-[11px] text-[#6f7c80]">结束于 {formatDateTime(policy.coverageEnd)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5 lg:min-w-[300px]">
          <div>
            <p className="m-0 text-[9px] tracking-[0.08em] text-[#59676b]">保额</p>
            <p className="mb-0 mt-1 font-mono text-xs text-[#d6dfdd]">{formatUsdc(policy.coverageAmount)}</p>
          </div>
          <div>
            <p className="m-0 text-[9px] tracking-[0.08em] text-[#59676b]">保费</p>
            <p className="mb-0 mt-1 font-mono text-xs text-[#d6dfdd]">{formatUsdc(policy.premium)}</p>
          </div>
          <div>
            <p className="m-0 text-[9px] tracking-[0.08em] text-[#59676b]">可退金额</p>
            <p className="mb-0 mt-1 font-mono text-xs text-[#d6dfdd]">{formatUsdc(policy.refundableAmount)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {listing?.active ? (
            <>
              <StatusChip label={`已挂牌 ${formatUsdc(listing.price)} USDC`} tone="warning" />
              <ConsoleButton variant="ghost" onClick={handleCancel} busy={marketWrite.isMining}>
                取消
              </ConsoleButton>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <TagIcon className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-[#617075]" />
                <input
                  className="input input-bordered h-9 w-28 rounded-lg border-white/10 bg-[#090d0f] pl-8 text-xs text-white"
                  placeholder="价格"
                  inputMode="decimal"
                  value={listPrice}
                  onChange={event => setListPrice(event.target.value)}
                />
              </div>
              <ConsoleButton onClick={handleList} busy={marketWrite.isMining} disabled={!listPrice || currentTimestamp >= policy.departureDate}>
                授权并挂牌
              </ConsoleButton>
            </div>
          )}
          {canExpire && (
            <ConsoleButton variant="secondary" onClick={handleExpire} busy={insuranceWrite.isMining}>
              结算到期
            </ConsoleButton>
          )}
        </div>
      </div>
    </div>
  );
};
