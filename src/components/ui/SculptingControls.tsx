import type { ToolType } from '../../types';
import { getToolDefinition } from '../../services/tools/toolDefinitions';

interface SculptingControlsProps {
  currentTool: ToolType;
  brushSize: number;
  brushStrength: number;
  selectedObjectId: string | null;
  symmetryAxes: { x: boolean; y: boolean; z: boolean };
  onBrushSizeChange: (size: number) => void;
  onBrushStrengthChange: (strength: number) => void;
  onSymmetryChange: (axis: 'x' | 'y' | 'z', enabled: boolean) => void;
}

export function SculptingControls({
  currentTool,
  brushSize,
  brushStrength,
  selectedObjectId,
  symmetryAxes,
  onBrushSizeChange,
  onBrushStrengthChange,
  onSymmetryChange,
}: SculptingControlsProps) {
  const toolDef = getToolDefinition(currentTool);

  if (!toolDef.isSculptingTool) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: '15px',
      borderRadius: '8px',
      color: 'white',
      fontFamily: 'monospace',
      minWidth: '250px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
        {toolDef.label} Tool Controls
      </h3>

      {!selectedObjectId && (
        <div style={{
          backgroundColor: 'rgba(255,165,0,0.2)',
          border: '1px solid orange',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          fontSize: '12px'
        }}>
          ⚠️ Select an object to start sculpting
        </div>
      )}

      {selectedObjectId && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Brush Size: {brushSize.toFixed(2)}</span>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={brushSize}
                onChange={(e) => onBrushSizeChange(parseFloat(e.target.value))}
                style={{ width: '150px', marginLeft: '10px' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Strength: {(brushStrength * 100).toFixed(0)}%</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={brushStrength}
                onChange={(e) => onBrushStrengthChange(parseFloat(e.target.value))}
                style={{ width: '150px', marginLeft: '10px' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <strong>Symmetry:</strong>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['x', 'y', 'z'] as const).map(axis => (
                <button
                  key={axis}
                  onClick={() => onSymmetryChange(axis, !symmetryAxes[axis])}
                  style={{
                    flex: 1,
                    padding: '6px',
                    backgroundColor: symmetryAxes[axis] ? '#4a90e2' : '#2c2c2c',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '12px',
                    fontWeight: symmetryAxes[axis] ? 'bold' : 'normal',
                    boxShadow: symmetryAxes[axis] ? '0 0 8px rgba(74, 144, 226, 0.5)' : 'none',
                  }}
                  title={`Mirror on ${axis.toUpperCase()}-axis`}
                >
                  {axis.toUpperCase()}
                </button>
              ))}
            </div>
            {(symmetryAxes.x || symmetryAxes.y || symmetryAxes.z) && (
              <div style={{
                fontSize: '10px',
                color: '#4a90e2',
                marginTop: '4px',
                textAlign: 'center'
              }}>
                Mirroring on {[
                  symmetryAxes.x && 'X',
                  symmetryAxes.y && 'Y',
                  symmetryAxes.z && 'Z'
                ].filter(Boolean).join(', ')} axis
              </div>
            )}
          </div>

          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.2)',
            paddingTop: '10px',
            marginTop: '10px',
            fontSize: '11px',
            color: '#aaa'
          }}>
            <div>Shortcuts:</div>
            <div>[ / ] - Brush size</div>
            <div>Shift+[ / Shift+] - Strength</div>
            <div>X / Y / Z - Toggle symmetry</div>
          </div>
        </>
      )}
    </div>
  );
}