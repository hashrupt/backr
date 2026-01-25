const data = require('../data/tokenomics-apps-2026-01-24T13-27-01-990Z.json');

console.log('='.repeat(60));
console.log('FEATURED APP DATA ANALYSIS');
console.log('='.repeat(60));
console.log('');
console.log('Total applications:', data.length);
console.log('With Party ID:', data.filter(a => a.partyId).length);
console.log('Without Party ID:', data.filter(a => !a.partyId).length);
console.log('');

// === TRANSACTION SCALING ===
console.log('--- Transaction Scaling ---');
const scaling = { 'Linear': 0, 'Super Linear': 0, 'Sub Linear': 0, 'Unknown': 0 };
data.forEach(a => {
  if (a.transactionScaling) {
    const s = a.transactionScaling.toLowerCase();
    if (s.includes('super')) scaling['Super Linear']++;
    else if (s.includes('sub')) scaling['Sub Linear']++;
    else if (s.includes('linear')) scaling['Linear']++;
    else scaling['Unknown']++;
  }
});
Object.entries(scaling).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// === REWARD MECHANISM ===
console.log('\n--- Reward Mechanism ---');
const rewards = { 'Activity Markers': 0, 'Canton Coin': 0, 'Both': 0, 'Unknown': 0 };
data.forEach(a => {
  if (a.usesCantonCoinOrMarkers) {
    const s = a.usesCantonCoinOrMarkers.toLowerCase();
    const hasMarkers = s.includes('marker');
    const hasCC = s.includes('canton coin') || s.includes(' cc ') || s.match(/\bcc\b/);
    if (hasMarkers && hasCC) rewards['Both']++;
    else if (hasMarkers) rewards['Activity Markers']++;
    else if (hasCC) rewards['Canton Coin']++;
    else rewards['Unknown']++;
  }
});
Object.entries(rewards).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// === LAUNCH TIMELINE ===
console.log('\n--- MainNet Launch Timeline ---');
const timeline = { 'Already Live': 0, 'Q1 2026': 0, 'Q2 2026': 0, 'Q3 2026': 0, 'Q4 2026': 0, 'Later': 0 };
data.forEach(a => {
  if (a.mainnetLaunchDate) {
    const s = a.mainnetLaunchDate.toLowerCase();
    if (s.includes('live') || s.includes('already') || s.includes('2025')) timeline['Already Live']++;
    else if (s.includes('jan') || s.includes('feb') || s.includes('mar') || s.includes('q1')) timeline['Q1 2026']++;
    else if (s.includes('apr') || s.includes('may') || s.includes('jun') || s.includes('q2')) timeline['Q2 2026']++;
    else if (s.includes('jul') || s.includes('aug') || s.includes('sep') || s.includes('q3')) timeline['Q3 2026']++;
    else if (s.includes('oct') || s.includes('nov') || s.includes('dec') || s.includes('q4')) timeline['Q4 2026']++;
    else timeline['Later']++;
  }
});
Object.entries(timeline).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// === CATEGORY DETECTION ===
console.log('\n--- App Categories (auto-detected) ---');
const categories = {};
const categoryPatterns = {
  'DeFi/Finance': ['defi', 'lending', 'borrowing', 'yield', 'stablecoin', 'trading', 'swap', 'liquidity', 'treasury', 'finance', 'payment', 'settlement'],
  'Gaming': ['game', 'gaming', 'play', 'nft', 'wager', 'esport'],
  'Data/Analytics': ['data', 'analytics', 'intelligence', 'oracle', 'indexing', 'reporting'],
  'Infrastructure': ['validator', 'node', 'infrastructure', 'bridge', 'interoperability', 'wallet'],
  'Identity/Compliance': ['kyc', 'aml', 'identity', 'compliance', 'verification', 'credential'],
  'RWA/Tokenization': ['rwa', 'tokeniz', 'real-world', 'asset', 'securities', 'equity'],
  'Storage': ['storage', 'ipfs', 'file', 'data storage'],
};

