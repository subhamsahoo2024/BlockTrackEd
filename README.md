# BlockTrackEd

A blockchain-based scholarship tracking system.

## Table of contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Solidity contracts](#solidity-contracts)
- [Running locally](#running-locally)
- [Security & Git guidelines](#security--git-guidelines)
- [Contributing](#contributing)

## Overview
BlockTrackEd is a dApp for tracking scholarships built with a React + Vite frontend and Solidity smart contracts. The project uses the Sepolia testnet for deployments and testing.

## Prerequisites
- Node.js 18+ and npm (or yarn)
- (Optional) MetaMask or another web3 wallet for interacting with contracts
- (Optional) Remix, Hardhat or Foundry for compiling/deploying Solidity contracts

## Quick start
1. Clone the repository:
   ```powershell
   git clone <repo-url>
   cd BlockTrackEd
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Start the dev server:
   ```powershell
   npm run dev
   ```
4. Open your browser at the URL shown by Vite (default: http://localhost:8080).

## Configuration
- Contract source: `contract/`
- Frontend contract address:
  - The frontend reads the contract address from `src/contexts/Web3Context.tsx` (variable name: `CONTRACT_ADDRESS`).
  - Recommended: set the address in an environment file (eg. `.env.local`) and update `Web3Context.tsx` to read from `import.meta.env.VITE_CONTRACT_ADDRESS` or replace the constant before running.

Example `.env.local`
```env
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```
After adding/modifying `.env.local` restart the dev server.

## Solidity contracts
- Contracts are located in the `contract/` folder.
- You can compile and deploy using Remix, Hardhat, or Foundry. The README here does not include deployment scripts — use your preferred tool.
- To test with Remix:
  1. Open the `.sol` files in Remix.
  2. Compile with the recommended Solidity version (check contract pragma).
  3. Deploy to Sepolia and copy the deployed address into the frontend config (`VITE_CONTRACT_ADDRESS` or `Web3Context.tsx`).

## Running locally
- Dev server:
  ```powershell
  npm run dev
  ```
- Production build:
  ```powershell
  npm run build
  npm run preview
  ```

## Security & Git guidelines
- DO NOT commit private keys, mnemonic phrases, `.env` files, or other secrets.
- Add these to `.gitignore`:
  ```
  node_modules/
  .env
  .env.local
  .secret
  artifacts/
  dist/
  ```
- Use GitHub Secrets or CI secret storage for deployment keys and RPC endpoints.

## Contributing
- Open an issue to discuss changes.
- Use branches and PRs for changes.
- Include tests for Solidity changes when possible.

