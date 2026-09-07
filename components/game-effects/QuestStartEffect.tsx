'use client';

import React, { useEffect } from 'react';
import { cqSoundManager } from '@/lib/audio';
import HudSystemState from './HudSystemState';
import QuestMomentReveal from './QuestMomentReveal';
import styles from './QuestMoments.module.css';

/** Opening an available quest is its existing start interaction; no new gameplay state. */
export default function QuestStartEffect() {
  useEffect(() => {
    cqSoundManager.play('quest_start');
  }, []);

  return <QuestMomentReveal className={styles['cq-quest-start']}>
    <HudSystemState state="armed" label="QUEST SIGNAL ACQUIRED"
      detail="Follow the clue below. Your next discovery is out there." />
  </QuestMomentReveal>;
}
