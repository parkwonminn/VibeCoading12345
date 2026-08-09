const signupForm = document.getElementById("signupForm");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordConfirmInput = document.getElementById("passwordConfirm");
const usernameError = document.getElementById("usernameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const passwordConfirmError = document.getElementById("passwordConfirmError");
const formAlert = document.getElementById("formAlert");
const submitBtn = document.getElementById("submitBtn");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert(formAlert);

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const passwordConfirm = passwordConfirmInput.value;

  let valid = true;

  if (!isValidUsername(username)) {
    setFieldError(usernameInput, usernameError, "닉네임은 2~16자의 한글/영문/숫자만 가능합니다.");
    valid = false;
  } else {
    setFieldError(usernameInput, usernameError, "");
  }

  if (!isValidEmail(email)) {
    setFieldError(emailInput, emailError, "올바른 이메일 형식이 아닙니다.");
    valid = false;
  } else {
    setFieldError(emailInput, emailError, "");
  }

  if (!isValidPassword(password)) {
    setFieldError(passwordInput, passwordError, "영문+숫자 포함 8자 이상이어야 합니다.");
    valid = false;
  } else {
    setFieldError(passwordInput, passwordError, "");
  }

  if (passwordConfirm !== password || !passwordConfirm) {
    setFieldError(passwordConfirmInput, passwordConfirmError, "비밀번호가 일치하지 않습니다.");
    valid = false;
  } else {
    setFieldError(passwordConfirmInput, passwordConfirmError, "");
  }

  if (!valid) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "가입 처리 중...";

  try {
    await signUpWithEmail(username, email, password);
    showAlert(formAlert, "회원가입이 완료되었습니다. 로그인해주세요.", "success");
    signupForm.reset();
    // TODO: 실제 연동 시 가입 완료 후 로그인 페이지로 자동 이동하려면 주석 해제
    // setTimeout(() => (window.location.href = "login.html"), 1200);
  } catch (err) {
    showAlert(formAlert, getFriendlyErrorMessage(err), "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "회원가입";
  }
});

// ============================================================
// Supabase Auth 연동 지점
// supabase/schema.sql 의 handle_new_user 트리거가 auth.users 생성 시
// raw_user_meta_data.username 값을 읽어 profiles 테이블에 자동으로
// 한 줄을 만들어주므로, signUp 호출 시 options.data.username 으로
// 닉네임을 함께 전달합니다.
// ============================================================
async function signUpWithEmail(username, email, password) {
  if (!supabaseClient) {
    console.warn("[demo] Supabase 미설정 - 임시 회원가입 처리:", { username, email });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { username, email };
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) throw error;
  return data;
}
