# 3D Sculpting Web Application

A browser-based 3D sculpting application built with React and Three.js, offering real-time mesh manipulation and sculpting tools similar to professional 3D modeling software.



https://github.com/user-attachments/assets/3f3c7f82-a05a-400a-be55-bfd3fc1ea78a



## Features

- **Real-time 3D Sculpting**: Add, subtract, and push mesh surfaces with dynamic subdivision
- **Multiple Primitive Shapes**: Start with spheres, cubes, cylinders, cones, and torus shapes
- **Advanced Mesh Manipulation**:
  - Symmetric subdivision for smooth surface refinement
  - Adaptive tessellation based on brush proximity
  - Real-time geometry updates with optimized performance
- **Professional Tools**:
  - Sculpting brushes (add, subtract, push)
  - Transform tools (move, scale, rotate)
  - Selection and multi-object support
  - Undo/redo functionality
- **Interactive 3D Viewport**:
  - Orbit controls for camera navigation
  - Grid and axis helpers
  - Real-time brush preview
  - Dynamic tool strength adjustment

## Technologies Used

- **React 18** with TypeScript
- **Three.js** for 3D rendering
- **@react-three/fiber** for React-Three.js integration
- **@react-three/drei** for 3D helpers and controls
- **Vite** for fast development and building
- **Vitest** for testing

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sculpt-3D.git
cd sculpt-3D
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

### Basic Controls

- **Left Mouse**: Apply current tool (when clicking on objects)
- **Middle Mouse / Right Mouse**: Rotate view
- **Scroll**: Zoom in/out
- **Right Mouse**: Pan view

### Tools

- **Add Primitive**: Click the primitive buttons to add new shapes to the scene
- **Sculpt Mode**:
  - **Add**: Click and drag to add material
  - **Subtract**: Click and drag to remove material
  - **Push**: Click and drag to push/pull surfaces
- **Transform Mode**:
  - **Move**: Click and drag to move objects
  - **Scale**: Click and drag to scale objects
  - **Rotate**: Click and drag to rotate objects
- **Select**: Click to select objects for editing

### Keyboard Shortcuts

- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Shift + Z**: Redo
- **Delete**: Remove selected object

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/         # React components
│   ├── canvas/        # 3D canvas and scene components
│   ├── objects/       # 3D object components
│   └── ui/            # User interface components
├── services/          # Business logic
│   └── sculpting/     # Sculpting engine and algorithms
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

### Key Components

- **ModelingCanvas**: Main 3D viewport with camera and controls
- **SceneObject**: Manages individual 3D objects and sculpting interactions
- **SculptingEngine**: Core sculpting algorithms and mesh manipulation
- **Scene**: Manages the overall 3D scene and object collection

## Architecture Highlights

- **Optimized Rendering**: Uses React Three Fiber for efficient React-Three.js integration
- **Geometry Versioning**: Prevents race conditions during rapid sculpting operations
- **Symmetric Subdivision**: Custom algorithm for smooth mesh refinement
- **Memory Management**: Proper cleanup of Three.js resources and geometries

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is open source and available under the MIT License.
