![The 29 Game](./public/assets/game_logo.png)

# ♠️ The 29 Game — Premium LAN Multiplayer Twenty-Nine Card Game ♥️

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react)](https://reactjs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black.svg?logo=socketdotio)](https://socket.io/)
[![Express](https://img.shields.io/badge/Express-5.3-green.svg?logo=express)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Vitest-97%2F97%20Passing-brightgreen.svg?logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A modern, zero-install, real-time **LAN (Local Area Network)** multiplayer implementation of the traditional Indian **29 (Twenty-Nine)** trick-taking card game. Features authentic traditional Indian rules, edge-to-edge full-screen table felt (`table.jpg`), original vector playing-card artwork extracted directly from an EPS collection (`poker-cards-icons-collection/OIUGSZ1.eps`), single-source-of-truth card movement animations (`HAND → IN_FLIGHT → ON_TABLE → COLLECTING → COLLECTED`) with zero snap-back or coordinate jumping, physical playing-card trump indicator at top-right with 3D flip transitions, six-number display cards (`6_HEARTS`, `6_SPADES`, `6_CLUBS`, `6_DIAMONDS`), 3-stage 7th Card reveal sequence, 1000ms full-window epic trump-reveal luminous bloom effect, strictly drag-only card playing (no accidental clicks), strict server-authoritative 15-second turn timers, larger cards with gentle horizontal overlap, bright minimalistic UI with zero "Bidder:" text prefixes, consistent partnership colour schemes (Soft Blue & Soft Coral), animal emoji avatars, bottom-left Krish (You) player seat, fully visible top partner seat, bottom-right individual trick-point counters beside the turn countdown timer, active bidder top-bar synchronization (`🦊 Aarav is bidding`), clean direct-click bidding with authoritative PASS button, card-playing face-up flight animations with idempotent action deduplication, bottom-left Ask to Reveal Trump button with unique request tracking and support for all 6 trump modes, 3-second deal transition with sequential 16-card dealer distribution animation running at the start of **every new deal**, 1-second trick collection animation, floating utility controls (zero reserved navbar height), non-scrollable landing page (`100dvh`), original sound effects (`sound-effects/`), single-round auction with forced dealer opening, six trump options (including Joker / No Trump and 7th Card), first-bidder point-card eligibility redeals, Double & Re-Double gameplay with 10s decision windows and 1x/2x/4x multipliers, King-Queen Pair / Royals logic evaluated upon legal trump reveal, 1-second central table announcements for Joker & 7th Card, improved played card sizing in the central table area, and computer players that fill any empty seats so 1–4 people on the same network can play. Pure Host-Authoritative LAN architecture running entirely without cloud databases or third-party dependencies.

---

## 🌟 Key Highlights

- **Double / Re-Double Gameplay (10s Deadlines & Match Multipliers)**:
  - Following trump selection, an in-table decision window opens before trick play commences.
  - **Stage 1 (Defending Team Opportunity)**: The team that did not win the auction has strictly 10 seconds to decide `DOUBLE` or `PASS`. If passed or if time expires, the match begins with normal 1x stakes. If doubled, the multiplier becomes 2x and the deal advances to Stage 2.
  - **Stage 2 (Bidding Team Opportunity)**: The winning bidder's partnership has strictly 10 seconds to decide `RE-DOUBLE` or `PASS`. If passed or if time expires, the deal remains doubled at 2x. If re-doubled, the multiplier becomes 4x.
  - **Server-Authoritative Synchronization**: Deadlines are synchronized across all LAN clients with atomic state transitions preventing duplicate or conflicting submissions. Automatic silent pass on timeout without intrusive modal popups.
  - **Match Scoring**: Normal win/loss = ±1 pt, Doubled = ±2 pts, Re-Doubled = ±4 pts awarded to the bidding team. The first partnership to reach **+6 match points** wins the match (negative scores fully supported).
- **King-Queen Pair / Royals (Auto-Detection Upon Legal Trump Reveal)**:
  - Evaluated automatically when the secret trump suit is legally revealed during trick play.
  - **Eligibility**: Requires original contract bid ≥ 19. Both the King (K) and Queen (Q) of the revealed trump suit must be held in the same player's hand.
  - **Contract Adjustment**:
    - *Bidding Team Pair*: Adjusted Target = $\max(16, \text{Original Bid} - 4)$ points.
    - *Defending Team Pair*: Adjusted Target = $\min(29, \text{Original Bid} + 4)$ points.
  - **Visual In-Table Announcement**: Displays both the King and Queen cards side-by-side near the holding player for 2.0 seconds (`InTablePairAnnouncement`) and permanently updates the adjusted target on the scoreboard.
  - Does not apply in Joker / No Trump mode.
- **Joker / No Trump & 7th Card Table Announcements**:
  - Central 1-second visual table announcement before the Double phase opens:
    - *Joker / No Trump*: Gold banner announcing no suit has trump priority.
    - *7th Card Trump*: Displays a face-down card back (`card_back.svg`) announcing the 7th card is reserved, strictly preserving suit secrecy until legal revelation.
    - Normal suits proceed directly to the Double decision window.
- **Improved Played Card Sizing in Central Trick Area**:
  - Scaled played cards to dedicated `size="table"` (`w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7]`), providing a ~18% increase in card surface area for optimal table legibility.
  - Preserves exact 500:700 (5:7) aspect ratio and leaves comfortable clearance around the top scoreboard, opponent seats, and player hand.
- **Pure Host-Authoritative LAN Architecture (Zero Cloud Dependencies)**:
  - Completely removed legacy `@supabase/supabase-js` dependencies, Supabase schema SQL files, and unused services.
  - Authoritative game state, player sessions, room codes, turn timers, card distribution, and scoring run 100% locally on the host computer via Node.js/Express and Socket.IO. Runs completely offline without internet connectivity.

- **Seamless Card Animation Lifecycle (`HAND → IN_FLIGHT → ON_TABLE → COLLECTING → COLLECTED`)**:
  - Eliminates card snap-back, clone flickering, and coordinate jumping.
  - When a player drags and drops a card into the table center, its release bounding box is captured immediately. The card transitions smoothly into `IN_FLIGHT` with zero backward animation into the hand.
  - The destination is measured dynamically from permanent slot anchors (`[data-trick-slot="bottom|top|left|right"]`). The card glides smoothly along its trajectory and lands with sub-pixel precision directly in its designated slot.
  - The 1000ms trick-completion pause initiates strictly after the 4th card has landed, preventing premature collection freezes.
  - All four cards remain in full view on the table for exactly 1.0 second, then smoothly glide into the winning player's seat over 450ms (`COLLECTING`), clearing cleanly (`COLLECTED`).
- **Physical Playing-Card Trump Indicator at Top-Right**:
  - Replaced legacy text boxes with a physical playing-card indicator positioned permanently at the **top-right** of the table felt.
  - **Concealed State**: Displays a face-down playing card (`card_back.svg`) with an elegant gold `TRUMP` badge, preserving secrecy for all players before official revelation.
  - **Normal Suit Reveal**: Performs a hardware-accelerated 3D flip card transition to reveal the authentic number-6 display card of that suit (6♥ for Hearts, 6♠ for Spades, 6♣ for Clubs, 6♦ for Diamonds). The 6 cards are visual indicators only and are never part of the playable 32-card deck.
  - **Joker / No Trump Reveal**: Performs a 3D flip card transition into a clean, regal `NO TRUMP` card face with gold foil borders.
  - **Deterministic 3-Stage 7th Card Reveal**:
    1. *Stage 1 (0–1200ms)*: The concealed card flips to expose the exact physical 7th card reserved during distribution, accompanied by the 1000ms Epic Trump Reveal Effect.
    2. *Stage 2 (1200–1750ms)*: The 7th card visibly glides from the top-right indicator directly into its owner's hand, where it is restored to playable status.
    3. *Stage 3 (1750ms+)*: The top-right placeholder is replaced by the 6-number card of that revealed suit, remaining permanently visible for the rest of the deal.
- **Full-Window Epic Trump-Reveal Effect (1000ms Radiant Bloom)**:
  - Triggered across all four LAN clients simultaneously upon authoritative trump revelation.
  - Casts an energetic golden-white radiant aura across the viewport, ambient table lighting pulse, and soft edge radiance.
  - Lasts exactly 1000 milliseconds, completely non-blocking (`pointer-events-none`), without interfering with turn timers or user input.
- **Strict Server-Authoritative 30-Second Turn Timers**:
  - The LAN server is the single source of truth for all actionable turns (Bidding, Trump Selection, Card Play).
  - Every turn maintains `turnId`, `position`, `actionType`, `startTime`, `deadline`, and `version` with atomic resolution preventing race conditions between timeouts and human submissions.
  - The countdown timer never resets on card hover, starting a drag, opening the rules drawer, browser refresh, or temporary reconnects. Actions submitted after the deadline are authoritatively rejected.
- **Strictly Drag-Only Card Playing**:
  - A human player must physically drag a card from their hand and drop it into the central table area to play it.
  - Clicking or tapping a card NEVER submits a play action. An 8-pixel movement threshold distinguishes deliberate drags from clicks.
  - Releasing outside the central playing area smoothly returns the card to the hand with zero state penalty.
  - Full touch and mouse support with pointer capture and `touch-action: none` preventing mobile scroll conflicts during drag.
- **Robust "Ask to Reveal Trump" Flow for All Eligible Players**:
  - Available to any player during trick play who cannot follow the lead suit, across all 6 trump modes (including Joker / No Trump and 7th Card).
  - Submits unique `requestId`, `playerPosition`, `roundNumber`, and `trickNumber` to the LAN server with idempotent deduplication.
  - Shows an inline `"REVEALING..."` state to prevent duplicate clicks without intrusive modals.
  - For 7th Card mode, reveals the exact reserved seventh card and returns it to the winning bidder's playable hand.
- **Deduplicated Card Animations (Zero Double-Rendering or Vanishing Cards)**:
  - Every card play generates a unique monotonic action ID (`${roundNumber}_${trickNumber}_${playerIndex}_${cardId}`) deduplicated on all clients.
  - While the card is flying from the player seat/hand to the center, `TrickArea` suppresses the static card, handing off seamlessly upon arrival without double-rendering or flickering.
  - Trick collection animation timers are protected from React re-renders, preventing mid-flight aborts or frozen cards.
- **Total Removal of "Bidder:" Label from the Top Information Bar**:
  - Replaced legacy `Bidder:` and `Bid:` text prefixes with clean icons and player badges (`🏆 🦊 Aarav · 18`). Zero visible instances of the word "Bidder:" remain in the top navigation or scoreboard.
- **Bottom-Left "Krish (You)" Seat Positioning**:
  - The local player's information box (`Krish (You)`) is positioned neatly in the **bottom-left corner** of the window, adjacent to the Ask to Reveal Trump button.
  - Leaves the central bottom area 100% unobstructed for the horizontally spread player hand, eliminating card overlap.
  - Displays avatar, name, point counter, dealer badge `D`, bidder badge, partnership dot, and active `TURN` highlight.
- **Fully Visible Partner Information Box at Top**:
  - Partner seat is centered at the top of the table felt (`top-14 sm:top-16`), completely clear of the top floating scoreboard.
  - All four player information boxes (Top Partner, Left Opponent, Right Opponent, Bottom-Left You) are simultaneously visible without clipping or overlapping.
- **Silent Authoritative Timeouts (Zero Intrusive Popups)**:
  - Eliminated all timeout popup announcements, blocking modals, and alerts.
  - Timeout actions (auto-pass, auto-card play, auto-trump selection) execute authoritatively and silently on the server, advancing the game state without interrupting the players.
- **Top-Right Persistent Revealed Trump Indicator**:
  - Positioned at the **top-right** corner of the screen, completely hidden before reveal to ensure strict privacy.
  - Once officially revealed, clearly displays the trump suit, `NO TRUMP` for Joker mode, or the actual revealed 7th card artwork and suit for 7th Card mode.
- **Recurring Card Distribution Animation at Start of Every Deal**:
  - The sequential 16-card dealer distribution animation runs at the beginning of **every deal** in the match, not just the initial round.
  - Increments `roundNumber` on every deal, rotates the dealer clockwise, respects the 3-second transition, delivers 4 initial cards to all players, checks first-bidder eligibility, and synchronizes seamlessly across all LAN clients.

- **Active Bidder Display in Top Information Bar**:
  - During the bidding phase, the name and avatar of the player whose bidding turn is currently active is displayed cleanly in the floating top area (e.g. `🦊 Aarav is bidding` or `🦊 Your Turn to Bid`).
  - Seamlessly updates in real time as bidding progresses around the table and synchronizes across all four clients.
  - Distinguishes between active bidder and current highest bidder (`High: 16 by Aarav`), retaining the winning bidder contract upon transition to trump selection and trick play.
- **Bottom-Right Active Player Points & 30-Second Turn Timer**:
  - The collected trick-points counter for the active player is positioned at the **bottom-right** of the window, immediately to the right of the turn timer (`Turn Timer: 00:28 | Your Points: 05`).
  - Displays the personal card points collected by the active player during the current deal, updating after each trick won, and resetting upon each new deal.
- **Authoritative Bidding PASS Button**:
  - The PASS button authoritatively validates, submits, and advances turns without failure for every player at the table.
  - Rejects out-of-turn actions, handles forced dealer opening (16 minimum) when the first 3 players pass, and cleanly redeals cards when all 4 players pass with forced dealer disabled.
  - Immediate optimistic UI submission state prevents duplicate clicks or race conditions.
- **Card-Playing Face-Up Flight Animation**:
  - When any player (you or any of the other three LAN players) plays a card, the exact card face visibly glides across the table into its slot in the central trick arrangement.
  - Employs identical smooth easing (`cubic-bezier(0.2, 0.8, 0.2, 1)`), 300ms duration, and layout coordinate calculations as the dealer distribution animation.
  - Preserves authoritative server validation: the card is removed from the player's hand only once verified by the server.
- **Active Player Seat Highlighting in Partnership Colours**:
  - The currently active player is highlighted using the partnership colour scheme (Soft Blue for Partnership 1, Soft Coral for Partnership 2).
  - Subtle glowing outline (`ring-2 ring-sky-400` or `ring-2 ring-rose-400`) and a compact `TURN` badge clearly identify who must act without jarring popups or jumping boxes.
- **Floating Top Controls (Zero Reserved Navbar Height)**:
  - Eliminated the opaque header bar strip to maximise screen space for the full-screen felt table.
  - Utility controls (Back/Leave, Room Code, Scoreboard, Revealed Trump, Volume slider, Rules `?`) float as sleek, translucent pills along the top edge of the main table.
- **Non-Scrollable Landing Page (`100dvh`)**:
  - The landing page adapts responsively to fit `100dvh` / `100vw` without vertical or horizontal scrollbars across desktop, laptops, tablets, and phones.
  - Removed the development-only "View 32 Original Card Assets" button from the landing view while keeping the full EPS card asset pipeline and manifest intact.
- **Full-Screen Edge-to-Edge Table (`table.jpg`)**:
  - The game table occupies **100% of the browser viewport width and height** without outer containers, black bars, or constrained aspect boxes.
  - The authentic wooden-rimmed green felt (`table.jpg`) acts as the full-screen canvas with edge-to-edge rendering.
  - All four player positions (Seat 1 Bottom, Seat 2 Left, Seat 3 Top, Seat 4 Right) and the central trick area adapt responsively to any screen size.
- **Consistent Partnership Colour Schemes (Replacing Team A & Team B Text)**:
  - **Partnership 1 (Seats 1 & 3 - South & North)**: Identifiable by **Soft Sky Blue** accents (`border-sky-300`, `bg-sky-500` dot indicator, `text-sky-700`).
  - **Partnership 2 (Seats 2 & 4 - West & East)**: Identifiable by **Soft Coral / Rose** accents (`border-rose-300`, `bg-rose-500` dot indicator, `text-rose-700`).
  - Scoreboard and player seats use these high-contrast partnership colors instead of cluttered Team A / Team B text.
- **Reliable 4-Card Trick Visibility & Collective Win Animation**:
  - Every trick reliably renders all 4 played cards in a clear diamond/cross formation without clipping or overlapping.
  - Individual cards land onto the table felt using directional CSS animations (`cardLandBottom`, `cardLandTop`, `cardLandLeft`, `cardLandRight`) with smooth cubic-bezier easing (`cubic-bezier(0.2, 0.8, 0.2, 1)`).
  - Cards pause clearly on the felt for 750ms so all players can register the outcome of the trick.
  - When the hand/turn is won, an effect triggers where **all 4 cards move together as one unified cluster directly to the winning player's seat** (`animate-trick-win-bottom`, `animate-trick-win-top`, `animate-trick-win-left`, `animate-trick-win-right`), following the exact same directional animation logic and easing curve as the card landing effect.
  - The winning player's seat simultaneously illuminates with an amber glow and `WON TRICK` badge, accompanied by authentic trick collection sound effects.
  - The 8th/final trick of the deal visibly renders all 4 cards and plays the full collective win animation before smoothly transitioning to the round summary.
- **Dedicated Bottom-Right 30-Second Turn Timer**:
  - Human-player turn timer is positioned neatly at the **bottom-right** of the screen, separate from the card hand.
  - Formats cleanly as `00:30` down to `00:00` with an urgent pulse during the final 5 seconds.
- **Bottom-Left "Ask to Reveal Trump" Control**:
  - Compact, light-themed button positioned at the **lower-left** of the table.
  - Displays `ASK TO REVEAL TRUMP` only when legally permitted by 29 game rules (human turn, trick play, concealed trump, unable to follow suit).
- **Top-Right Persistent Revealed Trump Indicator**:
  - Positioned at the **top-right** corner of the screen.
  - Completely hidden before trump is officially revealed.
  - Once revealed, displays the trump suit (Hearts, Spades, Clubs, Diamonds) or `NO TRUMP` for Joker mode, or the actual 7th card artwork and its suit for 7th Card mode.
- **3-Second Transition & 16-Card Dealer Distribution Animation**:
  - After a round ends, a clear 3-second transition countdown elapses before dealing.
  - Dealer visibly deals 16 card-backs sequentially around the table clockwise starting from the player to the dealer's left ($D+1 \to D+2 \to D+3 \to D$), accompanied by rhythmic dealing audio (`cards-pack-take-out-1.ogg`).
  - Initial 4 cards land smoothly in each player's hand before bidding begins.
- **Restored Prominent PASS Button in Bidding**:
  - Clean 3-element bidding panel: bidder info + legal bid grid (16–28) + prominent `PASS` button.
  - A single tap on any bid or PASS immediately submits the action without extra confirmation dialogs.
  - When dealer is forced to open, clearly displays `Dealer Forced Opening (Must bid 16+)`.
- **Larger Horizontally Spread Playing Cards**:
  - Playing cards are rendered significantly larger across all desktop and mobile viewports (`w-22 h-[7.7rem] sm:w-26 md:w-30 lg:w-32`) with crisp vector illustrations, high contrast, and drop-shadows.
  - All 8 cards spread out horizontally across the bottom with gentle, reduced overlap.
  - Cards lift upward ($-32\text{px}$) and scale up ($1.12\times$) on hover without clipping.
  - Physical drag-and-drop targeting a generous central invisible table hitbox (or direct click to play).
- **Minimal Scoreboard (+6 Match Win Condition)**:
  - Minimal light pill displaying match points for both partnerships with visual color dots.
  - Once bidding completes, displays permanent target contract and bidding partnership.
  - First partnership to reach **+6 points** wins the match; reaching **-6 points** loses.
- **Original Playing-Card Vector Artwork**: Extracted directly from vector EPS artwork (`poker-cards-icons-collection/OIUGSZ1.eps`) at 1440 DPI with corner-seeded flood-fill background removal. High-resolution SVGs and PNGs render hand-illustrated Kings, Queens, Jacks, traditional suit symbols, and geometric card-backs with true vector sharpness on retina displays.
- **Authentic Sound Effects (`sound-effects/`)**:
  - `card-shuffle.ogg`: Played at the start of a new deal.
  - `cards-pack-take-out-1.ogg`: Played when cards are dealt to players.
  - `card-slide-1.ogg`: Played during card dragging, hovering, and hand interaction.
  - `card-place-1.ogg`: Played when a card is dropped/played onto the table.
  - `card-shove-1.ogg`: Played when collecting and clearing a completed trick.
  - Integrated with header volume slider (0–100%), one-click mute toggle, and `localStorage` persistence.
- **Six Trump Selection Options**:
  1. **Hearts (♥️)**: Secret suit concealed face-down.
  2. **Spades (♠️)**: Secret suit concealed face-down.
  3. **Clubs (♣️)**: Secret suit concealed face-down.
  4. **Diamonds (♦️)**: Secret suit concealed face-down.
  5. **Joker / No Trump (`NO_TRUMP`)**: No trump suit. Highest card of the led suit wins each trick; off-suit cards cannot cut; Royal Pairs cannot be declared.
  6. **7th Card Trump (`SEVENTH_CARD`)**: The bidder's 7th card (dealt during the 2nd deal of 4 cards) is reserved face-down on the table as the secret trump card. When trump is revealed during trick play, the card flips over, its suit becomes the trump suit, and it is added into the winning bidder's playable hand.
- **First-Bidder Point-Card Eligibility**:
  - The first bidder (player to the dealer's left) must hold at least one point-valued card (Jack=3, Nine=2, Ace=1, or Ten=1).
  - If the first bidder holds 0 point cards, all 16 dealt cards are automatically returned, reshuffled, and redealt until an eligible hand is formed, preserving the dealer and first bidder.
- **Humans + Computer Players**:
  - Any seat nobody takes in the lobby is filled by a computer player (realistic Indian name, own avatar, small `CPU` tag) when the host starts, so a match can begin with 1, 2, 3 or 4 people.
  - Computer players bid, choose trump (all 6 options), vote in the Double / Re-Double windows, ask for trump and play cards within about a second. They only use information their seat could know (a non-bidder never "knows" the concealed trump).
  - A friend who arrives late can join with the room code and take over a computer player's seat mid-match; a human who leaves mid-match is replaced by a computer player so their partner keeps playing.
  - If a human's turn timer runs out, the server makes the same sensible legal move for them. If every human disconnects, the match pauses until someone returns.
- **LAN-Only Architecture**: Zero reliance on public cloud services, external WebSockets, Supabase, or Firebase. Runs entirely on the host machine over local Wi-Fi / Ethernet (`0.0.0.0:3000`).
- **Session Reconnection**: Each browser tab gets a session token (kept in `sessionStorage`, so two tabs never fight over one seat). After a refresh or a Wi-Fi blip the client reconnects and reclaims its seat and hand automatically.
- **Seat Takeover**: If a player leaves or drops mid-match, anyone can rejoin with the room code and take over that seat, hand and all.
- **Host Hand-off**: If the host leaves, the host role passes to another connected player.
- **Private Hands**: Each device receives only its own hand; opponents' cards and the concealed trump never leave the server.
- **Non-Blocking `?` Rules Drawer**: Slide-out drawer accessible at any moment without pausing the match or resetting the timer.
- **QR Code & Mobile LAN Access**: Host screen displays a generated QR code and LAN Wi-Fi URL (`http://<HOST_IP>:3000`) for mobile phones and tablets to join instantly.

---

## 🃏 Traditional 29 Card Game Rules

### 1. The 32-Card Deck

The game is played with a 32-card deck (8 cards per suit) extracted from the original artwork:

| Rank | Points | Hierarchy | Role in 29 |
| :---: | :---: | :---: | :--- |
| **Jack (J)** | **3** | Highest (#7) | Supreme trump / trick-taking card |
| **Nine (9)** | **2** | Second (#6) | High-scoring power card |
| **Ace (A)** | **1** | Third (#5) | High-card trick winner |
| **Ten (10)** | **1** | Fourth (#4) | Scoring counter |
| **King (K)** | **0** | Fifth (#3) | Pair / Royals component |
| **Queen (Q)** | **0** | Sixth (#2) | Pair / Royals component |
| **Eight (8)** | **0** | Seventh (#1) | Neutral follow-suit card |
| **Seven (7)** | **0** | Lowest (#0) | Lowest card in rank |

$$\text{Total Card Points} = 4 \times (3 + 2 + 1 + 1) = 28\text{ points}$$

Winning the 8th (last) trick awards **1 bonus point**, bringing total available points to **29 points**.

---

### 2. Table Layout & Partnership

```
                       Seat 3: Partner (Team A)
                              [ Top / North ]
                                    ▲
                                    |
Seat 2: Opponent (Team B) <───────(FELT)───────> Seat 4: Opponent (Team B)
      [ Left / West ]               |                  [ Right / East ]
                                    ▼
                         Seat 1: You (Team A)
                            [ Bottom / South ]
```

Partners sit opposite each other and combine card points:
- **Team A**: Seat 1 (South) & Seat 3 (North)
- **Team B**: Seat 2 (West) & Seat 4 (East)

---

### 3. Match Progression Flow

```mermaid
flowchart TD
    A["Deal Phase 1: 4 Cards Each"] --> B{"First Bidder Has Point Card?"}
    B -- "No" --> C["Redeal 4 Cards to All Players"]
    C --> B
    B -- "Yes" --> D["One-Round Bidding Grid (16-28) - 30s Timer"]
    D --> E["Winning Bidder Selects from 6 Trump Options"]
    E --> F["Deal Phase 2: Remaining 4 Cards Dealt (7th Card Reserved if Selected)"]
    F --> G["8 Tricks Played (Mandatory Follow-Suit) - 30s Timer"]
    G --> H{"Player Cannot Follow Suit?"}
    H -- "Yes" --> I["Reveal Trump (Suit or 7th Card) on Table"]
    I --> J["Trump Active: Can Cut Tricks (7th Card Added to Hand)"]
    H -- "No" --> K["Continue Following Suit"]
    J --> L["Pair / Royals Declaration (+/- 4 Target)"]
    K --> L
    L --> M["1-Second Pause & Smooth Collection Animation into Winner's Seat"]
    M --> N["Round End Evaluation (+1 or -1 Game Points)"]
    N --> O{"Match Score Reached +/- 6?"}
    O -- "No" --> P["Clockwise Dealer Rotation"]
    P --> A
    O -- "Yes" --> Q["Match Victory!"]
```

1. **Initial Deal & Eligibility**: Each player is dealt 4 cards. The dealer is randomly chosen in Round 1 and rotates clockwise in subsequent rounds. The first bidder (player to dealer's left) must hold $\ge 1$ point card (J, 9, A, 10).
2. **Single-Round Auction (15s Turn Timer)**: Exactly 4 turns in clockwise order ($D+1 \to D+2 \to D+3 \to D$). Opening bid is minimum 16. Bidders select directly from the legal bid grid (16–28) with a single tap, or click PASS. If all 3 players pass, the dealer is forced to bid 16.
3. **Six Trump Options & 1-Second Table Announcements**: Winning bidder chooses among 4 suits, Joker / No Trump, or 7th Card. Joker and 7th Card trigger a 1-second central table announcement (7th Card preserves secrecy with face-down visual).
4. **Phase 2 Deal**: Remaining 4 cards dealt. In 7th Card mode, bidder's 7th card is reserved face-down on the table until revealed.
5. **Double & Re-Double Phase (10s Deadlines)**:
   - *Stage 1 (Defending Team)*: 10 seconds to select DOUBLE (2x) or PASS (1x).
   - *Stage 2 (Bidding Team)*: If doubled, 10 seconds to select RE-DOUBLE (4x) or PASS (2x).
   - Authoritative timeouts automatically PASS without popups.
6. **Trick Play (15s Turn Timer & Drag-to-Play)**:
   - Players drag cards from hand onto the central green felt trick area (scaled to `size="table"`).
   - Mandatory follow-suit: if holding lead suit, player must follow.
   - If unable to follow suit, player can click **Ask for Trump** to uncover the concealed suit or 7th card.
   - Once revealed, trump cards can cut and win non-trump tricks. In 7th Card mode, the 7th card returns to the bidder's hand.
   - In No Trump mode, the highest card of the lead suit always wins; off-suits cannot cut.
   - When 4 cards are played, cards pause for 750ms and smoothly glide as a cluster to the trick winner's seat.
7. **King-Queen Pair / Royals (Auto-Evaluated Upon Trump Reveal)**:
   - Evaluated upon legal trump reveal when contract bid $\ge 19$.
   - Player holding both King and Queen of the trump suit announces Pair (2-second visual card display).
   - **Bidding Team Pair**: Contract target decreases by 4 points ($\max(16, \text{Original Bid} - 4)$).
   - **Defending Team Pair**: Contract target increases by 4 points ($\min(29, \text{Original Bid} + 4)$).
8. **Match Scoring**:
   - Winning contract: awards $+1$ point (Normal), $+2$ points (Doubled), or $+4$ points (Re-Doubled) to the bidding team.
   - Failing contract: awards $-1$ point (Normal), $-2$ points (Doubled), or $-4$ points (Re-Doubled) to the bidding team.
   - Scoreboard tracks partnership match points. The first team to reach **+6 points** wins the match (negative scores fully supported).

---

## 🚀 How to Run the LAN Host Server

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on Node v25).
- All players must be connected to the **same Wi-Fi or Local Area Network**.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the LAN Host Server
Run the host command:
```bash
npm run lan:host
```
*(Or alternatively: `node server.js`)*

The server automatically compiles the frontend build, detects the host's private Wi-Fi IPv4 address, binds to `0.0.0.0:3000`, and displays the host banner:

```
════════════════════════════════════════════════════════════════════
       ♠ ♥ ♦ ♣   THE 29 GAME — LAN MULTIPLAYER HOST   ♣ ♦ ♥ ♠
════════════════════════════════════════════════════════════════════
  Local Access:      http://localhost:3000
  LAN / Wi-Fi URL:   http://192.168.1.2:3000
────────────────────────────────────────────────────────────────────
  HOW TO CONNECT PLAYERS ON YOUR LOCAL NETWORK:
  1. Ensure all laptops, phones, or tablets are on the same Wi-Fi.
  2. Open http://192.168.1.2:3000 on any browser.
  3. Join with your Room Code or scan the QR Code on screen.
════════════════════════════════════════════════════════════════════
```

### 3. Create a Room and Invite Friends
- On the host computer open `http://localhost:3000`, click **Host New LAN Room**.
- The lobby shows an invite link built from the host's LAN IP (e.g. `http://192.168.1.2:3000/?room=AB12CD`) and a QR code. Share either one.
- Other players open the link (or `http://<HOST_IP>:3000` → **Join LAN Game** → enter the room code). Each picks a seat; partners sit opposite each other (Seats 1 & 3 vs Seats 2 & 4).
- The host presses **Start Match** at any time. Open seats are filled by computer players, and friends can still join later and take a computer player's seat.

> **Firewall tip:** If others can't connect, allow Node.js through the host's firewall (macOS: *System Settings → Network → Firewall*; Windows: allow `node.exe` on *Private* networks). Guest/hotel Wi-Fi with "client isolation" blocks device-to-device traffic. Use a home router or a phone hotspot instead.

### 4. Running in Development Mode
Run the LAN game server and the Vite dev UI side by side:
```bash
npm run lan:dev
```
```bash
npm run dev
```
The dev UI runs on `http://localhost:5173` (also exposed on your LAN IP) and talks to the game server on port 3000.

---

## 🧪 Testing and Verification

Run the full suite of unit and integration tests covering card manifest point values, trick evaluation, bidding rules, 6 trump options, 7th card mechanics, dealer rotation, and LAN room management:

```bash
npm test
```

```
✓ src/engine/doubleScenarios.test.ts (6 tests)
✓ src/engine/trumpAndAnimation.test.ts (6 tests)
✓ src/engine/doubleAndPair.test.ts (16 tests)
✓ src/engine/engine.test.ts (28 tests)
✓ src/engine/lanCpu.test.ts (7 tests)
✓ src/engine/lanDoublePair.test.ts (12 tests)
✓ src/engine/lanRoom.test.ts (22 tests)
Test Files  7 passed (7)
     Tests  97 passed (97)
```

To run a production build verification:
```bash
npm run build
```

---

## 📁 Project Architecture

```
.
├── game_logo.png                  # Official 29 game logo
├── table.jpg                      # Full-screen edge-to-edge oval green table felt background
├── sound-effects/                 # Original game sound effects
│   ├── card-place-1.ogg          # Card played onto table
│   ├── card-shove-1.ogg          # Trick collected & shoved
│   ├── card-shuffle.ogg          # Deck shuffle at deal start
│   ├── card-slide-1.ogg          # Card hover/drag slide
│   └── cards-pack-take-out-1.ogg # Dealing cards
├── poker-cards-icons-collection/  # Original EPS playing card vector artwork collection
│   └── OIUGSZ1.eps               # Authoritative vector sheet for all 32 cards + card back
├── public/
│   ├── assets/
│   │   ├── cards/                # Converted pristine SVG & PNG 1440 DPI card assets
│   │   ├── sounds/               # Optimized OGG audio files for web audio playback
│   │   ├── game_logo.png         # Public logo asset
│   │   └── table.jpg             # Public table felt asset
├── scripts/
│   └── extract_cards.py          # Ghostscript 1440 DPI vector extraction pipeline
├── server/
│   ├── index.ts                  # Express + Socket.IO LAN server
│   ├── lanUtils.ts               # Local network IPv4 detection & terminal banner
│   └── roomManager.ts            # Authoritative room state, turn timers, computer players & seat takeover
├── server.js                     # Root executable server launcher (node server.js)
├── src/
│   ├── assets/
│   │   └── cardManifest.ts       # 32-card manifest, points, order, and asset paths
│   ├── common/
│   │   └── SoundManager.ts       # Web Audio API buffer engine with volume/mute controls
│   ├── components/
│   │   ├── card/
│   │   │   ├── CardPreviewGallery.tsx  # EPS card asset inspection gallery
│   │   │   └── PlayingCard.tsx         # Large, 100% opaque vector card component
│   │   ├── lobby/
│   │   │   ├── CreateRoomModal.tsx     # LAN room creator with rule presets
│   │   │   ├── HomeView.tsx            # Main landing view with game_logo.png
│   │   │   ├── HowToPlayModal.tsx      # Comprehensive rules dialog
│   │   │   ├── JoinRoomModal.tsx       # Join by code / host IP / seat selector
│   │   │   └── LobbyView.tsx           # 4-seat interactive lobby with QR code & logo
│   │   └── table/
│   │       ├── GameTable.tsx           # Full-screen edge-to-edge 29 table with table.jpg
│   │       ├── InTableBidding.tsx      # Clean 3-element direct-click bid grid with 30s timer
│   │       ├── InTableRoundSummary.tsx # Bright in-table round points breakdown
│   │       ├── InTableTrumpSelector.tsx# In-table 6-option secret trump selector with 30s timer
│   │       ├── OpponentSeat.tsx        # Animal emoji avatar, individual points, 30s countdown
│   │       ├── PlayerHand.tsx          # Horizontally spread hand with gentle overlap & hover lift
│   │       ├── RulesDrawer.tsx         # Non-blocking slide-out rules reference
│   │       ├── Scoreboard.tsx          # Minimal Team A vs Team B match scoreboard (+6 to win)
│   │       ├── TrickArea.tsx           # 1-second pause & smooth collection animation to winner
│   │       └── TrumpIndicator.tsx      # Bright in-table trump & 7th card indicator
│   ├── engine/
│   │   ├── bidding.ts            # Bidding logic, legal bid options, forced dealer
│   │   ├── biddingOrder.ts       # Seating, clockwise rotation, point-card eligibility
│   │   ├── autoPlay.ts           # Safe legal move when a player's turn timer expires
│   │   ├── bot.ts                # Computer player decisions (bid, trump, double, reveal, play)
│   │   ├── botNames.ts           # Realistic names for computer players
│   │   ├── deck.ts               # 32-card Fisher-Yates generator, 2-phase dealing (4+4)
│   │   ├── gameManager.ts        # Authoritative state machine & transitions
│   │   ├── scoring.ts            # Card points accumulator (28+1=29), Royals Pair (+/-4)
│   │   ├── tricks.ts             # Legal card filtering & follow-suit validation
│   │   └── types.ts              # Core TypeScript interfaces & rules types
│   ├── services/
│   │   └── lanClient.ts          # Client Socket.IO service & session reconnection
│   ├── App.tsx                   # Top-level state and view router
│   └── main.tsx                  # React DOM root entry
├── package.json
└── tsconfig.json
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
