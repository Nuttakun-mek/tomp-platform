"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locales";

export async function setLocaleAction(locale: string) {
  const nextLocale = normalizeLocale(locale);
  const cookieStore = await cookies();
  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") || headerStore.get("x-forwarded-protocol");
  cookieStore.set(LOCALE_COOKIE, nextLocale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && protocol === "https",
    maxAge: 60 * 60 * 24 * 365,
    path: "/"
  });
  revalidatePath("/", "layout");
}