data.forEach(a => {
  const text = [a.applicationSummary, a.description, a.organizationBackground, a.expectedUsers].join(' ').toLowerCase();
  let matched = false;
  for (const [cat, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(p => text.includes(p))) {
      categories[cat] = (categories[cat] || 0) + 1;
      matched = true;
    }
  }
  if (!matched) categories['Other'] = (categories['Other'] || 0) + 1;
});
Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// === TOP KEYWORDS ===
console.log('\n--- Top Keywords (for tagging) ---');
const keywords = {};
const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'is', 'are', 'will', 'be', 'with', 'as', 'by', 'that', 'this', 'from', 'our', 'we', 'it', 'can', 'has', 'have', 'their', 'which', 'also', 'through', 'into', 'more', 'such', 'they', 'each', 'been', 'other', 'would', 'these', 'when', 'what', 'your', 'users', 'user', 'application', 'canton', 'network', 'transaction', 'transactions']);
data.forEach(a => {
  const text = [a.applicationSummary, a.expectedUsers, a.ledgerInteraction].join(' ').toLowerCase();
  const words = text.match(/\b[a-z]{5,}\b/g) || [];
  words.forEach(w => {
    if (!stopWords.has(w)) keywords[w] = (keywords[w] || 0) + 1;
  });
});
const topKeywords = Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('  ' + topKeywords.map(([k, v]) => `${k}(${v})`).join(', '));

// === DAILY TRANSACTIONS ===
console.log('\n--- Daily Transactions per User ---');
const txVolume = { 'Low (1-10)': 0, 'Medium (10-100)': 0, 'High (100+)': 0 };
data.forEach(a => {
  if (a.dailyTransactionsPerUser) {
    const match = a.dailyTransactionsPerUser.match(/\d+/);
    if (match) {
      const n = parseInt(match[0]);
      if (n <= 10) txVolume['Low (1-10)']++;
      else if (n <= 100) txVolume['Medium (10-100)']++;
      else txVolume['High (100+)']++;
    }
  }
});
Object.entries(txVolume).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// === APPS WITH COMPLIANCE CONTROLS ===
console.log('\n--- Bona Fide Controls ---');
const controls = { 'Has KYC/AML': 0, 'Has Rate Limiting': 0, 'Has Whitelisting': 0 };
data.forEach(a => {
  if (a.bonafideControls) {
    const s = a.bonafideControls.toLowerCase();
    if (s.includes('kyc') || s.includes('aml')) controls['Has KYC/AML']++;
    if (s.includes('rate') || s.includes('limit') || s.includes('threshold')) controls['Has Rate Limiting']++;
    if (s.includes('whitelist') || s.includes('permissioned')) controls['Has Whitelisting']++;
  }
});
Object.entries(controls).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// === POTENTIAL COLLABORATIONS ===
console.log('\n--- Potential Collaboration Clusters ---');
const clusters = {
  'Stablecoin Ecosystem': data.filter(a => {
    const text = [a.applicationSummary, a.description].join(' ').toLowerCase();
    return text.includes('stablecoin') || text.includes('usdc') || text.includes('usd');
  }).map(a => a.institutionName || a.organizationName).filter(Boolean).slice(0, 8),

  'DeFi/Lending': data.filter(a => {
    const text = [a.applicationSummary, a.description].join(' ').toLowerCase();
    return text.includes('lending') || text.includes('borrowing') || text.includes('yield');
  }).map(a => a.institutionName || a.organizationName).filter(Boolean).slice(0, 8),

  'RWA/Tokenization': data.filter(a => {
    const text = [a.applicationSummary, a.description].join(' ').toLowerCase();
    return text.includes('tokeniz') || text.includes('rwa') || text.includes('real-world') || text.includes('securities');
  }).map(a => a.institutionName || a.organizationName).filter(Boolean).slice(0, 8),
};

for (const [cluster, apps] of Object.entries(clusters)) {
  if (apps.length > 0) {
    console.log(`\n  ${cluster} (${apps.length} apps):`);
    apps.forEach(a => console.log(`    - ${a}`));
  }
}

console.log('\n' + '='.repeat(60));
