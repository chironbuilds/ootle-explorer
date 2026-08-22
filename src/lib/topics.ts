export const TOPIC_LABEL: Record<string, { label: string; tone: "success" | "danger" | "accent" }> = {
  "std.vault.deposit": { label: "Deposit", tone: "success" },
  "std.vault.withdraw": { label: "Withdraw", tone: "danger" },
  "std.resource.mint": { label: "Mint", tone: "success" },
  "std.resource.burn": { label: "Burn", tone: "danger" },
};

export const KNOWN_TOPICS = Object.keys(TOPIC_LABEL);
