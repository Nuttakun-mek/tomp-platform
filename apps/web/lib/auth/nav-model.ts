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
        label: "พอร์ทัลผู้จัดงาน",
        description: "ภาพรวมและคำขอเปลี่ยนแปลง",
        icon: "PanelsTopLeft",
        help: "ดูสถานะโครงการที่ได้รับอนุญาต และส่งคำขอเปลี่ยนแปลง",
        anyRole: ["customer_viewer"]
      }
    ]
  },
  {
    title: "ระบบ",
    items: [
      {
        href: "/superadmin/users",
        label: "ผู้ใช้และสิทธิ์",
        description: "จัดการสมาชิกและบทบาท",
        icon: "Users",
        help: "เพิ่มผู้ใช้ และกำหนดบทบาทในแต่ละโครงการ",
        anyPermission: ["admin.manage_users"]
      },
      {
        href: "/superadmin",
        label: "เครื่องมือระบบ",
        description: "เครื่องมือแพลตฟอร์ม",
        icon: "ShieldAlert",
        help: "จัดการผู้ใช้ บทบาท และเครื่องมือพัฒนา — เฉพาะทีมแพลตฟอร์ม",
        anyPermission: ["superadmin.access"],
        anyRole: ["super_admin"]
      }
    ]
  }
];

function itemVisible(item: NavItem, ctx: { permissions: string[]; roleKeys: string[] }): boolean {
  if (!item.anyPermission && !item.anyRole) return true; // เมนูสาธารณะ (เช่น ภาพรวม)
  if (ctx.permissions.includes("*")) return true;
  if (item.anyPermission?.some((p) => ctx.permissions.includes(p))) return true;
  if (item.anyRole?.some((r) => ctx.roleKeys.includes(r))) return true;
  return false;
}

export function filterNav(sections: NavSection[], ctx: { permissions: string[]; roleKeys: string[] }): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => itemVisible(item, ctx)) }))
    .filter((section) => section.items.length > 0);
}
