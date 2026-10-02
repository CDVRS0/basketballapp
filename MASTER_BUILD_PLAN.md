# CD4Q Runs: Master Build Plan V5.2

**Client:** CDVRS Sports  
**Products:** CD4Q Runs (fortnightly scrimmages) and Takeover 3x3 tournaments  
**Reference prototype:** V5 interactive demo  
**Brand:** White, blue and black across the system. Takeover 3x3 uses black/orange/white as its event theme, while other events default to the system palette but may use an admin-selected theme.

## New requested tournament and credit requirements

- Player dashboards show membership credits as available, held, and used.
- A booked member credit is held until that run's cancellation cutoff; when the cutoff passes, it becomes used and is no longer available. The configured cutoff defaults to 12 hours before start.
- Each dated run displays its venue and full address with a direct Google Maps location link. Admin run editing includes schedule, venue, address, capacity, theme, status, and cancellation cutoff.
- Admin tournament editing includes title, schedule, deadline, venue/address, age categories, maximum teams, 3/4/5-player team prices, and configurable player-detail fields.
- Takeover registration supports teams of 3, 4, or 5, a team name, an age category, and a captain selected from the roster.
- Each player can have full name, home town, email, emergency contact, age, medical details, allergies, media consent, position, and skill level (Beginner, Intermediate, Advanced, Elite). Admin configuration controls which optional fields are collected; identity and email are required by default.
- Under-18 players require guardian name, email, phone, and consent.
- Every player individually accepts: information accuracy; physical-sport risk; rules and respect; conduct/removal; responsibility for belongings; and emergency-treatment consent. Each player also accepts the tournament data-protection notice.
- Stripe Checkout must show the team name and correct configured team-size price. Registration stays pending until a verified Stripe webhook confirms payment. Only then is the team place secured, the registration confirmed in the database, and confirmation emails sent to players and required guardians. The app then returns to a confirmation screen.
- Registration data, consent versions/timestamps, captain selection, category, team size, Stripe identifiers and payment status are stored in Supabase. Medical/contact information must only be readable by authorized admins and the registrant, with the agreed deletion policy.
- Current implementation status: the form, admin configuration UI, credit demo ledger, and schema fields are present. Admin settings and demo bookings are browser-local only. Supabase Auth, production database writes, Stripe Checkout/webhook, transactional email, and post-payment return are not connected; do not accept real registrations or claim a payment/email succeeded until these services are configured and secured.

## V5.2 follow-up requirements

- Replacement credit validity: returned member credits remain valid until the later of the original billing-period end or 30 days after cancellation, including when the membership has already ended. For example, if the period ended before CDVRS cancels the run, the replacement credit remains usable for 30 days after cancellation.
- Live meters: runs and Takeover events use a real-time green progress bar between the start and end timestamps.
- Run goes live and Takeover goes live controls are available in the prototype and app for demo mode to show the live meter without waiting for the real time window.
- Profile identity is based on first/last name, with initials derived from those fields and an editable avatar colour.
- Player profile fields include level, aim, favourite team, favourite player, age, city, Instagram, TikTok, and a profile visibility toggle.
- Admin-only safety details: emergency contact, medical information and allergies remain visible only to admins. A valid emergency contact is required before a run can be booked.
- Players on a live run should still be viewable from the run card even after the run has started.
- Members with no credits may still pay £7 for an eligible run.
- Under-18 Takeover players show guardian fields and required consent before submission.
- Confirmations go to every team player and the guardians of under-18 team members.
- Takeover medical and allergy details are deleted when the event ends. Run medical and allergy details remain on the player's profile until the player removes them, with a reminder to re-confirm every 6 months unless the client wants a different policy.
- When CDVRS cancels a run, a replacement member credit expires at the later of the original billing-period end or 30 days after cancellation. It remains usable even if the original membership has ended.
- A member with no available credits may book eligible runs at the £7 PAYG price.
- Takeover 3/4/5-player prices and whether a member discount applies to the member's share or the whole team price are TBC. Do not apply a team discount until the client confirms the rule.
- Under-18 players require guardian details and consent; every team player receives a post-payment confirmation email.
- Phone/push-style notifications appear in the app notifications list when a booking, waitlist, or payment update happens.
- Booking and payment actions send a confirmation email to the user and any required guardian/teammates.
- Admins can create and edit posted runs/scrimmages. Admin editing must retain a record of changes and allow venue, capacity, timing, and theme updates.
- Takeover events keep the black/orange/white palette, while other events default to the system palette and can optionally use another selected colour theme.
- Future live scoreboard and referee workflow remains reserved for later implementation and is documented as a placeholder.

## 1. Product

Mobile-first web app where authenticated players can book CD4Q runs with membership credits or £7 PAYG, see who is booked, view directions, manage profiles and register teams for Takeover 3x3. Admins manage sessions, memberships, tournaments, messages, payments and settings.

## 2. Authentication

- No sessions, events or prices are visible before login.
- Supabase Auth.
- Sign-up: full name, email, password, email verification.
- Password reset uses generic responses, one-hour single-use links and ends other sessions after reset.
- Rate-limit authentication.
- Admin role is stored in `profiles.role` and checked server-side.
- Session persistence: 30 days, configurable.
- Emergency contact is required before a player can book.

