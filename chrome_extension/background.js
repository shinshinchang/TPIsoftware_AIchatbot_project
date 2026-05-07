const STORAGE_KEYS = {
  theme: 'aiDecisionTheme',
  userState: 'aiDecisionUserState',
  cards: 'aiDecisionCards',
  savedRecommendations: 'aiDecisionSavedRecommendations',
  lastCheckoutInfo: 'aiDecisionLastCheckoutInfo',
  version: 'aiDecisionVersion'
};

const CURRENT_VERSION = 'v2';

const DEFAULT_USER_STATE = {
  isLoggedIn: false,
  name: '訪客',
  email: '',
  provider: 'trial'
};

const DEFAULT_THEME = 'dark';

const DEFAULT_CARDS = [
  {
    id: 'fallback-1',
    bankName: '玉山銀行',
    cardName: '玉山 Pi 拍錢包信用卡',
    rewardType: '現金回饋',
    rewardRate: 0.05,
    maxReward: 300,
    minSpend: 100,
    platforms: ['shopee', 'online'],
    categories: ['online', 'general'],
    description: '蝦皮與線上消費的高回饋選擇',
    accent: '#f59e0b',
    active: true
  },
  {
    id: 'fallback-2',
    bankName: '台新銀行',
    cardName: '台新玫瑰卡',
    rewardType: '現金回饋',
    rewardRate: 0.04,
    maxReward: 200,
    minSpend: 0,
    platforms: ['momo', 'online'],
    categories: ['online', 'general'],
    description: 'momo、網購日常採買的穩定回饋',
    accent: '#5aa7ff',
    active: true
  },
  {
    id: 'fallback-3',
    bankName: '國泰世華',
    cardName: 'CUBE 卡',
    rewardType: '點數回饋',
    rewardRate: 0.033,
    maxReward: 250,
    minSpend: 0,
    platforms: ['pchome', 'online'],
    categories: ['online', 'general'],
    description: '適合 PChome 與日常線上結帳',
    accent: '#7cdb7c',
    active: true
  },
  {
    id: 'fallback-4',
    bankName: '台北富邦',
    cardName: 'J 卡',
    rewardType: '現金回饋',
    rewardRate: 0.08,
    maxReward: 150,
    minSpend: 0,
    platforms: ['ubereats'],
    categories: ['food'],
    description: '餐飲、外送的強力回饋卡',
    accent: '#ff8a5c',
    active: true
  },
  {
    id: 'fallback-5',
    bankName: '永豐銀行',
    cardName: 'DAWHO 現金回饋卡',
    rewardType: '現金回饋',
    rewardRate: 0.02,
    maxReward: 500,
    minSpend: 0,
    platforms: ['general'],
    categories: ['general'],
    description: '沒有特定平台時的萬用備案',
    accent: '#a78bfa',
    active: true
  }
];

const PLATFORM_LABELS = {
  shopee: '蝦皮',
  momo: 'momo',
  pchome: 'PChome',
  ubereats: 'Uber Eats',
  books: '博客來',
  general: '一般網站'
};

const CATEGORY_LABELS = {
  general: '一般消費',
  online: '線上購物',
  food: '餐飲',
  travel: '旅遊',
  electronics: '3C/電子',
  books: '書籍'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

async function getState() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.theme,
    STORAGE_KEYS.userState,
    STORAGE_KEYS.cards,
    STORAGE_KEYS.savedRecommendations,
    STORAGE_KEYS.lastCheckoutInfo
  ]);

  return {
    theme: data[STORAGE_KEYS.theme] || DEFAULT_THEME,
    userState: data[STORAGE_KEYS.userState] || clone(DEFAULT_USER_STATE),
    cards: Array.isArray(data[STORAGE_KEYS.cards]) && data[STORAGE_KEYS.cards].length ? data[STORAGE_KEYS.cards] : clone(DEFAULT_CARDS),
    savedRecommendations: Array.isArray(data[STORAGE_KEYS.savedRecommendations]) ? data[STORAGE_KEYS.savedRecommendations] : [],
    lastCheckoutInfo: data[STORAGE_KEYS.lastCheckoutInfo] || null
  };
}

