# Domain Context

## Discipline Codes

- `R3PM` is the canonical code for 50m Rifle 3 Positions Men.
- `R3PW` is the canonical code for 50m Rifle 3 Positions Women.
- `RFM` and `RFW` are legacy source aliases only. They must be normalized at import boundaries and must not be stored or emitted by the application.

## Editorial Taxonomy

- An article has one **category**: `vest`, `takmicenje`, `rezultati`, `reprezentacija`, `analiza`, `intervju`, or `oprema`.
- A **tag** is either a free-form topic or a reference to one sports entity. Entity tags retain the stable entity ID and a display label.
- **Shooter**, **competition**, and **club** tags use `refId`; a **discipline** tag uses its canonical discipline code.
