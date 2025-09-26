import type { PrimitiveType, ToolType } from '../types';

interface ToolbarProps {
  currentTool: ToolType;
  selectedPrimitive: PrimitiveType;
  onToolChange: (tool: ToolType) => void;
  onPrimitiveSelect: (primitive: PrimitiveType) => void;
}

export function Toolbar({
  currentTool,
  selectedPrimitive,
  onToolChange,
  onPrimitiveSelect,
}: ToolbarProps) {
  const tools = [
    { id: 'select', icon: '↖', label: 'Select' },
    { id: 'add-primitive', icon: '⊕', label: 'Add Shape' },
    { id: 'sculpt', icon: '✏', label: 'Sculpt' },
  ] as const;

  const primitives = [
    { id: 'sphere', icon: '○', label: 'Sphere' },
    { id: 'cube', icon: '□', label: 'Cube' },
    { id: 'cylinder', icon: '▭', label: 'Cylinder' },
    { id: 'cone', icon: '△', label: 'Cone' },
    { id: 'torus', icon: '◯', label: 'Torus' },
  ] as const;

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
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id as ToolType)}
            style={{
              width: '50px',
              height: '50px',
              backgroundColor: currentTool === tool.id ? '#4a90e2' : '#2c2c2c',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontSize: '20px',
            }}
            title={tool.label}
          >
            <span>{tool.icon}</span>
            <span style={{ fontSize: '9px', marginTop: '2px' }}>{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Primitive Selection (visible when add-primitive tool is selected) */}
      {currentTool === 'add-primitive' && (
        <div style={{
          display: 'flex',
          gap: '5px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        }}>
          {primitives.map((primitive) => (
            <button
              key={primitive.id}
              onClick={() => {
                onPrimitiveSelect(primitive.id as PrimitiveType);
              }}
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