import type { PrimitiveType, ToolType } from '../../types';
import { TOOL_DEFINITIONS, PRIMITIVE_DEFINITIONS } from '../../services/tools/toolDefinitions';

interface ToolbarProps {
  currentTool: ToolType;
  selectedPrimitive: PrimitiveType;
  selectedObjectId: string | null;
  onToolChange: (tool: ToolType) => void;
  onPrimitiveSelect: (primitive: PrimitiveType) => void;
}

export function Toolbar({
  currentTool,
  selectedPrimitive,
  selectedObjectId,
  onToolChange,
  onPrimitiveSelect,
}: ToolbarProps) {
  const hasSelectedObject = selectedObjectId !== null;

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      zIndex: 100,
    }}>
      {/* Tool Selection */}
      <div style={{
        display: 'flex',
        gap: '5px',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      }}>
        {TOOL_DEFINITIONS.map((tool) => {
          const isDisabled = tool.requiresObject && !hasSelectedObject;
          return (
            <button
              key={tool.id}
              onClick={() => !isDisabled && onToolChange(tool.id)}
              disabled={isDisabled}
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: currentTool === tool.id ? '#4a90e2' :
                                isDisabled ? '#1a1a1a' : '#2c2c2c',
                border: 'none',
                borderRadius: '6px',
                color: isDisabled ? '#666' : 'white',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                fontSize: '20px',
                opacity: isDisabled ? 0.5 : 1,
              }}
              title={isDisabled ? `${tool.label} (Select an object first)` : tool.label}
            >
              <span>{tool.icon}</span>
              <span style={{ fontSize: '9px', marginTop: '2px' }}>{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Primitive Selection */}
      {currentTool === 'add-primitive' && (
        <div style={{
          display: 'flex',
          gap: '5px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        }}>
          {PRIMITIVE_DEFINITIONS.map((primitive) => (
            <button
              key={primitive.id}
              onClick={() => onPrimitiveSelect(primitive.id)}
              style={{
                width: '45px',
                height: '45px',
                backgroundColor: selectedPrimitive === primitive.id ? '#4a90e2' : '#2c2c2c',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                fontSize: '18px',
              }}
              title={primitive.label}
            >
              <span>{primitive.icon}</span>
              <span style={{ fontSize: '8px', marginTop: '2px' }}>{primitive.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}