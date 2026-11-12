import { expect } from "chai";
import { network } from "hardhat";
import { simulatePolicy } from "../scripts/simulatePolicyCore.js";
describe("Local policy simulation tool", function () {
  async function fixture() {
    const { ethers } = await network.create();
    const [admin, user] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDC");
    const nft = await ethers.deployContract("PolicyNFT", [admin.address]);
    const pool = await ethers.deployContract("InsurancePool", [token.target, admin.address]);
    const insurance = await ethers.deployContract("Insurance", [pool.target, nft.target, token.target, admin.address, 60]);
    const oracle = await ethers.deployContract("Oracle", [insurance.target, admin.address]);
    await nft.grantRole(ethers.id("INSURER_ROLE"), insurance.target);
    await pool.grantRole(ethers.id("INSURER_ROLE"), insurance.target);
    await oracle.grantRole(ethers.id("REPORTER_ROLE"), admin.address);
    await insurance.setOracle(oracle.target);
    await token.mint(admin.address, 10000_000000n); await token.approve(pool.target, 10000_000000n); await pool.deposit(10000_000000n, admin.address);
    await token.mint(user.address, 10_000000n); await token.connect(user).approve(pool.target, 10_000000n);
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await insurance.connect(user).purchasePolicy("CX528", now+3600, now+3600, now+7200, 500_000000n, 10_000000n, 5_000000n);
    return {ethers,insurance};
  }
  it("advances to departure and verifies a 500 USDC claim", async () => {
    const {ethers,insurance} = await fixture();
    const result = await simulatePolicy(ethers.provider, await insurance.getAddress(), 1n, "claim");
    expect(result.receivedUSDC).to.equal("500.0"); expect(result.finalStatus).to.equal("2");
  });
  it("advances beyond grace and verifies a 5 USDC refund", async () => {
    const {ethers,insurance} = await fixture();
    const result = await simulatePolicy(ethers.provider, await insurance.getAddress(), 1n, "refund");
    expect(result.receivedUSDC).to.equal("5.0"); expect(result.finalStatus).to.equal("3");
    try { await simulatePolicy(ethers.provider, await insurance.getAddress(), 1n, "refund"); throw Error("expected rejection"); }
    catch(error) { expect(String(error)).to.include("不能重复模拟"); }
  });
  it("rejects a nonlocal chain before reading or sending transactions", async () => {
    let sent = false;
    const provider = {getNetwork:async()=>({chainId:11155111n}),send:async()=>{sent=true;}};
    try { await simulatePolicy(provider as any, "0x0000000000000000000000000000000000000000", 1n, "claim"); throw Error("expected rejection"); }
    catch(error) { expect(String(error)).to.include("仅允许Hardhat"); }
    expect(sent).to.equal(false);
  });
});