## 3. CD4Q sessions

Admin can create **and edit already-posted runs**. Editing remains available after publication, with an audit log. Important changes such as date/time, venue, capacity or cancellation cutoff should trigger an admin confirmation and player notification where relevant.

Session fields:
- title
- start/end
- venue
- full address
- entrance/parking notes
- capacity
- cancellation cutoff
- draft/published/cancelled
- notes
- map coordinates
- optional event theme

Recurring creation supports weekly/fortnightly runs.

Players see:
- date/time
- venue
- live capacity
- spaces left
- map/directions
- attendee list if confirmed booked

PAYG visibility defaults to 5 days. Members see all published future sessions.

## 4. Live run state

From start to end:
- capacity UI becomes a green live meter
- server-time offset prevents incorrect phone clocks
- booking/waitlist/cancellation are disabled
- the player can **still view the people on the run**
- the card shows `LIVE · X min played · Y min left`
- after the end: `Finished`

The attendee list remains accessible while live.

### Future scoreboard/referee system

The data model and session page should leave a dedicated area for a future live game-control system:
- referee assignment
- scoreboard
- score changes
- game timer
- player stats
- live score feed
- admin/referee controls

For V5.1, this is a placeholder only. No scoring logic is required yet.

## 5. Player profiles

Profile identity is based on:
- first name
- last name
- avatar initials generated from first/last name

Player can choose the avatar background colour from an approved palette. The initials update automatically if the name changes.

Profile fields:
- level
- basketball aim
- favourite team
- favourite player
- age
- city
- Instagram
- TikTok
- future social links can be added through an extensible social-links structure
- profile visibility
- show-my-name setting

Only confirmed players on the same run can view another player's profile card.

Social links are optional and player-controlled. Never expose email, phone, medical data or exact under-18 age.

## 6. Memberships

| Product | Price | Credits |
|---|---:|---:|
| PAYG | £7/session | none |
| CD4Q 2 | £15/month | 2 per real billing period |
| CD4Q 4 | £30/2 months | 4 per real billing period |
| Future CDVRS Sports Pass | ~£5.99/month | no credits; perks |

Credits belong to the real membership period, not the calendar month.

Example:
25 Oct → 25 Nov = 2 credits for CD4Q 2.

The number of fortnightly runs inside a period can vary. Credits are not tied to the number of runs.

A member with no credits can pay £7 for an eligible run.

## 7. Credits

States:
- Available
- Held
- Used

At booking, a member credit is held.

When the free-cancellation cutoff passes, the held credit becomes used.

Unused credits expire at the end of the membership period.

If CDVRS cancels a run:
- member gets the credit back even if inside cutoff
- PAYG player gets a refund
- returned member credit receives an `expires_at` equal to the later of the original period end or the configured replacement validity window (currently proposed: 30 days)
- this returned credit remains usable even if the original membership period has ended

## 8. Cancellation

PAYG:
- >12h: refund initiated
- <12h: no refund

Member:
- >12h: credit returned
- <12h: credit not returned

Admin cancellation:
- member credit returned
- PAYG refund initiated
- all booked/waitlisted players notified

Refund language:
`Refund initiated. The time it takes to appear depends on your payment provider.`

## 9. Failed Direct Debit

Day 0:
- renewal fails
- membership becomes `past_due`
- no new credits
- no new member bookings
- no priority
- no Takeover member discount
- existing confirmed bookings remain valid
- PAYG booking remains available inside the PAYG window

Day 3:
- Stripe retries

If successful:
- status returns to active
- new period created
- credits granted
- member access restored
- confirmation sent

If final payment fails:
- status becomes unpaid/cancelled
- player falls back to PAYG
- unused credits are lost
- future bookings outside PAYG window are cancelled
- bookings inside PAYG window remain

The browser never decides payment status; Stripe webhooks are the source of truth.

## 10. Waitlist

Priority:
1. active members
2. PAYG

Within each group: earliest joined first.

When a place opens:
- first eligible player receives an offer
- default claim window: 2 hours
- unclaimed offer passes to the next player
- a lapsed member is treated as PAYG

## 11. Takeover 3x3

Takeover uses:
- black
- orange
- white

Admin creates:
- title
- start/end
- venue/address/map
- age categories
- team prices for 3/4/5 players
- registration deadline
- maximum teams
- description/image
- configurable registration fields
- event colour/theme

Team registration:
- one logged-in registrant
- team size determines price
- full team information collected
- under-18 players require guardian fields and consent
- all required agreements collected individually
- medical/allergy information collected only when enabled
- registration starts as pending
- payment secures place only after Stripe webhook confirms payment
- unpaid pending registrations expire after 30 minutes
- every team player receives confirmation email
- guardians of under-18 players receive confirmation email

Member discount:
15% off the registrant's own share is the current implementation, pending final client confirmation.

## 12. Other events / colour themes

All non-Takeover events default to the CDVRS white/blue/black system.

Admin can optionally choose an event accent/theme:
- default
- blue
- another approved brand colour
- future custom theme support

