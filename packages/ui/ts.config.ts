{
    "extends": "../../tsconfig.json",
    "compilerOptions": {
      "outDir": "./dist",
      "rootDir": "./src",
      "declaration": true,
      "declarationMap": true,
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "jsx": "react-jsx"
    },
    "include": ["src"],
    "references": [
      { "path": "../shared" }
    ],
    "exclude": ["dist", "node_modules"]
  }
  