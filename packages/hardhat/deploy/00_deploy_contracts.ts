import { artifacts, deployScript } from "../rocketh/deploy.js";
import { keccak256, toBytes } from "viem";

export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;
    console.log("Deployer:", deployer);

    // 1. MockUSDC
    const usdc = await env.deploy("MockUSDC", {
      account: deployer,
      artifact: artifacts.MockUSDC,
      args: [],
    });

    // 2. PolicyNFT
    const policyNFT = await env.deploy("PolicyNFT", {
      account: deployer,
      artifact: artifacts.PolicyNFT,
      args: [deployer],
    });

    // 3. InsurancePool
    const pool = await env.deploy("InsurancePool", {
      account: deployer,
      artifact: artifacts.InsurancePool,
      args: [usdc.address, deployer],
    });

    // 4. Insurance
    const insurance = await env.deploy("Insurance", {
      account: deployer,
      artifact: artifacts.Insurance,
      args: [pool.address, policyNFT.address, usdc.address, deployer, 60],
    });

    // 5. Oracle
    const oracle = await env.deploy("Oracle", {
      account: deployer,
      artifact: artifacts.Oracle,
      args: [insurance.address, deployer],
    });

    // 6. PolicyMarket  ← 新增
    const market = await env.deploy("PolicyMarket", {
      account: deployer,
      artifact: artifacts.PolicyMarket,
      args: [
        usdc.address,
        policyNFT.address,
        deployer, // admin
        deployer, // feeRecipient
        200, // feeBps = 2%
      ],
    });

    // 7. 授予 INSURER_ROLE
    const INSURER_ROLE = keccak256(toBytes("INSURER_ROLE"));
    await env.execute(policyNFT, {
      functionName: "grantRole",
      args: [INSURER_ROLE, insurance.address],
      account: deployer,
    });
    await env.execute(pool, {
      functionName: "grantRole",
      args: [INSURER_ROLE, insurance.address],
      account: deployer,
    });

    // 8. 配置 Oracle
    await env.execute(insurance, {
      functionName: "setOracle",
      args: [oracle.address],
      account: deployer,
    });

    // 9. 授予 REPORTER_ROLE
    const REPORTER_ROLE = keccak256(toBytes("REPORTER_ROLE"));
    await env.execute(oracle, {
      functionName: "grantRole",
      args: [REPORTER_ROLE, deployer],
      account: deployer,
    });

    // 10. 本地测试：mint 10000 USDC 给 deployer
    if (env.name === "default" || env.name === "localhost") {
      await env.execute(usdc, {
        functionName: "mint",
        args: [deployer, 10_000_000_000n],
        account: deployer,
      });
    }

    // 日志
    console.log("MockUSDC:      ", usdc.address);
    console.log("PolicyNFT:     ", policyNFT.address);
    console.log("InsurancePool: ", pool.address);
    console.log("Insurance:     ", insurance.address);
    console.log("Oracle:        ", oracle.address);
    console.log("PolicyMarket:  ", market.address);
  },
  { tags: ["Insurance"] },
);
