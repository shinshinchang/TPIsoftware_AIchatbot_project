import { useEffect, useMemo, useState } from 'react';

const VIEW = {
  dashboard: 'dashboard',
  auth: 'auth',
  cards: 'cards',
  chat: 'chat',
  analysis: 'analysis',
  results: 'results'
};

const FALLBACK_CHECKOUT = {
  amount: 0,
  platform: 'general',
  platformLabel: '一般網站',
  category: 'general',
  categoryLabel: '一般消費',
  source: 'fallback'
};

const INITIAL_CHAT = [
  {
    role: 'assistant',
    content: '把平台、品項或結帳金額告訴我，我會幫你比對目前信用卡回饋。'
  }
];

function money(value) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function platformLabel(value) {
  const labels = {
    shopee: '蝦皮',
    momo: 'momo',
    pchome: 'PChome',
    ubereats: 'Uber Eats',
    books: '博客來',
    general: '一般網站'
  };

  return labels[value] || value || '未偵測';
}

function categoryLabel(value) {
  const labels = {
    general: '一般消費',
    online: '線上購物',
    food: '餐飲',
    travel: '旅遊',
    electronics: '3C/電子',
    books: '書籍'
  };

  return labels[value] || value || '未分類';
}

function parsePlatformTags(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function buildCardDraft(card = null) {
  return {
    id: card?.id || `card-${Date.now()}`,
    bankName: card?.bankName || '',
    cardName: card?.cardName || '',
    rewardType: card?.rewardType || '現金回饋',
    rewardRate: card?.rewardRate ?? 0.02,
    maxReward: card?.maxReward ?? '',
    minSpend: card?.minSpend ?? 0,
    platforms: card?.platforms?.join(', ') || 'general',
    categories: card?.categories?.join(', ') || 'general',
    description: card?.description || '',
    accent: card?.accent || '#f59e0b',
    active: card?.active ?? true
  };
}

function createFallbackCards() {
  return [
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

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function Section({ title, subtitle, action, children }) {
  return (
    <section className="panel-strong p-4 shadow-glow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--text)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="panel border p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[color:var(--text)]">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-[color:var(--muted)]">{hint}</div> : null}
    </div>
  );
}

function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-white/6 text-[color:var(--muted)]',
    accent: 'bg-amber-400/15 text-amber-200',
    info: 'bg-sky-400/15 text-sky-200',
    success: 'bg-emerald-400/15 text-emerald-200'
  };

  return <span className={`chip ${tones[tone] || tones.neutral}`}>{children}</span>;
}