async function ensureDefaults() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.theme,
    STORAGE_KEYS.userState,
    STORAGE_KEYS.cards,
    STORAGE_KEYS.savedRecommendations,
    STORAGE_KEYS.version
  ]);

  const patch = {};

  if (!data[STORAGE_KEYS.theme]) {
    patch[STORAGE_KEYS.theme] = DEFAULT_THEME;
  }

  if (!data[STORAGE_KEYS.userState]) {
    patch[STORAGE_KEYS.userState] = clone(DEFAULT_USER_STATE);
  }

  if (!Array.isArray(data[STORAGE_KEYS.cards]) || !data[STORAGE_KEYS.cards].length) {
    patch[STORAGE_KEYS.cards] = clone(DEFAULT_CARDS);
  }

  if (!Array.isArray(data[STORAGE_KEYS.savedRecommendations])) {
    patch[STORAGE_KEYS.savedRecommendations] = [];
  }

  if (Object.keys(patch).length) {
    await chrome.storage.local.set(patch);
  }
}

async function ensureVersionedDefaults() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.version]);
  const storedVersion = data[STORAGE_KEYS.version] || null;

  if (storedVersion !== CURRENT_VERSION) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.cards]: clone(DEFAULT_CARDS),
      [STORAGE_KEYS.version]: CURRENT_VERSION
    });
  }
}

(async () => {
  try {
    await ensureDefaults();
    await ensureVersionedDefaults();
  } catch (e) {
    // ignore
  }
})();

function normalizePlatforms(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : ['general'];
}

function normalizeCategories(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : ['general'];
}

function detectPlatformFromUrl(url = '') {
  const normalized = String(url).toLowerCase();
  if (normalized.includes('shopee')) return 'shopee';
  if (normalized.includes('momo')) return 'momo';
  if (normalized.includes('pchome')) return 'pchome';
  if (normalized.includes('ubereats')) return 'ubereats';
  if (normalized.includes('books')) return 'books';
  return 'general';
}

function detectCategoryFromText(text = '') {
  const normalized = String(text).toLowerCase();
  if (/(uber eats|foodpanda|餐飲|外送|美食|咖啡|飲料)/i.test(normalized)) return 'food';
  if (/(3c|電子|手機|電腦|耳機|家電|相機|notebook)/i.test(normalized)) return 'electronics';
  if (/(旅遊|旅行|飯店|住宿|機票|hotel|flight)/i.test(normalized)) return 'travel';
  if (/(書|博客來|books|閱讀)/i.test(normalized)) return 'books';
  if (/(網購|電商|結帳|checkout|shop|購物)/i.test(normalized)) return 'online';
  return 'general';
}

function detectAmountFromText(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ');
  
  // Layer 1: Extract amounts that appear near amount-related keywords
  const amountKeywords = /(總付款金額|總金額|結帳金額|應付金額|訂單金額|合計|消費金額|實付|結帳總額)\s*[\$:：]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  const keywordMatches = [];
  for (const match of normalized.matchAll(amountKeywords)) {
    const value = Number(String(match[2]).replaceAll(',', ''));
    if (Number.isFinite(value) && value > 0 && value < 1000000) {
      keywordMatches.push(value);
    }
  }
  if (keywordMatches.length) {
    return keywordMatches.sort((a, b) => b - a)[0];
  }

  // Layer 2: Extract all amounts, prioritize those with $ prefix
  const candidates = [];
  const amountPattern = /(?:\$|nt\$|twd|ntd|新台幣|元)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;

  for (const match of normalized.matchAll(amountPattern)) {
    const raw = match[0] || '';
    const value = Number(String(match[1]).replaceAll(',', ''));
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) continue;

    const hasDollarSign = /\$/.test(raw);
    const hasCurrency = /元|nt\$|twd|ntd|新台幣|€|¥/.test(raw);
    candidates.push({ value, hasDollarSign, hasCurrency });
  }

  if (!candidates.length) return null;

  // Prefer amounts with $ sign
  const dollarCandidates = candidates.filter((c) => c.hasDollarSign).map((c) => c.value);
  if (dollarCandidates.length) {
    return dollarCandidates.sort((a, b) => b - a)[0];
  }

  // Then prefer amounts with other currency markers
  const currencyCandidates = candidates.filter((c) => c.hasCurrency).map((c) => c.value);
  if (currencyCandidates.length) {
    return currencyCandidates.sort((a, b) => b - a)[0];
  }

  // Finally, choose largest reasonable checkout amount (50-100,000 range)
  const checkoutRange = candidates
    .map((c) => c.value)
    .filter((v) => v >= 50 && v <= 100000)
    .sort((a, b) => b - a);
  
  if (checkoutRange.length) return checkoutRange[0];

  return null;
}

