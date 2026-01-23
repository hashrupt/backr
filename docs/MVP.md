# Backr MVP Plan

## Overview

Backr is a crowdsourced staking platform for the **Canton Network** that enables CC (Canton Coin) holders to collectively back Featured Apps and Validators. This solves the high barrier to entry created by CIP-TBD (Featured App Staking & Validator Staking), which requires significant CC holdings for network participation.

### The Problem

- Featured Apps on Canton need 10M CC (Phase 1) to 25M CC (Phase 2) staked
- Validators need 1M CC (Phase 1) to 2M CC (Phase 2) staked
- Small builders and operators can't afford millions in CC upfront
- CIP allows **any CC holder** to stake on behalf of an app or validator (third-party backing)
- Without a platform, this creates fragmented off-chain lending markets

### Backr's Solution

- Pool CC from multiple holders to back **Featured Apps** and **Validators**
- Transparent on-chain attribution (who backed which entity)
- Lower barrier for builders and operators
- Democratized participation for CC holders
- **Pre-populated registry** of known entities from public sources
- **Claim your entity** flow for verified ownership
- **Campaign-based backing** with curated backer selection

### CIP Requirements Summary

| Entity Type | Phase 1 | Phase 2 | Grace Period | Unlock Period |
|-------------|---------|---------|--------------|---------------|
| Featured App | 10M CC | 25M CC | 7 days | 365 days |
| Validator | 1M CC | 2M CC | 30 days | 365 days |

---

## MVP Scope

### Core Features

1. **User Authentication** - Email/password + Canton wallet connection
2. **Entity Registry** - Browse Featured Apps and Validators seeking backing
3. **Entity Import** - Pre-populate entities from Canton scanners + Tokenomics listings
4. **Claim Your Entity** - Verify ownership via PartyId wallet signature (like Google "claim your business")
5. **Self-Registration** - Register entities not found in imported data
6. **Backing Campaigns** - Validated entities create campaigns to raise CC backing
7. **Interest Registration** - Users register interest in backing with their profile/preferences
8. **Backer Selection** - Entity owners invite backers directly or select from interested users
9. **CC Pooling Dashboard** - Track contributions, pool progress, attribution
10. **Grace Period Alerts** - Notify when backing falls below thresholds
11. **Unlock Tracking** - Monitor 365-day unlock countdowns

### Entity Import & Claim Flow

#### Data Sources

| Source | Type | Data Provided |
|--------|------|---------------|
| Canton Scanner API | Automated | Validators, Featured Apps, PartyIds, on-chain status |
| Tokenomics Group List | Manual CSV | Curated app/validator list with metadata |

#### Claim Verification

Ownership verification uses **smart contract-based PartyId verification**:

1. Entity imported with known `partyId` from public sources
2. User connects Canton wallet to Backr
3. User initiates claim for an entity
4. Smart contract verifies caller's PartyId matches entity's registered PartyId
5. On successful verification, entity ownership transfers to user

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Public Source  │────▶│  Backr Import   │────▶│  Entity Record  │
│  (Scanner/CSV)  │     │  Service        │     │  (UNCLAIMED)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User Wallet    │────▶│  Smart Contract │────▶│  Entity Record  │
│  (PartyId)      │     │  Verification   │     │  (CLAIMED)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Campaign & Backer Selection Flow

Once an entity is claimed/validated, owners can run **backing campaigns** to raise CC from the community.

#### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Entity Owner   │────▶│  Create         │────▶│  Campaign       │
│  (Validated)    │     │  Campaign       │     │  (OPEN)         │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
        ┌────────────────────────────────────────────────┤
        │                                                │
        ▼                                                ▼
┌─────────────────┐                             ┌─────────────────┐
│  Users Register │                             │  Owner Sends    │
│  Interest       │                             │  Direct Invites │
└────────┬────────┘                             └────────┬────────┘
         │                                               │
         └───────────────────┬───────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Owner Reviews  │
                    │  & Selects      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Selected Users │
                    │  Pledge CC      │
                    └─────────────────┘
