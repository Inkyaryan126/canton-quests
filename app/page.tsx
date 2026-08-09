export default function PhaseZeroFoundationPage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          padding: '0.4rem 1rem',
          borderRadius: '9999px',
          backgroundColor: '#161e2e',
          border: '1px solid #f59e0b',
          color: '#f59e0b',
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: '1.5rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Phase 0 — Project Foundation Established
      </div>

      <h1
        style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          marginBottom: '1rem',
          letterSpacing: '-0.02em',
        }}
      >
        Canton Quests
      </h1>

      <p
        style={{
          fontSize: '1.125rem',
          color: '#9ca3af',
          lineHeight: '1.6',
          marginBottom: '2rem',
        }}
      >
        A living real-world game layered over Canton, Ohio. Combining citywide scavenger hunts,
        puzzles, local business missions, ARGs, and community weekend events.
      </p>

      <div
        style={{
          background: '#161e2e',
          border: '1px solid #243044',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          width: '100%',
          textAlign: 'left',
          marginBottom: '2rem',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#f9fafb' }}>
          Documentation Brain Ready
        </h2>
        <ul style={{ listStyle: 'none', paddingLeft: 0, color: '#9ca3af', fontSize: '0.95rem' }}>
          <li style={{ padding: '0.3rem 0' }}>📄 <strong>PROJECT-BRAIN.md</strong> — Canonical Source of Truth</li>
          <li style={{ padding: '0.3rem 0' }}>🎮 <strong>GAME-SYSTEM.md</strong> — Mechanics & Multi-Category Scoring</li>
          <li style={{ padding: '0.3rem 0' }}>🗺️ <strong>PLAYER-JOURNEY.md</strong> — 14-Stage Experience Lifecycle</li>
          <li style={{ padding: '0.3rem 0' }}>🧩 <strong>QUEST-DESIGN.md</strong> — 17 Quest Types & 8-Point Rubric</li>
          <li style={{ padding: '0.3rem 0' }}>🛡️ <strong>SAFETY-AND-RULES.md</strong> — Strict Real-World Safety Protocol</li>
          <li style={{ padding: '0.3rem 0' }}>💻 <strong>TECH-ARCHITECTURE.md</strong> & <strong>DATABASE.md</strong> — Tech & DB Specs</li>
          <li style={{ padding: '0.3rem 0' }}>🤖 <strong>AGENTS.md</strong> — 20 Rules for AI Coding Agents</li>
        </ul>
      </div>

      <footer style={{ fontSize: '0.85rem', color: '#6b7280' }}>
        Next Phase: Phase 1 — Playable MVP (Authentication, Map Engine, QR Verification).
      </footer>
    </main>
  );
}
