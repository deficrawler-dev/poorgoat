import { NextResponse } from "next/server";
import { z } from "zod";

import { analyseGoatScore } from "@/lib/goatscore/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  wallet: z
    .string()
    .trim()
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Enter a valid Solana wallet address."),
  xUsername: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((value: string | undefined) => value?.replace(/^@/, "") ?? "")
    .refine(
      (value: string) => value === "" || /^[A-Za-z0-9_]{1,15}$/.test(value),
      "Enter a valid X username.",
    ),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await analyseGoatScore(body.wallet, body.xUsername || null);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: (error as { issues: Array<{ message?: string }> }).issues[0]?.message ?? "Check the details and try again.",
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Wallet analysis failed.";
    const status = message.includes("HELIUS_API_KEY") ? 503 : 500;

    console.error("GoatScore analysis failed:", error);

    return NextResponse.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
