import { NextResponse } from "next/server";
import { prisma } from "@/db/client";

export async function GET() {
  try {
    const parents = await prisma.parent.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(parents);
  } catch (error) {
    console.error("GET /api/parents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
