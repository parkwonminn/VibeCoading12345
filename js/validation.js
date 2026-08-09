// 로그인/회원가입 공통 입력 검증 유틸

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  // 최소 8자, 영문+숫자 포함
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}

function isValidUsername(username) {
  // 2~16자, 한글/영문/숫자/언더스코어
  return /^[a-zA-Z0-9가-힣_]{2,16}$/.test(username);
}

function setFieldError(inputEl, errorEl, message) {
  if (message) {
    inputEl.classList.add("invalid");
    errorEl.textContent = message;
    errorEl.classList.add("show");
  } else {
    inputEl.classList.remove("invalid");
    errorEl.textContent = "";
    errorEl.classList.remove("show");
  }
}

function showAlert(alertEl, message, type) {
  alertEl.textContent = message;
  alertEl.className = "form-alert show " + type;
}

function hideAlert(alertEl) {
  alertEl.className = "form-alert";
  alertEl.textContent = "";
}

// supabase/schema.sql 기준 에러를 한글 메시지로 변환
// - profiles.username unique 제약 위반 -> handle_new_user 트리거 실패
// - auth.users 관련 기본 인증 에러
function getFriendlyErrorMessage(error) {
  const msg = (error && error.message) || "";

  if (msg.includes("profiles_username_key") || msg.includes("username")) {
    return "이미 사용 중인 닉네임입니다.";
  }
  if (msg.includes("User already registered")) {
    return "이미 가입된 이메일입니다.";
  }
  if (msg.includes("Invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (msg.includes("Email not confirmed")) {
    return "이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.";
  }
  if (msg.includes("Password should be at least")) {
    return "비밀번호는 최소 8자 이상이어야 합니다.";
  }

  return msg || "요청 처리 중 오류가 발생했습니다.";
}
