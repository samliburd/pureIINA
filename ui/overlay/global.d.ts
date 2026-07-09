// Define the shapes of the data payloads
interface IINAUpdateData {
  time: string;
  videoFrame: { x: number; y: number; width: number; height: number } | null;
  videoWidth: number;
  videoHeight: number;
  scale?: number;
}

interface IINAClickData {
  firstClick: { x: number; y: number };
  secondClick: { x: number; y: number };
  normFirstClick: { x: number; y: number };
  normSecondClick: { x: number; y: number };
  cropBox: { x: number; y: number; width: number; height: number } | null;
  isWaiting: boolean;
}

// Extend the global Window object
declare global {
  interface Window {
    iina?: {
      postMessage: (name: string, data?: any) => void;
      // Use function overloads to provide strict typing based on the message name
      onMessage(name: "update", callback: (data: IINAUpdateData) => void): void;
      onMessage(name: "click", callback: (data: IINAClickData) => void): void;
      onMessage(name: string, callback: (data: any) => void): void;
    };
  }
}

export {}; // Ensure this file is treated as a module