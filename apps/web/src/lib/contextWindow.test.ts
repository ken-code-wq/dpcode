import { describe, expect, it } from "vitest";
import { EventId, type OrchestrationThreadActivity, TurnId, ThreadId } from "@t3tools/contracts";

import {
  deriveContextWindowSelectionStatus,
  deriveContextWindowMeterDisplay,
  deriveCumulativeCostUsd,
  deriveLatestContextWindowSnapshot,
  deriveSelectedContextWindowSnapshot,
  formatContextWindowSelectionLabel,
  formatContextWindowTokens,
  inferContextWindowSelectionValue,
  estimateDraftTokens,
  getModelDefaultContextWindowLimit,
  deriveDefaultContextWindowSnapshot,
  fallbackContextWindowSnapshot,
} from "./contextWindow";

function makeActivity(
  id: string,
  kind: string,
  payload: OrchestrationThreadActivity["payload"],
): OrchestrationThreadActivity {
  return {
    id: EventId.makeUnsafe(id),
    tone: "info",
    kind,
    summary: kind,
    payload,
    turnId: TurnId.makeUnsafe("turn-1"),
    createdAt: "2026-03-23T00:00:00.000Z",
  };
}

describe("contextWindow", () => {
  it("derives the latest valid context window snapshot", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 1000,
      }),
      makeActivity("activity-2", "tool.started", {}),
      makeActivity("activity-3", "context-window.updated", {
        usedTokens: 14_000,
        maxTokens: 258_000,
        compactsAutomatically: true,
      }),
    ]);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.usedTokens).toBe(14_000);
    expect(snapshot?.totalProcessedTokens).toBeNull();
    expect(snapshot?.maxTokens).toBe(258_000);
    expect(snapshot?.compactsAutomatically).toBe(true);
  });

  it("ignores malformed payloads", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {}),
    ]);

    expect(snapshot).toBeNull();
  });

  it("derives percent-only context window snapshots", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 0,
        usedPercent: 5.8,
        compactsAutomatically: true,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(0);
    expect(snapshot?.usedPercent).toBe(5.8);
    expect(snapshot?.usedPercentage).toBe(5.8);
    expect(snapshot?.maxTokens).toBeNull();
    expect(snapshot?.compactsAutomatically).toBe(true);
  });

  it("derives real zero-percent context window snapshots", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 0,
        usedPercent: 0,
        compactsAutomatically: true,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(0);
    expect(snapshot?.usedPercent).toBe(0);
    expect(snapshot?.usedPercentage).toBe(0);
  });

  it("keeps zero-token usage reliable when runtime reports max tokens", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 0,
        usedPercent: 0,
        maxTokens: 128_000,
        compactsAutomatically: true,
      }),
    ]);

    expect(snapshot?.remainingTokens).toBe(128_000);
    expect(deriveContextWindowMeterDisplay(snapshot!)).toMatchObject({
      hasReliableTokenRatio: true,
      tokenUsageLabel: "0",
      compactLabel: "0%",
    });
  });

  it("does not infer remaining tokens from percent-only usage", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.configured", {
        contextWindow: "1m",
        maxTokens: 1_000_000,
      }),
      makeActivity("activity-2", "context-window.updated", {
        usedTokens: 0,
        usedPercent: 5.8,
        compactsAutomatically: true,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(0);
    expect(snapshot?.usedPercentage).toBe(5.8);
    expect(snapshot?.maxTokens).toBe(1_000_000);
    expect(snapshot?.remainingTokens).toBeNull();
  });

  it("formats compact token counts", () => {
    expect(formatContextWindowTokens(999)).toBe("999");
    expect(formatContextWindowTokens(1400)).toBe("1.4k");
    expect(formatContextWindowTokens(14_000)).toBe("14k");
    expect(formatContextWindowTokens(258_000)).toBe("258k");
  });

  it("includes total processed tokens when available", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 81_659,
        totalProcessedTokens: 748_126,
        maxTokens: 258_400,
        lastUsedTokens: 81_659,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(81_659);
    expect(snapshot?.totalProcessedTokens).toBe(748_126);
  });

  it("uses the configured session max tokens when usage snapshots lag behind", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.configured", {
        contextWindow: "1m",
        maxTokens: 1_000_000,
      }),
      makeActivity("activity-2", "context-window.updated", {
        usedTokens: 23_000,
        maxTokens: 200_000,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(23_000);
    expect(snapshot?.maxTokens).toBe(1_000_000);
  });

  it("returns a session snapshot from configured max tokens before usage arrives", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.configured", {
        contextWindow: "1m",
        maxTokens: 1_000_000,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(0);
    expect(snapshot?.maxTokens).toBe(1_000_000);
  });

  it("creates an initial selected context window snapshot before runtime usage arrives", () => {
    const snapshot = deriveSelectedContextWindowSnapshot("1m");

    expect(snapshot?.usedTokens).toBe(0);
    expect(snapshot?.maxTokens).toBe(1_000_000);
    expect(snapshot?.usedPercentage).toBe(0);
  });

  it("derives meter display labels without inventing token ratios", () => {
    const percentOnly = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.configured", {
        contextWindow: "1m",
        maxTokens: 1_000_000,
      }),
      makeActivity("activity-2", "context-window.updated", {
        usedTokens: 0,
        usedPercent: 5.8,
      }),
    ]);

    expect(percentOnly).not.toBeNull();
    expect(deriveContextWindowMeterDisplay(percentOnly!)).toMatchObject({
      usedPercentageLabel: "5.8%",
      tokenUsageLabel: "0",
      hasReliableTokenRatio: false,
      normalizedPercentage: 5.8,
      compactLabel: "6%",
      ariaLabel: "Context window 5.8% used",
    });
  });

  it("formats context window selection labels for Claude options", () => {
    expect(formatContextWindowSelectionLabel("1m")).toBe("1M");
    expect(formatContextWindowSelectionLabel("200k")).toBe("200k");
  });

  it("uses Cursor cumulative cost without summing it as a turn delta", () => {
    expect(
      deriveCumulativeCostUsd([
        makeActivity("turn-1", "turn.completed", {
          cumulativeCostUsd: 0.2,
        }),
        makeActivity("turn-2", "turn.completed", {
          cumulativeCostUsd: 0.25,
        }),
      ]),
    ).toBe(0.25);
  });

  it("infers the active Claude context window from max tokens", () => {
    expect(inferContextWindowSelectionValue(200_000)).toBe("200k");
    expect(inferContextWindowSelectionValue(1_000_000)).toBe("1m");
    expect(inferContextWindowSelectionValue(333_000)).toBeNull();
  });

  it("marks a selected Claude context window as pending when the live session differs", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 23_000,
        maxTokens: 200_000,
      }),
    ]);

    expect(
      deriveContextWindowSelectionStatus({
        activeSnapshot: snapshot,
        selectedValue: "1m",
      }),
    ).toEqual({
      activeLabel: "200k",
      selectedLabel: "1M",
      pendingSelectedLabel: "1M",
    });
  });

  it("estimates draft tokens correctly", () => {
    const dummyTerminalContext = {
      id: "test-id",
      threadId: ThreadId.makeUnsafe("test-thread"),
      createdAt: "2026-03-23T00:00:00.000Z",
      terminalId: "term-1",
      terminalLabel: "Terminal 1",
      lineStart: 1,
      lineEnd: 5,
      text: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
    };

    const tokens = estimateDraftTokens({
      prompt: "Hello world",
      images: [{ sizeBytes: 12345 }],
      assistantSelections: [{ text: "Hello from assistant" }],
      terminalContexts: [dummyTerminalContext],
    });

    expect(tokens).toBeGreaterThan(1000);
  });

  it("resolves default context window limits", () => {
    expect(getModelDefaultContextWindowLimit("claudeAgent", "any")).toBe(200_000);
    expect(getModelDefaultContextWindowLimit("gemini", "any")).toBe(1_000_000);
    expect(getModelDefaultContextWindowLimit("pi", "any")).toBe(16_384);
    expect(getModelDefaultContextWindowLimit("codex", "any")).toBe(128_000);
  });

  it("derives default context window snapshot", () => {
    const snapshot = deriveDefaultContextWindowSnapshot("gemini", "any");
    expect(snapshot.maxTokens).toBe(1_000_000);
    expect(snapshot.usedTokens).toBe(0);
    expect(snapshot.usedPercentage).toBe(0);
  });

  describe("fallbackContextWindowSnapshot", () => {
    it("returns default snapshot when input is null or undefined", () => {
      const snapshot = fallbackContextWindowSnapshot(null, "gemini", "any");
      expect(snapshot.maxTokens).toBe(1_000_000);
      expect(snapshot.usedTokens).toBe(0);
      expect(snapshot.usedPercentage).toBe(0);
    });

    it("returns snapshot unchanged if maxTokens is already set and positive", () => {
      const original = {
        usedTokens: 10_000,
        usedPercent: null,
        totalProcessedTokens: null,
        maxTokens: 500_000,
        remainingTokens: 490_000,
        usedPercentage: 2,
        remainingPercentage: 98,
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        reasoningOutputTokens: null,
        lastUsedTokens: null,
        lastInputTokens: null,
        lastCachedInputTokens: null,
        lastOutputTokens: null,
        lastReasoningOutputTokens: null,
        toolUses: null,
        durationMs: null,
        compactsAutomatically: false,
        updatedAt: "some-date",
      };
      const snapshot = fallbackContextWindowSnapshot(original, "gemini", "any");
      expect(snapshot).toEqual(original);
    });

    it("supplies default limit and recalculates percentages/tokens when maxTokens is null or 0", () => {
      const original = {
        usedTokens: 250_000,
        usedPercent: null,
        totalProcessedTokens: null,
        maxTokens: null,
        remainingTokens: null,
        usedPercentage: null,
        remainingPercentage: null,
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        reasoningOutputTokens: null,
        lastUsedTokens: null,
        lastInputTokens: null,
        lastCachedInputTokens: null,
        lastOutputTokens: null,
        lastReasoningOutputTokens: null,
        toolUses: null,
        durationMs: null,
        compactsAutomatically: false,
        updatedAt: "some-date",
      };
      const snapshot = fallbackContextWindowSnapshot(original, "gemini", "any");
      expect(snapshot.maxTokens).toBe(1_000_000);
      expect(snapshot.usedPercentage).toBe(25);
      expect(snapshot.remainingTokens).toBe(750_000);
      expect(snapshot.remainingPercentage).toBe(75);
    });
  });
});
