export type AuctionVerb =
  | "POST_JOB"
  | "OFFER"
  | "COUNTER"
  | "COALITION_INVITE"
  | "JOIN"
  | "BID"
  | "WIN"
  | "FAILOVER"
  | "BREACH"
  | "SLASH_TX"
  | "SETTLE"
  | "ROYALTY";

export type AuctionAgentTone = "default" | "b" | "p" | "r";

export type AuctionLogRow = {
  id: string;
  t: string;
  agent: string;
  agentTone?: AuctionAgentTone;
  verb: AuctionVerb;
  body: string;
  win?: boolean;
};

export type AuctionJob = {
  round: string;
  jobId: string;
  model: string;
  budgetEth: string;
  deadline: string;
};

export type AuctionLeading = {
  leadingBid: string;
  leadingCoalition: string;
};