```

#### Campaign Features

| Feature | Description |
|---------|-------------|
| Campaign Creation | Set target amount, deadline, min/max contribution, terms |
| Public Visibility | Campaigns visible to all users for discovery |
| Interest Registration | Users submit interest with pledge amount + profile info |
| Direct Invites | Owners can invite specific users by email or PartyId |
| Backer Review | Owners view all interested users with their details |
| Selection Criteria | Filter by pledge amount, wallet history, or custom criteria |
| Accept/Decline | Owners accept or decline each interested user |
| Pledge Confirmation | Accepted users confirm and lock their CC pledge |

#### User Flows

**Flow A: Claim Existing Entity**
1. User browses entity registry
2. Finds their app/validator (imported from public sources)
3. Clicks "Claim This Entity"
4. Connects Canton wallet
5. Signs verification transaction
6. Smart contract confirms PartyId match
7. Entity marked as claimed, user becomes owner

**Flow B: Register New Entity**
1. User searches for their entity
2. Entity not found in registry
3. Clicks "Register New Entity"
4. Fills entity details + provides PartyId
5. Verification via wallet signature
6. Entity created with user as owner

**Flow C: Create Backing Campaign (Entity Owner)**
1. Navigate to My Entities dashboard
2. Select entity and click "Create Campaign"
3. Set campaign parameters:
   - Target CC amount
   - Campaign deadline
   - Min/max contribution per backer
   - Description and terms
4. Publish campaign (status: OPEN)
5. Optionally send direct invites to known backers

**Flow D: Register Interest (Backer)**
1. Browse open campaigns
2. View campaign details and entity info
3. Click "Register Interest"
4. Submit interest form:
   - Intended pledge amount
   - Brief intro / why they want to back
   - Any relevant background
5. Wait for owner review

**Flow E: Select Backers (Entity Owner)**
1. View campaign dashboard
2. See all registered interests + direct invite responses
3. Review each user's profile and pledge amount
4. Accept or decline each interested user
5. Accepted users notified and can proceed to pledge

### Canton-Specific Concepts

| Term | Definition |
|------|------------|
| CC (Canton Coin) | Native token of Canton Network |
| Featured App (FA) | Approved app with visibility and reward access |
| Validator | Network node operator providing infrastructure |
| PartyId | Canton identifier for entities and wallets |
| SV (Super Validator) | Major network validators with governance power |
| Bonding/Staking | Locking CC on behalf of an entity |

### Out of Scope (Post-MVP)

- On-chain locking integration (Phase 2 of CIP)
- SV delegation/sponsorship marketplace
- Staking reward distribution/APY calculations
- Crowdfunding for non-Canton projects
- Governance/voting on entity quality
- Mobile app

---

## User Stories

### As a CC Holder (Backer)

| ID | Story | Description |
|----|-------|-------------|
| B1 | Registration | I can create an account with email/password so I can access the platform |
| B2 | Wallet Connection | I can connect my Canton wallet and link my PartyId to my account |
| B3 | Profile Setup | I can add a bio to my profile so entity owners can learn about me |
| B4 | Browse Entities | I can browse Featured Apps and Validators to discover backing opportunities |
| B5 | Browse Campaigns | I can browse open backing campaigns to find ones I'm interested in |
| B6 | Register Interest | I can register my interest in a campaign with my intended pledge amount and a message about why I want to back |
| B7 | View My Interests | I can see all my registered interests and their status (pending, accepted, declined) |
| B8 | Receive Invites | I can receive direct invites from entity owners to back their campaigns |
| B9 | Respond to Invites | I can accept or decline invites I receive |
| B10 | Pledge CC | Once accepted, I can pledge my CC to back an entity |
| B11 | View My Backings | I can see all my backing positions with attribution details |
| B12 | Request Unlock | I can initiate the 365-day unlock process for my backed CC |
| B13 | Track Unlocks | I can monitor my unlock countdowns |

### As an Entity Owner (App/Validator Operator)

| ID | Story | Description |
|----|-------|-------------|
| O1 | Find My Entity | I can search for my app/validator in the pre-populated registry |
| O2 | Claim Entity | I can claim ownership of my entity by signing with my PartyId wallet |
| O3 | Register New Entity | If my entity isn't listed, I can register it with PartyId verification |
| O4 | View My Entities | I can see all entities I own/have claimed |
| O5 | Create Campaign | I can create a backing campaign with target amount, deadline, and terms |
| O6 | Set Contribution Limits | I can set min/max contribution amounts per backer |
| O7 | Publish Campaign | I can publish my campaign to make it visible to potential backers |
| O8 | View Interests | I can see all users who registered interest in my campaign |
| O9 | Review Backers | I can review each interested user's profile, bio, and pledge amount |
| O10 | Accept/Decline | I can accept or decline each interested user |
| O11 | Send Direct Invites | I can invite specific users by email or PartyId |
| O12 | Bulk Invite | I can send invites to multiple users at once |
| O13 | Track Progress | I can monitor my campaign's progress toward the CC goal |
| O14 | Close Campaign | I can close my campaign when target is reached or deadline passes |
| O15 | Grace Period Alerts | I get notified when my backing drops below CIP thresholds |

### As an Admin

| ID | Story | Description |
|----|-------|-------------|
| A1 | Import from Scanner | I can trigger an import of entities from Canton scanner APIs |
| A2 | Import from CSV | I can upload and import entities from Tokenomics group CSV files |
| A3 | Monitor Imports | I can check the status of import jobs |

### As a Visitor (Not Logged In)

| ID | Story | Description |
|----|-------|-------------|
| V1 | Learn About Backr | I can view the landing page explaining Backr and CIP context |
| V2 | Browse Entities | I can browse Featured Apps and Validators without logging in |
| V3 | Browse Campaigns | I can see open campaigns to understand the platform |
| V4 | View Leaderboard | I can see top backers and most-backed entities |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js |
| Wallet | wagmi + viem (EVM), modular adapters |
| State | Zustand |
| Validation | Zod |
| Testing | Vitest + Playwright |

---

## Project Structure

```
backr/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth routes
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/        # Protected routes
│   │   │   ├── apps/           # Featured Apps listing & details
│   │   │   ├── validators/     # Validators listing & details
│   │   │   ├── campaigns/      # Browse open campaigns
│   │   │   ├── my-backings/    # User's backing positions
│   │   │   ├── my-interests/   # User's registered interests
│   │   │   ├── my-entities/    # Owner's claimed entities
│   │   │   ├── my-campaigns/   # Owner's campaign management
│   │   │   ├── claim-entity/   # Claim flow for imported entities
│   │   │   ├── register-entity/# Register app/validator (if not imported)
│   │   │   ├── leaderboard/    # Top backers & entities
│   │   │   ├── unlock-tracker/ # 365-day unlock countdowns
│   │   │   └── profile/        # User settings + PartyId
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # NextAuth endpoints
│   │   │   ├── entities/       # Entity CRUD
│   │   │   ├── campaigns/      # Campaign CRUD
│   │   │   ├── interests/      # Interest registration
│   │   │   ├── invites/        # Direct invites
│   │   │   ├── import/         # Entity import endpoints
│   │   │   ├── claim/          # Claim verification endpoints
│   │   │   ├── backings/       # Backing operations
│   │   │   └── stats/          # Analytics
│   │   ├── layout.tsx
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── ui/                 # Base UI (buttons, cards, etc.)
│   │   ├── entities/           # Entity cards, lists, details
│   │   ├── campaigns/          # Campaign cards, forms, dashboard
│   │   ├── interests/          # Interest forms, lists
│   │   ├── claim/              # Claim flow components
│   │   ├── backings/           # Backing forms, progress bars
│   │   ├── wallet/             # Canton wallet connection
│   │   └── layout/             # Header, footer, nav
│   ├── lib/
│   │   ├── db.ts               # Prisma client
│   │   ├── auth.ts             # NextAuth config
│   │   ├── constants.ts        # CC requirements, grace periods
│   │   ├── validations/        # Zod schemas
│   │   └── utils.ts            # Helpers
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   ├── types/                  # TypeScript types
│   └── services/
│       ├── entity.service.ts   # Entity business logic
│       ├── campaign.service.ts # Campaign business logic
│       ├── interest.service.ts # Interest/invite logic
│       ├── backing.service.ts  # Backing logic
│       ├── import/             # Entity import services
│       │   ├── scanner.ts      # Canton scanner API client
│       │   ├── csv-parser.ts   # Tokenomics CSV parser
│       │   └── importer.ts     # Unified import orchestrator
│       └── canton/             # Canton Network integration
│           ├── types.ts        # Canton types
│           ├── service.ts      # Canton API client
│           ├── verification.ts # Claim verification logic
│           └── mock.ts         # Mock for MVP
├── prisma/
│   └── schema.prisma           # Database schema
├── data/
│   └── imports/                # CSV files for manual import
├── scripts/
│   └── import-entities.ts      # CLI script to run imports
├── public/
├── tests/
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Database Schema

