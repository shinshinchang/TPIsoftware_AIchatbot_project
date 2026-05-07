const PLATFORM_HINTS = {
  shopee: '蝦皮',
  momo: 'momo',
  pchome: 'PChome',
  ubereats: 'Uber Eats',
  books: '博客來',
  general: '一般網站'
};

const CATEGORY_HINTS = {
  general: '一般消費',
  online: '線上購物',
  food: '餐飲',
  travel: '旅遊',
  electronics: '3C/電子',
  books: '書籍'
};

let widgetRoot = null;
let widgetState = {
  expanded: false,
  minimized: false,
  checkoutInfo: null,
  recommendation: null,
  visible: false,
  renderedKey: ''
};

function formatMoney(value) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
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
  if (/(uber eats|foodpanda|餐飲|外送|美食|咖啡|飲料)/i.test(text)) return 'food';
  if (/(3c|電子|手機|電腦|耳機|家電|相機)/i.test(text)) return 'electronics';
  if (/(旅遊|旅行|飯店|住宿|機票)/i.test(text)) return 'travel';
  if (/(書|博客來|books|閱讀)/i.test(text)) return 'books';
  if (/(網購|電商|結帳|checkout|shop|購物)/i.test(text)) return 'online';
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

function collectPageText() {
  const candidates = [];
  const selectors = [
    // High priority: checkout total/amount elements
    '[data-testid*="total"]',
    '[data-testid*="price"]',
    '[data-testid*="amount"]',
    '[class*="total"]',
    '[class*="finalPrice"]',
    '[class*="cartTotal"]',
    '[class*="checkoutTotal"]',
    '[id*="total"]',
    '[class*="amount"]',
    '[class*="price"]',
    '[class*="checkout"]',
    '.total',
    '.amount',
    '.price',
    '.summary'
  ];

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((node) => {
      const text = node.textContent?.trim();
      if (text) candidates.push(text.slice(0, 200));
    });
  }

  if (!candidates.length) {
    candidates.push(document.body?.innerText?.slice(0, 5000) || '');
  }

  return candidates.join(' | ');
}

function detectCheckoutInfo() {
  const url = window.location.href;
  const text = `${document.title} ${collectPageText()}`;
  const platform = detectPlatformFromUrl(url);
  const category = detectCategoryFromText(text);
  const amount = detectAmountFromText(text);

  if (!amount && platform === 'general' && category === 'general') {
    return null;
  }

  // Only consider checkout-like pages: require explicit checkout hints in URL or page text
  const checkoutKeywords = /(結帳|結算|去結帳|checkout|付款|付款方式|下單|送出訂單|付款金額|order|cart|checkout)/i;
  const isUrlHint = /checkout|cart|payment|order|pay/i.test(url);
  const isTextHint = checkoutKeywords.test(text);

  const isLikelyCheckout = isUrlHint || isTextHint;

  if (!isLikelyCheckout) {
    // Not a checkout page (avoid popping on product/home pages)
    return null;
  }

  return {
    platform,
    platformLabel: PLATFORM_HINTS[platform] || platform,
    category,
    categoryLabel: CATEGORY_HINTS[category] || category,
    amount,
    source: 'content-script'
  };
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

async function requestRecommendation(checkoutInfo) {
  try {
    return await sendMessage({ type: 'RUN_RECOMMENDATION', checkoutInfo });
  } catch (error) {
    console.error('Failed to analyze checkout page', error);
    return null;
  }
}

function formatCardTitle(card) {
  return `${card?.bankName || card?.bank_name || ''} ${card?.cardName || card?.card_name || ''}`.trim();
}

function ensureWidget() {
  if (widgetRoot) return widgetRoot;

  const host = document.createElement('div');
  host.id = 'ai-credit-card-widget';
  host.style.position = 'fixed';
  host.style.right = '18px';
  host.style.bottom = '18px';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';

  widgetRoot = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);
  return widgetRoot;
}

