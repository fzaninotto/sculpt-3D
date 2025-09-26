import type { ToolType, PrimitiveType } from '../../types';

export interface ToolDefinition {
  id: ToolType;
  icon: string;
  label: string;
  requiresObject: boolean;
  isSculptingTool: boolean;
  disablesOrbitControl: boolean;
  helpText?: string;
  brushColor?: string;
}

export interface PrimitiveDefinition {
  id: PrimitiveType;
  icon: string;
  label: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'select',
    icon: '↖',
    label: 'Select',
    requiresObject: false,
    isSculptingTool: false,
    disablesOrbitControl: false,
    helpText: 'Click objects to select',
  },
  {
    id: 'add-primitive',
    icon: '◉',
    label: 'Add Shape',
    requiresObject: false,
    isSculptingTool: false,
    disablesOrbitControl: true,
    helpText: 'Click and drag to place shape',
  },
  {
    id: 'move',
    icon: '✥',
    label: 'Move',
    requiresObject: true,
    isSculptingTool: false,
    disablesOrbitControl: true,
    helpText: 'Click and drag to move object',
  },
  {
    id: 'scale',
    icon: '⤢',
    label: 'Scale',
    requiresObject: true,
    isSculptingTool: false,
    disablesOrbitControl: true,
    helpText: 'Click and drag to scale object',
  },
  {
    id: 'add',
    icon: '+',
    label: 'Add',
    requiresObject: true,
    isSculptingTool: true,
    disablesOrbitControl: true,
    helpText: 'Hold left-click to add material • Hold Shift to subtract',
    brushColor: '#4a90e2',
  },
  {
    id: 'subtract',
    icon: '−',
    label: 'Subtract',
    requiresObject: true,
    isSculptingTool: true,
    disablesOrbitControl: true,
    helpText: 'Hold left-click to subtract material • Hold Shift to add',
    brushColor: '#e24a4a',
  },
  {
    id: 'push',
    icon: '→',
    label: 'Push',
    requiresObject: true,
    isSculptingTool: true,
    disablesOrbitControl: true,
    helpText: 'Hold left-click and drag to push • Hold Shift to pull',
    brushColor: '#e2a44a',
  },
];

export const PRIMITIVE_DEFINITIONS: PrimitiveDefinition[] = [
  { id: 'sphere', icon: '○', label: 'Sphere' },
  { id: 'cube', icon: '□', label: 'Cube' },
  { id: 'cylinder', icon: '▭', label: 'Cylinder' },
  { id: 'cone', icon: '△', label: 'Cone' },
  { id: 'torus', icon: '◯', label: 'Torus' },
];

export const getToolDefinition = (toolId: ToolType): ToolDefinition => {
  return TOOL_DEFINITIONS.find(tool => tool.id === toolId) || TOOL_DEFINITIONS[0];
};

export const getSculptingTools = (): ToolDefinition[] => {
  return TOOL_DEFINITIONS.filter(tool => tool.isSculptingTool);
};

export const getObjectDependentTools = (): ToolDefinition[] => {
  return TOOL_DEFINITIONS.filter(tool => tool.requiresObject);
};

export const getOrbitDisablingTools = (): ToolType[] => {
  return TOOL_DEFINITIONS
    .filter(tool => tool.disablesOrbitControl)
    .map(tool => tool.id);
};