### User

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String?
  bio           String?   // Brief intro for interest registrations
  partyId       String?   @unique  // Canton PartyId
  walletAddress String?   @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  backings      Backing[]
  ownedEntities Entity[]  @relation("EntityOwner")
  interests     Interest[]
  sentInvites   CampaignInvite[] @relation("InviteSender")
  receivedInvites CampaignInvite[] @relation("InviteRecipient")
}
```

### Entity (Featured Apps & Validators)

```prisma
model Entity {
  id              String        @id @default(cuid())
  type            EntityType    // FEATURED_APP or VALIDATOR
  name            String
  description     String?
  partyId         String        @unique  // Canton PartyId
  website         String?
  logoUrl         String?

  // Bonding status
  targetAmount    Decimal       @db.Decimal(36, 18)  // Required CC
  currentAmount   Decimal       @default(0) @db.Decimal(36, 18)

  // CIP compliance
  foundationStatus FoundationStatus @default(PENDING)
  activeStatus     ActiveStatus     @default(INACTIVE)

  // Grace period tracking
  gracePeriodEnds DateTime?
  gracePeriodDays Int           @default(7)  // 7 for apps, 30 for validators

  // Ownership & Claim Status
  claimStatus     ClaimStatus   @default(UNCLAIMED)
  ownerId         String?
  owner           User?         @relation("EntityOwner", fields: [ownerId], references: [id])
  claimedAt       DateTime?

  // Import tracking
  importSource    ImportSource?
  importedAt      DateTime?
  externalId      String?       // ID from scanner/external source

  // Timestamps
  activatedAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  backings        Backing[]
  campaigns       Campaign[]
}
```

### Campaign

```prisma
model Campaign {
  id              String          @id @default(cuid())
  entityId        String
  entity          Entity          @relation(fields: [entityId], references: [id])

  // Campaign details
  title           String
  description     String?
  targetAmount    Decimal         @db.Decimal(36, 18)  // CC goal for this campaign
  currentAmount   Decimal         @default(0) @db.Decimal(36, 18)
  minContribution Decimal?        @db.Decimal(36, 18)  // Minimum per backer
  maxContribution Decimal?        @db.Decimal(36, 18)  // Maximum per backer
  terms           String?         // Terms and conditions

  // Timeline
  startsAt        DateTime        @default(now())
  endsAt          DateTime?       // Campaign deadline
  status          CampaignStatus  @default(DRAFT)

  // Timestamps
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  interests       Interest[]
  invites         CampaignInvite[]
  backings        Backing[]
}
```

### Interest (User registers interest in a campaign)

```prisma
model Interest {
  id              String          @id @default(cuid())
  userId          String
  user            User            @relation(fields: [userId], references: [id])
  campaignId      String
  campaign        Campaign        @relation(fields: [campaignId], references: [id])

  // Interest details
  pledgeAmount    Decimal         @db.Decimal(36, 18)  // Intended contribution
  message         String?         // Why they want to back

  // Selection status
  status          InterestStatus  @default(PENDING)
  reviewedAt      DateTime?
  reviewNote      String?         // Owner's note (internal)

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([userId, campaignId])
}
```

### CampaignInvite (Direct invite from owner to user)

```prisma
model CampaignInvite {
  id              String          @id @default(cuid())
  campaignId      String
  campaign        Campaign        @relation(fields: [campaignId], references: [id])

  // Sender (entity owner)
  senderId        String
  sender          User            @relation("InviteSender", fields: [senderId], references: [id])

  // Recipient (can be existing user or email for new user)
  recipientId     String?
  recipient       User?           @relation("InviteRecipient", fields: [recipientId], references: [id])
  recipientEmail  String?         // For inviting non-users
  recipientPartyId String?        // For inviting by PartyId

  // Invite details
  message         String?         // Personal message from owner
  suggestedAmount Decimal?        @db.Decimal(36, 18)  // Suggested contribution

  // Status
  status          InviteStatus    @default(PENDING)
  respondedAt     DateTime?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([campaignId, recipientEmail])
  @@unique([campaignId, recipientId])
}
```

### Backing

```prisma
model Backing {
  id          String        @id @default(cuid())
  amount      Decimal       @db.Decimal(36, 18)

  userId      String
  user        User          @relation(fields: [userId], references: [id])
  entityId    String
  entity      Entity        @relation(fields: [entityId], references: [id])
  campaignId  String?       // Optional: backing via campaign
  campaign    Campaign?     @relation(fields: [campaignId], references: [id])

  // Canton tracking
  txHash      String?
  lockedPartyId String?     // Segregated PartyId holding the CC

  status      BackingStatus @default(PLEDGED)
  lockedAt    DateTime?
  unlockRequestedAt DateTime?
  unlockEffectiveAt DateTime?  // 365 days after unlock request
  unlockedAt  DateTime?

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([userId, entityId, campaignId])
}
```

### Enums

```prisma
enum EntityType {
  FEATURED_APP
  VALIDATOR
}

