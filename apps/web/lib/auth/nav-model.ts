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
    title: "ปฏิบัติการ",
    items: [
      {
        href: "/",
        label: "ภาพรวม",
        description: "สถานะรวมวันนี้",
        icon: "Gauge",
        help: "ดูภาพรวมโครงการ งานที่จัดสรร GPS ล่าสุด และรายการที่ต้องติดตาม"
      },
      {
        href: "/mission-control",
        label: "ศูนย์ควบคุม",
        description: "แผนที่ รถ งาน ความเสี่ยง",
        icon: "MapPinned",
        help: "ติดตามรถบนแผนที่ สถานะงาน GPS ข้อความจากคนขับ และรายการเสี่ยง",
        anyPermission: ["assignment.read"]
      },
      {
        href: "/assignments",
        label: "บอร์ด Assignment",
        description: "มอบงานให้รถและคนขับ",
        icon: "ClipboardList",
        help: "จัดสรรงานให้ Call Sign คนขับ และรถ พร้อมสร้าง QR เฉพาะงาน",
        anyPermission: ["assignment.read"]
      }
    ]
  },
  {
    title: "วางแผน",
    items: [
      {
        href: "/projects",
        label: "โครงการ",
        description: "สร้างและจัดการพื้นที่ปฏิบัติการ",
        icon: "FolderKanban",
        help: "โครงการคือพื้นที่หลักสำหรับรวมภารกิจ งานที่จัดสรร คนขับ รถ QR และ Timeline",
        anyPermission: ["project.read"]
      },
      {
        href: "/resources",
        label: "ทรัพยากร",
        description: "คนขับและรถ",
        icon: "CarFront",
        help: "ดูรายชื่อคนขับ รถ สถานะ และความพร้อมสำหรับรับงาน",
        anyPermission: ["driver.read", "vehicle.read"]
      }
    ]
  },
  {
    title: "ประสานงาน",
    items: [
      {
        href: "/coordinator",
        label: "งานที่ได้รับมอบหมาย",
        description: "ยืนยันสถานะงานในพื้นที่",
        icon: "UserRoundCheck",
        help: "รายการงานที่ได้รับ ยืนยันรถถึง ผู้โดยสารขึ้นรถ และงานเสร็จ",
        anyRole: ["coordinator"]
      },
      {
        href: "/portal",
        label: "พอร์ทัลผู้จัดงาน",
        description: "ภาพรวมและคำขอเปลี่ยนแปลง",
        icon: "PanelsTopLeft",
        help: "ดูสถานะโครงการที่ได้รับอนุญาต และส่งคำขอเปลี่ยนแปลง",
        anyRole: ["organizer", "customer_viewer"]
      }
    ]
  },
  {
    title: "องค์กร",
    items: [
      {
        href: "/org/members",
        label: "ผู้ใช้และสิทธิ์",
        description: "จัดการสมาชิกและบทบาท",
        icon: "Users",
        help: "เพิ่มผู้ใช้ กำหนดบทบาทระดับองค์กรและโครงการ",
        anyPermission: ["admin.manage_users"]
      }
    ]
  },
  {
    title: "ระบบ",
    items: [
      {
        href: "/superadmin",
        label: "Superadmin",
        description: "เครื่องมือแพลตฟอร์ม",
        icon: "ShieldAlert",
        help: "จัดการผู้ใช้ องค์กร บทบาท และเครื่องมือพัฒนา — เฉพาะทีมแพลตฟอร์ม",
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
