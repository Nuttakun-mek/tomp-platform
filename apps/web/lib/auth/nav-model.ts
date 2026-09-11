import type { I18nKey } from "@/lib/i18n";

export interface NavItem {
  href: string;
  labelKey: I18nKey;
  descriptionKey: I18nKey;
  icon: string; // ชื่อ lucide icon — map เป็น component ใน app-nav.tsx
  helpKey: I18nKey;
  anyPermission?: string[]; // มีอย่างน้อย 1 ใน list นี้
  anyRole?: string[]; // หรือมี role นี้
}

export interface NavSection {
  titleKey: I18nKey;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "nav.sections.workspace",
    items: [
      {
        href: "/projects",
        labelKey: "nav.projects.label",
        descriptionKey: "nav.projects.description",
        icon: "FolderKanban",
        helpKey: "nav.projects.help",
        anyPermission: ["project.read"]
      },
      {
        // The library sits outside any project on purpose: it is what survives
        // between them, and there was no way to reach it at all.
        href: "/resources",
        labelKey: "nav.resources.label",
        descriptionKey: "nav.resources.description",
        icon: "Library",
        helpKey: "nav.resources.help",
        anyPermission: ["driver.create", "vehicle.create"]
      }
    ]
  },
  {
    titleKey: "nav.sections.coordination",
    items: [
      {
        href: "/portal",
        labelKey: "nav.portal.label",
        descriptionKey: "nav.portal.description",
        icon: "PanelsTopLeft",
        helpKey: "nav.portal.help",
        anyRole: ["customer_viewer"]
      }
    ]
  },
  {
    titleKey: "nav.sections.system",
    items: [
      {
        href: "/superadmin",
        labelKey: "nav.superadmin.label",
        descriptionKey: "nav.superadmin.description",
        icon: "ShieldAlert",
        helpKey: "nav.superadmin.help",
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
