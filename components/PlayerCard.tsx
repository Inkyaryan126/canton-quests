'use client';

import React from 'react';
import Image from 'next/image';
import {
  PLAYER_CARD_LAYOUT,
  getCallsignFontScale,
} from '@/lib/player-card-layout';
import { getAvatarCropStyle } from '@/lib/avatar-crop';

export interface PlayerCardBadge {
  id?: string;
  name: string;
  iconPath: string;
}

const PLAYER_LEVEL_SEGMENT_COUNT = PLAYER_CARD_LAYOUT.playerLevel.segments.length;

export interface PlayerCardProps {
  displayName: string;
  motto?: string;
  avatarImage: string;
  cropZoom?: number;
  cropX?: number;
  cropY?: number;
  totalXp: number;
  completedQuests: number;
  prizeEntries: number;
  cityRank: number | null;
  /** Distinct quests the player has participated in (any submission, any status) — fills the Player Level segments left to right, capped at the number of available segments. */
  participatedQuestCount?: number;
  memberSinceDate?: string;
  playerCode?: string;
  playerLevelText?: string;
  clearanceLevelText?: string;
  featuredBadges?: (PlayerCardBadge | null | undefined)[];
  className?: string;
}

export default function PlayerCard({
  displayName,
  motto,
  avatarImage,
  cropZoom = 1,
  cropX = 50,
  cropY = 50,
  totalXp,
  completedQuests,
  prizeEntries,
  cityRank,
  participatedQuestCount = 0,
  memberSinceDate,
  playerCode,
  playerLevelText = 'ACTIVE // FIELD READY',
  clearanceLevelText = 'LEVEL 1 // AGENT',
  featuredBadges = [],
  className = '',
}: PlayerCardProps) {
  const cleanName = (displayName || 'Canton Agent').trim();
  const callsignClass = getCallsignFontScale(cleanName);
  const cleanMotto = (motto || '').trim();
  const filledLevelSegments = Math.max(0, Math.min(participatedQuestCount, PLAYER_LEVEL_SEGMENT_COUNT));

  return (
    <div className={`cq-player-card-wrap ${className}`} role="region" aria-label="Player ID Card">
      {/* 1. Master fixed artwork background */}
      <Image
        src="/canton-quests/player_card.png"
        alt="Canton Quests Player ID Card"
        fill
        priority
        sizes="(max-width: 640px) 96vw, 420px"
        className="cq-player-card-art"
      />

      {/* 2. Top Header Player ID Code */}
      <div
        className="cq-card-header-id"
        style={PLAYER_CARD_LAYOUT.headerPlayerId}
        title={playerCode || 'CQ-2026'}
      >
        <span>{playerCode || 'CQ-2026'}</span>
      </div>

      {/* 3. Circular Player Photo / Avatar */}
      <div
        className="cq-card-photo"
        style={{
          ...PLAYER_CARD_LAYOUT.avatar,
          backgroundImage: `url(${avatarImage})`,
          ...getAvatarCropStyle(cropZoom, cropX, cropY),
        }}
        role="img"
        aria-label={`${cleanName} avatar preview`}
      />

      {/* 4. Callsign (Single line, dynamically scaled) */}
      <div
        className={`cq-card-callsign ${callsignClass}`}
        style={PLAYER_CARD_LAYOUT.callsign}
        title={cleanName}
      >
        <span>{cleanName}</span>
      </div>

      {/* 5. Motto (optional, replaces the old Starting Path + Starting District area) */}
      <div
        className="cq-card-motto"
        style={PLAYER_CARD_LAYOUT.motto}
        title={cleanMotto || undefined}
      >
        {cleanMotto && <span>&quot;{cleanMotto}&quot;</span>}
      </div>

      {/* 6. Player Level — distinct-quest participation, filled left to right */}
      {PLAYER_CARD_LAYOUT.playerLevel.segments.map((segmentStyle, index) => {
        const filledClass = index < filledLevelSegments ? 'is-filled' : '';
        return (
          <div
            key={index}
            className={`cq-card-level-segment ${filledClass}`}
            style={segmentStyle}
            title={`Player Level segment ${index + 1} of ${PLAYER_LEVEL_SEGMENT_COUNT}`}
          />
        );
      })}

      {/* 7. Player Signal / Status */}
      <div
        className="cq-card-signal"
        style={PLAYER_CARD_LAYOUT.signal}
        title={playerLevelText}
      >
        <span>{playerLevelText}</span>
      </div>

      {/* 8. Numeric Stat Row (XP, Quests Complete, Prize Entries, City Rank) */}
      <div
        className="cq-card-stat cq-card-stat-xp"
        style={PLAYER_CARD_LAYOUT.totalXp}
        title={`Total XP: ${totalXp.toLocaleString()}`}
      >
        <span>{totalXp.toLocaleString()}</span>
      </div>

      <div
        className="cq-card-stat cq-card-stat-completed"
        style={PLAYER_CARD_LAYOUT.questsComplete}
        title={`Quests Complete: ${completedQuests}`}
      >
        <span>{completedQuests}</span>
      </div>

      <div
        className="cq-card-stat cq-card-stat-entries"
        style={PLAYER_CARD_LAYOUT.prizeEntries}
        title={`Prize Entries: ${prizeEntries}`}
      >
        <span>{prizeEntries}</span>
      </div>

      <div
        className="cq-card-stat cq-card-stat-rank"
        style={PLAYER_CARD_LAYOUT.cityRank}
        title={`City Rank: ${cityRank ? `#${cityRank}` : 'Unranked'}`}
      >
        <span>{cityRank ? `#${cityRank}` : 'Unranked'}</span>
      </div>

      {/* 9. Six Individually Aligned Badge Circles */}
      {PLAYER_CARD_LAYOUT.badges.map((slotStyle, index) => {
        const badge = featuredBadges[index];
        return (
          <div
            key={index}
            className="cq-card-badge-slot"
            style={slotStyle}
            title={badge ? badge.name : `Empty Badge Slot ${index + 1}`}
          >
            {badge && badge.iconPath && (
              <Image
                src={badge.iconPath}
                alt={badge.name}
                fill
                sizes="(max-width: 640px) 15vw, 64px"
                className="cq-card-badge-img"
              />
            )}
          </div>
        );
      })}

      {/* 10. Bottom Metadata: Member Since */}
      <div
        className="cq-card-member-since"
        style={PLAYER_CARD_LAYOUT.memberSince}
        title={memberSinceDate ? `Member Since: ${memberSinceDate}` : undefined}
      >
        <span>{memberSinceDate || 'AUG 2026'}</span>
      </div>

      {/* 11. Bottom Metadata: Player ID Code */}
      <div
        className="cq-card-id-code"
        style={PLAYER_CARD_LAYOUT.playerIdCode}
        title={playerCode || 'CQ-8821'}
      >
        <span>{playerCode || 'CQ-8821'}</span>
      </div>

      {/* 12. Bottom Metadata: Clearance Level */}
      <div
        className="cq-card-clearance"
        style={PLAYER_CARD_LAYOUT.clearanceLevel}
        title={clearanceLevelText}
      >
        <span>{clearanceLevelText}</span>
      </div>
    </div>
  );
}
