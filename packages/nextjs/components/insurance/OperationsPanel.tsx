"use client";

import { useState } from "react";
import {
  ConsoleButton,
  ConsolePanel,
  InlineNotice,
  SectionHeading,
  StatusChip,
  inputClassName,
  labelClassName,
  shortAddress,
} from "./shared";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import {
  AdjustmentsHorizontalIcon,
  BoltIcon,
  CheckBadgeIcon,
  ClockIcon,
  CommandLineIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const OperationsPanel = () => {
  const { address } = useAccount();
  const [policyId, setPolicyId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("");
  const [expiryPolicyId, setExpiryPolicyId] = useState("");
  const [oracleAddress, setOracleAddress] = useState("");
  const [newMinDelay, setNewMinDelay] = useState("");

  const oracleWrite = useScaffoldWriteContract({ contractName: "Oracle" });
  const insuranceWrite = useScaffoldWriteContract({ contractName: "Insurance" });

  const { data: adminRole } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "DEFAULT_ADMIN_ROLE",
  });
  const { data: isAdmin } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "hasRole",
    args: [adminRole, address],
    query: { enabled: Boolean(address && adminRole) },
  });
  const { data: reporterRole } = useScaffoldReadContract({
    contractName: "Oracle",
    functionName: "REPORTER_ROLE",
  });
  const { data: isReporter } = useScaffoldReadContract({
    contractName: "Oracle",
    functionName: "hasRole",
    args: [reporterRole, address],
    query: { enabled: Boolean(address && reporterRole) },
  });
  const { data: minDelay } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "minDelayMinutes",
  });
  const { data: currentOracle } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "oracle",
  });

  const handleReport = async () => {
    if (!policyId || !delayMinutes) return;
    try {
      await oracleWrite.writeContractAsync({
        functionName: "reportDelay",
        args: [BigInt(policyId), Number(delayMinutes)],
      });
      notification.success("延误报告已提交，理赔已完成");
      setPolicyId("");
      setDelayMinutes("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const handleExpire = async () => {
    if (!expiryPolicyId) return;
    try {
      await insuranceWrite.writeContractAsync({ functionName: "expirePolicy", args: [BigInt(expiryPolicyId)] });
      notification.success("到期保单退款已结算");
      setExpiryPolicyId("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const handleSetOracle = async () => {
    if (!isAddress(oracleAddress)) {
      notification.error("请输入有效的预言机地址");
      return;
    }
    try {
      await insuranceWrite.writeContractAsync({ functionName: "setOracle", args: [oracleAddress] });
      notification.success("预言机地址已更新");
      setOracleAddress("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const handleSetMinDelay = async () => {
    if (!newMinDelay) return;
    try {
      await insuranceWrite.writeContractAsync({
        functionName: "setMinDelayMinutes",
        args: [Number(newMinDelay)],
      });
      notification.success("延误门槛已更新");
      setNewMinDelay("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="space-y-5">
        <ConsolePanel className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="预言机上报"
            title="上报航班延误"
            description="经验证的延误报告会立即结算保单、向受益人付款并销毁 NFT。"
            action={<StatusChip label={isReporter ? "上报员" : "仅查看"} tone={isReporter ? "success" : "neutral"} />}
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_0.7fr_auto] sm:items-end">
            <label className="block">
              <span className={labelClassName}>保单 ID</span>
              <input
                className={`${inputClassName} font-mono`}
                placeholder="1"
                inputMode="numeric"
                value={policyId}
                onChange={event => setPolicyId(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>延误时长（分钟）</span>
              <input
                className={`${inputClassName} font-mono`}
                placeholder={`${minDelay ?? 60}`}
                inputMode="numeric"
                value={delayMinutes}
                onChange={event => setDelayMinutes(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <ConsoleButton
              className="h-11"
              variant="primary"
              onClick={handleReport}
              busy={oracleWrite.isMining}
              disabled={!isReporter || !policyId || !delayMinutes}
              icon={<BoltIcon className="h-4 w-4" />}
            >
              结算理赔
            </ConsoleButton>
          </div>
          {!isReporter && (
            <div className="mt-4">
              <InlineNotice>
                仅拥有 `REPORTER_ROLE` 的钱包可以提交延误报告。本地测试理赔时，请连接部署者账户。
              </InlineNotice>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-[11px]">
            <span className="flex items-center gap-2 text-[#718084]">
              <ClockIcon className="h-3.5 w-3.5" /> 触发门槛
            </span>
            <span className="font-mono text-[#d7e0de]">{minDelay?.toString() ?? "-"} 分钟及以上</span>
          </div>
        </ConsolePanel>

        <ConsolePanel className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="公共执行"
            title="结算到期保单"
            description="保障期结束后，任何人都可以触发到期结算。退款将始终发送给当前的 NFT 持有人。"
            action={<StatusChip label="无需许可" tone="success" />}
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className={labelClassName}>保单 ID</span>
              <input
                className={`${inputClassName} font-mono`}
                placeholder="1"
                inputMode="numeric"
                value={expiryPolicyId}
                onChange={event => setExpiryPolicyId(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <ConsoleButton
              className="h-11"
              variant="secondary"
              onClick={handleExpire}
              busy={insuranceWrite.isMining}
              disabled={!address || !expiryPolicyId}
              icon={<CheckBadgeIcon className="h-4 w-4" />}
            >
              释放退款
            </ConsoleButton>
          </div>
        </ConsolePanel>
      </div>

      <div className="space-y-5">
        <ConsolePanel className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="协议管理"
            title="风险参数"
            description="仅管理员可调整预言机上报权限与理赔门槛。"
            action={<StatusChip label={isAdmin ? "管理员" : "已锁定"} tone={isAdmin ? "success" : "neutral"} />}
          />
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className={labelClassName}>延误门槛</span>
              <div className="flex gap-2">
                <input
                  className={`${inputClassName} font-mono`}
                  placeholder={minDelay?.toString() ?? "60"}
                  inputMode="numeric"
                  value={newMinDelay}
                  onChange={event => setNewMinDelay(event.target.value.replace(/\D/g, ""))}
                  disabled={!isAdmin}
                />
                <ConsoleButton
                  variant="secondary"
                  onClick={handleSetMinDelay}
                  busy={insuranceWrite.isMining}
                  disabled={!isAdmin || !newMinDelay}
                  icon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
                >
                  保存
                </ConsoleButton>
              </div>
            </label>
            <label className="block">
              <span className={labelClassName}>预言机地址</span>
              <input
                className={`${inputClassName} font-mono text-xs`}
                placeholder={currentOracle ?? "0x..."}
                value={oracleAddress}
                onChange={event => setOracleAddress(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            <ConsoleButton
              className="w-full"
              variant="secondary"
              onClick={handleSetOracle}
              busy={insuranceWrite.isMining}
              disabled={!isAdmin || !oracleAddress}
              icon={
                isAdmin ? <AdjustmentsHorizontalIcon className="h-4 w-4" /> : <LockClosedIcon className="h-4 w-4" />
              }
            >
              更新预言机
            </ConsoleButton>
          </div>
          {!isAdmin && (
            <div className="mt-4">
              <InlineNotice>请连接拥有 `DEFAULT_ADMIN_ROLE` 的钱包来修改协议参数。</InlineNotice>
            </div>
          )}
        </ConsolePanel>

        <ConsolePanel className="p-5 sm:p-6">
          <SectionHeading eyebrow="网络" title="已部署合约" />
          <div className="mt-4">
            <ContractReference contractName="Insurance" />
            <ContractReference contractName="InsurancePool" />
            <ContractReference contractName="PolicyNFT" />
            <ContractReference contractName="PolicyMarket" />
            <ContractReference contractName="Oracle" />
            <ContractReference contractName="MockUSDC" />
          </div>
        </ConsolePanel>
      </div>
    </div>
  );
};

const ContractReference = ({
  contractName,
}: {
  contractName: "Insurance" | "InsurancePool" | "PolicyNFT" | "PolicyMarket" | "Oracle" | "MockUSDC";
}) => {
  const { data: contract } = useScaffoldContract({ contractName });

  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-3 last:border-0">
      <span className="flex items-center gap-2 text-[11px] text-[#8a979a]">
        <CommandLineIcon className="h-3.5 w-3.5 text-[#647276]" /> {contractName}
      </span>
      <span className="font-mono text-[10px] text-[#b7c1bf]" title={contract?.address}>
        {shortAddress(contract?.address)}
      </span>
    </div>
  );
};
