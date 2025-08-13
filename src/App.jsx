import React, { useState, useEffect } from 'react';
// These imports are for wagmi v2.x and are correct.
import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { WagmiConfig, useAccount, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { mainnet, sepolia, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Wallet, PiggyBank, Handshake, Loader, XCircle, Cat, Gift, LogOut } from 'lucide-react';
import { useWeb3Modal } from '@web3modal/wagmi/react';

// 1. Get a project ID from WalletConnect Cloud
// The project ID is for demonstration purposes. In a real application, you would replace this with your own project ID.
const projectId = 'af36f00224213d5089309605330a103c';

// 2. Create wagmi config
const metadata = {
  name: 'NAKA the CAT Staking',
  description: 'A decentralized application for staking NAKA tokens',
  // Note: The URL is a placeholder. The console warning about the URL mismatch
  // is expected in a local development environment and can be ignored.
  url: 'https://nakathestakingcat.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

const chains = [mainnet, sepolia, base];
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  // The following line is for testing only. In production, it's not needed.
  enableInjected: true,
  enableEagerConnect: true,
});

// 3. Create a Web3Modal instance outside the component
createWeb3Modal({ wagmiConfig, projectId, chains });

// Create a new QueryClient instance for react-query
const queryClient = new QueryClient();

// SVG for a repeating background pattern
const backgroundPattern = `
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="2" fill="#dbeafe" />
    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4Z" stroke="#93c5fd" stroke-width="0.5"/>
  </svg>
`;

// Corrected URLs for the user's uploaded images using their content IDs
const logoUrl = "logo.png";
// const nameLogoUrl = "nato-text-img.webp"; // This is commented out, so we will keep it that way.
const gifUrl = "NekoAlphaBG3.gif";

// Placeholder for your smart contract's ABI and address
// REPLACE THESE WITH YOUR ACTUAL CONTRACT DETAILS
const stakingContract = {
  address: '0xYourStakingContractAddressHere',
  abi: [
    // This is a placeholder ABI with essential functions.
    // Replace this with the full ABI from your deployed contract.
    {
      "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "lockDuration", "type": "uint256" }],
      "name": "stake",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "lockDuration", "type": "uint256" }],
      "name": "unstake",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "claimRewards",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
      "name": "stakedAmounts",
      "outputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
      "name": "getRewards",
      "outputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "internalType": "uint256", "name": "balance", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
  ],
};

