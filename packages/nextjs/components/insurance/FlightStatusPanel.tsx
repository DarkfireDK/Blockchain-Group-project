"use client";

import { useState } from "react";
import {
  ConsoleButton,
  ConsolePanel,
  InlineNotice,
  SectionHeading,
  StatusChip,
  formatDateTime,
  formatUsdc,
  inputClassName,
  labelClassName,
} from "./shared";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useInsuranceChainClock } from "~~/hooks/scaffold-eth/useInsuranceChainClock";
import { notification } from "~~/utils/scaffold-eth";
import { flightReportError } from "~~/utils/scaffold-eth/flightManagement";
import { policyLifecycle } from "~~/utils/scaffold-eth/policyLifecycle";

export const FlightStatusPanel = () => {
  const { address } = useAccount();
  const cache = useQueryClient();
  const clock = useInsuranceChainClock();
  const [idInput, setIdInput] = useState("");
  const [selectedId, setSelectedId] = useState<bigint>();
  const [scenario, setScenario] = useState("delay");
  const [delay, setDelay] = useState("60");
  const [lookupError, setLookupError] = useState("");
  const [receipt, setReceipt] = useState<{ id: bigint; hash: string; message: string }>();
  const policyRead = useScaffoldReadContract({
    contractName: "PolicyNFT",
    functionName: "getPolicy",
    args: [selectedId],
    query: { enabled: selectedId !== undefined, refetchInterval: 2000 },
  });
  const policy = policyRead.data;
  const { data: snapshotOracle } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "policyOracle",
    args: [selectedId],
  });
  const { data: threshold } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "policyMinDelay",
    args: [selectedId],
  });
  const { data: oracle } = useScaffoldContract({ contractName: "Oracle" });
  const { data: reporterRole } = useScaffoldReadContract({ contractName: "Oracle", functionName: "REPORTER_ROLE" });
  const { data: isReporter } = useScaffoldReadContract({
    contractName: "Oracle",
    functionName: "hasRole",
    args: [reporterRole, address],
  });
  const { data: beneficiary } = useScaffoldReadContract({
    contractName: "PolicyNFT",
    functionName: "ownerOf",
    args: [selectedId],
    query: { enabled: selectedId !== undefined && policy?.status === 1, refetchInterval: 2000 },
  });
  const oracleWrite = useScaffoldWriteContract({ contractName: "Oracle" });
  const insuranceWrite = useScaffoldWriteContract({ contractName: "Insurance" });
  const busy = oracleWrite.isMining || insuranceWrite.isMining;
  const validPolicy = policy && policy.status !== 0 && !policyRead.isError ? policy : undefined;
  const lifecycle = validPolicy
    ? policyLifecycle(validPolicy, clock.error ? undefined : clock.data?.timestamp)
    : undefined;
  const reportError = validPolicy
    ? flightReportError({
        ...validPolicy,
        chainTime: clock.error ? undefined : clock.data?.timestamp,
        delay,
        threshold,
        reporter: Boolean(isReporter),
        oracleMatches: Boolean(oracle && snapshotOracle?.toLowerCase() === oracle.address.toLowerCase()),
      })
    : "请先查询有效保单。";

  const refresh = async () => {
    await clock.refetch();
    await cache.invalidateQueries({ queryKey: ["readContract"] });
  };
  const lookup = () => {
    if (!/^\d+$/.test(idInput) || BigInt(idInput) < 1n || BigInt(idInput) >= 2n ** 256n) {
      setLookupError("请输入有效的正整数保单 ID。");
      return;
    }
    setLookupError("");
    setSelectedId(BigInt(idInput));
    void refresh();
  };
  const submit = async (refund: boolean) => {
    if (selectedId === undefined || !validPolicy || busy) return;
    if (refund ? !lifecycle?.canRefund || !address : Boolean(reportError)) return;
    try {
      const hash = refund
        ? await insuranceWrite.writeContractAsync({ functionName: "expirePolicy", args: [selectedId] })
        : await oracleWrite.writeContractAsync({ functionName: "reportDelay", args: [selectedId, Number(delay)] });
      if (!hash) return;
      const message = refund ? "到期退款已结算，资金发给保单持有人。" : "延误报告已确认，合约已向保单持有人支付赔款。";
      setReceipt({ id: selectedId, hash, message });
      notification.success(message);
      await refresh();
      await cache.invalidateQueries();
    } catch {
      // The wallet transaction hook displays contract and wallet errors.
    }
  };

  return (
    <ConsolePanel className="p-5 sm:p-6">
      <SectionHeading
        eyebrow="航班状态管理"
        title="查询航班与结算保单"
        description="按保单 ID 管理。时间阶段根据计划起飞时间推算；真实延误结果需授权上报员提交，当前未连接真实航班数据源。"
        action={
          <StatusChip
            label={isReporter ? "授权上报员" : "仅查看 / 到期退款"}
            tone={isReporter ? "success" : "neutral"}
          />
        }
      />
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block min-w-40 flex-1">
          <span className={labelClassName}>保单 ID</span>
          <input
            className={inputClassName}
            placeholder="例如 4"
            inputMode="numeric"
            value={idInput}
            onChange={e => setIdInput(e.target.value.replace(/\D/g, ""))}
            disabled={busy}
            onKeyDown={e => {
              if (e.key === "Enter") lookup();
            }}
          />
        </label>
        <ConsoleButton onClick={lookup} disabled={!idInput || busy}>
          查询保单
        </ConsoleButton>
        <ConsoleButton onClick={() => void refresh()} disabled={busy}>
          刷新状态
        </ConsoleButton>
      </div>
      <p className="text-xs text-[#8a979a]">当前链上时间：{formatDateTime(clock.data?.timestamp)} · 每2秒刷新</p>
      {clock.error && <InlineNotice>链上时间读取失败，操作已暂停。请检查本地链并刷新。</InlineNotice>}
      {lookupError && <InlineNotice>{lookupError}</InlineNotice>}
      {selectedId !== undefined && policyRead.isPending && <p>正在读取保单…</p>}
      {selectedId !== undefined && !policyRead.isPending && !validPolicy && (
        <InlineNotice>未找到该保单或读取失败，请检查 ID 和网络后重试。</InlineNotice>
      )}
      {validPolicy && lifecycle && (
        <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="font-mono text-[#edf3f1]">
              {validPolicy.flightNumber} · #{selectedId?.toString()}
            </strong>
            <StatusChip
              label={lifecycle.label === "已起飞" ? "已到计划起飞时间" : lifecycle.label}
              tone={lifecycle.tone}
            />
            <StatusChip
              label={
                validPolicy.status === 2
                  ? "延误报告已确认"
                  : validPolicy.status === 3
                    ? "已完成到期退款"
                    : "尚无已确认的延误报告"
              }
            />
          </div>
          <dl className="grid gap-3 text-xs text-[#a9b6b7] sm:grid-cols-2">
            <div>计划起飞：{formatDateTime(validPolicy.departureDate)}</div>
            <div>保障结束：{formatDateTime(validPolicy.coverageEnd)}</div>
            <div>报告截止：{formatDateTime(validPolicy.coverageEnd + 86400n)}（含此时刻）</div>
            <div>本保单赔付门槛：{threshold ?? "-"} 分钟</div>
            <div>符合门槛赔付：{formatUsdc(validPolicy.coverageAmount)} 测试 USDC</div>
            <div>无赔付到期可退：{formatUsdc(validPolicy.refundableAmount)} 测试 USDC</div>
            {beneficiary && validPolicy.status === 1 && (
              <div className="break-all sm:col-span-2">当前受益人：{beneficiary}</div>
            )}
          </dl>
          <InlineNotice>{lifecycle.description}</InlineNotice>
          {validPolicy.status === 1 && (
            <>
              <label className="block">
                <span className={labelClassName}>测试场景（选择本身不会写入链上）</span>
                <select
                  className={inputClassName}
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  disabled={busy}
                >
                  <option value="delay">延误达到赔付门槛：提交 Oracle 报告</option>
                  <option value="normal">正常 / 未达门槛：等待到期退款</option>
                </select>
              </label>
              {scenario === "delay" ? (
                <>
                  <label className="block">
                    <span className={labelClassName}>实际延误（整数分钟）</span>
                    <input
                      className={inputClassName}
                      value={delay}
                      inputMode="numeric"
                      disabled={busy}
                      onChange={e => setDelay(e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <InlineNotice>
                    {reportError ?? "提交后立即按保额全额理赔并销毁保单 NFT。请先核实保单 ID 与受益人。"}
                  </InlineNotice>
                  <ConsoleButton
                    variant="primary"
                    onClick={() => void submit(false)}
                    disabled={Boolean(reportError) || policyRead.isFetching}
                    busy={oracleWrite.isMining}
                  >
                    提交延误并结算赔款
                  </ConsoleButton>
                </>
              ) : (
                <InlineNotice>
                  当前合约不记录“正常起飞”报告；选择此场景不会改变保单或提前释放资金。若没有符合门槛的延误报告，报告宽限期结束后可结算退款。
                </InlineNotice>
              )}
              <div className="border-t border-white/10 pt-4">
                <ConsoleButton
                  onClick={() => void submit(true)}
                  disabled={!address || !lifecycle.canRefund || Boolean(clock.error) || policyRead.isFetching}
                  busy={insuranceWrite.isMining}
                >
                  结算到期退款
                </ConsoleButton>
                <p className="text-xs text-[#8a979a]">
                  任何钱包均可触发，退款始终发给当前保单持有人；须严格晚于报告截止时间。
                </p>
              </div>
            </>
          )}
          {receipt && receipt.id === selectedId && (
            <div className="break-all text-xs text-[#87f5d6]" role="status">
              {receipt.message}
              <br />
              交易：{receipt.hash}
            </div>
          )}
        </div>
      )}
    </ConsolePanel>
  );
};
