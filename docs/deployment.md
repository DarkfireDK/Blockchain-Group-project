# 部署与运行

## 本地（已实际验证）
Node 22.14.0或更高，Yarn 4.13.0。根目录执行 `corepack enable`、`yarn install --immutable`、`yarn compile`、`yarn test`。
三个终端依次执行 `yarn chain`、`yarn deploy`、`yarn start`，浏览器 http://localhost:3000 。本地钱包领取测试ETH和MockUSDC，先LP注资，再购保。挂牌先授权单张NFT，再发送挂牌交易。
本地链重启后状态可能清空；deployedContracts.ts由部署脚本生成，不要手改。

## Sepolia（尚未执行）
此环境尚无部署钱包或测试ETH。仓库AGENTS.md说明测试网部署/验证包含交互式密码步骤，须由用户操作。仅在本机处理测试钱包，不将私钥或解密密码发到聊天或GitHub。

1. 将 packages/hardhat/.env.example 复制为同目录.env，设置自己的SEPOLIA_RPC_URL及ETHERSCAN_API_KEY。
2. 根目录 `yarn generate`（或 `yarn account:import`），按提示设置密码，创建加密的独立测试账户。
3. `yarn account`查看地址，为其领取免费Sepolia测试ETH。
4. `yarn deploy --network sepolia`，本机输入解密密码。脚本新建MockUSDC，不引用真实USDC。仅允许本地与Sepolia部署。
5. `yarn verify --network sepolia`，核对6份业务合约验证状态。
6. 保存 packages/hardhat/deployments/sepolia 的部署记录，在README添加6份合约的真实地址、部署交易及Etherscan验证链接。目前这些证据均未产生。
7. 前端 packages/nextjs/.env.local 设置 `NEXT_PUBLIC_TARGET_NETWORK=sepolia`，重新构建/启动。

## GitHub（尚未推送）
当前连接账号DarkfireDK对组员仓库只有pull权限，push=false。用户已改为要求推送到自己的仓库；等待个人空仓库链接，当前GitHub工具不能创建仓库，系统没有可用GitHub登录。不要上传.env、.venv-security、node_modules、.security-build、钱包数据或密码。
CI已补齐编译、测试、类型、前端构建与Slither检查；尚未在GitHub服务器运行，不能声称远程CI通过。
