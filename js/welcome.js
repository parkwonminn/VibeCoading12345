const welcomeSubtitle = document.getElementById("welcomeSubtitle");
const logoutBtn = document.getElementById("logoutBtn");

checkSession();

async function checkSession() {
  if (!supabaseClient) {
    console.warn("[demo] Supabase 미설정 - 세션 확인을 건너뜁니다.");
    welcomeSubtitle.textContent = "환영합니다.";
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    return;
  }

  welcomeSubtitle.textContent = `${data.session.user.email}님, 환영합니다.`;
}

logoutBtn.addEventListener("click", async () => {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  window.location.href = "login.html";
});
