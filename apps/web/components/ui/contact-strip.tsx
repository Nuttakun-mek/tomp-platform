import { MessageSquare, Phone, PhoneOff } from "lucide-react";
import { roleLabelTh } from "@/lib/i18n/role-th";

export interface Contact {
  role: string;
  name: string;
  phone?: string | null;
}

interface ContactStripProps {
  contacts: Contact[];
  title?: string;
  className?: string;
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
function smsHref(phone: string) {
  return `sms:${phone.replace(/[^\d+]/g, "")}`;
}

// Contact matrix that must be reachable on every operational screen (COO-008,
// DRV-009) so nobody has to hunt for a phone number mid-operation.
export function ContactStrip({ contacts, title = "ติดต่อผู้เกี่ยวข้อง", className }: ContactStripProps) {
  if (!contacts.length) return null;

  return (
    <section className={`smart-card grid gap-2.5 ${className ?? ""}`}>
      <p className="section-label">{title}</p>
      <ul className="grid gap-2">
        {contacts.map((contact, index) => (
          <li key={`${contact.role}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-white px-3 py-2">
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {roleLabelTh(contact.role) === contact.role ? contact.role : roleLabelTh(contact.role)}
              </span>
              <span className="block truncate text-sm font-semibold text-ink">{contact.name}</span>
            </span>
            {contact.phone ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <a
                  href={telHref(contact.phone)}
                  className="inline-flex items-center gap-1 rounded-command bg-operation px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-operation-deep"
                >
                  <Phone className="h-3.5 w-3.5" /> โทร
                </a>
                <a
                  href={smsHref(contact.phone)}
                  className="inline-flex items-center gap-1 rounded-command border border-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-canvas"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> ข้อความ
                </a>
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink-faint">
                <PhoneOff className="h-3.5 w-3.5" /> ไม่มีเบอร์ติดต่อ
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