Theme choices are stored on the event/tournament record.

Takeover is fixed to black/orange/white unless the brand rule is explicitly changed.

## 13. Player dashboard

Navigation:
- Home
- Sessions
- Events
- Plan
- Alerts
- Profile

Dashboard includes:
- admin messages
- membership status
- billing cycle
- Available/Held/Used credits
- upcoming bookings
- directions
- Takeover registrations
- settings

## 14. Notifications

### In-app notifications

Every important action creates an in-app notification:
- booking confirmed
- booking cancelled
- waitlist joined
- waitlist promotion
- space opened
- low availability
- payment failed
- payment recovered
- membership ending
- membership ended
- run cancelled
- Takeover registration confirmed
- admin message

### Email

A confirmation email is sent after successful booking/payment confirmation.

Examples:
- PAYG booking confirmation
- membership purchase confirmation
- membership renewal/payment recovery
- Takeover team registration confirmation
- run cancellation/refund notice
- waitlist promotion

Emails are sent through Resend after the server confirms the relevant database/Stripe state.

### Phone pop-ups

Yes: these should be implemented as **push notifications** rather than SMS by default.

For the web app:
- browser push permission
- service worker
- Web Push subscription stored against the player
- push notification for booking confirmations, waitlist offers, space openings, cancellations and payment alerts
- player can enable/disable push notifications in Settings

A future native app can use Apple/Android native push without changing the notification event architecture.

SMS is a separate future feature because it has per-message costs and requires a provider such as Twilio.

## 15. Maps

Each run/event stores geocoded coordinates.

Buttons:
- Google Maps
- Apple Maps

Player chooses default maps app.

## 16. Safeguarding / GDPR

### Runs

Emergency contact is required.

Medical/allergy data:
- admin-only
- shown to authorised admins on attendee information
- player can edit/delete
- reconfirmation reminder every 6 months
- deleted when the account is deleted
- proposed rule remains configurable and must be confirmed with the client's legal/safeguarding advisor

### Takeover

Medical/allergy data:
- admin-only
- deleted automatically shortly after tournament end (default 24h)
- rest of registration remains

Under-18:
- guardian name, phone, email and consent required
- guardian becomes emergency contact
- confirmation email sent to guardian

## 17. Admin

Admin can:
- create runs
- **edit posted runs**
- publish/unpublish
- cancel runs
- change capacity
- change venue/address
- change date/time
- change cutoff
- manage attendees
- check in
- manage waitlists
- manage members
- manage payments
- manage messages
- create/edit Takeover events
- create/edit other events
- select event colour theme
- view audit log
- manage notification settings
- configure system settings

Every admin action is logged.

## 18. Data model additions

`profiles` includes:
- first_name
- last_name
- avatar_color
- instagram
- tiktok
- maps preference
- visibility preferences

Add an extensible `social_links` JSONB field later if more platforms are needed.

`events/tournaments` include:
- theme
- accent colour
- theme_locked (for Takeover)

Add future live-game structures:
- `game_sessions`
- `game_scores`
- `game_events`
- `referee_assignments`

These can be added later without changing booking logic.

Add:
- `push_subscriptions`
- `notification_preferences`

## 19. Security

- Supabase RLS on all tables
- server-side admin checks
- server-side membership/credit/capacity/price validation
- Stripe webhook verification
- idempotent webhook processing
- transactional last-place booking
- rate limits
- HTTPS
- input validation
- no card data stored in app
- medical data restricted to authorised admin roles
- daily backups
- error monitoring

## 20. Build phases

1. Foundation/auth/profile/RLS
2. Sessions/maps/editing/capacity/booking
3. Memberships/credits/Stripe/Bacs
4. Waitlist/notifications/email
5. Admin dashboard/edit/cancel/messages
6. Takeover registration/payments/guardian flow
7. GDPR/accessibility/security
8. Real-device testing and launch
9. Push notifications
10. Future scoreboard/referees/live scores
11. Referrals
12. CDVRS Sports Pass

## 21. Key acceptance tests

- Visitor cannot see sessions, events or prices.
- Verified account required before booking/payment.
- Admin can edit a published run and players receive relevant update notifications.
- Avatar always uses first/last initials and player can change avatar colour.
- Instagram/TikTok links appear only when the player enables/enters them.
- Confirmed booked players can still see the attendee list while the run is live.
- Live meter updates in real time.
- Future scoreboard/referee placeholder exists without affecting booking.
- Successful booking creates an in-app notification and confirmation email.
- Successful Takeover payment creates team confirmation emails.
- Push notification permission can be enabled/disabled.
- Failed Direct Debit does not grant new credits or new member benefits.
- Existing valid bookings survive the 3-day retry.
- Successful retry restores membership and creates the new period.
- Admin cancellation returns credits/refunds and notifies players.
- Takeover is black/orange/white.
- Other events use default colours unless admin selects a theme.
- Under-18 guardian consent blocks incomplete registration.
- Takeover medical and allergy data is deleted when the event ends.
- Run medical and allergy data remains on the player safety profile until removed, with a six-month reconfirmation reminder.
