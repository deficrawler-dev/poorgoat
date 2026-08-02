export const TOKENS = {
  ansem: {
    symbol: "ANSEM",
    name: "The Black Bull",
    mint: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
    pairAddress: "fnzky6x7entq1er3d225dqyt7ybfka4pskbmqhb8l3cc",
    dexUrl:
      "https://dexscreener.com/solana/fnzky6x7entq1er3d225dqyt7ybfka4pskbmqhb8l3cc",
    scoreWeight: 75,
  },
  poorGoat: {
    symbol: "POORGOAT",
    name: "PoorGoat",
    mint: "3m5WmiAs3TewbB9S96jpwuGfodTnn4PVM8a1ytVQpump",
    pairAddress: "6unw1k65axgj7gtdxa9qbmah5ejqshlucwafm7rpqsrl",
    dexUrl:
      "https://dexscreener.com/solana/6unw1k65axgj7gtdxa9qbmah5ejqshlucwafm7rpqsrl",
    scoreWeight: 25,
  },
} as const;

export const SITE = {
  name: "PoorGoat",
  domain: "poorgoat.fun",
  description:
    "Live $POORGOAT market data and an on-chain conviction score for the $ANSEM ecosystem.",
} as const;