enum ClaimStatus {
  UNCLAIMED       // Imported but not yet claimed
  PENDING_CLAIM   // Claim initiated, awaiting verification
  CLAIMED         // Verified and claimed by owner
  SELF_REGISTERED // Created directly by owner (not imported)
}

enum ImportSource {
  CANTON_SCANNER  // Imported from Canton scanner API
  TOKENOMICS_CSV  // Imported from Tokenomics group CSV
  MANUAL          // Manually added by admin
}

enum FoundationStatus {
  PENDING     // Awaiting Foundation review
  APPROVED    // In good standing
  SUSPENDED   // Compliance issue
  REJECTED    // Not approved
}

enum ActiveStatus {
  INACTIVE        // Below requirements or not approved
  GRACE_PERIOD    // Backing dropped, within grace period
  ACTIVE          // Fully compliant Featured App or Validator
  PAUSED          // Voluntarily paused
}

enum CampaignStatus {
  DRAFT           // Not yet published
  OPEN            // Accepting interests
  SELECTING       // Owner reviewing/selecting backers
  FUNDED          // Target reached, no more contributions
  CLOSED          // Campaign ended (deadline or manual)
  CANCELLED       // Cancelled by owner
}

enum InterestStatus {
  PENDING         // Awaiting owner review
  ACCEPTED        // Owner accepted, user can pledge
  DECLINED        // Owner declined
  WITHDRAWN       // User withdrew interest
  CONVERTED       // User completed pledge (became Backing)
}

