import { describe, expect, it } from "vitest";
import { messageWindow } from "./message-window";

type M = { id: number; done: boolean };
const isDone = (m: M) => m.done;
const ids = (list: M[]) => list.map((m) => m.id);

describe("messageWindow", () => {
  it("shows everything when there are few messages", () => {
    const messages = [{ id: 1, done: true }, { id: 2, done: false }];
    expect(messageWindow(messages, isDone)).toEqual({ visible: messages, hidden: 0 });
  });

  it("never hides an unacknowledged message, however old", () => {
    const messages: M[] = [{ id: 1, done: false }, ...[2, 3, 4, 5, 6, 7].map((id) => ({ id, done: true }))];
    const { visible, hidden } = messageWindow(messages, isDone);
    expect(ids(visible)).toEqual([1, 5, 6, 7]);
    expect(hidden).toBe(3);
  });

  it("shows every open message even when they outnumber the limit", () => {
    const messages: M[] = [1, 2, 3, 4, 5].map((id) => ({ id, done: false })).concat([{ id: 6, done: true }]);
    expect(ids(messageWindow(messages, isDone).visible)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns the full history on request", () => {
    const messages: M[] = [1, 2, 3, 4, 5, 6].map((id) => ({ id, done: true }));
    expect(messageWindow(messages, isDone, { showAll: true }).hidden).toBe(0);
  });
});
