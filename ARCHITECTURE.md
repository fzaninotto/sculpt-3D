# 3D Modeling App - Architecture

## Overview
This is a web-based 3D modeling and sculpting application built with React, Three.js, and TypeScript. The codebase follows a clean, modular architecture with clear separation of concerns.

## Directory Structure

```
src/
├── components/          # React components organized by purpose
│   ├── canvas/         # Main canvas and scene components
│   │   ├── ModelingCanvas.tsx  # Main application container
│   │   └── Scene.tsx           # 3D scene setup and object rendering
│   ├── objects/        # 3D object-related components
│   │   ├── SceneObject.tsx     # Individual 3D object renderer
│   │   ├── PlacementPreview.tsx # Preview for placing new objects
│   │   └── PlacementHandler.tsx # Handles object placement logic
│   ├── tools/          # Tool-related components
│   │   ├── Toolbar.tsx         # Main toolbar UI
│   │   └── BrushPreview.tsx    # Sculpting brush visualization
│   └── ui/             # UI overlay components
│       ├── ObjectSidebar.tsx   # Object properties panel
│       ├── SculptingControls.tsx # Sculpting parameters UI
│       └── StatusOverlay.tsx    # Tool status and help display
│
├── hooks/              # Custom React hooks for business logic
│   ├── useSculpting.ts         # Sculpting operations logic
│   └── useObjectManipulation.ts # Move/scale tool logic
│
├── services/           # Business logic and utilities
│   ├── geometry/       # Geometry creation and management
│   │   └── primitiveFactory.ts # Creates adaptive primitive meshes
│   └── tools/          # Tool definitions and configuration
│       └── toolDefinitions.ts  # Central tool metadata
│
├── types/              # TypeScript type definitions
│   └── index.ts               # Shared type definitions
│
└── utils/              # Utility functions
    ├── meshSubdivision.ts     # Adaptive mesh subdivision
    └── meshSubdivisionSimple.ts # Simple subdivision algorithm
```

## Key Components

### ModelingCanvas (`components/canvas/ModelingCanvas.tsx`)
- **Purpose**: Main application container
- **Responsibilities**:
  - State management for tools, objects, and UI
  - Keyboard shortcut handling
  - Coordinating all child components

### SceneObject (`components/objects/SceneObject.tsx`)
- **Purpose**: Renders individual 3D objects
- **Responsibilities**:
  - Object rendering (shaded/wireframe modes)
  - Delegating sculpting logic to `useSculpting` hook
  - Delegating manipulation to `useObjectManipulation` hook
- **Clean Design**: Only ~180 lines (down from 550+)

### useSculpting Hook (`hooks/useSculpting.ts`)
- **Purpose**: Encapsulates all sculpting logic
- **Features**:
  - Add/Subtract/Push tool implementations
  - Adaptive mesh subdivision
  - Mouse tracking and raycasting
  - Shift key modifier handling

### PrimitiveFactory (`services/geometry/primitiveFactory.ts`)
- **Purpose**: Creates geometries with adaptive detail
- **Features**:
  - Generates all primitive types (sphere, cube, cylinder, cone, torus)
  - Adaptive subdivision based on object scale
  - Consistent edge length for optimal sculpting

### Tool Definitions (`services/tools/toolDefinitions.ts`)
- **Purpose**: Central source of truth for tool configuration
- **Contents**:
  - Tool metadata (icon, label, help text)
  - Tool requirements (needs object selected?)
  - Tool behavior flags (disables orbit control?)
  - Brush colors for sculpting tools

## Design Principles

### 1. Separation of Concerns
- **Rendering**: Components focus on presentation
- **Business Logic**: Hooks and services handle complex operations
- **State Management**: Centralized in container components

### 2. Reusability
- Custom hooks can be used in multiple components
- Services are pure functions/classes
- Tool definitions drive UI dynamically

### 3. Maintainability
- Small, focused files (most under 200 lines)
- Clear naming conventions
- Logical folder structure

### 4. Type Safety
- Full TypeScript coverage
- Shared type definitions
- Interface-driven development

## Key Features

### Tools
- **Select**: Object selection
- **Add Shape**: Place new primitives with drag-to-scale
- **Move**: 3D camera-relative object movement
- **Scale**: Uniform object scaling
- **Add**: Additive sculpting (blue brush)
- **Subtract**: Subtractive sculpting (red brush)
- **Push**: Push/pull vertices in drag direction (orange brush)

### Sculpting System
- Adaptive mesh subdivision near brush
- Real-time vertex deformation
- Progressive falloff for smooth results
- Shift key modifier for inverse operations

### UI Components
- Tool-aware help text
- Disabled states for object-dependent tools
- Real-time vertex count display
- Keyboard shortcuts support

## Developer Guide

### Adding a New Tool
1. Add tool type to `types/index.ts`
2. Define tool in `toolDefinitions.ts`
3. Implement logic in appropriate hook/service
4. Tool automatically appears in UI

### Adding a New Primitive
1. Add type to `PrimitiveType` in `types/index.ts`
2. Implement creation in `PrimitiveFactory`
3. Add to `PRIMITIVE_DEFINITIONS`
4. Automatically available in UI

### Modifying Sculpting Behavior
- Edit `useSculpting` hook for tool logic
- Modify `meshSubdivision.ts` for subdivision algorithm
- Update `BrushPreview` for visual feedback

## Performance Considerations
- Geometry updates use `DynamicDrawUsage`
- Subdivision throttled to 100ms intervals
- Vertex counts displayed for monitoring
- Adaptive detail based on object scale