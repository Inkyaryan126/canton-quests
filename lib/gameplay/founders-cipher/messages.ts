/**
 * Canton Quests — Founder's Cipher canonical gameplay message registry.
 *
 * Every message here is real, native-language copy — not a stand-in.
 * The gameplay FACT never changes across family/challenge/secret; only the
 * tone does. See lib/gameplay/founders-cipher/message-resolver.ts for how
 * these get resolved for a specific player, and
 * lib/gameplay/founders-cipher/types.ts for the shape.
 *
 * Not every id here is wired into live gameplay code yet — see the mission
 * report for exactly which ones are actually called from app/ today. This
 * file intentionally holds the FULL canonical set (per the design brief)
 * so the architecture is complete and consistent even where the
 * integration point doesn't exist yet.
 */

import { FounderCipherMessage, FounderCipherMessageId } from './types';

export const FOUNDER_CIPHER_MESSAGES: Record<FounderCipherMessageId, FounderCipherMessage> = {
  MISSION_ENTERED: {
    id: 'MISSION_ENTERED',
    title: 'TRANSMISSION RECEIVED',
    neutral: 'You are inside the Founder’s Cipher. The city is your board now.',
    family: { body: 'You’re in. Canton just became a lot more interesting — grab your crew and start exploring.' },
    challenge: { body: 'You’re live. The board is open and the clock is running. Move.' },
    secret: { body: 'Access granted. You are now inside the Cipher. Everything from here is on the record.' },
    presentation: 'commander-text',
    size: 'short',
    onceOnly: true,
  },

  MISSION_BRIEFING: {
    id: 'MISSION_BRIEFING',
    title: 'MISSION OBJECTIVE',
    neutral:
      'Your objective: find quests across Canton, complete them, and submit proof. Every quest is open to you regardless of your path.',
    family: {
      title: 'YOUR MISSION',
      body:
        'Here’s the plan: explore Canton, pick a quest that looks fun, and follow the clues to the real spot. Snap your proof, and you’re on the board — XP and prize drawing entries start stacking up. Every quest is open to you, no matter which door you picked.',
    },
    challenge: {
      title: 'THE OBJECTIVE',
      body:
        'Simple. Find a quest. Get to the real location. Submit proof. Bank the XP. Every quest in Canton is fair game — the leaderboard doesn’t care which path you started on. Go set the pace.',
    },
    secret: {
      title: 'YOUR ORDERS',
      body:
        'The city is hiding fragments of the Founder’s Cipher in plain sight. Find the quests, follow what they show you, and report back with proof. Every quest is unlocked to you — nothing is gatekept by the path you chose. Start pulling the thread.',
    },
    presentation: 'commander-text',
    size: 'medium',
    cta: 'BEGIN',
    onceOnly: true,
    archiveWorthy: true,
  },

  PLAYER_IDENTITY_CONFIRMED: {
    id: 'PLAYER_IDENTITY_CONFIRMED',
    title: 'IDENTITY CONFIRMED',
    neutral: 'Your Player Identity is complete and on file.',
    family: { body: 'Your Player Identity is set — you’re officially part of the crew.' },
    challenge: { body: 'Identity locked in. You’re on the board and ready to compete.' },
    secret: { body: 'Identity confirmed. Your profile is now part of the permanent record.' },
    presentation: 'micro',
    size: 'short',
  },

  QUEST_AVAILABLE: {
    id: 'QUEST_AVAILABLE',
    title: 'NEW QUEST AVAILABLE',
    neutral: 'A new quest is available on the board.',
    family: { body: 'A new adventure is ready. See what you can uncover.' },
    challenge: { body: 'Your next challenge is live. Go earn it.' },
    secret: { body: 'A new signal has surfaced. Investigate.' },
    presentation: 'commander-text',
    size: 'short',
  },

  QUEST_STARTED: {
    id: 'QUEST_STARTED',
    title: 'QUEST BRIEFING',
    neutral: 'You’ve opened this quest. Read the objective, then head out and complete it.',
    family: {
      title: 'LET’S GO',
      body: 'You’ve got a new quest open. Read what it’s asking, then head out and see what you find — take your time and enjoy it.',
    },
    challenge: {
      title: 'QUEST ON THE CLOCK',
      body: 'Quest opened. Know the objective, get there, get it done. Every minute counts toward the board.',
    },
    secret: {
      title: 'NEW SIGNAL OPENED',
      body: 'This quest just surfaced on your screen. Read the intel carefully — what it asks for and what it implies are not always the same thing.',
    },
    presentation: 'commander-text',
    size: 'short',
  },

  DISTRICT_ENTERED: {
    id: 'DISTRICT_ENTERED',
    title: 'DISTRICT ENTERED',
    neutral: 'You’ve entered a new district. More quests and cipher fragments are waiting here.',
    family: { body: 'New district, new adventure. Look around — there’s more to find here.' },
    challenge: { body: 'New territory. More objectives to clear. Get moving.' },
    secret: { body: 'You’ve crossed into new ground. Stay alert — the district holds more than it shows.' },
    presentation: 'commander-text',
    size: 'short',
  },

  CIPHER_FRAGMENT_FOUND: {
    id: 'CIPHER_FRAGMENT_FOUND',
    title: 'FRAGMENT RECOVERED',
    neutral: 'You found a cipher fragment. Each district holds a 3-piece record.',
    family: {
      title: 'FRAGMENT RECOVERED',
      body: 'You found another piece of the mystery. Nice work — keep going, the picture is starting to come together. Each district holds three pieces of a record.',
    },
    challenge: {
      title: 'FRAGMENT SECURED',
      body: 'Fragment secured. Every district has a three-piece record. Find all three in a sector to make it ready to decode.',
    },
    secret: {
      title: 'SIGNAL RECOVERED',
      body: 'A fragment has surfaced. The Cipher encodes three pieces per district. Secure all three to assemble the full record.',
    },
    presentation: 'commander-text',
    size: 'short',
    archiveWorthy: true,
  },

  FIRST_CIPHER_FRAGMENT_RECOVERED: {
    id: 'FIRST_CIPHER_FRAGMENT_RECOVERED',
    title: 'FIRST FRAGMENT RECOVERED',
    neutral: 'You recovered your first cipher fragment. Each district holds a 3-piece record. Collect all three fragments in a district to assemble its phrase.',
    family: {
      title: 'FIRST FRAGMENT RECOVERED',
      body: 'You found your first cipher fragment! Each district in Canton holds three pieces of a record. Collect all three in any district to get ready to decode its phrase.',
    },
    challenge: {
      title: 'FIRST FRAGMENT SECURED',
      body: 'First fragment secured. Every district has a three-piece record. Find all three in a sector to make it ready to decode.',
    },
    secret: {
      title: 'FIRST SIGNAL RECOVERED',
      body: 'First fragment recovered. The Cipher encodes three pieces per district. Secure all three to assemble the full record.',
    },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  CIPHER_FRAGMENT_STORED: {
    id: 'CIPHER_FRAGMENT_STORED',
    title: 'FRAGMENT LOGGED',
    neutral: 'The fragment has been stored in your district progress.',
    family: { body: 'Safely logged. That fragment is yours to keep now.' },
    challenge: { body: 'Logged and locked. On to the next one.' },
    secret: { body: 'Filed. The Cipher remembers everything you’ve recovered.' },
    presentation: 'micro',
    size: 'short',
  },

  CIPHER_NOT_READY_TO_DECODE: {
    id: 'CIPHER_NOT_READY_TO_DECODE',
    title: 'NOT ENOUGH TO DECODE',
    neutral: 'You don’t have enough fragments yet to attempt a decode. Keep collecting.',
    family: { body: 'Not quite enough pieces yet — keep exploring, you’re closer than you think.' },
    challenge: { body: 'Not enough material yet. Get back out there and close the gap.' },
    secret: { body: 'The pattern is incomplete. Continue gathering — premature decoding will only mislead you.' },
    presentation: 'micro',
    size: 'short',
  },

  DISTRICT_READY_TO_DECODE: {
    id: 'DISTRICT_READY_TO_DECODE',
    title: 'DISTRICT READY TO DECODE',
    neutral: 'You have gathered all 3 fragments for this district. Arrange them in the correct sequence to unlock the district Sigil.',
    family: {
      body: 'All three fragments found for this district! Open the decode panel and arrange the phrases in the right order to unlock its Sigil.',
    },
    challenge: {
      body: 'Three fragments secured in this district. The record is complete and ready to decode. Sequence the tiles to claim the Sigil.',
    },
    secret: {
      body: 'All three fragments recovered in this sector. The pattern is assembled — sequence the phrases correctly to unlock the Sigil.',
    },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  DISTRICT_SIGIL_UNLOCKED: {
    id: 'DISTRICT_SIGIL_UNLOCKED',
    title: 'DISTRICT SIGIL UNLOCKED',
    neutral: 'The district phrase has been decoded and verified. The district Sigil is now unlocked.',
    family: {
      body: 'You cracked the phrase! The district Sigil is officially unlocked. That’s one step closer to the Master Cipher.',
    },
    challenge: {
      body: 'Sequence verified. District Sigil unlocked. That’s one of three key records in the bag.',
    },
    secret: {
      body: 'The sequence holds. The Sigil has unlocked — the Cipher reveals its record.',
    },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  FOUNDER_LOCK_RECOVERED: {
    id: 'FOUNDER_LOCK_RECOVERED',
    title: 'FOUNDER LOCK RECOVERED',
    neutral: 'You recovered a Founder Lock. Founder Locks provide authorization keys for the Master Cipher.',
    family: {
      body: 'You recovered a Founder Lock! Three locks exist across Canton — each one provides authorization for the Master Cipher.',
    },
    challenge: {
      body: 'Founder Lock secured. That’s authorization locked in. You need all three to open the Master Cipher.',
    },
    secret: {
      body: 'A Founder Lock has surfaced. The authorization trail is underway — all three are required to breach the Master Cipher.',
    },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  ALL_THREE_LOCKS_RECOVERED: {
    id: 'ALL_THREE_LOCKS_RECOVERED',
    title: 'ALL THREE LOCKS SECURED',
    neutral: 'You have recovered all three Founder Locks (MARK, CODE, WORD). Authorization is complete. If all three district Sigils are also decoded, the Master Cipher will unlock.',
    family: {
      body: 'All three Founder Locks secured: MARK, CODE, and WORD! You have full authorization. Make sure all three district Sigils are decoded to open the Master Cipher.',
    },
    challenge: {
      body: 'All three Founder Locks recovered. Authorization confirmed. The Master Cipher remains sealed until all three district Sigils are decoded.',
    },
    secret: {
      body: 'The Three Locks are complete — MARK, CODE, WORD. Authorization verified. Master Cipher access still requires all three decoded Sigils.',
    },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  ALL_THREE_SIGILS_DECODED: {
    id: 'ALL_THREE_SIGILS_DECODED',
    title: 'ALL THREE SIGILS DECODED',
    neutral: 'All three district Sigils (Arts, Challenge, Secret) have been decoded. The evidence is complete. If all three Founder Locks are also secured, the Master Cipher will unlock.',
    family: {
      body: 'Every district Sigil is decoded! The full evidence is assembled. Secure all three Founder Locks to open the Master Cipher.',
    },
    challenge: {
      body: 'All three district Sigils decoded. Evidence complete. If you hold all three Founder Locks, the Master Cipher is yours to attempt.',
    },
    secret: {
      body: 'The three district sentences are resolved. Evidence confirmed. Master Cipher remains sealed without all three Founder Locks.',
    },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  MASTER_CIPHER_AVAILABLE: {
    id: 'MASTER_CIPHER_AVAILABLE',
    title: 'MASTER CIPHER AVAILABLE',
    neutral: 'All 3 Founder Locks and all 3 decoded Sigils have converged. The Master Cipher is now unlocked.',
    family: {
      body: 'You did it! 3 Founder Locks and 3 decoded Sigils — all six requirements are met. The Master Cipher is open.',
    },
    challenge: {
      body: 'Convergence achieved: 3 Locks, 3 Sigils. The Master Cipher is active. Enter the final decode.',
    },
    secret: {
      body: 'All six keys have converged — 3 Locks, 3 Sigils. The Master Cipher is unsealed. Proceed to final deduction.',
    },
    presentation: 'commander-text',
    size: 'long',
    cta: 'OPEN MASTER CIPHER',
    archiveWorthy: true,
  },

  CLUE_DISCOVERED: {
    id: 'CLUE_DISCOVERED',
    title: 'CLUE DISCOVERED',
    neutral: 'You uncovered a clue.',
    family: { body: 'You spotted something important — hang onto that detail.' },
    challenge: { body: 'Clue acquired. Use it — don’t waste it.' },
    secret: { body: 'A clue has surfaced. Not everything it tells you will be obvious yet.' },
    presentation: 'commander-text',
    size: 'short',
  },

  INVALID_ANSWER: {
    id: 'INVALID_ANSWER',
    title: 'VERIFICATION FAILED',
    neutral: 'That answer or proof did not verify. Review the quest details and try again.',
    family: { body: 'Not quite — take another look at what the clue is really showing you.' },
    challenge: { body: 'Wrong read. Reset. Look harder.' },
    secret: { body: 'That interpretation does not fit the signal. Re-examine the evidence.' },
    presentation: 'micro',
    size: 'short',
  },

  CORRECT_ANSWER: {
    id: 'CORRECT_ANSWER',
    title: 'CONFIRMED',
    neutral: 'That checks out.',
    family: { body: 'That’s it — nice catch. Keep going.' },
    challenge: { body: 'Confirmed. Keep the pace up.' },
    secret: { body: 'Verified. The signal holds. Continue.' },
    presentation: 'micro',
    size: 'short',
  },

  QUEST_COMPLETED: {
    id: 'QUEST_COMPLETED',
    title: 'QUEST SOLVED',
    neutral: 'Quest completed and verified.',
    family: { title: 'QUEST SOLVED!', body: 'Great find — quest complete! You’re building something real out there.' },
    challenge: { title: 'OBJECTIVE CLEARED', body: 'Objective cleared. That’s another one on the board. Next.' },
    secret: { title: 'CIPHER STEP RESOLVED', body: 'That thread is closed. What you found stays with you — the trail continues.' },
    presentation: 'commander-text',
    size: 'short',
  },

  DISTRICT_OBJECTIVE_COMPLETE: {
    id: 'DISTRICT_OBJECTIVE_COMPLETE',
    title: 'DISTRICT SIGIL UNLOCKED',
    neutral: 'You’ve collected every required fragment in this district. Its sigil is unlocked.',
    family: {
      body: 'You did it — every fragment in this district is yours, and the sigil is unlocked. That’s a whole piece of Canton uncovered.',
    },
    challenge: {
      body: 'District cleared. Every fragment collected, sigil unlocked. That’s a full sweep — on to the next.',
    },
    secret: {
      body: 'The district’s pattern is complete. Its sigil has unlocked — one more piece of the Cipher secured.',
    },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  KEY_FOUND: {
    id: 'KEY_FOUND',
    title: 'KEY RECOVERED',
    neutral: 'A key has been recovered. It unlocks your next destination.',
    family: { body: 'You found a key! It points somewhere new — let’s see where it leads.' },
    challenge: { body: 'Key recovered. Next objective is unlocked — go claim it.' },
    secret: { body: 'A key has surfaced. It opens a path that was closed to you until now.' },
    presentation: 'commander-text',
    size: 'short',
    archiveWorthy: true,
  },

  NEXT_LOCATION_REVEALED: {
    id: 'NEXT_LOCATION_REVEALED',
    title: 'NEXT LOCATION REVEALED',
    neutral: 'A new location is now available for you to visit.',
    family: { body: 'A new spot just opened up on the map — your next adventure awaits.' },
    challenge: { body: 'New location unlocked. Get there first.' },
    secret: { body: 'A new coordinate has been revealed. Proceed with caution.' },
    presentation: 'commander-text',
    size: 'short',
  },

  NEXT_DISTRICT_REVEALED: {
    id: 'NEXT_DISTRICT_REVEALED',
    title: 'NEXT DISTRICT REVEALED',
    neutral: 'A new district is now open to you.',
    family: { body: 'A whole new district just opened up. More places to explore, more to discover.' },
    challenge: { body: 'New district unlocked. More ground to cover — go claim it.' },
    secret: { body: 'A new district has come into view. What it hides is still unknown.' },
    presentation: 'commander-text',
    size: 'short',
    archiveWorthy: true,
  },

  ARTIFACT_FOUND: {
    id: 'ARTIFACT_FOUND',
    title: 'ARTIFACT RECOVERED',
    neutral: 'You recovered an artifact.',
    family: { body: 'You found something special — add it to your collection.' },
    challenge: { body: 'Artifact secured. Add it to the trophy case.' },
    secret: { body: 'An artifact has been recovered. Its purpose is not yet clear.' },
    presentation: 'commander-text',
    size: 'short',
  },

  XP_AWARDED: {
    id: 'XP_AWARDED',
    title: 'XP AWARDED',
    neutral: 'XP awarded.',
    family: { body: 'Nice — XP earned. Every bit adds up.' },
    challenge: { body: 'XP banked. Keep climbing the board.' },
    secret: { body: 'XP logged. Your standing has been updated.' },
    presentation: 'micro',
    size: 'short',
  },

  ENTRY_AWARDED: {
    id: 'ENTRY_AWARDED',
    title: 'PRIZE ENTRY EARNED',
    neutral: 'A prize drawing entry was earned and locked into the official drawing.',
    family: { body: 'That earned you a prize drawing entry — locked in and official.' },
    challenge: { body: 'Entry secured. Locked into the official drawing.' },
    secret: { body: 'Entry recorded. Locked into the drawing — no way to undo it now.' },
    presentation: 'micro',
    size: 'short',
  },

  BADGE_AWARDED: {
    id: 'BADGE_AWARDED',
    title: 'BADGE EARNED',
    neutral: 'A new badge has been added to your Player File.',
    family: { body: 'New badge earned — check it out on your Player File.' },
    challenge: { body: 'Badge earned. One more mark on the record.' },
    secret: { body: 'A badge has been added to your file. Proof you were here.' },
    presentation: 'micro',
    size: 'short',
  },

  TRANSMISSION_RECEIVED: {
    id: 'TRANSMISSION_RECEIVED',
    title: 'TRANSMISSION RECEIVED',
    neutral: 'A new Commander transmission has arrived.',
    family: { body: 'A message just came in from the Commander — worth a look.' },
    challenge: { body: 'Incoming transmission. Check it, then get back to it.' },
    secret: { body: 'A transmission has arrived. Its timing is rarely a coincidence.' },
    presentation: 'commander-text',
    size: 'short',
  },

  DISTRICT_REMAINING: {
    id: 'DISTRICT_REMAINING',
    title: 'DISTRICT PROGRESS',
    neutral: 'You still have fragments remaining to collect in this district.',
    family: { body: 'A few more pieces left in this district — you’re close.' },
    challenge: { body: 'District not clean yet. Finish it off.' },
    secret: { body: 'The pattern here is still incomplete. More remains to be found.' },
    presentation: 'micro',
    size: 'short',
  },

  BELL_EVENT_REACHED: {
    id: 'BELL_EVENT_REACHED',
    title: 'SIGNAL SPIKE DETECTED',
    neutral: 'A key mission event has been reached.',
    family: { body: 'Something big just happened — the mission just leveled up.' },
    challenge: { body: 'Major event triggered. This is where it gets real.' },
    secret: { body: 'A significant signal spike has been detected. The Cipher is reacting.' },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  ALL_REQUIRED_FRAGMENTS_FOUND: {
    id: 'ALL_REQUIRED_FRAGMENTS_FOUND',
    title: 'ALL FRAGMENTS RECOVERED',
    neutral: 'You have recovered every required cipher fragment across Canton. The final decode is now available.',
    family: {
      body: 'You did it — every fragment across Canton is yours. The picture is complete, and the final decode is ready when you are.',
    },
    challenge: {
      body: 'Full sweep. Every fragment recovered. The final decode is open — finish what you started.',
    },
    secret: {
      body: 'The collection is complete. Every fragment accounted for. The final decode is now within reach.',
    },
    presentation: 'commander-text',
    size: 'medium',
    cta: 'OPEN MASTER CIPHER',
    onceOnly: true,
    archiveWorthy: true,
  },

  FINAL_DECODE_AVAILABLE: {
    id: 'FINAL_DECODE_AVAILABLE',
    title: 'FINAL DECODE AVAILABLE',
    neutral: 'The final decode is available. Submit your answer when you are ready.',
    family: { body: 'You’re ready for the final decode whenever you are — take your time and get it right.' },
    challenge: { body: 'Final decode is live. This is the one that matters — make it count.' },
    secret: { body: 'The final decode is unlocked. Proceed only when certain.' },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  CIPHER_SOLVED: {
    id: 'CIPHER_SOLVED',
    title: 'CIPHER SOLVED',
    neutral: 'The Founder’s Cipher has been solved.',
    family: { body: 'You solved it — the Founder’s Cipher is cracked. What a journey.' },
    challenge: { body: 'Cipher solved. You closed it out. That’s the win.' },
    secret: { body: 'The Cipher is closed. What you uncovered stays with you.' },
    presentation: 'commander-text',
    size: 'long',
    archiveWorthy: true,
  },

  FINALE_UNLOCKED: {
    id: 'FINALE_UNLOCKED',
    title: 'FINALE UNLOCKED',
    neutral: 'You have qualified for the Mission finale.',
    family: { body: 'You’ve made it to the finale — the mission’s biggest moment is ahead of you.' },
    challenge: { body: 'Finale unlocked. You earned your shot — don’t waste it.' },
    secret: { body: 'The finale has opened to you. What comes next was not meant for everyone.' },
    presentation: 'commander-text',
    size: 'medium',
    onceOnly: true,
    archiveWorthy: true,
  },

  FINAL_SOLUTION_CORRECT: {
    id: 'FINAL_SOLUTION_CORRECT',
    title: 'SOLUTION CONFIRMED',
    neutral: 'Your final solution has been confirmed correct.',
    family: { body: 'That’s it — your solution is confirmed. You cracked it.' },
    challenge: { body: 'Solution confirmed. You earned this.' },
    secret: { body: 'Confirmed. The final answer holds.' },
    presentation: 'commander-text',
    size: 'medium',
    archiveWorthy: true,
  },

  MISSION_COMPLETE: {
    id: 'MISSION_COMPLETE',
    title: 'MISSION COMPLETE',
    neutral: 'The Founder’s Cipher mission is complete.',
    family: { body: 'You followed the trail, solved the mystery, and finished the mission. Well done.' },
    challenge: { body: 'Mission complete. You earned your place on the board.' },
    secret: { body: 'The Cipher is closed. What you uncovered stays with you.' },
    presentation: 'commander-text',
    size: 'long',
    onceOnly: true,
    archiveWorthy: true,
  },

  // Palace's optional Watcher signal anomaly (Phase 3D). Registered here as
  // content only — no engine trigger wires this yet (no existing hook fires
  // a message keyed to one specific quest's completion outside the
  // fragment/Lock system, and Palace grants neither). A future pass can
  // call showFounderCipherMessage({ messageId: 'PALACE_SIGNAL_ANOMALY', ... })
  // from the quest-completion handler once that hook exists. Per design:
  // fires only after a successful Palace completion, never blocks it,
  // never grants a fragment or Lock, never explains what "Watchers" means,
  // and never assumes any other quest's completion order.
  PALACE_SIGNAL_ANOMALY: {
    id: 'PALACE_SIGNAL_ANOMALY',
    title: 'SIGNAL ANOMALY',
    neutral: 'Record confirmed. Hold — a second source just returned the same signal. That should not be possible.',
    family: {
      body: 'Record confirmed. Hold on... I\'m reading the same return from somewhere else. That\'s not supposed to happen.',
    },
    challenge: {
      body: 'Record confirmed. Hold. I\'ve got the same return coming from a second source. That shouldn\'t be possible.',
    },
    secret: {
      body: 'Record confirmed. Hold — a second source just echoed the same signal back. That is not supposed to happen.',
    },
    presentation: 'commander-text',
    size: 'short',
    onceOnly: true,
  },
};

export const FOUNDER_LOCK_ORDINAL_MESSAGES = {
  first: {
    title: 'FIRST FOUNDER LOCK RECOVERED',
    neutral: 'You recovered your first Founder Lock (1 of 3). Three locks exist across Canton to provide authorization keys for the Master Cipher.',
    family: {
      body: 'You recovered your first Founder Lock! That’s 1 of 3 across Canton — each one provides authorization for the Master Cipher.',
    },
    challenge: {
      body: 'First Founder Lock secured (1 of 3). Authorization sequence initiated. You need all three to open the Master Cipher.',
    },
    secret: {
      body: 'The first Founder Lock has surfaced (1 of 3). The authorization trail is underway — all three are required to breach the Master Cipher.',
    },
  },
  second: {
    title: 'SECOND FOUNDER LOCK RECOVERED',
    neutral: 'You recovered your second Founder Lock (2 of 3). One lock remains before authorization is complete.',
    family: {
      body: 'You recovered your second Founder Lock! That’s 2 of 3 secured. Just one more lock to complete authorization for the Master Cipher.',
    },
    challenge: {
      body: 'Second Founder Lock secured (2 of 3). Two down, one remaining. Keep pushing to complete Master Cipher authorization.',
    },
    secret: {
      body: 'The second Founder Lock has surfaced (2 of 3). Only one key remains concealed before Master Cipher authorization is whole.',
    },
  },
  third: {
    title: 'THIRD FOUNDER LOCK RECOVERED',
    neutral: 'You recovered your third Founder Lock (3 of 3). All three locks are now secured. Authorization is complete.',
    family: {
      body: 'You recovered your third Founder Lock! All 3 of 3 secured! You have full authorization. Make sure all three district Sigils are decoded to open the Master Cipher.',
    },
    challenge: {
      body: 'Third Founder Lock secured (3 of 3). Full authorization locked in. The Master Cipher remains sealed until all three district Sigils are decoded.',
    },
    secret: {
      body: 'The third Founder Lock has surfaced (3 of 3). The Three Locks are complete. Master Cipher access still requires all three decoded Sigils.',
    },
  },
} as const;
