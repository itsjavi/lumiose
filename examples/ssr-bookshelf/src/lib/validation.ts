// Form validation shared by form actions (server) and islands (client-side hints). No server
// imports. Each validator takes a FormData or a plain object and returns typed values or
// per-field messages, ready for `fail(400, { errors })`.

import type { FieldErrors, Rating } from "../types.ts";

export type Validation<Value, Field extends string> =
  | { ok: true; value: Value }
  | { ok: false; errors: FieldErrors<Field> };

export type FormInput = FormData | Readonly<Record<string, unknown>>;

export const LIMITS = {
  name: 80,
  email: 254,
  passwordMin: 8,
  passwordMax: 200,
  reviewTitle: 120,
  reviewBody: 4000,
  reviewBodyMin: 10,
} as const;

export interface ReviewInput {
  rating: Rating;
  title: string | null;
  body: string;
}

export function validateReview(input: FormInput): Validation<ReviewInput, keyof ReviewInput> {
  const errors: FieldErrors<keyof ReviewInput> = {};
  const rating = Number(field(input, "rating"));
  if (!(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    errors.rating = "Choose a rating from 1 to 5 stars.";
  }
  const title = field(input, "title").trim();
  if (title.length > LIMITS.reviewTitle) {
    errors.title = `Keep the title under ${LIMITS.reviewTitle} characters.`;
  }
  const body = field(input, "body").trim();
  if (body.length < LIMITS.reviewBodyMin) {
    errors.body = `Write at least ${LIMITS.reviewBodyMin} characters.`;
  } else if (body.length > LIMITS.reviewBody) {
    errors.body = `Keep the review under ${LIMITS.reviewBody} characters.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { rating: rating as Rating, title: title === "" ? null : title, body },
  };
}

export interface RegistrationInput {
  email: string;
  name: string;
  password: string;
}

export function validateRegistration(
  input: FormInput,
): Validation<RegistrationInput, keyof RegistrationInput> {
  const errors: FieldErrors<keyof RegistrationInput> = {};
  const email = normalizeEmail(field(input, "email"));
  if (!isEmail(email)) errors.email = "Enter a valid email address.";
  const name = field(input, "name").trim();
  if (name === "") errors.name = "Enter your name.";
  else if (name.length > LIMITS.name) errors.name = `Keep it under ${LIMITS.name} characters.`;
  const password = field(input, "password");
  if (password.length < LIMITS.passwordMin) {
    errors.password = `Use at least ${LIMITS.passwordMin} characters.`;
  } else if (password.length > LIMITS.passwordMax) {
    errors.password = `Use at most ${LIMITS.passwordMax} characters.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, name, password } };
}

export interface LoginInput {
  email: string;
  password: string;
}

export function validateLogin(input: FormInput): Validation<LoginInput, keyof LoginInput> {
  const email = normalizeEmail(field(input, "email"));
  const password = field(input, "password");
  const errors: FieldErrors<keyof LoginInput> = {};
  if (!isEmail(email)) errors.email = "Enter a valid email address.";
  if (password === "") errors.password = "Enter your password.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, password } };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(email: string): boolean {
  return email.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** A string field: FormData files and missing values read as "". */
function field(input: FormInput, name: string): string {
  const value = input instanceof FormData ? input.get(name) : input[name];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
