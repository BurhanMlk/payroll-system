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

export interface InstitutionAccount {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  tenantName: string;
}

const EMPLOYEE_CRED_KEY = "edupayroll.employee_credentials";
const EMPLOYEE_ACCOUNTS_KEY = "edupayroll.employee_accounts";

export function saveEmployeeCredentials(cnic: string, password: string) {
  sessionStorage.setItem(EMPLOYEE_CRED_KEY, JSON.stringify({ cnic, password }));
}

export function getEmployeeCredentials(): { cnic: string; password: string } | null {
  const raw = sessionStorage.getItem(EMPLOYEE_CRED_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { cnic: string; password: string };
  } catch {
    return null;
  }
}

export function saveEmployeeAccounts(accounts: InstitutionAccount[]) {
  sessionStorage.setItem(EMPLOYEE_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getEmployeeAccounts(): InstitutionAccount[] {
  const raw = sessionStorage.getItem(EMPLOYEE_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InstitutionAccount[]) : [];
  } catch {
    return [];
  }
}

export function clearEmployeeSession() {
  setEmployeeToken(null);
  sessionStorage.removeItem(EMPLOYEE_CRED_KEY);
  sessionStorage.removeItem(EMPLOYEE_ACCOUNTS_KEY);
}
