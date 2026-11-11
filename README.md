# 航班延误险 DApp

基于 Scaffold-ETH 2 构建的去中心化航班延误保险应用。用户使用 USDC 购买航班延误险并获得保单 NFT；流动性提供者（LP）向保险资金池存入 USDC；Oracle 报告航班延误后，合约按保单条款自动处理赔付。保单 NFT 也可在二级市场转让。

> 本项目为开发与演示原型。`MockUSDC` 仅供本地测试，Oracle 报告依赖授权账户；上线前请完成安全审计并接入可信航班数据源。

## 功能

- **购买保险：** 用户支付保费，获得记录航班与承保信息的 ERC-721 保单 NFT。
- **提供流动性：** LP 存入 USDC 并获得资金池份额；资金池锁定有效保单所需准备金。
- **理赔与退款：** 授权 Oracle 报告延误，达到延误门槛时由资金池赔付；未出险保单到期后可处理退款。
- **保单转售：** 持有人可在二级市场挂单、撤单，买家以 USDC 购买。

## 技术栈

- Solidity `^0.8.20`、Hardhat、OpenZeppelin
- Scaffold-ETH 2、Next.js、React、TypeScript
- Wagmi、RainbowKit、Viem
- Yarn workspaces

## 项目架构

```text
packages/
├── hardhat/
│   ├── contracts/   # Solidity 智能合约
│   ├── deploy/      # 部署合约并初始化角色、Oracle
│   ├── scripts/     # 账户管理、ABI 生成和模拟脚本
│   └── test/        # Hardhat 测试
└── nextjs/
    ├── app/         # Next.js 页面
    ├── components/  # 前端组件
    ├── contracts/   # 合约 ABI 与部署地址
    └── hooks/       # Web3 与合约交互 hooks
```

业务调用关系：用户/LP → `Insurance` / `InsurancePool` → `PolicyNFT`；授权报告者 → `Oracle` → `Insurance` → `InsurancePool`；买卖双方 → `PolicyMarket` → USDC 与 `PolicyNFT`。

## 合约说明

| 合约 | 说明 |
| --- | --- |
| `MockUSDC.sol` | 本地测试用 USDC，精度为 6 位小数；任何人都可以 mint。请勿用于真实资产。 |
| `PolicyNFT.sol` | ERC-721 保单凭证，记录航班号、日期、保额、保费及保单状态。 |
| `InsurancePool.sol` | 管理 LP 存款与份额、保单资金准备金、理赔支付和到期退款。 |
| `Insurance.sol` | 主业务合约，负责购买保单、调用资金池和铸造 NFT，并处理理赔与退款。 |
| `Oracle.sol` | 接收具备 `REPORTER_ROLE` 的账户提交的延误报告，并转发至 `Insurance`。 |
| `PolicyMarket.sol` | 支持保单挂单、撤单和 USDC 购买，管理二级市场手续费。 |

## 环境要求

- Node.js `>=22.10.0`
- Yarn `4.13.0`（可使用 Corepack）

安装依赖：

```bash
corepack enable
yarn install
```

## 本地运行

在项目根目录打开 **3 个终端**，按以下顺序分别执行：

**终端 1：启动本地区块链**

```bash
yarn chain
```

**终端 2：部署合约**（等待终端 1 启动完成后执行）

```bash
yarn deploy
```

部署脚本会部署 MockUSDC、PolicyNFT、InsurancePool、Insurance、Oracle 和 PolicyMarket，并配置合约角色。默认本地网络为 Hardhat，链 ID 为 `31337`。

**终端 3：启动前端**（等待合约部署完成后执行）

```bash
yarn start
```

浏览器访问 <http://localhost:3000>，连接本地 Hardhat 网络。首页已是保险控制台，含购保、LP资金池、保单市场与运营管理。本地领取测试币后，先LP注资，再购买保单；NFT挂牌需先单张授权。

## 测试流程

编译合约：

```bash
yarn compile
```

运行 Hardhat 测试：

```bash
yarn test
```

已新增 `packages/hardhat/test/Insurance.ts`，可单独运行保险测试：

```bash
yarn test:insurance
```

本地修订结果：业务合约与攻击测试合约编译成功，20项保险及安全回归测试通过。旧借贷测试及模拟器已归档为 legacy-tests/*.ts.txt，不再参与保险测试。完整记录见 `docs/test-results.md`。

## 承保与安全规则
保额10–5000测试USDC，保费固定2%（向上取整），其中50%可退；课堂固定费率不是精算定价。购买时固定Oracle地址及延误门槛。起飞至保障结束后24小时可由授权Oracle报告，严格晚于窗口才允许退款。市场仅起飞前可成交，买方提供最高可接受价格。
LP净值扣除未结算保费，提款另受保额与退款准备金约束。管理员可暂停新保单，退出结算继续开放；合约不可升级。仅配置本地与Sepolia，禁止接入真实资产。

## 安全扫描与自动检查
`pip install -r requirements-security.txt` 后运行 `python scripts/security_scan.py`（先完成编译）。扫描6份业务源码、101个检测器，保留11项告警，逐条核对见 `docs/security-review.md`；不等于第三方审计。CI配置会检查编译、测试、前后端类型、前端构建与扫描，尚未在GitHub上执行。

## 部署状态
本地部署及浏览器购保/挂牌流程已验证。Sepolia及源码验证尚未执行，GitHub更新尚未推送。具体步骤与外部条件见 `docs/deployment.md`。


