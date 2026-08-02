import type { Metadata } from "next";

import { PoorGoatLanding } from "@/components/PoorGoatLanding";

interface SharedScorePageProps {
  params: Promise<{ wallet: string }>;
  searchParams: Promise<{ x?: string | string[] }>;
}

export async function generateMetadata({ params }: SharedScorePageProps): Promise<Metadata> {
  const { wallet } = await params;
  const shortWallet = `${wallet.slice(0, 5)}...${wallet.slice(-5)}`;

  return {
    title: `${shortWallet} GoatScore`,
    description: "View this wallet's $ANSEM and $POORGOAT conviction score.",
  };
}

export default async function SharedScorePage({
  params,
  searchParams,
}: SharedScorePageProps) {
  const { wallet } = await params;
  const query = await searchParams;
  const xUsername = Array.isArray(query.x) ? query.x[0] : query.x;

  return (
    <PoorGoatLanding
      initialWallet={wallet}
      initialXUsername={xUsername ?? ""}
      autoAnalyse
    />
  );
}
