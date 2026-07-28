import { db } from "@shootermarkt/db";
import { shooters, clubs } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { SearchBarClient } from "../search-bar-client";

export async function HeaderSearch() {
  const shootersList = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      clubName: clubs.name,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(eq(shooters.verified, true))
    .orderBy(shooters.lastName, shooters.firstName);

  return (
    <div className="flex-1 max-w-sm hidden md:block">
      <SearchBarClient shootersList={shootersList} />
    </div>
  );
}