function calculateReward(card, amount) {
  if (Number(amount) < Number(card.minSpend || 0)) {
    return 0;
  }
  let reward = Number(amount) * Number(card.rewardRate || 0);
  if (card.maxReward != null && card.maxReward !== '') {
    reward = Math.min(reward, Number(card.maxReward));
  }
  return Math.round(reward * 100) / 100;
}

function matchesValue(list, value) {
  const normalizedList = normalizePlatforms(list);
  return normalizedList.includes(value) || normalizedList.includes('general') || normalizedList.includes('all');
}

function recommendCheckout(cards, checkoutInfo) {
  const amount = Number(checkoutInfo?.amount || 0);
  const platform = checkoutInfo?.platform || 'general';
  const category = checkoutInfo?.category || 'general';

  const ranking = cards
    .filter((card) => card.active !== false)
    .map((card) => {
      const platforms = normalizePlatforms(card.platforms);
      const categories = normalizeCategories(card.categories);
      const platformMatch = matchesValue(platforms, platform);
      const categoryMatch = matchesValue(categories, category);
      const reward = calculateReward(card, amount);
      const finalCost = Math.max(0, Math.round((amount - reward) * 100) / 100);

      const reasons = [];
      if (platformMatch) reasons.push(`${PLATFORM_LABELS[platform] || platform} 命中`);
      if (categoryMatch) reasons.push(`${CATEGORY_LABELS[category] || category} 命中`);
      if (Number(amount) < Number(card.minSpend || 0)) reasons.push(`未達最低消費 ${formatMoney(card.minSpend)}`);
      if (card.maxReward) reasons.push(`回饋上限 ${formatMoney(card.maxReward)}`);

      const score = reward + (platformMatch ? amount * 0.02 : 0) + (categoryMatch ? amount * 0.01 : 0);

      return {
        cardId: card.id,
        bankName: card.bankName,
        cardName: card.cardName,
        rewardType: card.rewardType,
        rewardRate: card.rewardRate,
        maxReward: card.maxReward,
        minSpend: card.minSpend,
        platforms,
        categories,
        reward,
        finalCost,
        score: Math.round(score * 100) / 100,
        reason: reasons.length ? reasons.join(' · ') : '一般消費可使用',
        description: card.description,
        accent: card.accent
      };
    })
    .sort((left, right) => right.score - left.score || right.reward - left.reward);

  const best = ranking[0] || null;
  const estimatedReward = best?.reward || 0;
  const recommendationReason = best
    ? `目前最適合的是 ${best.bankName} ${best.cardName}，預估可拿到 ${formatMoney(estimatedReward)} 回饋。`
    : '目前沒有可用的信用卡規則。';

  return {
    amount,
    platform,
    category,
    checkoutInfo,
    best,
    ranking,
    summary: recommendationReason,
    analysis: {
      detectedPlatform: PLATFORM_LABELS[platform] || platform,
      detectedCategory: CATEGORY_LABELS[category] || category,
      detectedAmount: formatMoney(amount),
      cardCount: ranking.length
    }
  };
}

function inferContextFromMessage(message, currentInfo = {}) {
  const text = String(message || '');
  const amount = detectAmountFromText(text) || Number(currentInfo.amount || 0);
  const platform = detectPlatformFromUrl(text) !== 'general' ? detectPlatformFromUrl(text) : currentInfo.platform || 'general';
  const category = detectCategoryFromText(text) || currentInfo.category || 'general';

  return {
    amount,
    platform,
    platformLabel: PLATFORM_LABELS[platform] || platform,
    category,
    categoryLabel: CATEGORY_LABELS[category] || category,
    source: 'chat'
  };
}

