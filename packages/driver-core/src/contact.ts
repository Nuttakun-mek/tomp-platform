import type { DriverContactCard, DriverEscalationContact } from "@tomp/types/domain";

export function buildDriverContactCard(input: DriverContactCard): DriverContactCard {
  return input;
}

export function getPrimaryDriverContact(contacts: DriverContactCard[]) {
  return contacts.find((contact) => contact.primary) ?? contacts[0] ?? null;
}

export function getEscalationContact(contacts: DriverEscalationContact[]) {
  return contacts.sort((a, b) => a.level - b.level)[0] ?? null;
}
