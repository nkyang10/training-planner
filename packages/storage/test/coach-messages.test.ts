/**
 * The coach-message contract, exercised against both adapters.
 *
 * The two properties this file exists to pin down are the ones a UI would otherwise discover late: a transcript
 * is oldest-first even when only the tail is loaded, and one runner's conversation is never visible to another.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CoachMessage } from "@training-planner/domain";
import { createMemoryRepository } from "../src/memory";
import { createSqliteRepository } from "../src/sqlite";
import type { Repository } from "../src/types";

interface Harness {
  repository: Repository;
  dispose(): void;
}

const openMemory = (): Harness => ({
  repository: createMemoryRepository(),
  dispose: () => {
    // Nothing to release: the memory adapter owns no external resource.
  },
});

const openSqlite = (): Harness => {
  const directory = mkdtempSync(join(tmpdir(), "training-planner-coach-"));
  const repository = createSqliteRepository({ filename: join(directory, "coach.sqlite") });
  return {
    repository,
    dispose: () => {
      // Windows will not remove an open SQLite file, so closing first is part of the cleanup, not a nicety.
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

const message = (overrides: Partial<CoachMessage> = {}): CoachMessage => ({
  messageId: "message-1",
  userId: "runner-1",
  role: "user",
  text: "How far should I run on Saturday?",
  createdAt: "2026-11-05T09:00:00.000Z",
  contextHash: "",
  reviewId: null,
  ...overrides,
});

const ids = (messages: CoachMessage[]): string[] => messages.map((entry) => entry.messageId);

describe.each([
  { name: "memory", open: openMemory },
  { name: "sqlite", open: openSqlite },
])("$name adapter", ({ open }) => {
  it("appends and lists a round-trip for one user", () => {
    const { repository, dispose } = open();
    try {
      const question = message();
      const reply = message({
        messageId: "message-2",
        role: "coach",
        text: "Six easy kilometres, then walk the last hill.",
        createdAt: "2026-11-05T09:01:00.000Z",
        contextHash: "sha256:fact-snapshot",
      });
      repository.appendCoachMessage(question);
      repository.appendCoachMessage(reply);

      expect(repository.listCoachMessages("runner-1")).toEqual([question, reply]);
    } finally {
      dispose();
    }
  });

  it("lists messages oldest-first", () => {
    const { repository, dispose } = open();
    try {
      repository.appendCoachMessage(message({ messageId: "first", createdAt: "2026-11-05T09:00:00.000Z" }));
      repository.appendCoachMessage(message({ messageId: "second", createdAt: "2026-11-05T09:01:00.000Z" }));
      repository.appendCoachMessage(message({ messageId: "third", createdAt: "2026-11-05T09:02:00.000Z" }));

      expect(ids(repository.listCoachMessages("runner-1"))).toEqual(["first", "second", "third"]);
    } finally {
      dispose();
    }
  });

  it("returns the most recent N messages, still oldest-first", () => {
    const { repository, dispose } = open();
    try {
      for (let index = 1; index <= 5; index += 1) {
        repository.appendCoachMessage(
          message({
            messageId: `message-${index}`,
            createdAt: `2026-11-05T09:0${index}:00.000Z`,
          }),
        );
      }

      expect(ids(repository.listCoachMessages("runner-1", 2))).toEqual(["message-4", "message-5"]);
      // A limit larger than the conversation is the whole conversation, not an error.
      expect(ids(repository.listCoachMessages("runner-1", 10))).toEqual([
        "message-1",
        "message-2",
        "message-3",
        "message-4",
        "message-5",
      ]);
    } finally {
      dispose();
    }
  });

  it("keeps two users' conversations isolated", () => {
    const { repository, dispose } = open();
    try {
      const runnerOne = message({ messageId: "runner-1-turn", userId: "runner-1" });
      const runnerTwo = message({ messageId: "runner-2-turn", userId: "runner-2", text: "My knee hurts." });
      repository.appendCoachMessage(runnerOne);
      repository.appendCoachMessage(runnerTwo);

      expect(repository.listCoachMessages("runner-1")).toEqual([runnerOne]);
      expect(repository.listCoachMessages("runner-2")).toEqual([runnerTwo]);
      expect(repository.listCoachMessages("runner-3")).toEqual([]);
    } finally {
      dispose();
    }
  });

  it("round-trips a message with a reviewId exactly", () => {
    const { repository, dispose } = open();
    try {
      const answer = message({
        messageId: "message-review",
        role: "coach",
        text: "I would rewrite next week's long run. Want to review it?",
        createdAt: "2026-11-05T09:05:00.000Z",
        contextHash: "sha256:fact-snapshot",
        reviewId: "review-42",
      });
      repository.appendCoachMessage(answer);

      const stored = repository.listCoachMessages("runner-1");
      expect(stored).toEqual([answer]);
      expect(stored[0]?.reviewId).toBe("review-42");
    } finally {
      dispose();
    }
  });
});

describe("sqlite adapter persistence", () => {
  it("keeps coach messages after close and reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "training-planner-coach-persist-"));
    const filename = join(directory, "coach.sqlite");
    const stored = message({
      messageId: "message-persisted",
      role: "coach",
      text: "Keep Saturday easy; the work is Sunday.",
      createdAt: "2026-11-05T09:10:00.000Z",
      contextHash: "sha256:fact-snapshot",
      reviewId: null,
    });

    try {
      const first = createSqliteRepository({ filename });
      try {
        first.appendCoachMessage(stored);
      } finally {
        first.close();
      }

      const reopened = createSqliteRepository({ filename });
      try {
        expect(reopened.listCoachMessages("runner-1")).toEqual([stored]);
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
