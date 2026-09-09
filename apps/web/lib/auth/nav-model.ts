export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: string; // ชื่อ lucide icon — map เป็น component ใน app-nav.tsx
  help: string;
  anyPermission?: string[]; // มีอย่างน้อย 1 ใน list นี้
  anyRole?: string[]; // หรือมี role นี้
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "พื้นที่ทำงาน",
    items: [
      {
        href: "/projects",
        label: "โครงการ",
        description: "เลือกโครงการเพื่อเข้าทำงาน",
        icon: "FolderKanban",
        help: "โครงการคือพื้นที่หลัก — เข้าโครงการแล้วจะเจอจัดงาน ศูนย์ควบคุม ทรัพยากร และตั้งค่าของโครงการนั้น",
        anyPermission: ["project.read"]
      }
    ]
  },
  {
    title: "ประสานงาน",
    items: [
      {
        href: "/portal",
        label: "มุมมองลูกค้า",
        description: "หน้าที่ลูกค้า/ผู้จัดงานเห็น",
        icon: "PanelsTopLeft",
        help: "หน้าอ่านอย่างเดียวสำหรับลูกค้าหรือผู้จัดงาน — เห็นสถานะภารกิจของโครงการที่ตนเกี่ยวข้อง และส่งคำขอเปลี่ยนแปลงเข้ามา แก้ไขแผนเองไม่ได้",
        anyRole: ["customer_viewer"]
      }
    ]
  },
  {
    title: "ระบบ",
    items: [
      {
        href: "/superadmin",
        label: "เครื่องมือระบบ",
        description: "ผู้ใช้ สิทธิ์ และเครื่องมือแพลตฟอร์ม",
        icon: "ShieldAlert",
        help: "จัดการผู้ใช้และบทบาท ตรวจสอบระบบ และเครื่องมือพัฒนา — เฉพาะทีมแพลตฟอร์ม",
        anyPermission: ["superadmin.access"],
        anyRole: ["super_admin"]
      }
    ]
  }
];

function itemVisible(item: NavItem, ctx: { permissions: string[]; roleKeys: string[] }): boolean {
  if (!item.anyPermission && !item.anyRole) return true; // เมนูสาธารณะ (เช่น ภาพรวม)
  if (item.anyRole?.some((r) => ctx.roleKeys.includes(r))) return true;
  if (item.anyPermission?.some((p) => ctx.permissions.includes(p))) return true;
  // "*" แทนทุก "สิทธิ์" ไม่ใช่ทุก "บทบาท" — เมนูที่ผูกกับบทบาทล้วน (มุมมองลูกค้า)
  // เป็นหน้าเฉพาะ persona ไม่ใช่ความสามารถ จึงไม่โผล่ให้แอดมินสับสน
  if (item.anyPermission && ctx.permissions.includes("*")) return true;
  return false;
}

export function filterNav(sections: NavSection[], ctx: { permissions: string[]; roleKeys: string[] }): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => itemVisible(item, ctx)) }))
    .filter((section) => section.items.length > 0);
}