function renderWidget() {
  const root = ensureWidget();
  const { checkoutInfo, recommendation, expanded, minimized, visible } = widgetState;

  if (!visible || !recommendation?.best) {
    root.innerHTML = '';
    return;
  }

  const best = recommendation.best;
  const ranking = recommendation.ranking || [];
  const topThree = ranking.slice(0, 3);

  if (minimized) {
    root.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: 'Segoe UI Variable Display', 'Trebuchet MS', sans-serif;
        }
        .minimized-btn {
          pointer-events: auto;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(135deg, rgba(245,158,11,0.95), rgba(90,167,255,0.92));
          color: #0f172a;
          font-size: 16px;
          font-weight: 800;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.34);
          cursor: pointer;
        }
      </style>
      <button class="minimized-btn" id="open-widget" title="展開 AI 推薦">AI</button>
    `;

    root.getElementById('open-widget')?.addEventListener('click', () => {
      widgetState.minimized = false;
      renderWidget();
    });

    return;
  }

  root.innerHTML = `
    <style>
      :host {
        all: initial;
        font-family: 'Segoe UI Variable Display', 'Trebuchet MS', sans-serif;
      }
      .shell {
        pointer-events: auto;
        width: ${expanded ? '320px' : '270px'};
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.1);
        background: linear-gradient(180deg, rgba(7,17,31,0.98), rgba(15,23,42,0.92));
        color: #f4f7fb;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
        overflow: hidden;
        backdrop-filter: blur(16px);
      }
      .top {
        padding: 14px 14px 12px;
        background: linear-gradient(135deg, rgba(245,158,11,0.22), rgba(90,167,255,0.08));
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .badge {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: .08em;
        background: rgba(255,255,255,0.08);
        color: rgba(244,247,251,0.84);
      }
      .title {
        margin-top: 10px;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.4;
      }
      .sub {
        margin-top: 4px;
        font-size: 12px;
        color: rgba(226,232,240,0.72);
      }
      .body {
        padding: 12px 14px 14px;
      }
      .metric {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.05);
      }
      .metric-label {
        font-size: 10px;
        letter-spacing: .18em;
        text-transform: uppercase;
        color: rgba(226,232,240,0.68);
      }
      .metric-value {
        font-size: 18px;
        font-weight: 800;
      }
      .button-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 16px;
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .primary {
        background: linear-gradient(135deg, #f59e0b, #ffd166);
        color: #0f172a;
      }
      .secondary {
        background: rgba(255,255,255,0.08);
        color: #f4f7fb;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .ranking {
        margin-top: 12px;
        display: grid;
        gap: 8px;
      }
      .row {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
      }
      .row-top {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: flex-start;
      }
      .row-title {
        font-size: 12px;
        font-weight: 700;
      }
      .row-sub {
        font-size: 11px;
        color: rgba(226,232,240,0.7);
        line-height: 1.45;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 12px;
        font-size: 11px;
        color: rgba(226,232,240,0.72);
      }
      .close {
        width: 30px;
        height: 30px;
        padding: 0;
      }
    </style>
    <div class="shell">
      <div class="top">
        <div class="badge">AI 推薦浮窗 · ${checkoutInfo?.platformLabel || PLATFORM_HINTS[checkoutInfo?.platform] || '未偵測平台'}</div>
        <div class="title">${formatCardTitle(best)}</div>
        <div class="sub">${recommendation.summary || '已依目前購物頁與回饋規則完成比對'}</div>
      </div>
      <div class="body">
        <div class="metric">
          <div class="metric-label">偵測金額</div>
          <div class="metric-value">${formatMoney(checkoutInfo?.amount || 0)}</div>
        </div>
        <div class="metric" style="margin-top: 8px;">
          <div class="metric-label">預估回饋</div>
          <div class="metric-value">${formatMoney(best.reward || 0)}</div>
        </div>
        ${expanded ? `
          <div class="ranking">
            ${topThree.map((item, index) => `
              <div class="row">
                <div class="row-top">
                  <div>
                    <div class="row-title">#${index + 1} ${formatCardTitle(item)}</div>
                    <div class="row-sub">${item.reason || item.description || '符合一般回饋規則'}</div>
                  </div>
                  <div class="row-sub">${formatMoney(item.reward || 0)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="button-row">
          <button class="primary" id="re-run">重新分析</button>
          <button class="secondary" id="toggle-expand">${expanded ? '收合' : '展開詳情'}</button>
        </div>
        <div class="footer">
          <div>${formatPercent(best.rewardRate || best.reward_rate || 0)} 回饋</div>
          <button class="secondary close" id="close-widget">×</button>
        </div>
      </div>
    </div>
  `;

  root.getElementById('toggle-expand')?.addEventListener('click', () => {
    widgetState.expanded = !widgetState.expanded;
    renderWidget();
  });

  root.getElementById('close-widget')?.addEventListener('click', () => {
    widgetState.minimized = true;
    renderWidget();
  });

  root.getElementById('re-run')?.addEventListener('click', async () => {
    const checkout = detectCheckoutInfo();
    if (!checkout) return;

    const recommendation = await requestRecommendation(checkout);
    if (!recommendation?.best) return;

    widgetState.checkoutInfo = checkout;
    widgetState.recommendation = recommendation;
    widgetState.visible = true;
    widgetState.minimized = false;
    renderWidget();
  });
}

async function updateOverlay() {
  const checkoutInfo = detectCheckoutInfo();

  if (!checkoutInfo) {
    widgetState.visible = false;
    renderWidget();
    return;
  }

  const key = `${checkoutInfo.platform}-${checkoutInfo.category}-${checkoutInfo.amount || 0}`;
  if (widgetState.renderedKey === key) {
    return;
  }

  widgetState.renderedKey = key;
  widgetState.checkoutInfo = checkoutInfo;
  await sendMessage({ type: 'CHECKOUT_INFO_UPDATED', checkoutInfo });

  const recommendation = await requestRecommendation(checkoutInfo);
  if (!recommendation?.best) {
    widgetState.visible = false;
    renderWidget();
    return;
  }

  widgetState.recommendation = recommendation;
  widgetState.visible = true;
  // Keep minimized state so users can collapse the widget and reopen manually.
  widgetState.expanded = false;
  renderWidget();
}

function bootObservers() {
  let timer = null;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      updateOverlay().catch(() => {});
    }, 450);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener('popstate', schedule);
  window.addEventListener('pushstate', schedule);
  window.addEventListener('replacestate', schedule);
  schedule();
}

function patchHistory() {
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = pushState.apply(this, args);
    window.dispatchEvent(new Event('pushstate'));
    return result;
  };

  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args);
    window.dispatchEvent(new Event('replacestate'));
    return result;
  };
}

function initialize() {
  patchHistory();
  bootObservers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_CHECKOUT_INFO') {
    const checkoutInfo = detectCheckoutInfo();
    if (checkoutInfo) {
      widgetState.checkoutInfo = checkoutInfo;
    }

    sendResponse({ checkoutInfo });
  }

  return true;
});
