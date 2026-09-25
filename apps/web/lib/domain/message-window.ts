/**
 * Which of a unit's driver messages the fleet card shows. Every message still
 * waiting for "รับทราบ" is always shown — an old unacknowledged problem must not
 * scroll out of sight behind newer chatter — then the latest acknowledged ones
 * fill the rest of `limit`. `showAll` returns everything. Order is kept.
 */
export function messageWindow<T>(messages: T[], isDone: (message: T) => boolean, options: { limit?: number; showAll?: boolean } = {}): { visible: T[]; hidden: number } {
  const limit = options.limit ?? 4;
  if (options.showAll || messages.length <= limit) return { visible: messages, hidden: 0 };

  const open = new Set(messages.filter((message) => !isDone(message)));
  const room = Math.max(0, limit - open.size);
  const recentDone = new Set(room ? messages.filter(isDone).slice(-room) : []);
  const visible = messages.filter((message) => open.has(message) || recentDone.has(message));
  return { visible, hidden: messages.length - visible.length };
}
