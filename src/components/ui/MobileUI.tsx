import { useState, useEffect } from 'react';
import type { ToolType, PrimitiveType } from '../../types';

interface MobileUIProps {
  // Tool state
  currentTool: ToolType;
  setCurrentTool: (tool: ToolType) => void;
  selectedPrimitive: PrimitiveType;
  setSelectedPrimitive: (primitive: PrimitiveType) => void;

  // Sculpting controls
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushStrength: number;
  setBrushStrength: (strength: number) => void;
  symmetryAxes: { x: boolean; y: boolean; z: boolean };
  setSymmetryAxes: (axes: { x: boolean; y: boolean; z: boolean }) => void;

  // Render mode
  selectedRenderMode: 'shaded' | 'mesh';
  onRenderModeChange: (mode: 'shaded' | 'mesh') => void;

  // Actions
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDeleteSelected: () => void;
  hasSelection: boolean;
}

export function MobileUI({
  currentTool,
  setCurrentTool,
  selectedPrimitive,
  setSelectedPrimitive,
  brushSize,
  setBrushSize,
  brushStrength,
  setBrushStrength,
  symmetryAxes,
  setSymmetryAxes,
  selectedRenderMode,
  onRenderModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDeleteSelected,
  hasSelection,
}: MobileUIProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showPrimitives, setShowPrimitives] = useState(false);
  const [showSculptControls, setShowSculptControls] = useState(false);
  const [showSculptTools, setShowSculptTools] = useState(false);

  const mainTools: { type: ToolType; icon: string; label: string }[] = [
    { type: 'select', icon: '↖', label: 'Select' },
    { type: 'add-primitive', icon: '◯', label: 'Add' },
    { type: 'move', icon: '✥', label: 'Move' },
    { type: 'scale', icon: '⟷', label: 'Scale' },
  ];

  const sculptTools: { type: ToolType; icon: string; label: string }[] = [
    { type: 'add', icon: '+', label: 'Add' },
    { type: 'subtract', icon: '-', label: 'Subtract' },
    { type: 'push', icon: '→', label: 'Push' },
  ];

  const primitives: PrimitiveType[] = ['sphere', 'cube', 'cylinder', 'cone', 'torus'];

  const isSculptTool = currentTool === 'add' || currentTool === 'subtract' || currentTool === 'push';

  // Close primitive selector when tool changes away from add-primitive
  useEffect(() => {
    if (currentTool !== 'add-primitive') {
      setShowPrimitives(false);
    }
  }, [currentTool]);

  return (
    <div className="mobile-ui">
      {/* Compact top toolbar */}
      <div className="mobile-toolbar-top">
        <div className="mobile-tool-buttons">
          {mainTools.map(tool => (
            <button
              key={tool.type}
              className={`mobile-tool-btn ${currentTool === tool.type ? 'active' : ''}`}
              onClick={() => {
                setCurrentTool(tool.type);
                if (tool.type === 'add-primitive') {
                  setShowPrimitives(!showPrimitives);
                } else {
                  setShowPrimitives(false);
                }
                setShowSculptTools(false);
              }}
              title={tool.label}
            >
              <span className="tool-icon">{tool.icon}</span>
            </button>
          ))}

          {/* Sculpt tools dropdown button */}
          <button
            className={`mobile-tool-btn ${isSculptTool ? 'active' : ''}`}
            onClick={() => {
              setShowSculptTools(!showSculptTools);
              setShowPrimitives(false);
            }}
            title="Sculpt"
          >
            <span className="tool-icon">🎨</span>
          </button>
        </div>

        {/* Quick actions */}
        <div className="mobile-quick-actions">
          <button
            className="mobile-action-btn"
            onClick={onUndo}
            disabled={!canUndo}
          >
            ↶
          </button>
          <button
            className="mobile-action-btn"
            onClick={onRedo}
            disabled={!canRedo}
          >
            ↷
          </button>
          <button
            className="mobile-action-btn"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Sculpt tools selector (dropdown) */}
      {showSculptTools && (
        <div className="mobile-sculpt-selector">
          {sculptTools.map(tool => (
            <button
              key={tool.type}
              className={`mobile-sculpt-tool-btn ${currentTool === tool.type ? 'active' : ''}`}
              onClick={() => {
                setCurrentTool(tool.type);
                setShowSculptTools(false);
              }}
            >
              <span className="tool-icon">{tool.icon}</span>
              <span className="tool-label">{tool.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Primitive selector (only when add-primitive is active) */}
      {showPrimitives && (
        <div className="mobile-primitive-selector">
          {primitives.map(primitive => (
            <button
              key={primitive}
              className={`mobile-primitive-btn ${selectedPrimitive === primitive ? 'active' : ''}`}
              onClick={() => {
                setSelectedPrimitive(primitive);
                setShowPrimitives(false);
              }}
            >
              {primitive}
            </button>
          ))}
        </div>
      )}

      {/* Sculpt controls button (only for sculpt tools) */}
      {isSculptTool && (
        <div className="mobile-sculpt-button-container">
          <button
            className="mobile-sculpt-toggle-btn"
            onClick={() => setShowSculptControls(!showSculptControls)}
          >
            🎨 Sculpt Controls {showSculptControls ? '▼' : '▶'}
          </button>
        </div>
      )}

      {/* Sculpt controls panel (expanded when showSculptControls is true) */}
      {isSculptTool && showSculptControls && (
        <div className="mobile-sculpt-controls">
          <div className="mobile-control-group">
            <label className="mobile-slider-label">
              Size: {Math.round(brushSize * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={brushSize * 100}
              onChange={(e) => setBrushSize(parseInt(e.target.value) / 100)}
              className="mobile-slider"
            />
          </div>

          <div className="mobile-control-group">
            <label className="mobile-slider-label">
              Strength: {Math.round(brushStrength * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={brushStrength * 100}
              onChange={(e) => setBrushStrength(parseInt(e.target.value) / 100)}
              className="mobile-slider"
            />
          </div>

          <div className="mobile-control-group">
            <label className="mobile-slider-label">Symmetry:</label>
            <div className="mobile-symmetry-buttons">
              <button
                className={`mobile-symmetry-btn ${symmetryAxes.x ? 'active' : ''}`}
                onClick={() => setSymmetryAxes({ ...symmetryAxes, x: !symmetryAxes.x })}
              >
                X
              </button>
              <button
                className={`mobile-symmetry-btn ${symmetryAxes.y ? 'active' : ''}`}
                onClick={() => setSymmetryAxes({ ...symmetryAxes, y: !symmetryAxes.y })}
              >
                Y
              </button>
              <button
                className={`mobile-symmetry-btn ${symmetryAxes.z ? 'active' : ''}`}
                onClick={() => setSymmetryAxes({ ...symmetryAxes, z: !symmetryAxes.z })}
              >
                Z
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel (hidden by default) */}
      {showSettings && (
        <div className="mobile-settings-panel">
          <div className="mobile-settings-header">
            <h3>Settings</h3>
            <button
              className="mobile-close-btn"
              onClick={() => setShowSettings(false)}
            >
              ✕
            </button>
          </div>

          {hasSelection && (
            <>
              <div className="mobile-render-mode">
                <label className="mobile-settings-label">Render Mode:</label>
                <div className="mobile-render-buttons">
                  <button
                    className={`mobile-render-btn ${selectedRenderMode === 'shaded' ? 'active' : ''}`}
                    onClick={() => onRenderModeChange('shaded')}
                  >
                    Shaded
                  </button>
                  <button
                    className={`mobile-render-btn ${selectedRenderMode === 'mesh' ? 'active' : ''}`}
                    onClick={() => onRenderModeChange('mesh')}
                  >
                    Mesh
                  </button>
                </div>
              </div>

              <button
                className="mobile-delete-btn"
                onClick={() => {
                  onDeleteSelected();
                  setShowSettings(false);
                }}
              >
                Delete Selected Object
              </button>
            </>
          )}

          <div className="mobile-info">
            <p>Tool: {currentTool}</p>
            {currentTool === 'add-primitive' && <p>Shape: {selectedPrimitive}</p>}
            {isSculptTool && <p>Strength: {Math.round(brushStrength * 100)}%</p>}
          </div>
        </div>
      )}

      <style>{`
        .mobile-ui {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          pointer-events: none;
        }

        .mobile-ui > * {
          pointer-events: auto;
        }

        .mobile-toolbar-top {
          display: flex;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.8);
          padding: 8px;
          backdrop-filter: blur(10px);
        }

        .mobile-tool-buttons {
          display: flex;
          gap: 4px;
        }

        .mobile-tool-btn {
          min-width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        .mobile-tool-btn.active {
          background: #2196F3;
          border-color: #2196F3;
        }

        .mobile-quick-actions {
          display: flex;
          gap: 4px;
        }

        .mobile-action-btn {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-action-btn:disabled {
          opacity: 0.3;
        }

        .mobile-primitive-selector {
          background: rgba(0, 0, 0, 0.8);
          padding: 8px;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          backdrop-filter: blur(10px);
        }

        .mobile-primitive-btn {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          white-space: nowrap;
        }

        .mobile-primitive-btn.active {
          background: #4CAF50;
          border-color: #4CAF50;
        }

        .mobile-sculpt-selector {
          background: rgba(0, 0, 0, 0.9);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .mobile-sculpt-tool-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          text-align: left;
          font-size: 14px;
        }

        .mobile-sculpt-tool-btn.active {
          background: #2196F3;
          border-color: #2196F3;
        }

        .mobile-sculpt-tool-btn .tool-icon {
          font-size: 18px;
          width: 24px;
          text-align: center;
        }

        .mobile-sculpt-tool-btn .tool-label {
          flex: 1;
        }

        .mobile-sculpt-button-container {
          background: rgba(0, 0, 0, 0.8);
          padding: 8px;
          backdrop-filter: blur(10px);
        }

        .mobile-sculpt-toggle-btn {
          width: 100%;
          padding: 10px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          font-size: 14px;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mobile-sculpt-controls {
          background: rgba(0, 0, 0, 0.9);
          padding: 12px;
          backdrop-filter: blur(10px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .mobile-control-group {
          margin-bottom: 12px;
        }

        .mobile-control-group:last-child {
          margin-bottom: 0;
        }

        .mobile-slider-label {
          color: white;
          font-size: 12px;
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .mobile-slider {
          width: 100%;
          height: 30px;
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
        }

        .mobile-slider::-webkit-slider-track {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        .mobile-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
        }

        .mobile-symmetry-buttons {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .mobile-symmetry-btn {
          flex: 1;
          padding: 8px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s;
        }

        .mobile-symmetry-btn.active {
          background: #2196F3;
          border-color: #2196F3;
        }

        .mobile-settings-panel {
          position: fixed;
          top: 60px;
          right: 8px;
          background: rgba(0, 0, 0, 0.9);
          border-radius: 8px;
          padding: 12px;
          min-width: 200px;
          backdrop-filter: blur(10px);
        }

        .mobile-settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .mobile-settings-header h3 {
          color: white;
          margin: 0;
          font-size: 14px;
        }

        .mobile-close-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 20px;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .mobile-settings-label {
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          display: block;
          margin-bottom: 6px;
        }

        .mobile-render-mode {
          margin-bottom: 12px;
        }

        .mobile-render-buttons {
          display: flex;
          gap: 4px;
        }

        .mobile-render-btn {
          flex: 1;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 4px;
          font-size: 12px;
        }

        .mobile-render-btn.active {
          background: #2196F3;
          border-color: #2196F3;
        }

        .mobile-delete-btn {
          width: 100%;
          padding: 8px;
          background: #f44336;
          border: none;
          color: white;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .mobile-info {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }

        .mobile-info p {
          margin: 4px 0;
        }

        @media (min-width: 768px) {
          .mobile-ui {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}