function buildChatAnswer(message, recommendation, checkoutInfo) {
  const parts = [];

  if (checkoutInfo?.platform && checkoutInfo.platform !== 'general') {
    parts.push(`你提到的 ${PLATFORM_LABELS[checkoutInfo.platform] || checkoutInfo.platform} 情境已加入分析。`);
  }

  if (checkoutInfo?.amount) {
    parts.push(`這筆消費金額約 ${formatMoney(checkoutInfo.amount)}。`);
  }

  if (recommendation?.best) {
    parts.push(`目前最推薦 ${recommendation.best.bankName} ${recommendation.best.cardName}，預估回饋 ${formatMoney(recommendation.best.reward)}。`);
  }

  if (!parts.length) {
    parts.push('我已用目前持有的信用卡規則幫你做初步比對。');
  }

  parts.push(`我也會依照你補充的關鍵字「${String(message || '').slice(0, 30)}」持續調整分析。`);

  return parts.join(' ');
}

chrome.runtime.onInstalled.addListener(() => {
  (async () => {
    try {
      await ensureDefaults();
      await ensureVersionedDefaults();
    } catch (e) {
      // ignore
    }
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await ensureDefaults();

    switch (message?.type) {
      case 'GET_STATE': {
        return getState();
      }

      case 'SAVE_THEME': {
        await chrome.storage.local.set({ [STORAGE_KEYS.theme]: message.theme || DEFAULT_THEME });
        return getState();
      }

      case 'SAVE_AUTH': {
        await chrome.storage.local.set({ [STORAGE_KEYS.userState]: message.userState || clone(DEFAULT_USER_STATE) });
        return getState();
      }

      case 'SAVE_CARDS': {
        await chrome.storage.local.set({ [STORAGE_KEYS.cards]: Array.isArray(message.cards) ? message.cards : [] });
        return getState();
      }

      case 'SAVE_RECOMMENDATION': {
        const state = await getState();
        const nextSaved = [
          {
            ...message.recommendation,
            timestamp: Date.now()
          },
          ...state.savedRecommendations
        ].slice(0, 20);

        await chrome.storage.local.set({ [STORAGE_KEYS.savedRecommendations]: nextSaved });
        return { savedRecommendations: nextSaved };
      }

      case 'CHECKOUT_INFO_UPDATED': {
        await chrome.storage.local.set({ [STORAGE_KEYS.lastCheckoutInfo]: message.checkoutInfo || null });
        return { ok: true };
      }

      case 'GET_LAST_CHECKOUT_INFO': {
        const data = await chrome.storage.local.get([STORAGE_KEYS.lastCheckoutInfo]);
        return { checkoutInfo: data[STORAGE_KEYS.lastCheckoutInfo] || null };
      }

      case 'RUN_RECOMMENDATION': {
        const state = await getState();
        const checkoutInfo = message.checkoutInfo || state.lastCheckoutInfo || { platform: 'general', category: 'general', amount: 0 };
        // Use provided cards or fall back to stored cards
        const cardsToUse = Array.isArray(message.cardsToUse) && message.cardsToUse.length > 0 ? message.cardsToUse : state.cards;
        const recommendation = recommendCheckout(cardsToUse, checkoutInfo);

        await chrome.storage.local.set({ [STORAGE_KEYS.lastCheckoutInfo]: checkoutInfo });

        return recommendation;
      }

      case 'CHAT_QUERY': {
        const state = await getState();
        const checkoutInfo = inferContextFromMessage(message.message, message.currentInfo || state.lastCheckoutInfo || {});
        const recommendation = recommendCheckout(state.cards, checkoutInfo);

        return {
          answer: buildChatAnswer(message.message, recommendation, checkoutInfo),
          checkoutInfo,
          recommendation
        };
      }

      default:
        return { ok: true };
    }
  })()
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ error: error.message || 'Unknown error' }));

  return true;
});
