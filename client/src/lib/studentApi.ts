import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const studentApi = axios.create({
  baseURL: `${baseURL}/student-portal`,
  headers: { "Content-Type": "application/json" },
});

const STUDENT_TOKEN_KEY = "edupayroll.student_token";

export function getStudentToken(): string | null {
  return localStorage.getItem(STUDENT_TOKEN_KEY);
}

export function setStudentToken(token: string | null) {
  if (token) localStorage.setItem(STUDENT_TOKEN_KEY, token);
  else localStorage.removeItem(STUDENT_TOKEN_KEY);
}

studentApi.interceptors.request.use((config) => {
  const token = getStudentToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface StudentAccount {
  studentId: string;
  tenantId: string;
  tenantName: string;
  rollNumber: string;
  fullName: string;
  className: string;
  section: string | null;
}

export function clearStudentSession() {
  setStudentToken(null);
}

