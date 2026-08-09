const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const formAlert = document.getElementById("formAlert");
const submitBtn = document.getElementById("submitBtn");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert(formAlert);

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let valid = true;

  if (!isValidEmail(email)) {
    setFieldError(emailInput, emailError, "올바른 이메일 형식이 아닙니다.");
    valid = false;
  } else {
    setFieldError(emailInput, emailError, "");
  }

  if (!password) {
    setFieldError(passwordInput, passwordError, "비밀번호를 입력해주세요.");
    valid = false;
  } else {
    setFieldError(passwordInput, passwordError, "");
  }

  if (!valid) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "로그인 중...";

  try {
    await signInWithEmail(email, password);
    showAlert(formAlert, "로그인에 성공했습니다.", "success");
    window.location.href = "welcome.html";
  } catch (err) {
    showAlert(formAlert, getFriendlyErrorMessage(err), "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "로그인";
  }
});

// ============================================================
// Supabase Auth 연동 지점
// js/supabaseClient.js 에 SUPABASE_URL / SUPABASE_ANON_KEY 를
// 설정하면 아래 함수가 실제 로그인 요청을 보냅니다.
// 설정 전까지는 데모용으로 임시 통과 처리됩니다.
// ============================================================
async function signInWithEmail(email, password) {
  if (!supabaseClient) {
    console.warn("[demo] Supabase 미설정 - 임시 로그인 처리:", email);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { email };
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}