const AppContent = () => {
  // Use wagmi hooks to manage wallet state
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();

  // New hook for writing to a contract
  const { writeContract } = useWriteContract();

  // State management for the DApp
  const [stakeInputs, setStakeInputs] = useState({ '7-day': '', '14-day': '', '28-day': '' });
  const [unstakeInputs, setUnstakeInputs] = useState({ '7-day': '', '14-day': '', '28-day': '' });
  const [apiQuote, setApiQuote] = useState("Patience is the key to success.");
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('success');
  const [lastTxHash, setLastTxHash] = useState(null);

  // Define staking pools with their APY and durations
  const stakingPools = [
    { id: '7-day', duration: '7 Days', apy: 50, lockDurationInSeconds: 604800 },
    { id: '14-day', duration: '14 Days', apy: 100, lockDurationInSeconds: 1209600 },
    { id: '28-day', duration: '28 Days', apy: 150, lockDurationInSeconds: 2419200 },
  ];

  // --- WAGMI Contract Hooks for reading data ---
  // Read NAKA token balance
  const { data: tokenBalanceData, isLoading: isLoadingBalance, refetch: refetchBalance } = useReadContract({
    address: '0xYourNakaTokenAddressHere', // Replace with your NAKA token address
    abi: stakingContract.abi, // Assuming staking contract has balanceOf function
    functionName: 'balanceOf',
    args: [address],
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Read staked amounts for each pool
  const { data: stakedAmounts7Day, refetch: refetchStaked7Day } = useReadContract({
    address: stakingContract.address,
    abi: stakingContract.abi,
    functionName: 'stakedAmounts',
    args: [address, stakingPools[0].lockDurationInSeconds],
    query: {
      enabled: isConnected && !!address,
    },
  });
  const { data: stakedAmounts14Day, refetch: refetchStaked14Day } = useReadContract({
    address: stakingContract.address,
    abi: stakingContract.abi,
    functionName: 'stakedAmounts',
    args: [address, stakingPools[1].lockDurationInSeconds],
    query: {
      enabled: isConnected && !!address,
    },
  });
  const { data: stakedAmounts28Day, refetch: refetchStaked28Day } = useReadContract({
    address: stakingContract.address,
    abi: stakingContract.abi,
    functionName: 'stakedAmounts',
    args: [address, stakingPools[2].lockDurationInSeconds],
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Read rewards for each pool
  const { data: rewardsData, refetch: refetchRewards } = useReadContract({
    address: stakingContract.address,
    abi: stakingContract.abi,
    functionName: 'getRewards',
    args: [address],
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Use this hook to track the transaction receipt for the last transaction
  const { isLoading: isTxPending, isSuccess: isTxSuccess, isError: isTxError } = useWaitForTransactionReceipt({
    hash: lastTxHash,
  });

  // Function to show a custom modal message
  const showCustomModal = (message, type = 'success') => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);
  };

  // Handle side effects of wallet connection
  useEffect(() => {
    if (isConnected) {
      showCustomModal('Wallet connected successfully!', 'success');
      // Refetch data immediately after a successful connection
      refetchAllData();
    }
  }, [isConnected]);

  // Handle transaction status changes
  useEffect(() => {
    if (isTxSuccess) {
      showCustomModal(`Transaction successful!`, 'success');
      refetchAllData();
    }
    if (isTxError) {
      showCustomModal('Oh no! Your transaction failed.', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTxSuccess, isTxError]);

  // Helper function to refetch all data from the contract
  const refetchAllData = () => {
    refetchBalance();
    refetchStaked7Day();
    refetchStaked14Day();
    refetchStaked28Day();
    refetchRewards();
  };

  // Function to handle the staking logic for a specific pool
  const handleStake = async (poolId) => {
    const amount = parseFloat(stakeInputs[poolId]);
    if (isNaN(amount) || amount <= 0) {
      showCustomModal('Meow! Please enter a valid amount.', 'error');
      return;
    }

    const pool = stakingPools.find(p => p.id === poolId);
    if (!pool) return;

    try {
      // Use the new useWriteContract hook
      const hash = await writeContract({
        address: stakingContract.address,
        abi: stakingContract.abi,
        functionName: 'stake',
        args: [BigInt(amount * 10 ** 18), BigInt(pool.lockDurationInSeconds)], // Assuming 18 decimals
      });
      setLastTxHash(hash);
      showCustomModal('Staking transaction submitted. Waiting for confirmation...', 'success');
      setStakeInputs(prev => ({ ...prev, [pool.id]: '' }));
    } catch (error) {
      console.error('Stake transaction failed:', error);
      showCustomModal(`Oh no! Staking failed: ${error.message}`, 'error');
    }
  };

  // Function to handle the unstaking logic for a specific pool
  const handleUnstake = async (poolId) => {
    const amount = parseFloat(unstakeInputs[poolId]);
    if (isNaN(amount) || amount <= 0) {
      showCustomModal('Meow! Please enter a valid amount.', 'error');
      return;
    }

    const pool = stakingPools.find(p => p.id === poolId);
    if (!pool) return;

    try {
      // Use the new useWriteContract hook
      const hash = await writeContract({
        address: stakingContract.address,
        abi: stakingContract.abi,
        functionName: 'unstake',
        args: [BigInt(amount * 10 ** 18), BigInt(pool.lockDurationInSeconds)], // Assuming 18 decimals
      });
      setLastTxHash(hash);
      showCustomModal('Unstaking transaction submitted. Waiting for confirmation...', 'success');
      setUnstakeInputs(prev => ({ ...prev, [pool.id]: '' }));
    } catch (error) {
      console.error('Unstake transaction failed:', error);
      showCustomModal(`Oh no! Unstaking failed: ${error.message}`, 'error');
    }
  };

  // Function to handle claiming rewards
  const handleClaimRewards = async () => {
    try {
      // Use the new useWriteContract hook
      const hash = await writeContract({
        address: stakingContract.address,
        abi: stakingContract.abi,
        functionName: 'claimRewards',
      });
      setLastTxHash(hash);
      showCustomModal('Claim transaction submitted. Waiting for confirmation...', 'success');
    } catch (error) {
      console.error('Claim transaction failed:', error);
      showCustomModal(`Oh no! Claiming rewards failed: ${error.message}`, 'error');
    }
  };

  // Function to fetch a motivational quote from the API
  const fetchQuote = async () => {
    setIsLoadingQuote(true);
    try {
      let chatHistory = [];
      const prompt = "Give me a short, one-sentence motivational quote about building something great, with a subtle cat theme.";
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setApiQuote(text);
      } else {
        throw new Error('API response structure is unexpected or content is missing from the "candidates" array.');
      }
    } catch (error) {
      console.error('Error fetching quote:', error.message);
      setApiQuote("A purr-fectly great project starts with a single step.");
    } finally {
      setIsLoadingQuote(false);
    }
  };

  useEffect(() => {
    // Fetch a quote on component mount
    fetchQuote();
  }, []);

  // Format data from BigInt to a human-readable number
  const formatBalance = (balance) => {
    if (balance === undefined) return 0;
    // Assuming 18 decimals, you may need to adjust this
    return parseFloat(balance.toString()) / 10 ** 18;
  };

  const formattedTokenBalance = formatBalance(tokenBalanceData);
  const formattedStaked7Day = formatBalance(stakedAmounts7Day);
  const formattedStaked14Day = formatBalance(stakedAmounts14Day);
  const formattedStaked28Day = formatBalance(stakedAmounts28Day);
  const formattedRewards = formatBalance(rewardsData);

  const totalStaked = formattedStaked7Day + formattedStaked14Day + formattedStaked28Day;

  // Helper to shorten the address
  const shortAddress = (addr) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <div className="app-container" style={{ backgroundImage: `url('data:image/svg+xml;base64,${btoa(backgroundPattern)}')` }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');

          :root {
            --primary-color: #1e40af; /* Blue-900 */
            --secondary-color: #f97316; /* Orange-500 */
            --accent-color: #93c5fd; /* Blue-300 */
            --success-color: #059669; /* Emerald-600 */
            --danger-color: #ef4444; /* Rose-600 */
            --bg-light: #eff6ff; /* Blue-50 */
            --bg-card: rgba(255, 255, 255, 0.7);
            --border-color: #d1d5db; /* Gray-300 */
          }

          .font-bebas { font-family: 'Bebas Neue', sans-serif; }
          .font-inter { font-family: 'Inter', sans-serif; }
          .text-primary { color: var(--primary-color); }
          .text-secondary { color: var(--secondary-color); }
          .text-success { color: var(--success-color); }
          .text-danger { color: var(--danger-color); }

          .app-container {
            min-height: 100vh;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            background-color: var(--bg-light);
            color: var(--primary-color);
            font-family: 'Inter', sans-serif;
            background-size: 24px 24px;
          }

          .main-wrapper {
            width: 100%;
            max-width: 64rem; /* max-w-5xl */
            margin-left: auto;
            margin-right: auto;
            z-index: 10;
            position: relative;
          }

          .header {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            background-color: var(--bg-card);
            backdrop-filter: blur(8px);
            border-radius: 1.5rem; /* rounded-3xl */
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* shadow-xl */
            border: 4px solid white;
          }

          @media (min-width: 640px) { /* sm */
            .header {
              flex-direction: row;
            }
          }

          .logo-section {
            display: flex;
            align-items: center;
            justify-content: center; /* Center horizontally */
            margin-bottom: 1rem;
            gap: 0.5rem;
          }
          
          @media (min-width: 640px) { /* sm */
            .logo-section {
              margin-bottom: 0;
            }
          }
          
          .logo-image {
            width: 4rem;
            height: 4rem;
            border-radius: 9999px; /* rounded-full */
            border: 4px solid #fb923c; /* border-orange-400 */
            padding: 0.25rem;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          
          .text-logo-image {
            height: 2.5rem; /* Adjust height to fit nicely with the logo */
            width: auto;
            filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.1));
          }

          .app-title {
            font-size: 1.875rem; /* text-3xl */
            font-family: 'Bebas Neue', sans-serif;
            color: var(--primary-color);
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
            letter-spacing: 0.05em; /* tracking-wider */
            margin-left: 1rem;
          }

          .connect-button {
            position: relative;
            display: inline-flex;
            height: 3rem;
            width: 100%;
            align-items: center;
            justify-content: center;
            border-radius: 9999px; /* rounded-full */
            padding-left: 1.5rem;
            padding-right: 1.5rem;
            font-family: 'Bebas Neue', sans-serif;
            color: white;
            transition: all 0.3s ease-out;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            background: linear-gradient(to right, #fb923c, #ea580c);
          }

          .connect-button:hover {
            transform: scale(1.05);
            background: linear-gradient(to right, #fb923c, #f97316);
          }

          @media (min-width: 640px) {
            .connect-button {
              width: auto;
            }
          }

          .connect-button-content {
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
          }

          .icon-mr-2 { margin-right: 0.5rem; }
          .h-5-w-5 { height: 1.25rem; width: 1.25rem; }

          .connected-wallet {
            display: flex;
            align-items: center;
            background-color: white;
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            border: 2px solid var(--success-color);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            color: var(--primary-color);
            font-weight: 700;
          }

          .connected-wallet .status-indicator {
            width: 0.5rem;
            height: 0.5rem;
            background-color: var(--success-color);
            border-radius: 9999px;
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            margin-left: 0.5rem;
          }

          .disconnect-button {
            padding: 0.25rem;
            border-radius: 9999px;
            color: #6b7280; /* Gray-500 */
            transition: color 0.3s;
            margin-left: 0.5rem;
          }

          .disconnect-button:hover {
            color: var(--primary-color);
          }

          .hero-section {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
          }

          .hero-cat {
            width: 12rem;
            height: 12rem;
            border-radius: 9999px;
            border: 4px solid var(--primary-color);
            background-color: white;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            padding: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bounce-slow 4s ease-in-out infinite;
            overflow: hidden; /* Ensure the image doesn't bleed out of the circular container */
          }

          @media (min-width: 640px) {
            .hero-cat {
              width: 16rem;
              height: 16rem;
            }
          }

          .hero-cat img {
            width: 100%;
            height: 100%;
            object-fit: cover; /* Make the image cover the container while maintaining aspect ratio */
            border-radius: 9999px;
          }

          .stats-section {
            background-color: var(--bg-card);
            backdrop-filter: blur(8px);
            padding: 1.5rem;
            border-radius: 1.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 4px solid var(--primary-color);
            color: var(--primary-color);
          }

          .stats-section h2 {
            font-size: 1.5rem;
            font-family: 'Bebas Neue', sans-serif;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          @media (min-width: 640px) {
            .stats-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }

          .stat-card {
            background-color: white;
            padding: 1rem;
            border-radius: 0.75rem;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border: 2px solid var(--border-color);
          }

          .stat-card p.label {
            font-size: 0.875rem;
            font-family: 'Inter', sans-serif;
            color: #6b7280;
          }

          .stat-card p.value {
            font-size: 1.875rem;
            font-weight: 800;
            font-family: 'Bebas Neue', sans-serif;
            margin-top: 0.25rem;
          }

          .staking-pools {
            display: grid;
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          @media (min-width: 1024px) {
            .staking-pools {
              grid-template-columns: repeat(3, 1fr);
            }
          }

          .pool-card {
            background-color: var(--bg-card);
            backdrop-filter: blur(8px);
            padding: 1.5rem;
            border-radius: 1.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 4px solid var(--secondary-color);
            position: relative;
            overflow: hidden;
            color: var(--primary-color);
            transition: transform 0.3s ease-in-out;
          }

          .pool-card:hover {
            transform: scale(1.05);
          }

          .pool-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background-color: var(--secondary-color);
            opacity: 0;
            transition: opacity 0.3s;
            z-index: 0;
          }

          .pool-card:hover::before {
            opacity: 0.1;
          }

          .pool-card h2 {
            font-size: 1.5rem;
            font-family: 'Bebas Neue', sans-serif;
            color: var(--primary-color);
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            position: relative;
            z-index: 1;
          }

          .pool-card .apy {
            font-size: 1.875rem;
            font-family: 'Bebas Neue', sans-serif;
            color: var(--secondary-color);
            margin-bottom: 1rem;
            position: relative;
            z-index: 1;
          }

          .input-group {
            position: relative;
            z-index: 1;
          }

          .input-group p {
            font-size: 0.875rem;
            font-family: 'Inter', sans-serif;
            color: #6b7280;
            margin-bottom: 0.5rem;
          }

          .input-flex {
            display: flex;
            gap: 0.5rem;
          }

          .input-field {
            flex-grow: 1;
            background-color: white;
            color: var(--primary-color);
            padding: 0.75rem;
            border-radius: 0.75rem;
            border: 2px solid var(--border-color);
            transition: all 0.3s;
            font-family: 'Bebas Neue', sans-serif;
            font-size: 1.125rem;
          }

          .input-field:focus {
            outline: none;
            ring: 2px solid var(--primary-color);
          }

          .stake-button {
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            font-family: 'Bebas Neue', sans-serif;
            color: white;
            background-color: var(--primary-color);
            transition: transform 0.2s, background-color 0.2s;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }

          .stake-button:hover {
            background-color: #1e3a8a;
          }

          .stake-button:active {
            transform: scale(0.95);
          }

          .stake-button:disabled {
            background-color: #9ca3af;
            cursor: not-allowed;
          }

          .unstake-button {
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            font-family: 'Bebas Neue', sans-serif;
            color: white;
            background-color: var(--danger-color);
            transition: transform 0.2s, background-color 0.2s;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }

          .unstake-button:hover {
            background-color: #b91c1c;
          }

          .unstake-button:active {
            transform: scale(0.95);
          }

          .unstake-button:disabled {
            background-color: #9ca3af;
            cursor: not-allowed;
          }

          .claim-section {
            background-color: var(--bg-card);
            backdrop-filter: blur(8px);
            padding: 1.5rem;
            border-radius: 1.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 4px solid var(--success-color);
            margin-top: 1.5rem;
            color: var(--primary-color);
          }

          .claim-section h2 {
            font-size: 1.5rem;
            font-family: 'Bebas Neue', sans-serif;
            color: var(--primary-color);
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
          }

          .claim-button {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.75rem;
            border-radius: 0.75rem;
            font-family: 'Bebas Neue', sans-serif;
            font-size: 1.125rem;
            transition: all 0.3s ease-in-out;
            background-color: var(--success-color);
            color: white;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          }

          .claim-button:hover {
            transform: scale(1.05);
            box-shadow: 0 10px 15px -3px rgba(0, 200, 100, 0.5);
          }

          .claim-button:active {
            transform: scale(1);
          }

          .claim-button:disabled {
            background-color: #9ca3af;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }

          .welcome-message-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 60vh;
            text-align: center;
            animation: fade-in 1s ease-in-out;
            color: var(--primary-color);
          }

          .welcome-title {
            font-size: 3rem;
            font-family: 'Bebas Neue', sans-serif;
            color: var(--primary-color);
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
          }

          .welcome-message {
            color: #4b5563; /* Gray-600 */
            font-family: 'Inter', sans-serif;
            margin-bottom: 2rem;
            max-width: 28rem;
          }

          .modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 50;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: rgba(0, 0, 0, 0.75);
          }

          .modal-container {
            position: relative;
            padding: 1.5rem;
            border-radius: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            max-width: 24rem;
            width: 100%;
            margin: 0 1rem;
            transform: scale(1);
            transition: all 0.2s;
            text-align: center;
          }

          .modal-container.success { background-color: var(--success-color); color: white; }
          .modal-container.error { background-color: var(--danger-color); color: white; }

          .modal-close-button {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            color: white;
          }

          .modal-title {
            font-size: 1.5rem;
            font-weight: 700;
            font-family: 'Bebas Neue', sans-serif;
            margin-bottom: 0.5rem;
          }

          .modal-text {
            font-family: 'Inter', sans-serif;
          }

          .footer {
            margin-top: 2rem;
            padding-top: 1.5rem;
            text-align: center;
            color: #6b7280;
            border-top: 2px solid var(--primary-color);
          }

          .quote-text {
            font-size: 0.875rem;
            font-family: 'Inter', sans-serif;
            font-style: italic;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }

          @keyframes bounce-slow {
            0%, 100% { transform: translateY(-5%); }
            50% { transform: translateY(0); }
          }

          @keyframes fade-in {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
        `}
      </style>
      <div className="main-wrapper">
        {/* Header */}
        <header className="header">
          {/* Updated logo section to use two images */}
          <div className="logo-section">
            <img src={logoUrl} alt="NAKA the CAT Logo" className="logo-image animate-pulse" />
            {/* <img src={nameLogoUrl} alt="NAKA Text Logo" className="text-logo-image" /> */}
          </div>
          {isConnected ? (
            <div className="connected-wallet">
              <Wallet className="icon-mr-2" style={{ color: 'var(--success-color)' }} />
              <span className="font-bold hidden-sm">{shortAddress(address)}</span>
              <span className="font-bold visible-sm">Connected</span>
              <div className="status-indicator"></div>
              <button onClick={disconnect} className="disconnect-button">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => open()}
              className="connect-button"
            >
              <span className="connect-button-content">
                <Wallet className="icon-mr-2 h-5-w-5" />
                Connect Wallet
              </span>
            </button>
          )}
        </header>

        {/* Main Dashboard Content */}
        {isConnected ? (
          <main>
            {/* Hero Cat GIF */}
            <div className="hero-section">
              <div className="hero-cat">
                <img src={gifUrl} alt="A cute cat GIF" />
              </div>
            </div>

            {/* Balances & Rewards Section */}
            <div className="stats-section">
              <h2><Cat style={{ marginRight: '0.5rem' }} /> Your NAKA Staking Stats</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <p className="label">Available Balance</p>
                  <p className="value">{formattedTokenBalance.toFixed(2)}</p>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', color: '#4b5563', marginTop: '0.25rem' }}>NAKA Tokens</p>
                </div>
                <div className="stat-card">
                  <p className="label">Total Staked</p>
                  <p className="value">{totalStaked.toFixed(2)}</p>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', color: '#4b5563', marginTop: '0.25rem' }}>NAKA Tokens</p>
                </div>
                <div className="stat-card">
                  <p className="label">Total Claimable Rewards</p>
                  <p className="value" style={{ color: 'var(--success-color)' }}>{formattedRewards.toFixed(2)}</p>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', color: '#4b5563', marginTop: '0.25rem' }}>NAKA Tokens</p>
                </div>
              </div>
            </div>

            {/* Staking Pools Section */}
            <div className="staking-pools" style={{ marginTop: '1.5rem' }}>
              {stakingPools.map(pool => (
                <div key={pool.id} className="pool-card">
                  <h2>
                    <Gift style={{ marginRight: '0.5rem' }} /> {pool.duration} Pool
                  </h2>
                  <p className="apy">{pool.apy}% APY</p>
                  <div className="input-group" style={{ marginBottom: '1rem' }}>
                    <p>Your staked amount:</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'Bebas Neue, sans-serif' }}>
                      {pool.id === '7-day' ? formattedStaked7Day.toFixed(2) :
                        pool.id === '14-day' ? formattedStaked14Day.toFixed(2) :
                          formattedStaked28Day.toFixed(2)} NAKA
                    </p>
                  </div>
                  <div className="input-group" style={{ marginBottom: '1rem' }}>
                    <p>Stake NAKA</p>
                    <div className="input-flex">
                      <input
                        type="number"
                        value={stakeInputs[pool.id]}
                        onChange={(e) => setStakeInputs(prev => ({ ...prev, [pool.id]: e.target.value }))}
                        placeholder="0.0"
                        className="input-field"
                      />
                      <button
                        onClick={() => handleStake(pool.id)}
                        disabled={isTxPending}
                        className="stake-button"
                      >
                        {isTxPending ? <Loader className="animate-spin" /> : 'Stake'}
                      </button>
                    </div>
                  </div>
                  <div className="input-group" style={{ marginBottom: '1rem' }}>
                    <p>Unstake NAKA</p>
                    <div className="input-flex">
                      <input
                        type="number"
                        value={unstakeInputs[pool.id]}
                        onChange={(e) => setUnstakeInputs(prev => ({ ...prev, [pool.id]: e.target.value }))}
                        placeholder="0.0"
                        className="input-field"
                      />
                      <button
                        onClick={() => handleUnstake(pool.id)}
                        disabled={isTxPending}
                        className="unstake-button"
                      >
                        {isTxPending ? <Loader className="animate-spin" /> : 'Unstake'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Claim Rewards Section */}
            <div className="claim-section">
              <h2><PiggyBank style={{ marginRight: '0.5rem' }} /> Claim Rewards</h2>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'Bebas Neue, sans-serif' }}>{formattedRewards.toFixed(2)} NAKA</p>
                <p style={{ fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', color: '#6b7280' }}>claimable rewards</p>
              </div>
              <button
                onClick={handleClaimRewards}
                disabled={isTxPending || formattedRewards <= 0}
                className="claim-button"
              >
                {isTxPending ? (
                  <Loader className="animate-spin" style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} />
                ) : (
                  <Handshake style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} />
                )}
                {isTxPending ? 'Claiming...' : 'Claim All Rewards'}
              </button>
            </div>
          </main>
        ) : (
          <div className="welcome-message-container">
            <h1 className="welcome-title">Welcome to NAKA Staking!</h1>
            <p className="welcome-message">Connect your wallet to start staking your NAKA tokens and earn rewards. It's time to put your tokens to work!</p>
            <button
              onClick={() => open()}
              className="connect-button"
            >
              <span className="connect-button-content">
                <Wallet className="icon-mr-2 h-5-w-5" />
                Connect Wallet
              </span>
            </button>
          </div>
        )}

        {/* Custom Modal */}
        {showModal && (
          <div className="modal-overlay">
            <div className={`modal-container ${modalType === 'success' ? 'success' : 'error'}`}>
              <button onClick={() => setShowModal(false)} className="modal-close-button">
                <XCircle size={24} />
              </button>
              <div>
                <h3 className="modal-title">
                  {modalType === 'success' ? 'Meow-nificent!' : 'Oh no!'}
                </h3>
                <p className="modal-text">{modalMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer with API Quote */}
        <footer className="footer">
          {isLoadingQuote ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Loader className="animate-spin" style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem', color: '#4b5563' }} />
              <span className="quote-text">Loading inspiration...</span>
            </div>
          ) : (
            <p className="quote-text">&ldquo;{apiQuote}&rdquo;</p>
          )}
        </footer>
      </div>
    </div>
  );
};

const App = () => (
  <WagmiConfig config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  </WagmiConfig>
);

export default App;
