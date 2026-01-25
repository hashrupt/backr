// Map keyword labels to icons for the entity About section icon grid
const iconMap: Record<string, string> = {
  // Finance & DeFi
  'DeFi': '💱', 'Lending': '🏦', 'Borrowing': '🏦', 'Yield': '📈',
  'Stablecoin': '💲', 'Trading': '📊', 'Swap': '🔄', 'Liquidity': '💧',
  'Treasury': '🏛️', 'Payments': '💳', 'Settlement': '🏦', 'AMM': '⚙️',
  'DEX': '💱', 'Derivatives': '📉', 'Margin': '📐', 'Staking': '🔒',
  'Payouts': '💸', 'Remittance': '🌍',
  // Tokenization & Assets
  'Tokenized': '🪙', 'RWA': '🏠', 'Securities': '📜', 'Equity': '📈',
  'Bonds': '📃', 'Real Estate': '🏠', 'Commodities': '⛏️',
  'NFT': '🖼️', 'Collectibles': '🎨', 'Digital Assets': '💎',
  // Infrastructure & Tech
  'Validator': '✅', 'Node': '🖥️', 'Infrastructure': '🏗️',
  'Bridge': '🌉', 'Interop': '🔗', 'Wallet': '👛',
  'Custody': '🔐', 'SDK': '🧰', 'API': '⚡', 'Protocol': '📡',
  'Smart Contracts': '📝', 'Ledger': '📒', 'On-chain': '⛓️',
  'Cross-chain': '🔗', 'Multichain': '🔗', 'Layer': '📚',
  // Identity & Compliance
  'KYC': '🆔', 'AML': '🛡️', 'Identity': '🆔', 'Compliance': '⚖️',
  'Verification': '✔️', 'Credentials': '🪪', 'Privacy': '🔒',
  'Regulated': '⚖️', 'Compliant': '⚖️', 'Auditable': '🔍',
  'ZK Proofs': '🧩', 'Encrypted': '🔐',
  // Data & AI
  'Analytics': '📊', 'Oracle': '🔮', 'Indexing': '📇',
  'Reporting': '📋', 'ML': '🤖', 'AI': '🤖',
  'Intelligence': '🧠', 'Prediction': '🎯',
  // Users & Markets
  'Institutional': '🏢', 'Enterprise': '🏢', 'Retail': '👤',
  'B2B': '🤝', 'Marketplace': '🏪', 'Exchange': '💱',
  'Consumer': '👤', 'Developers': '👨‍💻',
  // Gaming & Social
  'Gaming': '🎮', 'Play-to-Earn': '🕹️', 'Esports': '🏆',
  'Metaverse': '🌐', 'Social': '💬',
  // Storage
  'Storage': '💾', 'IPFS': '📦', 'Backup': '💾',
  // Canton-specific
  'Daml': '📜', 'Canton Coin': '🪙', 'Synchronizer': '🔄',
  // Other domains
  'Insurance': '🛡️', 'Healthcare': '🏥', 'Supply Chain': '📦',
  'Carbon Credits': '🌱', 'Energy': '⚡', 'Crowdfunding': '🤝',
  'Governance': '🗳️', 'DAO': '🏛️', 'Voting': '🗳️',
  'Automation': '⚙️', 'Treasury Mgmt': '🏛️',
  'Open Source': '💻', 'Non-custodial': '🔑',
};

const defaultIcon = '🏷️';

export function getKeywordIcon(keyword: string): string {
  return iconMap[keyword] || defaultIcon;
}

// Extract a one-liner from description text
export function extractOneLiner(description: string | null | undefined): string | null {
  if (!description) return null;

  // Take first sentence
  const firstSentence = description.match(/^[^.!?]+[.!?]?/)?.[0] || description;
  const trimmed = firstSentence.trim();

  if (trimmed.length <= 100) return trimmed;

  // Truncate at word boundary
  const truncated = trimmed.slice(0, 100).replace(/\s+\S*$/, '');
  return truncated + '...';
}
