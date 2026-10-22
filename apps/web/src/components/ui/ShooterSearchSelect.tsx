export interface ShooterOption {
  id: number;
  firstName: string;
  lastName: string;
  /** Staro prezime koje je pogođeno pretragom (prikazuje se u zagradi) */
  matchedLastName?: string | null;
  nationality?: string | null;
  clubName?: string | null;
}