function PrimaryAction({ children, onClick, className = '', type = 'button' }) {
  return (
    <button type={type} className={`primary-btn ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}

function SecondaryAction({ children, onClick, className = '', type = 'button' }) {
  return (
    <button type={type} className={`secondary-btn ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Input(props) {
  return <input {...props} className={`glass-input ${props.className || ''}`.trim()} />;
}

function Textarea(props) {
  return <textarea {...props} className={`glass-input min-h-[96px] ${props.className || ''}`.trim()} />;
}

export default function App() {
  const [view, setView] = useState(VIEW.dashboard);
  const [theme, setTheme] = useState('dark');
  const [appState, setAppState] = useState({
    userState: { isLoggedIn: false, name: '訪客', email: '', provider: 'trial' },
    cards: [],
    savedRecommendations: [],
    lastCheckoutInfo: null,
    theme: 'dark'
  });
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [analysisState, setAnalysisState] = useState('idle');
  const [loadingMessage, setLoadingMessage] = useState('AI 正在分析目前購物網站、商品類別與信用卡回饋...');
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  const [chatTyping, setChatTyping] = useState(false);
  const [cardDraft, setCardDraft] = useState(null);
  const [cardMode, setCardMode] = useState('new');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [statusText, setStatusText] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [showCardFilter, setShowCardFilter] = useState(false);
  const cards = useMemo(() => ensureArray(appState.cards).filter(Boolean), [appState.cards]);
  const topSavedResults = ensureArray(appState.savedRecommendations).slice(0, 3);
  const isLoggedIn = Boolean(appState.userState?.isLoggedIn);
  const currentCheckout = checkoutInfo || FALLBACK_CHECKOUT;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    hydrateState();
  }, []);

  useEffect(() => {
    if (appState.theme && appState.theme !== theme) {
      setTheme(appState.theme);
    }
  }, [appState.theme]);

  useEffect(() => {
    if (!statusText) return;

    const timer = window.setTimeout(() => setStatusText(''), 1800);
    return () => window.clearTimeout(timer);
  }, [statusText]);

  async function hydrateState() {
    try {
      const state = await sendMessage({ type: 'GET_STATE' });
      if (state) {
        setAppState(state);
        if (state.theme) {
          setTheme(state.theme);
        }
        if (state.lastCheckoutInfo) {
          setCheckoutInfo(state.lastCheckoutInfo);
        }
      }
    } catch {
      setAppState((current) => ({
        ...current,
        cards: createFallbackCards(),
        userState: { isLoggedIn: false, name: '訪客', email: '', provider: 'trial' }
      }));
    }
  }

  async function refreshCheckoutInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return null;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CHECKOUT_INFO' });
      if (response?.checkoutInfo) {
        setCheckoutInfo(response.checkoutInfo);
        return response.checkoutInfo;
      }
    } catch {
      return null;
    }

    return null;
  }

  async function runRecommendation(source = 'dashboard') {
    if (selectedCardIds.size === 0) {
      setStatusText('請先選擇要比較的卡片');
      return;
    }

    setView(VIEW.analysis);
    setAnalysisState('running');
    setLoadingMessage(source === 'chat' ? 'AI 正在根據你補充的情境重新比對...' : 'AI 正在分析目前購物網站、商品類別與信用卡回饋...');

    const detected = (await refreshCheckoutInfo()) || currentCheckout;
    const payload = detected?.amount ? detected : { ...FALLBACK_CHECKOUT, amount: 0 };

    // Filter cards to only include selected ones
    const selectedCards = cards.filter((card) => selectedCardIds.has(card.id));

    try {
      const result = await sendMessage({ type: 'RUN_RECOMMENDATION', checkoutInfo: payload, cardsToUse: selectedCards });
      if (result?.checkoutInfo) {
        setCheckoutInfo(result.checkoutInfo);
      }
      setRecommendation(result);
      setAnalysisState('done');
      setView(VIEW.results);
      setStatusText('推薦結果已更新');
    } catch (error) {
      setAnalysisState('error');
      setStatusText(error.message || '分析失敗');
      setView(VIEW.dashboard);
    }
  }

  async function handleChatSend() {
    const message = chatInput.trim();
    if (!message) return;

    const userBubble = { role: 'user', content: message };
    setChatMessages((current) => [...current, userBubble]);
    setChatInput('');
    setChatTyping(true);

    try {
      const response = await sendMessage({
        type: 'CHAT_QUERY',
        message,
        currentInfo: currentCheckout
      });

      if (response?.recommendation) {
        setRecommendation(response.recommendation);
      }
      if (response?.checkoutInfo) {
        setCheckoutInfo(response.checkoutInfo);
      }

      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response?.answer || '我已經幫你整理好了，現在可以直接看推薦結果。'
        }
      ]);
      setStatusText('已根據聊天內容補充分析');
    } catch {
      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: '我先使用目前偵測到的資料進行推薦，若要更精準，可以補充平台或消費類別。'
        }
      ]);
    } finally {
      setChatTyping(false);
    }
  }

  async function handleThemeToggle() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    await sendMessage({ type: 'SAVE_THEME', theme: nextTheme });
    setStatusText(nextTheme === 'dark' ? '已切換深色模式' : '已切換亮色模式');
  }

  async function handleAuthSubmit() {
    const userState = {
      isLoggedIn: true,
      name: authForm.name || (authMode === 'login' ? '已登入使用者' : '新會員'),
      email: authForm.email,
      provider: 'email'
    };

    await sendMessage({ type: 'SAVE_AUTH', userState });
    await hydrateState();
    setView(VIEW.dashboard);
    setStatusText('登入狀態已更新');
  }

  async function handleGoogleLogin() {
    const userState = {
      isLoggedIn: true,
      name: 'Google 使用者',
      email: 'google-user@example.com',
      provider: 'google'
    };

    await sendMessage({ type: 'SAVE_AUTH', userState });
    await hydrateState();
    setView(VIEW.dashboard);
    setStatusText('已使用 Google 登入');
  }

  async function handleCardSave() {
    const nextCard = {
      ...cardDraft,
      rewardRate: Number(cardDraft.rewardRate || 0),
      minSpend: Number(cardDraft.minSpend || 0),
      maxReward: cardDraft.maxReward === '' ? null : Number(cardDraft.maxReward),
      platforms: parsePlatformTags(cardDraft.platforms),
      categories: parsePlatformTags(cardDraft.categories)
    };

    const nextCards = cardMode === 'edit'
      ? cards.map((card) => (card.id === nextCard.id ? nextCard : card))
      : [...cards, nextCard];

    await sendMessage({ type: 'SAVE_CARDS', cards: nextCards });
    await hydrateState();
    setCardDraft(null);
    setStatusText(cardMode === 'edit' ? '信用卡資料已更新' : '已新增信用卡');
  }

  async function handleCardDelete(cardId) {
    const nextCards = cards.filter((card) => card.id !== cardId);
    await sendMessage({ type: 'SAVE_CARDS', cards: nextCards });
    await hydrateState();
    setStatusText('已刪除信用卡');
  }

  async function handleSaveRecommendation() {
    if (!recommendation) return;
    await sendMessage({ type: 'SAVE_RECOMMENDATION', recommendation });
    await hydrateState();
    setStatusText('推薦結果已儲存');
  }

  function openNewCard() {
    setCardMode('new');
    setCardDraft(buildCardDraft());
  }

  function openEditCard(card) {
    setCardMode('edit');
    setCardDraft(buildCardDraft(card));
  }

  function openAuth(mode) {
    setAuthMode(mode);
    setView(VIEW.auth);
  }

  const recommendationRank = recommendation?.ranking || [];
  const bestCard = recommendation?.best || recommendationRank[0] || null;

  const navItems = [
    { key: VIEW.dashboard, label: '首頁' },
    { key: VIEW.chat, label: 'Chatbot' },
    { key: VIEW.cards, label: '卡片管理' },
    { key: VIEW.auth, label: '登入' }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden px-3 py-3 text-[color:var(--text)]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-30px] top-[-25px] h-32 w-32 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute bottom-[-10px] right-[-20px] h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
      </div>

      <header className="panel-strong relative z-10 mb-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 via-indigo-500 to-amber-400 text-lg font-black text-white shadow-glow">
              AI
              <div className="absolute inset-0 rounded-3xl ring-1 ring-white/20" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--muted)]">AI 消費決策層</div>
              <h1 className="mt-1 text-lg font-semibold leading-tight">Chrome Extension 信用卡推薦器</h1>
              <div className="mt-1 text-xs text-[color:var(--muted)]">在購物頁自動辨識平台、金額與最划算卡片</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleThemeToggle}
            className="secondary-btn h-10 w-10 rounded-2xl p-0"
            aria-label="切換主題"
          >
            {theme === 'dark' ? '☾' : '☼'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone={isLoggedIn ? 'success' : 'accent'}>{isLoggedIn ? `已登入 · ${appState.userState?.name || '使用者'}` : '試用模式'}</Pill>
          <Pill tone="info">{platformLabel(currentCheckout.platform)}</Pill>
          <Pill>{money(currentCheckout.amount || 0)}</Pill>
          <Pill>{categoryLabel(currentCheckout.category)}</Pill>
        </div>

        {statusText ? (
          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            {statusText}
          </div>
        ) : null}
      </header>

      <nav className="panel relative z-10 mb-3 flex items-center justify-between gap-2 p-2">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={`nav-btn flex-1 ${view === item.key ? 'nav-btn-active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="relative z-10 space-y-3 pb-4">
        {view === VIEW.dashboard ? (
          <>
            <Section
              title="選擇卡片"
              subtitle="先選擇你想要進行比較的信用卡，才能看到推薦結果。"
            >
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowCardFilter(!showCardFilter)}
                  className="secondary-btn w-full rounded-2xl px-4 py-3 text-sm font-semibold text-left flex items-center justify-between"
                >
                  <span>{selectedCardIds.size > 0 ? `已選擇 ${selectedCardIds.size} 張卡片` : '點擊選擇卡片'}</span>
                  <span>{showCardFilter ? '▼' : '▶'}</span>
                </button>

                {showCardFilter ? (
                  <div className="space-y-2 rounded-2xl border border-white/8 bg-white/5 p-3">
                    {cards.length > 0 ? (
                      cards.map((card) => (
                        <label key={card.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/8 transition">
                          <input
                            type="checkbox"
                            checked={selectedCardIds.has(card.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedCardIds);
                              if (e.target.checked) {
                                newSelected.add(card.id);
                              } else {
                                newSelected.delete(card.id);
                              }
                              setSelectedCardIds(newSelected);
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1 text-sm">
                            <div className="font-semibold text-[color:var(--text)]">{card.bankName} · {card.cardName}</div>
                            <div className="text-xs text-[color:var(--muted)]">{percent(card.rewardRate || 0)} 回饋</div>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="text-xs text-[color:var(--muted)] p-2">暫無可用卡片，請先在「卡片管理」中新增</div>
                    )}
                  </div>
                ) : null}

                {selectedCardIds.size > 0 && (
                  <div className="text-xs text-[color:var(--muted)] p-2 rounded-lg bg-white/5">
                    ✓ 已選擇 {selectedCardIds.size} 張卡片，可以開始推薦
                  </div>
                )}
              </div>
            </Section>

            <Section
              title="快速掌握"
              subtitle="先確認目前頁面，再快速啟動推薦或補充情境。"
              action={
                <SecondaryAction onClick={() => setView(VIEW.analysis)}>查看分析</SecondaryAction>
              }
            >
              <div className="card-grid">
                <Metric label="偵測平台" value={platformLabel(currentCheckout.platform)} hint={currentCheckout.source === 'fallback' ? '尚未從頁面擷取到資訊' : '來自目前購物頁'} />
                <Metric label="結帳金額" value={money(currentCheckout.amount || 0)} hint="可由 content script 自動更新" />
                <Metric label="商品類別" value={categoryLabel(currentCheckout.category)} hint="可由 chatbot 補充" />
                <Metric label="持有卡片" value={cards.length} hint="本地模擬卡庫" />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <PrimaryAction onClick={() => runRecommendation('dashboard')}>快速推薦</PrimaryAction>
                <SecondaryAction onClick={() => setView(VIEW.chat)}>進入 chatbot</SecondaryAction>
                <SecondaryAction onClick={() => setView(VIEW.cards)}>卡片管理</SecondaryAction>
                <SecondaryAction onClick={() => openAuth('login')}>登入 / 註冊</SecondaryAction>
              </div>
            </Section>

            <Section title="AI 推薦預覽" subtitle="根據目前偵測的資料，先看看最有可能命中的卡片。">
              {selectedCardIds.size === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/12 bg-white/4 p-4 text-sm text-[color:var(--muted)]">
                  請先在上方選擇卡片才能看到推薦結果。
                </div>
              ) : bestCard ? (
                <div className="space-y-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">最佳推薦</div>
                        <div className="mt-2 text-lg font-semibold">{bestCard.bankName} · {bestCard.cardName}</div>
                        <div className="mt-1 text-sm text-[color:var(--muted)]">{bestCard.description}</div>
                      </div>
                      <div className="rounded-2xl bg-amber-400/15 px-3 py-2 text-right">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-100/80">預估回饋</div>
                        <div className="mt-1 text-lg font-semibold text-amber-100">{money(bestCard.reward || 0)}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-[color:var(--muted)]">
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-3">回饋率<br /><span className="mt-1 block text-base font-semibold text-[color:var(--text)]">{percent(bestCard.reward_rate || bestCard.rewardRate || 0)}</span></div>
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-3">結帳成本<br /><span className="mt-1 block text-base font-semibold text-[color:var(--text)]">{money(bestCard.final_cost || bestCard.finalCost || currentCheckout.amount || 0)}</span></div>
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-3">信心<br /><span className="mt-1 block text-base font-semibold text-[color:var(--text)]">{Math.round((bestCard.score || 0) * 10) / 10}</span></div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <PrimaryAction onClick={() => runRecommendation('dashboard')}>重新分析</PrimaryAction>
                    <SecondaryAction onClick={handleSaveRecommendation}>儲存推薦結果</SecondaryAction>
                    <SecondaryAction onClick={() => setView(VIEW.results)}>查看完整排行</SecondaryAction>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/12 bg-white/4 p-4 text-sm text-[color:var(--muted)]">
                  尚未產生推薦結果，點擊快速推薦即可開始比對。
                </div>
              )}
            </Section>

            {topSavedResults.length ? (
              <Section title="最近儲存的推薦" subtitle="試用模式也能瀏覽歷史記錄。">
                <div className="space-y-2">
                  {topSavedResults.map((item, index) => (
                    <div key={`${item.timestamp || index}`} className="rounded-2xl border border-white/8 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{item.best?.bankName || item.best?.bank_name || '推薦結果'}</div>
                          <div className="text-xs text-[color:var(--muted)]">{item.best?.cardName || item.best?.card_name || '卡片建議'}</div>
                        </div>
                        <div className="text-right text-xs text-[color:var(--muted)]">
                          <div>{money(item.best?.reward || 0)}</div>
                          <div>{platformLabel(item.checkoutInfo?.platform || item.platform)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        ) : null}

        {view === VIEW.auth ? (
          <Section
            title={authMode === 'login' ? '登入' : '註冊'}
            subtitle="試用可直接使用；登入後可以同步卡片與推薦紀錄。"
            action={<SecondaryAction onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>切換 {authMode === 'login' ? '註冊' : '登入'}</SecondaryAction>}
          >
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={handleGoogleLogin} className="secondary-btn rounded-2xl px-4 py-3 text-sm font-semibold">
                  使用 Google 登入
                </button>
                <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-xs text-[color:var(--muted)]">
                  {isLoggedIn ? `目前帳號：${appState.userState?.email || appState.userState?.name}` : '試用模式已啟用，可直接分析購物頁。'}
                </div>
              </div>

              <div className="grid gap-3">
                {authMode === 'register' ? (
                  <Input
                    placeholder="姓名"
                    value={authForm.name}
                    onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
                  />
                ) : null}
                <Input
                  placeholder="Email"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                />
                <Input
                  placeholder="Password"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <PrimaryAction onClick={handleAuthSubmit}>{authMode === 'login' ? '登入' : '建立帳號'}</PrimaryAction>
                <SecondaryAction onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>切換模式</SecondaryAction>
              </div>
            </div>
          </Section>
        ) : null}

        {view === VIEW.cards ? (
          <Section
            title="信用卡管理"
            subtitle="新增、編輯或刪除你要參與推薦比對的卡片。"
            action={<PrimaryAction onClick={openNewCard}>新增信用卡</PrimaryAction>}
          >
            {cardDraft ? (
              <div className="mb-4 space-y-3 rounded-[24px] border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{cardMode === 'edit' ? '編輯卡片' : '新增卡片'}</div>
                    <div className="text-xs text-[color:var(--muted)]">填入平台與回饋規則，AI 會用它來比對結帳情境。</div>
                  </div>
                  <SecondaryAction onClick={() => setCardDraft(null)}>取消</SecondaryAction>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="銀行" value={cardDraft.bankName} onChange={(event) => setCardDraft((current) => ({ ...current, bankName: event.target.value }))} />
                  <Input placeholder="卡名" value={cardDraft.cardName} onChange={(event) => setCardDraft((current) => ({ ...current, cardName: event.target.value }))} />
                  <Input placeholder="回饋類型" value={cardDraft.rewardType} onChange={(event) => setCardDraft((current) => ({ ...current, rewardType: event.target.value }))} />
                  <Input placeholder="回饋率，例如 0.05" type="number" step="0.001" value={cardDraft.rewardRate} onChange={(event) => setCardDraft((current) => ({ ...current, rewardRate: event.target.value }))} />
                  <Input placeholder="適用平台，例如 shopee, momo" value={cardDraft.platforms} onChange={(event) => setCardDraft((current) => ({ ...current, platforms: event.target.value }))} />
                  <Input placeholder="適用類別，例如 online, food" value={cardDraft.categories} onChange={(event) => setCardDraft((current) => ({ ...current, categories: event.target.value }))} />
                  <Input placeholder="最低消費" type="number" value={cardDraft.minSpend} onChange={(event) => setCardDraft((current) => ({ ...current, minSpend: event.target.value }))} />
                  <Input placeholder="最高回饋額" type="number" value={cardDraft.maxReward} onChange={(event) => setCardDraft((current) => ({ ...current, maxReward: event.target.value }))} />
                </div>

                <Textarea placeholder="推薦說明" value={cardDraft.description} onChange={(event) => setCardDraft((current) => ({ ...current, description: event.target.value }))} />

                <div className="grid grid-cols-2 gap-2">
                  <PrimaryAction onClick={handleCardSave}>{cardMode === 'edit' ? '儲存修改' : '新增卡片'}</PrimaryAction>
                  <SecondaryAction onClick={() => setCardDraft(null)}>關閉編輯器</SecondaryAction>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {cards.length ? cards.map((card) => (
                <div key={card.id} className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--muted)]">{card.bankName}</div>
                      <div className="mt-1 text-base font-semibold">{card.cardName}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">{card.description}</div>
                    </div>
                    <div className="rounded-2xl px-3 py-2 text-right" style={{ background: `${card.accent}22`, color: card.accent }}>
                      <div className="text-[10px] uppercase tracking-[0.2em]">回饋率</div>
                      <div className="mt-1 text-lg font-semibold">{percent(card.rewardRate)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
                    {ensureArray(card.platforms).map((item) => <Pill key={`${card.id}-${item}`}>{platformLabel(item)}</Pill>)}
                    {ensureArray(card.categories).map((item) => <Pill key={`${card.id}-${item}`}>{categoryLabel(item)}</Pill>)}
                    <Pill>{card.rewardType}</Pill>
                    <Pill>最低 {money(card.minSpend)}</Pill>
                    {card.maxReward ? <Pill>上限 {money(card.maxReward)}</Pill> : null}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <SecondaryAction onClick={() => openEditCard(card)}>編輯</SecondaryAction>
                    <SecondaryAction onClick={() => handleCardDelete(card.id)}>刪除</SecondaryAction>
                  </div>
                </div>
              )) : (
                <div className="rounded-[24px] border border-dashed border-white/12 bg-white/4 p-4 text-sm text-[color:var(--muted)]">
                  尚未建立任何信用卡，先按「新增信用卡」加入第一張卡。
                </div>
              )}
            </div>
          </Section>
        ) : null}

        {view === VIEW.chat ? (
          <Section
            title="Chatbot"
            subtitle="用自然語句補充情境，例如：『我現在要在蝦皮買 1200 元的電子產品』。"
            action={<SecondaryAction onClick={() => runRecommendation('chat')}>直接分析</SecondaryAction>}
          >
            <div className="flex h-[270px] flex-col rounded-[24px] border border-white/8 bg-black/15 p-3">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {chatMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-amber-400 text-slate-950' : 'bg-white/8 text-[color:var(--text)] border border-white/8'}`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {chatTyping ? (
                  <div className="flex justify-start">
                    <div className="rounded-3xl border border-white/8 bg-white/8 px-4 py-3 text-sm text-[color:var(--muted)]">
                      AI typing...
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="輸入補充資訊"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleChatSend();
                    }
                  }}
                />
                <PrimaryAction onClick={handleChatSend}>送出</PrimaryAction>
              </div>
            </div>
          </Section>
        ) : null}

        {view === VIEW.analysis ? (
          <Section title="分析中" subtitle="系統正在比對目前購物網站、商品類別與信用卡回饋。">
            <div className="space-y-4 rounded-[24px] border border-white/8 bg-black/15 p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/6">
                  <div className="absolute inset-2 rounded-full border border-amber-300/30 animate-pulseRing" />
                  <div className="absolute inset-4 rounded-full border border-sky-300/30 animate-pulseRing" style={{ animationDelay: '0.4s' }} />
                  <div className="relative text-xl font-black text-amber-200">AI</div>
                </div>
                <div>
                  <div className="text-base font-semibold">{loadingMessage}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">正在讀取平台、商品與回饋規則...</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-3 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-amber-200 animate-shimmer" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="skeleton h-16 rounded-2xl bg-[length:200%_100%] animate-shimmer" />
                  <div className="skeleton h-16 rounded-2xl bg-[length:200%_100%] animate-shimmer" />
                  <div className="skeleton h-16 rounded-2xl bg-[length:200%_100%] animate-shimmer" />
                </div>
              </div>

              {analysisState === 'error' ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">分析失敗，請再試一次。</div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {view === VIEW.results ? (
          <Section
            title="推薦結果"
            subtitle={`已完成比對，目前共 ${recommendationRank.length} 張卡片參與排序。`}
            action={<SecondaryAction onClick={() => setView(VIEW.dashboard)}>回到首頁</SecondaryAction>}
          >
            {bestCard ? (
              <div className="space-y-4">
                <div className="rounded-[26px] border border-amber-400/18 bg-gradient-to-br from-amber-400/15 via-white/6 to-sky-400/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-amber-100/80">最推薦信用卡</div>
                  <div className="mt-2 text-xl font-semibold">{bestCard.bankName || bestCard.bank_name} · {bestCard.cardName || bestCard.card_name}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">{bestCard.description}</div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Metric label="預估回饋金額" value={money(bestCard.reward)} hint="根據目前結帳金額與回饋率估算" />
                    <Metric label="回饋 %" value={percent(bestCard.rewardRate || bestCard.reward_rate)} hint="已考慮上限與門檻" />
                    <Metric label="結帳後等效成本" value={money(bestCard.finalCost || bestCard.final_cost)} hint="扣掉回饋後的實付金額" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill tone="accent">{platformLabel(currentCheckout.platform)}</Pill>
                    <Pill tone="info">{categoryLabel(currentCheckout.category)}</Pill>
                    <Pill>回饋上限 {bestCard.maxReward ? money(bestCard.maxReward) : '無上限'}</Pill>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <PrimaryAction onClick={() => setView(VIEW.cards)}>管理我的卡片</PrimaryAction>
                  <SecondaryAction onClick={handleSaveRecommendation}>儲存推薦結果</SecondaryAction>
                  <SecondaryAction onClick={() => runRecommendation('dashboard')}>重新分析</SecondaryAction>
                  <SecondaryAction onClick={() => setView(VIEW.chat)}>補充情境</SecondaryAction>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                  <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                    <div className="text-sm font-semibold">其他可選卡片排行</div>
                    <div className="mt-3 space-y-3">
                      {recommendationRank.map((item, index) => (
                        <div key={item.cardId || item.card_id || index} className="rounded-2xl border border-white/8 bg-black/10 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">#{index + 1} {item.bankName || item.bank_name} · {item.cardName || item.card_name}</div>
                              <div className="mt-1 text-xs text-[color:var(--muted)]">{item.reason || item.description}</div>
                            </div>
                            <div className="text-right text-xs text-[color:var(--muted)]">
                              <div>{money(item.reward)}</div>
                              <div>{percent(item.rewardRate || item.reward_rate)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                    <div className="text-sm font-semibold">比較表格</div>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/8">
                      <div className="grid grid-cols-4 bg-white/8 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        <div>卡片</div>
                        <div>回饋</div>
                        <div>成本</div>
                        <div>條件</div>
                      </div>
                      <div className="divide-y divide-white/8">
                        {recommendationRank.slice(0, 5).map((item, index) => (
                          <div key={`${item.cardId || index}`} className="grid grid-cols-4 gap-2 px-3 py-3 text-xs">
                            <div className="font-semibold">{item.bankName || item.bank_name}</div>
                            <div>{money(item.reward)}</div>
                            <div>{money(item.finalCost || item.final_cost)}</div>
                            <div className="text-[color:var(--muted)]">{item.reason || '符合一般回饋規則'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/12 bg-white/4 p-4 text-sm text-[color:var(--muted)]">
                還沒有推薦結果，先執行快速推薦或進入分析流程。
              </div>
            )}
          </Section>
        ) : null}
      </main>
    </div>
  );
}