> **Note:** this document describes the original LAN (Socket.IO) design. The game now runs online on GitHub Pages + Supabase — see [README.md](README.md#how-it-works) for the current architecture.

# Architectural & Mathematical Specification: Indian 29 (Twenty-Nine) LAN Multiplayer Card Game

## 1. Abstract & System Architecture
This document specifies the architecture, mathematical model, vector asset extraction pipeline, table geometry, physical drag-and-drop interaction, dual-tier timer system, and real-time synchronization protocol for a production-grade LAN (Local Area Network) multiplayer implementation of the traditional South Asian trick-taking card game **29 (Twenty-Nine)**.

The system is architected around a server-authoritative Node.js (Express + Socket.IO) backend that binds to `0.0.0.0:3000`, auto-detects host private IPv4 network interfaces (e.g. `192.168.1.x`), serves pre-compiled production Vite client assets, renders on an authentic oval wooden table felt (`table.jpg`), and enforces 100% in-table gameplay without disruptive popups or modals.

```
+---------------------------------------------------------------------------------------------------+
|                                      Presentation Layer (React 18)                               |
|  [HomeView] <---> [LobbyView] <---> [GameTable] <---> [CardPreviewGallery] <---> [RulesDrawer]    |
|       - Official Game Logo: Featured across headers, home, lobby, and favicon                    |
|       - Table Felt Arena: Authentic table.jpg background (700x400 oval green felt)               |
|       - Audio Engine: Preloaded Web Audio API buffers (card-shuffle, deal, slide, place, shove)  |
|       - Physical Drag-and-Drop: Overlapping hand, hover lift, drag-to-table drop threshold        |
|       - In-Table Bidding: Embedded felt dock with 15-second timer & live raise/pass controls     |
|       - In-Table Trump Selector: Secret suit chooser docked in table center                      |
|       - In-Table Trump Reveal: Action trigger illuminated upon non-lead suit                      |
|       - In-Table Pair/Royals: Crown declaration button on table felt                             |
|       - In-Table Round Summary: Inline deal results & score tracker                              |
|       - Non-blocking Rules Drawer: Accessible anytime without pausing match                       |
+---------------------------------------------------------------------------------------------------+
                                            |
                                            v (Socket.IO over LAN / Wi-Fi)
+---------------------------------------------------------------------------------------------------+
|                                State & Networking Controller Layer                                |
|   - LAN Client (lanClient.ts): Socket.IO client, automatic reconnect token handler               |
|   - LAN Host Server (server/index.ts): Express 5.3 + Socket.IO 4.8 binding to 0.0.0.0:3000        |
|   - IP Detector (server/lanUtils.ts): Automatic IPv4 discovery (192.168.x.x, 10.x.x.x)           |
|   - Room Manager (server/roomManager.ts): 4-seat matrix, room lock, 15s/60s timers, CPU backfill  |
+---------------------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------------------+
|                                  Core Deterministic Rules Engine                                  |
|   - types.ts: Algebraic state definitions, RoundSummary, GamePhase state machine                  |
|   - deck.ts: 32-card Fisher-Yates generator, two-phase dealing matrix (4 + 4 cards)               |
|   - bidding.ts: Range [16, 28/29], minimum raise validation, forced dealer bid, 15s timer         |
|   - trump.ts: Concealed suit selector, request-to-reveal event handler, visibility control        |
|   - tricks.ts: Mandatory follow-suit validator, trump-cut logic, trick winner evaluator, 60s    |
|   - scoring.ts: Card points accumulator (28 + 1 bonus = 29), Royals Pair (+/- 4), Match (+/- 6)   |
|   - bot.ts: Heuristic AI agent for bidding, trump optimization, and trick play                    |
+---------------------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------------------+
|                                Vector Artwork Extraction Pipeline                                 |
|   - Source EPS (OIUGSZ1.eps): 450x450 pt bounding box (1440 DPI, 9000x9000 px raster)            |
|   - Extraction Engine (scripts/extract_cards.py): Sub-pixel path isolation, corner flood-fill    |
|   - Dual Artifacts: 33 pure vector SVGs & 33 500x700 PNGs in public/assets/cards/                 |
|   - Manifest (cardManifest.ts): Normalized 32-card registry + geometric card back                 |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Table Geometry & Physical Interaction Specification

### 2.1 Table Felt Proportions (`table.jpg`)
The primary game arena employs `table.jpg`, featuring a traditional oval green card felt encircled by a polished dark wood rail.
- **Intrinsic Resolution**: $700 \times 400$ pixels ($\text{Aspect Ratio } \approx 1.75 = 7/4$).
- **Green Felt Bounding Box**:
  - Horizontal Axis: $X \in [14.7\%, 84.7\%]$ (span of $70.0\%$ width).
  - Vertical Axis: $Y \in [21.0\%, 67.5\%]$ (span of $46.5\%$ height).
  - Felt Centroid: $(X_c, Y_c) = (49.7\%, 44.2\%)$.
- **Component Coordinates**:
  - **Trick Drop Zone (`TrickArea.tsx`)**: Centered at $(X_c, Y_c) = (50.0\%, 44.0\%)$ completely inside the green felt.
  - **Seat 3 (Top / North, Partner)**: $Y \approx 2\%$, looking down upon the felt.
  - **Seat 2 (Left / West, Opponent)**: $X \approx 2\%$, $Y \approx 44\%$.
  - **Seat 4 (Right / East, Opponent)**: $X \approx 98\%$, $Y \approx 44\%$.
  - **Seat 1 (Bottom / South, Local Player)**: Placed along the lower rail with the player hand overlapping the bottom edge.

### 2.2 Drag-and-Drop Card Play Engine
- **Horizontal Card Spread**: Dynamic overlapping margins ($-48\text{px}$ to $-64\text{px}$ for 8 cards) ensuring that index numbers and suit pips remain 100% visible.
- **Hover Interaction**: Hovering elevates card by $-28\text{px}$ with a $1.14\times$ zoom and elevates `z-index` to 50 so cards never get clipped by neighboring cards.
- **Pointer Events Capture**: Pointer capture on `pointerdown` ensures dragging smoothly tracks across touchscreens and desktop mice.
- **Minimum Drag Threshold**: Requires moving $> 6\text{px}$ from start coordinate to engage dragging mode. Standard clicks alone never trigger card plays, preventing accidental plays.
- **Collision Detection**: Real-time evaluation against `dropZoneRef.current.getBoundingClientRect()` during drag. Dropping within the active trick boundary triggers `onPlayCard(cardId)` and authentic placement audio. Releasing outside the boundary smoothly snaps the card back to hand.

---

## 3. Mathematical Formalization of 29

### 3.1 Deck Composition & Point Topology
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

### 3.2 Seating & Partnership Graph
Players are indexed $p \in \{0, 1, 2, 3\}$ arranged clockwise around the table. The partnership function $\mathcal{T}: \{0, 1, 2, 3\} \to \{0, 1\}$ partitions players into two opposing teams:
$$\mathcal{T}(p) = p \pmod 2$$
- $\text{Team } 0 = \{0, 2\}$ (Seat 1: Bottom & Seat 3: Top partners)
- $\text{Team } 1 = \{1, 3\}$ (Seat 2: Left & Seat 4: Right partners)

Partners sit opposite each other: for player $p$, partner is $(p + 2) \bmod 4$.

---

## 4. Dual-Tier Server-Authoritative Timers & Reconnection

The server enforces strict per-turn deadlines synchronized across network ticks:
1. **Bidding Phase: $T_{\text{bidding}} = 15\text{ seconds}$**
   - Broadcast as `timer_tick` with `turnDeadline = Date.now() + 15000`.
   - On expiration ($t \ge \text{deadline}$), if the current bidder has not acted:
     - If dealer and all previous passed: server forces minimum contract of $16$.
     - Otherwise: server automatically passes for the player.
     - Emits `in_table_notification` toast informing all clients of the automatic pass.
2. **Trick Play Phase: $T_{\text{play}} = 60\text{ seconds}$**
   - Broadcast as `timer_tick` with `turnDeadline = Date.now() + 60000`.
   - On expiration, server executes a legal card play chosen from valid follow-suit cards.
3. **Reconnection Invariance**:
   - The absolute `turnDeadline` epoch timestamp is maintained on the room object. Reconnecting clients or page refreshes calculate remaining time from the immutable deadline, preventing any timer extensions.

---

## 5. Web Audio API Engine (`SoundManager.ts`)

The audio pipeline utilizes authentic Vorbis OGG sound effects preloaded directly into memory:
- **Buffers**: Decoded via `AudioContext.decodeAudioData` for zero-latency instant playback, with HTML5 Audio element fallback.
- **Event Deduplication (`playEventOnce`)**: Ensures network re-transmissions and component re-renders do not duplicate sound effects.
- **Volume & Mute Control**: Gain nodes and audio element volumes are tied to master volume ($0.0 \dots 1.0$) with instant toggle and `localStorage` persistence (`twenty_nine_volume`, `twenty_nine_muted`).

---

## 6. LAN Networking Protocol

### 6.1 Client to Server Events
- `create_room`: `{ hostName, rules, preferredSeat }`
- `join_room`: `{ roomCode, playerName, preferredSeat }`
- `select_seat`: `{ roomCode, sessionToken, targetPosition }`
- `reconnect_seat`: `{ roomCode, sessionToken }`
- `start_match`: `{ roomCode, sessionToken }`
- `place_bid`: `{ roomCode, sessionToken, bid }`
- `select_trump`: `{ roomCode, sessionToken, suit }`
- `reveal_trump`: `{ roomCode, sessionToken }`
- `play_card`: `{ roomCode, sessionToken, cardId }`
- `declare_pair`: `{ roomCode, sessionToken }`
- `next_round`: `{ roomCode, sessionToken }`

### 6.2 Server to Client Broadcasts
- `room_update`: Sanitized seats, host ID, locked status.
- `game_state_update`: Full private hand for player, public table state.
- `timer_tick`: `{ remainingSeconds, turnDeadline, turnPosition, phase }` emitted per second.
- `in_table_notification`: `{ type, message, cardId, timestamp }` for auto-play toasts and alerts.
