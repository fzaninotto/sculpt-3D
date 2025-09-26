import type { ToolType } from '../../types';
import { getToolDefinition } from '../../services/tools/toolDefinitions';

interface SculptingControlsProps {
  currentTool: ToolType;
  brushSize: number;
  brushStrength: number;
  selectedObjectId: string | null;
  onBrushSizeChange: (size: number) => void;
  onBrushStrengthChange: (strength: number) => void;
}

export function SculptingControls({
  currentTool,
  brushSize,
  brushStrength,
  selectedObjectId,
  onBrushSizeChange,
  onBrushStrengthChange,
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
          </div>
        </>
      )}
    </div>
  );
}