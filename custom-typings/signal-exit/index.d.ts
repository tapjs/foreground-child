declare module "signal-exit" {
  namespace signalExit {
    interface SignalExit {
      (listener: (code: number | null, signal: string | null) => void): void;

      signals(): NodeJS.Signals[];
    }
  }

  const signalExit: signalExit.SignalExit;

  export = signalExit;
}