enum InviteStatus {
  PENDING         // Awaiting recipient response
  ACCEPTED        // Recipient accepted, can pledge
  DECLINED        // Recipient declined
  EXPIRED         // Invite expired
  CONVERTED       // Recipient completed pledge (became Backing)
}

enum BackingStatus {
  PLEDGED     // Intent to back (off-chain)
  LOCKED      // CC locked in segregated PartyId
  UNLOCKING   // 365-day unlock initiated
  WITHDRAWN   // Fully withdrawn
}
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/[...nextauth]` | NextAuth handlers |
| POST | `/api/auth/connect-wallet` | Link Canton wallet/PartyId |

### Entities (Featured Apps & Validators)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entities` | List entities (filters: type, status, claimStatus) |
| GET | `/api/entities/[id]` | Entity details + backing breakdown |
| POST | `/api/entities` | Register new entity (self-registration) |
| PATCH | `/api/entities/[id]` | Update entity details (owner only) |
| GET | `/api/entities/[id]/backers` | List all backers with attribution |
| GET | `/api/entities/search` | Search entities by name/partyId |

### Entity Import (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/scanner` | Trigger scanner API import |
| POST | `/api/import/csv` | Upload and import CSV |
| GET | `/api/import/status` | Check import job status |

### Entity Claiming

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/claim/[entityId]/initiate` | Start claim process |
| POST | `/api/claim/[entityId]/verify` | Submit signed verification |
| GET | `/api/claim/claimable` | List entities user can claim (by connected PartyId) |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List open campaigns (public) |
| GET | `/api/campaigns/[id]` | Campaign details |
| POST | `/api/campaigns` | Create campaign (entity owner) |
| PATCH | `/api/campaigns/[id]` | Update campaign (owner only) |
| POST | `/api/campaigns/[id]/publish` | Publish draft campaign |
| POST | `/api/campaigns/[id]/close` | Close campaign |
| GET | `/api/campaigns/[id]/interests` | List all interests (owner only) |
| GET | `/api/campaigns/[id]/invites` | List all invites (owner only) |

### Interests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/interests` | User's registered interests |
| POST | `/api/interests` | Register interest in campaign |
| DELETE | `/api/interests/[id]` | Withdraw interest |
| PATCH | `/api/interests/[id]/review` | Accept/decline interest (owner) |

