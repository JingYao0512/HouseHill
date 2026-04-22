// HouseHill — JWT Token Management & Authenticated Fetch

const TOKEN_KEY = "househill_token";
const USER_KEY = "househill_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUsername() {
  return localStorage.getItem(USER_KEY) || "";
}

function setToken(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, username);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isLoggedIn() {
  return !!getToken();
}

/**
 * Wrapper around fetch that:
 * - Prepends API_BASE to the path
 * - Attaches Authorization: Bearer header
 * - On 401, clears token and redirects to login.html
 */
async function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }
  options.headers = headers;

  const response = await fetch(API_BASE + path, options);

  if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
    throw new Error("Unauthorized");
  }

  return response;
}
