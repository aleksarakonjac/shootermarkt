# Project Vision: "Transfermarkt for Sport Shooting"

## Overview

The goal is **not** to build another sports news website.

The goal is to build **the world's largest structured database for sport
shooting**, similar to what Transfermarkt became for football.

Transfermarkt's success did not come from articles or transfer rumors.
It became valuable because it created the most comprehensive database of
football players, clubs, competitions, transfers and statistics, while
allowing the community to continuously improve the data.

This project should follow the same philosophy.

The website should become the primary source of truth for competitive
shooting.

------------------------------------------------------------------------

## Core Philosophy

Everything revolves around structured data.

News is secondary.

Articles are secondary.

The database is the product.

Every page should represent an entity inside the sport.

Examples:

-   Athlete
-   Competition
-   Club
-   National Team
-   Coach
-   Federation
-   Country
-   Shooting Range
-   Equipment
-   Manufacturer
-   Match
-   Qualification Round
-   Final
-   World Ranking
-   National Ranking
-   Record
-   Season

Everything should be interconnected.

------------------------------------------------------------------------

## Long-Term Vision

Imagine someone searching for an athlete. They shouldn't only find a
biography, but also their career, statistics, rankings, competition
history, equipment, coach, club, records, and historical performance
graphs.

Every entity should have its own permanent page.

------------------------------------------------------------------------

## The Database Is the Product

The platform should primarily be a relational database exposed through a
web interface.

Example relationship graph:

Athlete → Competition → Qualification → Series → Shots → Equipment →
Manufacturer

The graph of relationships is the real asset.

------------------------------------------------------------------------

## Main Entities

### Athlete

-   Name
-   Nationality
-   Gender
-   Birth date
-   Club
-   National team
-   Coach
-   Events
-   Ranking
-   Biography
-   Career timeline
-   Personal best
-   Season best
-   Equipment
-   Results
-   Finals
-   Medals
-   Records

### Competition

-   Name
-   Organizer
-   Federation
-   Country
-   Venue
-   Date
-   Event list
-   Athletes
-   Results
-   Qualification
-   Finals
-   Medalists
-   Historical editions

### Club

-   Members
-   Coaches
-   Country
-   History
-   Results
-   Medal count

### Coach

-   Athletes coached
-   Club
-   National team
-   Career

### Equipment

-   Rifle
-   Pistol
-   Jacket
-   Pants
-   Shoes
-   Sight
-   Ammunition
-   Accessories

Each equipment page should include manufacturer, model, technical
specifications, and athletes using it.

------------------------------------------------------------------------

## Community Contribution

Users should eventually be able to submit:

-   Results
-   Athlete profiles
-   Equipment
-   Clubs
-   Coaches
-   Competition information
-   Photos

Workflow:

1.  User submits
2.  Moderator reviews
3.  Approve / Reject
4.  Database updates

Every edit should be logged.

------------------------------------------------------------------------

## Data Quality

Every record should include:

-   Source
-   Date added
-   Last updated
-   Editor
-   Verification status

------------------------------------------------------------------------

## Search

Search should instantly find:

-   Athletes
-   Competitions
-   Clubs
-   Coaches
-   Equipment
-   Countries
-   Manufacturers
-   Records
-   Rankings

------------------------------------------------------------------------

## Statistics

Examples:

-   Average score
-   Best score
-   Finals percentage
-   Medal percentage
-   Ranking progression
-   Historical winners
-   Medal tables

------------------------------------------------------------------------

## Rankings

Support dynamic rankings:

-   World
-   Continental
-   National
-   Junior
-   Senior
-   Club
-   Season
-   All-time

------------------------------------------------------------------------

## Historical Data

Never overwrite history.

Store timelines for:

-   Clubs
-   Coaches
-   Equipment
-   Rankings
-   Records

------------------------------------------------------------------------

## SEO Philosophy

Every entity should have:

-   Permanent URL
-   Metadata
-   Structured schema
-   Internal links
-   Related entities

The goal is to create millions of highly indexable pages over time.

------------------------------------------------------------------------

## Future Features

-   Live competition center
-   Performance analytics
-   Training diary
-   SCATT integration
-   Electronic target integration
-   Equipment comparison
-   AI-powered performance analysis
-   Social features

------------------------------------------------------------------------

## Growth Flywheel

Athletes upload results

↓

Database grows

↓

Profiles become more complete

↓

Search engines index more pages

↓

More visitors arrive

↓

More athletes join

↓

More competitions are added

↓

Platform becomes the authoritative source

------------------------------------------------------------------------

## Architectural Principles

-   Database-first architecture
-   Strong relational data model
-   Modular design
-   API-first
-   Scalable
-   SEO-friendly
-   Auditability
-   Role-based permissions

The frontend should simply expose the database. The long-term
competitive advantage is the quality, depth, and interconnectedness of
the underlying data.
