"use client";

import { useState } from "react";
import {
  ConsoleButton,
  ConsolePanel,
  InlineNotice,
  SectionHeading,
  StatusChip,
  formatUsdc,
  inputClassName,
  labelClassName,
  percentage,
} from "./shared";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { ArrowDownTrayIcon, ArrowUpTrayIcon, BanknotesIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const parseUsdcInput = (value: string) => {
  try {
    return parseUnits(value || "0", 6);
  } catch {
    return 0n;
  }
};

export const LiquidityPanel = () => {
  const { address } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [sharesToWithdraw, setSharesToWithdraw] = useState("");
  const poolWrite = useScaffoldWriteContract({ contractName: "InsurancePool" });
  const usdcWrite = useScaffoldWriteContract({ contractName: "MockUSDC" });
  const { data: poolContract } = useScaffoldContract({ contractName: "InsurancePool" });

  const { data: balance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address],
    query: { enabled: Boolean(address) },
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [address, poolContract?.address],
    query: { enabled: Boolean(address && poolContract) },
  });
  const { data: userShares } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "liquidity",
    args: [address],
    query: { enabled: Boolean(address) },
  });
  const { data: totalLiquidity } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalLiquidity",
  });
  const { data: totalAssets } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalAssets",
  });
  const { data: availableLiquidity } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "availableLiquidity",
  });
  const { data: lockedCoverage } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalLockedCoverage",
  });
  const { data: refundReserve } = useScaffoldReadContract({
    contractName: "InsurancePool",
    functionName: "totalRefundReserve",
  });

  const depositWei = parseUsdcInput(depositAmount);
  const withdrawShares = parseUsdcInput(sharesToWithdraw);
  const needsApproval = (allowance ?? 0n) < depositWei;
  const withdrawValue =
    totalLiquidity && totalLiquidity > 0n ? (withdrawShares * ((totalAssets ?? 0n) + 1n)) / (totalLiquidity + 1n) : 0n;
  const reserveTotal = (lockedCoverage ?? 0n) + (refundReserve ?? 0n) + (availableLiquidity ?? 0n);

  const handleApprove = async () => {
    if (!poolContract) return;
    try {
      await usdcWrite.writeContractAsync({
        functionName: "approve",
        args: [poolContract.address, depositWei],
      });
      notification.success("USDC 存款授权已完成");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const handleDeposit = async () => {
    if (!address || depositWei === 0n) return;
    try {
      await poolWrite.writeContractAsync({ functionName: "deposit", args: [depositWei, address] });
      notification.success("流动性已存入");
      setDepositAmount("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const handleWithdraw = async () => {
    if (!address || withdrawShares === 0n) return;
    try {
      await poolWrite.writeContractAsync({ functionName: "withdraw", args: [withdrawShares, address] });
      notification.success("流动性已赎回");
      setSharesToWithdraw("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const setSharePercent = (value: number) => {
    if (!userShares) return;
    setSharesToWithdraw(formatUsdc((userShares * BigInt(value)) / 100n, 6).replaceAll(",", ""));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <ConsolePanel className="p-5 sm:p-6">
        <SectionHeading
          eyebrow="承保流动性"
          title="提供理赔容量"
          description="存入 USDC 并赚取风险费。保单到期或结算前，对应资金将保持预留状态。"
          action={<StatusChip label="ERC-20" tone="success" />}
        />

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.07] bg-[#090d0f] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-[#8b989b]">
                <BanknotesIcon className="h-4 w-4 text-[#87f5d6]" /> 我的 LP 份额
              </span>
              <span className="font-mono text-sm text-[#edf3f1]">{formatUsdc(userShares, 4)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px]">
              <span className="text-[#657276]">估算价值</span>
              <span className="font-mono text-[#b8c2c0]">{formatUsdc((BigInt(userShares ?? 0n) * (BigInt(totalAssets ?? 0n) + 1n)) / (BigInt(totalLiquidity ?? 0n) + 1n))} USDC</span>
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-[#090d0f] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-[#8b989b]">
                <CircleStackIcon className="h-4 w-4 text-[#f4c66a]" /> 可用容量
              </span>
              <span className="font-mono text-sm text-[#edf3f1]">{formatUsdc(availableLiquidity)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px]">
              <span className="text-[#657276]">锁定保额</span>
              <span className="font-mono text-[#b8c2c0]">{formatUsdc(lockedCoverage)} USDC</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/[0.07] pt-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="m-0 text-sm font-medium text-[#e3ebe8]">准备金构成</p>
              <p className="mb-0 mt-1 text-[11px] text-[#6f7d80]">有效保单对应的容量将被单独预留。</p>
            </div>
            <span className="font-mono text-xs text-[#aab5b3]">{formatUsdc(reserveTotal)} USDC</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.045]">
            <span
              className="h-full bg-[#87f5d6]"
              style={{ width: `${percentage(availableLiquidity, reserveTotal)}%` }}
            />
            <span className="h-full bg-[#f4c66a]" style={{ width: `${percentage(refundReserve, reserveTotal)}%` }} />
            <span className="h-full bg-[#f07878]" style={{ width: `${percentage(lockedCoverage, reserveTotal)}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[#6f7c80]">
            <Legend color="bg-[#87f5d6]" label="可用资金" />
            <Legend color="bg-[#f4c66a]" label="退款准备金" />
            <Legend color="bg-[#f07878]" label="锁定保额" />
          </div>
        </div>

        <div className="mt-6 grid gap-5 border-t border-white/[0.07] pt-5 md:grid-cols-2">
          <div>
            <label className={labelClassName} htmlFor="deposit-usdc">
              <span>存入 USDC</span>
              <button
                className="text-[#87f5d6] hover:text-white"
                type="button"
                onClick={() => setDepositAmount(formatUsdc(balance, 6).replaceAll(",", ""))}
              >
                最大
              </button>
            </label>
            <div className="relative">
              <input
                id="deposit-usdc"
                type="number"
                min="0"
                className={`${inputClassName} pr-14 font-mono`}
                placeholder="0.00"
                value={depositAmount}
                onChange={event => setDepositAmount(event.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-3.5 text-[10px] font-semibold text-[#657276]">
                USDC
              </span>
            </div>
            <ConsoleButton
              className="mt-3 w-full"
              variant={needsApproval ? "secondary" : "primary"}
              onClick={needsApproval ? handleApprove : handleDeposit}
              busy={usdcWrite.isMining || poolWrite.isMining}
              disabled={!address || depositWei === 0n || (!needsApproval && depositWei > (balance ?? 0n))}
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
            >
              {needsApproval ? "授权" : "存入"}
            </ConsoleButton>
          </div>

          <div>
            <label className={labelClassName} htmlFor="withdraw-shares">
              <span>赎回份额</span>
              <button className="text-[#87f5d6] hover:text-white" type="button" onClick={() => setSharePercent(100)}>
                最大
              </button>
            </label>
            <div className="relative">
              <input
                id="withdraw-shares"
                type="number"
                min="0"
                className={`${inputClassName} pr-14 font-mono`}
                placeholder="0.00"
                value={sharesToWithdraw}
                onChange={event => setSharesToWithdraw(event.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-3.5 text-[10px] font-semibold text-[#657276]">
                份额
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[25, 50, 75, 100].map(value => (
                <button
                  key={value}
                  type="button"
                  className="rounded-md border border-white/[0.08] px-2 py-1 text-[9px] text-[#728084] hover:border-white/20 hover:text-white"
                  onClick={() => setSharePercent(value)}
                >
                  {value}%
                </button>
              ))}
            </div>
            <ConsoleButton
              className="mt-3 w-full"
              variant="secondary"
              onClick={handleWithdraw}
              busy={poolWrite.isMining}
              disabled={!address || withdrawShares === 0n || withdrawShares > (userShares ?? 0n) || withdrawValue === 0n || withdrawValue > (availableLiquidity ?? 0n)}
              icon={<ArrowUpTrayIcon className="h-4 w-4" />}
            >
              赎回 {withdrawValue > 0n ? `${formatUsdc(withdrawValue)} USDC` : ""}
            </ConsoleButton>
          </div>
        </div>
      </ConsolePanel>

      <ConsolePanel className="p-5 sm:p-6">
        <SectionHeading eyebrow="资金池概览" title="资金摘要" />
        <div className="mt-5 space-y-4">
          <PoolStat label="净资产" value={`${formatUsdc(totalAssets)} USDC`} />
          <PoolStat label="LP 总份额" value={formatUsdc(totalLiquidity, 4)} />
          <PoolStat label="退款准备金" value={`${formatUsdc(refundReserve)} USDC`} />
          <PoolStat label="锁定保额" value={`${formatUsdc(lockedCoverage)} USDC`} />
        </div>
        <div className="mt-6">
          <InlineNotice tone="warning">
            仅可赎回未被预留的资金。为有效保单提供支持的流动性，需待相关保单结算后才能取出。
          </InlineNotice>
        </div>
        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <p className="m-0 text-[10px] font-semibold tracking-[0.1em] text-[#657276]">份额计算</p>
          <p className="mb-0 mt-2 text-xs leading-6 text-[#7d8a8e]">
            存款将按当前净资产铸造资金池份额；赎回时按同一比例销毁份额并取回 USDC。
          </p>
        </div>
      </ConsolePanel>
    </div>
  );
};

const PoolStat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-0">
    <span className="text-xs text-[#78868a]">{label}</span>
    <span className="font-mono text-xs text-[#d0d9d7]">{value}</span>
  </div>
);

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
    {label}
  </span>
);
