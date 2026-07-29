export function getSupabaseConnectionMessage(error: unknown) {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error || "");

  if (raw.includes("fetch failed") || raw.includes("ENOTFOUND") || raw.includes("getaddrinfo")) {
    return "เชื่อมต่อ Supabase ไม่ได้ กรุณาตรวจ SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL ใน Vercel ว่าเป็น Project URL ที่ถูกต้อง และ Supabase project ยัง active อยู่";
  }

  if (raw.includes("ByteString") || raw.includes("65279")) {
    return "ค่า Supabase env มีอักขระแปลกหรือ BOM ติดอยู่ กรุณาลบและตั้งค่า env ใหม่ใน Vercel";
  }

  return raw || "ตรวจ Supabase ไม่สำเร็จ";
}
