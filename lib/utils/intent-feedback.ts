export type IntentRoute = "text_only" | "structure_required";

export interface IntentFeedbackEvent {
  timestamp: string;
  route: IntentRoute;
  verdict: "correct" | "incorrect";
  question?: string;
}

const STORAGE_KEY = "biojarvis_intent_feedback_v1";

interface IntentFeedbackStore {
  total: number;
  correct: number;
  incorrect: number;
  byRoute: Record<
    IntentRoute,
    { total: number; correct: number; incorrect: number }
  >;
  events: IntentFeedbackEvent[];
}

function defaultStore(): IntentFeedbackStore {
  return {
    total: 0,
    correct: 0,
    incorrect: 0,
    byRoute: {
      text_only: { total: 0, correct: 0, incorrect: 0 },
      structure_required: { total: 0, correct: 0, incorrect: 0 },
    },
    events: [],
  };
}

export function getIntentFeedbackStore(): IntentFeedbackStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as IntentFeedbackStore;
    if (!parsed || typeof parsed !== "object") return defaultStore();
    return {
      ...defaultStore(),
      ...parsed,
      byRoute: {
        ...defaultStore().byRoute,
        ...(parsed.byRoute || {}),
      },
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return defaultStore();
  }
}

export function recordIntentFeedback(
  event: IntentFeedbackEvent,
): IntentFeedbackStore {
  if (typeof window === "undefined") return defaultStore();
  const current = getIntentFeedbackStore();
  const next: IntentFeedbackStore = {
    ...current,
    total: current.total + 1,
    correct: current.correct + (event.verdict === "correct" ? 1 : 0),
    incorrect: current.incorrect + (event.verdict === "incorrect" ? 1 : 0),
    byRoute: {
      ...current.byRoute,
      [event.route]: {
        total: current.byRoute[event.route].total + 1,
        correct:
          current.byRoute[event.route].correct +
          (event.verdict === "correct" ? 1 : 0),
        incorrect:
          current.byRoute[event.route].incorrect +
          (event.verdict === "incorrect" ? 1 : 0),
      },
    },
    events: [event, ...current.events].slice(0, 200),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return current;
  }

  return next;
}
