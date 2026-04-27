function detectAmount() {
  const text = document.body.innerText;

  console.log("頁面內容:", text);

  const match = text.match(/([0-9,]+)\s*$/m); // test-only fallback extractor

  if (match) {
    const amount = Number(match[1].replaceAll(",", ""));
    return amount;
  }

  return null;
}

function detectCheckoutInfo() {
  const url = window.location.href;

  let platform = "unknown";

  if (url.includes("shopee")) {
    platform = "shopee";
  } else if (url.includes("momo")) {
    platform = "momo";
  } else if (url.includes("pchome")) {
    platform = "pchome";
  }

  const amount = detectAmount();
  console.log("抓到金額:", amount);

  if (amount === null) {
    return null;
  }

  return {
    amount: amount,
    platform: platform,
    category: "online",
  };
}

async function runRecommendation() {
  const checkoutInfo = detectCheckoutInfo();

  if (!checkoutInfo) return;

  const response = await fetch("http://localhost:8000/recommend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...checkoutInfo,
      user_card_ids: [1, 2, 3],
    }),
  });

  if (!response.ok) {
    console.error("Recommend API error", response.status);
    return;
  }

  const data = await response.json();
  const bestCard = data?.best || data?.best_card;

  if (bestCard) {
    showOverlay(bestCard);
  }
}

function showOverlay(bestCard) {
  const box = document.createElement("div");

  box.style.position = "fixed";
  box.style.right = "20px";
  box.style.bottom = "20px";
  box.style.zIndex = "999999";
  box.style.background = "white";
  box.style.border = "1px solid #ddd";
  box.style.padding = "16px";
  box.style.borderRadius = "12px";
  box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  box.style.maxWidth = "320px";

  box.innerHTML = `
    <b>最佳信用卡推薦</b><br>
    ${bestCard.bank_name} ${bestCard.card_name}<br>
    預估回饋：$${bestCard.reward}<br>
    結帳後成本：$${bestCard.final_cost}<br>
    <small>${bestCard.description || "已依平台與類別計算最佳結果"}</small>
  `;

  document.body.appendChild(box);
}

runRecommendation().catch((error) => {
  console.error("Failed to call backend", error);
});
