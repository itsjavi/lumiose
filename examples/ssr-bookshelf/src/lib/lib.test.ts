import { describe, expect, it } from "vitest";
import { normalizePaging, pageInfo, pageWindow } from "./pagination.ts";
import { bookFiltersToParams, parseBookFilters, parsePageParam } from "./search-params.ts";
import { validateLogin, validateRegistration, validateReview } from "./validation.ts";

describe("pagination", () => {
  it("computes page counts and neighbours", () => {
    expect(pageInfo(0, 1, 24)).toEqual({
      page: 1,
      pageSize: 24,
      total: 0,
      pageCount: 1,
      hasPrevious: false,
      hasNext: false,
    });
    expect(pageInfo(48, 2, 24)).toMatchObject({ pageCount: 2, hasPrevious: true, hasNext: false });
    expect(pageInfo(49, 2, 24)).toMatchObject({ pageCount: 3, hasNext: true });
    expect(pageInfo(10, 5, 24)).toMatchObject({ pageCount: 1, hasPrevious: true, hasNext: false });
  });

  it("normalizes page and size into an offset", () => {
    expect(normalizePaging(undefined, undefined)).toEqual({ page: 1, pageSize: 24, offset: 0 });
    expect(normalizePaging(3, 10)).toEqual({ page: 3, pageSize: 10, offset: 20 });
    expect(normalizePaging(2.7, 10.9)).toEqual({ page: 2, pageSize: 10, offset: 10 });
    expect(normalizePaging(-1, 500)).toEqual({ page: 1, pageSize: 100, offset: 0 });
    expect(normalizePaging(Infinity, Number.NaN, 5)).toEqual({ page: 1, pageSize: 5, offset: 0 });
  });

  it("windows page links with gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(6, 20)).toEqual([1, null, 4, 5, 6, 7, 8, null, 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, 6, null, 20]);
  });
});

describe("search params", () => {
  it("parses filters and drops unknown or empty values", () => {
    const params = new URLSearchParams("q=+tower+&genre=fantasy&sort=bogus&page=x&author=");
    expect(parseBookFilters(params)).toEqual({ q: "tower", genre: "fantasy", page: 1 });
    expect(parseBookFilters(new URLSearchParams("sort=rating&page=3"))).toEqual({
      sort: "rating",
      page: 3,
    });
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("1e3")).toBe(1);
    expect(parsePageParam("12")).toBe(12);
  });

  it("round-trips filters through clean URLs", () => {
    const filters = { q: "salt", genre: "poetry", sort: "newest" as const, page: 2 };
    expect(bookFiltersToParams(filters).toString()).toBe("q=salt&genre=poetry&sort=newest&page=2");
    expect(parseBookFilters(bookFiltersToParams(filters))).toEqual(filters);
    expect(bookFiltersToParams({ page: 1 }).toString()).toBe("");
  });
});

describe("validation", () => {
  it("validates reviews from form data", () => {
    const form = new FormData();
    form.set("rating", "4");
    form.set("title", "  ");
    form.set("body", "  A careful, generous book.  ");
    expect(validateReview(form)).toEqual({
      ok: true,
      value: { rating: 4, title: null, body: "A careful, generous book." },
    });
    expect(validateReview({ rating: "6", body: "short" })).toEqual({
      ok: false,
      errors: {
        rating: "Choose a rating from 1 to 5 stars.",
        body: "Write at least 10 characters.",
      },
    });
    expect(validateReview({ rating: 2.5, body: "x".repeat(20) }).ok).toBe(false);
  });

  it("validates registration and login", () => {
    expect(
      validateRegistration({ email: " A@B.co ", name: " Ana ", password: "12345678" }),
    ).toEqual({ ok: true, value: { email: "a@b.co", name: "Ana", password: "12345678" } });
    const invalid = validateRegistration({ email: "a@b", name: "", password: "1234567" });
    expect(invalid.ok === false && Object.keys(invalid.errors)).toEqual([
      "email",
      "name",
      "password",
    ]);
    expect(validateLogin({ email: "a@b.co", password: "" })).toEqual({
      ok: false,
      errors: { password: "Enter your password." },
    });
  });
});
