export const ADMIN_EMAILS = ["eshanmaurya12@gmail.com"];

export function isAdmin(email?: string | null) {
  return email && ADMIN_EMAILS.includes(email);
}
