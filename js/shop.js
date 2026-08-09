// ============================================================
// 쇼핑몰 페이지 (로그인 필요)
// products / categories : 전체 공개 조회
// cart_items / orders / order_items : 로그인한 본인 데이터만 RLS로 접근
// ============================================================

const PAGE_SIZE = 24;

const state = {
  user: null,
  categories: [],
  page: 1,
  totalPages: 1,
  categoryId: "",
};

const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const categoryFilter = document.getElementById("categoryFilter");
const productGrid = document.getElementById("productGrid");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");
const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const cartBadge = document.getElementById("cartBadge");
const checkoutBtn = document.getElementById("checkoutBtn");
const orderList = document.getElementById("orderList");
const toast = document.getElementById("toast");

init();

async function init() {
  if (!supabaseClient) {
    console.warn("[demo] Supabase 미설정 - 쇼핑몰 기능을 사용할 수 없습니다.");
    userEmailEl.textContent = "데모 모드";
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.href = "login.html";
    return;
  }

  state.user = data.session.user;
  userEmailEl.textContent = state.user.email;

  setupTabs();
  setupPager();
  setupCategoryFilter();

  await loadCategories();
  await loadProducts();
  await refreshCartBadge();
}

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

// ---------------- 탭 ----------------
function setupTabs() {
  document.querySelectorAll(".shop-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll(".shop-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${tab}`);
  });

  if (tab === "cart") loadCart();
  if (tab === "orders") loadOrders();
}

// ---------------- 상품 목록 ----------------
async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name");

  if (error) {
    console.error(error);
    return;
  }

  state.categories = data;
  categoryFilter.innerHTML =
    '<option value="">전체 카테고리</option>' +
    data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function setupCategoryFilter() {
  categoryFilter.addEventListener("change", () => {
    state.categoryId = categoryFilter.value;
    state.page = 1;
    loadProducts();
  });
}

function setupPager() {
  prevPageBtn.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadProducts();
    }
  });
  nextPageBtn.addEventListener("click", () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      loadProducts();
    }
  });
}

async function loadProducts() {
  productGrid.innerHTML = '<div class="state-msg">불러오는 중...</div>';

  const from = (state.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseClient
    .from("products")
    .select("id, name, description, price, stock, categories(name)", { count: "exact" })
    .order("id")
    .range(from, to);

  if (state.categoryId) {
    query = query.eq("category_id", state.categoryId);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error(error);
    productGrid.innerHTML = '<div class="state-msg">상품을 불러오지 못했습니다.</div>';
    return;
  }

  state.totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  if (state.page > state.totalPages) state.page = state.totalPages;

  renderProducts(data || []);
  pageIndicator.textContent = `${state.page} / ${state.totalPages}`;
  prevPageBtn.disabled = state.page <= 1;
  nextPageBtn.disabled = state.page >= state.totalPages;
}

function renderProducts(products) {
  if (products.length === 0) {
    productGrid.innerHTML = '<div class="state-msg">등록된 상품이 없습니다.</div>';
    return;
  }

  productGrid.innerHTML = products
    .map((p) => {
      const outOfStock = p.stock <= 0;
      return `
        <div class="product-card">
          <div class="category">${escapeHtml(p.categories?.name || "미분류")}</div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="desc">${escapeHtml(p.description || "")}</div>
          <div class="price">${formatWon(p.price)}</div>
          <div class="stock ${outOfStock ? "out" : ""}">${outOfStock ? "품절" : `재고 ${p.stock}개`}</div>
          <div class="add-row">
            <input type="number" min="1" max="${p.stock}" value="1" data-qty-for="${p.id}" ${outOfStock ? "disabled" : ""}>
            <button type="button" class="btn-mini" data-add="${p.id}" ${outOfStock ? "disabled" : ""}>담기</button>
          </div>
        </div>`;
    })
    .join("");

  productGrid.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = Number(btn.dataset.add);
      const qtyInput = productGrid.querySelector(`[data-qty-for="${productId}"]`);
      const qty = Math.max(1, Number(qtyInput.value) || 1);
      addToCart(productId, qty);
    });
  });
}

// ---------------- 장바구니 ----------------
async function addToCart(productId, qty) {
  const { data: existing, error: fetchErr } = await supabaseClient
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", state.user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (fetchErr) {
    console.error(fetchErr);
    showToast("장바구니 담기에 실패했습니다.");
    return;
  }

  let error;
  if (existing) {
    ({ error } = await supabaseClient
      .from("cart_items")
      .update({ quantity: existing.quantity + qty })
      .eq("id", existing.id));
  } else {
    ({ error } = await supabaseClient
      .from("cart_items")
      .insert({ user_id: state.user.id, product_id: productId, quantity: qty }));
  }

  if (error) {
    console.error(error);
    showToast("장바구니 담기에 실패했습니다.");
    return;
  }

  showToast("장바구니에 담았습니다.");
  await refreshCartBadge();
}

async function loadCart() {
  cartList.innerHTML = '<div class="state-msg">불러오는 중...</div>';

  const { data, error } = await supabaseClient
    .from("cart_items")
    .select("id, quantity, product_id, products(name, price, stock)")
    .eq("user_id", state.user.id)
    .order("id");

  if (error) {
    console.error(error);
    cartList.innerHTML = '<div class="state-msg">장바구니를 불러오지 못했습니다.</div>';
    return;
  }

  renderCart(data || []);
}

function renderCart(items) {
  if (items.length === 0) {
    cartList.innerHTML = '<div class="state-msg">장바구니가 비어있습니다.</div>';
    cartTotal.textContent = formatWon(0);
    checkoutBtn.disabled = true;
    return;
  }

  let total = 0;

  cartList.innerHTML = items
    .map((item) => {
      const product = item.products;
      const subtotal = product.price * item.quantity;
      total += subtotal;
      return `
        <div class="cart-row" data-cart-id="${item.id}">
          <div class="info">
            <div class="name">${escapeHtml(product.name)}</div>
            <div class="unit-price">${formatWon(product.price)} / 개</div>
          </div>
          <div class="qty-stepper">
            <button type="button" class="btn-mini ghost" data-step="-1">-</button>
            <span>${item.quantity}</span>
            <button type="button" class="btn-mini ghost" data-step="1">+</button>
          </div>
          <div class="subtotal">${formatWon(subtotal)}</div>
          <button type="button" class="remove" data-remove>삭제</button>
        </div>`;
    })
    .join("");

  cartTotal.textContent = formatWon(total);
  checkoutBtn.disabled = false;

  cartList.querySelectorAll(".cart-row").forEach((row) => {
    const cartId = Number(row.dataset.cartId);

    row.querySelectorAll("[data-step]").forEach((btn) => {
      btn.addEventListener("click", () => stepCartQty(cartId, Number(btn.dataset.step)));
    });

    row.querySelector("[data-remove]").addEventListener("click", () => removeCartItem(cartId));
  });
}

async function stepCartQty(cartId, delta) {
  const { data: row, error: fetchErr } = await supabaseClient
    .from("cart_items")
    .select("quantity, products(stock)")
    .eq("id", cartId)
    .single();

  if (fetchErr || !row) {
    console.error(fetchErr);
    return;
  }

  const nextQty = row.quantity + delta;

  if (nextQty <= 0) {
    await removeCartItem(cartId);
    return;
  }

  if (nextQty > row.products.stock) {
    showToast("재고 수량을 초과했습니다.");
    return;
  }

  const { error } = await supabaseClient
    .from("cart_items")
    .update({ quantity: nextQty })
    .eq("id", cartId);

  if (error) {
    console.error(error);
    showToast("수량 변경에 실패했습니다.");
    return;
  }

  await loadCart();
  await refreshCartBadge();
}

async function removeCartItem(cartId) {
  const { error } = await supabaseClient.from("cart_items").delete().eq("id", cartId);

  if (error) {
    console.error(error);
    showToast("삭제에 실패했습니다.");
    return;
  }

  await loadCart();
  await refreshCartBadge();
}

async function refreshCartBadge() {
  const { count, error } = await supabaseClient
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", state.user.id);

  if (error) {
    console.error(error);
    return;
  }

  if (count > 0) {
    cartBadge.hidden = false;
    cartBadge.textContent = count;
  } else {
    cartBadge.hidden = true;
  }
}

checkoutBtn.addEventListener("click", checkout);

async function checkout() {
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "주문 처리 중...";

  try {
    const { data: items, error: cartErr } = await supabaseClient
      .from("cart_items")
      .select("id, quantity, product_id, products(name, price)")
      .eq("user_id", state.user.id);

    if (cartErr) throw cartErr;
    if (!items || items.length === 0) {
      showToast("장바구니가 비어있습니다.");
      return;
    }

    const totalPrice = items.reduce((sum, item) => sum + item.products.price * item.quantity, 0);

    const { data: order, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({ user_id: state.user.id, status: "pending", total_price: totalPrice })
      .select("id")
      .single();

    if (orderErr) throw orderErr;

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.products.name,
      price: item.products.price,
      quantity: item.quantity,
    }));

    const { error: itemsErr } = await supabaseClient.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;

    const cartIds = items.map((item) => item.id);
    const { error: clearErr } = await supabaseClient.from("cart_items").delete().in("id", cartIds);
    if (clearErr) throw clearErr;

    showToast("주문이 완료되었습니다.");
    await refreshCartBadge();
    switchTab("orders");
  } catch (err) {
    console.error(err);
    showToast("주문 처리 중 오류가 발생했습니다.");
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "주문하기";
  }
}

// ---------------- 주문내역 ----------------
async function loadOrders() {
  orderList.innerHTML = '<div class="state-msg">불러오는 중...</div>';

  const { data, error } = await supabaseClient
    .from("orders")
    .select("id, status, total_price, created_at")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    orderList.innerHTML = '<div class="state-msg">주문내역을 불러오지 못했습니다.</div>';
    return;
  }

  renderOrders(data || []);
}

const STATUS_LABEL = {
  pending: "결제대기",
  paid: "결제완료",
  shipped: "배송중",
  completed: "배송완료",
  cancelled: "취소됨",
};

function renderOrders(orders) {
  if (orders.length === 0) {
    orderList.innerHTML = '<div class="state-msg">주문 내역이 없습니다.</div>';
    return;
  }

  orderList.innerHTML = orders
    .map(
      (o) => `
      <div class="order-card" data-order-id="${o.id}">
        <div class="order-head" data-toggle>
          <span class="order-id">주문 #${o.id}</span>
          <span class="status-badge status-${o.status}">${STATUS_LABEL[o.status] || o.status}</span>
          <span class="order-date">${formatDate(o.created_at)}</span>
          <span class="order-total">${formatWon(o.total_price)}</span>
        </div>
        <div class="order-items" data-items></div>
      </div>`
    )
    .join("");

  orderList.querySelectorAll("[data-toggle]").forEach((head) => {
    head.addEventListener("click", () => toggleOrderItems(head));
  });
}

async function toggleOrderItems(headEl) {
  const card = headEl.closest(".order-card");
  const itemsEl = card.querySelector("[data-items]");
  const orderId = Number(card.dataset.orderId);

  const isOpen = itemsEl.classList.contains("open");
  if (isOpen) {
    itemsEl.classList.remove("open");
    return;
  }

  if (!itemsEl.dataset.loaded) {
    const { data, error } = await supabaseClient
      .from("order_items")
      .select("product_name, price, quantity")
      .eq("order_id", orderId);

    if (error) {
      console.error(error);
      itemsEl.innerHTML = '<div class="state-msg">상세 내역을 불러오지 못했습니다.</div>';
    } else {
      itemsEl.innerHTML = data
        .map(
          (it) => `
          <div class="item-row">
            <span>${escapeHtml(it.product_name)} x ${it.quantity}</span>
            <span>${formatWon(it.price * it.quantity)}</span>
          </div>`
        )
        .join("");
    }
    itemsEl.dataset.loaded = "1";
  }

  itemsEl.classList.add("open");
}

// ---------------- 유틸 ----------------
function formatWon(value) {
  return `${Math.round(Number(value)).toLocaleString("ko-KR")}원`;
}

function formatDate(value) {
  const d = new Date(value);
  return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
