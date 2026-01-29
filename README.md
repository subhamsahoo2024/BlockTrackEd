# BlockTrackEd

A decentralized blockchain-based scholarship tracking and management system that ensures transparency, security, and efficiency in scholarship fund distribution.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Smart Contract](#smart-contract)
- [Running the Application](#running-the-application)
- [User Roles](#user-roles)
- [Project Structure](#project-structure)
- [Security Guidelines](#security-guidelines)
- [Contributing](#contributing)
- [License](#license)

## Overview

BlockTrackEd is a decentralized application (dApp) that revolutionizes scholarship management by leveraging blockchain technology. The platform provides a transparent, tamper-proof system for creating scholarship funds, managing applications, and disbursing funds directly to students.

Built with React, TypeScript, and Ethereum smart contracts, BlockTrackEd eliminates intermediaries and ensures that every transaction is recorded immutably on the blockchain, providing full accountability to all stakeholders.

## Features

### 🎯 **Multi-Portal System**

- **Admin Portal**: Create and manage scholarship funds, authorize schools, and oversee the entire ecosystem
- **School Portal**: Verify and approve/reject student applications based on eligibility criteria
- **Student Portal**: Apply for scholarships, track application status, and receive disbursements

### 🔐 **Blockchain-Powered Security**

- Immutable record-keeping using Ethereum smart contracts
- MetaMask wallet integration for secure authentication
- Role-based access control (Admin, School, Student)
- ReentrancyGuard protection against attack vectors

### 💰 **Fund Management**

- Create scholarship funds with custom criteria and deadlines
- Automatic fund allocation and tracking
- Transparent disbursement history
- Real-time balance monitoring

### 📋 **Application Processing**

- Structured application submission with student details
- Status tracking (Pending, Verified, Rejected, Disbursed)
- School verification workflow
- Automated fund reservation upon approval

## Tech Stack

### Frontend

- **React 18.3** - Modern UI library
- **TypeScript 5.8** - Type-safe development
- **Vite 5.4** - Lightning-fast build tool
- **TailwindCSS 3.4** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible component library
- **React Router 6.30** - Client-side routing
- **React Hook Form** - Form state management
- **Zod** - Schema validation

### Web3 Integration

- **Ethers.js 6.15** - Ethereum wallet & contract interaction
- **@web3-react** - Web3 wallet connection hooks
- **MetaMask** - Primary wallet provider

### Blockchain

- **Solidity ^0.8.20** - Smart contract language
- **OpenZeppelin** - Audited smart contract libraries
- **Ethereum Sepolia Testnet** - Test deployment network

### Development Tools

- **ESLint 9** - Code linting
- **TypeScript ESLint** - TypeScript-specific linting
- **Bun** - Fast package manager (optional)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐            │
│  │  Admin   │  │  School  │  │    Student    │            │
│  │  Portal  │  │  Portal  │  │    Portal     │            │
│  └──────────┘  └──────────┘  └───────────────┘            │
└────────────────────┬────────────────────────────────────────┘
                     │ Web3Context (Ethers.js)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    MetaMask Wallet                           │
└────────────────────┬────────────────────────────────────────┘
                     │ JSON-RPC
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Ethereum Network (Sepolia)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │    ScholarshipTracking.sol Smart Contract            │  │
│  │  • Fund Management     • Application Processing      │  │
│  │  • School Authorization • Disbursement Logic         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18+ and npm/yarn/bun
- **MetaMask** browser extension
- **Git** for version control
- (Optional) **Remix IDE**, **Hardhat**, or **Foundry** for smart contract deployment

### MetaMask Setup

1. Install MetaMask from [metamask.io](https://metamask.io/)
2. Create a wallet or import existing one
3. Switch to Sepolia Test Network
4. Get test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)

## Installation

1. **Clone the repository**

   ```powershell
   git clone <your-repo-url>
   cd BlockTrackEd
   ```

2. **Install dependencies**

   ```powershell
   npm install
   # or
   yarn install
   # or
   bun install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   ```env
   VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
   VITE_NETWORK_ID=11155111
   ```

## Configuration

### Contract Address Setup

The smart contract address is configured in [src/contexts/Web3Context.tsx](src/contexts/Web3Context.tsx). You have two options:

**Option 1: Environment Variable (Recommended)**

```typescript
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
```

**Option 2: Hard-coded Address**

```typescript
const CONTRACT_ADDRESS = "0xYourContractAddressHere";
```

### Network Configuration

The application is configured for Sepolia testnet by default. To use a different network:

1. Update the network ID in your `.env.local`
2. Ensure MetaMask is connected to the same network
3. Deploy the smart contract to that network

## Smart Contract

### ScholarshipTracking.sol

Located in [Contract/ScholarshipTracking.sol](Contract/ScholarshipTracking.sol)

### Deploying the Contract

**Using Remix:**

1. Open [Remix IDE](https://remix.ethereum.org/)
2. Copy [Contract/ScholarshipTracking.sol](Contract/ScholarshipTracking.sol)
3. Compile with Solidity 0.8.20+
4. Deploy to Sepolia testnet
5. Copy the deployed contract address
6. Update `CONTRACT_ADDRESS` in your frontend

**Using Hardhat:**

```powershell
# Install Hardhat
npm install --save-dev hardhat

# Create deployment script
npx hardhat run scripts/deploy.js --network sepolia
```

## Running the Application

### Development Mode

```powershell
npm run dev
```

Access the app at `http://localhost:5173` (default Vite port)

### Production Build

```powershell
# Build for production
npm run build

# Preview production build
npm run preview
```

### Linting

```powershell
npm run lint
```

## User Roles

### 👨‍💼 Admin (Contract Owner)

- Create and manage scholarship funds
- Add/remove authorized schools
- Monitor overall system activity
- Deposit funds into the contract
- Access: Admin Portal

### 🏫 School

- Review student applications
- Verify eligibility based on criteria
- Approve or reject applications
- Access: School Portal

### 🎓 Student

- Browse available scholarship funds
- Submit applications with required details
- Track application status
- Claim approved scholarship funds
- Access: Student Portal

## Project Structure

```
BlockTrackEd/
├── Contract/
│   └── ScholarshipTracking.sol      # Smart contract
├── src/
│   ├── components/
│   │   ├── WalletConnect.tsx        # Web3 wallet connection
│   │   ├── portals/
│   │   │   ├── AdminPortal.tsx      # Admin dashboard
│   │   │   ├── SchoolPortal.tsx     # School dashboard
│   │   │   └── StudentPortal.tsx    # Student dashboard
│   │   └── ui/                      # shadcn/ui components
│   ├── contexts/
│   │   └── Web3Context.tsx          # Web3 provider & logic
│   ├── hooks/                       # Custom React hooks
│   ├── lib/
│   │   └── utils.ts                 # Utility functions
│   ├── pages/
│   │   ├── Index.tsx                # Landing page
│   │   └── NotFound.tsx             # 404 page
│   ├── types/                       # TypeScript types
│   ├── App.tsx                      # Main app component
│   └── main.tsx                     # Entry point
├── public/                          # Static assets
├── .env.local                       # Environment variables (create this)
├── vite.config.ts                   # Vite configuration
├── tailwind.config.ts               # Tailwind configuration
├── tsconfig.json                    # TypeScript configuration
└── package.json                     # Dependencies
```

## Security Guidelines

### 🔒 **Critical Security Rules**

1. **Never commit sensitive data:**
   - Private keys
   - Mnemonic phrases
   - `.env` or `.env.local` files
   - API keys or RPC endpoints

2. **Update `.gitignore`:**

   ```
   node_modules/
   dist/
   .env
   .env.local
   .env.*.local
   .secret
   artifacts/
   cache/
   ```

3. **Use environment variables:**
   - Store all sensitive config in `.env.local`
   - Use GitHub Secrets for CI/CD
   - Never hard-code addresses or keys

4. **Smart contract security:**
   - The contract uses OpenZeppelin's audited libraries
   - ReentrancyGuard prevents reentrancy attacks
   - Ownable pattern for access control
   - Always test on testnet before mainnet

5. **Web3 security:**
   - Always validate user input
   - Check transaction confirmations
   - Handle errors gracefully
   - Implement proper loading states

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```powershell
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation if needed
4. **Test thoroughly**
   - Test all three portals
   - Verify smart contract interactions
   - Check responsive design
5. **Commit your changes**
   ```powershell
   git commit -m "feat: add your feature description"
   ```
6. **Push and create a Pull Request**
   ```powershell
   git push origin feature/your-feature-name
   ```

### Contribution Guidelines

- Open an issue first to discuss major changes
- Write clear, concise commit messages
- Ensure code passes linting (`npm run lint`)
- Test on Sepolia testnet before submitting
- Update README if adding new features

## License

This project is licensed under the **MIT License**.

---

## 🚀 Quick Start Checklist

- [ ] Install Node.js 18+
- [ ] Install MetaMask
- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Create `.env.local` with contract address
- [ ] Get Sepolia test ETH
- [ ] Run `npm run dev`
- [ ] Connect MetaMask wallet
- [ ] Start using the portals!

## 📞 Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Contact the development team