### Invites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invites` | User's received invites |
| POST | `/api/invites` | Send invite (entity owner) |
| POST | `/api/invites/bulk` | Send bulk invites |
| PATCH | `/api/invites/[id]/respond` | Accept/decline invite (recipient) |

### Backings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/backings` | User's backing positions |
| POST | `/api/backings` | Create backing (from accepted interest/invite) |
| PATCH | `/api/backings/[id]` | Update backing amount |
| POST | `/api/backings/[id]/lock` | Confirm CC locked in PartyId |
| POST | `/api/backings/[id]/unlock` | Initiate 365-day unlock |
| DELETE | `/api/backings/[id]` | Withdraw (after unlock period) |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Network-wide stats |

---

## Key Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page explaining Backr + CIP context |
| `/login` | Sign in |
| `/register` | Create account |
| `/apps` | Browse Featured Apps (claimed & unclaimed) |
| `/apps/[id]` | App detail + campaigns + claim button |
| `/validators` | Browse Validators (claimed & unclaimed) |
| `/validators/[id]` | Validator detail + campaigns + claim button |
| `/campaigns` | Browse all open backing campaigns |
| `/campaigns/[id]` | Campaign detail + register interest form |
| `/claim-entity` | "Claim your entity" landing page with search |
| `/claim-entity/[id]` | Claim verification flow for specific entity |
| `/register-entity` | Register your app or validator (if not found) |
| `/my-backings` | User's backing positions + attribution |
| `/my-interests` | User's registered interests + status |
| `/my-invites` | User's received invites |
| `/my-entities` | User's claimed/registered entities |
| `/my-entities/[id]/campaigns` | Manage campaigns for an entity |
| `/my-entities/[id]/campaigns/new` | Create new campaign |
| `/my-entities/[id]/campaigns/[campaignId]` | Campaign dashboard (review interests, send invites) |
| `/profile` | User settings + Canton wallet/PartyId + bio |
| `/leaderboard` | Top backers + most backed entities |
| `/unlock-tracker` | Monitor 365-day unlock countdowns |

---

## Canton Integration Layer

```typescript
// src/services/canton/types.ts
interface CantonService {
  // PartyId operations
  validatePartyId(partyId: string): Promise<boolean>;
  getPartyBalance(partyId: string): Promise<bigint>;

  // Entity verification
  verifyEntityPartyId(partyId: string): Promise<EntityInfo | null>;
  getFoundationStatus(partyId: string): Promise<FoundationStatus>;

  // Claim verification (smart contract)
  verifyOwnership(
    claimerPartyId: string,
    entityPartyId: string,
    signature: string
  ): Promise<boolean>;

  // Backing verification
  verifyLockedBalance(
    backerPartyId: string,
    entityPartyId: string
  ): Promise<bigint>;

  // For MVP - mocked
  getEntityRewards(partyId: string): Promise<RewardInfo>;
}

// src/services/import/types.ts
interface ImportService {
  // Scanner API import
  importFromScanner(): Promise<ImportResult>;

  // CSV import
  importFromCSV(filePath: string): Promise<ImportResult>;

  // Unified import
  syncAllSources(): Promise<ImportResult[]>;
}

interface ImportResult {
  source: ImportSource;
  imported: number;
  updated: number;
  errors: ImportError[];
}

// Minimum CC requirements (Phase 1)
const MIN_CC_REQUIREMENTS = {
  FEATURED_APP: 10_000_000n * 10n**18n,  // 10M CC
  VALIDATOR: 1_000_000n * 10n**18n,       // 1M CC
} as const;

// Grace periods per entity type
const GRACE_PERIOD_DAYS = {
  FEATURED_APP: 7,
  VALIDATOR: 30,
} as const;

const UNLOCK_PERIOD_DAYS = 365;
```

