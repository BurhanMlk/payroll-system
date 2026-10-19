import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const employeeApi = axios.create({
  baseURL: `${baseURL}/employee-portal`,
  headers: { "Content-Type": "application/json" },
});

const EMPLOYEE_TOKEN_KEY = "edupayroll.employee_token";

export function getEmployeeToken(): string | null {
  return localStorage.getItem(EMPLOYEE_TOKEN_KEY);
}

export function setEmployeeToken(token: string | null) {
  if (token) localStorage.setItem(EMPLOYEE_TOKEN_KEY, token);
  else localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
}

employeeApi.interceptors.request.use((config) => {
  const token = getEmployeeToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
