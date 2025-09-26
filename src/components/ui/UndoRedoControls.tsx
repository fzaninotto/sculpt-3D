interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function UndoRedoControls({ canUndo, canRedo, onUndo, onRedo }: UndoRedoControlsProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '10px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: '10px',
      borderRadius: '8px',
      zIndex: 100,
    }}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        style={{
          padding: '8px 16px',
          backgroundColor: canUndo ? '#4a4a4a' : '#2a2a2a',
          border: 'none',
          borderRadius: '4px',
          color: canUndo ? 'white' : '#666',
          cursor: canUndo ? 'pointer' : 'not-allowed',
          fontFamily: 'monospace',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 0.2s',
        }}
        title="Undo (Ctrl/Cmd + Z)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
        </svg>
        Undo
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        style={{
          padding: '8px 16px',
          backgroundColor: canRedo ? '#4a4a4a' : '#2a2a2a',
          border: 'none',
          borderRadius: '4px',
          color: canRedo ? 'white' : '#666',
          cursor: canRedo ? 'pointer' : 'not-allowed',
          fontFamily: 'monospace',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 0.2s',
        }}
        title="Redo (Ctrl/Cmd + Shift + Z)"
      >
        Redo
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
        </svg>
      </button>
    </div>
  );
}