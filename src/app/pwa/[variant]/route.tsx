import { brandIcon } from "@/lib/brand-icon";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ variant: "192" }, { variant: "512" }, { variant: "maskable" }];
}

export async function GET(_req: Request, ctx: { params: Promise<{ variant: string }> }) {
  const { variant } = await ctx.params;
  if (variant === "maskable") return brandIcon(512, true);
  return brandIcon(variant === "192" ? 192 : 512);
}
