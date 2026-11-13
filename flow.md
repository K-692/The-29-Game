# Architectural & Mathematical Specification: Indian 29 (Twenty-Nine) Online Multiplayer Game

## 1. Abstract & System Architecture
This document specifies the architecture, mathematical model, vector asset extraction pipeline, state machine, and real-time synchronization protocol for an online multiplayer implementation of the traditional South Asian trick-taking card game **29 (Twenty-Nine)**. The system is architected as a client-side single-page application (SPA) capable of static edge deployment via GitHub Pages, with real-time state replication powered by Supabase Realtime Channels and peer relay.

```
+---------------------------------------------------------------------------------------------------+
|                                      Presentation Layer (React 18)                               |
|  [HomeView] <---> [LobbyView] <---> [GameTable] <---> [CardPreviewGallery] <---> [HowToPlayModal]  |
+---------------------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------------------+
|                                State & Networking Controller Layer                                |
|   - Multiplayer Controller (multiplayerState.ts): Optimistic local dispatch & broadcast relay      |
|   - Session Manager (roomService.ts): 4-seat matrix, partnership binding, seat recovery tokens    |
|   - Supabase Client (supabase.ts): Realtime channels, Postgres RLS, graceful offline fallback     |
+---------------------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------------------+
|                                  Core Deterministic Rules Engine                                  |
|   - types.ts: Algebraic state definitions, RoundSummary, GamePhase state machine                  |
|   - deck.ts: 32-card Fisher-Yates generator, two-phase dealing matrix (4 + 4 cards)               |
|   - bidding.ts: Range [16, 28/29], minimum raise validation, forced dealer bid                    |
|   - trump.ts: Concealed suit selector, request-to-reveal event handler, visibility control        |
|   - tricks.ts: Mandatory follow-suit validator, trump-cut logic, trick winner evaluator          |
|   - scoring.ts: Card points accumulator (28 + 1 bonus = 29), Royals Pair (+/- 4), Match (+/- 6)   |
|   - bot.ts: Heuristic AI agent for bidding, trump optimization, and trick play                    |
+---------------------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------------------+
|                                Vector Artwork Extraction Pipeline                                 |
|   - Source EPS (OIUGSZ1.eps): 450x450 pt bounding box (720 DPI, 4500x4500 px equivalent)           |
|   - Extraction Engine: Sub-pixel path isolation, green canvas removal, true alpha transparency    |
|   - Dual Artifacts: 33 pure vector SVGs & 33 600 DPI retina PNGs in public/assets/cards/          |
|   - Manifest (cardManifest.ts): Normalized 32-card registry + geometric card back                 |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Mathematical Formalization of 29

### 2.1 Deck Composition & Point Topology
The playing space $\mathcal{D}$ consists of 32 cards formed by the Cartesian product of ranks $\mathcal{R}$ and suits $\mathcal{S}$:
$$\mathcal{S} = \{\text{Diamonds}, \text{Hearts}, \text{Clubs}, \text{Spades}\}, \quad |\mathcal{S}| = 4$$
$$\mathcal{R} = \{\text{Jack}, \text{Nine}, \text{Ace}, \text{Ten}, \text{King}, \text{Queen}, \text{Eight}, \text{Seven}\}, \quad |\mathcal{R}| = 8$$
$$\mathcal{D} = \mathcal{R} \times \mathcal{S}, \quad |\mathcal{D}| = 32$$

The point valuation function $\mathcal{V}: \mathcal{R} \to \{0, 1, 2, 3\}$ is defined as:
$$\mathcal{V}(r) = \begin{cases} 
3 & \text{if } r = \text{Jack} \\ 
2 & \text{if } r = \text{Nine} \\ 
1 & \text{if } r \in \{\text{Ace}, \text{Ten}\} \\ 
0 & \text{if } r \in \{\text{King}, \text{Queen}, \text{Eight}, \text{Seven}\} 
\end{cases}$$

The total card points in the deck $\mathcal{P}_{\text{cards}}$ is invariant:
$$\mathcal{P}_{\text{cards}} = \sum_{c \in \mathcal{D}} \mathcal{V}(c) = 4 \times (3 + 2 + 1 + 1 + 0 + 0 + 0 + 0) = 28\text{ points}$$

With the last-trick bonus $\beta_{\text{last}} = 1$ awarded to the winner of the 8th trick:
$$\mathcal{P}_{\text{total}} = \mathcal{P}_{\text{cards}} + \beta_{\text{last}} = 29\text{ points}$$

### 2.2 Seating & Partnership Graph
Players are indexed $p \in \{0, 1, 2, 3\}$ arranged clockwise around the table. The partnership function $\mathcal{T}: \{0, 1, 2, 3\} \to \{0, 1\}$ partitions players into two opposing teams:
$$\mathcal{T}(p) = p \pmod 2$$
- $\text{Team } 0 = \{0, 2\}$ (South & North partners)
- $\text{Team } 1 = \{1, 3\}$ (West & East partners)

Partners sit opposite each other: for player $p$, partner is $(p + 2) \bmod 4$.

---

## 3. Asset Extraction Matrix (EPS Source to Vector Manifest)

The source asset `poker-cards-icons-collection/OIUGSZ1.eps` contains a 6-row by 9-column matrix of 54 cards on an overall $450 \times 450$ point bounding box.

### 3.1 Spatial Grid Mapping for 29 Deck

| Rank | Diamonds | Spades | Hearts | Clubs | Points | Hierarchy Order |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Jack (J)** | $(c_0, r_2)$ | $(c_1, r_2)$ | $(c_2, r_2)$ | $(c_3, r_2)$ | 3 | 7 (Highest) |
| **Nine (9)** | $(c_0, r_4)$ | $(c_1, r_4)$ | $(c_2, r_4)$ | $(c_3, r_4)$ | 2 | 6 |
| **Ace (A)** | $(c_4, r_3)$ | $(c_4, r_2)$ | $(c_4, r_1)$ | $(c_4, r_0)$ | 1 | 5 |
| **Ten (10)** | $(c_0, r_3)$ | $(c_1, r_3)$ | $(c_2, r_3)$ | $(c_3, r_3)$ | 1 | 4 |
| **King (K)** | $(c_0, r_0)$ | $(c_1, r_0)$ | $(c_2, r_0)$ | $(c_3, r_0)$ | 0 | 3 |
| **Queen (Q)** | $(c_0, r_1)$ | $(c_1, r_1)$ | $(c_2, r_1)$ | $(c_3, r_1)$ | 0 | 2 |
| **Eight (8)** | $(c_0, r_5)$ | $(c_1, r_5)$ | $(c_2, r_5)$ | $(c_3, r_5)$ | 0 | 1 |
| **Seven (7)** | $(c_5, r_0)$ | $(c_6, r_0)$ | $(c_7, r_0)$ | $(c_8, r_0)$ | 0 | 0 (Lowest) |
| **Card Back** | — | — | — | $(c_4, r_5)$ | — | — |

*Grid Coordinates:*
- Columns $c_0 \dots c_8$: $x \in [10.0, 49.5], [58.9, 98.7], [108.1, 147.8], [157.2, 197.0], [205.8, 244.5], [253.2, 292.0], [302.3, 341.6], [351.2, 390.6], [400.6, 439.9]$
- Rows $r_0 \dots r_5$: $y \in [54.4, 110.9], [120.4, 176.9], [186.4, 242.9], [252.3, 308.9], [318.3, 374.8], [384.3, 440.8]$

---

## 4. State Machine Transitions

```
[WAITING_LOBBY] 
       | (Host triggers start when 4 seats filled/ready)
       v
