import type { PrimitiveType } from '../../types';

interface SceneObjectData {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface ObjectSidebarProps {
  selectedObjectId: string | null;
  objects: SceneObjectData[];
  selectedRenderMode: 'shaded' | 'mesh';
  objectVertexCounts: Record<string, number>;
  onDeselectObject: () => void;
  onDeleteObject: (id: string) => void;
  onRenderModeChange: (mode: 'shaded' | 'mesh') => void;
  onObjectPositionChange: (id: string, position: [number, number, number]) => void;
  onObjectRotationChange: (id: string, rotation: [number, number, number]) => void;
  onObjectScaleChange: (id: string, scale: [number, number, number]) => void;
}

export function ObjectSidebar({
  selectedObjectId,
  objects,
  selectedRenderMode,
  objectVertexCounts,
  onDeselectObject,
  onDeleteObject,
  onRenderModeChange,
  onObjectPositionChange,
  onObjectRotationChange,
  onObjectScaleChange,
}: ObjectSidebarProps) {
  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  if (!selectedObjectId || !selectedObject) {
    return null;
  }

  const vertexCount = objectVertexCounts[selectedObjectId] || 0;

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      width: '250px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontFamily: 'monospace',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Object Properties</h3>
        <button
          onClick={onDeselectObject}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 5px',
          }}
          title="Deselect"
        >
          ×
        </button>
      </div>

      {/* Object Info */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ marginBottom: '5px' }}>
          <strong>Type:</strong> {selectedObject.type}
        </div>
        <div style={{ marginBottom: '5px' }}>
          <strong>ID:</strong> {selectedObjectId.substring(0, 8)}...
        </div>
        <div style={{ marginBottom: '5px' }}>
          <strong>Vertices:</strong> {vertexCount.toLocaleString()}
        </div>
      </div>

      {/* Render Mode */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          <strong>Render Mode:</strong>
        </label>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => onRenderModeChange('shaded')}
            style={{
              flex: 1,
              padding: '5px',
              backgroundColor: selectedRenderMode === 'shaded' ? '#4a90e2' : '#2c2c2c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Shaded
          </button>
          <button
            onClick={() => onRenderModeChange('mesh')}
            style={{
              flex: 1,
              padding: '5px',
              backgroundColor: selectedRenderMode === 'mesh' ? '#4a90e2' : '#2c2c2c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Wireframe
          </button>
        </div>
      </div>

      {/* Position Controls */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Position:</strong>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          {['X', 'Y', 'Z'].map((axis, index) => (
            <div key={axis} style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa' }}>{axis}</label>
              <input
                type="number"
                value={selectedObject.position[index].toFixed(2)}
                step="0.1"
                onChange={(e) => {
                  const newPos = [...selectedObject.position] as [number, number, number];
                  newPos[index] = parseFloat(e.target.value) || 0;
                  onObjectPositionChange(selectedObjectId, newPos);
                }}
                style={{
                  width: '100%',
                  padding: '2px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  color: 'white',
                  borderRadius: '2px',
                  fontSize: '11px',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rotation Controls */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Rotation:</strong>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          {['X', 'Y', 'Z'].map((axis, index) => (
            <div key={axis} style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa' }}>{axis}°</label>
              <input
                type="number"
                value={(selectedObject.rotation[index] * 180 / Math.PI).toFixed(0)}
                step="5"
                onChange={(e) => {
                  const newRot = [...selectedObject.rotation] as [number, number, number];
                  newRot[index] = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                  onObjectRotationChange(selectedObjectId, newRot);
                }}
                style={{
                  width: '100%',
                  padding: '2px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  color: 'white',
                  borderRadius: '2px',
                  fontSize: '11px',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scale Controls */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          <strong>Scale:</strong> {selectedObject.scale[0].toFixed(2)}
        </label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={selectedObject.scale[0]}
          onChange={(e) => {
            const newScale = parseFloat(e.target.value);
            onObjectScaleChange(selectedObjectId, [newScale, newScale, newScale]);
          }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Actions */}
      <div>
        <button
          onClick={() => onDeleteObject(selectedObjectId)}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#d32f2f',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
        >
          Delete Object
        </button>
      </div>
    </div>
  );
}