---

## Implementation Phases

### Phase 1: Project Setup

- [x] Create GitHub repo (hashrupt/backr)
- [ ] Initialize Next.js 14 with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up Prisma with PostgreSQL
- [ ] Configure ESLint + Prettier
- [ ] Set up environment variables
- [ ] Create base project structure

### Phase 2: Authentication & Wallet

- [ ] Implement NextAuth.js with credentials provider
- [ ] Create login/register pages
- [ ] Add Canton wallet connection (PartyId linking)
- [ ] Protected route middleware
- [ ] User profile with bio field

### Phase 3: Entity Import & Registry

- [ ] Create scanner API client service
- [ ] Create CSV parser for Tokenomics data
- [ ] Implement import orchestrator
- [ ] Build import CLI script
- [ ] Entity listing pages (apps + validators with filters)
- [ ] Entity detail page with backing breakdown
- [ ] Search functionality for entities
- [ ] Display claim status badges (Claimed/Unclaimed)

### Phase 4: Entity Claiming

- [ ] "Claim Your Entity" landing page
- [ ] Claim initiation flow
- [ ] Smart contract verification integration
- [ ] Wallet signature verification
- [ ] Claim success/failure handling
- [ ] My Entities dashboard for claimed entities

### Phase 5: Self-Registration

- [ ] Register entity form (for entities not in imported data)
- [ ] PartyId verification for new registrations
- [ ] Progress bars showing current vs required CC
- [ ] Grace period status indicators

### Phase 6: Campaign System

- [ ] Campaign model and API endpoints
- [ ] Create campaign form (entity owner)
- [ ] Campaign listing page (public)
- [ ] Campaign detail page
- [ ] Campaign dashboard for owners
- [ ] Publish/close campaign flows

### Phase 7: Interest & Invite System

- [ ] Interest model and API endpoints
- [ ] Register interest form (with pledge amount + message)
- [ ] My Interests page for users
- [ ] Interest review interface for owners (accept/decline)
- [ ] Direct invite system (by email or PartyId)
- [ ] Bulk invite functionality
- [ ] My Invites page for users
- [ ] Invite response flow (accept/decline)

### Phase 8: Backing System

- [ ] Back entity flow (from accepted interest/invite)
- [ ] My backings dashboard with attribution
- [ ] Unlock request flow (365-day countdown)
- [ ] Backing history
- [ ] Campaign progress tracking

### Phase 9: Alerts & Monitoring

- [ ] Grace period alerts (7 days for apps, 30 for validators)
- [ ] Unlock countdown tracker
- [ ] Threshold met/unmet notifications
- [ ] Campaign deadline notifications

### Phase 10: Polish & Deploy

- [ ] Landing page with CIP context explanation
- [ ] Leaderboard (top backers, most backed entities)
- [ ] Loading states & error handling
- [ ] Basic responsive design
- [ ] README documentation
- [ ] Deploy to Vercel

---

## Verification Plan

1. **Unit Tests**: Run `npm test` for service logic
2. **E2E Tests**: Run `npm run test:e2e` for critical flows
3. **Manual Testing**:
   - Register new user with email
   - Link Canton wallet (PartyId)
   - **Import entities from scanner API**
   - **Import entities from CSV**
   - **Browse imported entities (unclaimed)**
   - **Claim an entity with matching PartyId**
   - **Verify claim rejected for non-matching PartyId**
   - Register a new Featured App (not in imports)
   - Register a new Validator (not in imports)
   - **Create a backing campaign for claimed entity**
   - **Browse open campaigns as a user**
   - **Register interest in a campaign with pledge amount**
   - **As owner, review and accept/decline interests**
   - **As owner, send direct invite to a user**
   - **As invited user, accept invite and pledge**
   - **Verify only accepted users can create backings**
   - View my-backings dashboard with attribution
   - Verify status changes when backing threshold met
   - Test grace period alert when backing drops
   - Initiate unlock and verify 365-day countdown
