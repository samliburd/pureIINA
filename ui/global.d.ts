declare global {
  interface Window {
    iina: {
      postMessage: (name: string, data?: any) => void;
      onMessage: (name: string, callback: (data: any) => void) => void;
    };
  }
}
export {};
