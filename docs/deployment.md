# 部署与运行

## 本地（已实际验证）
Node 22.14.0或更高，Yarn 4.13.0。根目录执行 `corepack enable`、`yarn install --immutable`、`yarn compile`、`yarn test`。
三个终端依次执行 `yarn chain`、`yarn deploy`、`yarn start`，浏览器 http://localhost:3000 。本地钱包领取测试ETH和MockUSDC，先LP注资，再购保。挂牌先授权单张NFT，再发送挂牌交易。
本地链重启后状态可能清空；deployedContracts.ts由部署脚本生成，不要手改。

## Sepolia（尚未执行）
已只读查询用户指定的Sepolia地址 `0xc8D5E04d3f6DA547a015c855A79220aF60a7D8d8`，2026-11-11查询时余额为1.458测试ETH。公开地址已知，但本项目尚未配置该账户的签名能力。MetaMask安装完成不代表Hardhat能够使用它签名。
仓库AGENTS.md说明测试网部署/验证包含交互式密码步骤，须由用户操作。仅在本机处理测试钱包，不将私钥、助记词或解密密码发到聊天或GitHub。

1. 将 packages/hardhat/.env.example 复制为同目录.env，设置自己的SEPOLIA_RPC_URL及ETHERSCAN_API_KEY。
2. 根目录 `yarn generate`（或 `yarn account:import`），按提示设置密码，创建加密的独立测试账户。
3. `yarn account`查看地址，为其领取免费Sepolia测试ETH。
4. `yarn deploy --network sepolia`，本机输入解密密码。脚本新建MockUSDC，不引用真实USDC。仅允许本地与Sepolia部署。
5. `yarn verify --network sepolia`，核对6份业务合约验证状态。
6. 保存 packages/hardhat/deployments/sepolia 的部署记录，在README添加6份合约的真实地址、部署交易及Etherscan验证链接。目前这些证据均未产生。
7. 前端 packages/nextjs/.env.local 设置 `NEXT_PUBLIC_TARGET_NETWORK=sepolia`，重新构建/启动。

## GitHub（已上传）
用户个人仓库：https://github.com/DarkfireDK/Blockchain-Group-project 。源码已上传到main，首次完整提交 `1d84cccfefa5f06b30b9c825ea3455d955c7b385`。保持仓库原有私有可见性；课程提交前需保证教师可访问。
CI配置已上传，上传后首次查询尚无工作流运行，不能声称远程CI通过。不要上传.env、.venv-security、node_modules、.security-build、钱包数据或密码。
