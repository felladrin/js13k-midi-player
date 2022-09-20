export declare interface TinySequencerData {
  bpm: number;
  ppqn: number;
  gaps: number[];
  tracks: {
    data: number[];
    wave: string;
    mixer: number[];
    adsr: number[];
    portamento: number;
    cutoffDuration: number;
  }[];
}

export declare class TinySequencer {
  constructor(
    ac: AudioContext,
    data: TinySequencerData,
    destNode: DynamicsCompressorNode,
    maxMidi?: number
  );
  play(loop: boolean): void;
  stop(): void;
  isPlaying(): boolean;
  currentTime(): number;
  duration: number;
}
