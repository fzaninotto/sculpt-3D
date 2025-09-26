import type { PrimitiveType } from '../types';

interface ObjectSidebarProps {
  selectedObjectId: string | null;
  selectedObjectType?: PrimitiveType;
  selectedRenderMode: 'shaded' | 'mesh';
  vertexCount: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  onRenderModeChange: (mode: 'shaded' | 'mesh') => void;
  onDeleteObject: () => void;
  onPositionChange: (position: [number, number, number]) => void;
  onRotationChange: (rotation: [number, number, number]) => void;
  onScaleChange: (scale: [number, number, number]) => void;
}

export function ObjectSidebar({
  selectedObjectId,
  selectedObjectType,
  selectedRenderMode,
  vertexCount,
  position,
  rotation,
  scale,
  onRenderModeChange,
  onDeleteObject,
  onPositionChange,
  onRotationChange,
  onScaleChange,
}: ObjectSidebarProps) {
  if (!selectedObjectId) {
    return null;
  }

  const handlePositionChange = (axis: number, value: number) => {
    const newPosition: [number, number, number] = [...position];
    newPosition[axis] = value;
    onPositionChange(newPosition);
  };

  const handleRotationChange = (axis: number, value: number) => {
    const newRotation: [number, number, number] = [...rotation];
    newRotation[axis] = value;
    onRotationChange(newRotation);
  };

  const handleScaleChange = (axis: number, value: number) => {
    const newScale: [number, number, number] = [...scale];
    newScale[axis] = value;
    onScaleChange(newScale);
  };

  const handleUniformScaleChange = (value: number) => {
    onScaleChange([value, value, value]);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      width: '280px',
      backgroundColor: 'rgba(0,0,0,0.9)',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      color: 'white',
      fontSize: '14px',
      zIndex: 100,
    }}>
      <h3 style={{
        margin: '0 0 15px 0',
        fontSize: '16px',
        color: '#4a90e2',
        textTransform: 'capitalize'
      }}>
        {selectedObjectType} Object
      </h3>

      {/* Object Info */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>Vertices:</strong> {vertexCount.toLocaleString()}
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>ID:</strong> {selectedObjectId.slice(0, 8)}...
        </div>
      </div>

      {/* Render Mode */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Render Mode</div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => onRenderModeChange('shaded')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: selectedRenderMode === 'shaded' ? '#4a90e2' : '#2c2c2c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.2s ease',
            }}
          >
            Shaded
          </button>
          <button
            onClick={() => onRenderModeChange('mesh')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: selectedRenderMode === 'mesh' ? '#4a90e2' : '#2c2c2c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.2s ease',
            }}
          >
            Mesh
          </button>
        </div>
      </div>

      {/* Position Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Position</div>
        {['X', 'Y', 'Z'].map((axis, index) => (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ width: '15px', marginRight: '8px' }}>{axis}:</span>
            <input
              type="number"
              value={position[index].toFixed(2)}
              onChange={(e) => handlePositionChange(index, parseFloat(e.target.value) || 0)}
              step="0.1"
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: '#2c2c2c',
                border: '1px solid #444',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
              }}
            />
          </div>
        ))}
      </div>

      {/* Rotation Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Rotation (degrees)</div>
        {['X', 'Y', 'Z'].map((axis, index) => (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ width: '15px', marginRight: '8px' }}>{axis}:</span>
            <input
              type="number"
              value={(rotation[index] * 180 / Math.PI).toFixed(1)}
              onChange={(e) => handleRotationChange(index, (parseFloat(e.target.value) || 0) * Math.PI / 180)}
              step="5"
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: '#2c2c2c',
                border: '1px solid #444',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
              }}
            />
          </div>
        ))}
      </div>

      {/* Scale Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Scale</div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ width: '60px', marginRight: '8px' }}>Uniform:</span>
          <input
            type="number"
            value={scale[0].toFixed(2)}
            onChange={(e) => handleUniformScaleChange(parseFloat(e.target.value) || 1)}
            step="0.1"
            min="0.1"
            style={{
              flex: 1,
              padding: '4px 8px',
              backgroundColor: '#2c2c2c',
              border: '1px solid #444',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
            }}
          />
        </div>
        {['X', 'Y', 'Z'].map((axis, index) => (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ width: '15px', marginRight: '8px' }}>{axis}:</span>
            <input
              type="number"
              value={scale[index].toFixed(2)}
              onChange={(e) => handleScaleChange(index, parseFloat(e.target.value) || 1)}
              step="0.1"
              min="0.1"
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: '#2c2c2c',
                border: '1px solid #444',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
              }}
            />
          </div>
        ))}
      </div>

      {/* Delete Button */}
      <button
        onClick={onDeleteObject}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#dc3545',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#c82333';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#dc3545';
        }}
      >
        Delete Object
      </button>
    </div>
  );
}