[DEALING_FIRST] 
       | (4 cards dealt to each player)
       v
   [BIDDING] <-------+ (Pass or Raise)
       |             |
       +-------------+
       | (3 players pass / forced dealer bid at 16)
       v
[TRUMP_SELECTION] 
       | (Bidder selects secret suit)
       v
[DEALING_SECOND] 
       | (Remaining 4 cards dealt; hands have 8 cards)
       v
  [TRICK_PLAY] <-----+ (8 tricks executed sequentially)
       |             |
       +-------------+
       | (All 8 tricks completed)
       v
 [ROUND_ENDED] 
       | (Scoring evaluation: contract fulfilled or failed)
       |
       +---> [MATCH_ENDED] (If team reaches +/- 6 game points)
       |
       +---> [DEALING_FIRST] (Next round with rotated dealer)
```

---

## 5. Security & Privacy Architecture

### 5.1 Zero-Leak Data Caching
In a client-server or distributed multiplayer card game, leaking opponent cards or concealed trump through DOM state or network payloads constitutes a critical vulnerability.
To guarantee zero information leakage:
1. **Public State Sanitization (`getPublicGameState`)**:
   - The master `GameState.hands` mapping is completely omitted from the transmitted `PublicGameState`.
   - The receiving client receives only their own array `myHand: string[]`.
   - Other players' hands are represented solely as integers `otherHandCounts[pos]: number`.
2. **Concealed Trump Masking**:
   - `revealedTrumpSuit` remains `null` for all opponents until `isTrumpRevealed == true`.
   - The bidder alone receives their selected trump suit for reference.

### 5.2 Seat Reconnection & Session Persistence
Session tokens are securely persisted in `localStorage` under `twenty_nine_session_token` containing:
$$\{ \text{roomCode}, \text{playerId}, \text{position} \}$$
Upon page refresh, device disconnect, or link re-entry, the client automatically re-authenticates to their assigned seat, restoring hand cards and game progression without forfeiting the match.

---

## 6. Implementation Status & Artifacts Log

- [x] **Vector Extraction**: 33 SVGs and 33 600-DPI PNGs extracted to `public/assets/cards/`.
- [x] **Rules Engine**: Modular TypeScript implementation in `src/engine/` (`deck.ts`, `bidding.ts`, `trump.ts`, `tricks.ts`, `scoring.ts`, `bot.ts`, `gameManager.ts`).
- [x] **Unit Test Suite**: 16 comprehensive unit tests passing with Vitest (`src/engine/engine.test.ts`).
- [x] **UI Components**: Dark casino green felt table, 32-card verification gallery, bidding modal, trump modal, scoreboard, opponent seats, and responsive mobile hand fan.
- [x] **Multiplayer Sync**: Room service, Supabase schema with RLS policies, BroadcastChannel cross-tab synchronization.
- [x] **CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/deploy.yml`) targeting GitHub Pages.
- [x] **Build Verification**: Production bundle compiles cleanly via `npm run build` in 2.17s.
