export {};

declare global {
  interface Window {
    electronWindow: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
    };
  }
}
