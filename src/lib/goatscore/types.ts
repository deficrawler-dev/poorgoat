export type ActivityKind = "bought" | "sold" | "received" | "transferred";
export type TokenKey = "ansem" | "poorGoat";

export interface GoatScoreActivity {
  signature: string;
  timestamp: string;
  token: TokenKey;
  symbol: "ANSEM" | "POORGOAT";
  kind: ActivityKind;
  amount: number;
  counterparty: string | null;
}

export interface TokenScoreSummary {
  token: TokenKey;
  symbol: "ANSEM" | "POORGOAT";
  mint: string;
  score: number;
  maxScore: number;
  currentBalance: number;
  totalBought: number;
  totalSold: number;
  totalReceived: number;
  totalTransferred: number;
  peakBalance: number;
  retainedPercentage: number;
  holdingDays: number;
  firstActivityAt: string | null;
  accumulationEvents: number;
  majorExits: number;
  currentlyHolding: boolean;
}

export interface GoatScoreResult {
  resultId: string;
  wallet: string;
  xUsername: string | null;
  generatedAt: string;
  score: number;
  rank: string;
  rankNote: string;
  ansem: TokenScoreSummary;
  poorGoat: TokenScoreSummary;
  activity: GoatScoreActivity[];
  artwork: {
    ansemIndex: number;
    poorGoatIndex: number;
  };
  historyTruncated: boolean;
}
