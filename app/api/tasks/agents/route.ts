// app/api/tasks/agents/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const BASE_AGENT_SELECT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  image: true,
  category: true,
  phone: true,
  address: true,
  biography: true,
  status: true,
  createdAt: true,
  role: { select: { name: true } },
} as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId") ?? undefined; // e.g., "asset-team"
    const teamName = searchParams.get("teamName") ?? undefined; // optional alternative

    // Base filter: only users with Agent role (case variants)
    const baseWhere: any = {
      role: {
        name: { in: ["agent", "Agent", "AGENT"] },
      },
    };

    // Optional team filter across either membership table
    if (teamId || teamName) {
      const teamFilter = teamId
        ? { teamId } // exact id match
        : { team: { name: { equals: teamName!, mode: "insensitive" } } }; // name match

      baseWhere.OR = [
        { templateTeamMemberships: { some: teamFilter } }, // TemplateTeamMember
        { clientTeamMemberships: { some: teamFilter } }, // ClientTeamMember
      ];
    }

    // OPTIMIZATION (field projection + micro-cache): only return lightweight agent payloads and allow CDN reuse.
    const agents = await prisma.user.findMany({
      where: baseWhere,
      select: BASE_AGENT_SELECT,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Transform the data to match frontend expectations (biography -> bio)
    const transformedAgents = agents.map((agent) => ({
      ...agent,
      bio: agent.biography,
      biography: undefined, // Remove the original field
    }));

    return NextResponse.json(transformedAgents, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { message: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
